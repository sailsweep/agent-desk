"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BotMessageSquareIcon,
  BrainCircuitIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  GitBranchIcon,
  LifeBuoyIcon,
  PlugIcon,
  SaveIcon,
  SendIcon,
  SettingsIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { ContentEditor } from "@/components/content-editor"
import { OptionCombobox } from "@/components/option-combobox"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  createAIAgent,
  fetchAIAgent,
  fetchAIAgentWorkflow,
  fetchAIConfigsAll,
  fetchAIWorkflowNodeSpecs,
  fetchAgentTeamsAll,
  fetchKnowledgeBasesAll,
  fetchMCPCatalog,
  fetchSkillDefinitionsAll,
  publishAIAgentWorkflow,
  saveAIAgentWorkflow,
  updateAIAgent,
  validateAIWorkflow,
  type AIAgent,
  type AIConfig,
  type AIWorkflow,
  type AIWorkflowDefinition,
  type AIWorkflowNodeSpec,
  type AIWorkflowValidationResult,
  type AdminAgentTeam,
  type CreateAIAgentPayload,
  type KnowledgeBase,
  type MCPToolCatalogItem,
  type MCPToolSourceType,
  type SkillDefinition,
} from "@/lib/api/admin"
import {
  AIAgentFallbackMode,
  AIAgentHandoffMode,
  AIModelType,
  IMConversationServiceMode,
  Status,
} from "@/lib/generated/enums"
import { WorkflowEditor } from "../../ai-workflows/_components/workflow-editor"

type DirectToolItem = CreateAIAgentPayload["directTools"][number]

type DirectToolOption = {
  value: string
  label: string
  meta: DirectToolItem
  sourceType: MCPToolSourceType
  groupLabel: string
}

type SectionKey =
  | "basic"
  | "model"
  | "knowledge"
  | "skills"
  | "tools"
  | "workflow"
  | "handoff"
  | "publish"

const emptyDefinition: AIWorkflowDefinition = {
  schemaVersion: 1,
  entryNodeId: "start_1",
  nodes: [
    {
      id: "start_1",
      type: "start",
      name: "Start",
      position: { x: 0, y: 80 },
      config: {},
    },
    {
      id: "end_1",
      type: "end",
      name: "End",
      position: { x: 360, y: 80 },
      config: {},
    },
  ],
  edges: [{ id: "edge_start_end", source: "start_1", target: "end_1" }],
}

function toText(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === 0) return ""
  return String(value)
}

function uniqueNumbers(input: number[]) {
  return Array.from(new Set(input.filter((id) => Number.isFinite(id) && id > 0)))
}

