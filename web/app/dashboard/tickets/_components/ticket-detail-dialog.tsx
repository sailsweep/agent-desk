"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { MessageSquareTextIcon, PencilIcon, PlusIcon, RefreshCcwIcon, SendIcon, UserRoundIcon } from "lucide-react"
import { toast } from "sonner"

import { type CustomerFormSavePayload } from "@/components/customer-form"
import { CustomerFormDialog } from "@/components/customer-form-dialog"
import { CustomerLinkOrCreateDialog } from "@/components/customer-link-or-create-dialog"
import { ContentEditor } from "@/components/content-editor"
import { ProjectDialog } from "@/components/project-dialog"
import { isRichTextEmpty, SafeRichHTML } from "@/components/safe-rich-html"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"
import { saveCustomerProfile } from "@/lib/api/customer"
import {
  changeTicketStatus,
  createTicketProgress,
  fetchTicketDetail,
  type CreateTicketPayload,
  type TicketDetail,
  type TicketStatus,
  type UpdateTicketPayload,
  updateTicket,
} from "@/lib/api/ticket"
import { cn, formatDateTime } from "@/lib/utils"
import { EditDialog } from "./edit"
import { TicketAssignDialog } from "./ticket-assign-dialog"
import { TicketStatusBadge } from "./ticket-status-badge"

type TicketDetailDialogProps = {
  ticketId: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onChanged: () => void
}

const statusOptions: Array<{ value: TicketStatus; label: string }> = [
  { value: "pending", label: "待处理" },
  { value: "in_progress", label: "处理中" },
  { value: "done", label: "已处理" },
]

function sourceLabel(source: string) {
  switch (source) {
    case "manual":
      return "手动创建"
    case "conversation":
      return "会话生成"
    default:
      return source || "-"
  }
}

function metadataValue(value?: string | number | null) {
  if (value === undefined || value === null || value === "") {
    return "-"
  }
  return String(value)
}

function getTicketCustomerId(ticket?: TicketDetail["ticket"] | null) {
  return Number(ticket?.customer?.id || ticket?.customerId || 0)
}

