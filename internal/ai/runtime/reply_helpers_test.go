package runtime

import (
	"strings"
	"testing"

	applicationruntime "agent-desk/internal/ai/application/runtime"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/toolx"
)

func TestSummaryPrimaryToolCodePrefersToolSearchTarget(t *testing.T) {
	summary := &applicationruntime.Summary{
		InvokedToolCodes: []string{toolx.BuiltinToolSearch.Code},
		TraceData: `{
			"toolSearch": {
				"items": [
					{"targetToolCode":"mcp/server/tool_a"}
				]
			}
		}`,
	}

	if got := summaryPrimaryToolCode(summary); got != "mcp/server/tool_a" {
		t.Fatalf("unexpected primary tool code: %q", got)
	}
}

func TestToRunLogFinalAction(t *testing.T) {
	if got := toRunLogFinalAction(&applicationruntime.Summary{WorkflowVersionID: 66, ReplyText: "ok"}); got != "workflow_reply" {
		t.Fatalf("expected workflow_reply final action, got %q", got)
	}

	if got := toRunLogFinalAction(&applicationruntime.Summary{PlannedSkillID: 44, ReplyText: "ok"}); got != "skill" {
		t.Fatalf("expected skill final action, got %q", got)
	}

	graphSummary := &applicationruntime.Summary{
		ReplyText: "ok",
		TraceData: `{
			"graphTools": {
				"items": [
					{"toolCode":"` + toolx.GraphAnalyzeConversation.Code + `"}
				]
			}
		}`,
	}
	if got := toRunLogFinalAction(graphSummary); got != "graph" {
		t.Fatalf("expected graph final action, got %q", got)
	}

	if got := toRunLogFinalAction(&applicationruntime.Summary{Status: "fallback"}); got != "fallback" {
		t.Fatalf("expected fallback final action, got %q", got)
	}
}

func TestBuildRunLogPlanUsesWorkflowSummary(t *testing.T) {
	plannedAction, plannedToolCode, planReason := buildRunLogPlan(&applicationruntime.Summary{
		WorkflowVersionID: 66,
		Status:            "completed",
	})
	if plannedAction != "workflow" {
		t.Fatalf("expected workflow planned action, got %q", plannedAction)
	}
	if plannedToolCode != "workflow/66" {
		t.Fatalf("expected workflow planned tool code, got %q", plannedToolCode)
	}
	if planReason == "" {
		t.Fatalf("expected plan reason")
	}
}

func TestExtractInterruptMessageAndCheckpointError(t *testing.T) {
	if got := extractInterruptMessage(`{"message":"请补充订单号"}`); got != "请补充订单号" {
		t.Fatalf("unexpected interrupt message: %q", got)
	}
	if got := extractInterruptMessage("not-json"); got != "" {
		t.Fatalf("expected empty message for invalid json, got %q", got)
	}

	err := fakeErr("Failed to load from checkpoint: record does not exist")
	if !isCheckpointMissingError(err) {
		t.Fatalf("expected checkpoint missing error to be detected")
	}
	if isCheckpointMissingError(fakeErr("other error")) {
		t.Fatalf("expected unrelated error to be ignored")
	}
}

func TestBuildConversationInterruptStoresWorkflowCheckpointData(t *testing.T) {
	item := buildConversationInterrupt(testConversation(1), testMessage(2), testAIAgent(3), &applicationruntime.Summary{
		CheckPointData: `{"confirmNodeId":"confirm_1"}`,
		Interrupted:    true,
		Interrupts: []applicationruntime.InterruptContextSummary{
			{Type: "human_confirm", ID: "confirm_1", InfoPreview: `{"message":"请确认"}`},
		},
	})
	if item == nil {
		t.Fatalf("expected interrupt item")
	}
	if item.RequestData != `{"confirmNodeId":"confirm_1"}` {
		t.Fatalf("unexpected request data: %q", item.RequestData)
	}
}

func TestGraphPlanReason(t *testing.T) {
	summary := &applicationruntime.Summary{
		TraceData: `{
			"graphTools": {
				"items": [
					{
						"toolCode":"` + toolx.GraphTriageServiceRequest.Code + `",
						"recommendedAction":"create_ticket",
						"ticketDraftReady": true
					}
				]
			}
		}`,
	}
	got := graphPlanReason(summary)
	if !strings.Contains(got, "create_ticket") || !strings.Contains(got, "ready ticket draft") {
		t.Fatalf("unexpected graph plan reason: %q", got)
	}
}

func TestExtractHandoffReason(t *testing.T) {
	summary := &applicationruntime.Summary{
		TraceData: `{
			"graphTools": {
				"items": [
					{
						"toolCode":"` + toolx.GraphHandoffConversation.Code + `",
						"arguments":{"reason":"  用户明确要求人工处理  "}
					}
				]
			}
		}`,
	}
	if got := extractHandoffReason(summary); got != "用户明确要求人工处理" {
		t.Fatalf("unexpected handoff reason: %q", got)
	}
}

type fakeErr string

func (e fakeErr) Error() string {
	return string(e)
}

func testConversation(id int64) models.Conversation {
	return models.Conversation{ID: id}
}

func testMessage(id int64) models.Message {
	return models.Message{ID: id}
}

func testAIAgent(id int64) models.AIAgent {
	return models.AIAgent{ID: id}
}
