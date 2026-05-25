"use client"

import { UserIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { IMConversationStatus } from "@/lib/generated/enums";
import { useAgentConversationsStore } from "@/lib/stores/agent-conversations";
import { formatDateTime } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";

function getStatusVariant(status: number) {
  switch (status) {
    case IMConversationStatus.AIServing:
      return "bg-primary/10 text-primary"
    case IMConversationStatus.Pending:
      return "bg-amber-500/15 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300"
    case IMConversationStatus.Active:
      return "bg-emerald-500/15 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300"
    case IMConversationStatus.Closed:
      return "bg-muted text-muted-foreground"
    default:
      return "bg-muted text-muted-foreground"
  }
}

type ConversationListProps = {
  onAfterSelect?: () => void
}

export function ConversationList({ onAfterSelect }: ConversationListProps) {
  const t = useI18n()
  const conversations = useAgentConversationsStore((state) => state.conversations)
  const loading = useAgentConversationsStore((state) => state.conversationsLoading)
  const selectedId = useAgentConversationsStore((state) => state.selectedConversationId)
  const selectConversation = useAgentConversationsStore((state) => state.selectConversation)

  return (
    <ScrollArea className="overflow-auto">
      {loading ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          {t("conversation.loading")}
        </div>
      ) : conversations.length > 0 ? (
        conversations.map((conversation) => {
          const isSelected = selectedId === conversation.id
          return (
            <div
              key={conversation.id}
              className={`cursor-pointer border-b border-border/80 px-3 py-2 transition-colors hover:bg-muted/40 ${
                isSelected ? "bg-accent/70" : ""
              }`}
              onClick={() => {
                void selectConversation(conversation.id).then(
                  () => {
                    onAfterSelect?.()
                  },
                  () => {},
                )
              }}
            >
              <div className="overflow-hidden">
                <div className="flex items-center gap-2">
                  <Avatar className="size-7 shrink-0">
                    <AvatarImage src="" />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      <UserIcon className="size-3.5 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="min-w-0 flex-1 truncate font-medium text-sm leading-4">
                        {conversation.customerName ||
                          t("conversation.customerFallback", {
                            id: conversation.customerId || conversation.id,
                          })}
                      </span>
                      {conversation.agentUnreadCount > 0 ? (
                        <div className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                          {conversation.agentUnreadCount > 99
                            ? "99+"
                            : conversation.agentUnreadCount}
                        </div>
                      ) : null}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {conversation.lastMessageAt
                        ? formatDateTime(conversation.lastMessageAt)
                        : t("conversation.noTime")}
                    </div>
                  </div>
                </div>
                <div className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">
                  {conversation.lastMessageSummary || t("conversation.noLatestMessage")}
                </div>
                <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span
                    className={`rounded-md px-1.5 py-0.5 ${getStatusVariant(
                      conversation.status
                    )}`}
                  >
                    {getConversationStatusLabel(conversation.status, t)}
                  </span>
                  {conversation.status === IMConversationStatus.Pending &&
                  conversation.currentTeamName ? (
                    <span className="rounded-md bg-muted px-1.5 py-0.5">
                      {t("conversation.teamOnDuty", {
                        name: conversation.currentTeamName,
                      })}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })
      ) : (
        <div className="p-6 text-center text-sm text-muted-foreground">
          {t("conversation.empty")}
        </div>
      )}
    </ScrollArea>
  )
}

function getConversationStatusLabel(
  status: number,
  t: (key: string, values?: Record<string, string | number>) => string
) {
  switch (status) {
    case IMConversationStatus.AIServing:
      return t("conversation.filterAiServing")
    case IMConversationStatus.Pending:
      return t("conversation.filterPending")
    case IMConversationStatus.Active:
      return t("conversation.filterActive")
    case IMConversationStatus.Closed:
      return t("conversation.filterClosed")
    default:
      return "-"
  }
}
