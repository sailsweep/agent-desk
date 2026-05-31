package event_handlers

import (
	"agent-desk/internal/events"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/eventbus"
	"agent-desk/internal/services"
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/mlogclub/simple/common/strs"
)

func init() {
	eventbus.
		Register[events.TicketAssignedEvent]().
		Subscribe(handleTicketAssignedNotify)
}

func handleTicketAssignedNotify(ctx context.Context, event events.TicketAssignedEvent) error {
	if event.TicketID <= 0 || event.ToUserID <= 0 {
		return nil
	}
	ticket := services.TicketService.Get(event.TicketID)
	if ticket == nil {
		return nil
	}
	content := buildTicketAssignedNotifyBody(ticket, event.ToUserID, event.Reason)
	return services.WxWorkNotifyService.SendTextToAssigneeOrDefault(event.ToUserID, "Ticket assigned", content)
}

func buildTicketAssignedNotifyBody(ticket *models.Ticket, assigneeID int64, reason string) string {
	if ticket == nil {
		return ""
	}
	lines := []string{
		fmt.Sprintf("Ticket no: %s", strs.DefaultIfBlank(ticket.TicketNo, fmt.Sprintf("#%d", ticket.ID))),
		fmt.Sprintf("Title: %s", strs.DefaultIfBlank(ticket.Title, "-")),
		fmt.Sprintf("Status: %s", enums.GetTicketStatusLabel(ticket.Status)),
		fmt.Sprintf("Assignee: %s", resolveNotifyUserLabel(assigneeID)),
	}
	if strings.TrimSpace(reason) != "" {
		lines = append(lines, fmt.Sprintf("Assignment reason: %s", strings.TrimSpace(reason)))
	}
	lines = append(lines, fmt.Sprintf("Time: %s", time.Now().Format("2006-01-02 15:04:05")))
	return strings.Join(lines, "\n")
}
