"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCwIcon, SearchIcon } from "lucide-react"
import { toast } from "sonner"

import {
  DashboardPage,
  DashboardTableShell,
  DashboardToolbar,
} from "@/components/dashboard-page"
import { ListPagination } from "@/components/list-pagination"
import { OptionCombobox } from "@/components/option-combobox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AgentRunLogDetailDialog } from "./_components/detail"
import {
  fetchAgentRunLogs,
  fetchAIAgentsAll,
  type AIAgent,
  type AgentRunLog,
  type PageResult,
} from "@/lib/api/admin"
import { useI18n } from "@/i18n/provider"
import { formatDateTime } from "@/lib/utils"

type TFunction = (key: string, values?: Record<string, string | number>) => string

function getActionOptions(t: TFunction) {
  return [
    { value: "all", label: t("agentRunLog.allActions") },
    { value: "rag", label: "RAG" },
    { value: "skill", label: "Skill" },
    { value: "tool", label: "Tool" },
    { value: "graph", label: "Graph" },
    { value: "handoff", label: t("agentRunLog.handoff") },
    { value: "reply", label: t("agentRunLog.reply") },
    { value: "fallback", label: t("agentRunLog.fallback") },
  ]
}

function getFinalStatusOptions(t: TFunction) {
  return [
    { value: "all", label: t("agentRunLog.allStatus") },
    { value: "completed", label: "completed" },
    { value: "interrupted", label: "interrupted" },
    { value: "expired", label: "expired" },
    { value: "error", label: "error" },
    { value: "fallback", label: "fallback" },
  ]
}

function getHitlStatusOptions(t: TFunction) {
  return [
    { value: "all", label: t("agentRunLog.allHitl") },
    { value: "pending", label: t("agentRunLog.hitlPending") },
    { value: "confirmed", label: t("agentRunLog.hitlConfirmed") },
    { value: "cancelled", label: t("agentRunLog.hitlCancelled") },
    { value: "expired", label: t("agentRunLog.hitlExpired") },
    { value: "triggered", label: t("agentRunLog.hitlTriggered") },
  ]
}

function getHitlStatusLabel(status: string | undefined, t: TFunction) {
  switch (status) {
    case "pending":
      return t("agentRunLog.hitlPending")
    case "confirmed":
      return t("agentRunLog.hitlConfirmed")
    case "cancelled":
      return t("agentRunLog.hitlCancelled")
    case "expired":
      return t("agentRunLog.hitlExpired")
    case "triggered":
      return t("agentRunLog.hitlTriggered")
    default:
      return ""
  }
}

function actionBadgeVariant(action: string) {
  switch (action) {
    case "handoff":
      return "destructive" as const
    case "skill":
      return "default" as const
    case "tool":
      return "default" as const
    case "graph":
      return "default" as const
    case "rag":
      return "secondary" as const
    case "fallback":
      return "outline" as const
    default:
      return "secondary" as const
  }
}

