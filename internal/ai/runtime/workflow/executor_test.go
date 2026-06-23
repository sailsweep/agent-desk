package workflow

import (
	"context"
	"strings"
	"testing"
	"time"

	"agent-desk/internal/ai/workflow/dsl"
	workflowregistry "agent-desk/internal/ai/workflow/registry"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/services"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestExecutorRoutesByConditionEdge(t *testing.T) {
	executor := NewExecutor()
	result, err := executor.Execute(context.Background(), Input{
		Definition: conditionalReplyDefinition(),
		UserMessage: models.Message{
			Content: "vip",
		},
	})
	if err != nil {
		t.Fatalf("execute workflow: %v", err)
	}
	if result.ReplyText != "VIP reply" {
		t.Fatalf("unexpected reply: %q", result.ReplyText)
	}
	assertPath(t, result.NodePath, []string{"start_1", "condition_1", "vip_reply", "send_vip", "end_1"})
}

func TestExecutorUsesDefaultEdgeWhenConditionDoesNotMatch(t *testing.T) {
	executor := NewExecutor()
	result, err := executor.Execute(context.Background(), Input{
		Definition: conditionalReplyDefinition(),
		UserMessage: models.Message{
			Content: "normal",
		},
	})
	if err != nil {
		t.Fatalf("execute workflow: %v", err)
	}
	if result.ReplyText != "Normal reply" {
		t.Fatalf("unexpected reply: %q", result.ReplyText)
	}
	assertPath(t, result.NodePath, []string{"start_1", "condition_1", "normal_reply", "send_normal", "end_1"})
}

func TestExecutorHandoffToHumanRunsRealDispatchAction(t *testing.T) {
	db := setupWorkflowExecutorHandoffDB(t)
	aiAgent := createWorkflowExecutorHandoffAIAgent(t, db, "1")
	createWorkflowExecutorHandoffTeam(t, db, 1, "售后支持组")
	createWorkflowExecutorHandoffActiveSchedule(t, db, 1)
	createWorkflowExecutorHandoffAgentProfile(t, db, 101, 1)
	conversation := createWorkflowExecutorHandoffConversation(t, db, aiAgent.ID)
	userMessage := createWorkflowExecutorCustomerMessage(t, db, conversation.ID, "需要人工处理")

	result, err := NewExecutor().Execute(context.Background(), Input{
		Definition:   handoffWorkflowDefinition(),
		Conversation: conversation,
		UserMessage:  userMessage,
		AIAgent:      aiAgent,
	})
	if err != nil {
		t.Fatalf("execute workflow: %v", err)
	}
	if strings.TrimSpace(result.ReplyText) != "" {
		t.Fatalf("expected workflow handoff node to avoid duplicate reply text, got %q", result.ReplyText)
	}
	assertPath(t, result.NodePath, []string{"start_1", "handoff_1", "assigned_end"})

	current := services.ConversationService.Get(conversation.ID)
	if current.Status != enums.IMConversationStatusActive {
		t.Fatalf("expected active conversation, got status=%d", current.Status)
	}
	if current.CurrentAssigneeID != 101 || current.CurrentTeamID != 1 {
		t.Fatalf("unexpected assignment: assignee=%d team=%d", current.CurrentAssigneeID, current.CurrentTeamID)
	}
	if current.HandoffAt == nil || current.HandoffReason != "需要人工处理" {
		t.Fatalf("expected handoff metadata, got at=%v reason=%q", current.HandoffAt, current.HandoffReason)
	}

	notice := services.MessageService.FindOne(sqls.NewCnd().Eq("conversation_id", conversation.ID).Eq("sender_type", enums.IMSenderTypeAI).Desc("id"))
	if notice == nil || strings.TrimSpace(notice.Content) == "" {
		t.Fatalf("expected handoff service to send ai notice, got %+v", notice)
	}
}

func TestExecutorAnalyzeConversationOutputsBranchVariables(t *testing.T) {
	db := setupWorkflowExecutorHandoffDB(t)
	aiAgent := createWorkflowExecutorHandoffAIAgent(t, db, "1")
	conversation := createWorkflowExecutorHandoffConversation(t, db, aiAgent.ID)
	userMessage := createWorkflowExecutorCustomerMessage(t, db, conversation.ID, "你们重复扣费了，我要投诉并转人工")

	result, err := NewExecutor().Execute(context.Background(), Input{
		Definition:   analyzeConversationWorkflowDefinition(),
		Conversation: conversation,
		UserMessage:  userMessage,
		AIAgent:      aiAgent,
	})
	if err != nil {
		t.Fatalf("execute workflow: %v", err)
	}
	assertPath(t, result.NodePath, []string{"start_1", "analyze_1", "handoff_end"})
}

