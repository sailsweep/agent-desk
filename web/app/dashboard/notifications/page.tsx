"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { BellIcon, CheckCheckIcon, RefreshCwIcon } from "lucide-react"
import { toast } from "sonner"

import {
  DashboardPage,
  DashboardTableShell,
  DashboardToolbar,
} from "@/components/dashboard-page"
import { ListPagination } from "@/components/list-pagination"
import { useNotifications } from "@/components/notification-provider"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
  type NotificationReadStatus,
} from "@/lib/api/notification"
import type { PageResult } from "@/lib/api/admin"
import { cn, formatDateTime } from "@/lib/utils"
import { useI18n } from "@/i18n/provider"

export default function DashboardNotificationsPage() {
  const t = useI18n()
  const router = useRouter()
  const { refreshUnreadCount } = useNotifications()
  const [readStatus, setReadStatus] = useState<NotificationReadStatus>("all")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [result, setResult] = useState<PageResult<NotificationItem>>({
    results: [],
    page: { page: 1, limit: 20, total: 0 },
  })
  const readStatusOptions = useMemo<Array<{ value: NotificationReadStatus; label: string }>>(
    () => [
      { value: "all", label: t("notification.all") },
      { value: "unread", label: t("notification.unread") },
      { value: "read", label: t("notification.read") },
    ],
    [t]
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchNotifications({
        page,
        limit,
        readStatus,
      })
      setResult(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("notification.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [limit, page, readStatus, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  async function openNotification(item: NotificationItem) {
    try {
      if (!item.readAt) {
        await markNotificationRead(item.id)
        await refreshUnreadCount()
      }
      if (item.actionUrl) {
        router.push(item.actionUrl)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("notification.openFailed"))
    }
  }

  async function handleMarkAllRead() {
    setActionLoading(true)
    try {
      await markAllNotificationsRead()
      await refreshUnreadCount()
      await loadData()
      toast.success(t("notification.markAllReadSuccess"))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("notification.markAllReadFailed"))
    } finally {
      setActionLoading(false)
    }
  }

  function handleStatusChange(nextStatus: NotificationReadStatus) {
    setReadStatus(nextStatus)
    setPage(1)
  }

  function handlePageChange(nextPage: number) {
    if (nextPage < 1 || nextPage === page) {
      return
    }
    setPage(nextPage)
  }

  function handleLimitChange(nextLimit: number) {
    setLimit(nextLimit)
    setPage(1)
  }

  return (
    <DashboardPage>
      <DashboardToolbar
        actions={
          <>
          <Button variant="outline" onClick={() => void loadData()} disabled={loading}>
            <RefreshCwIcon className={cn(loading && "animate-spin")} />
            {t("notification.refresh")}
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleMarkAllRead()}
            disabled={actionLoading || result.page.total === 0}
          >
            <CheckCheckIcon />
            {t("notification.markAllRead")}
          </Button>
          </>
        }
      >
        {readStatusOptions.map((option) => (
          <Button
            key={option.value}
            variant={option.value === readStatus ? "default" : "outline"}
            onClick={() => handleStatusChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </DashboardToolbar>

      <DashboardTableShell
        pagination={
          <ListPagination
            page={result.page.page}
            limit={result.page.limit}
            total={result.page.total}
            loading={loading}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
          />
        }
      >
        {result.results.length > 0 ? (
          <div className="divide-y">
            {result.results.map((item) => {
              const unread = !item.readAt
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void openNotification(item)}
                  className="grid w-full gap-2 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <BellIcon className="size-4 text-muted-foreground" />
                    <span className="font-medium">{item.title || t("notification.fallbackTitle")}</span>
                    {unread ? <Badge>{t("notification.unread")}</Badge> : <Badge variant="outline">{t("notification.read")}</Badge>}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </span>
                  </div>
                  <div className="whitespace-pre-line text-sm text-muted-foreground">
                    {item.content || "-"}
                  </div>
                </button>
              )
            })}
          </div>
        ) : (
          <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
            {loading ? t("notification.loading") : t("notification.empty")}
          </div>
        )}
      </DashboardTableShell>
    </DashboardPage>
  )
}
