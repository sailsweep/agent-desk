package runtime

import (
	"context"
	"encoding/json"
	"strings"
	"testing"

	"agent-desk/internal/ai/workflow/dsl"
	workflowregistry "agent-desk/internal/ai/workflow/registry"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/toolx"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

func TestNormalizeAllowedToolCodes(t *testing.T) {
	ret := toolx.NormalizeToolCodes([]string{
		" ",
		"graph/create_ticket_with_confirmation",
		"builtin/create_ticket_with_confirmation",
		"graph/handoff_to_human",
		"graph/handoff_to_human",
	})
	if len(ret) != 2 {
		t.Fatalf("expected 2 tool codes, got %d: %#v", len(ret), ret)
	}
	if ret[0] != "graph/create_ticket_with_confirmation" {
		t.Fatalf("unexpected first tool code: %s", ret[0])
	}
	if ret[1] != "graph/handoff_to_human" {
		t.Fatalf("unexpected second tool code: %s", ret[1])
	}
}

func TestToolCatalogResolveAllowedToolCodes(t *testing.T) {
	catalog := newToolCatalog()
	agent := models.AIAgent{
		AllowedMCPTools: `[{"toolCode":"graph/create_ticket_with_confirmation"},{"toolCode":"graph/handoff_to_human"}]`,
	}
	skill := &models.SkillDefinition{
		ToolWhitelist: `["builtin/create_ticket_with_confirmation","graph/prepare_ticket_draft"]`,
	}
	ret := catalog.resolveAllowedToolCodes(agent, skill)
	if len(ret) != 1 {
		t.Fatalf("expected 1 tool code, got %d: %#v", len(ret), ret)
	}
	if ret[0] != "graph/create_ticket_with_confirmation" {
		t.Fatalf("unexpected tool code: %s", ret[0])
	}
}

func TestToolCatalogResolveAllowedToolCodesFallsBackWhenSkillEmpty(t *testing.T) {
	catalog := newToolCatalog()
	agent := models.AIAgent{
		AllowedMCPTools: `[{"toolCode":"graph/create_ticket_with_confirmation"},{"toolCode":"graph/handoff_to_human"}]`,
	}
	ret := catalog.resolveAllowedToolCodes(agent, nil)
	if len(ret) != 2 {
		t.Fatalf("expected 2 tool codes, got %d: %#v", len(ret), ret)
	}
}

func TestBuildRuntimeStaticTools(t *testing.T) {
	ret := buildRuntimeStaticTools()
	if len(ret) != len(toolx.ListRuntimeStaticToolSpecs()) {
		t.Fatalf("expected %d runtime static tools, got %d", len(toolx.ListRuntimeStaticToolSpecs()), len(ret))
	}
}

func TestToolCatalogIncludesPublishedWorkflowGraphTools(t *testing.T) {
	setupWorkflowRuntimeTestDB(t)
	version := createWorkflowRuntimeTestVersion(t, dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start",
		Nodes: []dsl.Node{
			{ID: "start", Type: workflowregistry.NodeTypeStart, Name: "Start"},
			{ID: "draft", Type: workflowregistry.NodeTypePrepareTicketDraft, Name: "Draft Ticket"},
			{ID: "create", Type: workflowregistry.NodeTypeCreateTicket, Name: "Create Ticket"},
			{ID: "handoff", Type: workflowregistry.NodeTypeHandoffToHuman, Name: "Handoff"},
		},
	})

	catalog := newToolCatalog()
	ret := catalog.parseAgentAllowedToolCodes(models.AIAgent{
		WorkflowVersionID: version.ID,
	})

	assertContainsToolCode(t, ret, toolx.GraphPrepareTicketDraft.Code)
	assertContainsToolCode(t, ret, toolx.GraphCreateTicketConfirm.Code)
	assertContainsToolCode(t, ret, toolx.GraphHandoffConversation.Code)
}

func TestPrepareWorkflowAgentAppendsPublishedWorkflow(t *testing.T) {
	setupWorkflowRuntimeTestDB(t)
	version := createWorkflowRuntimeTestVersion(t, dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start",
		Nodes: []dsl.Node{
			{ID: "start", Type: workflowregistry.NodeTypeStart, Name: "Start"},
			{ID: "handoff", Type: workflowregistry.NodeTypeHandoffToHuman, Name: "Handoff"},
		},
	})

	agent, _, err := prepareWorkflowAgent(models.AIAgent{
		SystemPrompt:      "Base prompt.",
		WorkflowVersionID: version.ID,
	})
	if err != nil {
		t.Fatalf("prepare workflow agent: %v", err)
	}
	if agent.SystemPrompt == "Base prompt." {
		t.Fatalf("expected workflow appendix to be appended")
	}
	if !strings.Contains(agent.SystemPrompt, "Published customer-service workflow") {
		t.Fatalf("missing workflow appendix: %s", agent.SystemPrompt)
	}
}

