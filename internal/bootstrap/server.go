package bootstrap

import (
	"log/slog"
	"net/http"
	"strings"
	"time"

	"cs-agent/internal/ai/mcps"
	_ "cs-agent/internal/ai/runtime"
	"cs-agent/internal/middleware"
	"cs-agent/internal/pkg/config"
	"cs-agent/internal/pkg/ginx"
	"cs-agent/internal/pkg/httpx"
	"cs-agent/internal/services"
	webspa "cs-agent/web"

	"github.com/gin-gonic/gin"
	"github.com/mlogclub/simple/web"

	_ "cs-agent/internal/services/wx_callback_handlers"
)

func NewServer() (*gin.Engine, error) {
	cfg := config.Current()

	gin.SetMode(gin.ReleaseMode)

	app := gin.New()
	app.Use(corsMiddleware())
	app.Use(gin.Recovery())
	app.Use(requestLogMiddleware())
	app.Use(maxBodySizeMiddleware(cfg.Storage.MaxRequestBodySizeBytes()))

	addRouter(app)

	notFoundPrefixes := []string{"/api/"}
	if baseURL := strings.TrimRight(cfg.Storage.Local.BaseURL, "/"); baseURL != "" {
		notFoundPrefixes = append(notFoundPrefixes, baseURL+"/")
	}
	app.StaticFS(cfg.Storage.Local.BaseURL, ginx.StaticFiles(cfg.Storage.Local.Root))
	ginx.HandleSPA(app, ginx.SPAOptions{
		Root:         "./web/out",
		EmbeddedFS:   webspa.SPA,
		EmbeddedRoot: "out",
		DirOptions: ginx.DirOptions{
			ShowList:  false,
			SPA:       true,
			IndexName: "index.html",
		},
		NotFoundPrefixes: notFoundPrefixes,
		NotFoundHandler: func(ctx *gin.Context) {
			httpx.WriteHttpStatusJSON(ctx, http.StatusNotFound, web.JsonErrorCode(http.StatusNotFound, "Not found"))
		},
	})

	return app, nil
}

func corsMiddleware() gin.HandlerFunc {
	allowHeaders := "Origin, Content-Type, Accept, Authorization, X-Requested-With, X-Guest-Id, X-Channel-Id, X-External-Id, X-External-Name, X-Customer-Session-Token, X-Customer-Session-Expires-At"
	exposeHeaders := "Content-Length, Content-Type, Authorization, X-Guest-Id, X-Channel-Id, X-External-Id, X-External-Name, X-Customer-Session-Token, X-Customer-Session-Expires-At"
	return func(ctx *gin.Context) {
		if isWebsocketUpgrade(ctx) {
			ctx.Next()
			return
		}
		ctx.Header("Access-Control-Allow-Origin", "*")
		ctx.Header("Access-Control-Allow-Headers", allowHeaders)
		ctx.Header("Access-Control-Expose-Headers", exposeHeaders)
		ctx.Header("Access-Control-Max-Age", "600")
		if ctx.Request.Method == http.MethodOptions {
			ctx.AbortWithStatus(http.StatusNoContent)
			return
		}
		ctx.Next()
	}
}

func requestLogMiddleware() gin.HandlerFunc {
	return func(ctx *gin.Context) {
		start := time.Now()
		path := ctx.Request.URL.Path
		method := ctx.Request.Method
		ctx.Next()

		slog.Info("http request",
			"method", method,
			"path", path,
			"status", ctx.Writer.Status(),
			"elapsed", time.Since(start).Milliseconds(),
			"clientIp", ctx.ClientIP(),
		)
	}
}

func maxBodySizeMiddleware(limit int64) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		ctx.Request.Body = http.MaxBytesReader(ctx.Writer, ctx.Request.Body, limit)
		ctx.Next()
	}
}

