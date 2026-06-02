package i18nx

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestNormalizeLocale(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		in   string
		want string
	}{
		{name: "default for blank", in: "", want: LocaleEnUS},
		{name: "exact chinese", in: "zh-CN", want: LocaleZhCN},
		{name: "underscore chinese", in: "zh_CN", want: LocaleZhCN},
		{name: "short chinese", in: "zh", want: LocaleZhCN},
		{name: "exact english", in: "en-US", want: LocaleEnUS},
		{name: "underscore english", in: "en_US", want: LocaleEnUS},
		{name: "short english", in: "en", want: LocaleEnUS},
		{name: "unsupported falls back", in: "fr-FR", want: LocaleEnUS},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := NormalizeLocale(tt.in); got != tt.want {
				t.Fatalf("NormalizeLocale(%q) = %q, want %q", tt.in, got, tt.want)
			}
		})
	}
}

func TestResolveLocaleFromHeaders(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "/api/dashboard/user/list", nil)
	req.Header.Set("Accept-Language", "fr-FR, en-US;q=0.9, zh-CN;q=0.8")

	if got := ResolveRequestLocale(req); got != LocaleEnUS {
		t.Fatalf("ResolveRequestLocale() = %q, want %q", got, LocaleEnUS)
	}
}

func TestResolveLocalePrefersXLocale(t *testing.T) {
	t.Parallel()

	req := httptest.NewRequest(http.MethodGet, "/api/dashboard/user/list", nil)
	req.Header.Set("X-Locale", "en-US")
	req.Header.Set("Accept-Language", "zh-CN")

	if got := ResolveRequestLocale(req); got != LocaleEnUS {
		t.Fatalf("ResolveRequestLocale() = %q, want %q", got, LocaleEnUS)
	}
}

func TestTranslateFallsBackToEnglish(t *testing.T) {
	t.Parallel()

	if got := TLocale(LocaleEnUS, "error.auth.expired", nil); got != "Your session has expired. Please sign in again." {
		t.Fatalf("english translation = %q", got)
	}
	if got := TLocale("fr-FR", "error.auth.expired", nil); got != "Your session has expired. Please sign in again." {
		t.Fatalf("fallback translation = %q", got)
	}
}

func TestTranslateKnownMessageSupportsFormattedMessages(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		message string
		want    string
	}{
		{
			name:    "batch limit",
			message: "单次最多生成 31 条排班",
			want:    "You can generate at most 31 schedule entries at a time.",
		},
		{
			name:    "start date",
			message: "开始时间格式错误，请使用 yyyy-MM-dd",
			want:    "Invalid start time format. Use yyyy-MM-dd.",
		},
		{
			name:    "end date time",
			message: "结束时间格式错误，请使用 yyyy-MM-dd HH:mm:ss 或 RFC3339",
			want:    "Invalid end time format. Use yyyy-MM-dd HH:mm:ss or RFC3339.",
		},
		{
			name:    "oidc issuer config",
			message: "OIDC issuer 未配置",
			want:    "OIDC issuer is not configured.",
		},
		{
			name:    "oidc login result",
			message: "登录结果不能为空",
			want:    "Sign-in result is required.",
		},
		{
			name:    "directory not found",
			message: "目录不存在",
			want:    "Directory not found.",
		},
		{
			name:    "directory has docs",
			message: "该目录下存在文档，无法删除",
			want:    "This directory contains documents and cannot be deleted.",
		},
		{
			name:    "move documents",
			message: "请选择要移动的文档",
			want:    "Select documents to move.",
		},
		{
			name:    "move faqs across knowledge bases",
			message: "只能移动当前知识库下的FAQ",
			want:    "Only FAQs in the current knowledge base can be moved.",
		},
		{
			name:    "single knowledge base reference",
			message: "知识库已被 AI Agent「SalesBot」引用，请先解除绑定",
			want:    "This knowledge base is referenced by AI Agent \"SalesBot\". Remove the binding first.",
		},
		{
			name:    "multiple knowledge base references",
			message: "知识库已被 3 个 AI Agent 引用，请先解除绑定",
			want:    "This knowledge base is referenced by 3 AI Agents. Remove the bindings first.",
		},
		{
			name:    "schedule conflict range",
			message: "该客服组在 2026-06-02 09:00:00 至 2026-06-02 10:00:00 已存在排班",
			want:    "This agent team already has a schedule from 2026-06-02 09:00:00 to 2026-06-02 10:00:00.",
		},
		{
			name:    "faq import duplicated question",
			message: "同一文件中标准问题重复，首次出现于第12行",
			want:    "The standard question is duplicated in the same file. It first appeared on row 12.",
		},
		{
			name:    "faq import existing question",
			message: "标准问题已存在，已跳过",
			want:    "The standard question already exists and was skipped.",
		},
		{
			name:    "required param",
			message: "参数：name不能为空",
			want:    "Parameter \"name\" is required.",
		},
		{
			name:    "mcp call failed",
			message: "调用 MCP 工具失败: timeout",
			want:    "Failed to call MCP tool: timeout",
		},
		{
			name:    "wxwork unsupported outbound",
			message: "当前暂不支持企业微信下行消息类型: voice",
			want:    "The current WeCom outbound message type is not supported yet: voice",
		},
		{
			name:    "wxwork callback missing",
			message: "企业微信登录回调地址未配置",
			want:    "WeCom sign-in callback URL is not configured.",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := TranslateKnownMessage(LocaleEnUS, tt.message); got != tt.want {
				t.Fatalf("TranslateKnownMessage() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestTranslateKnownMessageKeepsChineseLocale(t *testing.T) {
	t.Parallel()

	message := "目录不存在"
	if got := TranslateKnownMessage(LocaleZhCN, message); got != message {
		t.Fatalf("TranslateKnownMessage() = %q, want %q", got, message)
	}
}

func TestMiddlewareStoresLocale(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(Middleware())
	router.GET("/ping", func(ctx *gin.Context) {
		ctx.String(http.StatusOK, Locale(ctx))
	})

	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.Header.Set("X-Locale", "en-US")
	recorder := httptest.NewRecorder()

	router.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", recorder.Code, http.StatusOK)
	}
	if got := recorder.Body.String(); got != LocaleEnUS {
		t.Fatalf("middleware locale = %q, want %q", got, LocaleEnUS)
	}
}
