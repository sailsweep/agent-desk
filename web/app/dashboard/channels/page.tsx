"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Building2Icon,
  MessagesSquareIcon,
  MessageSquareMoreIcon,
  MoreHorizontalIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import {
  createChannel,
  deleteChannel,
  fetchChannels,
  updateChannel,
  updateChannelStatus,
  type AdminChannel,
  type CreateAdminChannelPayload,
  type PageResult,
} from "@/lib/api/admin"
import {
  DashboardPage,
  DashboardTableShell,
  DashboardTableStateRow,
  DashboardToolbar,
} from "@/components/dashboard-page"
import { OptionCombobox } from "@/components/option-combobox"
import { EditDialog } from "./_components/edit"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { ListPagination } from "@/components/list-pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Status, StatusLabels } from "@/lib/generated/enums"
import { getEnumOptions } from "@/lib/enums"
import { ButtonGroup } from "@/components/ui/button-group"
import { Switch } from "@/components/ui/switch"
import { useI18n } from "@/i18n/provider"

function getChannelTypeLabel(channelType: string, t: (key: string) => string) {
  if (channelType === "wechat_mp") {
    return t("channel.typeWechatMp")
  }
  if (channelType === "wxwork_kf") {
    return t("channel.typeWxworkKf")
  }
  return t("channel.typeWeb")
}

function getStatusLabel(status: Status, t: (key: string) => string) {
  if (status === Status.Disabled) {
    return t("status.disabled")
  }
  if (status === Status.Deleted) {
    return t("status.deleted")
  }
  return t("status.ok")
}

function ChannelIcon({ channelType }: { channelType: string }) {
  if (channelType === "wechat_mp") {
    return <MessagesSquareIcon className="size-4" />
  }
  if (channelType === "wxwork_kf") {
    return <MessageSquareMoreIcon className="size-4" />
  }
  return <Building2Icon className="size-4" />
}

