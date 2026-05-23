package dashboard

import (
	"context"
	"cs-agent/internal/pkg/httpx"

	"cs-agent/internal/pkg/constants"
	"cs-agent/internal/pkg/dto/request"
	"cs-agent/internal/pkg/dto/response"
	"cs-agent/internal/services"

	"cs-agent/internal/pkg/httpx/params"

	"github.com/gin-gonic/gin"
)

func MCPAnyList_servers(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionMCPView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, response.BuildMCPServerInfoResponses(services.MCPDebugService.ListServers()))
	return
}

func MCPAnyCatalog(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionMCPView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	items, err := services.ToolCatalogService.ListMCPTools(context.Background())
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	ret := make([]response.MCPToolCatalogResponse, 0, len(items))
	for _, item := range items {
		ret = append(ret, response.MCPToolCatalogResponse{
			ToolCode:     item.ToolCode,
			ServerCode:   item.ServerCode,
			ToolName:     item.ToolName,
			SourceType:   item.SourceType,
			AutoInjected: item.AutoInjected,
			Title:        item.Title,
			Description:  item.Description,
			InputSchema:  item.InputSchema,
			OutputSchema: item.OutputSchema,
		})
	}
	httpx.WriteJSON(ctx, ret)
	return
}

func MCPPostTest_connection(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionMCPView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.MCPServerDebugRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	result, err := services.MCPDebugService.TestConnection(context.Background(), req.ServerCode)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, response.BuildMCPConnectionResponse(result))
	return
}

func MCPPostList_tools(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionMCPView); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.MCPServerDebugRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	result, err := services.MCPDebugService.ListTools(context.Background(), req.ServerCode)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, response.BuildMCPToolInfoResponses(result))
	return
}

func MCPPostCall_tool(ctx *gin.Context) {
	if _, err := services.AuthService.RequirePermission(ctx, constants.PermissionMCPCall); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	req := request.MCPCallToolRequest{}
	if err := params.ReadJSON(ctx, &req); err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	result, err := services.MCPDebugService.CallTool(context.Background(), req.ServerCode, req.ToolName, req.Arguments)
	if err != nil {
		httpx.WriteJSON(ctx, err)
		return
	}
	httpx.WriteJSON(ctx, response.BuildMCPCallToolResponse(result))
	return
}
