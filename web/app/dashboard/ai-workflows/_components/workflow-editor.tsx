"use client"

import "@xyflow/react/dist/style.css"

import {
  addEdge,
  Background,
  BaseEdge,
  ConnectionMode,
  EdgeLabelRenderer,
  Controls,
  getBezierPath,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type ConnectionLineComponentProps,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react"
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  PlusIcon,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { OptionCombobox } from "@/components/option-combobox"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
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
  type WorkflowVariableRef,
  type WorkflowVariableSelector,
  type WorkflowEditorEdge,
  type WorkflowEditorNode,
} from "./workflow-utils"
import { NodeConfigPanel, type WorkflowBranchSummary } from "./node-config-panel"
import { VariableSelector } from "./variable-selector"

type WorkflowNodeData = Record<string, unknown> & {
  nodeType?: string
  name?: string
  config?: Record<string, unknown>
  inputs?: Record<string, { nodeId: string; field: string }>
  nodeSpecs?: AIWorkflowNodeSpec[]
  onAddAfter?: (sourceNodeId: string, spec: AIWorkflowNodeSpec) => void
  label?: string
  title?: string
  description?: string
  inputCount?: number
  outputCount?: number
  missingInputs?: string[]
}

type WorkflowFlowNode = Node<WorkflowNodeData>
type WorkflowFlowEdge = Edge
type WorkflowEdgeCondition = NonNullable<WorkflowEditorEdge["data"]>["condition"]
type WorkflowEdgeRenderData = WorkflowEditorEdge["data"] & {
  active?: boolean
  onSelect?: (edgeId: string) => void
}

type PendingNodeDrag = {
  spec: AIWorkflowNodeSpec
  startX: number
  startY: number
  x: number
  y: number
  active: boolean
}

const nodeTypes = {
  workflowNode: WorkflowCanvasNode,
}

const edgeTypes = {
  workflowEdge: WorkflowCanvasEdge,
}

const fitViewOptions = {
  padding: 0.16,
  minZoom: 0.72,
  maxZoom: 1,
}

