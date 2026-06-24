package builders

import (
	"testing"
	"time"

	workflowregistry "agent-desk/internal/ai/workflow/registry"
	"agent-desk/internal/models"
)

func TestBuildAIWorkflowNodeSpecsIncludesVariableContracts(t *testing.T) {
	specs := BuildAIWorkflowNodeSpecs(workflowregistry.DefaultRegistry().List())

	var startFound bool
	var sendReplyFound bool
	for _, spec := range specs {
		switch spec.Type {
		case workflowregistry.NodeTypeStart:
			startFound = true
			if !hasResponseVariable(spec.OutputSchema, "userMessage") {
				t.Fatalf("expected start output userMessage, got %#v", spec.OutputSchema)
			}
		case workflowregistry.NodeTypeSendReply:
			sendReplyFound = true
			if !hasResponseVariable(spec.InputSchema, "replyText") {
				t.Fatalf("expected send_reply input replyText, got %#v", spec.InputSchema)
			}
		}
	}
	if !startFound || !sendReplyFound {
		t.Fatalf("expected start and send_reply specs in response")
	}
}

func TestBuildAIWorkflowRunIncludesAuditDisplayFields(t *testing.T) {
	startedAt := time.Date(2026, 6, 23, 10, 0, 0, 0, time.UTC)
	endedAt := startedAt.Add(1500 * time.Millisecond)

	resp := BuildAIWorkflowRunWithContext(
		&models.AIWorkflowRun{
			ID:                9,
			WorkflowID:        11,
			WorkflowVersionID: 22,
			AIAgentID:         33,
			StartedAt:         startedAt,
			EndedAt:           &endedAt,
			Status:            1,
		},
		&models.AIWorkflow{Name: "售后会话流程"},
		&models.AIWorkflowVersion{Version: 3},
		&models.AIAgent{Name: "售后 Agent"},
	)

	if resp.WorkflowName != "售后会话流程" {
		t.Fatalf("expected workflow name, got %q", resp.WorkflowName)
	}
	if resp.WorkflowVersion != 3 {
		t.Fatalf("expected workflow version 3, got %d", resp.WorkflowVersion)
	}
	if resp.AIAgentName != "售后 Agent" {
		t.Fatalf("expected agent name, got %q", resp.AIAgentName)
	}
	if resp.DurationMS != 1500 {
		t.Fatalf("expected duration 1500ms, got %d", resp.DurationMS)
	}
}

func hasResponseVariable(items []workflowregistry.VariableSpec, name string) bool {
	for _, item := range items {
		if item.Name == name {
			return true
		}
	}
	return false
}
