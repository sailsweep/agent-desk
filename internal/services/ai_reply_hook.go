package services

import "cs-ai-agent/internal/models"

var TriggerAIReplyAsyncHook func(conversation models.Conversation, message models.Message)
