"use client"

import { CheckIcon, TagIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { Controller, useForm } from "react-hook-form"
import { z } from "zod/v4"

import { ContentEditor } from "@/components/content-editor"
import { OptionCombobox } from "@/components/option-combobox"
import { ProjectDialog } from "@/components/project-dialog"
import { isRichTextEmpty } from "@/components/safe-rich-html"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  fetchAgentProfilesAll,
  fetchTagsAll,
  type AdminAgentProfile,
  type TagTree,
} from "@/lib/api/admin"
import {
  fetchTicketDetail,
  type CreateTicketPayload,
  type TicketItem,
  type UpdateTicketPayload,
} from "@/lib/api/ticket"
import { useI18n } from "@/i18n/provider"

type TFunction = (key: string, values?: Record<string, string | number>) => string

type EditDialogProps = {
  open: boolean
  saving: boolean
  itemId: number | null
  initialValues?: Partial<CreateTicketPayload>
  fixedConversationId?: number
  fixedCustomerId?: number
  titleOverride?: string
  descriptionOverride?: string
  onOpenChange: (open: boolean) => void
  onSubmit: (payload: CreateTicketPayload | UpdateTicketPayload) => Promise<void>
}

function createSchema(t: TFunction) {
  return z.object({
  title: z.string().trim().min(1, t("ticket.titleRequired")),
  description: z.string().refine((value) => !isRichTextEmpty(value), t("ticket.descriptionRequired")),
  currentAssigneeId: z.coerce.number().int().min(0).optional(),
  tagIds: z.array(z.number().int().positive()).default([]),
  })
}

type EditForm = {
  title: string
  description: string
  currentAssigneeId?: number
  tagIds: number[]
}

const emptyForm: EditForm = {
  title: "",
  description: "",
  currentAssigneeId: 0,
  tagIds: [],
}

function buildForm(item: TicketItem | null): EditForm {
  if (!item) {
    return emptyForm
  }
  return {
    title: item.title ?? "",
    description: item.description ?? "",
    currentAssigneeId: item.currentAssigneeId ?? 0,
    tagIds: (item.tags ?? []).map((tag) => tag.id),
  }
}

function buildInitialForm(initialValues?: Partial<CreateTicketPayload>): EditForm {
  return {
    title: initialValues?.title?.trim() ?? "",
    description: initialValues?.description ?? "",
    currentAssigneeId: initialValues?.currentAssigneeId ?? 0,
    tagIds: initialValues?.tagIds ?? [],
  }
}

function buildPayload(form: EditForm): CreateTicketPayload {
  const currentAssigneeId = form.currentAssigneeId ?? 0
  return {
    title: form.title.trim(),
    description: form.description.trim(),
    currentAssigneeId,
    tagIds: form.tagIds,
  }
}

type FlatTagNode = TagTree & {
  depth: number
  path: string
}

function flattenTagTree(nodes: TagTree[], depth = 0, parentPath = ""): FlatTagNode[] {
  const result: FlatTagNode[] = []
  nodes.forEach((item) => {
    const path = parentPath ? `${parentPath} / ${item.name}` : item.name
    result.push({ ...item, depth, path })
    if (item.children.length > 0) {
      result.push(...flattenTagTree(item.children, depth + 1, path))
    }
  })
  return result
}

type TicketTagSelectorProps = {
  value?: number[]
  onChange: (value: number[]) => void
  availableTags: TagTree[]
  t: TFunction
}

