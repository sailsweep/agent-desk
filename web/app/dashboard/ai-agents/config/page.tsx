"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"

import { AIAgentConfigWorkbench } from "../_components/config-workbench"

function readAgentIdFromLocation() {
  if (typeof window === "undefined") return 0
  return Number(new URLSearchParams(window.location.search).get("agentId"))
}

export default function DashboardAIAgentConfigPage() {
  const router = useRouter()
  const [agentId] = useState(() => readAgentIdFromLocation())

  return (
    <div className="h-[calc(100vh-var(--header-height))] min-h-0">
      <AIAgentConfigWorkbench
        agentId={agentId}
        onClose={() => router.push("/dashboard/ai-agents")}
      />
    </div>
  )
}
