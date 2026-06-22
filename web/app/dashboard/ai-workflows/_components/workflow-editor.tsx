"use client"

import "@xyflow/react/dist/style.css"

import {
  addEdge,
  Background,
  ConnectionMode,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react"
import { AlertCircleIcon, CheckCircle2Icon, PlusIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import type { AIWorkflowDefinition, AIWorkflowNodeSpec } from "@/lib/api/admin"
import {
  applyAutoInputMappings,
  createWorkflowNodeFromSpec,
  fromApiDefinition,
  getAvailableVariables,
  getNodeSpec,
  getRequiredInputs,
  toApiDefinition,
  validateWorkflowDraft,
  type WorkflowEditorEdge,
  type WorkflowEditorNode,
} from "./workflow-utils"
import { NodeConfigPanel } from "./node-config-panel"

const workflowDragType = "application/agent-desk-workflow-node"

type WorkflowNodeData = Record<string, unknown> & {
  nodeType?: string
  name?: string
  config?: Record<string, unknown>
  inputs?: Record<string, { nodeId: string; field: string }>
  label?: string
  title?: string
  description?: string
  inputCount?: number
  outputCount?: number
  missingInputs?: string[]
}

type WorkflowFlowNode = Node<WorkflowNodeData>
type WorkflowFlowEdge = Edge

const nodeTypes = {
  workflowNode: WorkflowCanvasNode,
}

const fitViewOptions = {
  padding: 0.16,
  minZoom: 0.72,
  maxZoom: 1,
}

const defaultEdgeOptions = {
  type: "smoothstep",
  markerEnd: {
    type: MarkerType.ArrowClosed,
  },
  style: {
    strokeWidth: 1.6,
  },
}

function toFlowNodes(definition: AIWorkflowDefinition): WorkflowFlowNode[] {
  return fromApiDefinition(definition).nodes.map((node) => ({
    id: node.id,
    type: "workflowNode",
    position: node.position,
    data: {
      nodeType: node.data?.nodeType ?? node.type,
      name: node.data?.name ?? node.id,
      label: node.data?.name ?? node.type ?? node.id,
      config: node.data?.config ?? {},
      inputs: node.data?.inputs ?? {},
    },
  }))
}

function toFlowEdges(definition: AIWorkflowDefinition): WorkflowFlowEdge[] {
  return (definition.edges ?? []).map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    data: edge.condition ? { condition: edge.condition } : undefined,
  }))
}

function toDraft(nodes: WorkflowFlowNode[], edges: WorkflowFlowEdge[]) {
  return {
    nodes: nodes.map((node) => ({
      id: node.id,
      type: node.type,
      position: node.position,
      data: {
        nodeType: node.data.nodeType,
        name: node.data.name,
        config: node.data.config,
        inputs: node.data.inputs,
      },
    })) as WorkflowEditorNode[],
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      data: edge.data as WorkflowEditorEdge["data"],
    })),
  }
}

