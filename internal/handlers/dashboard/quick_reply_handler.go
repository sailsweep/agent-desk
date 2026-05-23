package dashboard

import (
	"cs-agent/internal/pkg/constants"
	"cs-agent/internal/pkg/dto/request"
	"cs-agent/internal/pkg/dto/response"
	"cs-agent/internal/pkg/enums"
	"cs-agent/internal/pkg/httpx"
	"cs-agent/internal/services"

	"cs-agent/internal/pkg/httpx/params"

	"github.com/gin-gonic/gin"
	"github.com/mlogclub/simple/sqls"
	"github.com/mlogclub/simple/web"
)

func QuickReplyAnyList(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionQuickReplyView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}

	cnd := params.NewPagedSqlCnd(ctx,
		params.QueryFilter{ParamName: "status"},
		params.QueryFilter{ParamName: "groupName"},
		params.QueryFilter{ParamName: "title", Op: params.Like},
	).Asc("sort_no").Desc("id")

	list, paging := services.QuickReplyService.FindPageByCnd(cnd)
	results := make([]response.QuickReplyResponse, 0, len(list))
	for _, item := range list {
		results = append(results, response.QuickReplyResponse{
			ID:        item.ID,
			GroupName: item.GroupName,
			Title:     item.Title,
			Content:   item.Content,
			Status:    item.Status,
			SortNo:    item.SortNo,
		})
	}
	httpx.WriteJSON(ctx, &web.PageResult{Results: results, Page: paging})
}

func QuickReplyGetList_all(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionQuickReplyView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	list := services.QuickReplyService.Find(sqls.NewCnd().Eq("status", enums.StatusOk).Asc("sort_no").Desc("id"))
	results := make([]response.QuickReplyResponse, 0, len(list))
	for _, item := range list {
		results = append(results, response.QuickReplyResponse{
			ID:        item.ID,
			GroupName: item.GroupName,
			Title:     item.Title,
			Content:   item.Content,
			Status:    item.Status,
			SortNo:    item.SortNo,
		})
	}
	httpx.WriteJSON(ctx, results)
}

func QuickReplyPostCreate(ctx *gin.Context) {
	user, err := services.AuthService.RequirePermission(ctx, constants.PermissionQuickReplyCreate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}

	req := request.CreateQuickReplyRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	item, err := services.QuickReplyService.CreateQuickReply(req, user)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, &response.QuickReplyResponse{
		ID:        item.ID,
		GroupName: item.GroupName,
		Title:     item.Title,
		Content:   item.Content,
		Status:    item.Status,
		SortNo:    item.SortNo,
	})
}

func QuickReplyPostUpdate(ctx *gin.Context) {
	user, err := services.AuthService.RequirePermission(ctx, constants.PermissionQuickReplyUpdate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}

	req := request.UpdateQuickReplyRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	if err := services.QuickReplyService.UpdateQuickReply(req, user); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, nil)
}

func QuickReplyPostDelete(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionQuickReplyDelete); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}

	req := request.DeleteQuickReplyRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	if err := services.QuickReplyService.DeleteQuickReply(req.ID); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, nil)
}
