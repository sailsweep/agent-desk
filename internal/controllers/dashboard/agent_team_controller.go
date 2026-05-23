package dashboard

import (
	"cs-agent/internal/models"
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

func AgentTeamAnyList(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionAgentTeamView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	cnd := params.NewSqlCnd(ctx,
		params.QueryFilter{ParamName: "status"},
		params.QueryFilter{ParamName: "leaderUserId"},
		params.QueryFilter{ParamName: "name", Op: params.Like},
	).Desc("id")
	if _, ok := params.Get(ctx, "status"); !ok {
		cnd.Where("status <> ?", enums.StatusDeleted)
	}
	list := services.AgentTeamService.Find(cnd)
	results := make([]response.AgentTeamResponse, 0, len(list))
	for _, item := range list {
		results = append(results, buildAgentTeamResponse(&item))
	}
	httpx.WriteJSON(ctx, results)
	return
}

func AgentTeamGetList_all(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionAgentTeamView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	list := services.AgentTeamService.Find(sqls.NewCnd().Eq("status", enums.StatusOk))
	results := make([]response.AgentTeamResponse, 0, len(list))
	for _, item := range list {
		results = append(results, buildAgentTeamResponse(&item))
	}
	httpx.WriteJSON(ctx, results)
	return
}

func AgentTeamGetBy(ctx *gin.Context, id int64) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionAgentTeamView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	item := services.AgentTeamService.Get(id)
	if item == nil || item.Status == enums.StatusDeleted {
		httpx.WriteJSON(ctx, web.JsonErrorMsg("客服组不存在"))
		return
	}
	httpx.WriteJSON(ctx, buildAgentTeamResponse(item))
	return
}

func AgentTeamPostCreate(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionAgentTeamCreate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.CreateAgentTeamRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	item, err := services.AgentTeamService.CreateAgentTeam(req, operator)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, buildAgentTeamResponse(item))
	return
}

func AgentTeamPostUpdate(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionAgentTeamUpdate)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.UpdateAgentTeamRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	if err := services.AgentTeamService.UpdateAgentTeam(req, operator); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, nil)
	return
}

func AgentTeamPostDelete(ctx *gin.Context) {
	operator, err := services.AuthService.RequirePermission(ctx, constants.PermissionAgentTeamDelete)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.DeleteAgentTeamRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	if err := services.AgentTeamService.DeleteAgentTeam(req.ID, operator); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, nil)
	return
}

func buildAgentTeamResponse(item *models.AgentTeam) response.AgentTeamResponse {
	ret := response.AgentTeamResponse{
		ID:           item.ID,
		Name:         item.Name,
		LeaderUserID: item.LeaderUserID,
		Status:       item.Status,
		Description:  item.Description,
		Remark:       item.Remark,
	}
	if user := services.UserService.Get(item.LeaderUserID); user != nil {
		ret.LeaderUsername = user.Username
		ret.LeaderNickname = user.Nickname
	}
	return ret
}
