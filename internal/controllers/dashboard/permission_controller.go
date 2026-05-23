package dashboard

import (
	"cs-agent/internal/pkg/constants"
	"cs-agent/internal/pkg/dto/response"
	"cs-agent/internal/pkg/httpx"
	"cs-agent/internal/services"

	"cs-agent/internal/pkg/httpx/params"

	"github.com/gin-gonic/gin"
	"github.com/mlogclub/simple/common/strs"
	"github.com/mlogclub/simple/web"
)

func PermissionAnyList(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionPermissionView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}

	cnd := params.NewPagedSqlCnd(ctx,
		params.QueryFilter{ParamName: "groupName"},
		params.QueryFilter{ParamName: "type"},
		params.QueryFilter{ParamName: "status"},
	).Desc("id")

	if keyword, _ := params.Get(ctx, "keyword"); strs.IsNotBlank(keyword) {
		cnd.Where("(name LIKE ? OR code LIKE ?)", "%"+keyword+"%", "%"+keyword+"%")
	}

	list, paging := services.PermissionService.FindPageByCnd(cnd)
	results := make([]response.PermissionResponse, 0, len(list))
	for _, item := range list {
		results = append(results, response.PermissionResponse{
			ID:        item.ID,
			Name:      item.Name,
			Code:      item.Code,
			Type:      item.Type,
			GroupName: item.GroupName,
			Method:    item.Method,
			ApiPath:   item.APIPath,
			Status:    item.Status,
			SortNo:    item.SortNo,
		})
	}
	httpx.WriteJSON(ctx, &web.PageResult{Results: results, Page: paging})
	return
}

func PermissionGetBy(ctx *gin.Context, id int64) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionPermissionView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}

	item := services.PermissionService.Get(id)
	if item == nil {
		httpx.WriteJSON(ctx, web.JsonErrorMsg("权限不存在"))
		return
	}
	httpx.WriteJSON(ctx, &response.PermissionResponse{
		ID:        item.ID,
		Name:      item.Name,
		Code:      item.Code,
		Type:      item.Type,
		GroupName: item.GroupName,
		Method:    item.Method,
		ApiPath:   item.APIPath,
		Status:    item.Status,
		SortNo:    item.SortNo,
	})
	return
}