func conditionalReplyDefinition() dsl.Definition {
	return dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start_1",
		Nodes: []dsl.Node{
			{ID: "start_1", Type: workflowregistry.NodeTypeStart, Name: "Start"},
			{ID: "condition_1", Type: workflowregistry.NodeTypeCondition, Name: "Route"},
			{ID: "vip_reply", Type: workflowregistry.NodeTypeLLMReply, Name: "VIP", Config: []byte(`{"staticReply":"VIP reply"}`)},
			{ID: "normal_reply", Type: workflowregistry.NodeTypeLLMReply, Name: "Normal", Config: []byte(`{"staticReply":"Normal reply"}`)},
			{ID: "send_vip", Type: workflowregistry.NodeTypeSendReply, Name: "Send VIP", Inputs: map[string]dsl.VariableSelector{
				"replyText": {NodeID: "vip_reply", Field: "replyText"},
			}},
			{ID: "send_normal", Type: workflowregistry.NodeTypeSendReply, Name: "Send Normal", Inputs: map[string]dsl.VariableSelector{
				"replyText": {NodeID: "normal_reply", Field: "replyText"},
			}},
			{ID: "end_1", Type: workflowregistry.NodeTypeEnd, Name: "End"},
		},
		Edges: []dsl.Edge{
			{ID: "edge_start_condition", Source: "start_1", Target: "condition_1"},
			{
				ID:     "edge_condition_vip",
				Source: "condition_1",
				Target: "vip_reply",
				Condition: &dsl.Condition{
					Left:     &dsl.VariableSelector{NodeID: "start_1", Field: "userMessage"},
					Operator: "eq",
					Right:    "vip",
				},
			},
			{ID: "edge_condition_default", Source: "condition_1", Target: "normal_reply"},
			{ID: "edge_vip_send", Source: "vip_reply", Target: "send_vip"},
			{ID: "edge_normal_send", Source: "normal_reply", Target: "send_normal"},
			{ID: "edge_send_vip_end", Source: "send_vip", Target: "end_1"},
			{ID: "edge_send_normal_end", Source: "send_normal", Target: "end_1"},
		},
	}
}

func analyzeConversationWorkflowDefinition() dsl.Definition {
	return dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start_1",
		Nodes: []dsl.Node{
			{ID: "start_1", Type: workflowregistry.NodeTypeStart, Name: "Start"},
			{ID: "analyze_1", Type: workflowregistry.NodeTypeAnalyzeConversation, Name: "Analyze", Inputs: map[string]dsl.VariableSelector{
				"userMessage": {NodeID: "start_1", Field: "userMessage"},
			}},
			{ID: "handoff_end", Type: workflowregistry.NodeTypeEnd, Name: "Handoff"},
			{ID: "default_end", Type: workflowregistry.NodeTypeEnd, Name: "Default"},
		},
		Edges: []dsl.Edge{
			{ID: "edge_start_analyze", Source: "start_1", Target: "analyze_1"},
			{
				ID:     "edge_analyze_handoff",
				Source: "analyze_1",
				Target: "handoff_end",
				Condition: &dsl.Condition{
					Left:     &dsl.VariableSelector{NodeID: "analyze_1", Field: "needHumanHandoff"},
					Operator: "is_true",
				},
			},
			{ID: "edge_analyze_default", Source: "analyze_1", Target: "default_end"},
		},
	}
}

func handoffWorkflowDefinition() dsl.Definition {
	return dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start_1",
		Nodes: []dsl.Node{
			{ID: "start_1", Type: workflowregistry.NodeTypeStart, Name: "Start"},
			{ID: "handoff_1", Type: workflowregistry.NodeTypeHandoffToHuman, Name: "Handoff", Inputs: map[string]dsl.VariableSelector{
				"reason": {NodeID: "start_1", Field: "userMessage"},
			}},
			{ID: "assigned_end", Type: workflowregistry.NodeTypeEnd, Name: "Assigned"},
			{ID: "default_end", Type: workflowregistry.NodeTypeEnd, Name: "Default"},
		},
		Edges: []dsl.Edge{
			{ID: "edge_start_handoff", Source: "start_1", Target: "handoff_1"},
			{
				ID:     "edge_handoff_assigned",
				Source: "handoff_1",
				Target: "assigned_end",
				Condition: &dsl.Condition{
					Left:     &dsl.VariableSelector{NodeID: "handoff_1", Field: "decision"},
					Operator: "eq",
					Right:    string(services.HandoffDecisionAssigned),
				},
			},
			{ID: "edge_handoff_default", Source: "handoff_1", Target: "default_end"},
		},
	}
}

