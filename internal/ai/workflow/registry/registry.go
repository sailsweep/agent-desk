package registry

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
		NodeSpec{Type: NodeTypeStart, Title: "Start", Description: "Conversation workflow entry.", RiskLevel: NodeRiskLevelLow},
		NodeSpec{Type: NodeTypeKnowledgeRetrieve, Title: "Knowledge Retrieve", Description: "Retrieve knowledge for the current user message.", RiskLevel: NodeRiskLevelLow},
		NodeSpec{Type: NodeTypeAnswerabilityGate, Title: "Answerability Gate", Description: "Decide whether retrieved knowledge is enough to answer.", RiskLevel: NodeRiskLevelLow},
		NodeSpec{Type: NodeTypeLLMReply, Title: "LLM Reply", Description: "Generate a reply or structured analysis with the configured model.", RiskLevel: NodeRiskLevelMedium},
		NodeSpec{Type: NodeTypeCondition, Title: "Condition", Description: "Route by controlled workflow variables.", RiskLevel: NodeRiskLevelLow},
		NodeSpec{Type: NodeTypeAnalyzeConversation, Title: "Analyze Conversation", Description: "Analyze intent, risk, and recommended next action.", RiskLevel: NodeRiskLevelLow},
		NodeSpec{Type: NodeTypePrepareTicketDraft, Title: "Prepare Ticket Draft", Description: "Build a ticket draft from conversation context.", RiskLevel: NodeRiskLevelMedium},
		NodeSpec{Type: NodeTypeHumanConfirm, Title: "Human Confirm", Description: "Interrupt and wait for explicit user confirmation.", RiskLevel: NodeRiskLevelMedium, Interruptible: true},
		NodeSpec{Type: NodeTypeCreateTicket, Title: "Create Ticket", Description: "Create a ticket from a confirmed draft.", RiskLevel: NodeRiskLevelHigh, RequiresConfirmationPredecessor: true},
		NodeSpec{Type: NodeTypeHandoffToHuman, Title: "Handoff To Human", Description: "Transfer the conversation to human support.", RiskLevel: NodeRiskLevelHigh, RequiresConfirmationPredecessor: true},
		NodeSpec{Type: NodeTypeSendReply, Title: "Send Reply", Description: "Return or commit customer-visible reply text.", RiskLevel: NodeRiskLevelLow},
		NodeSpec{Type: NodeTypeEnd, Title: "End", Description: "End workflow execution.", RiskLevel: NodeRiskLevelLow},
	)
}
