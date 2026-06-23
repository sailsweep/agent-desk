package runtime

import (
	"encoding/json"
	"strings"

	applicationruntime "agent-desk/internal/ai/application/runtime"
)

func runtimeTraceFinalAction(summary *applicationruntime.Summary) string {
	if summary == nil {
		return ""
	}
	switch strings.TrimSpace(summary.Status) {
	case "completed":
		if strings.TrimSpace(summary.ReplyText) != "" {
			return "reply"
		}
		return "completed"
	case "fallback":
		return "fallback"
	case "error":
		return "error"
	case "interrupted":
		return "interrupted"
	case "expired":
		return "expired"
	default:
		return strings.TrimSpace(summary.Status)
	}
}

func extractToolSearchTrace(summary *applicationruntime.Summary) string {
	if summary == nil {
		return ""
	}
	trace := parseRuntimeTraceData(summary.TraceData)
	if len(trace.ToolSearch.Items) == 0 {
		return ""
	}
	buf, err := json.Marshal(trace.ToolSearch)
	if err != nil {
		return ""
	}
	return string(buf)
}

func extractGraphToolTrace(summary *applicationruntime.Summary) string {
	if summary == nil {
		return ""
	}
	trace := parseRuntimeTraceData(summary.TraceData)
	if len(trace.GraphTools.Items) == 0 {
		return ""
	}
	buf, err := json.Marshal(trace.GraphTools)
	if err != nil {
		return ""
	}
	return string(buf)
}

func firstGraphToolCode(summary *applicationruntime.Summary) string {
	if summary == nil {
		return ""
	}
	trace := parseRuntimeTraceData(summary.TraceData)
	for _, item := range trace.GraphTools.Items {
		toolCode := strings.TrimSpace(item.ToolCode)
		if toolCode != "" {
			return toolCode
		}
	}
	return ""
}

type runtimeTraceProjection struct {
	ToolSearch struct {
		Items []struct {
			TargetToolCode     string   `json:"targetToolCode"`
			CandidateToolCodes []string `json:"candidateToolCodes"`
		} `json:"items"`
	} `json:"toolSearch"`
	GraphTools struct {
		Items []struct {
			ToolCode          string          `json:"toolCode"`
			Arguments         json.RawMessage `json:"arguments"`
			RecommendedAction string          `json:"recommendedAction"`
			RiskLevel         string          `json:"riskLevel"`
			TicketDraftReady  bool            `json:"ticketDraftReady"`
		} `json:"items"`
	} `json:"graphTools"`
}

func parseRuntimeTraceData(raw string) runtimeTraceProjection {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return runtimeTraceProjection{}
	}
	var trace runtimeTraceProjection
	if err := json.Unmarshal([]byte(raw), &trace); err != nil {
		return runtimeTraceProjection{}
	}
	return trace
}
