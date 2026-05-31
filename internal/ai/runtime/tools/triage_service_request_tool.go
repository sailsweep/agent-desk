package tools

import (
	"context"

	"agent-desk/internal/ai/runtime/graphs"
	"agent-desk/internal/ai/runtime/registry"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/toolx"

	einotool "github.com/cloudwego/eino/components/tool"
	"github.com/cloudwego/eino/schema"
	einojsonschema "github.com/eino-contrib/jsonschema"
	orderedmap "github.com/wk8/go-ordered-map/v2"
)

type TriageServiceRequestTool struct {
	conversation models.Conversation
}

func NewTriageServiceRequestTool() *TriageServiceRequestTool {
	return &TriageServiceRequestTool{}
}

func (t *TriageServiceRequestTool) Spec() toolx.ToolSpec {
	return toolx.GraphTriageServiceRequest
}

func (t *TriageServiceRequestTool) Name() string {
	return toolx.GraphTriageServiceRequest.Name
}

func (t *TriageServiceRequestTool) Code() string {
	return toolx.GraphTriageServiceRequest.Code
}

func (t *TriageServiceRequestTool) Enabled(ctx registry.Context) bool {
	return true
}

func (t *TriageServiceRequestTool) Build(ctx registry.Context) (einotool.BaseTool, error) {
	if !t.Enabled(ctx) {
		return nil, nil
	}
	return &TriageServiceRequestTool{conversation: ctx.Conversation}, nil
}

func (t *TriageServiceRequestTool) Info(ctx context.Context) (*schema.ToolInfo, error) {
	return &schema.ToolInfo{
		Name: toolx.GraphTriageServiceRequest.Name,
		Desc: "Graph Tool. Analyzes the current conversation to decide whether to continue answering, prepare a ticket draft, or hand off to a human. When ticket creation is recommended, it returns a structured ticket draft suggestion.",
		ParamsOneOf: schema.NewParamsOneOfByJSONSchema(&einojsonschema.Schema{
			Version: einojsonschema.Version,
			Type:    "object",
			Properties: orderedmap.New[string, *einojsonschema.Schema](orderedmap.WithInitialData(
				orderedmap.Pair[string, *einojsonschema.Schema]{
					Key: "goal",
					Value: &einojsonschema.Schema{
						Type:        "string",
						Description: "Analysis goal, such as whether to escalate, create a ticket, or hand off to a human.",
					},
				},
				orderedmap.Pair[string, *einojsonschema.Schema]{
					Key: "observedIssue",
					Value: &einojsonschema.Schema{
						Type:        "string",
						Description: "Main issue or dispute observed in the conversation.",
					},
				},
				orderedmap.Pair[string, *einojsonschema.Schema]{
					Key: "needTicket",
					Value: &einojsonschema.Schema{
						Type:        "boolean",
						Description: "Whether to focus on evaluating ticket creation.",
					},
				},
				orderedmap.Pair[string, *einojsonschema.Schema]{
					Key: "needHumanHandoff",
					Value: &einojsonschema.Schema{
						Type:        "boolean",
						Description: "Whether to focus on evaluating human handoff.",
					},
				},
				orderedmap.Pair[string, *einojsonschema.Schema]{
					Key: "additionalContext",
					Value: &einojsonschema.Schema{
						Type:        "string",
						Description: "Additional context, such as risk signals or constraints already identified.",
					},
				},
			)),
		}),
		Extra: map[string]any{
			"toolCode":   toolx.GraphTriageServiceRequest.Code,
			"sourceType": "graph",
		},
	}, nil
}

func (t *TriageServiceRequestTool) InvokableRun(ctx context.Context, argumentsInJSON string, opts ...einotool.Option) (string, error) {
	return graphs.NewTriageServiceRequestGraph(t.conversation).Run(ctx, argumentsInJSON)
}
