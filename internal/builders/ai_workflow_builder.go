package builders

import (
	"encoding/json"

	"agent-desk/internal/ai/workflow/dsl"
	workflowregistry "agent-desk/internal/ai/workflow/registry"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto/response"
)

func BuildAIWorkflow(item *models.AIWorkflow) response.AIWorkflowResponse {
	if item == nil {
		return response.AIWorkflowResponse{}
	}
	return response.AIWorkflowResponse{
		ID:                 item.ID,
		Name:               item.Name,
		Description:        item.Description,
		AgentID:            item.AgentID,
		Status:             item.Status,
		DraftDefinition:    parseWorkflowDefinition(item.DraftDefinition),
		PublishedVersionID: item.PublishedVersionID,
		SortNo:             item.SortNo,
		CreatedAt:          item.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:          item.UpdatedAt.Format("2006-01-02 15:04:05"),
		CreateUserName:     item.CreateUserName,
		UpdateUserName:     item.UpdateUserName,
	}
}

func BuildAIWorkflowList(list []models.AIWorkflow) []response.AIWorkflowResponse {
	ret := make([]response.AIWorkflowResponse, 0, len(list))
	for i := range list {
		ret = append(ret, BuildAIWorkflow(&list[i]))
	}
	return ret
}

func BuildAIWorkflowVersion(item *models.AIWorkflowVersion) response.AIWorkflowVersionResponse {
	if item == nil {
		return response.AIWorkflowVersionResponse{}
	}
	publishedAt := ""
	if item.PublishedAt != nil {
		publishedAt = item.PublishedAt.Format("2006-01-02 15:04:05")
	}
	return response.AIWorkflowVersionResponse{
		ID:              item.ID,
		WorkflowID:      item.WorkflowID,
		Version:         item.Version,
		Status:          item.Status,
		Definition:      parseWorkflowDefinition(item.Definition),
		DefinitionHash:  item.DefinitionHash,
		PublishedAt:     publishedAt,
		PublishedByID:   item.PublishedByID,
		PublishedByName: item.PublishedByName,
		CreatedAt:       item.CreatedAt.Format("2006-01-02 15:04:05"),
		UpdatedAt:       item.UpdatedAt.Format("2006-01-02 15:04:05"),
	}
}

func BuildAIWorkflowVersionList(list []models.AIWorkflowVersion) []response.AIWorkflowVersionResponse {
	ret := make([]response.AIWorkflowVersionResponse, 0, len(list))
	for i := range list {
		ret = append(ret, BuildAIWorkflowVersion(&list[i]))
	}
	return ret
}

func BuildAIWorkflowNodeSpecs(list []workflowregistry.NodeSpec) []response.AIWorkflowNodeSpecResponse {
	ret := make([]response.AIWorkflowNodeSpecResponse, 0, len(list))
	for _, item := range list {
		ret = append(ret, response.AIWorkflowNodeSpecResponse{
			Type:                            item.Type,
			Title:                           item.Title,
			Description:                     item.Description,
			RiskLevel:                       item.RiskLevel,
			Interruptible:                   item.Interruptible,
			RequiresConfirmationPredecessor: item.RequiresConfirmationPredecessor,
		})
	}
	return ret
}

func parseWorkflowDefinition(raw string) dsl.Definition {
	var ret dsl.Definition
	if raw == "" {
		return ret
	}
	_ = json.Unmarshal([]byte(raw), &ret)
	return ret
}