func TestPrepareWorkflowAgentRejectsMissingPublishedWorkflow(t *testing.T) {
	_, _, err := prepareWorkflowAgent(models.AIAgent{})
	if err == nil {
		t.Fatalf("expected missing workflow version error")
	}
	if !strings.Contains(err.Error(), "workflow version is required") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestPrepareWorkflowAgentRejectsDeletedPublishedWorkflow(t *testing.T) {
	setupWorkflowRuntimeTestDB(t)
	version := createWorkflowRuntimeTestVersion(t, dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start",
		Nodes: []dsl.Node{
			{ID: "start", Type: workflowregistry.NodeTypeStart, Name: "Start"},
			{ID: "end", Type: workflowregistry.NodeTypeEnd, Name: "End"},
		},
	})
	if err := sqls.DB().Model(&models.AIWorkflowVersion{}).Where("id = ?", version.ID).Update("status", enums.StatusDeleted).Error; err != nil {
		t.Fatalf("delete workflow version: %v", err)
	}

	_, _, err := prepareWorkflowAgent(models.AIAgent{WorkflowVersionID: version.ID})
	if err == nil {
		t.Fatalf("expected invalid workflow version error")
	}
	if !strings.Contains(err.Error(), "workflow version does not exist") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestServiceRunExecutesPublishedWorkflow(t *testing.T) {
	setupWorkflowRuntimeTestDB(t)
	version := createWorkflowRuntimeTestVersion(t, dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start_1",
		Nodes: []dsl.Node{
			{ID: "start_1", Type: workflowregistry.NodeTypeStart, Name: "Start"},
			{ID: "reply_1", Type: workflowregistry.NodeTypeLLMReply, Name: "Reply", Config: []byte(`{"staticReply":"workflow reply"}`)},
			{ID: "send_1", Type: workflowregistry.NodeTypeSendReply, Name: "Send", Inputs: map[string]dsl.VariableSelector{
				"replyText": {NodeID: "reply_1", Field: "replyText"},
			}},
			{ID: "end_1", Type: workflowregistry.NodeTypeEnd, Name: "End"},
		},
		Edges: []dsl.Edge{
			{ID: "edge_start_reply", Source: "start_1", Target: "reply_1"},
			{ID: "edge_reply_send", Source: "reply_1", Target: "send_1"},
			{ID: "edge_send_end", Source: "send_1", Target: "end_1"},
		},
	})

	summary, err := NewService().Run(context.Background(), Request{
		UserMessage: models.Message{Content: "hello"},
		AIAgent: models.AIAgent{
			WorkflowVersionID: version.ID,
		},
	})
	if err != nil {
		t.Fatalf("run workflow: %v", err)
	}
	if summary.ReplyText != "workflow reply" {
		t.Fatalf("unexpected workflow reply: %q", summary.ReplyText)
	}
	var runCount int64
	if err := sqls.DB().Model(&models.AIWorkflowRun{}).Count(&runCount).Error; err != nil {
		t.Fatalf("count workflow runs: %v", err)
	}
	if runCount != 1 {
		t.Fatalf("expected one workflow run, got %d", runCount)
	}
	var nodeRunCount int64
	if err := sqls.DB().Model(&models.AIWorkflowNodeRun{}).Count(&nodeRunCount).Error; err != nil {
		t.Fatalf("count workflow node runs: %v", err)
	}
	if nodeRunCount != 4 {
		t.Fatalf("expected four workflow node runs, got %d", nodeRunCount)
	}
	var replyNodeRun models.AIWorkflowNodeRun
	if err := sqls.DB().First(&replyNodeRun, "node_id = ?", "reply_1").Error; err != nil {
		t.Fatalf("find reply node run: %v", err)
	}
	if replyNodeRun.InputPreview == "" || replyNodeRun.OutputPreview == "" {
		t.Fatalf("expected node input/output previews, got input=%q output=%q", replyNodeRun.InputPreview, replyNodeRun.OutputPreview)
	}
	if !strings.Contains(replyNodeRun.OutputPreview, "workflow reply") {
		t.Fatalf("expected reply output preview, got %q", replyNodeRun.OutputPreview)
	}
	if replyNodeRun.DurationMS < 0 {
		t.Fatalf("unexpected negative duration: %d", replyNodeRun.DurationMS)
	}
}

func setupWorkflowRuntimeTestDB(t *testing.T) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}
	if err := db.AutoMigrate(&models.AIWorkflowVersion{}, &models.AIWorkflowRun{}, &models.AIWorkflowNodeRun{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
}

func createWorkflowRuntimeTestVersion(t *testing.T, def dsl.Definition) *models.AIWorkflowVersion {
	t.Helper()
	definition, err := json.Marshal(def)
	if err != nil {
		t.Fatalf("marshal definition: %v", err)
	}
	version := &models.AIWorkflowVersion{
		WorkflowID: 1,
		Version:    1,
		Status:     enums.StatusOk,
		Definition: string(definition),
	}
	if err := sqls.DB().Create(version).Error; err != nil {
		t.Fatalf("create workflow version: %v", err)
	}
	return version
}

func assertContainsToolCode(t *testing.T, items []string, want string) {
	t.Helper()
	for _, item := range items {
		if item == want {
			return
		}
	}
	t.Fatalf("expected tool code %s in %#v", want, items)
}
