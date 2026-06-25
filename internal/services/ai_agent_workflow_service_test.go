package services

import (
	"encoding/json"
	"testing"

	"agent-desk/internal/ai/workflow/dsl"
	workflowregistry "agent-desk/internal/ai/workflow/registry"
	workflowvalidator "agent-desk/internal/ai/workflow/validator"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/enums"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

func TestAIAgentServiceCreatesDefaultWorkflow(t *testing.T) {
	setupAIAgentWorkflowTestDB(t)
	operator := aiAgentWorkflowTestOperator()
	aiConfigID := createAIAgentWorkflowTestConfig(t)
	knowledgeID := createAIAgentWorkflowTestKnowledgeBase(t)

	item, err := AIAgentService.CreateAIAgent(request.CreateAIAgentRequest{
		Name:         "workflow agent",
		AIConfigID:   aiConfigID,
		ServiceMode:  enums.IMConversationServiceModeAIOnly,
		HandoffMode:  enums.AIAgentHandoffModeWaitPool,
		FallbackMode: enums.AIAgentFallbackModeNoAnswer,
		KnowledgeIDs: []int64{knowledgeID},
	}, operator)
	if err != nil {
		t.Fatalf("CreateAIAgent() error = %v", err)
	}

	workflow, err := AIWorkflowService.GetOrCreateAgentWorkflow(item.ID, operator)
	if err != nil {
		t.Fatalf("GetOrCreateAgentWorkflow() error = %v", err)
	}
	if workflow.AgentID != item.ID {
		t.Fatalf("expected workflow agent id %d, got %d", item.ID, workflow.AgentID)
	}
	if workflow.Name != item.Name+" 会话流程" {
		t.Fatalf("unexpected workflow name: %s", workflow.Name)
	}
	var stored dsl.Definition
	if err := json.Unmarshal([]byte(workflow.DraftDefinition), &stored); err != nil {
		t.Fatalf("unmarshal draft definition: %v", err)
	}
	if stored.EntryNodeID == "" {
		t.Fatalf("expected default draft definition")
	}
	validation := workflowvalidator.ValidateDefinition(stored, workflowregistry.DefaultRegistry())
	if !validation.Valid {
		t.Fatalf("expected default workflow to be valid, got %#v", validation.Errors)
	}
	if nodeTypeByID(stored, "route_intent_1") != workflowregistry.NodeTypeCondition {
		t.Fatalf("expected default workflow to start with a clear intent router, got nodes: %#v", stored.Nodes)
	}
	for _, nodeType := range []string{
		workflowregistry.NodeTypeHandoffToHuman,
		workflowregistry.NodeTypePrepareTicketDraft,
		workflowregistry.NodeTypeHumanConfirm,
		workflowregistry.NodeTypeCreateTicket,
		workflowregistry.NodeTypeKnowledgeRetrieve,
		workflowregistry.NodeTypeAnswerabilityGate,
		workflowregistry.NodeTypeLLMReply,
		workflowregistry.NodeTypeSendReply,
	} {
		if !workflowHasNodeType(stored, nodeType) {
			t.Fatalf("expected default workflow to include %s node: %#v", nodeType, stored.Nodes)
		}
	}
	assertConditionEdgeToNodeType(t, stored, "route_intent_1", workflowregistry.NodeTypeHandoffToHuman, "contains", "人工")
	assertConditionEdgeToNodeType(t, stored, "route_intent_1", workflowregistry.NodeTypePrepareTicketDraft, "contains", "工单")
	assertConditionEdgeToNodeType(t, stored, "answerability_1", workflowregistry.NodeTypeLLMReply, "eq", "answerable")
	assertDefaultEdgeToNodeType(t, stored, "answerability_1", workflowregistry.NodeTypeLLMReply)
	if !workflowEdgeExists(stored, "create_ticket_1", "ticket_result_reply_1") {
		t.Fatalf("expected create_ticket to flow into a customer-visible result reply")
	}
}

func TestAIWorkflowServicePublishAgentWorkflowBindsAgentVersion(t *testing.T) {
	setupAIAgentWorkflowTestDB(t)
	operator := aiAgentWorkflowTestOperator()
	aiConfigID := createAIAgentWorkflowTestConfig(t)
	knowledgeID := createAIAgentWorkflowTestKnowledgeBase(t)

	agent, err := AIAgentService.CreateAIAgent(request.CreateAIAgentRequest{
		Name:         "workflow agent without version",
		AIConfigID:   aiConfigID,
		ServiceMode:  enums.IMConversationServiceModeAIOnly,
		HandoffMode:  enums.AIAgentHandoffModeWaitPool,
		FallbackMode: enums.AIAgentFallbackModeNoAnswer,
		KnowledgeIDs: []int64{knowledgeID},
	}, operator)
	if err != nil {
		t.Fatalf("CreateAIAgent() error = %v", err)
	}
	workflow, err := AIWorkflowService.SaveAgentWorkflow(request.SaveAIWorkflowRequest{
		AgentID:     agent.ID,
		Name:        "After sales flow",
		Description: "Support workflow",
		Definition:  validAIWorkflowDefinition(),
	}, operator)
	if err != nil {
		t.Fatalf("SaveAgentWorkflow() error = %v", err)
	}

	version, err := AIWorkflowService.PublishAgentWorkflow(request.PublishAIWorkflowRequest{
		AgentID:    agent.ID,
		Definition: validAIWorkflowDefinition(),
	}, operator)
	if err != nil {
		t.Fatalf("PublishAgentWorkflow() error = %v", err)
	}
	if version.WorkflowID != workflow.ID {
		t.Fatalf("expected version workflow id %d, got %d", workflow.ID, version.WorkflowID)
	}
	storedAgent := AIAgentService.Get(agent.ID)
	if storedAgent == nil {
		t.Fatalf("expected stored agent")
	}
	if storedAgent.WorkflowVersionID != version.ID {
		t.Fatalf("expected agent workflow version %d, got %d", version.ID, storedAgent.WorkflowVersionID)
	}
}

func setupAIAgentWorkflowTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&models.AIAgent{}, &models.AIConfig{}, &models.KnowledgeBase{}, &models.AIWorkflow{}, &models.AIWorkflowVersion{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
}

func createAIAgentWorkflowTestConfig(t *testing.T) int64 {
	t.Helper()
	item := &models.AIConfig{
		Name:      "workflow-test-config",
		Provider:  enums.AIProviderOpenAI,
		ModelType: enums.AIModelTypeLLM,
		ModelName: "gpt-test",
		Status:    enums.StatusOk,
	}
	if err := sqls.DB().Create(item).Error; err != nil {
		t.Fatalf("create ai config: %v", err)
	}
	return item.ID
}

func createAIAgentWorkflowTestKnowledgeBase(t *testing.T) int64 {
	t.Helper()
	item := &models.KnowledgeBase{
		Name:          "workflow-test-kb",
		KnowledgeType: string(enums.KnowledgeBaseTypeFAQ),
		Status:        enums.StatusOk,
	}
	if err := sqls.DB().Create(item).Error; err != nil {
		t.Fatalf("create knowledge base: %v", err)
	}
	return item.ID
}

func createAIAgentWorkflowVersion(t *testing.T) int64 {
	t.Helper()
	workflow := &models.AIWorkflow{
		Name:    "workflow-test",
		AgentID: 1,
		Status:  enums.StatusOk,
	}
	if err := sqls.DB().Create(workflow).Error; err != nil {
		t.Fatalf("create workflow: %v", err)
	}
	version := &models.AIWorkflowVersion{
		WorkflowID: workflow.ID,
		Version:    1,
		Status:     enums.StatusOk,
	}
	if err := sqls.DB().Create(version).Error; err != nil {
		t.Fatalf("create workflow version: %v", err)
	}
	return version.ID
}

func aiAgentWorkflowTestOperator() *dto.AuthPrincipal {
	return &dto.AuthPrincipal{
		UserID:   1,
		Username: "agent-workflow-tester",
		Nickname: "agent-workflow-tester",
	}
}

func workflowHasNodeType(def dsl.Definition, nodeType string) bool {
	for _, node := range def.Nodes {
		if node.Type == nodeType {
			return true
		}
	}
	return false
}

func nodeTypeByID(def dsl.Definition, nodeID string) string {
	for _, node := range def.Nodes {
		if node.ID == nodeID {
			return node.Type
		}
	}
	return ""
}

func assertConditionEdgeToNodeType(t *testing.T, def dsl.Definition, sourceID string, targetType string, operator string, right any) {
	t.Helper()
	nodeTypes := workflowNodeTypeMap(def)
	for _, edge := range def.Edges {
		if edge.Source != sourceID || nodeTypes[edge.Target] != targetType || edge.Condition == nil {
			continue
		}
		if edge.Condition.Operator == operator && edge.Condition.Right == right {
			return
		}
	}
	t.Fatalf("expected %s conditional edge from %s to %s with right=%v, got %#v", operator, sourceID, targetType, right, def.Edges)
}

func assertDefaultEdgeToNodeType(t *testing.T, def dsl.Definition, sourceID string, targetType string) {
	t.Helper()
	nodeTypes := workflowNodeTypeMap(def)
	for _, edge := range def.Edges {
		if edge.Source == sourceID && nodeTypes[edge.Target] == targetType && edge.Condition == nil {
			return
		}
	}
	t.Fatalf("expected default edge from %s to %s, got %#v", sourceID, targetType, def.Edges)
}

func workflowEdgeExists(def dsl.Definition, sourceID string, targetID string) bool {
	for _, edge := range def.Edges {
		if edge.Source == sourceID && edge.Target == targetID {
			return true
		}
	}
	return false
}

func workflowNodeTypeMap(def dsl.Definition) map[string]string {
	ret := make(map[string]string, len(def.Nodes))
	for _, node := range def.Nodes {
		ret[node.ID] = node.Type
	}
	return ret
}
