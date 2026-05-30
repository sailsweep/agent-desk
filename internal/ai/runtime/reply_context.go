package runtime

import (
	applicationruntime "cs-ai-agent/internal/ai/application/runtime"
	"cs-ai-agent/internal/models"
)

type aiReplyContext struct {
	Conversation     models.Conversation
	Message          models.Message
	AIAgent          models.AIAgent
	Trace            *aiReplyTraceData
	SummaryRef       **applicationruntime.Summary
	PendingInterrupt *models.ConversationInterrupt
}

func (c aiReplyContext) setSummary(summary *applicationruntime.Summary) {
	if c.SummaryRef != nil {
		*c.SummaryRef = summary
	}
}
