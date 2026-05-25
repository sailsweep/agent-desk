"use client"

import { useCallback, useEffect, useState } from "react"
import {
  FileTextIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import {
  DashboardPage,
  DashboardTableShell,
  DashboardTableStateRow,
  DashboardToolbar,
} from "@/components/dashboard-page"
import { ListPagination } from "@/components/list-pagination"
import { OptionCombobox } from "@/components/option-combobox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  createQuickReply,
  deleteQuickReply,
  fetchQuickReplies,
  updateQuickReply,
  type AdminQuickReply,
  type CreateAdminQuickReplyPayload,
  type PageResult,
} from "@/lib/api/admin"
import { getEnumOptions } from "@/lib/enums"
import { Status, StatusLabels } from "@/lib/generated/enums"
import { useI18n } from "@/i18n/provider"
import { EditDialog } from "./_components/edit"

function getStatusLabel(status: Status, t: (key: string) => string) {
  if (status === Status.Disabled) {
    return t("status.disabled")
  }
  if (status === Status.Deleted) {
    return t("status.deleted")
  }
  return t("status.ok")
}

export default function DashboardQuickRepliesPage() {
  const t = useI18n()
  const [keywordInput, setKeywordInput] = useState("")
  const [groupNameInput, setGroupNameInput] = useState("")
  const [statusFilterInput, setStatusFilterInput] = useState("all")
  const [keyword, setKeyword] = useState("")
  const [groupName, setGroupName] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AdminQuickReply | null>(null)
  const [result, setResult] = useState<PageResult<AdminQuickReply>>({
    results: [],
    page: { page: 1, limit: 20, total: 0 },
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchQuickReplies({
        title: keyword.trim() || undefined,
        groupName: groupName.trim() || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        page,
        limit,
      })
      setResult(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("quickReply.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [groupName, keyword, limit, page, statusFilter, t])

  const listStatusOptions = [
    { value: "all", label: t("status.all") },
    ...getEnumOptions(StatusLabels)
      .filter((item) => Number(item.value) !== Status.Deleted)
      .map((item) => ({
        value: String(item.value),
        label: getStatusLabel(item.value as Status, t),
      })),
  ]

  useEffect(() => {
    void loadData()
  }, [loadData])

  function applyFilters() {
    setKeyword(keywordInput)
    setGroupName(groupNameInput)
    setStatusFilter(statusFilterInput)
    setPage(1)
  }

  function handleFilterKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return
    }

    event.preventDefault()
    applyFilters()
  }

  function handlePageChange(nextPage: number) {
    if (nextPage < 1 || nextPage === page) {
      return
    }
    setPage(nextPage)
  }

  function openCreateDialog() {
    setEditingItem(null)
    setDialogOpen(true)
  }

  function openEditDialog(item: AdminQuickReply) {
    setEditingItem(item)
    setDialogOpen(true)
  }

  function handleDialogOpenChange(open: boolean) {
    if (saving) {
      return
    }
    if (!open) {
      setEditingItem(null)
    }
    setDialogOpen(open)
  }

  async function handleSubmit(payload: CreateAdminQuickReplyPayload) {
    if (saving) {
      return
    }

    setSaving(true)
    try {
      if (editingItem) {
        await updateQuickReply({
          id: editingItem.id,
          ...payload,
        })
        toast.success(t("quickReply.updated", { title: editingItem.title }))
      } else {
        await createQuickReply(payload)
        toast.success(t("quickReply.created", { title: payload.title }))
      }
      setDialogOpen(false)
      setEditingItem(null)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("quickReply.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleStatus(item: AdminQuickReply) {
    setActionLoadingId(item.id)
    try {
      const nextStatus =
        item.status === Status.Ok ? Status.Disabled : Status.Ok
      await updateQuickReply({
        id: item.id,
        groupName: item.groupName,
        title: item.title,
        content: item.content,
        sortNo: item.sortNo,
        status: nextStatus,
      })
      toast.success(
        t(nextStatus === Status.Ok ? "quickReply.enabled" : "quickReply.disabled", { title: item.title })
      )
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("quickReply.statusUpdateFailed"))
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleDelete(item: AdminQuickReply) {
    setActionLoadingId(item.id)
    try {
      await deleteQuickReply(item.id)
      toast.success(t("quickReply.deleted", { title: item.title }))
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("quickReply.deleteFailed"))
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <>
      <DashboardPage>
        <DashboardToolbar
          actions={
            <>
              <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
                <RefreshCwIcon className={loading ? "animate-spin" : undefined} />
                {t("quickReply.refresh")}
              </Button>
              <Button onClick={openCreateDialog}>
                <PlusIcon />
                {t("quickReply.new")}
              </Button>
            </>
          }
        >
          <div className="relative w-full sm:w-72">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={handleFilterKeyDown}
              placeholder={t("quickReply.filterTitle")}
              className="pl-9"
            />
          </div>
          <Input
            value={groupNameInput}
            onChange={(event) => setGroupNameInput(event.target.value)}
            onKeyDown={handleFilterKeyDown}
            placeholder={t("quickReply.filterGroup")}
            className="w-full sm:w-44"
          />
          <div className="w-full sm:w-36">
            <OptionCombobox
              value={statusFilterInput}
              onChange={setStatusFilterInput}
              placeholder={t("status.all")}
              options={[...listStatusOptions]}
            />
          </div>
          <Button variant="outline" onClick={applyFilters} disabled={loading}>
            <SearchIcon />
            {t("quickReply.query")}
          </Button>
        </DashboardToolbar>
        <DashboardTableShell
          pagination={
            <ListPagination
              page={result.page.page}
              total={result.page.total}
              limit={limit}
              loading={loading}
              onPageChange={handlePageChange}
              onLimitChange={(nextLimit) => {
                setLimit(nextLimit)
                setPage(1)
              }}
            />
          }
        >
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>{t("quickReply.columnQuickReply")}</TableHead>
                  <TableHead>{t("quickReply.columnGroup")}</TableHead>
                  <TableHead>{t("quickReply.columnStatus")}</TableHead>
                  <TableHead>{t("quickReply.columnSort")}</TableHead>
                  <TableHead>{t("quickReply.columnCreator")}</TableHead>
                  <TableHead className="w-[92px] text-right">{t("quickReply.columnActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.results.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex size-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                          <FileTextIcon className="size-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium">{item.title}</div>
                          <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {item.content}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.groupName}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status === Status.Ok ? "default" : "outline"
                        }
                      >
                        {getStatusLabel(item.status as Status, t)}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.sortNo}</TableCell>
                    <TableCell>{item.createdBy || "-"}</TableCell>
                    <TableCell className="text-right">
                      <ButtonGroup className="ml-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(item)}
                        >
                          {t("quickReply.edit")}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="outline" size="icon-sm" />}
                            aria-label={t("quickReply.moreActions", { title: item.title })}
                          >
                            <MoreHorizontalIcon />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40 min-w-40">
                            <DropdownMenuItem onClick={() => void handleToggleStatus(item)}>
                              <RefreshCwIcon />
                              {actionLoadingId === item.id
                                ? t("quickReply.processing")
                                : item.status === Status.Ok
                                  ? t("quickReply.disable")
                                  : t("quickReply.enable")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => void handleDelete(item)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2Icon />
                              {actionLoadingId === item.id ? t("quickReply.deleting") : t("quickReply.delete")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </ButtonGroup>
                    </TableCell>
                  </TableRow>
                ))}
                {loading || result.results.length === 0 ? (
                  <DashboardTableStateRow
                    colSpan={6}
                    loading={loading}
                    loadingText={t("quickReply.loading")}
                    emptyText={t("quickReply.empty")}
                  />
                ) : null}
              </TableBody>
            </Table>
        </DashboardTableShell>
      </DashboardPage>
      <EditDialog
        open={dialogOpen}
        saving={saving}
        itemId={editingItem?.id ?? null}
        onOpenChange={handleDialogOpenChange}
        onSubmit={handleSubmit}
      />
    </>
  )
}