export default function DashboardAgentRunLogsPage() {
  const t = useI18n()
  const [keywordInput, setKeywordInput] = useState("")
  const [plannedActionInput, setPlannedActionInput] = useState("all")
  const [finalActionInput, setFinalActionInput] = useState("all")
  const [finalStatusInput, setFinalStatusInput] = useState("all")
  const [hitlStatusInput, setHitlStatusInput] = useState("all")
  const [aiAgentIdInput, setAiAgentIdInput] = useState("all")
  const [keyword, setKeyword] = useState("")
  const [plannedAction, setPlannedAction] = useState("all")
  const [finalAction, setFinalAction] = useState("all")
  const [finalStatus, setFinalStatus] = useState("all")
  const [hitlStatus, setHitlStatus] = useState("all")
  const [aiAgentId, setAiAgentId] = useState("all")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(true)
  const [detailOpen, setDetailOpen] = useState(false)
  const [activeLogId, setActiveLogId] = useState<number | null>(null)
  const [result, setResult] = useState<PageResult<AgentRunLog>>({
    results: [],
    page: { page: 1, limit: 20, total: 0 },
  })
  const [aiAgents, setAiAgents] = useState<AIAgent[]>([])
  const actionOptions = useMemo(() => getActionOptions(t), [t])
  const finalStatusOptions = useMemo(() => getFinalStatusOptions(t), [t])
  const hitlStatusOptions = useMemo(() => getHitlStatusOptions(t), [t])

  const aiAgentOptions = useMemo(
    () => [
      { value: "all", label: t("agentRunLog.allAgents") },
      ...aiAgents.map((item) => ({
        value: String(item.id),
        label: item.name,
      })),
    ],
    [aiAgents, t]
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchAgentRunLogs({
        userMessage: keyword.trim() || undefined,
        plannedAction: plannedAction === "all" ? undefined : plannedAction,
        finalAction: finalAction === "all" ? undefined : finalAction,
        finalStatus: finalStatus === "all" ? undefined : finalStatus,
        hitlStatus: hitlStatus === "all" ? undefined : hitlStatus,
        aiAgentId: aiAgentId === "all" ? undefined : aiAgentId,
        page,
        limit,
      })
      setResult(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("agentRunLog.loadFailed"))
    } finally {
      setLoading(false)
    }
  }, [aiAgentId, finalAction, finalStatus, hitlStatus, keyword, limit, page, plannedAction, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    async function loadAIAgents() {
      try {
        const data = await fetchAIAgentsAll()
        setAiAgents(data)
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("agentRunLog.loadAgentsFailed"))
      }
    }
    void loadAIAgents()
  }, [t])

  function applyFilters() {
    setKeyword(keywordInput)
    setPlannedAction(plannedActionInput)
    setFinalAction(finalActionInput)
    setFinalStatus(finalStatusInput)
    setHitlStatus(hitlStatusInput)
    setAiAgentId(aiAgentIdInput)
    setPage(1)
  }

  function handleFilterKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return
    }
    event.preventDefault()
    applyFilters()
  }

  return (
    <>
      <DashboardPage>
        <DashboardToolbar
          actions={
            <Button
              variant="outline"
              onClick={() => void loadData()}
              disabled={loading}
              className="w-full xl:w-auto"
            >
              <RefreshCwIcon className={loading ? "animate-spin" : ""} />
              {t("agentRunLog.refresh")}
            </Button>
          }
        >
          <div className="relative min-w-0">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              onKeyDown={handleFilterKeyDown}
              placeholder={t("agentRunLog.filterUserMessage")}
              className="pl-9"
            />
          </div>
          <div className="min-w-0">
            <OptionCombobox
              value={plannedActionInput}
              options={actionOptions}
              placeholder={t("agentRunLog.plannedAction")}
              searchPlaceholder={t("agentRunLog.searchAction")}
              emptyText={t("agentRunLog.emptyAction")}
              onChange={(value) => setPlannedActionInput(value || "all")}
            />
          </div>
          <div className="min-w-0">
            <OptionCombobox
              value={finalActionInput}
              options={actionOptions}
              placeholder={t("agentRunLog.finalAction")}
              searchPlaceholder={t("agentRunLog.searchAction")}
              emptyText={t("agentRunLog.emptyAction")}
              onChange={(value) => setFinalActionInput(value || "all")}
            />
          </div>
          <div className="min-w-0">
            <OptionCombobox
              value={finalStatusInput}
              options={finalStatusOptions}
              placeholder={t("agentRunLog.finalStatus")}
              searchPlaceholder={t("agentRunLog.searchStatus")}
              emptyText={t("agentRunLog.emptyStatus")}
              onChange={(value) => setFinalStatusInput(value || "all")}
            />
          </div>
          <div className="min-w-0">
            <OptionCombobox
              value={hitlStatusInput}
              options={hitlStatusOptions}
              placeholder={t("agentRunLog.hitlStatus")}
              searchPlaceholder={t("agentRunLog.searchHitl")}
              emptyText={t("agentRunLog.emptyStatus")}
              onChange={(value) => setHitlStatusInput(value || "all")}
            />
          </div>
          <div className="min-w-0">
            <OptionCombobox
              value={aiAgentIdInput}
              options={aiAgentOptions}
              placeholder={t("agentRunLog.selectAgent")}
              searchPlaceholder={t("agentRunLog.searchAgent")}
              emptyText={t("agentRunLog.emptyAgent")}
              onChange={(value) => setAiAgentIdInput(value || "all")}
            />
          </div>
          <Button variant="outline" onClick={applyFilters} disabled={loading} className="w-full xl:w-auto">
            <SearchIcon />
            {t("agentRunLog.query")}
          </Button>
        </DashboardToolbar>

        <DashboardTableShell
          pagination={
            <ListPagination
              page={result.page.page}
              total={result.page.total}
              limit={limit}
              loading={loading}
              onPageChange={setPage}
              onLimitChange={(nextLimit) => {
                setLimit(nextLimit)
                setPage(1)
              }}
            />
          }
        >
          {!loading && result.results.length === 0 ? (
            <div className="py-14 text-center text-sm text-muted-foreground">
              {t("agentRunLog.emptyRows")}
            </div>
          ) : (
            <div>
              <div className="hidden grid-cols-[160px_minmax(0,1.8fr)_110px_minmax(0,1.2fr)_130px_90px_76px] gap-3 border-b bg-muted/40 px-4 py-3 text-sm text-muted-foreground lg:grid">
                <div>{t("agentRunLog.time")}</div>
                <div>{t("agentRunLog.userMessage")}</div>
                <div>{t("agentRunLog.plannedAction")}</div>
                <div>{t("agentRunLog.skillTool")}</div>
                <div>{t("agentRunLog.finalStatus")}</div>
                <div className="text-right">{t("agentRunLog.duration")}</div>
                <div className="text-right">{t("agentRunLog.actions")}</div>
              </div>

              <div className="divide-y">
                {result.results.map((item) => (
                  <article
                    key={item.id}
                    className="grid grid-cols-1 gap-2 px-4 py-3 lg:grid-cols-[160px_minmax(0,1.8fr)_110px_minmax(0,1.2fr)_130px_90px_76px] lg:items-center lg:gap-3"
                  >
                    <div className="min-w-0 text-sm text-muted-foreground">
                      {formatDateTime(item.createdAt)}
                    </div>

                    <div className="min-w-0">
                      <UserMessagePreview value={item.userMessage} t={t} />
                      {item.errorMessage ? (
                        <div className="truncate text-xs text-destructive">{item.errorMessage}</div>
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      <Badge variant={actionBadgeVariant(item.plannedAction)}>
                        {item.plannedAction || "-"}
                      </Badge>
                    </div>

                    <div className="min-w-0 text-sm">
                      {item.plannedSkillCode || item.graphToolCode || item.plannedToolCode ? (
                        <div className="min-w-0 space-y-1">
                          <div className="truncate font-medium">
                            {item.plannedSkillCode || item.graphToolCode || item.plannedToolCode}
                          </div>
                          {item.plannedSkillName ? (
                            <div className="truncate text-xs text-muted-foreground">
                              {item.plannedSkillName}
                            </div>
                          ) : item.handoffReason ? (
                            <div className="truncate text-xs text-muted-foreground">
                              {t("agentRunLog.handoffReason", { reason: item.handoffReason })}
                            </div>
                          ) : item.recommendedAction ? (
                            <div className="truncate text-xs text-muted-foreground">
                              {t("agentRunLog.routingRecommendation", { action: item.recommendedAction })}
                              {item.riskLevel ? ` / ${item.riskLevel} risk` : ""}
                              {item.ticketDraftReady ? ` / ${t("agentRunLog.draftReady")}` : ""}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="space-y-1">
                        <Badge variant={actionBadgeVariant(item.finalAction)}>
                          {item.finalAction || "-"}
                        </Badge>
                        <div className="truncate text-xs text-muted-foreground">
                          {getHitlStatusLabel(item.hitlStatus, t)
                            ? `${getHitlStatusLabel(item.hitlStatus, t)} / ${item.finalStatus || "-"}`
                            : item.finalStatus || "-"}
                        </div>
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground lg:text-right">
                      {item.latencyMs} ms
                    </div>

                    <div className="lg:text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setActiveLogId(item.id)
                          setDetailOpen(true)
                        }}
                      >
                        {t("agentRunLog.detail")}
                      </Button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </DashboardTableShell>
      </DashboardPage>
      <AgentRunLogDetailDialog
        open={detailOpen}
        logId={activeLogId}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) {
            setActiveLogId(null)
          }
        }}
      />
    </>
  )
}

function UserMessagePreview({ value, t }: { value?: string; t: TFunction }) {
  const preview = useMemo(() => summarizeUserMessage(value, t), [value, t])

  return (
    <div className="truncate text-sm text-foreground">
      {preview}
    </div>
  )
}

function summarizeUserMessage(value: string | undefined, t: TFunction) {
  const normalized = value?.trim()
  if (!normalized) {
    return "-"
  }
  const text = extractTextFromHTML(normalized).replace(/\s+/g, " ").trim()
  if (text) {
    return text
  }
  if (containsHTML(normalized)) {
    if (/<img[\s>]/i.test(normalized)) {
      return t("agentRunLog.imageMessage")
    }
    return t("agentRunLog.richMessage")
  }
  return normalized
}

function containsHTML(value: string) {
  return /<[^>]+>/.test(value)
}

function extractTextFromHTML(value: string) {
  if (typeof window === "undefined") {
    return value
  }
  const doc = new DOMParser().parseFromString(value, "text/html")
  return doc.body.textContent || ""
}
