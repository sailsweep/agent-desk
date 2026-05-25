"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCwIcon, SearchIcon } from "lucide-react"
import { toast } from "sonner"

import {
  fetchKnowledgeRetrieveLogs,
  type KnowledgeRetrieveLog,
  type PageResult,
} from "@/lib/api/admin"
import {
  KnowledgeAnswerStatus,
  KnowledgeRetrieveChannel,
  KnowledgeRetrieveScene,
} from "@/lib/generated/enums"
import {
  getKnowledgeAnswerStatusLabel,
  getKnowledgeChunkProviderLabel,
  getKnowledgeRetrieveChannelLabel,
  getKnowledgeRetrieveSceneLabel,
} from "@/lib/knowledge-i18n"
import { formatDateTime } from "@/lib/utils"
import { useI18n } from "@/i18n/provider"
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
import { RetrieveLogDetailDrawer } from "./retrieve-log-detail"

type RetrieveLogListProps = {
  knowledgeBaseId: number | null
}

type TFunction = (key: string, values?: Record<string, string | number>) => string

function getChannelOptions(t: TFunction) {
  return [
    { value: "all", label: t("knowledge.allChannels") },
    { value: KnowledgeRetrieveChannel.IM, label: t("knowledge.channelIM") },
    { value: KnowledgeRetrieveChannel.AgentAssist, label: t("knowledge.channelAgentAssist") },
    { value: KnowledgeRetrieveChannel.API, label: t("knowledge.channelAPI") },
    { value: KnowledgeRetrieveChannel.Debug, label: t("knowledge.channelDebug") },
  ]
}

function getSceneOptions(t: TFunction) {
  return [
    { value: "all", label: t("knowledge.allScenes") },
    { value: KnowledgeRetrieveScene.FirstResponse, label: t("knowledge.sceneFirstResponse") },
    { value: KnowledgeRetrieveScene.Assist, label: t("knowledge.sceneAssist") },
    { value: KnowledgeRetrieveScene.QA, label: t("knowledge.sceneQA") },
  ]
}

function getAnswerStatusOptions(t: TFunction) {
  return [
    { value: "all", label: t("knowledge.allAnswerStatus") },
    { value: String(KnowledgeAnswerStatus.Normal), label: t("knowledge.answerNormal") },
    { value: String(KnowledgeAnswerStatus.NoAnswer), label: t("knowledge.answerNoAnswer") },
    { value: String(KnowledgeAnswerStatus.Fallback), label: t("knowledge.answerFallback") },
    { value: String(KnowledgeAnswerStatus.Blocked), label: t("knowledge.answerBlocked") },
  ]
}

function getProviderOptions(t: TFunction) {
  return [
    { value: "all", label: t("knowledge.allChunkProviders") },
    { value: "fixed", label: t("knowledge.chunkFixed") },
    { value: "structured", label: t("knowledge.chunkStructured") },
    { value: "faq", label: t("knowledge.chunkFAQ") },
    { value: "semantic", label: t("knowledge.chunkSemantic") },
  ]
}

function getRerankOptions(t: TFunction) {
  return [
    { value: "all", label: t("knowledge.allRerank") },
    { value: "1", label: t("knowledge.rerankEnabled") },
    { value: "0", label: t("knowledge.rerankDisabled") },
  ]
}

function channelLabel(value: string, fallback: string, t: TFunction) {
  return getKnowledgeRetrieveChannelLabel(value, fallback, t)
}

function sceneLabel(value: string, fallback: string, t: TFunction) {
  return getKnowledgeRetrieveSceneLabel(value, fallback, t)
}

function answerStatusLabel(value: number, fallback: string, t: TFunction) {
  return getKnowledgeAnswerStatusLabel(value, fallback, t)
}

function providerLabel(value: string, t: TFunction) {
  return getKnowledgeChunkProviderLabel(value, t)
}

function getAnswerStatusVariant(status: number): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case 1:
      return "default"
    case 2:
      return "secondary"
    case 3:
      return "outline"
    case 4:
      return "destructive"
    default:
      return "outline"
  }
}

