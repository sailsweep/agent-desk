"use client"

import "@xyflow/react/dist/style.css"

import {
  addEdge,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react"
import { PlusIcon } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import type { AIWorkflowDefinition, AIWorkflowNodeSpec } from "@/lib/api/admin"
import {
  fromApiDefinition,
  toApiDefinition,
  validateWorkflowDraft,
  type WorkflowEditorEdge,
  type WorkflowEditorNode,
} from "./workflow-utils"
import { NodeConfigPanel } from "./node-config-panel"

type WorkflowNodeData = Record<string, unknown> & {
  nodeType?: string
  name?: string
  config?: Record<string, unknown>
  label?: string
}

type WorkflowFlowNode = Node<WorkflowNodeData>
type WorkflowFlowEdge = Edge

function toFlowNodes(definition: AIWorkflowDefinition): WorkflowFlowNode[] {
  return fromApiDefinition(definition).nodes.map((node) => ({
    id: node.id,
    type: "default",
    position: node.position,
    data: {
      nodeType: node.data?.nodeType ?? node.type,
      name: node.data?.name ?? node.id,
      label: node.data?.name ?? node.type ?? node.id,
      config: node.data?.config ?? {},
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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  )
  const validation = useMemo(() => validateWorkflowDraft(toDraft(nodes, edges)), [nodes, edges])

  useEffect(() => {
    onDefinitionChange(toApiDefinition(toDraft(nodes, edges)) as AIWorkflowDefinition)
  }, [edges, nodes, onDefinitionChange])

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((current) => {
        let nextIndex = current.length + 1
        let id = `edge_${connection.source}_${connection.target}_${nextIndex}`
        while (current.some((edge) => edge.id === id)) {
          nextIndex += 1
          id = `edge_${connection.source}_${connection.target}_${nextIndex}`
        }
        return addEdge(
          {
            ...connection,
            id,
          },
          current
        )
      })
    },
    [setEdges]
  )

  const addNode = (spec: AIWorkflowNodeSpec) => {
    setNodes((current) => {
      let nextIndex = current.length + 1
      let id = `${spec.type}_${nextIndex}`
      while (current.some((node) => node.id === id)) {
        nextIndex += 1
        id = `${spec.type}_${nextIndex}`
      }
      return [
        ...current,
        {
          id,
          type: "default",
          position: { x: 120 + current.length * 28, y: 100 + current.length * 24 },
          data: {
            nodeType: spec.type,
            name: spec.title,
            label: spec.title,
            config: {},
          },
        },
      ]
    })
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
          <div className="mb-3 text-sm font-medium">Nodes</div>
          <div className="space-y-2">
            {nodeSpecs.map((spec) => (
              <button
                key={spec.type}
                type="button"
                onClick={() => addNode(spec)}
                className="flex w-full items-start gap-2 rounded-md border bg-background px-3 py-2 text-left text-sm hover:bg-muted"
              >
                <PlusIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{spec.title}</span>
                  <span className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {spec.description}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </aside>
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize="56%" minSize="30%" className="min-h-0">
        <section className="relative h-full min-h-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedNodeId(node.id)}
            fitView
          >
            <Background />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
          <div className="absolute left-3 top-3 flex gap-2">
            <Badge variant={validation.valid ? "default" : "destructive"}>
              {validation.valid ? "Valid draft" : `${validation.errors.length} issues`}
            </Badge>
          </div>
        </section>
      </ResizablePanel>
      <ResizablePanel defaultSize="26%" minSize="18%" maxSize="40%" className="min-h-0">
        <aside className="h-full min-h-0 overflow-y-auto border-l bg-muted/10">
          <NodeConfigPanel node={selectedNode} onChange={updateNodeData} />
          {!validation.valid ? (
            <div className="border-t p-4">
              <div className="mb-2 text-sm font-medium">Local validation</div>
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
              Sync definition
            </Button>
          </div>
        </aside>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}
