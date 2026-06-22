package response

import (
	"agent-desk/internal/ai/workflow/dsl"
	workflowregistry "agent-desk/internal/ai/workflow/registry"
	workflowvalidator "agent-desk/internal/ai/workflow/validator"
	"agent-desk/internal/pkg/enums"
)

type AIWorkflowResponse struct {
	ID                 int64          `json:"id"`
	Name               string         `json:"name"`
	Description        string         `json:"description"`
	AgentID            int64          `json:"agentId"`
	Status             enums.Status   `json:"status"`
	DraftDefinition    dsl.Definition `json:"draftDefinition"`
	PublishedVersionID int64          `json:"publishedVersionId"`
	SortNo             int            `json:"sortNo"`
	CreatedAt          string         `json:"createdAt"`
	UpdatedAt          string         `json:"updatedAt"`
	CreateUserName     string         `json:"createUserName"`
	UpdateUserName     string         `json:"updateUserName"`
}

type AIWorkflowVersionResponse struct {
	ID              int64          `json:"id"`
	WorkflowID      int64          `json:"workflowId"`
	Version         int            `json:"version"`
	Status          enums.Status   `json:"status"`
	Definition      dsl.Definition `json:"definition"`
	DefinitionHash  string         `json:"definitionHash"`
	PublishedAt     string         `json:"publishedAt"`
	PublishedByID   int64          `json:"publishedById"`
	PublishedByName string         `json:"publishedByName"`
	CreatedAt       string         `json:"createdAt"`
	UpdatedAt       string         `json:"updatedAt"`
}

type AIWorkflowValidationResponse struct {
	Valid  bool                      `json:"valid"`
	Errors []workflowvalidator.Error `json:"errors"`
}

type AIWorkflowNodeSpecResponse struct {
	Type                            string                         `json:"type"`
	Title                           string                         `json:"title"`
	Description                     string                         `json:"description"`
	RiskLevel                       workflowregistry.NodeRiskLevel `json:"riskLevel"`
	Interruptible                   bool                           `json:"interruptible"`
	RequiresConfirmationPredecessor bool                           `json:"requiresConfirmationPredecessor"`
}
