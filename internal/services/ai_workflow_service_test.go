package services

import (
	"encoding/json"
	"testing"

	"agent-desk/internal/ai/workflow/dsl"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/dto/request"
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
		OwnerType:   "ai_agent",
		OwnerID:     12,
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
		OwnerType:  "ai_agent",
		OwnerID:    99,
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
		OwnerType:  "ai_agent",
		OwnerID:    23,
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

func setupAIWorkflowTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&models.AIWorkflow{}, &models.AIWorkflowVersion{}, &models.AIWorkflowRun{}, &models.AIWorkflowNodeRun{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
}

func validAIWorkflowDefinition() dsl.Definition {
	return dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start_1",
		Nodes: []dsl.Node{
			{ID: "start_1", Type: "start"},
			{ID: "reply_1", Type: "send_reply", Config: json.RawMessage(`{"text":"hello"}`)},
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