export function AIAgentConfigWorkbench({
  agentId,
  onAgentSaved,
  onAgentCreated,
}: {
  agentId?: number | null
  onAgentSaved?: () => void
  onAgentCreated?: (agent: AIAgent) => void
}) {
  const [currentAgentId, setCurrentAgentId] = useState(agentId ?? null)
  const [activeSection, setActiveSection] = useState<SectionKey>("basic")
  const [agent, setAgent] = useState<AIAgent | null>(null)
  const [workflow, setWorkflow] = useState<AIWorkflow | null>(null)
  const [nodeSpecs, setNodeSpecs] = useState<AIWorkflowNodeSpec[]>([])
  const [validation, setValidation] = useState<AIWorkflowValidationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [savingAgent, setSavingAgent] = useState(false)
  const [savingWorkflow, setSavingWorkflow] = useState(false)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [aiConfigId, setAIConfigId] = useState("")
  const [serviceMode, setServiceMode] = useState(String(IMConversationServiceMode.AIFirst))
  const [systemPrompt, setSystemPrompt] = useState("")
  const [welcomeMessage, setWelcomeMessage] = useState("")
  const [replyTimeoutSeconds, setReplyTimeoutSeconds] = useState("180")
  const [handoffMode, setHandoffMode] = useState(String(AIAgentHandoffMode.WaitPool))
  const [fallbackMode, setFallbackMode] = useState(String(AIAgentFallbackMode.NoAnswer))
  const [fallbackMessage, setFallbackMessage] = useState("")
  const [selectedKnowledgeIds, setSelectedKnowledgeIds] = useState<number[]>([])
  const [selectedTeamIds, setSelectedTeamIds] = useState<number[]>([])
  const [selectedSkillIds, setSelectedSkillIds] = useState<number[]>([])
  const [directTools, setDirectTools] = useState<DirectToolItem[]>([])

  const [definition, setDefinition] = useState<AIWorkflowDefinition>(emptyDefinition)

  const [aiConfigs, setAIConfigs] = useState<AIConfig[]>([])
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [agentTeams, setAgentTeams] = useState<AdminAgentTeam[]>([])
  const [skills, setSkills] = useState<SkillDefinition[]>([])
  const [toolCatalog, setToolCatalog] = useState<MCPToolCatalogItem[]>([])
  const [knowledgeToAdd, setKnowledgeToAdd] = useState("")
  const [teamToAdd, setTeamToAdd] = useState("")
  const [skillToAdd, setSkillToAdd] = useState("")
  const [directToolGroupToAdd, setDirectToolGroupToAdd] = useState("")
  const [directToolToAdd, setDirectToolToAdd] = useState("")

  const editorKey = useMemo(
    () => `${workflow?.id ?? "new"}-${workflow?.updatedAt ?? ""}`,
    [workflow?.id, workflow?.updatedAt]
  )

  useEffect(() => {
    setCurrentAgentId(agentId ?? null)
  }, [agentId])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [
        specs,
        configs,
        bases,
        teams,
        skillList,
        catalog,
      ] = await Promise.all([
        fetchAIWorkflowNodeSpecs(),
        fetchAIConfigsAll({ modelType: AIModelType.LLM }),
        fetchKnowledgeBasesAll({ status: Status.Ok }),
        fetchAgentTeamsAll(),
        fetchSkillDefinitionsAll({ status: Status.Ok }),
        fetchMCPCatalog(),
      ])

      setNodeSpecs(specs ?? [])
      setAIConfigs(configs ?? [])
      setKnowledgeBases(bases ?? [])
      setAgentTeams(teams ?? [])
      setSkills(skillList ?? [])
      setToolCatalog(catalog ?? [])

      if (!currentAgentId || currentAgentId <= 0) {
        setAgent(null)
        setWorkflow(null)
        setName("")
        setDescription("")
        setAIConfigId("")
        setServiceMode(String(IMConversationServiceMode.AIFirst))
        setSystemPrompt("")
        setWelcomeMessage("")
        setReplyTimeoutSeconds("180")
        setHandoffMode(String(AIAgentHandoffMode.WaitPool))
        setFallbackMode(String(AIAgentFallbackMode.NoAnswer))
        setFallbackMessage("")
        setSelectedKnowledgeIds([])
        setSelectedTeamIds([])
        setSelectedSkillIds([])
        setDirectTools([])
        setDefinition(emptyDefinition)
        setValidation(null)
        return
      }

      const [agentDetail, workflowDetail] = await Promise.all([
        fetchAIAgent(currentAgentId),
        fetchAIAgentWorkflow(currentAgentId),
      ])

      setAgent(agentDetail)
      setWorkflow(workflowDetail)
      setName(agentDetail.name)
      setDescription(agentDetail.description || "")
      setAIConfigId(toText(agentDetail.aiConfigId))
      setServiceMode(String(agentDetail.serviceMode || IMConversationServiceMode.AIFirst))
      setSystemPrompt(agentDetail.systemPrompt || "")
      setWelcomeMessage(agentDetail.welcomeMessage || "")
      setReplyTimeoutSeconds(String(agentDetail.replyTimeoutSeconds ?? 180))
      setHandoffMode(String(agentDetail.handoffMode || AIAgentHandoffMode.WaitPool))
      setFallbackMode(String(agentDetail.fallbackMode || AIAgentFallbackMode.NoAnswer))
      setFallbackMessage(agentDetail.fallbackMessage || "")
      setSelectedKnowledgeIds(agentDetail.knowledgeIds ?? [])
      setSelectedTeamIds((agentDetail.teams ?? []).map((team) => team.id))
      setSelectedSkillIds(agentDetail.skillIds ?? [])
      setDirectTools(agentDetail.directTools ?? [])
      setDefinition(workflowDetail.draftDefinition ?? emptyDefinition)
      setValidation(null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load Agent config")
    } finally {
      setLoading(false)
    }
  }, [currentAgentId])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const serviceModeOptions = useMemo(
    () => [
      { value: String(IMConversationServiceMode.AIOnly), label: "仅 AI" },
      { value: String(IMConversationServiceMode.HumanOnly), label: "仅人工" },
      { value: String(IMConversationServiceMode.AIFirst), label: "AI 优先" },
    ],
    []
  )
  const handoffModeOptions = useMemo(
    () => [
      { value: String(AIAgentHandoffMode.WaitPool), label: "进入待接入池" },
      { value: String(AIAgentHandoffMode.DefaultTeamPool), label: "进入默认客服组待接入池" },
      { value: String(AIAgentHandoffMode.AIHoldAndNotify), label: "AI托底并提醒人工" },
    ],
    []
  )
  const fallbackModeOptions = useMemo(
    () => [
      { value: String(AIAgentFallbackMode.NoAnswer), label: "直接声明无答案" },
      { value: String(AIAgentFallbackMode.SuggestRetry), label: "建议补充信息" },
    ],
    []
  )
  const aiConfigOptions = useMemo(
    () => aiConfigs.map((item) => ({ value: String(item.id), label: `${item.name} · ${item.modelName}` })),
    [aiConfigs]
  )
  const knowledgeOptions = useMemo(
    () => knowledgeBases.map((item) => ({ value: String(item.id), label: item.name })),
    [knowledgeBases]
  )
  const teamOptions = useMemo(
    () => agentTeams.map((item) => ({ value: String(item.id), label: item.name })),
    [agentTeams]
  )
  const skillOptions = useMemo(
    () => skills.map((item) => ({ value: String(item.id), label: item.name })),
    [skills]
  )
  const directToolOptions = useMemo<DirectToolOption[]>(
    () =>
      toolCatalog
        .filter((tool) => !tool.autoInjected && tool.sourceType === "mcp")
        .map((tool) => ({
          value: tool.toolCode,
          label: `${tool.title || tool.toolName} · ${tool.toolCode}`,
          sourceType: tool.sourceType,
          groupLabel: tool.sourceType === "builtin" ? "内置工具" : tool.serverCode,
          meta: {
            toolCode: tool.toolCode,
            serverCode: tool.serverCode,
            toolName: tool.toolName,
            title: tool.title || tool.toolName,
            description: tool.description || "",
            arguments: undefined,
          },
        })),
    [toolCatalog]
  )
  const directToolGroupOptions = useMemo(
    () =>
      Array.from(
        new Map(
          directToolOptions.map((option) => [
            option.groupLabel,
            { value: option.groupLabel, label: option.groupLabel },
          ])
        ).values()
      ),
    [directToolOptions]
  )
  const addableDirectToolOptions = useMemo(
    () =>
      directToolOptions.filter(
        (option) =>
          option.groupLabel === directToolGroupToAdd &&
          !directTools.some((tool) => tool.toolCode === option.value)
      ),
    [directToolGroupToAdd, directToolOptions, directTools]
  )

  function selectedOptions(ids: number[], options: { value: string; label: string }[]) {
    return ids
      .map((id) => options.find((option) => Number(option.value) === id))
      .filter((option): option is { value: string; label: string } => !!option)
  }

  function addSelected(value: string, current: number[], setNext: (ids: number[]) => void) {
    const id = Number(value)
    if (!Number.isFinite(id) || id <= 0 || current.includes(id)) return
    setNext([...current, id])
  }

  function moveKnowledge(index: number, direction: -1 | 1) {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= selectedKnowledgeIds.length) return
    const next = [...selectedKnowledgeIds]
    const current = next[index]
    next[index] = next[targetIndex]
    next[targetIndex] = current
    setSelectedKnowledgeIds(next)
  }

  function addDirectTool(value: string) {
    const option = directToolOptions.find((item) => item.value === value)
    if (!option) return
    setDirectTools((current) =>
      current.some((tool) => tool.toolCode === option.meta.toolCode)
        ? current
        : [...current, option.meta]
    )
    setDirectToolToAdd("")
  }

  function buildPayload(): CreateAIAgentPayload {
    return {
      name: name.trim(),
      description: description.trim(),
      aiConfigId: Number(aiConfigId),
      serviceMode: Number(serviceMode),
      systemPrompt: systemPrompt.trim(),
      welcomeMessage: welcomeMessage.trim(),
      replyTimeoutSeconds: Number(replyTimeoutSeconds),
      teamIds: uniqueNumbers(selectedTeamIds),
      handoffMode: Number(handoffMode),
      fallbackMode: Number(fallbackMode),
      fallbackMessage: fallbackMessage.trim(),
      knowledgeIds: uniqueNumbers(selectedKnowledgeIds),
      skillIds: uniqueNumbers(selectedSkillIds),
      directTools,
      graphTools: [],
    }
  }

  async function saveAgentSettings() {
    setSavingAgent(true)
    try {
      const payload = buildPayload()
      if (agent) {
        await updateAIAgent({ id: agent.id, ...payload })
        toast.success("Agent config saved")
        await loadData()
      } else {
        const created = await createAIAgent(payload)
        setCurrentAgentId(created.id)
        setAgent(created)
        toast.success("Agent created")
        onAgentCreated?.(created)
      }
      onAgentSaved?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save Agent config")
    } finally {
      setSavingAgent(false)
    }
  }

  async function saveWorkflowDraft() {
    if (!currentAgentId) return
    setSavingWorkflow(true)
    try {
      const saved = await saveAIAgentWorkflow({
        agentId: currentAgentId,
        name: "",
        description: "",
        definition,
      })
      setWorkflow(saved)
      toast.success("Workflow draft saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save workflow draft")
    } finally {
      setSavingWorkflow(false)
    }
  }

  async function validateWorkflowDraft() {
    setSavingWorkflow(true)
    try {
      const result = await validateAIWorkflow(definition)
      setValidation(result)
      toast[result.valid ? "success" : "error"](
        result.valid ? "Workflow is valid" : "Workflow has validation errors"
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to validate workflow")
    } finally {
      setSavingWorkflow(false)
    }
  }

  async function publishWorkflow() {
    if (!currentAgentId) return
    setSavingWorkflow(true)
    try {
      await saveAIAgentWorkflow({
        agentId: currentAgentId,
        name: "",
        description: "",
        definition,
      })
      const version = await publishAIAgentWorkflow(currentAgentId, definition)
      toast.success(`Published version ${version.version}`)
      await loadData()
      onAgentSaved?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish workflow")
    } finally {
      setSavingWorkflow(false)
    }
  }

  const sections: { key: SectionKey; title: string; icon: ReactNode }[] = [
    { key: "basic", title: "基础信息", icon: <SettingsIcon /> },
    { key: "model", title: "模型与 Prompt", icon: <BrainCircuitIcon /> },
    { key: "knowledge", title: "知识库", icon: <DatabaseIcon /> },
    { key: "skills", title: "Skills", icon: <ShieldCheckIcon /> },
    { key: "tools", title: "MCP Tools", icon: <PlugIcon /> },
    { key: "workflow", title: "会话流程", icon: <GitBranchIcon /> },
    { key: "handoff", title: "转人工与兜底", icon: <LifeBuoyIcon /> },
    { key: "publish", title: "发布状态", icon: <ShieldCheckIcon /> },
  ]

  const selectedKnowledgeOptions = selectedOptions(selectedKnowledgeIds, knowledgeOptions)
  const selectedTeamOptions = selectedOptions(selectedTeamIds, teamOptions)
  const selectedSkillOptions = selectedOptions(selectedSkillIds, skillOptions)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between gap-4 border-b px-5 py-3 pr-28">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <BotMessageSquareIcon className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">{agent?.name ?? "新建 AI Agent"}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              {agent?.statusName ? <Badge variant="secondary">{agent.statusName}</Badge> : null}
              {agent?.workflowVersionId ? <Badge>已发布流程</Badge> : <Badge variant="outline">草稿流程</Badge>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={savingAgent || loading} onClick={saveAgentSettings}>
            <SaveIcon className="size-4" />
            保存
          </Button>
          <Button disabled={savingWorkflow || loading || !currentAgentId} onClick={publishWorkflow}>
            <SendIcon className="size-4" />
            发布流程
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[190px_minmax(0,1fr)] bg-muted/30">
        <aside className="min-h-0 overflow-y-auto border-r bg-muted/50 p-2">
          <div className="space-y-1">
            {sections.map((section) => (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={`group relative flex h-9 w-full items-center gap-2 rounded-md border px-2.5 text-left text-sm transition-colors ${
                  activeSection === section.key
                    ? "border-primary/25 bg-primary/10 font-medium text-foreground shadow-xs"
                    : "border-border/60 bg-background/55 text-muted-foreground shadow-xs hover:border-primary/20 hover:bg-background hover:text-foreground hover:shadow-sm"
                }`}
              >
                {activeSection === section.key ? (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                ) : null}
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-sm ${
                    activeSection === section.key
                      ? "bg-primary/15 text-primary"
                      : "bg-muted/80 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                  }`}
                >
                  {section.icon}
                </span>
                <span className="min-w-0 flex-1 truncate leading-none">{section.title}</span>
              </button>
            ))}
          </div>
        </aside>

        <main className="min-h-0 overflow-y-auto bg-background">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              加载中...
            </div>
          ) : (
            <div className={activeSection === "workflow" ? "h-full min-h-0" : "w-full p-6"}>
              {activeSection === "basic" ? (
                <ConfigSection title="基础信息" description="定义这个 Agent 在渠道和后台中的基础身份。">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <FieldBlock label="名称">
                      <Input value={name} onChange={(event) => setName(event.target.value)} />
                    </FieldBlock>
                    <FieldBlock label="服务模式">
                      <OptionCombobox
                        value={serviceMode}
                        options={serviceModeOptions}
                        placeholder="选择服务模式"
                        onChange={setServiceMode}
                      />
                    </FieldBlock>
                  </div>
                  <FieldBlock label="描述">
                    <Textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} />
                  </FieldBlock>
                </ConfigSection>
              ) : null}

              {activeSection === "model" ? (
                <ConfigSection title="模型与 Prompt" description="配置模型、系统提示词和首响内容。">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <FieldBlock label="AI 配置">
                      <OptionCombobox
                        value={aiConfigId}
                        options={aiConfigOptions}
                        placeholder="选择 AI 配置"
                        searchPlaceholder="搜索 AI 配置"
                        emptyText="没有可用 AI 配置"
                        onChange={setAIConfigId}
                      />
                    </FieldBlock>
                    <FieldBlock label="回复超时秒数">
                      <Input
                        type="number"
                        min={0}
                        step={1}
                        value={replyTimeoutSeconds}
                        onChange={(event) => setReplyTimeoutSeconds(event.target.value)}
                      />
                    </FieldBlock>
                  </div>
                  <FieldBlock label="系统提示词">
                    <ContentEditor
                      value={{ mode: "markdown", raw: systemPrompt }}
                      allowedModes={["markdown"]}
                      height={360}
                      onChange={(next) => setSystemPrompt(next.raw)}
                    />
                  </FieldBlock>
                  <FieldBlock label="欢迎语">
                    <Textarea rows={5} value={welcomeMessage} onChange={(event) => setWelcomeMessage(event.target.value)} />
                  </FieldBlock>
                </ConfigSection>
              ) : null}

              {activeSection === "knowledge" ? (
                <ConfigSection title="知识库" description="选择 Agent 检索知识的范围和优先级。">
                  <AddRow
                    value={knowledgeToAdd}
                    options={knowledgeOptions.filter((option) => !selectedKnowledgeIds.includes(Number(option.value)))}
                    placeholder="选择知识库"
                    onValueChange={setKnowledgeToAdd}
                    onAdd={() => {
                      addSelected(knowledgeToAdd, selectedKnowledgeIds, setSelectedKnowledgeIds)
                      setKnowledgeToAdd("")
                    }}
                  />
                  <div className="space-y-2 rounded-md border p-3">
                    {selectedKnowledgeOptions.length === 0 ? (
                      <div className="text-sm text-muted-foreground">至少选择一个知识库。</div>
                    ) : (
                      selectedKnowledgeOptions.map((option, index) => (
                        <div key={option.value} className="flex items-center gap-2">
                          <Badge variant="secondary" className="min-w-8 justify-center">{index + 1}</Badge>
                          <div className="flex-1 text-sm">{option.label}</div>
                          <Button variant="outline" size="icon-sm" disabled={index === 0} onClick={() => moveKnowledge(index, -1)}>
                            <ArrowUpIcon />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            disabled={index === selectedKnowledgeOptions.length - 1}
                            onClick={() => moveKnowledge(index, 1)}
                          >
                            <ArrowDownIcon />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            onClick={() => setSelectedKnowledgeIds((current) => current.filter((id) => id !== Number(option.value)))}
                          >
                            <Trash2Icon />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </ConfigSection>
              ) : null}

              {activeSection === "skills" ? (
                <ConfigSection title="Skills" description="选择固定业务流程和多步任务能力。">
                  <AddRow
                    value={skillToAdd}
                    options={skillOptions.filter((option) => !selectedSkillIds.includes(Number(option.value)))}
                    placeholder="选择 Skill"
                    onValueChange={setSkillToAdd}
                    onAdd={() => {
                      addSelected(skillToAdd, selectedSkillIds, setSelectedSkillIds)
                      setSkillToAdd("")
                    }}
                  />
                  <BadgeList
                    empty="未配置 Skill。"
                    items={selectedSkillOptions}
                    onRemove={(id) => setSelectedSkillIds((current) => current.filter((item) => item !== id))}
                  />
                </ConfigSection>
              ) : null}

              {activeSection === "tools" ? (
                <ConfigSection title="MCP Tools" description="配置外部 MCP Direct Tools。内置 Graph Tool 由会话流程节点管理。">
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)_auto]">
                    <OptionCombobox
                      value={directToolGroupToAdd}
                      options={directToolGroupOptions}
                      placeholder="选择工具分组"
                      onChange={(value) => {
                        setDirectToolGroupToAdd(value)
                        setDirectToolToAdd("")
                      }}
                    />
                    <OptionCombobox
                      value={directToolToAdd}
                      options={addableDirectToolOptions}
                      placeholder="选择 Direct Tool"
                      onChange={(value) => {
                        setDirectToolToAdd(value)
                        addDirectTool(value)
                      }}
                    />
                    <Button variant="outline" disabled={!directToolToAdd} onClick={() => addDirectTool(directToolToAdd)}>
                      添加
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {directTools.length === 0 ? (
                      <div className="text-sm text-muted-foreground">未配置 Direct Tool。</div>
                    ) : (
                      directTools.map((tool) => (
                        <Badge key={tool.toolCode} variant="secondary" className="gap-1 pr-1">
                          {tool.title || tool.toolCode}
                          <span className="text-[10px] text-muted-foreground/80">{tool.serverCode || "MCP"}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-5"
                            onClick={() => setDirectTools((current) => current.filter((item) => item.toolCode !== tool.toolCode))}
                          >
                            <Trash2Icon className="size-3" />
                          </Button>
                        </Badge>
                      ))
                    )}
                  </div>
                </ConfigSection>
              ) : null}

              {activeSection === "workflow" ? (
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex shrink-0 items-center justify-between border-b px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">主会话流程</div>
                    </div>
                    <div className="ml-3 flex items-center gap-2">
                      {validation ? (
                        <Badge variant={validation.valid ? "default" : "destructive"}>
                          {validation.valid ? "校验通过" : `${validation.errors.length} 个问题`}
                        </Badge>
                      ) : null}
                      <Button size="sm" variant="outline" disabled={savingWorkflow || !currentAgentId} onClick={validateWorkflowDraft}>
                        <CheckCircle2Icon className="size-4" />
                        校验
                      </Button>
                      <Button size="sm" variant="outline" disabled={savingWorkflow || !currentAgentId} onClick={saveWorkflowDraft}>
                        <SaveIcon className="size-4" />
                        保存草稿
                      </Button>
                      <Button size="sm" disabled={savingWorkflow || !currentAgentId} onClick={publishWorkflow}>
                        <SendIcon className="size-4" />
                        发布
                      </Button>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1">
                    <WorkflowEditor
                      key={editorKey}
                      definition={definition}
                      nodeSpecs={nodeSpecs}
                      onDefinitionChange={setDefinition}
                    />
                  </div>
                </div>
              ) : null}

              {activeSection === "handoff" ? (
                <ConfigSection title="转人工与兜底" description="配置无法自动完成时的接入和回复策略。">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <FieldBlock label="转人工模式">
                      <OptionCombobox value={handoffMode} options={handoffModeOptions} placeholder="选择转人工模式" onChange={setHandoffMode} />
                    </FieldBlock>
                    <FieldBlock label="兜底策略">
                      <OptionCombobox value={fallbackMode} options={fallbackModeOptions} placeholder="选择兜底策略" onChange={setFallbackMode} />
                    </FieldBlock>
                  </div>
                  <AddRow
                    value={teamToAdd}
                    options={teamOptions.filter((option) => !selectedTeamIds.includes(Number(option.value)))}
                    placeholder="选择客服组"
                    onValueChange={setTeamToAdd}
                    onAdd={() => {
                      addSelected(teamToAdd, selectedTeamIds, setSelectedTeamIds)
                      setTeamToAdd("")
                    }}
                  />
                  <BadgeList
                    empty="未配置客服组。"
                    items={selectedTeamOptions}
                    onRemove={(id) => setSelectedTeamIds((current) => current.filter((item) => item !== id))}
                  />
                  <FieldBlock label="兜底文案">
                    <Textarea rows={5} value={fallbackMessage} onChange={(event) => setFallbackMessage(event.target.value)} />
                  </FieldBlock>
                </ConfigSection>
              ) : null}

              {activeSection === "publish" ? (
                <ConfigSection title="发布状态" description="查看当前 Agent 流程发布状态。">
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <StatusTile label="Agent 状态" value={agent?.statusName || "-"} />
                    <StatusTile label="运行模式" value={agent?.runtimeModeName || "-"} />
                    <StatusTile label="生效流程版本" value={agent?.workflowVersionId ? `#${agent.workflowVersionId}` : "未发布"} />
                  </div>
                  <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
                    发布会先保存当前流程草稿，再生成不可变版本，并将该版本绑定为 Agent 当前生效流程。
                  </div>
                </ConfigSection>
              ) : null}

            </div>
          )}
        </main>
      </div>
    </div>
  )
}

function ConfigSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function FieldBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function AddRow({
  value,
  options,
  placeholder,
  onValueChange,
  onAdd,
}: {
  value: string
  options: { value: string; label: string }[]
  placeholder: string
  onValueChange: (value: string) => void
  onAdd: () => void
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <OptionCombobox value={value} options={options} placeholder={placeholder} onChange={onValueChange} />
      </div>
      <Button type="button" variant="outline" disabled={!value} onClick={onAdd}>
        添加
      </Button>
    </div>
  )
}

function BadgeList({
  empty,
  items,
  onRemove,
}: {
  empty: string
  items: { value: string; label: string }[]
  onRemove: (id: number) => void
}) {
  if (items.length === 0) {
    return <div className="text-sm text-muted-foreground">{empty}</div>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Badge key={item.value} variant="secondary" className="gap-1 pr-1">
          {item.label}
          <Button type="button" variant="ghost" size="icon" className="size-5" onClick={() => onRemove(Number(item.value))}>
            <Trash2Icon className="size-3" />
          </Button>
        </Badge>
      ))}
    </div>
  )
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/20 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm font-medium">{value}</div>
    </div>
  )
}