const defaultEdgeOptions = {
  type: "workflowEdge",
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
    type: "workflowEdge",
    source: edge.source,
    target: edge.target,
    label: edge.condition ? "条件" : undefined,
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
  const [nodeLibraryCollapsed, setNodeLibraryCollapsed] = useState(false)
  const [nodeLibraryRendered, setNodeLibraryRendered] = useState(true)
  const [nodeLibraryVisible, setNodeLibraryVisible] = useState(true)
  const [nodeLibraryWidth, setNodeLibraryWidth] = useState(260)
  const [nodeLibraryResizing, setNodeLibraryResizing] = useState(false)
  const [pendingNodeDrag, setPendingNodeDrag] = useState<PendingNodeDrag | null>(null)
  const [propertyPanelNode, setPropertyPanelNode] = useState<WorkflowFlowNode | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)
  const [propertyPanelEdge, setPropertyPanelEdge] = useState<WorkflowFlowEdge | null>(null)
  const [propertyPanelVisible, setPropertyPanelVisible] = useState(false)
  const editorRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLElement | null>(null)
  const pendingNodeDragRef = useRef<PendingNodeDrag | null>(null)
  const suppressNextClickRef = useRef(false)
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  )
  const selectedEdge = useMemo(
    () => edges.find((edge) => edge.id === selectedEdgeId) ?? null,
    [edges, selectedEdgeId]
  )
  const draft = useMemo(() => toDraft(nodes, edges), [nodes, edges])
  const validation = useMemo(
    () => validateWorkflowDraft(draft, nodeSpecs),
    [draft, nodeSpecs]
  )
  const propertyPanelNodeSpec = useMemo(
    () => getNodeSpec(nodeSpecs, propertyPanelNode?.data.nodeType ?? ""),
    [nodeSpecs, propertyPanelNode]
  )
  const propertyPanelAvailableVariables = useMemo(
    () => (propertyPanelNode ? getAvailableVariables(draft, propertyPanelNode.id, nodeSpecs) : []),
    [draft, nodeSpecs, propertyPanelNode]
  )
  const propertyPanelBranchSummaries = useMemo(
    () => (propertyPanelNode ? getBranchSummaries(nodes, edges, propertyPanelNode.id) : []),
    [edges, nodes, propertyPanelNode]
  )
  const propertyPanelEdgeVariables = useMemo(
    () => (propertyPanelEdge ? getEdgeConditionVariables(draft, propertyPanelEdge.source, nodeSpecs) : []),
    [draft, nodeSpecs, propertyPanelEdge]
  )

  useEffect(() => {
    onDefinitionChange(toApiDefinition(draft) as AIWorkflowDefinition)
  }, [draft, onDefinitionChange])

  useEffect(() => {
    onDefinitionChange(toApiDefinition(draft) as AIWorkflowDefinition)
  }, [draft, onDefinitionChange])

  useEffect(() => {
    if (!nodeLibraryCollapsed) {
      setNodeLibraryRendered(true)
      const timer = window.setTimeout(() => {
        setNodeLibraryVisible(true)
      }, 0)
      return () => window.clearTimeout(timer)
    }

    setNodeLibraryVisible(false)
    const unmountTimer = window.setTimeout(() => setNodeLibraryRendered(false), 220)
    return () => window.clearTimeout(unmountTimer)
  }, [nodeLibraryCollapsed])

  useEffect(() => {
    if (selectedNode) {
      setPropertyPanelNode(selectedNode)
      setPropertyPanelEdge(null)
      window.setTimeout(() => setPropertyPanelVisible(true), 0)
      return
    }
    if (selectedEdge) {
      setPropertyPanelEdge(selectedEdge)
      setPropertyPanelNode(null)
      window.setTimeout(() => setPropertyPanelVisible(true), 0)
      return
    }

    setPropertyPanelVisible(false)
    const timer = window.setTimeout(() => {
      setPropertyPanelNode(null)
      setPropertyPanelEdge(null)
    }, 220)
    return () => window.clearTimeout(timer)
  }, [selectedNode, selectedEdge])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) {
        return
      }
      const edge = {
        ...connection,
        id: uniqueEdgeId(edges, connection.source, connection.target),
        type: "workflowEdge",
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

  const addNodeAfter = useCallback(
    (sourceNodeId: string, spec: AIWorkflowNodeSpec) => {
      setNodes((current) => {
        const sourceNode = current.find((node) => node.id === sourceNodeId)
        const nextPosition = sourceNode
          ? { x: sourceNode.position.x + 280, y: sourceNode.position.y }
          : { x: 160 + current.length * 32, y: 120 + current.length * 24 }
        const nextNode = createWorkflowNodeFromSpec(
          spec,
          current,
          nextPosition
        ) as WorkflowFlowNode

        setEdges((currentEdges) => [
          ...currentEdges,
          {
            id: uniqueEdgeId(currentEdges, sourceNodeId, nextNode.id),
            source: sourceNodeId,
            target: nextNode.id,
            type: "workflowEdge",
          },
        ])

        return [...current, nextNode]
      })
    },
    [setEdges, setNodes]
  )

  const renderedNodes = useMemo(
    () =>
      enrichNodesForRender(nodes, nodeSpecs).map((node) => ({
        ...node,
        data: {
          ...node.data,
          nodeSpecs,
          onAddAfter: addNodeAfter,
        },
      })),
    [addNodeAfter, nodes, nodeSpecs]
  )

  const dropNodeOnCanvas = useCallback(
    (spec: AIWorkflowNodeSpec, x: number, y: number) => {
      if (!flowInstance || !canvasRef.current) {
        return false
      }
      const rect = canvasRef.current.getBoundingClientRect()
      if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
        return false
      }
      const position = flowInstance.screenToFlowPosition({ x, y })
      setNodes((current) => [
        ...current,
        createWorkflowNodeFromSpec(spec, current, position) as WorkflowFlowNode,
      ])
      return true
    },
    [flowInstance, setNodes]
  )

  const onNodePointerDown = (event: React.PointerEvent<HTMLButtonElement>, spec: AIWorkflowNodeSpec) => {
    if (event.button !== 0) {
      return
    }
    const initialDrag = {
      spec,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      active: false,
    }
    pendingNodeDragRef.current = initialDrag
    setPendingNodeDrag(initialDrag)

    const handlePointerMove = (event: PointerEvent) => {
      const current = pendingNodeDragRef.current
      if (!current) {
        return
      }
      const moved = Math.hypot(event.clientX - current.startX, event.clientY - current.startY)
      const nextDrag = {
        ...current,
        x: event.clientX,
        y: event.clientY,
        active: current.active || moved > 6,
      }
      pendingNodeDragRef.current = nextDrag
      setPendingNodeDrag(nextDrag)
    }

    const handlePointerUp = (event: PointerEvent) => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      const current = pendingNodeDragRef.current
      pendingNodeDragRef.current = null
      setPendingNodeDrag(null)
      if (current?.active) {
        suppressNextClickRef.current = true
        dropNodeOnCanvas(current.spec, event.clientX, event.clientY)
      }
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
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

  const selectEdge = useCallback((edgeId: string) => {
    setSelectedNodeId(null)
    setSelectedEdgeId(edgeId)
  }, [])

  const renderedEdges = useMemo(
    () =>
      edges.map((edge) => {
        const active = edge.id === selectedEdgeId
        return {
          ...edge,
          selected: active,
          data: {
            ...((edge.data ?? {}) as WorkflowEditorEdge["data"]),
            active,
            onSelect: selectEdge,
          } satisfies WorkflowEdgeRenderData,
        }
      }),
    [edges, selectedEdgeId, selectEdge]
  )

  const updateEdgeCondition = (edgeId: string, condition?: WorkflowEdgeCondition) => {
    setEdges((current) =>
      current.map((edge) =>
        edge.id === edgeId
          ? {
              ...edge,
              label: condition ? "条件" : undefined,
              data: condition ? { ...(edge.data as object), condition } : undefined,
            }
          : edge
      )
    )
  }

  const clampNodeLibraryWidth = useCallback((width: number) => {
    const containerWidth = editorRef.current?.getBoundingClientRect().width ?? 0
    const maxWidth = containerWidth > 0 ? containerWidth * 0.34 : 520
    return Math.min(maxWidth, Math.max(192, width))
  }, [])

  const onNodeLibraryResizePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    const startX = event.clientX
    const startWidth = nodeLibraryWidth
    setNodeLibraryResizing(true)

    const handlePointerMove = (event: PointerEvent) => {
      setNodeLibraryWidth(clampNodeLibraryWidth(startWidth + event.clientX - startX))
    }

    const handlePointerUp = () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
      setNodeLibraryResizing(false)
    }

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
  }

  return (
    <div ref={editorRef} className="flex h-full min-h-0 w-full">
      {nodeLibraryRendered ? (
        <>
          <div
            className={cn(
              "h-full min-h-0 shrink-0 overflow-hidden transition-[width,opacity,transform] duration-200 ease-out",
              nodeLibraryResizing && "transition-none",
              nodeLibraryVisible
                ? "translate-x-0 opacity-100"
                : "-translate-x-3 opacity-0"
            )}
            style={{ width: nodeLibraryVisible ? nodeLibraryWidth : 0 }}
          >
            <aside
              className={[
                "h-full min-h-0 bg-muted/20 transition-all duration-200 ease-out",
                nodeLibraryVisible
                  ? "translate-x-0 opacity-100"
                  : "-translate-x-3 opacity-0",
              ].join(" ")}
            >
              <ScrollArea className="h-full min-h-0">
                <div className="p-3">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div className="min-w-0 truncate text-sm font-medium">节点库</div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                      onClick={() => setNodeLibraryCollapsed(true)}
                      aria-label="折叠节点库"
                    >
                      <PanelLeftCloseIcon className="size-3.5" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {nodeSpecs.map((spec) => (
                      <button
                        key={spec.type}
                        type="button"
                        onPointerDown={(event) => onNodePointerDown(event, spec)}
                        onClick={() => {
                          if (suppressNextClickRef.current) {
                            suppressNextClickRef.current = false
                            return
                          }
                          addNode(spec)
                        }}
                        className="flex w-full cursor-grab rounded-md border bg-background px-3 py-2 text-left text-sm hover:bg-muted active:cursor-grabbing"
                      >
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
                </div>
              </ScrollArea>
            </aside>
          </div>
          <div
            className={cn(
              "relative flex w-1.5 shrink-0 cursor-col-resize items-center justify-center bg-transparent transition-opacity duration-200 ease-out hover:bg-primary/20",
              nodeLibraryVisible ? "opacity-100" : "pointer-events-none opacity-0"
            )}
            onPointerDown={onNodeLibraryResizePointerDown}
            role="separator"
            aria-orientation="vertical"
            aria-label="调整节点库宽度"
          >
            <div className="z-10 flex h-6 w-1 shrink-0 rounded-lg bg-border" />
          </div>
        </>
      ) : null}
      <div className="min-h-0 min-w-0 flex-1">
        <section
          data-workflow-canvas
          ref={canvasRef}
          className={[
            "relative h-full min-h-0",
            pendingNodeDrag?.active ? "ring-2 ring-primary/30" : "",
          ].join(" ")}
        >
          {nodeLibraryCollapsed ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="absolute top-12 left-3 z-20 size-7 rounded-full bg-background/95 text-muted-foreground shadow-sm hover:text-foreground"
              onClick={() => setNodeLibraryCollapsed(false)}
              aria-label="展开节点库"
            >
              <PanelLeftOpenIcon className="size-3.5" />
            </Button>
          ) : null}
          <ReactFlow
            nodes={renderedNodes}
            edges={renderedEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            connectionLineComponent={WorkflowConnectionLine}
            connectionMode={ConnectionMode.Loose}
            connectionRadius={34}
            connectOnClick
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={setFlowInstance}
            onNodeClick={(event, node) => {
              event.stopPropagation()
              setSelectedNodeId(node.id)
              setSelectedEdgeId(null)
            }}
            onEdgeClick={(event, edge) => {
              event.stopPropagation()
              selectEdge(edge.id)
            }}
            onPaneClick={() => {
              setSelectedNodeId(null)
              setSelectedEdgeId(null)
            }}
            fitView
            fitViewOptions={fitViewOptions}
            minZoom={0.45}
            maxZoom={1.35}
          >
            <Background
              gap={24}
              size={0.8}
              color="hsl(var(--muted-foreground) / 0.035)"
              className="bg-[radial-gradient(circle_at_20%_10%,hsl(var(--primary)/0.02),transparent_30%),linear-gradient(180deg,hsl(var(--background)),hsl(var(--muted)/0.08))]"
            />
            <Controls
              className="!bottom-4 !left-4 overflow-hidden !rounded-xl !border !border-border/70 !bg-background/95 !shadow-lg"
              showInteractive={false}
            />
          </ReactFlow>
          <WorkflowValidationBadge errors={validation.errors} valid={validation.valid} />
          {propertyPanelNode || propertyPanelEdge ? (
            <aside
              className={[
                "absolute top-3 right-3 z-30 h-[calc(100%-1.5rem)] w-[min(380px,calc(100%-1.5rem))] overflow-hidden rounded-md border bg-background shadow-lg transition-all duration-200 ease-out",
                propertyPanelVisible
                  ? "translate-x-0 scale-100 opacity-100"
                  : "translate-x-3 scale-[0.98] opacity-0",
              ].join(" ")}
            >
              <ScrollArea className="h-full min-h-0">
                {propertyPanelNode ? (
                  <NodeConfigPanel
                    node={propertyPanelNode}
                    nodeSpec={propertyPanelNodeSpec}
                    availableVariables={propertyPanelAvailableVariables}
                    branchSummaries={propertyPanelBranchSummaries}
                    onChange={updateNodeData}
                  />
                ) : null}
                {propertyPanelEdge ? (
                  <EdgeConditionPanel
                    edge={propertyPanelEdge}
                    variables={propertyPanelEdgeVariables}
                    onChange={updateEdgeCondition}
                  />
                ) : null}
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
              </ScrollArea>
            </aside>
          ) : null}
          {pendingNodeDrag?.active ? (
            <div
              className="pointer-events-none fixed z-50 rounded-md border bg-background px-3 py-2 text-sm font-medium shadow-lg"
              style={{
                left: pendingNodeDrag.x + 12,
                top: pendingNodeDrag.y + 12,
              }}
            >
              {pendingNodeDrag.spec.title}
            </div>
          ) : null}
        </section>
      </div>
    </div>
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

function getEdgeConditionVariables(
  draft: ReturnType<typeof toDraft>,
  sourceNodeId: string,
  nodeSpecs: AIWorkflowNodeSpec[]
): WorkflowVariableRef[] {
  const variables = getAvailableVariables(draft, sourceNodeId, nodeSpecs)
  const sourceNode = draft.nodes.find((node) => node.id === sourceNodeId)
  if (!sourceNode) {
    return variables
  }
  const nodeType = sourceNode.data?.nodeType ?? sourceNode.type ?? ""
  const spec = getNodeSpec(nodeSpecs, nodeType)
  for (const output of spec?.outputSchema ?? []) {
    variables.push({
      nodeId: sourceNode.id,
      nodeName: sourceNode.data?.name ?? spec?.title ?? sourceNode.id,
      field: output.name,
      type: output.type,
      description: output.description ?? "",
    })
  }
  return variables
}

const conditionOperators = [
  { value: "eq", label: "等于" },
  { value: "neq", label: "不等于" },
  { value: "contains", label: "包含" },
  { value: "exists", label: "存在" },
  { value: "not_exists", label: "不存在" },
  { value: "truthy", label: "为真" },
  { value: "falsy", label: "为假" },
  { value: "gt", label: "大于" },
  { value: "gte", label: "大于等于" },
  { value: "lt", label: "小于" },
  { value: "lte", label: "小于等于" },
]

function getBranchSummaries(
  nodes: WorkflowFlowNode[],
  edges: WorkflowFlowEdge[],
  nodeId: string
): WorkflowBranchSummary[] {
  return edges
    .filter((edge) => edge.source === nodeId)
    .map((edge) => {
      const target = nodes.find((node) => node.id === edge.target)
      const condition = (edge.data as WorkflowEditorEdge["data"] | undefined)?.condition
      return {
        edgeId: edge.id,
        targetName: target?.data.name ?? target?.data.title ?? edge.target,
        conditionLabel: condition ? formatConditionLabel(condition) : "无条件匹配",
        isDefault: !condition,
      }
    })
}

function formatConditionLabel(condition: NonNullable<WorkflowEdgeCondition>) {
  const left = condition.left?.nodeId && condition.left.field
    ? `${condition.left.nodeId}.${condition.left.field}`
    : "未选择变量"
  const operator = conditionOperators.find((item) => item.value === condition.operator)?.label
    ?? condition.operator
    ?? "未选择判断方式"

  if (["exists", "not_exists", "truthy", "falsy"].includes(condition.operator ?? "")) {
    return `${left} ${operator}`
  }

  return `${left} ${operator} ${formatConditionRight(condition.right)}`
}

function formatConditionRight(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return "未填写比较值"
  }
  if (typeof value === "object") {
    return JSON.stringify(value)
  }
  return String(value)
}

function EdgeConditionPanel({
  edge,
  variables,
  onChange,
}: {
  edge: WorkflowFlowEdge
  variables: WorkflowVariableRef[]
  onChange: (edgeId: string, condition?: WorkflowEdgeCondition) => void
}) {
  const condition = (edge.data as WorkflowEditorEdge["data"] | undefined)?.condition
  const [left, setLeft] = useState<WorkflowVariableSelector | undefined>(condition?.left)
  const [operator, setOperator] = useState(condition?.operator ?? "eq")
  const [right, setRight] = useState(condition?.right === undefined ? "" : String(condition.right))

  const commit = (next?: {
    left?: WorkflowVariableSelector
    operator?: string
    right?: string
  }) => {
    const nextLeft = next?.left ?? left
    const nextOperator = next?.operator ?? operator
    const nextRight = next?.right ?? right
    if (!nextLeft?.nodeId || !nextLeft.field || !nextOperator) {
      return
    }
    onChange(edge.id, {
      left: nextLeft,
      operator: nextOperator,
      right: normalizeConditionRight(nextRight),
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4">
      <div>
        <div className="text-sm font-medium">分支条件</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {edge.source} {"->"} {edge.target}
        </div>
      </div>
      <div className="space-y-2">
        <Label>左侧变量</Label>
        <VariableSelector
          value={left}
          variables={variables}
          onChange={(value) => {
            setLeft(value)
            commit({ left: value })
          }}
        />
      </div>
      <div className="space-y-2">
        <Label>判断方式</Label>
        <OptionCombobox
          value={operator}
          options={conditionOperators}
          placeholder="选择判断方式"
          searchPlaceholder="搜索判断方式"
          emptyText="没有可用判断方式"
          onChange={(value) => {
            setOperator(value)
            commit({ operator: value })
          }}
        />
      </div>
      {!["exists", "not_exists", "truthy", "falsy"].includes(operator) ? (
        <div className="space-y-2">
          <Label htmlFor="workflow-edge-condition-right">比较值</Label>
          <Input
            id="workflow-edge-condition-right"
            value={right}
            onChange={(event) => setRight(event.target.value)}
            onBlur={() => commit({ right })}
          />
        </div>
      ) : null}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => commit()}>
          保存条件
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(edge.id, undefined)}>
          设为默认分支
        </Button>
      </div>
      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
        没有条件的边会作为默认分支；同一节点存在条件边时，建议保留一条默认分支。
      </div>
    </div>
  )
}

function normalizeConditionRight(value: string) {
  const trimmed = value.trim()
  if (trimmed === "true") return true
  if (trimmed === "false") return false
  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) return Number(trimmed)
  return trimmed
}

function WorkflowConnectionLine({ fromX, fromY, toX, toY }: ConnectionLineComponentProps) {
  const [edgePath] = getBezierPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: Position.Right,
    targetX: toX,
    targetY: toY,
    targetPosition: Position.Left,
    curvature: 0.18,
  })

  return (
    <g>
      <path
        fill="none"
        stroke="hsl(var(--primary) / 0.72)"
        strokeDasharray="6 5"
        strokeLinecap="round"
        strokeWidth={2}
        d={edgePath}
      />
      <circle cx={toX} cy={toY} r={4} fill="hsl(var(--primary))" />
    </g>
  )
}

function WorkflowCanvasEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
  markerEnd,
}: EdgeProps<WorkflowFlowEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.18,
  })
  const condition = (data as WorkflowEditorEdge["data"] | undefined)?.condition
  const edgeData = data as WorkflowEdgeRenderData | undefined
  const active = selected || edgeData?.active

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={cn(
          "transition-all",
          active ? "!stroke-primary !stroke-[2.4px]" : "!stroke-muted-foreground/45 !stroke-[1.8px]"
        )}
      />
      {condition ? (
        <EdgeLabelRenderer>
          <div
            role="button"
            tabIndex={0}
            aria-label="选择条件连接线"
            className={cn(
              "nodrag nopan pointer-events-auto absolute inline-flex -translate-x-1/2 -translate-y-1/2 cursor-pointer select-none items-center rounded-md border px-2 py-1 text-[11px] font-medium shadow-sm backdrop-blur transition-all",
              active
                ? "border-primary bg-primary text-primary-foreground shadow-md"
                : "border-border/80 bg-background/95 text-muted-foreground hover:border-primary/60 hover:text-foreground"
            )}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            onClick={(event) => {
              event.stopPropagation()
              edgeData?.onSelect?.(id)
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") {
                return
              }
              event.preventDefault()
              event.stopPropagation()
              edgeData?.onSelect?.(id)
            }}
          >
            条件
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}

