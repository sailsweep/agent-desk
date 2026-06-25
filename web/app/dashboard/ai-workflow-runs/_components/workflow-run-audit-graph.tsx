"use client"

import "@xyflow/react/dist/style.css"

import {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  getBezierPath,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react"
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  GitBranchIcon,
  InfoIcon,
  TimerIcon,
} from "lucide-react"
import { useMemo, useState } from "react"

import { JsonTreeViewer } from "@/components/json-tree-viewer"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import type {
  AIWorkflowDefinition,
  AIWorkflowNodeRun,
  AIWorkflowRun,
} from "@/lib/api/admin"

type AuditNodeData = Record<string, unknown> & {
  nodeId: string
  nodeType: string
  name: string
  executed: boolean
  statusName?: string
  durationMs?: number
  errorMessage?: string
  selected?: boolean
}

type AuditNode = Node<AuditNodeData>
type AuditEdge = Edge<{ executed?: boolean }>

type BranchDecision = {
  selectedEdgeId?: string
  selectedBranchId?: string
  selectedBranchName?: string
  selectedTargetNodeId?: string
  reason?: string
  evaluations?: BranchEvaluation[]
}

type BranchEvaluation = {
  edgeId?: string
  branchId?: string
  branchName?: string
  targetNodeId?: string
  sourceNodeId?: string
  sourceField?: string
  operator?: string
  leftValue?: unknown
  rightValue?: unknown
  matched?: boolean
}

const auditNodeTypes = {
  auditNode: AuditCanvasNode,
}

const auditEdgeTypes = {
  auditEdge: AuditCanvasEdge,
}

const fitViewOptions = {
  padding: 0.12,
  minZoom: 0.32,
  maxZoom: 1,
}

const defaultEdgeOptions = {
  type: "auditEdge",
  markerEnd: {
    type: MarkerType.ArrowClosed,
  },
}

const auditLayoutScale = {
  x: 1.35,
  y: 1.15,
}

export function WorkflowRunAuditGraph({ run }: { run: AIWorkflowRun }) {
  const nodeRuns = run.nodes ?? []
  const nodeRunByNodeId = useMemo(() => {
    const map = new Map<string, AIWorkflowNodeRun>()
    for (const node of nodeRuns) {
      map.set(node.nodeId, node)
    }
    return map
  }, [nodeRuns])
  const activeEdgeIds = useMemo(() => buildActiveEdgeIds(run.definition, nodeRuns), [run.definition, nodeRuns])
  const firstExecutedNodeId = nodeRuns[0]?.nodeId ?? run.definition?.entryNodeId ?? ""
  const [selectedNodeId, setSelectedNodeId] = useState(firstExecutedNodeId)

  const nodes = useMemo<AuditNode[]>(() => {
    return (run.definition?.nodes ?? []).map((node) => {
      const nodeRun = nodeRunByNodeId.get(node.id)
      return {
        id: node.id,
        type: "auditNode",
        position: scaleAuditPosition(node.position),
        data: {
          nodeId: node.id,
          nodeType: node.type,
          name: node.name || node.id,
          executed: Boolean(nodeRun),
          statusName: nodeRun?.statusName,
          durationMs: nodeRun?.durationMs,
          errorMessage: nodeRun?.errorMessage,
          selected: selectedNodeId === node.id,
        },
      }
    })
  }, [nodeRunByNodeId, run.definition?.nodes, selectedNodeId])

  const edges = useMemo<AuditEdge[]>(() => {
    return (run.definition?.edges ?? []).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "auditEdge",
      data: {
        executed: activeEdgeIds.has(edge.id),
      },
    }))
  }, [activeEdgeIds, run.definition?.edges])

  const selectedNodeRun = selectedNodeId ? nodeRunByNodeId.get(selectedNodeId) : undefined
  const selectedDefinitionNode = run.definition?.nodes?.find((node) => node.id === selectedNodeId)

  if (!run.definition?.nodes?.length) {
    return (
      <div className="rounded-md border border-dashed bg-muted/20 px-3 py-8 text-center text-sm text-muted-foreground">
        流程定义快照缺失，仍可查看下方节点运行明细。
      </div>
    )
  }

  return (
    <div className="grid min-h-[600px] overflow-hidden rounded-md border bg-background lg:grid-cols-[minmax(0,1fr)_390px]">
      <div className="h-[600px] min-w-0 border-b bg-muted/10 lg:border-b-0 lg:border-r">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={auditNodeTypes}
          edgeTypes={auditEdgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={fitViewOptions}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          elementsSelectable
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <AuditSidePanel
        definitionNode={selectedDefinitionNode}
        nodeRun={selectedNodeRun}
      />
    </div>
  )
}

