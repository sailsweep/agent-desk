"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, Resolver, useForm } from "react-hook-form";
import { z } from "zod/v4";

import { OptionCombobox } from "@/components/option-combobox";
import { ProjectDialog } from "@/components/project-dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  type AdminQuickReply,
  type CreateAdminQuickReplyPayload,
  fetchQuickReply,
} from "@/lib/api/admin";
import { getEnumOptions } from "@/lib/enums";
import { Status, StatusLabels } from "@/lib/generated/enums";
import { useI18n } from "@/i18n/provider";

type QuickReplyFormDialogProps = {
  open: boolean;
  saving: boolean;
  itemId: number | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateAdminQuickReplyPayload) => Promise<void>;
};

const emptyForm: EditForm = {
  groupName: "",
  title: "",
  content: "",
  status: String(Status.Ok),
  sortNo: "0",
};

type EditForm = {
  groupName: string;
  title: string;
  content: string;
  status: string;
  sortNo: string;
};

function createSchema(t: (key: string) => string) {
  return z.object({
    groupName: z.string().trim().min(1, t("quickReply.groupNameRequired")),
    title: z.string().trim().min(1, t("quickReply.titleRequired")),
    content: z.string().trim().min(1, t("quickReply.contentRequired")),
    status: z.enum([String(Status.Ok), String(Status.Disabled)], {
      message: t("quickReply.statusRequired"),
    }),
    sortNo: z
      .string()
      .trim()
      .min(1, t("quickReply.sortRequired"))
      .regex(/^\d+$/, t("quickReply.sortInvalid")),
  });
}

function getLocalizedStatusLabel(value: string | number, t: (key: string) => string) {
  const status = Number(value) as Status;
  if (status === Status.Disabled) {
    return t("status.disabled");
  }
  if (status === Status.Deleted) {
    return t("status.deleted");
  }
  return t("status.ok");
}

function buildForm(item: AdminQuickReply | null): EditForm {
  if (!item) {
    return emptyForm;
  }

  return {
    groupName: item.groupName,
    title: item.title,
    content: item.content,
    status: String(item.status) as EditForm["status"],
    sortNo: String(item.sortNo),
  };
}

function buildPayload(form: EditForm): CreateAdminQuickReplyPayload {
  return {
    groupName: form.groupName.trim(),
    title: form.title.trim(),
    content: form.content.trim(),
    status: Number(form.status) as Status,
    sortNo: Number(form.sortNo),
  };
}

export function EditDialog({
  open,
  saving,
  itemId,
  onOpenChange,
  onSubmit,
}: QuickReplyFormDialogProps) {
  if (!open) {
    return null;
  }

  return (
    <QuickReplyFormDialogBody
      key={itemId ? `edit-${itemId}` : "create"}
      open={open}
      itemId={itemId}
      saving={saving}
      onOpenChange={onOpenChange}
      onSubmit={onSubmit}
    />
  );
}

type QuickReplyFormDialogBodyProps = {
  open: boolean;
  saving: boolean;
  itemId: number | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: CreateAdminQuickReplyPayload) => Promise<void>;
};

