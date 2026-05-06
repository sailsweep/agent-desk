export type KefuWidgetHostConfig = {
  channelId: string
  baseUrl: string
  apiBaseUrl?: string
  /** 外部访客稳定标识；未传时使用浏览器本地访客 ID */
  externalId?: string
  /** 访客展示名，仅用于首次换取客服会话 token */
  externalName?: string
  /** 打开客服前按需获取业务系统签发的前台用户 JWT */
  getUserToken?: () => string | Promise<string>
  title?: string
  subtitle?: string
  position?: "left" | "right"
  themeColor?: string
  width?: string
}

export type KefuWidgetRuntimeConfig = Omit<KefuWidgetHostConfig, "getUserToken"> & {
  /** 仅用于 /kefu/chat 运行时换取客服会话 token，不属于 CSAgentConfig 接入参数 */
  userToken?: string
}

declare global {
  interface Window {
    CSAgentConfig?: KefuWidgetHostConfig
    __CS_AGENT_WIDGET_CONFIG__?: KefuWidgetRuntimeConfig
    __CS_AGENT_WIDGET_STATE__?: unknown
  }
}

export function readKefuWidgetConfig(): KefuWidgetRuntimeConfig {
  if (typeof window === "undefined") {
    return {
      channelId: "",
      baseUrl: "",
      apiBaseUrl: "",
    }
  }

  const query = new URLSearchParams(window.location.search)
  const fallback: KefuWidgetRuntimeConfig = {
    channelId:
      query.get("channelId") ??
      process.env.NEXT_PUBLIC_OPEN_IM_CHANNEL_ID?.trim() ??
      "",
    baseUrl:
      query.get("baseUrl") ??
      process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ??
      window.location.origin,
    apiBaseUrl:
      query.get("apiBaseUrl") ??
      process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ??
      undefined,
    externalId: query.get("externalId") ?? undefined,
    externalName: query.get("externalName") ?? undefined,
    userToken: query.get("userToken") ?? undefined,
    title: query.get("title") ?? undefined,
    subtitle: query.get("subtitle") ?? undefined,
    position: (query.get("position") as "left" | "right" | null) ?? undefined,
    themeColor: query.get("themeColor") ?? undefined,
    width: query.get("width") ?? undefined,
  }

  if (window.__CS_AGENT_WIDGET_CONFIG__) {
    return window.__CS_AGENT_WIDGET_CONFIG__
  }
  if (window.CSAgentConfig) {
    const { getUserToken: _getUserToken, ...hostConfig } = window.CSAgentConfig
    return {
      ...fallback,
      ...hostConfig,
    }
  }
  return fallback
}

export function setKefuWidgetConfig(config: KefuWidgetRuntimeConfig) {
  if (typeof window === "undefined") {
    return
  }
  window.__CS_AGENT_WIDGET_CONFIG__ = config
}
