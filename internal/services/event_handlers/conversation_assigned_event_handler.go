package event_handlers

import (
	"context"
	"fmt"
	"strings"
	"time"

	"agent-desk/internal/events"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/eventbus"
	"agent-desk/internal/services"

	"github.com/mlogclub/simple/common/strs"
)

func init() {
	eventbus.
		Register[events.ConversationAssignedEvent]().
		Subscribe(handleConversationAssignedNotify)
}

func handleConversationAssignedNotify(ctx context.Context, event events.ConversationAssignedEvent) error {
	if event.ConversationID <= 0 || event.ToUserID <= 0 {
		return nil
	}
	conversation := services.ConversationService.Get(event.ConversationID)
	if conversation == nil {
		return nil
	}
	return services.WxWorkNotifyService.SendTextToAssigneeOrDefault(event.ToUserID,
		conversationAssignedNotifyTitle(event.AssignType),
		buildConversationAssignedNotifyBody(conversation, event.ToUserID, event.Reason, event.AssignType))
}

func conversationAssignedNotifyTitle(assignType string) string {
	switch strings.TrimSpace(assignType) {
	case events.ConversationAssignTypeTransfer:
		return "Conversation transferred"
	case events.ConversationAssignTypeAutoAssign:
		return "Conversation auto-assigned"
	default:
		return "Conversation assigned"
	}
}

func buildConversationAssignedNotifyBody(conversation *models.Conversation, assigneeID int64, reason string, assignType string) string {
	if conversation == nil {
		return ""
	}
	reasonLabel := "Assignment reason"
	if strings.TrimSpace(assignType) == events.ConversationAssignTypeTransfer {
		reasonLabel = "Transfer reason"
	}
	lines := []string{
		fmt.Sprintf("Conversation ID: #%d", conversation.ID),
		fmt.Sprintf("Summary: %s", strs.DefaultIfBlank(services.ConversationService.BuildConversationSummary(conversation), "-")),
		fmt.Sprintf("Channel: %s", resolveConversationChannelLabel(conversation)),
		fmt.Sprintf("Status: %s", enums.GetIMConversationStatusLabel(conversation.Status)),
		fmt.Sprintf("Assignee: %s", resolveNotifyUserLabel(assigneeID)),
	}
	if strings.TrimSpace(reason) != "" {
		lines = append(lines, fmt.Sprintf("%s: %s", reasonLabel, strings.TrimSpace(reason)))
	}
	lines = append(lines, fmt.Sprintf("Time: %s", time.Now().Format("2006-01-02 15:04:05")))
	return strings.Join(lines, "\n")
}

func resolveConversationChannelLabel(conversation *models.Conversation) string {
	if conversation == nil || conversation.ChannelID <= 0 {
		return "-"
	}
	if channel := services.ChannelService.Get(conversation.ChannelID); channel != nil {
		return strs.DefaultIfBlank(channel.Name, channel.ChannelType)
	}
	return "-"
}

func resolveNotifyUserLabel(userID int64) string {
	if userID <= 0 {
		return "-"
	}
	user := services.UserService.Get(userID)
	if user == nil {
		return fmt.Sprintf("用户#%d", userID)
	}
	if nickname := strings.TrimSpace(user.Nickname); nickname != "" {
		return nickname
	}
	if username := strings.TrimSpace(user.Username); username != "" {
		return username
	}
	return fmt.Sprintf("用户#%d", userID)
}
