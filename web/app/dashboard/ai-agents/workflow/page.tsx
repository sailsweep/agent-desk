"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, CheckCircle2Icon, GitBranchIcon, SaveIcon, SendIcon } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  fetchAIAgent,
  fetchAIAgentWorkflow,
  fetchAIWorkflowNodeSpecs,
  publishAIAgentWorkflow,
  saveAIAgentWorkflow,
  validateAIWorkflow,
  type AIAgent,
  type AIWorkflow,
  type AIWorkflowDefinition,
  type AIWorkflowNodeSpec,
  type AIWorkflowValidationResult,
} from "@/lib/api/admin"
import { WorkflowEditor } from "../../ai-workflows/_components/workflow-editor"

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

function readAgentIdFromLocation() {
  if (typeof window === "undefined") {
    return 0
  }
  return Number(new URLSearchParams(window.location.search).get("agentId"))
}

export default function DashboardAIAgentWorkflowPage() {
  const router = useRouter()
  const [agentId] = useState(() => readAgentIdFromLocation())
  const [agent, setAgent] = useState<AIAgent | null>(null)
  const [workflow, setWorkflow] = useState<AIWorkflow | null>(null)
  const [nodeSpecs, setNodeSpecs] = useState<AIWorkflowNodeSpec[]>([])
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [definition, setDefinition] = useState<AIWorkflowDefinition>(emptyDefinition)
  const [validation, setValidation] = useState<AIWorkflowValidationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const editorKey = useMemo(
    () => `${workflow?.id ?? "new"}-${workflow?.updatedAt ?? ""}`,
    [workflow?.id, workflow?.updatedAt]
  )

  const loadData = useCallback(async () => {
    if (!Number.isFinite(agentId) || agentId <= 0) {
      return
    }
    const [agentDetail, workflowDetail, specs] = await Promise.all([
      fetchAIAgent(agentId),
      fetchAIAgentWorkflow(agentId),
      fetchAIWorkflowNodeSpecs(),
    ])
    setAgent(agentDetail)
    setWorkflow(workflowDetail)
    setNodeSpecs(specs ?? [])
    setName(workflowDetail.name || `${agentDetail.name} 会话流程`)
    setDescription(workflowDetail.description || "")
    setDefinition(workflowDetail.draftDefinition ?? emptyDefinition)
    setValidation(null)
  }, [agentId])

  useEffect(() => {
    void loadData().catch((error) => {
      toast.error(error instanceof Error ? error.message : "Failed to load workflow")
    })
  }, [loadData])

  const saveDraft = async () => {
    if (!Number.isFinite(agentId) || agentId <= 0) {
      toast.error("Invalid AI Agent.")
      return
    }
    setLoading(true)
    try {
      const saved = await saveAIAgentWorkflow({
        agentId,
        name,
        description,
        definition,
      })
      setWorkflow(saved)
      toast.success("Draft saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save workflow")
    } finally {
      setLoading(false)
    }
  }

  const runValidation = async () => {
    setLoading(true)
    try {
      const result = await validateAIWorkflow(definition)
      setValidation(result)
      toast[result.valid ? "success" : "error"](
        result.valid ? "Workflow is valid" : "Workflow has validation errors"
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to validate workflow")
    } finally {
      setLoading(false)
    }
  }

  const publish = async () => {
    if (!Number.isFinite(agentId) || agentId <= 0) {
      toast.error("Invalid AI Agent.")
      return
    }
    setLoading(true)
    try {
      const saved = await saveAIAgentWorkflow({
        agentId,
        name,
        description,
        definition,
      })
      setWorkflow(saved)
      const version = await publishAIAgentWorkflow(agentId, definition)
      toast.success(`Published version ${version.version}`)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to publish workflow")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-[calc(100vh-var(--header-height))] min-h-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between border-b px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" size="icon-sm" onClick={() => router.push("/dashboard/ai-agents")}>
            <ArrowLeftIcon />
          </Button>
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold">
              {agent ? `${agent.name} · 会话流程` : "AI Agent Workflow"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Edit and publish this Agent&apos;s customer-service conversation flow.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={loading} onClick={runValidation}>
            <CheckCircle2Icon className="size-4" />
            Validate
          </Button>
          <Button variant="outline" disabled={loading} onClick={saveDraft}>
            <SaveIcon className="size-4" />
            Save draft
          </Button>
          <Button disabled={loading} onClick={publish}>
            <SendIcon className="size-4" />
            Publish
          </Button>
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(0,1fr)]">
        <aside className="min-h-0 overflow-y-auto border-r bg-muted/20">
          <div className="space-y-4 border-b p-4">
            <div className="space-y-2">
              <Label htmlFor="workflow-name">Name</Label>
              <Input
                id="workflow-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="workflow-description">Description</Label>
              <Textarea
                id="workflow-description"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-3 p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Agent</span>
              <span className="truncate font-medium">{agent?.name ?? `#${agentId || "-"}`}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Published</span>
              {workflow?.publishedVersionId ? (
                <Badge variant="secondary">Version linked</Badge>
              ) : (
                <span className="text-muted-foreground">Not published</span>
              )}
            </div>
          </div>
        </aside>
        <main className="flex min-h-0 flex-col overflow-hidden">
          <div className="flex shrink-0 items-center gap-2 border-b px-4 py-2 text-sm">
            <GitBranchIcon className="size-4 text-muted-foreground" />
            <span className="font-medium">{name || "Conversation workflow"}</span>
            {validation ? (
              <Badge variant={validation.valid ? "default" : "destructive"}>
                {validation.valid ? "Backend valid" : `${validation.errors.length} backend errors`}
              </Badge>
            ) : null}
            {validation && !validation.valid ? (
              <span className="truncate text-xs text-destructive">
                {validation.errors.map((item) => item.message).join("; ")}
              </span>
            ) : null}
          </div>
          <div className="min-h-0 flex-1">
            <WorkflowEditor
              key={editorKey}
              definition={definition}
              nodeSpecs={nodeSpecs}
              onDefinitionChange={setDefinition}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
