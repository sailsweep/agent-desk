"use client"

import { SignJWT } from "jose"
import { CheckIcon, CopyIcon } from "lucide-react"
import { useEffect, useMemo, useState } from "react"

import type { KefuWidgetHostConfig } from "@/lib/kefu-widget-config"

const STORAGE_KEY = "cs-agent-web-widget-test-config"
const DEFAULT_JWT_TTL_MINUTES = "30"
const INITIAL_CONFIG: KefuWidgetHostConfig = {
  channelId: "",
  baseUrl: "",
  apiBaseUrl: "",
}

type AuthMode = "guest" | "jwt"

type WidgetDemoConfig = KefuWidgetHostConfig & {
  authMode?: AuthMode
  jwtSecret?: string
  jwtUserId?: string
  jwtName?: string
  jwtTtlMinutes?: string
}

declare global {
  interface Window {
    CSAgentWidget?: {
      mount: (config: KefuWidgetHostConfig) => void
      destroy: () => void
      open: () => Promise<void>
      close: () => void
      getChatUrl: () => Promise<string>
    }
  }
}

function getDefaultConfig(): WidgetDemoConfig {
  if (typeof window === "undefined") {
    return INITIAL_CONFIG
  }

  const savedText = window.localStorage.getItem(STORAGE_KEY)
  const savedConfig = savedText
    ? (JSON.parse(savedText) as Partial<WidgetDemoConfig>)
    : {}
  const query = new URLSearchParams(window.location.search)

  return {
    channelId: query.get("channelId") ?? savedConfig.channelId ?? "",
    baseUrl: "",
    apiBaseUrl: "",
    authMode: (query.get("authMode") as AuthMode | null) ?? savedConfig.authMode ?? "guest",
    jwtSecret: savedConfig.jwtSecret ?? "",
    jwtUserId: query.get("userId") ?? savedConfig.jwtUserId ?? "demo-user-001",
    jwtName: query.get("name") ?? savedConfig.jwtName ?? "测试用户",
    jwtTtlMinutes: savedConfig.jwtTtlMinutes ?? DEFAULT_JWT_TTL_MINUTES,
  }
}

function removeMountedWidget() {
  if (typeof window === "undefined") {
    return
  }

  window.CSAgentWidget?.destroy()
  document
    .querySelectorAll(
      '[data-cs-agent-widget="launcher"], [data-cs-agent-widget="frame"], [data-cs-agent-widget="script"]'
    )
    .forEach((node) => node.remove())

  delete window.CSAgentConfig
  delete window.__CS_AGENT_WIDGET_CONFIG__
  delete window.__CS_AGENT_WIDGET_STATE__
  delete window.CSAgentWidget
}

function injectWidget(config: KefuWidgetHostConfig) {
  removeMountedWidget()
  window.CSAgentConfig = config

  const script = document.createElement("script")
  script.async = true
  script.src = `${window.location.origin}/sdk/cs-ai-agent-sdk.min.js`
  script.dataset.csAgentWidget = "script"
  document.body.appendChild(script)
}

function buildWidgetConfig(config: WidgetDemoConfig): KefuWidgetHostConfig {
  const nextConfig: KefuWidgetHostConfig = {
    channelId: config.channelId.trim(),
    baseUrl: "",
    apiBaseUrl: "",
  }
  if (config.authMode === "jwt") {
    nextConfig.getUserToken = () => signUserToken(config)
  }
  return nextConfig
}