func setupWorkflowExecutorHandoffDB(t *testing.T) *gorm.DB {
	t.Helper()
	dbName := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open("file:"+dbName+"?mode=memory&cache=shared"), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{
			TablePrefix:   "t_",
			SingularTable: true,
		},
	})
	if err != nil {
		t.Fatalf("open sqlite error = %v", err)
	}
	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	if err := db.AutoMigrate(
		&models.User{},
		&models.AIAgent{},
		&models.AgentTeam{},
		&models.AgentTeamSchedule{},
		&models.AgentProfile{},
		&models.Conversation{},
		&models.ConversationAssignment{},
		&models.ConversationEventLog{},
		&models.ConversationReadState{},
		&models.Message{},
		&models.ChannelMessageOutbox{},
	); err != nil {
		t.Fatalf("auto migrate error = %v", err)
	}
	sqls.SetDB(db)
	return db
}

func createWorkflowExecutorHandoffAIAgent(t *testing.T, db *gorm.DB, teamIDs string) models.AIAgent {
	t.Helper()
	item := models.AIAgent{
		Name:        "测试AI",
		ServiceMode: enums.IMConversationServiceModeAIFirst,
		TeamIDs:     teamIDs,
		Status:      enums.StatusOk,
	}
	if err := db.Create(&item).Error; err != nil {
		t.Fatalf("create ai agent error = %v", err)
	}
	return item
}

func createWorkflowExecutorHandoffTeam(t *testing.T, db *gorm.DB, id int64, name string) {
	t.Helper()
	if err := db.Create(&models.AgentTeam{ID: id, Name: name, Status: enums.StatusOk}).Error; err != nil {
		t.Fatalf("create team error = %v", err)
	}
}

func createWorkflowExecutorHandoffActiveSchedule(t *testing.T, db *gorm.DB, teamID int64) {
	t.Helper()
	now := time.Now()
	if err := db.Create(&models.AgentTeamSchedule{
		TeamID:  teamID,
		StartAt: now.Add(-time.Hour),
		EndAt:   now.Add(time.Hour),
		Status:  enums.StatusOk,
	}).Error; err != nil {
		t.Fatalf("create schedule error = %v", err)
	}
}

func createWorkflowExecutorHandoffAgentProfile(t *testing.T, db *gorm.DB, userID int64, teamID int64) {
	t.Helper()
	if err := db.Create(&models.User{
		ID:       userID,
		Username: "agent",
		Nickname: "客服",
		Status:   enums.StatusOk,
	}).Error; err != nil {
		t.Fatalf("create user error = %v", err)
	}
	if err := db.Create(&models.AgentProfile{
		UserID:             userID,
		TeamID:             teamID,
		AgentCode:          "A001",
		DisplayName:        "客服",
		ServiceStatus:      enums.ServiceStatusIdle,
		MaxConcurrentCount: 3,
		AutoAssignEnabled:  true,
		Status:             enums.StatusOk,
	}).Error; err != nil {
		t.Fatalf("create profile error = %v", err)
	}
}

func createWorkflowExecutorHandoffConversation(t *testing.T, db *gorm.DB, aiAgentID int64) models.Conversation {
	t.Helper()
	now := time.Now()
	item := models.Conversation{
		AIAgentID:     aiAgentID,
		ChannelID:     1,
		CustomerID:    1,
		CustomerName:  "测试访客",
		Status:        enums.IMConversationStatusAIServing,
		ServiceMode:   enums.IMConversationServiceModeAIFirst,
		LastMessageAt: now,
		LastActiveAt:  now,
	}
	if err := db.Create(&item).Error; err != nil {
		t.Fatalf("create conversation error = %v", err)
	}
	return item
}

func createWorkflowExecutorCustomerMessage(t *testing.T, db *gorm.DB, conversationID int64, content string) models.Message {
	t.Helper()
	now := time.Now()
	item := models.Message{
		ConversationID: conversationID,
		ClientMsgID:    "customer-message",
		SenderType:     enums.IMSenderTypeCustomer,
		MessageType:    enums.IMMessageTypeText,
		Content:        content,
		SeqNo:          1,
		SendStatus:     enums.IMMessageStatusSent,
		SentAt:         &now,
	}
	if err := db.Create(&item).Error; err != nil {
		t.Fatalf("create message error = %v", err)
	}
	return item
}

func assertPath(t *testing.T, got []string, want []string) {
	t.Helper()
	if len(got) != len(want) {
		t.Fatalf("unexpected path length: got %#v want %#v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("unexpected path: got %#v want %#v", got, want)
		}
	}
}