export function WorkflowEditor({
  definition,
  nodeSpecs,
  onDefinitionChange,
}: {
  definition: AIWorkflowDefinition
  nodeSpecs: AIWorkflowNodeSpec[]
  onDefinitionChange: (definition: AIWorkflowDefinition) => void
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<WorkflowFlowNode>(
    toFlowNodes(definition)
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState<WorkflowFlowEdge>(
    toFlowEdges(definition)
  )
  const [flowInstance, setFlowInstance] = useState<ReactFlowInstance<WorkflowFlowNode, WorkflowFlowEdge> | null>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  )
  const draft = useMemo(() => toDraft(nodes, edges), [nodes, edges])
  const validation = useMemo(
    () => validateWorkflowDraft(draft, nodeSpecs),
    [draft, nodeSpecs]
  )
  const renderedNodes = useMemo(
    () => enrichNodesForRender(nodes, nodeSpecs),
    [nodes, nodeSpecs]
  )
  const selectedNodeSpec = useMemo(
    () => getNodeSpec(nodeSpecs, selectedNode?.data.nodeType ?? ""),
    [nodeSpecs, selectedNode]
  )
  const availableVariables = useMemo(
    () => (selectedNode ? getAvailableVariables(draft, selectedNode.id, nodeSpecs) : []),
    [draft, nodeSpecs, selectedNode]
  )

  useEffect(() => {
    onDefinitionChange(toApiDefinition(draft) as AIWorkflowDefinition)
  }, [draft, onDefinitionChange])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return
      }
      const edge = {
        ...connection,
        id: uniqueEdgeId(edges, connection.source, connection.target),
      } as WorkflowFlowEdge
      setEdges((current) => addEdge(edge, current))
      setNodes((currentNodes) => {
        const currentDraft = toDraft(currentNodes, [...edges, edge])
        const nextDraft = applyAutoInputMappings(
          currentDraft,
          connection.source!,
          connection.target!,
          nodeSpecs
        )
        return currentNodes.map((node) => {
          const nextNode = nextDraft.nodes.find((item) => item.id === node.id)
          if (!nextNode) {
            return node
          }
          return {
            ...node,
            data: {
              ...node.data,
              inputs: nextNode.data?.inputs ?? node.data.inputs,
            },
          }
        })
      })
    },
    [edges, nodeSpecs, setEdges, setNodes]
  )

  const addNode = (spec: AIWorkflowNodeSpec) => {
    setNodes((current) => {
      const node = createWorkflowNodeFromSpec(
        spec,
        current,
        { x: 120 + current.length * 28, y: 100 + current.length * 24 }
      ) as WorkflowFlowNode
      return [
        ...current,
        {
          ...node,
          data: {
            ...node.data,
          },
        },
      ]
    })
  }

  const onNodeDragStart = (event: React.DragEvent<HTMLButtonElement>, spec: AIWorkflowNodeSpec) => {
    event.dataTransfer.setData(workflowDragType, spec.type)
    event.dataTransfer.effectAllowed = "copy"
  }

  const onCanvasDragOver = (event: React.DragEvent) => {
    if (!event.dataTransfer.types.includes(workflowDragType)) {
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
  }

  const onCanvasDrop = (event: React.DragEvent) => {
    event.preventDefault()
    const nodeType = event.dataTransfer.getData(workflowDragType)
    if (!nodeType || !flowInstance) {
      return
    }
    const spec = nodeSpecs.find((item) => item.type === nodeType)
    if (!spec) {
      return
    }
    const position = flowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    })
    setNodes((current) => [
      ...current,
      createWorkflowNodeFromSpec(spec, current, position) as WorkflowFlowNode,
    ])
  }

  const updateNodeData = (nodeId: string, data: WorkflowNodeData) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...data,
                label: data.name ?? data.nodeType ?? node.id,
              },
            }
          : node
      )
    )
  }

  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full min-h-0 border-t">
      <ResizablePanel defaultSize="18%" minSize="12%" maxSize="34%" className="min-h-0">
        <aside className="h-full min-h-0 overflow-y-auto bg-muted/20 p-3">
          <div className="mb-3 text-sm font-medium">节点库</div>
          <div className="space-y-2">
            {nodeSpecs.map((spec) => (
              <button
                key={spec.type}
                type="button"
                draggable
                onDragStart={(event) => onNodeDragStart(event, spec)}
                onClick={() => addNode(spec)}
                className="flex w-full cursor-grab items-start gap-2 rounded-md border bg-background px-3 py-2 text-left text-sm hover:bg-muted active:cursor-grabbing"
              >
                <PlusIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{spec.title}</span>
                  <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {spec.description}
                  </span>
                  <span className="mt-1 flex gap-2 text-[11px] text-muted-foreground">
                    <span>输入 {spec.inputSchema?.length ?? 0}</span>
                    <span>输出 {spec.outputSchema?.length ?? 0}</span>
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="56%" minSize="30%" className="min-h-0">
        <section
          data-workflow-canvas
          className="relative h-full min-h-0"
          onDragOver={onCanvasDragOver}
          onDrop={onCanvasDrop}
        >
          <ReactFlow
            nodes={renderedNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            connectionMode={ConnectionMode.Loose}
            connectionRadius={34}
            connectOnClick
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setFlowInstance}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            fitView
            fitViewOptions={fitViewOptions}
            minZoom={0.45}
            maxZoom={1.35}
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
          <WorkflowValidationBadge errors={validation.errors} valid={validation.valid} />
          <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-sm">
            从节点右侧圆点拖到下一个节点，或依次点击两个连接点完成连线。
          </div>
        </section>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="26%" minSize="18%" maxSize="40%" className="min-h-0">
        <aside className="h-full min-h-0 overflow-y-auto bg-muted/10">
          <NodeConfigPanel
            node={selectedNode}
            nodeSpec={selectedNodeSpec}
            availableVariables={availableVariables}
            onChange={updateNodeData}
          />
          {!validation.valid ? (
            <div className="border-t p-4">
              <div className="mb-2 text-sm font-medium">流程检查</div>
              <ul className="space-y-1 text-xs text-destructive">
                {validation.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="border-t p-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onDefinitionChange(toApiDefinition(toDraft(nodes, edges)) as AIWorkflowDefinition)}
            >
              同步当前流程
            </Button>
          </div>
        </aside>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

function uniqueEdgeId(edges: WorkflowFlowEdge[], source: string, target: string) {
  let nextIndex = edges.length + 1
  let id = `edge_${source}_${target}_${nextIndex}`
  while (edges.some((edge) => edge.id === id)) {
    nextIndex += 1
    id = `edge_${source}_${target}_${nextIndex}`
  }
  return id
}

function enrichNodesForRender(
  nodes: WorkflowFlowNode[],
  nodeSpecs: AIWorkflowNodeSpec[]
): WorkflowFlowNode[] {
  return nodes.map((node) => {
    const spec = getNodeSpec(nodeSpecs, node.data.nodeType ?? "")
    const missingInputs = getRequiredInputs(spec).filter((input) => {
      const selector = node.data.inputs?.[input.name]
      return !selector?.nodeId || !selector.field
    })
    return {
      ...node,
      data: {
        ...node.data,
        title: spec?.title ?? node.data.name ?? node.id,
        description: spec?.description ?? "",
        inputCount: spec?.inputSchema?.length ?? 0,
        outputCount: spec?.outputSchema?.length ?? 0,
        missingInputs: missingInputs.map((input) => input.name),
      },
    }
  })
}

function WorkflowCanvasNode({ data, selected }: NodeProps<WorkflowFlowNode>) {
  const missingInputs = data.missingInputs ?? []
  const hasIssue = missingInputs.length > 0
  return (
    <div
      className={[
        "group/node w-44 rounded-md border bg-background shadow-sm",
        selected ? "ring-2 ring-ring" : "",
        hasIssue ? "border-destructive/70" : "border-border",
      ].join(" ")}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-2 !border !border-background !bg-muted-foreground/70 transition-colors group-hover/node:!bg-primary"
      />
      <div className="flex items-start gap-2 border-b px-2.5 py-2">
        {hasIssue ? (
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
        ) : (
          <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-600" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{data.name ?? data.title}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{data.title}</div>
        </div>
      </div>
      <div className="space-y-1.5 px-2.5 py-2 text-xs">
        <div className="flex justify-between text-muted-foreground">
          <span>输入 {data.inputCount ?? 0}</span>
          <span>输出 {data.outputCount ?? 0}</span>
        </div>
        {hasIssue ? (
          <div className="rounded-sm bg-destructive/10 px-2 py-1 text-destructive">
            缺少输入：{missingInputs.join("、")}
          </div>
        ) : (
          <div className="rounded-sm bg-emerald-500/10 px-2 py-1 text-emerald-700">
            配置完整
          </div>
        )}
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!size-2 !border !border-background !bg-muted-foreground/70 transition-colors group-hover/node:!bg-primary"
      />
    </div>
  )
}

function WorkflowValidationBadge({
  errors,
  valid,
}: {
  errors: string[]
  valid: boolean
}) {
  return (
    <div className="absolute left-3 top-3 flex gap-2">
      {valid ? (
        <Badge variant="default">流程可发布</Badge>
      ) : (
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                className="inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            }
          >
            <Badge variant="destructive" className="cursor-pointer">
              {errors.length} 个待处理
            </Badge>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-80">
            <div className="text-sm font-medium">Validation issues</div>
            <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto text-xs text-destructive">
              {errors.map((error) => (
                <li key={error} className="rounded-md bg-destructive/10 px-2 py-1.5">
                  {error}
                </li>
              ))}
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
