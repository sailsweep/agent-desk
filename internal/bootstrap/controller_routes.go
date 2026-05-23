package bootstrap

import (
	"net/http"
	"strconv"

	"cs-agent/internal/controllers/api"
	"cs-agent/internal/controllers/dashboard"
	"cs-agent/internal/controllers/third"

	"github.com/gin-gonic/gin"
	"github.com/mlogclub/simple/web"
)

func writeJSON(ctx *gin.Context, result *web.JsonResult) {
	if result == nil {
		return
	}
	ctx.JSON(http.StatusOK, result)
}

func pathInt64(ctx *gin.Context, name string) (int64, bool) {
	value, err := strconv.ParseInt(ctx.Param(name), 10, 64)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, web.JsonErrorMsg("路径参数错误"))
		return 0, false
	}
	return value, true
}

func registerApiAuthRoutes(group *gin.RouterGroup) {
	group.POST("/login", func(ctx *gin.Context) {
		controller := &api.AuthController{Ctx: ctx}
		writeJSON(ctx, controller.PostLogin())
	})
	group.POST("/logout", func(ctx *gin.Context) {
		controller := &api.AuthController{Ctx: ctx}
		writeJSON(ctx, controller.PostLogout())
	})
	group.GET("/profile", func(ctx *gin.Context) {
		controller := &api.AuthController{Ctx: ctx}
		writeJSON(ctx, controller.GetProfile())
	})
	group.GET("/wxwork_callback", func(ctx *gin.Context) {
		controller := &api.AuthController{Ctx: ctx}
		controller.GetWxwork_callback()
	})
	group.POST("/wxwork_exchange", func(ctx *gin.Context) {
		controller := &api.AuthController{Ctx: ctx}
		writeJSON(ctx, controller.PostWxwork_exchange())
	})
	group.GET("/wxwork_login", func(ctx *gin.Context) {
		controller := &api.AuthController{Ctx: ctx}
		controller.GetWxwork_login()
	})
	group.GET("/wxwork_qr_login", func(ctx *gin.Context) {
		controller := &api.AuthController{Ctx: ctx}
		controller.GetWxwork_qr_login()
	})
}

func registerApiChannelRoutes(group *gin.RouterGroup) {
	group.Any("/config", func(ctx *gin.Context) {
		controller := &api.ChannelController{Ctx: ctx}
		writeJSON(ctx, controller.AnyConfig())
	})
}

func registerApiConversationRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &api.ConversationController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.POST("/close", func(ctx *gin.Context) {
		controller := &api.ConversationController{Ctx: ctx}
		writeJSON(ctx, controller.PostClose())
	})
	group.POST("/create_or_match", func(ctx *gin.Context) {
		controller := &api.ConversationController{Ctx: ctx}
		writeJSON(ctx, controller.PostCreate_or_match())
	})
}

func registerApiCustomerRoutes(group *gin.RouterGroup) {
	group.POST("/session_exchange", func(ctx *gin.Context) {
		controller := &api.CustomerController{Ctx: ctx}
		writeJSON(ctx, controller.PostSession_exchange())
	})
}

func registerApiMessageRoutes(group *gin.RouterGroup) {
	group.Any("/list", func(ctx *gin.Context) {
		controller := &api.MessageController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
	group.POST("/read", func(ctx *gin.Context) {
		controller := &api.MessageController{Ctx: ctx}
		writeJSON(ctx, controller.PostRead())
	})
	group.POST("/send", func(ctx *gin.Context) {
		controller := &api.MessageController{Ctx: ctx}
		writeJSON(ctx, controller.PostSend())
	})
	group.POST("/upload_attachment", func(ctx *gin.Context) {
		controller := &api.MessageController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpload_attachment())
	})
	group.POST("/upload_image", func(ctx *gin.Context) {
		controller := &api.MessageController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpload_image())
	})
}

func registerDashboardAIAgentRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &dashboard.AIAgentController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.POST("/create", func(ctx *gin.Context) {
		controller := &dashboard.AIAgentController{Ctx: ctx}
		writeJSON(ctx, controller.PostCreate())
	})
	group.POST("/delete", func(ctx *gin.Context) {
		controller := &dashboard.AIAgentController{Ctx: ctx}
		writeJSON(ctx, controller.PostDelete())
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.AIAgentController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
	group.GET("/list_all", func(ctx *gin.Context) {
		controller := &dashboard.AIAgentController{Ctx: ctx}
		writeJSON(ctx, controller.GetList_all())
	})
	group.POST("/update", func(ctx *gin.Context) {
		controller := &dashboard.AIAgentController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate())
	})
	group.POST("/update_sort", func(ctx *gin.Context) {
		controller := &dashboard.AIAgentController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate_sort())
	})
	group.POST("/update_status", func(ctx *gin.Context) {
		controller := &dashboard.AIAgentController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate_status())
	})
}

func registerDashboardAIConfigRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &dashboard.AIConfigController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.POST("/create", func(ctx *gin.Context) {
		controller := &dashboard.AIConfigController{Ctx: ctx}
		writeJSON(ctx, controller.PostCreate())
	})
	group.POST("/delete", func(ctx *gin.Context) {
		controller := &dashboard.AIConfigController{Ctx: ctx}
		writeJSON(ctx, controller.PostDelete())
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.AIConfigController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
	group.Any("/list_all", func(ctx *gin.Context) {
		controller := &dashboard.AIConfigController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList_all())
	})
	group.POST("/update", func(ctx *gin.Context) {
		controller := &dashboard.AIConfigController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate())
	})
	group.POST("/update_sort", func(ctx *gin.Context) {
		controller := &dashboard.AIConfigController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate_sort())
	})
	group.POST("/update_status", func(ctx *gin.Context) {
		controller := &dashboard.AIConfigController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate_status())
	})
}

func registerDashboardAgentRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &dashboard.AgentController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.POST("/create", func(ctx *gin.Context) {
		controller := &dashboard.AgentController{Ctx: ctx}
		writeJSON(ctx, controller.PostCreate())
	})
	group.POST("/delete", func(ctx *gin.Context) {
		controller := &dashboard.AgentController{Ctx: ctx}
		writeJSON(ctx, controller.PostDelete())
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.AgentController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
	group.GET("/list_all", func(ctx *gin.Context) {
		controller := &dashboard.AgentController{Ctx: ctx}
		writeJSON(ctx, controller.GetList_all())
	})
	group.POST("/update", func(ctx *gin.Context) {
		controller := &dashboard.AgentController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate())
	})
}

func registerDashboardAgentRunLogRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &dashboard.AgentRunLogController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.AgentRunLogController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
}

func registerDashboardAgentTeamRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &dashboard.AgentTeamController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.POST("/create", func(ctx *gin.Context) {
		controller := &dashboard.AgentTeamController{Ctx: ctx}
		writeJSON(ctx, controller.PostCreate())
	})
	group.POST("/delete", func(ctx *gin.Context) {
		controller := &dashboard.AgentTeamController{Ctx: ctx}
		writeJSON(ctx, controller.PostDelete())
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.AgentTeamController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
	group.GET("/list_all", func(ctx *gin.Context) {
		controller := &dashboard.AgentTeamController{Ctx: ctx}
		writeJSON(ctx, controller.GetList_all())
	})
	group.POST("/update", func(ctx *gin.Context) {
		controller := &dashboard.AgentTeamController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate())
	})
}

func registerDashboardAgentTeamScheduleRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &dashboard.AgentTeamScheduleController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.POST("/batch_generate", func(ctx *gin.Context) {
		controller := &dashboard.AgentTeamScheduleController{Ctx: ctx}
		writeJSON(ctx, controller.PostBatch_generate())
	})
	group.POST("/batch_preview", func(ctx *gin.Context) {
		controller := &dashboard.AgentTeamScheduleController{Ctx: ctx}
		writeJSON(ctx, controller.PostBatch_preview())
	})
	group.Any("/calendar", func(ctx *gin.Context) {
		controller := &dashboard.AgentTeamScheduleController{Ctx: ctx}
		writeJSON(ctx, controller.AnyCalendar())
	})
	group.POST("/create", func(ctx *gin.Context) {
		controller := &dashboard.AgentTeamScheduleController{Ctx: ctx}
		writeJSON(ctx, controller.PostCreate())
	})
	group.POST("/delete", func(ctx *gin.Context) {
		controller := &dashboard.AgentTeamScheduleController{Ctx: ctx}
		writeJSON(ctx, controller.PostDelete())
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.AgentTeamScheduleController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
	group.POST("/update", func(ctx *gin.Context) {
		controller := &dashboard.AgentTeamScheduleController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate())
	})
}

func registerDashboardAssetRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &dashboard.AssetController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.POST("/create", func(ctx *gin.Context) {
		controller := &dashboard.AssetController{Ctx: ctx}
		writeJSON(ctx, controller.PostCreate())
	})
	group.POST("/delete", func(ctx *gin.Context) {
		controller := &dashboard.AssetController{Ctx: ctx}
		writeJSON(ctx, controller.PostDelete())
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.AssetController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
}

func registerDashboardChannelRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &dashboard.ChannelController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.POST("/create", func(ctx *gin.Context) {
		controller := &dashboard.ChannelController{Ctx: ctx}
		writeJSON(ctx, controller.PostCreate())
	})
	group.POST("/delete", func(ctx *gin.Context) {
		controller := &dashboard.ChannelController{Ctx: ctx}
		writeJSON(ctx, controller.PostDelete())
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.ChannelController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
	group.POST("/reset_user_token_secret", func(ctx *gin.Context) {
		controller := &dashboard.ChannelController{Ctx: ctx}
		writeJSON(ctx, controller.PostReset_user_token_secret())
	})
	group.POST("/update", func(ctx *gin.Context) {
		controller := &dashboard.ChannelController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate())
	})
	group.POST("/update_status", func(ctx *gin.Context) {
		controller := &dashboard.ChannelController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate_status())
	})
	group.Any("/wxwork/kf/accounts", func(ctx *gin.Context) {
		controller := &dashboard.ChannelController{Ctx: ctx}
		writeJSON(ctx, controller.AnyWxworkKfAccounts())
	})
}

func registerDashboardCompanyRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &dashboard.CompanyController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.POST("/create", func(ctx *gin.Context) {
		controller := &dashboard.CompanyController{Ctx: ctx}
		writeJSON(ctx, controller.PostCreate())
	})
	group.POST("/delete", func(ctx *gin.Context) {
		controller := &dashboard.CompanyController{Ctx: ctx}
		writeJSON(ctx, controller.PostDelete())
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.CompanyController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
	group.POST("/update", func(ctx *gin.Context) {
		controller := &dashboard.CompanyController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate())
	})
	group.POST("/update_status", func(ctx *gin.Context) {
		controller := &dashboard.CompanyController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate_status())
	})
}

func registerDashboardConversationRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &dashboard.ConversationController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.POST("/add_tag", func(ctx *gin.Context) {
		controller := &dashboard.ConversationController{Ctx: ctx}
		writeJSON(ctx, controller.PostAdd_tag())
	})
	group.POST("/assign", func(ctx *gin.Context) {
		controller := &dashboard.ConversationController{Ctx: ctx}
		writeJSON(ctx, controller.PostAssign())
	})
	group.POST("/close", func(ctx *gin.Context) {
		controller := &dashboard.ConversationController{Ctx: ctx}
		writeJSON(ctx, controller.PostClose())
	})
	group.Any("/conversations", func(ctx *gin.Context) {
		controller := &dashboard.ConversationController{Ctx: ctx}
		writeJSON(ctx, controller.AnyConversations())
	})
	group.POST("/dispatch", func(ctx *gin.Context) {
		controller := &dashboard.ConversationController{Ctx: ctx}
		writeJSON(ctx, controller.PostDispatch())
	})
	group.POST("/link_customer", func(ctx *gin.Context) {
		controller := &dashboard.ConversationController{Ctx: ctx}
		writeJSON(ctx, controller.PostLink_customer())
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.ConversationController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
	group.Any("/message_list", func(ctx *gin.Context) {
		controller := &dashboard.ConversationController{Ctx: ctx}
		writeJSON(ctx, controller.AnyMessage_list())
	})
	group.POST("/read", func(ctx *gin.Context) {
		controller := &dashboard.ConversationController{Ctx: ctx}
		writeJSON(ctx, controller.PostRead())
	})
	group.POST("/recall_message", func(ctx *gin.Context) {
		controller := &dashboard.ConversationController{Ctx: ctx}
		writeJSON(ctx, controller.PostRecall_message())
	})
	group.POST("/remove_tag", func(ctx *gin.Context) {
		controller := &dashboard.ConversationController{Ctx: ctx}
		writeJSON(ctx, controller.PostRemove_tag())
	})
	group.POST("/send_message", func(ctx *gin.Context) {
		controller := &dashboard.ConversationController{Ctx: ctx}
		writeJSON(ctx, controller.PostSend_message())
	})
	group.POST("/transfer", func(ctx *gin.Context) {
		controller := &dashboard.ConversationController{Ctx: ctx}
		writeJSON(ctx, controller.PostTransfer())
	})
	group.POST("/upload_attachment", func(ctx *gin.Context) {
		controller := &dashboard.ConversationController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpload_attachment())
	})
	group.POST("/upload_image", func(ctx *gin.Context) {
		controller := &dashboard.ConversationController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpload_image())
	})
}

