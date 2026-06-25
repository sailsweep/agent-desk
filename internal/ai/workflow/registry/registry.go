package registry

import "agent-desk/internal/ai/workflow/dsl"

const (
	NodeTypeStart               = "start"
	NodeTypeKnowledgeRetrieve   = "knowledge_retrieve"
	NodeTypeAnswerabilityGate   = "answerability_gate"
	NodeTypeLLMReply            = "llm_reply"
	NodeTypeCondition           = "condition"
	NodeTypeAnalyzeConversation = "analyze_conversation"
	NodeTypePrepareTicketDraft  = "prepare_ticket_draft"
	NodeTypeHumanConfirm        = "human_confirm"
	NodeTypeCreateTicket        = "create_ticket"
	NodeTypeHandoffToHuman      = "handoff_to_human"
	NodeTypeSendReply           = "send_reply"
	NodeTypeEnd                 = "end"
)

func DefaultRegistry() *Registry {
	return NewRegistry(
		NodeSpec{
			Type:        NodeTypeStart,
			Title:       "Start",
			Description: "Conversation workflow entry.",
			RiskLevel:   NodeRiskLevelLow,
			OutputSchema: []VariableSpec{
				output("conversationId", VariableTypeInteger, "Conversation ID."),
				output("messageId", VariableTypeInteger, "Current user message ID."),
				output("aiAgentId", VariableTypeInteger, "AI Agent ID."),
				output("userMessage", VariableTypeString, "Current user message content."),
				output("knowledgeBaseIds", VariableTypeIntegerArray, "Knowledge bases bound to the AI Agent."),
			},
		},
		NodeSpec{
			Type:        NodeTypeKnowledgeRetrieve,
			Title:       "Knowledge Retrieve",
			Description: "Retrieve knowledge for the current user message.",
			RiskLevel:   NodeRiskLevelLow,
			InputSchema: []VariableSpec{
				requiredInput("query", VariableTypeString, "Search query."),
			},
			OutputSchema: []VariableSpec{
				output("items", VariableTypeObjectArray, "Retrieved knowledge items."),
				output("summary", VariableTypeString, "Short retrieval summary."),
			},
			DefaultInputs: map[string]dsl.VariableSelector{
				"query": {NodeID: "start_1", Field: "userMessage"},
			},
		},
		NodeSpec{
			Type:        NodeTypeAnswerabilityGate,
			Title:       "Answerability Gate",
			Description: "Decide whether retrieved knowledge is enough to answer.",
			RiskLevel:   NodeRiskLevelLow,
			InputSchema: []VariableSpec{
				requiredInput("userMessage", VariableTypeString, "Current user message content."),
				requiredInput("knowledgeItems", VariableTypeObjectArray, "Retrieved knowledge items."),
			},
			OutputSchema: []VariableSpec{
				output("answerability", VariableTypeString, "Answerability decision."),
				output("reason", VariableTypeString, "Decision reason."),
			},
		},
		NodeSpec{
			Type:        NodeTypeLLMReply,
			Title:       "LLM Reply",
			Description: "Generate a reply or structured analysis with the configured model.",
			RiskLevel:   NodeRiskLevelMedium,
			InputSchema: []VariableSpec{
				requiredInput("userMessage", VariableTypeString, "Current user message content."),
				optionalInput("knowledgeItems", VariableTypeObjectArray, "Retrieved knowledge items."),
			},
			OutputSchema: []VariableSpec{
				output("replyText", VariableTypeString, "Generated reply text."),
			},
		},
		NodeSpec{
			Type:        NodeTypeCondition,
			Title:       "Condition",
			Description: "Route by controlled workflow variables.",
			RiskLevel:   NodeRiskLevelLow,
			OutputSchema: []VariableSpec{
				output("matched", VariableTypeBoolean, "Whether the condition matched."),
			},
		},
		NodeSpec{
			Type:        NodeTypeAnalyzeConversation,
			Title:       "Analyze Conversation",
			Description: "Analyze intent, risk, and recommended next action.",
			RiskLevel:   NodeRiskLevelLow,
			InputSchema: []VariableSpec{
				requiredInput("userMessage", VariableTypeString, "Current user message content."),
			},
			OutputSchema: []VariableSpec{
				output("intent", VariableTypeString, "Detected user intent."),
				output("riskLevel", VariableTypeString, "Detected risk level."),
				output("needTicket", VariableTypeBoolean, "Whether a ticket is recommended."),
				output("needHumanHandoff", VariableTypeBoolean, "Whether human handoff is recommended."),
			},
		},
		NodeSpec{
			Type:        NodeTypePrepareTicketDraft,
			Title:       "Prepare Ticket Draft",
			Description: "Build a ticket draft from conversation context.",
			RiskLevel:   NodeRiskLevelMedium,
			InputSchema: []VariableSpec{
				requiredInput("issue", VariableTypeString, "Issue summary."),
			},
			OutputSchema: []VariableSpec{
				output("ticketDraft", VariableTypeObject, "Draft ticket payload."),
			},
		},
		NodeSpec{
			Type:          NodeTypeHumanConfirm,
			Title:         "Human Confirm",
			Description:   "Interrupt and wait for explicit user confirmation.",
			RiskLevel:     NodeRiskLevelMedium,
			Interruptible: true,
			InputSchema: []VariableSpec{
				requiredInput("prompt", VariableTypeString, "Confirmation prompt."),
			},
			OutputSchema: []VariableSpec{
				output("confirmed", VariableTypeBoolean, "Whether the user confirmed."),
				output("responseText", VariableTypeString, "Confirmation response text."),
			},
		},
		NodeSpec{
			Type:                            NodeTypeCreateTicket,
			Title:                           "Create Ticket",
			Description:                     "Create a ticket from a confirmed draft.",
			RiskLevel:                       NodeRiskLevelHigh,
			RequiresConfirmationPredecessor: true,
			InputSchema: []VariableSpec{
				requiredInput("ticketDraft", VariableTypeObject, "Confirmed draft ticket payload."),
				requiredInput("confirmed", VariableTypeBoolean, "Confirmation result."),
			},
			OutputSchema: []VariableSpec{
				output("ticketId", VariableTypeInteger, "Created ticket ID."),
				output("ticketNo", VariableTypeString, "Created ticket number."),
				output("created", VariableTypeBoolean, "Whether the ticket was created."),
				output("message", VariableTypeString, "Customer-visible ticket creation result."),
			},
		},
		NodeSpec{
			Type:        NodeTypeHandoffToHuman,
			Title:       "Handoff To Human",
			Description: "Transfer the conversation to human support.",
			RiskLevel:   NodeRiskLevelHigh,
			InputSchema: []VariableSpec{
				requiredInput("reason", VariableTypeString, "Handoff reason."),
				optionalInput("confirmed", VariableTypeBoolean, "Confirmation result."),
			},
			OutputSchema: []VariableSpec{
				output("handoffId", VariableTypeInteger, "Handoff operation ID."),
				output("reason", VariableTypeString, "Handoff reason."),
				output("decision", VariableTypeString, "Handoff dispatch decision."),
				output("teamId", VariableTypeInteger, "Assigned or pending team ID."),
				output("assigneeId", VariableTypeInteger, "Assigned agent user ID."),
				output("message", VariableTypeString, "Customer-visible handoff notice."),
			},
		},
		NodeSpec{
			Type:        NodeTypeSendReply,
			Title:       "Send Reply",
			Description: "Return or commit customer-visible reply text.",
			RiskLevel:   NodeRiskLevelLow,
			InputSchema: []VariableSpec{
				requiredInput("replyText", VariableTypeString, "Customer-visible reply text."),
			},
			OutputSchema: []VariableSpec{
				output("sent", VariableTypeBoolean, "Whether the reply was sent."),
				output("replyMessageId", VariableTypeInteger, "Reply message ID."),
			},
		},
		NodeSpec{
			Type:        NodeTypeEnd,
			Title:       "End",
			Description: "End workflow execution.",
			RiskLevel:   NodeRiskLevelLow,
			OutputSchema: []VariableSpec{
				output("status", VariableTypeString, "Workflow terminal status."),
			},
		},
	)
}

func requiredInput(name string, variableType VariableType, description string) VariableSpec {
	return VariableSpec{Name: name, Type: variableType, Required: true, Description: description}
}

func optionalInput(name string, variableType VariableType, description string) VariableSpec {
	return VariableSpec{Name: name, Type: variableType, Description: description}
}

func output(name string, variableType VariableType, description string) VariableSpec {
	return VariableSpec{Name: name, Type: variableType, Description: description}
}