export default function DashboardChannelsPage() {
  const t = useI18n()
  const [nameInput, setNameInput] = useState("")
  const [channelIdInput, setChannelIdInput] = useState("")
  const [channelTypeInput, setChannelTypeInput] = useState("all")
  const [statusInput, setStatusInput] = useState("all")
  const [name, setName] = useState("")
  const [channelId, setChannelId] = useState("")
  const [channelType, setChannelType] = useState("all")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AdminChannel | null>(null)
  const [result, setResult] = useState<PageResult<AdminChannel>>({
    results: [],
    page: { page: 1, limit: 20, total: 0 },
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchChannels({
        name: name.trim() || undefined,
        channelId: channelId.trim() || undefined,
        channelType: channelType === "all" ? undefined : channelType,
        status: status === "all" ? undefined : status,
        page,
        limit,
      })
      setResult(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("channel.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [channelId, channelType, limit, name, page, status, t])

  const statusOptions = [
    { value: "all", label: t("status.all") },
    ...getEnumOptions(StatusLabels).map((option) => ({
      value: String(option.value),
      label: getStatusLabel(option.value as Status, t),
    })),
  ]

  const channelTypeOptions = [
    { value: "all", label: t("channel.allTypes") },
    { value: "web", label: t("channel.typeWeb") },
    { value: "wechat_mp", label: t("channel.typeWechatMp") },
    { value: "wxwork_kf", label: t("channel.typeWxworkKf") },
  ]

  useEffect(() => {
    void loadData()
  }, [loadData])

  function applyFilters() {
    setName(nameInput)
    setChannelId(channelIdInput)
    setChannelType(channelTypeInput)
    setStatus(statusInput)
    setPage(1)
  }

  function handleFilterKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return
    }
    event.preventDefault()
    applyFilters()
  }

  function openCreateDialog() {
    setEditingItem(null)
    setDialogOpen(true)
  }

  function openEditDialog(item: AdminChannel) {
    setEditingItem(item)
    setDialogOpen(true)
  }

  async function handleSubmit(payload: CreateAdminChannelPayload) {
    if (saving) {
      return
    }
    setSaving(true)
    try {
      if (editingItem) {
        await updateChannel({ id: editingItem.id, ...payload })
        toast.success(t("channel.updated", { name: payload.name }))
      } else {
        const created = await createChannel(payload)
        toast.success(t("channel.created", { name: created.name }))
      }
      setDialogOpen(false)
      setEditingItem(null)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("channel.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleStatus(item: AdminChannel) {
    setActionLoadingId(item.id)
    try {
      const nextStatus = item.status === Status.Ok ? Status.Disabled : Status.Ok
      await updateChannelStatus(item.id, nextStatus)
      toast.success(t(nextStatus === Status.Ok ? "channel.statusEnabled" : "channel.statusDisabled", { name: item.name }))
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("channel.statusUpdateFailed"))
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleDelete(item: AdminChannel) {
    setActionLoadingId(item.id)
    try {
      await deleteChannel(item.id)
      toast.success(t("channel.deleted", { name: item.name }))
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("channel.deleteFailed"))
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
                <RefreshCwIcon className={loading ? "animate-spin" : ""} />
                {t("channel.refresh")}
              </Button>
              <Button onClick={openCreateDialog}>
                <PlusIcon />
                {t("channel.new")}
              </Button>
            </>
          }
        >
          <Input
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            onKeyDown={handleFilterKeyDown}
            placeholder={t("channel.filterName")}
            className="w-full sm:w-56"
          />
          <div className="relative w-full sm:w-72">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={channelIdInput}
              onChange={(event) => setChannelIdInput(event.target.value)}
              onKeyDown={handleFilterKeyDown}
              placeholder={t("channel.filterChannelId")}
              className="pl-9"
            />
          </div>
          <div className="w-full sm:w-40">
            <OptionCombobox
              value={channelTypeInput}
              options={[...channelTypeOptions]}
              placeholder={t("channel.allTypes")}
              searchPlaceholder={t("channel.searchType")}
              emptyText={t("channel.emptyType")}
              onChange={setChannelTypeInput}
            />
          </div>
          <div className="w-full sm:w-36">
            <OptionCombobox
              value={statusInput}
              options={[...statusOptions]}
              placeholder={t("status.all")}
              searchPlaceholder={t("channel.searchStatus")}
              emptyText={t("channel.emptyStatus")}
              onChange={setStatusInput}
            />
          </div>
          <Button variant="outline" onClick={applyFilters} disabled={loading}>
            <SearchIcon />
            {t("channel.query")}
          </Button>
        </DashboardToolbar>

        <DashboardTableShell
          pagination={
            <ListPagination
              page={result.page.page}
              limit={result.page.limit}
              total={result.page.total}
              loading={loading}
              onPageChange={(nextPage) => setPage(nextPage)}
              onLimitChange={(nextLimit) => {
                setLimit(nextLimit)
                setPage(1)
              }}
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("channel.columnChannel")}</TableHead>
                <TableHead>{t("channel.columnType")}</TableHead>
                <TableHead>ChannelID</TableHead>
                <TableHead>{t("channel.columnAgent")}</TableHead>
                <TableHead>{t("channel.columnStatus")}</TableHead>
                <TableHead className="w-[88px] text-right">{t("channel.columnActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || result.results.length === 0 ? (
                <DashboardTableStateRow
                  colSpan={6}
                  loading={loading}
                  loadingText={t("channel.loading")}
                  emptyText={t("channel.empty")}
                />
              ) : null}
              {result.results.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-2xl bg-muted">
                        <ChannelIcon channelType={item.channelType} />
                      </div>
                      <div>
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">{getChannelTypeLabel(item.channelType, t)}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getChannelTypeLabel(item.channelType, t)}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{item.channelId || "-"}</TableCell>
                  <TableCell>{item.aiAgentName || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={item.status === Status.Ok}
                        disabled={actionLoadingId === item.id}
                        onCheckedChange={() => void handleToggleStatus(item)}
                        aria-label={t("channel.toggleStatus", { name: item.name })}
                      />
                      <Badge variant={item.status === Status.Ok ? "default" : "outline"}>
                        {getStatusLabel(item.status as Status, t)}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <ButtonGroup className="ml-auto">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(item)}>
                        {t("channel.edit")}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={<Button variant="outline" size="icon-sm" className="ml-auto" />}
                          aria-label={t("channel.moreActions", { name: item.name })}
                        >
                          <MoreHorizontalIcon />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive"
                            disabled={actionLoadingId === item.id}
                            onClick={() => void handleDelete(item)}
                          >
                            <Trash2Icon className="size-4" />
                            {t("channel.delete")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </ButtonGroup>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DashboardTableShell>
      </DashboardPage>

      <EditDialog
        open={dialogOpen}
        saving={saving}
        itemId={editingItem?.id ?? null}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
      />
    </>
  )
}