func registerDashboardCustomerContactRoutes(group *gin.RouterGroup) {
	group.POST("/create", func(ctx *gin.Context) {
		controller := &dashboard.CustomerContactController{Ctx: ctx}
		writeJSON(ctx, controller.PostCreate())
	})
	group.POST("/delete", func(ctx *gin.Context) {
		controller := &dashboard.CustomerContactController{Ctx: ctx}
		writeJSON(ctx, controller.PostDelete())
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.CustomerContactController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
	group.POST("/update", func(ctx *gin.Context) {
		controller := &dashboard.CustomerContactController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate())
	})
}

func registerDashboardCustomerRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &dashboard.CustomerController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.POST("/create", func(ctx *gin.Context) {
		controller := &dashboard.CustomerController{Ctx: ctx}
		writeJSON(ctx, controller.PostCreate())
	})
	group.POST("/delete", func(ctx *gin.Context) {
		controller := &dashboard.CustomerController{Ctx: ctx}
		writeJSON(ctx, controller.PostDelete())
	})
	group.POST("/list", func(ctx *gin.Context) {
		controller := &dashboard.CustomerController{Ctx: ctx}
		writeJSON(ctx, controller.PostList())
	})
	group.POST("/save_profile", func(ctx *gin.Context) {
		controller := &dashboard.CustomerController{Ctx: ctx}
		writeJSON(ctx, controller.PostSave_profile())
	})
	group.POST("/update", func(ctx *gin.Context) {
		controller := &dashboard.CustomerController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate())
	})
	group.POST("/update_status", func(ctx *gin.Context) {
		controller := &dashboard.CustomerController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate_status())
	})
}

func registerDashboardDashboardRoutes(group *gin.RouterGroup) {
	group.GET("/overview", func(ctx *gin.Context) {
		controller := &dashboard.DashboardController{Ctx: ctx}
		writeJSON(ctx, controller.GetOverview())
	})
}

func registerDashboardKnowledgeBaseRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeBaseController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.POST("/create", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeBaseController{Ctx: ctx}
		writeJSON(ctx, controller.PostCreate())
	})
	group.POST("/delete", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeBaseController{Ctx: ctx}
		writeJSON(ctx, controller.PostDelete())
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeBaseController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
	group.Any("/list_all", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeBaseController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList_all())
	})
	group.POST("/rebuild_index", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeBaseController{Ctx: ctx}
		writeJSON(ctx, controller.PostRebuild_index())
	})
	group.POST("/update", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeBaseController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate())
	})
	group.POST("/update_sort", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeBaseController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate_sort())
	})
}

func registerDashboardKnowledgeDocumentRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeDocumentController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.POST("/create", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeDocumentController{Ctx: ctx}
		writeJSON(ctx, controller.PostCreate())
	})
	group.POST("/delete", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeDocumentController{Ctx: ctx}
		writeJSON(ctx, controller.PostDelete())
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeDocumentController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
	group.POST("/update", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeDocumentController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate())
	})
}

func registerDashboardKnowledgeFAQRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeFAQController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.POST("/create", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeFAQController{Ctx: ctx}
		writeJSON(ctx, controller.PostCreate())
	})
	group.POST("/delete", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeFAQController{Ctx: ctx}
		writeJSON(ctx, controller.PostDelete())
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeFAQController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
	group.POST("/update", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeFAQController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate())
	})
}

func registerDashboardKnowledgeRetrieveRoutes(group *gin.RouterGroup) {
	group.POST("/build", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeRetrieveController{Ctx: ctx}
		writeJSON(ctx, controller.PostBuild())
	})
	group.POST("/debug/answer", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeRetrieveController{Ctx: ctx}
		writeJSON(ctx, controller.PostDebugAnswer())
	})
	group.POST("/debug/search", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeRetrieveController{Ctx: ctx}
		writeJSON(ctx, controller.PostDebugSearch())
	})
}

func registerDashboardKnowledgeRetrieveLogRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeRetrieveLogController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.KnowledgeRetrieveLogController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
}

func registerDashboardMCPRoutes(group *gin.RouterGroup) {
	group.POST("/call_tool", func(ctx *gin.Context) {
		controller := &dashboard.MCPController{Ctx: ctx}
		writeJSON(ctx, controller.PostCall_tool())
	})
	group.Any("/catalog", func(ctx *gin.Context) {
		controller := &dashboard.MCPController{Ctx: ctx}
		writeJSON(ctx, controller.AnyCatalog())
	})
	group.Any("/list_servers", func(ctx *gin.Context) {
		controller := &dashboard.MCPController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList_servers())
	})
	group.POST("/list_tools", func(ctx *gin.Context) {
		controller := &dashboard.MCPController{Ctx: ctx}
		writeJSON(ctx, controller.PostList_tools())
	})
	group.POST("/test_connection", func(ctx *gin.Context) {
		controller := &dashboard.MCPController{Ctx: ctx}
		writeJSON(ctx, controller.PostTest_connection())
	})
}

func registerDashboardNotificationRoutes(group *gin.RouterGroup) {
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.NotificationController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
	group.POST("/mark_all_read", func(ctx *gin.Context) {
		controller := &dashboard.NotificationController{Ctx: ctx}
		writeJSON(ctx, controller.PostMark_all_read())
	})
	group.POST("/mark_read", func(ctx *gin.Context) {
		controller := &dashboard.NotificationController{Ctx: ctx}
		writeJSON(ctx, controller.PostMark_read())
	})
	group.GET("/unread_count", func(ctx *gin.Context) {
		controller := &dashboard.NotificationController{Ctx: ctx}
		writeJSON(ctx, controller.GetUnread_count())
	})
}

func registerDashboardPermissionRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &dashboard.PermissionController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.PermissionController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
}

func registerDashboardQuickReplyRoutes(group *gin.RouterGroup) {
	group.POST("/create", func(ctx *gin.Context) {
		controller := &dashboard.QuickReplyController{Ctx: ctx}
		writeJSON(ctx, controller.PostCreate())
	})
	group.POST("/delete", func(ctx *gin.Context) {
		controller := &dashboard.QuickReplyController{Ctx: ctx}
		writeJSON(ctx, controller.PostDelete())
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.QuickReplyController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
	group.GET("/list_all", func(ctx *gin.Context) {
		controller := &dashboard.QuickReplyController{Ctx: ctx}
		writeJSON(ctx, controller.GetList_all())
	})
	group.POST("/update", func(ctx *gin.Context) {
		controller := &dashboard.QuickReplyController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate())
	})
}

func registerDashboardRoleRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &dashboard.RoleController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.POST("/assign_permission", func(ctx *gin.Context) {
		controller := &dashboard.RoleController{Ctx: ctx}
		writeJSON(ctx, controller.PostAssign_permission())
	})
	group.POST("/create", func(ctx *gin.Context) {
		controller := &dashboard.RoleController{Ctx: ctx}
		writeJSON(ctx, controller.PostCreate())
	})
	group.POST("/delete", func(ctx *gin.Context) {
		controller := &dashboard.RoleController{Ctx: ctx}
		writeJSON(ctx, controller.PostDelete())
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.RoleController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
	group.GET("/list_all", func(ctx *gin.Context) {
		controller := &dashboard.RoleController{Ctx: ctx}
		writeJSON(ctx, controller.GetList_all())
	})
	group.POST("/update", func(ctx *gin.Context) {
		controller := &dashboard.RoleController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate())
	})
	group.POST("/update_sort", func(ctx *gin.Context) {
		controller := &dashboard.RoleController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate_sort())
	})
	group.POST("/update_status", func(ctx *gin.Context) {
		controller := &dashboard.RoleController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate_status())
	})
}