func isWebsocketUpgrade(ctx *gin.Context) bool {
	if !strings.EqualFold(ctx.GetHeader("Upgrade"), "websocket") {
		return false
	}
	return strings.Contains(strings.ToLower(ctx.GetHeader("Connection")), "upgrade")
}

func addRouter(app *gin.Engine) {
	app.Any("/api/mcp", gin.WrapH(mcps.NewHTTPHandler()))

	apiGroup := app.Group("/api")
	registerApiAuthRoutes(apiGroup.Group("/auth"))
	registerApiChannelRoutes(apiGroup.Group("/channel"))
	registerApiCustomerRoutes(apiGroup.Group("/customer"))
	registerApiConversationRoutes(apiGroup.Group("/conversation", middleware.ExternalUserMiddleware))
	registerApiMessageRoutes(apiGroup.Group("/message", middleware.ExternalUserMiddleware))

	wsGroup := app.Group("/api/ws")
	wsGroup.GET("/dashboard", middleware.AuthMiddleware, services.WsService.HandleDashboardWS)
	wsGroup.GET("/dashboard/notification", middleware.AuthMiddleware, services.WsService.HandleDashboardNotificationWS)
	wsGroup.GET("/open", services.WsService.HandleOpenWS)

	dashboardGroup := app.Group("/api/dashboard", middleware.AuthMiddleware)
	registerDashboardDashboardRoutes(dashboardGroup.Group("/dashboard"))
	registerDashboardUserRoutes(dashboardGroup.Group("/user"))
	registerDashboardCompanyRoutes(dashboardGroup.Group("/company"))
	registerDashboardCustomerRoutes(dashboardGroup.Group("/customer"))
	registerDashboardCustomerContactRoutes(dashboardGroup.Group("/customer-contact"))
	registerDashboardRoleRoutes(dashboardGroup.Group("/role"))
	registerDashboardPermissionRoutes(dashboardGroup.Group("/permission"))
	registerDashboardSessionRoutes(dashboardGroup.Group("/session"))
	registerDashboardTagRoutes(dashboardGroup.Group("/tag"))
	registerDashboardConversationRoutes(dashboardGroup.Group("/conversation"))
	registerDashboardTicketRoutes(dashboardGroup.Group("/ticket"))
	registerDashboardNotificationRoutes(dashboardGroup.Group("/notification"))
	registerDashboardQuickReplyRoutes(dashboardGroup.Group("/quick-reply"))
	registerDashboardChannelRoutes(dashboardGroup.Group("/channel"))
	registerDashboardAgentRoutes(dashboardGroup.Group("/agent"))
	registerDashboardAgentTeamRoutes(dashboardGroup.Group("/agent-team"))
	registerDashboardAgentTeamScheduleRoutes(dashboardGroup.Group("/agent-team-schedule"))
	registerDashboardAIAgentRoutes(dashboardGroup.Group("/ai-agent"))
	registerDashboardAIConfigRoutes(dashboardGroup.Group("/ai-config"))
	registerDashboardAssetRoutes(dashboardGroup.Group("/asset"))
	registerDashboardKnowledgeBaseRoutes(dashboardGroup.Group("/knowledge-base"))
	registerDashboardKnowledgeDocumentRoutes(dashboardGroup.Group("/knowledge-document"))
	registerDashboardKnowledgeFAQRoutes(dashboardGroup.Group("/knowledge-faq"))
	registerDashboardKnowledgeRetrieveRoutes(dashboardGroup.Group("/knowledge-retrieve"))
	registerDashboardKnowledgeRetrieveLogRoutes(dashboardGroup.Group("/knowledge-retrieve-log"))
	registerDashboardAgentRunLogRoutes(dashboardGroup.Group("/agent-run-log"))
	registerDashboardSkillDefinitionRoutes(dashboardGroup.Group("/skill-definition"))
	registerDashboardMCPRoutes(dashboardGroup.Group("/mcp"))

	thirdGroup := app.Group("/api/third")
	registerThirdWechatRoutes(thirdGroup.Group("/wechat"))
}