function TicketTagSelector({ value, onChange, availableTags, t }: TicketTagSelectorProps) {
  const selectedValues = useMemo(() => value ?? [], [value])
  const flatTags = useMemo(() => flattenTagTree(availableTags), [availableTags])
  const selectedTagIDs = useMemo(() => new Set(selectedValues), [selectedValues])
  const selectedTags = useMemo(
    () => flatTags.filter((tag) => selectedTagIDs.has(tag.id)),
    [flatTags, selectedTagIDs],
  )

  function handleToggle(tagID: number) {
    if (selectedTagIDs.has(tagID)) {
      onChange(selectedValues.filter((item) => item !== tagID))
      return
    }
    onChange(selectedValues.concat(tagID))
  }

  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger
          render={
            <Button type="button" variant="outline" className="w-full justify-start" />
          }
        >
          <TagIcon className="size-4" />
          {selectedTags.length > 0 ? t("ticket.selectedTags", { count: selectedTags.length }) : t("ticket.selectTags")}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[320px] p-0">
          <Command>
            <CommandInput placeholder={t("ticket.searchTags")} />
            <CommandList>
              <CommandEmpty>{t("ticket.emptyTags")}</CommandEmpty>
              <CommandGroup heading={t("ticket.tags")}>
                {flatTags.map((tag) => {
                  const checked = selectedTagIDs.has(tag.id)
                  return (
                    <CommandItem
                      key={tag.id}
                      value={`${tag.id} ${tag.path} ${tag.remark}`}
                      onSelect={() => handleToggle(tag.id)}
                    >
                      <CheckIcon className={`mr-2 size-4 ${checked ? "opacity-100" : "opacity-0"}`} />
                      <span className="truncate" style={{ paddingLeft: `${tag.depth * 12}px` }}>
                        {tag.name}
                      </span>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedTags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selectedTags.map((tag) => (
            <Badge key={tag.id} variant="outline">
              {tag.path}
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function EditDialog({
  open,
  saving,
  itemId,
  initialValues,
  fixedConversationId,
  fixedCustomerId,
  titleOverride,
  descriptionOverride,
  onOpenChange,
  onSubmit,
}: EditDialogProps) {
  if (!open) {
    return null
  }
  return (
    <TicketEditDialogBody
      key={itemId ? `edit-${itemId}` : "create"}
      open={open}
      saving={saving}
      itemId={itemId}
      initialValues={initialValues}
      fixedConversationId={fixedConversationId}
      fixedCustomerId={fixedCustomerId}
      titleOverride={titleOverride}
      descriptionOverride={descriptionOverride}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
    />
  )
}

type TicketEditDialogBodyProps = EditDialogProps

function TicketEditDialogBody({
  open,
  saving,
  itemId,
  initialValues,
  fixedConversationId,
  fixedCustomerId,
  titleOverride,
  descriptionOverride,
  onOpenChange,
  onSubmit,
}: TicketEditDialogBodyProps) {
  const t = useI18n()
  const formId = "ticket-edit-form"
  const [loading, setLoading] = useState(false)
  const [tags, setTags] = useState<TagTree[]>([])
  const [agents, setAgents] = useState<AdminAgentProfile[]>([])
  const schema = useMemo(() => createSchema(t), [t])
  const editFormResolver = useMemo(
    () => zodResolver(schema) as Resolver<EditForm>,
    [schema],
  )
  const form = useForm<EditForm>({
    resolver: editFormResolver,
    defaultValues: emptyForm,
  })
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = form

  useEffect(() => {
    async function loadDetail() {
      if (!itemId) {
        reset(buildInitialForm(initialValues))
        return
      }
      setLoading(true)
      try {
        const data = await fetchTicketDetail(itemId)
        reset(buildForm(data.ticket))
      } finally {
        setLoading(false)
      }
    }
    void loadDetail()
  }, [initialValues, itemId, reset])

  useEffect(() => {
    if (!open) {
      return
    }
    void (async () => {
      const [tagData, agentData] = await Promise.all([
        fetchTagsAll(),
        fetchAgentProfilesAll(),
      ])
      setTags(Array.isArray(tagData) ? tagData : [])
      setAgents(Array.isArray(agentData) ? agentData : [])
    })()
  }, [open])

  const agentOptions = [{ value: "0", label: t("ticket.noAssignee") }].concat(
    agents.map((agent) => ({
      value: String(agent.userId),
      label:
        agent.displayName ||
        agent.nickname ||
        agent.username ||
        t("ticket.agentFallback", { id: agent.userId }),
    })),
  )

  async function onFormSubmit(values: EditForm) {
    const payload = buildPayload(values)
    if (itemId) {
      await onSubmit({
        ticketId: itemId,
        ...payload,
      })
      return
    }
    await onSubmit({
      ...payload,
      source: fixedConversationId ? "conversation" : "manual",
      conversationId: fixedConversationId,
      customerId: fixedCustomerId,
    })
  }

  return (
    <ProjectDialog
      open={open}
      onOpenChange={onOpenChange}
      title={titleOverride || (itemId ? t("ticket.editTitle") : t("ticket.createTitle"))}
      description={descriptionOverride || t("ticket.dialogDescription")}
      size="lg"
      allowFullscreen
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("ticket.cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={saving || loading}>
            {saving ? t("ticket.saving") : itemId ? t("ticket.save") : t("ticket.create")}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">{t("ticket.loading")}</div>
        </div>
      ) : (
        <form id={formId} onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <FieldGroup>
            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="ticket-title">{t("ticket.title")}</FieldLabel>
              <FieldContent>
                <Input
                  id="ticket-title"
                  placeholder={t("ticket.titlePlaceholder")}
                  aria-invalid={!!errors.title}
                  {...register("title")}
                />
                <FieldError errors={[errors.title]} />
              </FieldContent>
            </Field>

            <Field data-invalid={!!errors.description}>
              <FieldLabel>{t("ticket.description")}</FieldLabel>
              <FieldContent>
                <Controller
                  control={control}
                  name="description"
                  render={({ field }) => (
                    <ContentEditor
                      value={{ mode: "html", raw: field.value ?? "" }}
                      onChange={(next) => field.onChange(next.raw)}
                      placeholder={t("ticket.descriptionRequired")}
                      disabled={saving || loading}
                      allowedModes={["html"]}
                      height={260}
                    />
                  )}
                />
                <FieldError errors={[errors.description]} />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>{t("ticket.assignee")}</FieldLabel>
              <FieldContent>
                <Controller
                  control={control}
                  name="currentAssigneeId"
                  render={({ field }) => (
                    <OptionCombobox
                      value={String(field.value ?? 0)}
                      onChange={(value) => field.onChange(Number(value))}
                      placeholder={t("ticket.selectAssignee")}
                      options={agentOptions}
                    />
                  )}
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>{t("ticket.ticketTags")}</FieldLabel>
              <FieldContent>
                <Controller
                  control={control}
                  name="tagIds"
                  render={({ field }) => (
                    <TicketTagSelector
                      value={field.value}
                      onChange={field.onChange}
                      availableTags={tags}
                      t={t}
                    />
                  )}
                />
              </FieldContent>
            </Field>
          </FieldGroup>
        </form>
      )}
    </ProjectDialog>
  )
}