function buildActiveEdgeIds(definition: AIWorkflowDefinition | undefined, nodeRuns: AIWorkflowNodeRun[]) {
  const active = new Set<string>()
  const edges = definition?.edges ?? []
  for (let i = 0; i < nodeRuns.length - 1; i += 1) {
    const source = nodeRuns[i]?.nodeId
    const target = nodeRuns[i + 1]?.nodeId
    const edge = edges.find((item) => item.source === source && item.target === target)
    if (edge) {
      active.add(edge.id)
    }
  }
  return active
}

function AuditCanvasEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  data,
}: EdgeProps<AuditEdge>) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.18,
  })
  const executed = Boolean(data?.executed)
  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      className={cn(
        "transition-all",
        executed ? "!stroke-primary !stroke-[2.6px]" : "!stroke-muted-foreground/25 !stroke-[1.4px]"
      )}
    />
  )
}

function AuditCanvasNode({ data }: NodeProps<AuditNode>) {
  const executed = Boolean(data.executed)
  const failed = data.statusName === "failed" || Boolean(data.errorMessage)
  const interrupted = data.statusName === "interrupted"
  const selected = Boolean(data.selected)
  const condition = data.nodeType === "condition"
  const toneClass = failed
    ? "border-destructive bg-destructive/5 text-destructive"
    : interrupted
      ? "border-amber-500 bg-amber-500/10 text-amber-700"
      : executed
        ? "border-emerald-500 bg-emerald-500/10 text-emerald-700"
        : "border-border bg-muted/40 text-muted-foreground"

  if (condition) {
    return (
      <div className={cn("relative flex size-24 items-center justify-center opacity-60", executed && "opacity-100")}>
        <Handle type="target" position={Position.Left} className="!size-2.5 !border-0 !bg-muted-foreground/50" />
        <div
          className={cn(
            "absolute inset-3 rotate-45 rounded-lg border shadow-sm transition-all",
            toneClass,
            selected && "ring-4 ring-primary/15"
          )}
        />
        <div className="relative z-10 flex max-w-18 flex-col items-center text-center">
          <GitBranchIcon className="mb-0.5 size-3.5" />
          <div className="line-clamp-2 text-[11px] font-medium leading-tight">{data.name}</div>
          <div className="mt-1 text-[10px] opacity-75">{data.statusName || "未执行"}</div>
        </div>
        <Handle type="source" position={Position.Right} className="!size-2.5 !border-0 !bg-muted-foreground/50" />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "w-40 overflow-hidden rounded-md border bg-background shadow-sm opacity-55 transition-all",
        executed && "opacity-100",
        selected && "ring-4 ring-primary/15"
      )}
    >
      <Handle type="target" position={Position.Left} className="!size-2.5 !border-0 !bg-muted-foreground/50" />
      <div className={cn("border-b px-2.5 py-1.5", toneClass)}>
        <div className="flex items-center gap-1.5">
          {failed ? <AlertTriangleIcon className="size-3.5 shrink-0" /> : <CheckCircle2Icon className="size-3.5 shrink-0" />}
          <div className="min-w-0">
            <div className="truncate text-xs font-medium">{data.name}</div>
            <div className="truncate text-[11px] opacity-75">{data.nodeType}</div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-2.5 py-1.5 text-[11px] text-muted-foreground">
        <span>{data.statusName || "未执行"}</span>
        {executed ? (
          <span className="inline-flex items-center gap-1">
            <TimerIcon className="size-3" />
            {data.durationMs ?? 0} ms
          </span>
        ) : null}
      </div>
      <Handle type="source" position={Position.Right} className="!size-2.5 !border-0 !bg-muted-foreground/50" />
    </div>
  )
}

