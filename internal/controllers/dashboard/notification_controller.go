package dashboard

import (
	"cs-agent/internal/pkg/httpx"
	"strings"

	"cs-agent/internal/builders"
	"cs-agent/internal/pkg/constants"
	"cs-agent/internal/pkg/dto/request"
	"cs-agent/internal/pkg/dto/response"
	"cs-agent/internal/pkg/enums"
	"cs-agent/internal/services"

	"cs-agent/internal/pkg/httpx/params"

	"github.com/gin-gonic/gin"
	"github.com/mlogclub/simple/web"
)

func NotificationAnyList(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionNotificationView)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}

	cnd := params.NewPagedSqlCnd(ctx,
		params.QueryFilter{ParamName: "type", ColumnName: "notification_type"},
	).Eq("recipient_user_id", operator.UserID).
		Eq("status", enums.StatusOk).
		Desc("id")

	switch strings.TrimSpace(ctx.Query("readStatus")) {
	case "unread":
		cnd.Where("read_at IS NULL")
	case "read":
		cnd.Where("read_at IS NOT NULL")
	}

	list, paging := services.NotificationService.FindPageByCnd(cnd)
	httpx.WriteJSON(ctx, &web.PageResult{
		Results: builders.BuildNotificationList(list),
		Page:    paging,
	})
	return
}

func NotificationGetUnread_count(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionNotificationView)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, &response.NotificationUnreadCountResponse{
		UnreadCount: services.NotificationService.CountUnread(operator.UserID),
	})
	return
}

func NotificationPostMark_read(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionNotificationUpdate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.MarkNotificationReadRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	if err := services.NotificationService.MarkRead(req.ID, operator.UserID); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, nil)
	return
}

func NotificationPostMark_all_read(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionNotificationUpdate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	if err := services.NotificationService.MarkAllRead(operator.UserID); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, nil)
	return
}