async function signUserToken(config: WidgetDemoConfig) {
  const userId = (config.jwtUserId || "").trim()
  const name = (config.jwtName || "").trim()
  const secret = (config.jwtSecret || "").trim()
  const ttl = Number(config.jwtTtlMinutes || DEFAULT_JWT_TTL_MINUTES)

  if (!userId) {
    throw new Error("请填写 userId")
  }
  if (!name) {
    throw new Error("请填写用户名称")
  }
  if (!secret) {
    throw new Error("请填写 JWT Secret")
  }
  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new Error("有效期必须大于 0")
  }

  return new SignJWT({ userId, name })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${ttl}m`)
    .sign(new TextEncoder().encode(secret))
}

export function KefuWidgetDemo() {
  const [config, setConfig] = useState<WidgetDemoConfig>({
    ...INITIAL_CONFIG,
    authMode: "guest",
    jwtSecret: "",
    jwtUserId: "demo-user-001",
    jwtName: "测试用户",
    jwtTtlMinutes: DEFAULT_JWT_TTL_MINUTES,
  })
  const [status, setStatus] = useState("请填写 channelId")
  const [origin, setOrigin] = useState("")
  const [generatedToken, setGeneratedToken] = useState("")
  const [latestDirectChatUrl, setLatestDirectChatUrl] = useState("")
  const [copied, setCopied] = useState(false)
  const [snippetCopied, setSnippetCopied] = useState(false)

  async function mountWidget(configToMount: WidgetDemoConfig) {
    const cleanConfig = {
      ...configToMount,
      channelId: configToMount.channelId.trim(),
      baseUrl: "",
      apiBaseUrl: "",
      getUserToken: undefined,
    }
    const nextConfig = buildWidgetConfig(cleanConfig)
    setConfig(cleanConfig)
    setGeneratedToken("")
    setLatestDirectChatUrl("")
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanConfig))

    if (!nextConfig.channelId) {
      removeMountedWidget()
      setStatus("请填写 channelId")
      return
    }

    injectWidget(nextConfig)
    setStatus(
      cleanConfig.authMode === "jwt"
        ? "Widget 已挂载：JWT 用户模式"
        : "Widget 已挂载：访客模式"
    )
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const initialConfig = getDefaultConfig()
      setOrigin(window.location.origin)
      setConfig(initialConfig)
      setStatus(initialConfig.channelId ? "Widget 已挂载" : "请填写 channelId")

      if (initialConfig.channelId) {
        void mountWidget(initialConfig).catch((error) => {
          removeMountedWidget()
          setGeneratedToken("")
          setStatus(error instanceof Error ? error.message : "挂载 Widget 失败")
        })
      }
    }, 0)

    return () => {
      window.clearTimeout(timer)
      removeMountedWidget()
    }
  }, [])

  const snippet = useMemo(() => {
    const scriptSrc = origin
      ? `${origin}/sdk/cs-ai-agent-sdk.min.js`
      : "/sdk/cs-ai-agent-sdk.min.js"

    const configLines = [`    channelId: "${config.channelId || ""}"`]
    if (config.authMode === "jwt") {
      configLines.push(`    async getUserToken() {
      const res = await fetch("/api/kefu/user-token", { credentials: "include" });
      const data = await res.json();
      return data.userToken;
    }`)
    }

    return `<script>
  window.CSAgentConfig = {
${configLines.join(",\n")}
  };