function QuickReplyFormDialogBody({
  open,
  saving,
  itemId,
  onOpenChange,
  onSubmit,
}: QuickReplyFormDialogBodyProps) {
  const t = useI18n();
  const formId = "quick-reply-edit-form";
  const [loading, setLoading] = useState(false);
  const quickReplyFormSchema = useMemo(() => createSchema(t), [t]);
  const editFormResolver = useMemo(
    () =>
      zodResolver(quickReplyFormSchema as never) as Resolver<
        z.input<typeof quickReplyFormSchema>,
        undefined,
        z.output<typeof quickReplyFormSchema>
      >,
    [quickReplyFormSchema],
  );
  const formStatusOptions = useMemo(
    () =>
      getEnumOptions(StatusLabels)
        .filter((item) => Number(item.value) !== Status.Deleted)
        .map((item) => ({
          value: String(item.value),
          label: getLocalizedStatusLabel(item.value, t),
        })),
    [t],
  );
  const form = useForm<
    z.input<typeof quickReplyFormSchema>,
    undefined,
    z.output<typeof quickReplyFormSchema>
  >({
    resolver: editFormResolver,
    defaultValues: emptyForm,
  });
  const {
    control,
    handleSubmit,
    reset,
    register,
    formState: { errors },
  } = form;

  useEffect(() => {
    async function loadDetail() {
      if (!itemId) {
        reset(emptyForm);
        return;
      }
      setLoading(true);
      try {
        const data = await fetchQuickReply(itemId);
        reset(buildForm(data));
      } catch (error) {
        console.error("Failed to load quick reply:", error);
      } finally {
        setLoading(false);
      }
    }
    void loadDetail();
  }, [itemId, reset]);

  async function onFormSubmit(values: EditForm) {
    const payload = buildPayload(values);
    await onSubmit(payload);
  }

  return (
    <ProjectDialog
      open={open}
      onOpenChange={onOpenChange}
      title={itemId ? t("quickReply.editTitle") : t("quickReply.createTitle")}
      size="md"
      allowFullscreen
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t("quickReply.cancel")}
          </Button>
          <Button type="submit" form={formId} disabled={saving || loading}>
            {saving ? t("quickReply.saving") : itemId ? t("quickReply.save") : t("quickReply.create")}
          </Button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">{t("quickReply.loadingDetail")}</div>
        </div>
      ) : (
        <form id={formId} onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
          <Field data-invalid={!!errors.groupName}>
            <FieldLabel htmlFor="quick-reply-group-name">{t("quickReply.groupName")}</FieldLabel>
            <FieldContent>
              <Input
                id="quick-reply-group-name"
                placeholder={t("quickReply.groupNamePlaceholder")}
                aria-invalid={!!errors.groupName}
                {...register("groupName")}
              />
              <FieldError errors={[errors.groupName]} />
            </FieldContent>
          </Field>
          <Field data-invalid={!!errors.title}>
            <FieldLabel htmlFor="quick-reply-title">{t("quickReply.title")}</FieldLabel>
            <FieldContent>
              <Input
                id="quick-reply-title"
                placeholder={t("quickReply.titlePlaceholder")}
                aria-invalid={!!errors.title}
                {...register("title")}
              />
              <FieldError errors={[errors.title]} />
            </FieldContent>
          </Field>
          <Field data-invalid={!!errors.content}>
            <FieldLabel htmlFor="quick-reply-content">{t("quickReply.content")}</FieldLabel>
            <FieldContent>
              <Textarea
                id="quick-reply-content"
                placeholder={t("quickReply.contentPlaceholder")}
                rows={6}
                aria-invalid={!!errors.content}
                {...register("content")}
              />
              <FieldError errors={[errors.content]} />
            </FieldContent>
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.status}>
              <FieldLabel>{t("quickReply.columnStatus")}</FieldLabel>
              <FieldContent>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <OptionCombobox
                      value={field.value}
                      options={formStatusOptions}
                      placeholder={t("quickReply.statusRequired")}
                      onChange={field.onChange}
                    />
                  )}
                />
                <FieldError errors={[errors.status]} />
              </FieldContent>
            </Field>
            <Field data-invalid={!!errors.sortNo}>
              <FieldLabel htmlFor="quick-reply-sort-no">{t("quickReply.columnSort")}</FieldLabel>
              <FieldContent>
                <Input
                  id="quick-reply-sort-no"
                  type="number"
                  min={0}
                  step={1}
                  placeholder={t("quickReply.sortPlaceholder")}
                  aria-invalid={!!errors.sortNo}
                  {...register("sortNo")}
                />
                <FieldError errors={[errors.sortNo]} />
              </FieldContent>
            </Field>
          </div>
        </form>
      )}
    </ProjectDialog>
  );
}
