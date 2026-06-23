package runtime

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	workflowexecutor "agent-desk/internal/ai/runtime/workflow"
	"agent-desk/internal/ai/workflow/dsl"
	workflowregistry "agent-desk/internal/ai/workflow/registry"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestToWorkflowSummaryPreservesInterruptCheckpoint(t *testing.T) {
	summary := toWorkflowSummary(&workflowexecutor.Result{
		Status:         "interrupted",
		CheckPointID:   "workflow:1:2:confirm_1",
		CheckPointData: `{"confirmNodeId":"confirm_1"}`,
		Interrupted:    true,
		Interrupts: []workflowexecutor.InterruptSummary{
			{Type: "human_confirm", ID: "confirm_1", InfoPreview: `{"message":"请确认"}`},
		},
	}, "test-model")

	if summary == nil || !summary.Interrupted {
		t.Fatalf("expected interrupted summary, got %#v", summary)
	}
	if summary.CheckPointID != "workflow:1:2:confirm_1" {
		t.Fatalf("unexpected checkpoint id: %q", summary.CheckPointID)
	}
	if summary.CheckPointData == "" {
		t.Fatalf("expected checkpoint data")
	}
	if len(summary.Interrupts) != 1 || summary.Interrupts[0].ID != "confirm_1" {
		t.Fatalf("unexpected interrupts: %#v", summary.Interrupts)
	}
}

func TestServiceResumeUsesWorkflowCheckpointData(t *testing.T) {
	db := setupWorkflowResumeTestDB(t)
	def := runtimeHumanConfirmDefinition()
	definitionJSON := mustMarshalDefinition(t, def)
	version := models.AIWorkflowVersion{
		WorkflowID: 1,
		Version:    1,
		Status:     enums.StatusOk,
		Definition: definitionJSON,
	}
	if err := db.Create(&version).Error; err != nil {
		t.Fatalf("create workflow version: %v", err)
	}
	checkpointData := mustMarshalWorkflowCheckpoint(t, def)
	if err := db.Create(&models.ConversationInterrupt{
		ConversationID: 1,
		AIAgentID:      1,
		CheckPointID:   "workflow:1:2:confirm_1",
		RequestData:    checkpointData,
		Status:         "pending",
	}).Error; err != nil {
		t.Fatalf("create interrupt: %v", err)
	}

	summary, err := NewService().Resume(context.Background(), ResumeRequest{
		Conversation: models.Conversation{ID: 1},
		AIAgent: models.AIAgent{
			ID:                1,
			WorkflowVersionID: version.ID,
		},
		AIConfig:     models.AIConfig{ModelName: "test-model"},
		CheckPointID: "workflow:1:2:confirm_1",
		ResumeData: map[string]string{
			"confirm_1": "确认",
		},
	})
	if err != nil {
		t.Fatalf("resume workflow: %v", err)
	}
	if summary == nil || summary.Status != "completed" || summary.Interrupted {
		t.Fatalf("unexpected summary: %#v", summary)
	}
}

func setupWorkflowResumeTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dbName := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open("file:"+dbName+"?mode=memory&cache=shared"), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{
			TablePrefix:   "t_",
			SingularTable: true,
		},
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	if err := db.AutoMigrate(&models.AIWorkflowVersion{}, &models.ConversationInterrupt{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
	return db
}

func runtimeHumanConfirmDefinition() dsl.Definition {
	return dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start_1",
		Nodes: []dsl.Node{
			{ID: "start_1", Type: workflowregistry.NodeTypeStart, Name: "Start"},
			{ID: "prompt_1", Type: workflowregistry.NodeTypeLLMReply, Name: "Prompt", Config: []byte(`{"staticReply":"请确认"}`)},
			{ID: "confirm_1", Type: workflowregistry.NodeTypeHumanConfirm, Name: "Confirm", Inputs: map[string]dsl.VariableSelector{
				"prompt": {NodeID: "prompt_1", Field: "replyText"},
			}},
			{ID: "end_1", Type: workflowregistry.NodeTypeEnd, Name: "End"},
		},
		Edges: []dsl.Edge{
			{ID: "edge_start_prompt", Source: "start_1", Target: "prompt_1"},
			{ID: "edge_prompt_confirm", Source: "prompt_1", Target: "confirm_1"},
			{ID: "edge_confirm_end", Source: "confirm_1", Target: "end_1"},
		},
	}
}

func mustMarshalDefinition(t *testing.T, def dsl.Definition) string {
	t.Helper()
	buf, err := json.Marshal(def)
	if err != nil {
		t.Fatalf("marshal definition: %v", err)
	}
	return string(buf)
}

func mustMarshalWorkflowCheckpoint(t *testing.T, def dsl.Definition) string {
	t.Helper()
	buf, err := json.Marshal(struct {
		Definition    dsl.Definition            `json:"definition"`
		ConfirmNodeID string                    `json:"confirmNodeId"`
		Vars          map[string]map[string]any `json:"vars"`
	}{
		Definition:    def,
		ConfirmNodeID: "confirm_1",
		Vars: map[string]map[string]any{
			"start_1":  {"userMessage": "创建工单"},
			"prompt_1": {"replyText": "请确认"},
		},
	})
	if err != nil {
		t.Fatalf("marshal checkpoint: %v", err)
	}
	return string(buf)
}
