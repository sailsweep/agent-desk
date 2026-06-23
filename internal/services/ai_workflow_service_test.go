package services

import (
	"encoding/json"
	"testing"
	"time"

	"agent-desk/internal/ai/workflow/dsl"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/repositories"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

func TestAIWorkflowServiceValidateDefinitionReportsErrors(t *testing.T) {
	setupAIWorkflowTestDB(t)
	result := AIWorkflowService.ValidateDefinition(dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start_1",
		Nodes: []dsl.Node{
			{ID: "start_1", Type: "start"},
			{ID: "create_1", Type: "create_ticket"},
			{ID: "end_1", Type: "end"},
		},
		Edges: []dsl.Edge{
			{ID: "e1", Source: "start_1", Target: "create_1"},
			{ID: "e2", Source: "create_1", Target: "end_1"},
		},
	})

	if result.Valid {
		t.Fatalf("expected invalid workflow definition")
	}
	if len(result.Errors) == 0 {
		t.Fatalf("expected validation errors")
	}
}

func TestAIWorkflowServicePublishCreatesImmutableVersion(t *testing.T) {
	setupAIWorkflowTestDB(t)
	operator := aiWorkflowTestOperator()
	workflow, err := AIWorkflowService.CreateWorkflow(request.CreateAIWorkflowRequest{
		Name:        "support flow",
		Description: "customer service flow",
		AgentID:     12,
		Definition:  validAIWorkflowDefinition(),
	}, operator)
	if err != nil {
		t.Fatalf("CreateWorkflow() error = %v", err)
	}

	version, err := AIWorkflowService.PublishWorkflow(request.PublishAIWorkflowRequest{
		WorkflowID: workflow.ID,
		Definition: validAIWorkflowDefinition(),
	}, operator)
	if err != nil {
		t.Fatalf("PublishWorkflow() error = %v", err)
	}

	if version.WorkflowID != workflow.ID {
		t.Fatalf("expected workflow id %d, got %d", workflow.ID, version.WorkflowID)
	}
	if version.Version != 1 {
		t.Fatalf("expected first version to be 1, got %d", version.Version)
	}
	if version.DefinitionHash == "" {
		t.Fatalf("expected definition hash")
	}
	if version.PublishedAt == nil {
		t.Fatalf("expected published timestamp")
	}

	var stored dsl.Definition
	if err := json.Unmarshal([]byte(version.Definition), &stored); err != nil {
		t.Fatalf("unmarshal stored definition: %v", err)
	}
	if stored.EntryNodeID != "start_1" {
		t.Fatalf("unexpected stored definition: %+v", stored)
	}
}

func TestAIWorkflowServicePublishIncrementsVersion(t *testing.T) {
	setupAIWorkflowTestDB(t)
	operator := aiWorkflowTestOperator()
	workflow, err := AIWorkflowService.CreateWorkflow(request.CreateAIWorkflowRequest{
		Name:       "support flow versions",
		AgentID:    99,
		Definition: validAIWorkflowDefinition(),
	}, operator)
	if err != nil {
		t.Fatalf("CreateWorkflow() error = %v", err)
	}

	first, err := AIWorkflowService.PublishWorkflow(request.PublishAIWorkflowRequest{
		WorkflowID: workflow.ID,
		Definition: validAIWorkflowDefinition(),
	}, operator)
	if err != nil {
		t.Fatalf("PublishWorkflow() first error = %v", err)
	}
	second, err := AIWorkflowService.PublishWorkflow(request.PublishAIWorkflowRequest{
		WorkflowID: workflow.ID,
		Definition: validAIWorkflowDefinition(),
	}, operator)
	if err != nil {
		t.Fatalf("PublishWorkflow() second error = %v", err)
	}

	if first.Version != 1 || second.Version != 2 {
		t.Fatalf("expected versions 1 and 2, got %d and %d", first.Version, second.Version)
	}
}

func TestAIWorkflowServicePublishRejectsInvalidDSL(t *testing.T) {
	setupAIWorkflowTestDB(t)
	operator := aiWorkflowTestOperator()
	workflow, err := AIWorkflowService.CreateWorkflow(request.CreateAIWorkflowRequest{
		Name:       "invalid publish flow",
		AgentID:    23,
		Definition: validAIWorkflowDefinition(),
	}, operator)
	if err != nil {
		t.Fatalf("CreateWorkflow() error = %v", err)
	}

	_, err = AIWorkflowService.PublishWorkflow(request.PublishAIWorkflowRequest{
		WorkflowID: workflow.ID,
		Definition: dsl.Definition{
			SchemaVersion: 1,
			EntryNodeID:   "start_1",
			Nodes: []dsl.Node{
				{ID: "start_1", Type: "start"},
				{ID: "create_1", Type: "create_ticket"},
				{ID: "end_1", Type: "end"},
			},
			Edges: []dsl.Edge{
				{ID: "e1", Source: "start_1", Target: "create_1"},
				{ID: "e2", Source: "create_1", Target: "end_1"},
			},
		},
	}, operator)
	if err == nil {
		t.Fatalf("expected invalid publish to fail")
	}
	if versions := repositories.AIWorkflowVersionRepository.Find(sqls.DB(), sqls.NewCnd().Eq("workflow_id", workflow.ID)); len(versions) != 0 {
		t.Fatalf("expected no versions after invalid publish, got %d", len(versions))
	}
}

