"use client"

import {
  BanIcon,
  CheckCircle2Icon,
  MoreHorizontalIcon,
  PlusIcon,
  RefreshCwIcon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
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
import { type PageResult } from "@/lib/api/admin"
import {
  createCompany,
  deleteCompany,
  fetchCompanies,
  updateCompany,
  updateCompanyStatus,
  type AdminCompany,
  type CreateAdminCompanyPayload,
} from "@/lib/api/company"
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

export default function DashboardCompaniesPage() {
  const t = useI18n()
  const [nameInput, setNameInput] = useState("")
  const [codeInput, setCodeInput] = useState("")
  const [statusFilterInput, setStatusFilterInput] = useState("all")
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AdminCompany | null>(null)
  const [result, setResult] = useState<PageResult<AdminCompany>>({
    results: [],
    page: { page: 1, limit: 20, total: 0 },
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchCompanies({
        name: name.trim() || undefined,
        code: code.trim() || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        page,
        limit,
      })
      setResult(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("company.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [code, limit, name, page, statusFilter, t])

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
    setName(nameInput)
    setCode(codeInput)
    setStatusFilter(statusFilterInput)
    setPage(1)
  }

  function handleFilterKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return
    event.preventDefault()
    applyFilters()
  }

  function handlePageChange(nextPage: number) {
    if (nextPage < 1 || nextPage === page) return
    setPage(nextPage)
  }

  function openCreateDialog() {
    setEditingItem(null)
    setDialogOpen(true)
  }

  function openEditDialog(item: AdminCompany) {
    setEditingItem(item)
    setDialogOpen(true)
  }

  function handleDialogOpenChange(open: boolean) {
    if (saving) return
    if (!open) setEditingItem(null)
    setDialogOpen(open)
  }

  async function handleSubmit(payload: CreateAdminCompanyPayload) {
    if (saving) return
    setSaving(true)
    try {
      if (editingItem) {
        await updateCompany({ id: editingItem.id, ...payload })
        toast.success(t("company.updated", { name: editingItem.name }))
      } else {
        await createCompany(payload)
        toast.success(t("company.created", { name: payload.name }))
      }
      setDialogOpen(false)
      setEditingItem(null)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("company.saveFailed"))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleStatus(item: AdminCompany) {
    setActionLoadingId(item.id)
    try {
      const nextStatus = item.status === 0 ? 1 : 0
      await updateCompanyStatus(item.id, nextStatus)
      toast.success(t(nextStatus === 0 ? "company.enabled" : "company.disabled", { name: item.name }))
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("company.statusUpdateFailed"))
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleDelete(item: AdminCompany) {
    setActionLoadingId(item.id)
    try {
      await deleteCompany(item.id)
      toast.success(t("company.deleted", { name: item.name }))
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("company.deleteFailed"))
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
                {t("company.refresh")}
              </Button>
              <Button onClick={openCreateDialog}>
                <PlusIcon />
                {t("company.new")}
              </Button>
            </>
          }
        >
          <div className="relative w-full sm:w-72">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              onKeyDown={handleFilterKeyDown}
              placeholder={t("company.filterName")}
              className="pl-9"
            />
          </div>
          <Input
            value={codeInput}
            onChange={(event) => setCodeInput(event.target.value)}
            onKeyDown={handleFilterKeyDown}
            placeholder={t("company.filterCode")}
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
            {t("company.query")}
          </Button>
        </DashboardToolbar>

        <DashboardTableShell
          pagination={
            <ListPagination
              page={result.page.page}
              total={result.page.total}
              limit={result.page.limit}
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
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">ID</TableHead>
                <TableHead>{t("company.columnName")}</TableHead>
                <TableHead>{t("company.columnCode")}</TableHead>
                <TableHead className="w-28">{t("company.columnCustomerCount")}</TableHead>
                <TableHead className="w-24">{t("company.columnStatus")}</TableHead>
                <TableHead>{t("company.columnRemark")}</TableHead>
                <TableHead className="w-40">{t("company.columnActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading || result.results.length === 0 ? (
                <DashboardTableStateRow
                  colSpan={7}
                  loading={loading}
                  loadingText={t("company.loading")}
                  emptyText={t("company.empty")}
                />
              ) : (
                result.results.map((item) => {
                  const actionLoading = actionLoadingId === item.id
                  return (
                    <TableRow key={item.id}>
                      <TableCell>{item.id}</TableCell>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-muted-foreground">{item.code || "-"}</TableCell>
                      <TableCell>{item.customerCount}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.status === Status.Ok
                              ? "default"
                              : item.status === Status.Deleted
                                ? "outline"
                                : "secondary"
                          }
                        >
                          {StatusLabels[item.status as Status] ? getStatusLabel(item.status as Status, t) : t("company.unknownStatus")}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[320px]">
                        <div className="line-clamp-2 text-muted-foreground">{item.remark || "-"}</div>
                      </TableCell>
                      <TableCell>
                        <ButtonGroup className="w-full justify-end">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(item)}>
                            {t("company.edit")}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button variant="outline" size="sm" disabled={actionLoading} />
                              }
                              aria-label={t("company.moreActions", { name: item.name })}
                            >
                              <MoreHorizontalIcon />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40 min-w-40">
                              <DropdownMenuItem
                                disabled={item.status === Status.Deleted}
                                onClick={() => void handleToggleStatus(item)}
                              >
                                {actionLoading ? (
                                  t("company.processing")
                                ) : item.status === Status.Ok ? (
                                  <>
                                    <BanIcon />
                                    {t("company.disable")}
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2Icon />
                                    {t("company.enable")}
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                disabled={item.status === Status.Deleted}
                                onClick={() => void handleDelete(item)}
                              >
                                <Trash2Icon />
                                {t("company.delete")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </ButtonGroup>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
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