export function RetrieveLogList({
  knowledgeBaseId,
}: RetrieveLogListProps) {
  const t = useI18n()
  const [questionInput, setQuestionInput] = useState("")
  const [question, setQuestion] = useState("")
  const [channel, setChannel] = useState("all")
  const [scene, setScene] = useState("all")
  const [answerStatus, setAnswerStatus] = useState("all")
  const [chunkProvider, setChunkProvider] = useState("all")
  const [rerankEnabled, setRerankEnabled] = useState("all")
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedLogId, setSelectedLogId] = useState<number | null>(null)
  const [result, setResult] = useState<PageResult<KnowledgeRetrieveLog>>({
    results: [],
    page: { page: 1, limit: 20, total: 0 },
  })
  const channelOptions = useMemo(() => getChannelOptions(t), [t])
  const sceneOptions = useMemo(() => getSceneOptions(t), [t])
  const answerStatusOptions = useMemo(() => getAnswerStatusOptions(t), [t])
  const providerOptions = useMemo(() => getProviderOptions(t), [t])
  const rerankOptions = useMemo(() => getRerankOptions(t), [t])

  const loadData = useCallback(async () => {
    if (!knowledgeBaseId) {
      setResult({ results: [], page: { page: 1, limit: 20, total: 0 } })
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const data = await fetchKnowledgeRetrieveLogs({
        knowledgeBaseId,
        question: question.trim() || undefined,
        channel: channel === "all" ? undefined : channel,
        scene: scene === "all" ? undefined : scene,
        answerStatus: answerStatus === "all" ? undefined : Number(answerStatus),
        chunkProvider: chunkProvider === "all" ? undefined : chunkProvider,
        rerankEnabled: rerankEnabled === "all" ? undefined : Number(rerankEnabled),
        page,
        limit,
      })
      setResult(data)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("knowledge.loadRetrieveLogsFailed"))
    } finally {
      setLoading(false)
    }
  }, [answerStatus, channel, chunkProvider, knowledgeBaseId, limit, page, question, rerankEnabled, scene, t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    setPage(1)
    setSelectedLogId(null)
    setDetailOpen(false)
  }, [knowledgeBaseId])

  const emptyStateText = useMemo(() => {
    if (!knowledgeBaseId) {
      return t("knowledge.selectBaseForLogs")
    }
    if (loading) {
      return t("knowledge.loadingRetrieveLogs")
    }
    return t("knowledge.emptyRetrieveLogs")
  }, [knowledgeBaseId, loading, t])

  function applyFilters() {
    setQuestion(questionInput)
    setPage(1)
  }

  function handleQuestionKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return
    }
    event.preventDefault()
    applyFilters()
  }

  function handleOpenDetail(logId: number) {
    setSelectedLogId(logId)
    setDetailOpen(true)
  }

  if (!knowledgeBaseId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {emptyStateText}
      </div>
    )
  }

  return (
    <>
      <div className="flex h-full flex-col">
        <div className="flex flex-col gap-3 border-b bg-background px-6 py-2">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.8fr)_repeat(5,minmax(0,0.8fr))_auto]">
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={questionInput}
                onChange={(event) => setQuestionInput(event.target.value)}
                onKeyDown={handleQuestionKeyDown}
                placeholder={t("knowledge.filterQuestion")}
                className="pl-9"
              />
            </div>
            <OptionCombobox value={channel} options={channelOptions} placeholder={t("knowledge.selectChannel")} onChange={setChannel} />
            <OptionCombobox value={scene} options={sceneOptions} placeholder={t("knowledge.selectScene")} onChange={setScene} />
            <OptionCombobox value={answerStatus} options={answerStatusOptions} placeholder={t("knowledge.answerStatus")} onChange={setAnswerStatus} />
            <OptionCombobox value={chunkProvider} options={providerOptions} placeholder={t("knowledge.chunkStrategy")} onChange={setChunkProvider} />
            <OptionCombobox value={rerankEnabled} options={rerankOptions} placeholder="Rerank" onChange={setRerankEnabled} />
            <Button onClick={applyFilters}>{t("knowledge.filter")}</Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto px-6 py-4">
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-42">{t("knowledge.time")}</TableHead>
                  <TableHead>{t("knowledge.question")}</TableHead>
                  <TableHead className="w-28">{t("knowledge.answerStatus")}</TableHead>
                  <TableHead className="w-24 text-right">{t("knowledge.hitCount")}</TableHead>
                  <TableHead className="w-24 text-right">TopScore</TableHead>
                  <TableHead className="w-28">Provider</TableHead>
                  <TableHead className="w-24">Rerank</TableHead>
                  <TableHead className="w-24 text-right">{t("knowledge.citations")}</TableHead>
                  <TableHead className="w-28 text-right">{t("knowledge.duration")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                      {emptyStateText}
                    </TableCell>
                  </TableRow>
                ) : (
                  result.results.map((item) => (
                    <TableRow
                      key={item.id}
                      className="cursor-pointer"
                      onClick={() => handleOpenDetail(item.id)}
                    >
                      <TableCell className="text-xs text-muted-foreground">{formatDateTime(item.createdAt)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="line-clamp-2 font-medium">{item.question || "-"}</div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span>{channelLabel(item.channel, item.channelName, t)}</span>
                            <span>{sceneLabel(item.scene, item.sceneName, t)}</span>
                            {item.knowledgeBaseName ? <span>{item.knowledgeBaseName}</span> : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getAnswerStatusVariant(item.answerStatus)}>
                          {answerStatusLabel(item.answerStatus, item.answerStatusName, t)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{item.hitCount}</TableCell>
                      <TableCell className="text-right font-mono text-xs">{item.topScore.toFixed(4)}</TableCell>
                      <TableCell>{item.chunkProvider ? providerLabel(item.chunkProvider, t) : "-"}</TableCell>
                      <TableCell>{item.rerankEnabled ? `${t("knowledge.yes")} (${item.rerankLimit})` : t("knowledge.no")}</TableCell>
                      <TableCell className="text-right">{item.citationCount}</TableCell>
                      <TableCell className="text-right">{item.latencyMs} ms</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="border-t px-6 py-4">
          <ListPagination
            page={result.page.page}
            total={result.page.total}
            limit={result.page.limit}
            loading={loading}
            onPageChange={setPage}
            onLimitChange={(nextLimit) => {
              setLimit(nextLimit)
              setPage(1)
            }}
          />
        </div>
      </div>

      <RetrieveLogDetailDrawer
        open={detailOpen}
        retrieveLogId={selectedLogId}
        onOpenChange={setDetailOpen}
      />
    </>
  )
}