function WorkflowNodeHandle({
  type,
  position,
  className,
}: {
  type: "source" | "target"
  position: Position
  className?: string
}) {
  return (
    <Handle
      type={type}
      position={position}
      className={className}
    >
      <PlusIcon className="size-2.5" />
    </Handle>
  )
}

function WorkflowAddAfterButton({
  nodeId,
  visible,
  className,
  nodeSpecs,
  onAddAfter,
}: {
  nodeId: string
  visible: boolean
  className?: string
  nodeSpecs?: AIWorkflowNodeSpec[]
  onAddAfter?: (sourceNodeId: string, spec: AIWorkflowNodeSpec) => void
}) {
  if (!nodeSpecs?.length || !onAddAfter) {
    return null
  }
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "absolute z-20 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-150",
              visible ? "opacity-100" : "pointer-events-none opacity-0",
              className
            )}
            aria-label="添加下游节点"
          >
            <PlusIcon className="size-3" />
          </button>
        }
      />
      <PopoverContent side="right" align="center" className="w-72 p-2">
        <div className="px-2 pb-2 text-xs font-medium text-muted-foreground">添加下游节点</div>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {nodeSpecs.map((spec) => (
            <button
              key={spec.type}
              type="button"
              className="flex w-full rounded-md px-2 py-2 text-left hover:bg-muted"
              onClick={() => onAddAfter(nodeId, spec)}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{spec.title}</span>
                <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {spec.description}
                </span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function WorkflowCanvasNode({ id, data, selected }: NodeProps<WorkflowFlowNode>) {
  const [hovered, setHovered] = useState(false)
  const missingInputs = data.missingInputs ?? []
  const hasIssue = missingInputs.length > 0
  const isConditionNode = data.nodeType === "condition"
  const nodeSpecs = data.nodeSpecs as AIWorkflowNodeSpec[] | undefined
  const onAddAfter = data.onAddAfter as
    | ((sourceNodeId: string, spec: AIWorkflowNodeSpec) => void)
    | undefined
  const showHandles = selected || hovered
  const handleClassName = cn(
    "!size-4 !rounded-full !border-0 !bg-primary !text-primary-foreground !shadow-lg",
    "flex items-center justify-center opacity-0 transition-all duration-150",
    showHandles ? "pointer-events-auto opacity-100" : "pointer-events-none"
  )
  if (isConditionNode) {
    return (
      <div
        className="group/node relative flex size-36 items-center justify-center"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className={[
            "absolute inset-4 rotate-45 rounded-xl border bg-background shadow-[0_10px_30px_rgba(15,23,42,0.08)] transition-all",
            selected ? "border-primary ring-4 ring-primary/10" : "",
            hasIssue ? "border-destructive/70" : "border-border/70",
          ].join(" ")}
        />
        <WorkflowNodeHandle
          type="target"
          position={Position.Left}
          className={cn("!left-0", handleClassName)}
        />
        <div className="relative z-10 flex max-w-24 flex-col items-center text-center">
          {hasIssue ? (
            <AlertCircleIcon className="mb-1 size-4 text-destructive" />
          ) : (
            <CheckCircle2Icon className="mb-1 size-4 text-emerald-600" />
          )}
          <div className="line-clamp-2 text-sm font-medium leading-tight">{data.name ?? data.title}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">分支</div>
        </div>
        <WorkflowNodeHandle
          type="source"
          position={Position.Right}
          className={cn("!right-0", handleClassName)}
        />
        <WorkflowAddAfterButton
          nodeId={id}
          visible={showHandles}
          className="right-4 top-4"
          nodeSpecs={nodeSpecs}
          onAddAfter={onAddAfter}
        />
      </div>
    )
  }
  return (
    <div
      className={[
        "group/node relative w-52 overflow-hidden rounded-xl border bg-background shadow-[0_12px_34px_rgba(15,23,42,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(15,23,42,0.12)]",
        selected ? "border-primary ring-4 ring-primary/10" : "",
        hasIssue ? "border-destructive/70" : "border-border/70",
      ].join(" ")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <WorkflowNodeHandle
        type="target"
        position={Position.Left}
        className={cn("!-left-2.5", handleClassName)}
      />
      <div className="flex items-start gap-2 border-b border-border/60 bg-muted/20 px-3 py-2.5">
        <div
          className={cn(
            "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg",
            hasIssue ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-700"
          )}
        >
          {hasIssue ? (
            <AlertCircleIcon className="size-4" />
          ) : (
            <CheckCircle2Icon className="size-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{data.name ?? data.title}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{data.title}</div>
        </div>
      </div>
      <div className="space-y-2 px-3 py-2.5 text-xs">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="rounded-full bg-muted px-2 py-0.5">输入 {data.inputCount ?? 0}</span>
          <span className="rounded-full bg-muted px-2 py-0.5">输出 {data.outputCount ?? 0}</span>
        </div>
        {hasIssue ? (
          <div className="rounded-md bg-destructive/10 px-2 py-1.5 text-destructive">
            缺少输入：{missingInputs.join("、")}
          </div>
        ) : (
          <div className="rounded-md bg-emerald-500/10 px-2 py-1.5 text-emerald-700">
            配置完整
          </div>
        )}
      </div>
      <WorkflowNodeHandle
        type="source"
        position={Position.Right}
        className={cn("!-right-2.5", handleClassName)}
      />
      <WorkflowAddAfterButton
        nodeId={id}
        visible={showHandles}
        className="right-2 top-2"
        nodeSpecs={nodeSpecs}
        onAddAfter={onAddAfter}
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