func TestAIWorkflowServiceRunListAndDetail(t *testing.T) {
	setupAIWorkflowTestDB(t)
	now := time.Now()
	run := models.AIWorkflowRun{
		WorkflowID:        101,
		WorkflowVersionID: 202,
		ConversationID:    303,
		AIAgentID:         12,
		MessageID:         404,
		Status:            1,
		StartedAt:         now,
		EndedAt:           &now,
	}
	if err := sqls.DB().Create(&run).Error; err != nil {
		t.Fatalf("create workflow run: %v", err)
	}
	otherRun := models.AIWorkflowRun{
		WorkflowID:        101,
		WorkflowVersionID: 202,
		ConversationID:    999,
		AIAgentID:         12,
		MessageID:         505,
		Status:            1,
		StartedAt:         now,
	}
	if err := sqls.DB().Create(&otherRun).Error; err != nil {
		t.Fatalf("create other workflow run: %v", err)
	}
	nodes := []models.AIWorkflowNodeRun{
		{
			WorkflowRunID: run.ID,
			NodeID:        "start_1",
			NodeType:      "start",
			Status:        1,
			InputPreview:  `{"inputs":{}}`,
			OutputPreview: `{"messageId":404}`,
			StartedAt:     now,
			EndedAt:       &now,
		},
		{
			WorkflowRunID: run.ID,
			NodeID:        "reply_1",
			NodeType:      "llm_reply",
			Status:        1,
			OutputPreview: `{"replyText":"hello"}`,
			StartedAt:     now,
			EndedAt:       &now,
			DurationMS:    8,
		},
	}
	if err := sqls.DB().Create(&nodes).Error; err != nil {
		t.Fatalf("create workflow node runs: %v", err)
	}

	list, paging := AIWorkflowService.FindRunPageByCnd(sqls.NewCnd().Eq("conversation_id", 303).Desc("id").Page(1, 20))
	if paging.Total != 1 || len(list) != 1 || list[0].ID != run.ID {
		t.Fatalf("unexpected run list: total=%d list=%#v", paging.Total, list)
	}

	detail, nodeRuns := AIWorkflowService.GetRunDetail(run.ID)
	if detail == nil || detail.ID != run.ID {
		t.Fatalf("unexpected detail run: %#v", detail)
	}
	if len(nodeRuns) != 2 || nodeRuns[0].NodeID != "start_1" || nodeRuns[1].NodeID != "reply_1" {
		t.Fatalf("unexpected detail nodes: %#v", nodeRuns)
	}
	if missing, missingNodes := AIWorkflowService.GetRunDetail(999999); missing != nil || len(missingNodes) != 0 {
		t.Fatalf("expected missing detail to be empty, got run=%#v nodes=%#v", missing, missingNodes)
	}
}

func setupAIWorkflowTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&models.AIAgent{}, &models.AIWorkflow{}, &models.AIWorkflowVersion{}, &models.AIWorkflowRun{}, &models.AIWorkflowNodeRun{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
	for _, id := range []int64{12, 23, 99} {
		if err := sqls.DB().Create(&models.AIAgent{ID: id, Name: "agent", Status: enums.StatusOk}).Error; err != nil {
			t.Fatalf("create ai agent: %v", err)
		}
	}
}

func validAIWorkflowDefinition() dsl.Definition {
	return dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start_1",
		Nodes: []dsl.Node{
			{ID: "start_1", Type: "start"},
			{ID: "reply_1", Type: "send_reply", Config: json.RawMessage(`{"text":"hello"}`), Inputs: map[string]dsl.VariableSelector{
				"replyText": {NodeID: "start_1", Field: "userMessage"},
			}},
			{ID: "end_1", Type: "end"},
		},
		Edges: []dsl.Edge{
			{ID: "e1", Source: "start_1", Target: "reply_1"},
			{ID: "e2", Source: "reply_1", Target: "end_1"},
		},
	}
}

func aiWorkflowTestOperator() *dto.AuthPrincipal {
	return &dto.AuthPrincipal{
		UserID:   1,
		Username: "workflow-tester",
		Nickname: "workflow-tester",
	}
}
