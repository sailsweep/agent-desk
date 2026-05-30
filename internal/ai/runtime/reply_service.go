package runtime

import (
	"strings"

	applicationruntime "cs-ai-agent/internal/ai/application/runtime"
	svc "cs-ai-agent/internal/services"
)

var AIReplyService = newAIReplyService()

func init() {
	svc.TriggerAIReplyAsyncHook = AIReplyService.TriggerReplyAsync
}

func newAIReplyService() *aiReplyService {
	return &aiReplyService{
		eligibility: newReplyEligibility(),
		executor:    newRuntimeReplyExecutor(),
		interrupts:  newReplyInterruptService(),
		commit:      newReplyCommitService(),
		runlog:      newReplyRunLogService(),
	}
}

type aiReplyService struct {
	eligibility *replyEligibility
	executor    *runtimeReplyExecutor
	interrupts  *replyInterruptService
	commit      *replyCommitService
	runlog      *replyRunLogService
}

func firstInvokedToolCode(summary *applicationruntime.Summary) string {
	if summary == nil {
		return ""
	}
	if len(summary.InvokedToolCodes) > 0 {
		return strings.TrimSpace(summary.InvokedToolCodes[0])
	}
	return ""
}