function AuditSidePanel({
  definitionNode,
  nodeRun,
}: {
  definitionNode?: AIWorkflowDefinition["nodes"][number]
  nodeRun?: AIWorkflowNodeRun
}) {
  const inputValue = safeParseJSON(nodeRun?.inputPreview ?? "")
  const outputValue = safeParseJSON(nodeRun?.outputPreview ?? "")
  const branchDecision = extractBranchDecision(outputValue)

  return (
    <ScrollArea className="h-[600px]">
      <div className="space-y-4 p-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <InfoIcon className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">{definitionNode?.name || nodeRun?.nodeId || "节点详情"}</h3>
          </div>
          <div className="text-xs text-muted-foreground">
            {definitionNode?.id || nodeRun?.nodeId || "-"} · {definitionNode?.type || nodeRun?.nodeType || "unknown"}
          </div>
        </div>

        {nodeRun ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <AuditMeta label="状态" value={nodeRun.statusName || String(nodeRun.status)} />
            <AuditMeta label="耗时" value={`${nodeRun.durationMs || 0} ms`} />
            <AuditMeta label="开始" value={nodeRun.startedAt || "-"} />
            <AuditMeta label="结束" value={nodeRun.endedAt || "-"} />
          </div>
        ) : (
          <div className="rounded-md border border-dashed bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            本次运行没有执行该节点。
          </div>
        )}

        {nodeRun?.errorMessage ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {nodeRun.errorMessage}
          </div>
        ) : null}

        {branchDecision ? <BranchDecisionBlock decision={branchDecision} /> : null}

        <PreviewBlock title="输入" raw={nodeRun?.inputPreview ?? ""} value={inputValue} />
        <PreviewBlock title="输出" raw={nodeRun?.outputPreview ?? ""} value={outputValue} />
      </div>
    </ScrollArea>
  )
}

function AuditMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border bg-muted/20 px-2 py-1.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="truncate font-medium">{value}</div>
    </div>
  )
}

function scaleAuditPosition(position: AIWorkflowDefinition["nodes"][number]["position"] | undefined) {
  return {
    x: Math.round((position?.x ?? 0) * auditLayoutScale.x),
    y: Math.round((position?.y ?? 0) * auditLayoutScale.y),
  }
}

function BranchDecisionBlock({ decision }: { decision: BranchDecision }) {
  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-medium">分支决策</div>
        <Badge variant="outline">{decision.selectedBranchName || decision.selectedBranchId || "default"}</Badge>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <div>目标节点：{decision.selectedTargetNodeId || "-"}</div>
        <div>原因：{decision.reason || "-"}</div>
      </div>
      {decision.evaluations?.length ? (
        <div className="space-y-2 pt-1">
          {decision.evaluations.map((item, index) => (
            <div key={`${item.edgeId || item.branchId || index}`} className="rounded-md border bg-background px-2 py-1.5 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{item.branchName || item.branchId || item.edgeId || `条件 ${index + 1}`}</span>
                <Badge variant={item.matched ? "default" : "secondary"}>{item.matched ? "命中" : "未命中"}</Badge>
              </div>
              <div className="mt-1 break-all text-muted-foreground">
                {item.sourceNodeId}.{item.sourceField} {item.operator} {formatUnknown(item.rightValue)}
              </div>
              <div className="mt-1 break-all text-muted-foreground">
                实际值：{formatUnknown(item.leftValue)}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function PreviewBlock({ title, raw, value }: { title: string; raw: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-xs font-medium text-muted-foreground">{title}</div>
      {value !== null ? (
        <JsonTreeViewer value={value} collapsed={2} />
      ) : raw.trim() ? (
        <pre className="max-h-72 overflow-auto rounded-md border bg-muted/20 p-3 text-xs whitespace-pre-wrap break-all">
          {raw}
        </pre>
      ) : (
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">-</div>
      )}
    </div>
  )
}

function extractBranchDecision(value: unknown): BranchDecision | null {
  if (!value || typeof value !== "object") {
    return null
  }
  const record = value as Record<string, unknown>
  const decision = record.branchDecision
  if (!decision || typeof decision !== "object") {
    return null
  }
  return decision as BranchDecision
}

function safeParseJSON(raw: string): unknown | null {
  const trimmed = raw.trim()
  if (!trimmed) {
    return null
  }
  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

function formatUnknown(value: unknown) {
  if (typeof value === "string") {
    return value
  }
  if (value === null || value === undefined) {
    return "-"
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}
