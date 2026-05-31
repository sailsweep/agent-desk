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

type CreateTicketGraphTool struct {
	conversation models.Conversation
	aiAgent      models.AIAgent
}

func NewCreateTicketGraphTool() *CreateTicketGraphTool {
	return &CreateTicketGraphTool{}
}

func (t *CreateTicketGraphTool) Spec() toolx.ToolSpec {
	return toolx.GraphCreateTicketConfirm
}

func (t *CreateTicketGraphTool) Name() string {
	return toolx.GraphCreateTicketConfirm.Name
}

func (t *CreateTicketGraphTool) Code() string {
	return toolx.GraphCreateTicketConfirm.Code
}

func (t *CreateTicketGraphTool) Enabled(ctx registry.Context) bool {
	return true
}

func (t *CreateTicketGraphTool) Build(ctx registry.Context) (einotool.BaseTool, error) {
	if !t.Enabled(ctx) {
		return nil, nil
	}
	return &CreateTicketGraphTool{
		conversation: ctx.Conversation,
		aiAgent:      ctx.AIAgent,
	}, nil
}

func (t *CreateTicketGraphTool) Info(ctx context.Context) (*schema.ToolInfo, error) {
	return &schema.ToolInfo{
		Name: toolx.GraphCreateTicketConfirm.Name,
		Desc: "Graph Tool. Handles ticket parameter preparation, user confirmation, actual ticket creation, and result return. Use only when the user explicitly asks to create a ticket and the title and description are clear.",
		ParamsOneOf: schema.NewParamsOneOfByJSONSchema(&einojsonschema.Schema{
			Version: einojsonschema.Version,
			Type:    "object",
			Required: []string{
				"title",
				"description",
			},
			Properties: orderedmap.New[string, *einojsonschema.Schema](orderedmap.WithInitialData(
				orderedmap.Pair[string, *einojsonschema.Schema]{
					Key: "title",
					Value: &einojsonschema.Schema{
						Type:        "string",
						Description: "Ticket title. Concisely summarizes the issue.",
					},
				},
				orderedmap.Pair[string, *einojsonschema.Schema]{
					Key: "description",
					Value: &einojsonschema.Schema{
						Type:        "string",
						Description: "Ticket description. Clearly captures the user's issue, symptoms, and request.",
					},
				},
			)),
		}),
		Extra: map[string]any{
			"toolCode":   toolx.GraphCreateTicketConfirm.Code,
			"sourceType": "graph",
		},
	}, nil
}

func (t *CreateTicketGraphTool) InvokableRun(ctx context.Context, argumentsInJSON string, opts ...einotool.Option) (string, error) {
	return graphs.NewCreateTicketGraph(t.conversation, t.aiAgent).Run(ctx, argumentsInJSON)
}