</script>
<script async src="${scriptSrc}"></script>`
  }, [config.authMode, config.channelId, origin])

  function updateField<K extends keyof WidgetDemoConfig>(
    key: K,
    value: WidgetDemoConfig[K]
  ) {
    setConfig((current) => ({ ...current, [key]: value }))
  }

  async function handleMount() {
    try {
      await mountWidget(config)
    } catch (error) {
      removeMountedWidget()
      setGeneratedToken("")
      setStatus(error instanceof Error ? error.message : "挂载 Widget 失败")
    }
  }

  async function handleCopyDirectUrl() {
    if (!window.CSAgentWidget || typeof navigator === "undefined") {
      return
    }
    try {
      const url = await window.CSAgentWidget.getChatUrl()
      setLatestDirectChatUrl(url)
      if (config.authMode === "jwt") {
        setGeneratedToken(new URL(url).searchParams.get("userToken") || "")
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "生成客服链接失败")
    }
  }

  async function handleOpenDirectChat() {
    if (!window.CSAgentWidget) {
      return
    }
    try {
      const url = await window.CSAgentWidget.getChatUrl()
      setLatestDirectChatUrl(url)
      if (config.authMode === "jwt") {
        setGeneratedToken(new URL(url).searchParams.get("userToken") || "")
      }
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "生成客服链接失败")
    }
  }

  async function handleCopySnippet() {
    if (typeof navigator === "undefined") {
      return
    }
    await navigator.clipboard.writeText(snippet)
    setSnippetCopied(true)
    window.setTimeout(() => setSnippetCopied(false), 1600)
  }

  return (
    <main className="min-h-svh bg-slate-50 px-6 py-8 text-slate-950">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-base font-semibold">Widget 挂载测试</div>
          <div className="mt-1 text-sm text-slate-500">{status}</div>

          <div className="mt-5 grid gap-3">
            <TextField
              label="channelId"
              value={config.channelId}
              onChange={(value) => updateField("channelId", value)}
            />
            <SegmentedControl
              label="鉴权模式"
              value={config.authMode || "guest"}
              onChange={(value) => updateField("authMode", value)}
              options={[
                { label: "访客", value: "guest" },
                { label: "JWT 用户", value: "jwt" },
              ]}
            />
            {config.authMode === "jwt" ? (
              <div className="grid gap-3 rounded-md border border-slate-200 p-3">
                <TextField
                  label="userId"
                  value={config.jwtUserId}
                  onChange={(value) => updateField("jwtUserId", value)}
                />
                <TextField
                  label="name"
                  value={config.jwtName}
                  onChange={(value) => updateField("jwtName", value)}
                />
                <TextField
                  label="JWT Secret"
                  value={config.jwtSecret}
                  onChange={(value) => updateField("jwtSecret", value)}
                  type="password"
                />
                <TextField
                  label="有效期（分钟）"
                  value={config.jwtTtlMinutes}
                  onChange={(value) => updateField("jwtTtlMinutes", value)}
                  type="number"
                />
              </div>
            ) : null}
          </div>

          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => void handleMount()}
              className="rounded-md bg-slate-950 px-4 py-2 text-sm font-medium text-white"
            >
              挂载
            </button>
            <button
              type="button"
              onClick={() => {
                removeMountedWidget()
                setStatus("Widget 已卸载")
              }}
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium"
            >
              卸载
            </button>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-base font-semibold">接入代码</div>
          {config.authMode === "jwt" ? (
            <div className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              当前页面仅用于本地模拟。正式接入时，userToken 应由业务系统后端签发。
            </div>
          ) : null}
          <div className="relative mt-4">
            <button
              type="button"
              onClick={() => void handleCopySnippet()}
              className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-md border border-white/10 bg-white/10 text-slate-200 transition hover:bg-white/20 hover:text-white"
              aria-label={snippetCopied ? "已复制接入代码" : "复制接入代码"}
              title={snippetCopied ? "已复制" : "复制代码"}
            >
              {snippetCopied ? (
                <CheckIcon className="size-4" />
              ) : (
                <CopyIcon className="size-4" />
              )}
            </button>
            <pre className="overflow-x-auto rounded-md bg-slate-950 p-4 pr-12 text-xs leading-5 text-slate-100">
              <code>{snippet}</code>
            </pre>
          </div>
          <div className="mt-5">
            <div className="text-sm font-medium text-slate-700">直接访问客户对话</div>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                readOnly
                value={latestDirectChatUrl || "点击复制或新窗口打开时生成最新链接"}
                className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 px-3 font-mono text-xs outline-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!config.channelId}
                  onClick={() => void handleCopyDirectUrl()}
                  className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {copied ? "已复制" : "复制"}
                </button>
                <button
                  type="button"
                  disabled={!config.channelId}
                  onClick={() => void handleOpenDirectChat()}
                  className="rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  新窗口打开
                </button>
              </div>
            </div>
          </div>
          {generatedToken ? (
            <div className="mt-4">
              <div className="text-sm font-medium text-slate-700">当前 userToken</div>
              <textarea
                readOnly
                value={generatedToken}
                className="mt-2 h-28 w-full resize-none rounded-md border border-slate-200 p-3 font-mono text-xs outline-none"
              />
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string
  value?: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        type={type}
        value={value || ""}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-slate-400"
      />
    </label>
  )
}

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Array<{ label: string; value: T }>
  onChange: (value: T) => void
}) {
  return (
    <div className="grid gap-1.5 text-sm">
      <div className="font-medium text-slate-700">{label}</div>
      <div className="grid grid-cols-2 rounded-md border border-slate-200 bg-slate-100 p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={
              option.value === value
                ? "rounded bg-white px-3 py-1.5 text-sm font-medium shadow-sm"
                : "rounded px-3 py-1.5 text-sm text-slate-600"
            }
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
