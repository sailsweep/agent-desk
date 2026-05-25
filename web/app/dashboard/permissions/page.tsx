"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { KeyRoundIcon, RefreshCwIcon, RouteIcon, SearchIcon } from "lucide-react"
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
  fetchPermissions,
  type AdminPermission,
  type PageResult,
} from "@/lib/api/admin"
import { Status } from "@/lib/generated/enums"
import { useAppLocale, useI18n } from "@/i18n/provider"
import { getPermissionDisplayName, getPermissionGroupName } from "@/lib/permission-i18n"

export default function DashboardPermissionsPage() {
  const t = useI18n()
  const { locale } = useAppLocale()
  const [keywordInput, setKeywordInput] = useState("")
  const [groupNameInput, setGroupNameInput] = useState("")
  const [statusFilterInput, setStatusFilterInput] = useState("all")
  const [keyword, setKeyword] = useState("")
  const [groupName, setGroupName] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<PageResult<AdminPermission>>({
    results: [],
    page: { page: 1, limit: 20, total: 0 },
  })
  const listStatusOptions = useMemo(
    () => [
      { value: "all", label: t("status.all") },
      { value: String(Status.Ok), label: t("status.ok") },
      { value: String(Status.Disabled), label: t("status.disabled") },
      { value: String(Status.Deleted), label: t("status.deleted") },
    ],
    [t]
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchPermissions({
        keyword: keyword.trim() || undefined,
        groupName: groupName.trim() || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        page,
        limit,
      })
      setResult(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("permission.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [groupName, keyword, limit, page, statusFilter, t])

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

  return (
    <DashboardPage>
      <DashboardToolbar
        actions={
          <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
            <RefreshCwIcon className={loading ? "animate-spin" : ""} />
            {t("permission.refresh")}
          </Button>
        }
      >
        <div className="relative w-full sm:w-72">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            onKeyDown={handleFilterKeyDown}
            placeholder={t("permission.filterKeyword")}
            className="pl-9"
          />
        </div>
        <Input
          value={groupNameInput}
          onChange={(event) => setGroupNameInput(event.target.value)}
          onKeyDown={handleFilterKeyDown}
          placeholder={t("permission.filterGroup")}
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
          {t("permission.query")}
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
                <TableHead>{t("permission.columnPermission")}</TableHead>
                <TableHead>{t("permission.columnCode")}</TableHead>
                <TableHead>{t("permission.columnGroup")}</TableHead>
                <TableHead>{t("permission.columnApi")}</TableHead>
                <TableHead>{t("permission.columnStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.results.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                        <KeyRoundIcon className="size-4" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {getPermissionDisplayName(item.code, item.name, locale)}
                        </div>
                        <div className="text-xs text-muted-foreground">{item.type}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.code}</Badge>
                  </TableCell>
                  <TableCell>{getPermissionGroupName(item.groupName, locale)}</TableCell>
                  <TableCell>
                    <div className="flex items-start gap-2">
                      <Badge variant="secondary">{item.method || "ANY"}</Badge>
                      <div className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <RouteIcon className="size-3.5" />
                          {item.apiPath || "-"}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={item.status === Status.Ok ? "secondary" : "outline"}
                    >
                      {getStatusLabel(item.status, t)}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {loading || result.results.length === 0 ? (
                <DashboardTableStateRow
                  colSpan={5}
                  loading={loading}
                  loadingText={t("permission.loading")}
                  emptyText={t("permission.empty")}
                />
              ) : null}
            </TableBody>
          </Table>
      </DashboardTableShell>
    </DashboardPage>
  )
}

function getStatusLabel(
  status: number,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  if (status === Status.Ok) {
    return t("status.ok")
  }
  if (status === Status.Disabled) {
    return t("status.disabled")
  }
  if (status === Status.Deleted) {
    return t("status.deleted")
  }
  return String(status)
}
