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

type AnalyzeConversationTool struct {
	conversation models.Conversation
}

func NewAnalyzeConversationTool() *AnalyzeConversationTool {
	return &AnalyzeConversationTool{}
}

func (t *AnalyzeConversationTool) Spec() toolx.ToolSpec {
	return toolx.GraphAnalyzeConversation
}

func (t *AnalyzeConversationTool) Name() string {
	return toolx.GraphAnalyzeConversation.Name
}

func (t *AnalyzeConversationTool) Code() string {
	return toolx.GraphAnalyzeConversation.Code
}

func (t *AnalyzeConversationTool) Enabled(ctx registry.Context) bool {
	return true
}

func (t *AnalyzeConversationTool) Build(ctx registry.Context) (einotool.BaseTool, error) {
	if !t.Enabled(ctx) {
		return nil, nil
	}
	return &AnalyzeConversationTool{conversation: ctx.Conversation}, nil
}

func (t *AnalyzeConversationTool) Info(ctx context.Context) (*schema.ToolInfo, error) {
	return &schema.ToolInfo{
		Name: toolx.GraphAnalyzeConversation.Name,
		Desc: "Graph Tool. Summarizes the current conversation, identifies complaint/payment/sentiment risk signals, and recommends whether to continue answering, create a ticket, or hand off to a human.",
		ParamsOneOf: schema.NewParamsOneOfByJSONSchema(&einojsonschema.Schema{
			Version: einojsonschema.Version,
			Type:    "object",
			Properties: orderedmap.New[string, *einojsonschema.Schema](orderedmap.WithInitialData(
				orderedmap.Pair[string, *einojsonschema.Schema]{
					Key: "goal",
					Value: &einojsonschema.Schema{
						Type:        "string",
						Description: "Analysis goal, such as whether to hand off to a human, create a ticket, or perform risk review.",
					},
				},
				orderedmap.Pair[string, *einojsonschema.Schema]{
					Key: "observedIssue",
					Value: &einojsonschema.Schema{
						Type:        "string",
						Description: "Main issue or request observed in the conversation.",
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
					Key: "needQualityCheck",
					Value: &einojsonschema.Schema{
						Type:        "boolean",
						Description: "Whether to focus on risk or quality review.",
					},
				},
				orderedmap.Pair[string, *einojsonschema.Schema]{
					Key: "additionalContext",
					Value: &einojsonschema.Schema{
						Type:        "string",
						Description: "Additional context, such as disputes, complaint points, or business constraints already identified.",
					},
				},
			)),
		}),
		Extra: map[string]any{
			"toolCode":   toolx.GraphAnalyzeConversation.Code,
			"sourceType": toolx.GraphAnalyzeConversation.SourceType,
		},
	}, nil
}

func (t *AnalyzeConversationTool) InvokableRun(ctx context.Context, argumentsInJSON string, opts ...einotool.Option) (string, error) {
	return graphs.NewAnalyzeConversationGraph(t.conversation).Run(ctx, argumentsInJSON)
}