export function TicketDetailDialog({
  ticketId,
  open,
  onOpenChange,
  onChanged,
}: TicketDetailDialogProps) {
  const [detail, setDetail] = useState<TicketDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusSaving, setStatusSaving] = useState<TicketStatus | null>(null)
  const [progressSaving, setProgressSaving] = useState(false)
  const [progressOpen, setProgressOpen] = useState(false)
  const [progressContent, setProgressContent] = useState("")
  const [assignOpen, setAssignOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editSaving, setEditSaving] = useState(false)
  const [customerEditOpen, setCustomerEditOpen] = useState(false)
  const [customerEditSaving, setCustomerEditSaving] = useState(false)
  const [customerLinkOpen, setCustomerLinkOpen] = useState(false)
  const loadSeqRef = useRef(0)
  const dialogSeqRef = useRef(0)
  const currentTicketIdRef = useRef<number | null>(null)
  currentTicketIdRef.current = open ? ticketId : null

  function isCurrentOperation(targetTicketId: number, dialogSeq: number) {
    return currentTicketIdRef.current === targetTicketId && dialogSeqRef.current === dialogSeq
  }

  const loadDetail = useCallback(async (targetTicketId = ticketId, dialogSeq = dialogSeqRef.current) => {
    if (!targetTicketId || !isCurrentOperation(targetTicketId, dialogSeq)) {
      return
    }
    const seq = loadSeqRef.current + 1
    loadSeqRef.current = seq
    if (!open || !targetTicketId) {
      setDetail(null)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await fetchTicketDetail(targetTicketId)
      if (loadSeqRef.current !== seq || !isCurrentOperation(targetTicketId, dialogSeq)) {
        return
      }
      setDetail(data)
    } catch (error) {
      if (loadSeqRef.current !== seq || !isCurrentOperation(targetTicketId, dialogSeq)) {
        return
      }
      toast.error(error instanceof Error ? error.message : "加载工单详情失败")
    } finally {
      if (loadSeqRef.current === seq) {
        setLoading(false)
      }
    }
  }, [open, ticketId])

  useEffect(() => {
    dialogSeqRef.current += 1
    setDetail(null)
    setLoading(false)
    setStatusSaving(null)
    setProgressSaving(false)
    setProgressOpen(false)
    setEditSaving(false)
    setCustomerEditSaving(false)
    setAssignOpen(false)
    setEditOpen(false)
    setCustomerEditOpen(false)
    setCustomerLinkOpen(false)
    setProgressContent("")
  }, [open, ticketId])

  useEffect(() => {
    void loadDetail(ticketId, dialogSeqRef.current)
  }, [loadDetail, ticketId])

  async function handleStatusChange(status: TicketStatus) {
    if (!detail || detail.ticket.status === status) {
      return
    }
    const activeTicketId = detail.ticket.id
    const activeDialogSeq = dialogSeqRef.current
    setStatusSaving(status)
    try {
      await changeTicketStatus({ ticketId: activeTicketId, status })
      if (!isCurrentOperation(activeTicketId, activeDialogSeq)) {
        return
      }
      toast.success("工单状态已更新")
      await loadDetail(activeTicketId, activeDialogSeq)
      if (!isCurrentOperation(activeTicketId, activeDialogSeq)) {
        return
      }
      onChanged()
    } catch (error) {
      if (!isCurrentOperation(activeTicketId, activeDialogSeq)) {
        return
      }
      toast.error(error instanceof Error ? error.message : "更新工单状态失败")
    } finally {
      if (isCurrentOperation(activeTicketId, activeDialogSeq)) {
        setStatusSaving(null)
      }
    }
  }

  async function handleCreateProgress() {
    if (!detail) {
      return
    }
    const activeTicketId = detail.ticket.id
    const activeDialogSeq = dialogSeqRef.current
    const content = progressContent.trim()
    if (isRichTextEmpty(content)) {
      toast.error("请填写处理进展")
      return
    }
    setProgressSaving(true)
    try {
      await createTicketProgress({
        ticketId: activeTicketId,
        content,
      })
      if (!isCurrentOperation(activeTicketId, activeDialogSeq)) {
        return
      }
      toast.success("处理进展已记录")
      setProgressContent("")
      setProgressOpen(false)
      await loadDetail(activeTicketId, activeDialogSeq)
      if (!isCurrentOperation(activeTicketId, activeDialogSeq)) {
        return
      }
      onChanged()
    } catch (error) {
      if (!isCurrentOperation(activeTicketId, activeDialogSeq)) {
        return
      }
      toast.error(error instanceof Error ? error.message : "记录处理进展失败")
    } finally {
      if (isCurrentOperation(activeTicketId, activeDialogSeq)) {
        setProgressSaving(false)
      }
    }
  }

  async function handleAssigned() {
    const activeTicketId = ticket?.id
    const activeDialogSeq = dialogSeqRef.current
    if (!activeTicketId || !isCurrentOperation(activeTicketId, activeDialogSeq)) {
      return
    }
    await loadDetail(activeTicketId, activeDialogSeq)
    if (!isCurrentOperation(activeTicketId, activeDialogSeq)) {
      return
    }
    onChanged()
  }

  async function handleUpdateTicket(payload: CreateTicketPayload | UpdateTicketPayload) {
    if (!("ticketId" in payload) || payload.ticketId <= 0) {
      toast.error("请选择工单")
      return
    }
    const activeDialogSeq = dialogSeqRef.current
    setEditSaving(true)
    try {
      await updateTicket(payload)
      if (!isCurrentOperation(payload.ticketId, activeDialogSeq)) {
        return
      }
      toast.success("工单已更新")
      setEditOpen(false)
      await loadDetail(payload.ticketId, activeDialogSeq)
      if (!isCurrentOperation(payload.ticketId, activeDialogSeq)) {
        return
      }
      onChanged()
    } catch (error) {
      if (!isCurrentOperation(payload.ticketId, activeDialogSeq)) {
        return
      }
      toast.error(error instanceof Error ? error.message : "更新工单失败")
    } finally {
      if (isCurrentOperation(payload.ticketId, activeDialogSeq)) {
        setEditSaving(false)
      }
    }
  }

  async function handleUpdateCustomer(payload: CustomerFormSavePayload) {
    const activeCustomerId = getTicketCustomerId(ticket)
    if (!ticket?.id || activeCustomerId <= 0) {
      toast.error("当前工单未关联客户")
      return
    }
    if (customerEditSaving) {
      return
    }
    const activeTicketId = ticket.id
    const activeDialogSeq = dialogSeqRef.current
    setCustomerEditSaving(true)
    try {
      await saveCustomerProfile({ ...payload, id: activeCustomerId })
      if (!isCurrentOperation(activeTicketId, activeDialogSeq)) {
        return
      }
      toast.success("已保存")
      setCustomerEditOpen(false)
      await loadDetail(activeTicketId, activeDialogSeq)
      if (!isCurrentOperation(activeTicketId, activeDialogSeq)) {
        return
      }
      onChanged()
    } catch (error) {
      if (!isCurrentOperation(activeTicketId, activeDialogSeq)) {
        return
      }
      toast.error(error instanceof Error ? error.message : "保存失败")
    } finally {
      if (isCurrentOperation(activeTicketId, activeDialogSeq)) {
        setCustomerEditSaving(false)
      }
    }
  }

  async function handleCustomerLinked() {
    const activeTicketId = ticket?.id
    const activeDialogSeq = dialogSeqRef.current
    if (!activeTicketId || !isCurrentOperation(activeTicketId, activeDialogSeq)) {
      return
    }
    await loadDetail(activeTicketId, activeDialogSeq)
    if (!isCurrentOperation(activeTicketId, activeDialogSeq)) {
      return
    }
    onChanged()
  }

  const ticket = detail?.ticket
  const customerId = getTicketCustomerId(ticket)

  return (
    <>
      <ProjectDialog
        open={open}
        onOpenChange={onOpenChange}
        title={
          <div className="flex min-w-0 items-center gap-2 pr-16 text-base">
            <span className="truncate">{ticket?.title ?? "工单详情"}</span>
            {ticket ? <TicketStatusBadge status={ticket.status} /> : null}
          </div>
        }
        description={
          ticket ? (
            <span className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-mono">{ticket.ticketNo}</span>
              <span>{sourceLabel(ticket.source)}</span>
              <span>创建人：{metadataValue(ticket.createdByName || ticket.createdBy)}</span>
            </span>
          ) : undefined
        }
        size="xxl"
        allowFullscreen
        bodyScrollable={false}
        bodyClassName="overflow-hidden"
      >
        {loading && !ticket ? (
          <div className="flex h-130 items-center justify-center gap-2 text-sm text-muted-foreground">
            <RefreshCcwIcon className="size-4 animate-spin" />
            加载中...
          </div>
        ) : ticket ? (
          <div className="grid h-[min(72vh,680px)] min-h-0 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_380px] border-t">
            <div className="min-h-0 space-y-5 overflow-y-auto border-b p-6 lg:border-r lg:border-b-0">
              <section className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">描述</div>
                <div className="rounded-md border bg-muted/30 px-3 py-2">
                  <SafeRichHTML html={ticket.description} fallback="暂无描述" />
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">状态</div>
                  <div className="flex flex-wrap gap-2">
                    {statusOptions.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        size="sm"
                        variant={ticket.status === option.value ? "default" : "outline"}
                        disabled={!!statusSaving}
                        onClick={() => void handleStatusChange(option.value)}
                      >
                        {statusSaving === option.value ? "更新中..." : option.label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">负责人</div>
                  <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2">
                    <div className="flex min-w-0 items-center gap-2 text-sm">
                      <UserRoundIcon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{ticket.currentAssigneeName || "未分配"}</span>
                    </div>
                    <Button type="button" size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                      指派
                    </Button>
                  </div>
                </div>
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-muted-foreground">标签</div>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                    编辑
                  </Button>
                </div>
                {ticket.tags && ticket.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {ticket.tags.map((tag) => (
                      <Badge key={tag.id} variant="outline">
                        {tag.name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">暂无标签</div>
                )}
              </section>

              <section className="space-y-3 rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-muted-foreground">客户信息</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 gap-1 px-2 text-xs"
                    onClick={() => {
                      if (customerId > 0) {
                        setCustomerEditOpen(true)
                        return
                      }
                      setCustomerLinkOpen(true)
                    }}
                  >
                    <PencilIcon className="size-3.5" />
                    {customerId > 0 ? "编辑" : "关联或创建"}
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetadataItem label="客户" value={ticket.customer?.name || ticket.customerId} />
                  <MetadataItem label="联系方式" value={ticket.customer?.primaryMobile || ticket.customer?.primaryEmail} />
                </div>
              </section>

              <section className="space-y-3 rounded-md border p-3 text-sm">
                <div className="font-medium text-muted-foreground">工单信息</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <MetadataItem label="来源" value={sourceLabel(ticket.source)} />
                  <MetadataItem label="渠道" value={ticket.channel} />
                  <MetadataItem label="会话 ID" value={ticket.conversationId || undefined} />
                  <MetadataItem label="最后更新" value={ticket.updatedAt ? formatDateTime(ticket.updatedAt) : undefined} />
                </div>
              </section>
            </div>

            <aside className="flex min-h-0 flex-col">
              <div className="flex items-center justify-between gap-2 px-4 py-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquareTextIcon className="size-4 text-muted-foreground" />
                  处理进展
                </div>
                <Button type="button" size="sm" onClick={() => setProgressOpen(true)}>
                  <PlusIcon className="size-3.5" />
                  添加进展
                </Button>
              </div>
              <Separator />
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {detail.progresses && detail.progresses.length > 0 ? (
                  <div className="space-y-3">
                    {detail.progresses.map((progress, index) => (
                      <div key={progress.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span className="mt-1 size-2 rounded-full bg-primary" />
                          <span
                            className={cn(
                              "mt-1 w-px flex-1 bg-border",
                              index === detail.progresses!.length - 1 ? "opacity-0" : "opacity-100",
                            )}
                          />
                        </div>
                        <div className="min-w-0 flex-1 pb-3">
                          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <span>{progress.authorName || `用户#${progress.authorId}`}</span>
                            <span>{progress.createdAt ? formatDateTime(progress.createdAt) : "-"}</span>
                          </div>
                          <SafeRichHTML html={progress.content} className="mt-1" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">
                    暂无处理进展
                  </div>
                )}
              </div>
            </aside>
          </div>
        ) : (
          <div className="flex h-[360px] items-center justify-center text-sm text-muted-foreground">请选择工单</div>
        )}
      </ProjectDialog>

      <TicketAssignDialog
        open={assignOpen}
        ticketId={ticket?.id ?? null}
        currentAssigneeId={ticket?.currentAssigneeId}
        onOpenChange={setAssignOpen}
        onSuccess={handleAssigned}
      />
      <EditDialog
        open={editOpen}
        saving={editSaving}
        itemId={ticket?.id ?? null}
        onOpenChange={setEditOpen}
        onSubmit={handleUpdateTicket}
      />
      <CustomerFormDialog
        open={customerEditOpen}
        onOpenChange={setCustomerEditOpen}
        saving={customerEditSaving}
        itemId={customerId > 0 ? customerId : null}
        onSave={handleUpdateCustomer}
      />
      <CustomerLinkOrCreateDialog
        open={customerLinkOpen}
        onOpenChange={setCustomerLinkOpen}
        ticketId={ticket?.id ?? null}
        onSuccess={handleCustomerLinked}
      />
      <Dialog
        open={progressOpen}
        onOpenChange={(nextOpen) => {
          if (progressSaving) {
            return
          }
          setProgressOpen(nextOpen)
          if (!nextOpen) {
            setProgressContent("")
          }
        }}
      >
        <DialogContent className="max-w-2xl gap-0 p-0 sm:max-w-3xl">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>添加处理进展</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <ContentEditor
              value={{ mode: "html", raw: progressContent }}
              onChange={(next) => setProgressContent(next.raw)}
              placeholder="记录本次处理进展"
              disabled={progressSaving}
              allowedModes={["html"]}
              height={260}
            />
          </div>
          <DialogFooter className="mx-0 mb-0 px-6 py-4">
            <Button
              type="button"
              variant="outline"
              disabled={progressSaving}
              onClick={() => {
                setProgressOpen(false)
                setProgressContent("")
              }}
            >
              取消
            </Button>
            <Button type="button" disabled={progressSaving} onClick={() => void handleCreateProgress()}>
              <SendIcon className="size-3.5" />
              {progressSaving ? "提交中..." : "提交"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function MetadataItem({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="min-w-0">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-1 truncate">{metadataValue(value)}</div>
    </div>
  )
}
