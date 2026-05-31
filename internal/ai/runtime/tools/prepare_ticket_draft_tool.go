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

type PrepareTicketDraftTool struct {
	conversation models.Conversation
}

func NewPrepareTicketDraftTool() *PrepareTicketDraftTool {
	return &PrepareTicketDraftTool{}
}

func (t *PrepareTicketDraftTool) Spec() toolx.ToolSpec {
	return toolx.GraphPrepareTicketDraft
}

func (t *PrepareTicketDraftTool) Name() string {
	return toolx.GraphPrepareTicketDraft.Name
}

func (t *PrepareTicketDraftTool) Code() string {
	return toolx.GraphPrepareTicketDraft.Code
}

func (t *PrepareTicketDraftTool) Enabled(ctx registry.Context) bool {
	return true
}

func (t *PrepareTicketDraftTool) Build(ctx registry.Context) (einotool.BaseTool, error) {
	if !t.Enabled(ctx) {
		return nil, nil
	}
	return &PrepareTicketDraftTool{conversation: ctx.Conversation}, nil
}

func (t *PrepareTicketDraftTool) Info(ctx context.Context) (*schema.ToolInfo, error) {
	return &schema.ToolInfo{
		Name: toolx.GraphPrepareTicketDraft.Name,
		Desc: "Graph Tool. Prepares a ticket draft from the current conversation and collected information. Use it before create_ticket_with_confirmation when the ticket content needs to be organized.",
		ParamsOneOf: schema.NewParamsOneOfByJSONSchema(&einojsonschema.Schema{
			Version: einojsonschema.Version,
			Type:    "object",
			Properties: orderedmap.New[string, *einojsonschema.Schema](orderedmap.WithInitialData(
				orderedmap.Pair[string, *einojsonschema.Schema]{
					Key: "title",
					Value: &einojsonschema.Schema{
						Type:        "string",
						Description: "Prepared ticket title. Optional.",
					},
				},
				orderedmap.Pair[string, *einojsonschema.Schema]{
					Key: "description",
					Value: &einojsonschema.Schema{
						Type:        "string",
						Description: "Prepared ticket description. Optional.",
					},
				},
				orderedmap.Pair[string, *einojsonschema.Schema]{
					Key: "issue",
					Value: &einojsonschema.Schema{
						Type:        "string",
						Description: "The issue or error message the user is experiencing.",
					},
				},
				orderedmap.Pair[string, *einojsonschema.Schema]{
					Key: "impact",
					Value: &einojsonschema.Schema{
						Type:        "string",
						Description: "Impact scope, such as unable to sign in, unable to place an order, or business interruption.",
					},
				},
				orderedmap.Pair[string, *einojsonschema.Schema]{
					Key: "expectedOutcome",
					Value: &einojsonschema.Schema{
						Type:        "string",
						Description: "The user's expected outcome or request.",
					},
				},
				orderedmap.Pair[string, *einojsonschema.Schema]{
					Key: "currentAttempt",
					Value: &einojsonschema.Schema{
						Type:        "string",
						Description: "当前已尝试过的处理步骤，可选。",
					},
				},
			)),
		}),
		Extra: map[string]any{
			"toolCode":   toolx.GraphPrepareTicketDraft.Code,
			"sourceType": "graph",
		},
	}, nil
}

func (t *PrepareTicketDraftTool) InvokableRun(ctx context.Context, argumentsInJSON string, opts ...einotool.Option) (string, error) {
	return graphs.NewPrepareTicketDraftGraph(t.conversation).Run(ctx, argumentsInJSON)
}