func registerDashboardSessionRoutes(group *gin.RouterGroup) {
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.SessionController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
	group.POST("/revoke", func(ctx *gin.Context) {
		controller := &dashboard.SessionController{Ctx: ctx}
		writeJSON(ctx, controller.PostRevoke())
	})
	group.POST("/revoke/by/user", func(ctx *gin.Context) {
		controller := &dashboard.SessionController{Ctx: ctx}
		writeJSON(ctx, controller.PostRevokeByUser())
	})
}

func registerDashboardSkillDefinitionRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &dashboard.SkillDefinitionController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.POST("/create", func(ctx *gin.Context) {
		controller := &dashboard.SkillDefinitionController{Ctx: ctx}
		writeJSON(ctx, controller.PostCreate())
	})
	group.POST("/debug_resume", func(ctx *gin.Context) {
		controller := &dashboard.SkillDefinitionController{Ctx: ctx}
		writeJSON(ctx, controller.PostDebug_resume())
	})
	group.POST("/debug_run", func(ctx *gin.Context) {
		controller := &dashboard.SkillDefinitionController{Ctx: ctx}
		writeJSON(ctx, controller.PostDebug_run())
	})
	group.POST("/delete", func(ctx *gin.Context) {
		controller := &dashboard.SkillDefinitionController{Ctx: ctx}
		writeJSON(ctx, controller.PostDelete())
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.SkillDefinitionController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
	group.GET("/list_all", func(ctx *gin.Context) {
		controller := &dashboard.SkillDefinitionController{Ctx: ctx}
		writeJSON(ctx, controller.GetList_all())
	})
	group.POST("/restore", func(ctx *gin.Context) {
		controller := &dashboard.SkillDefinitionController{Ctx: ctx}
		writeJSON(ctx, controller.PostRestore())
	})
	group.POST("/update", func(ctx *gin.Context) {
		controller := &dashboard.SkillDefinitionController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate())
	})
	group.POST("/update_status", func(ctx *gin.Context) {
		controller := &dashboard.SkillDefinitionController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate_status())
	})
}

func registerDashboardTagRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &dashboard.TagController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.POST("/create", func(ctx *gin.Context) {
		controller := &dashboard.TagController{Ctx: ctx}
		writeJSON(ctx, controller.PostCreate())
	})
	group.POST("/delete", func(ctx *gin.Context) {
		controller := &dashboard.TagController{Ctx: ctx}
		writeJSON(ctx, controller.PostDelete())
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.TagController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
	group.GET("/list_all", func(ctx *gin.Context) {
		controller := &dashboard.TagController{Ctx: ctx}
		writeJSON(ctx, controller.GetList_all())
	})
	group.POST("/update", func(ctx *gin.Context) {
		controller := &dashboard.TagController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate())
	})
	group.POST("/update_sort", func(ctx *gin.Context) {
		controller := &dashboard.TagController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate_sort())
	})
	group.POST("/update_status", func(ctx *gin.Context) {
		controller := &dashboard.TagController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate_status())
	})
}

func registerDashboardTicketRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &dashboard.TicketController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.POST("/assign", func(ctx *gin.Context) {
		controller := &dashboard.TicketController{Ctx: ctx}
		writeJSON(ctx, controller.PostAssign())
	})
	group.POST("/change_status", func(ctx *gin.Context) {
		controller := &dashboard.TicketController{Ctx: ctx}
		writeJSON(ctx, controller.PostChange_status())
	})
	group.POST("/create", func(ctx *gin.Context) {
		controller := &dashboard.TicketController{Ctx: ctx}
		writeJSON(ctx, controller.PostCreate())
	})
	group.POST("/create_from_conversation", func(ctx *gin.Context) {
		controller := &dashboard.TicketController{Ctx: ctx}
		writeJSON(ctx, controller.PostCreate_from_conversation())
	})
	group.POST("/delete_view", func(ctx *gin.Context) {
		controller := &dashboard.TicketController{Ctx: ctx}
		writeJSON(ctx, controller.PostDelete_view())
	})
	group.POST("/link_customer", func(ctx *gin.Context) {
		controller := &dashboard.TicketController{Ctx: ctx}
		writeJSON(ctx, controller.PostLink_customer())
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.TicketController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
	group.POST("/progress/create", func(ctx *gin.Context) {
		controller := &dashboard.TicketController{Ctx: ctx}
		writeJSON(ctx, controller.PostProgressCreate())
	})
	group.Any("/progress/list", func(ctx *gin.Context) {
		controller := &dashboard.TicketController{Ctx: ctx}
		writeJSON(ctx, controller.AnyProgressList())
	})
	group.POST("/save_view", func(ctx *gin.Context) {
		controller := &dashboard.TicketController{Ctx: ctx}
		writeJSON(ctx, controller.PostSave_view())
	})
	group.Any("/summary", func(ctx *gin.Context) {
		controller := &dashboard.TicketController{Ctx: ctx}
		writeJSON(ctx, controller.AnySummary())
	})
	group.POST("/update", func(ctx *gin.Context) {
		controller := &dashboard.TicketController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate())
	})
	group.Any("/view_list", func(ctx *gin.Context) {
		controller := &dashboard.TicketController{Ctx: ctx}
		writeJSON(ctx, controller.AnyView_list())
	})
}

func registerDashboardUserRoutes(group *gin.RouterGroup) {
	group.GET("/:id", func(ctx *gin.Context) {
		controller := &dashboard.UserController{Ctx: ctx}
		id, ok := pathInt64(ctx, "id")
		if !ok {
			return
		}
		writeJSON(ctx, controller.GetBy(id))
	})
	group.POST("/assign_role", func(ctx *gin.Context) {
		controller := &dashboard.UserController{Ctx: ctx}
		writeJSON(ctx, controller.PostAssign_role())
	})
	group.POST("/change_password", func(ctx *gin.Context) {
		controller := &dashboard.UserController{Ctx: ctx}
		writeJSON(ctx, controller.PostChange_password())
	})
	group.POST("/create", func(ctx *gin.Context) {
		controller := &dashboard.UserController{Ctx: ctx}
		writeJSON(ctx, controller.PostCreate())
	})
	group.POST("/delete", func(ctx *gin.Context) {
		controller := &dashboard.UserController{Ctx: ctx}
		writeJSON(ctx, controller.PostDelete())
	})
	group.Any("/list", func(ctx *gin.Context) {
		controller := &dashboard.UserController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList())
	})
	group.Any("/list_all", func(ctx *gin.Context) {
		controller := &dashboard.UserController{Ctx: ctx}
		writeJSON(ctx, controller.AnyList_all())
	})
	group.POST("/reset_password", func(ctx *gin.Context) {
		controller := &dashboard.UserController{Ctx: ctx}
		writeJSON(ctx, controller.PostReset_password())
	})
	group.POST("/update", func(ctx *gin.Context) {
		controller := &dashboard.UserController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate())
	})
	group.POST("/update_status", func(ctx *gin.Context) {
		controller := &dashboard.UserController{Ctx: ctx}
		writeJSON(ctx, controller.PostUpdate_status())
	})
}

func registerThirdWechatRoutes(group *gin.RouterGroup) {
	group.GET("/callback", func(ctx *gin.Context) {
		controller := &third.WechatController{Ctx: ctx}
		controller.GetCallback()
	})
	group.POST("/callback", func(ctx *gin.Context) {
		controller := &third.WechatController{Ctx: ctx}
		controller.PostCallback()
	})
}
