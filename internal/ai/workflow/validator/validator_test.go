package validator_test

import (
	"encoding/json"
	"strings"
	"testing"

	"agent-desk/internal/ai/workflow/dsl"
	"agent-desk/internal/ai/workflow/registry"
	"agent-desk/internal/ai/workflow/validator"
)

func TestValidateDefinitionAcceptsMinimalConversationFlow(t *testing.T) {
	result := validator.ValidateDefinition(minimalDefinition(), registry.DefaultRegistry())

	if !result.Valid {
		t.Fatalf("expected valid definition, got errors: %#v", result.Errors)
	}
}

func TestValidateDefinitionRejectsMissingStart(t *testing.T) {
	def := minimalDefinition()
	def.Nodes = []dsl.Node{
		{ID: "reply_1", Type: "send_reply", Config: json.RawMessage(`{"text":"hello"}`)},
		{ID: "end_1", Type: "end"},
	}

	result := validator.ValidateDefinition(def, registry.DefaultRegistry())

	if result.Valid {
		t.Fatalf("expected missing start to be invalid")
	}
	if !hasValidationMessage(result, "exactly one start node") {
		t.Fatalf("expected start error, got %#v", result.Errors)
	}
}

func TestValidateDefinitionRejectsUnknownNodeType(t *testing.T) {
	def := minimalDefinition()
	def.Nodes = append(def.Nodes, dsl.Node{ID: "unknown_1", Type: "unknown_node"})
	def.Edges = append(def.Edges, dsl.Edge{ID: "e3", Source: "reply_1", Target: "unknown_1"})

	result := validator.ValidateDefinition(def, registry.DefaultRegistry())

	if result.Valid {
		t.Fatalf("expected unknown node type to be invalid")
	}
	if !hasValidationMessage(result, "unknown node type") {
		t.Fatalf("expected unknown-node error, got %#v", result.Errors)
	}
}

func TestValidateDefinitionRejectsUnguardedCreateTicket(t *testing.T) {
	def := dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start_1",
		Nodes: []dsl.Node{
			{ID: "start_1", Type: "start"},
			{ID: "draft_1", Type: "prepare_ticket_draft"},
			{ID: "create_1", Type: "create_ticket"},
			{ID: "end_1", Type: "end"},
		},
		Edges: []dsl.Edge{
			{ID: "e1", Source: "start_1", Target: "draft_1"},
			{ID: "e2", Source: "draft_1", Target: "create_1"},
			{ID: "e3", Source: "create_1", Target: "end_1"},
		},
	}

	result := validator.ValidateDefinition(def, registry.DefaultRegistry())

	if result.Valid {
		t.Fatalf("expected unguarded create_ticket to be invalid")
	}
	if !hasValidationMessage(result, "requires human_confirm") {
		t.Fatalf("expected confirmation guard error, got %#v", result.Errors)
	}
}

func TestValidateDefinitionAcceptsConfirmedCreateTicket(t *testing.T) {
	def := dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start_1",
		Nodes: []dsl.Node{
			{ID: "start_1", Type: "start"},
			{ID: "draft_1", Type: "prepare_ticket_draft"},
			{ID: "confirm_1", Type: "human_confirm"},
			{ID: "create_1", Type: "create_ticket"},
			{ID: "end_1", Type: "end"},
		},
		Edges: []dsl.Edge{
			{ID: "e1", Source: "start_1", Target: "draft_1"},
			{ID: "e2", Source: "draft_1", Target: "confirm_1"},
			{ID: "e3", Source: "confirm_1", Target: "create_1"},
			{ID: "e4", Source: "create_1", Target: "end_1"},
		},
	}

	result := validator.ValidateDefinition(def, registry.DefaultRegistry())

	if !result.Valid {
		t.Fatalf("expected confirmed create_ticket to be valid, got %#v", result.Errors)
	}
}

func minimalDefinition() dsl.Definition {
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

func hasValidationMessage(result validator.Result, want string) bool {
	for _, item := range result.Errors {
		if strings.Contains(item.Message, want) {
			return true
		}
	}
	return false
}
