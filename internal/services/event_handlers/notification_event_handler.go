package event_handlers

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"agent-desk/internal/events"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/eventbus"
	"agent-desk/internal/services"

	"github.com/mlogclub/simple/common/strs"
)

func init() {
	eventbus.
		Register[events.TicketAssignedEvent]().
		Subscribe(handleTicketAssignedInAppNotification)
	eventbus.
		Register[events.ConversationAssignedEvent]().
		Subscribe(handleConversationAssignedInAppNotification)
}

func handleTicketAssignedInAppNotification(ctx context.Context, event events.TicketAssignedEvent) error {
	if event.TicketID <= 0 || event.ToUserID <= 0 {
		return nil
	}
	ticket := services.TicketService.Get(event.TicketID)
	if ticket == nil {
		return nil
	}
	content := fmt.Sprintf("Ticket %s has been assigned to you.", strs.DefaultIfBlank(ticket.TicketNo, fmt.Sprintf("#%d", ticket.ID)))
	if title := strings.TrimSpace(ticket.Title); title != "" {
		content = content + "\n" + title
	}
	if reason := strings.TrimSpace(event.Reason); reason != "" {
		content = content + "\nAssignment reason: " + reason
	}
	_, err := services.NotificationService.CreateAndPush(request.CreateNotificationRequest{
		RecipientUserID:  event.ToUserID,
		Title:            "Ticket assigned",
		Content:          content,
		NotificationType: "ticket_assigned",
		BizType:          "ticket",
		BizID:            ticket.ID,
		ActionURL:        fmt.Sprintf("/dashboard/tickets?ticketId=%d", ticket.ID),
	})
	if err != nil {
		slog.Error("create ticket assigned in-app notification failed", "error", err, "ticketId", event.TicketID, "toUserId", event.ToUserID)
	}
	return nil
}

func handleConversationAssignedInAppNotification(ctx context.Context, event events.ConversationAssignedEvent) error {
	if event.ConversationID <= 0 || event.ToUserID <= 0 {
		return nil
	}
	conversation := services.ConversationService.Get(event.ConversationID)
	if conversation == nil {
		return nil
	}
	content := fmt.Sprintf("Conversation #%d has been assigned to you.", conversation.ID)
	if summary := strings.TrimSpace(services.ConversationService.BuildConversationSummary(conversation)); summary != "" {
		content = content + "\n" + summary
	}
	if reason := strings.TrimSpace(event.Reason); reason != "" {
		content = content + "\nAssignment reason: " + reason
	}
	_, err := services.NotificationService.CreateAndPush(request.CreateNotificationRequest{
		RecipientUserID:  event.ToUserID,
		Title:            conversationAssignedNotifyTitle(event.AssignType),
		Content:          content,
		NotificationType: "conversation_assigned",
		BizType:          "conversation",
		BizID:            conversation.ID,
		ActionURL:        fmt.Sprintf("/dashboard/conversations?conversationId=%d", conversation.ID),
	})
	if err != nil {
		slog.Error("create conversation assigned in-app notification failed", "error", err, "conversationId", event.ConversationID, "toUserId", event.ToUserID)
	}
	return nil
}
