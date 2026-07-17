package factory

import (
	"context"
	"time"

	"agent-desk/internal/ai"
	"agent-desk/internal/models"

	"github.com/cloudwego/eino/components/model"
	"github.com/cloudwego/eino/schema"
)

var _ model.ToolCallingChatModel = (*upstreamLoggingChatModel)(nil)

type upstreamLoggingChatModel struct {
	inner    model.ToolCallingChatModel
	aiConfig models.AIConfig
}

func newUpstreamLoggingChatModel(inner model.ToolCallingChatModel, aiConfig models.AIConfig) model.ToolCallingChatModel {
	return &upstreamLoggingChatModel{
		inner:    inner,
		aiConfig: aiConfig,
	}
}

func (m *upstreamLoggingChatModel) Generate(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.Message, error) {
	startedAt := time.Now()
	out, err := m.inner.Generate(ctx, input, opts...)
	ai.LogUpstreamCall(ctx, ai.UpstreamLogEntry{
		Operation: "chat.generate",
		ModelType: string(m.aiConfig.ModelType),
		Provider:  string(m.aiConfig.Provider),
		ModelName: m.aiConfig.ModelName,
		BaseURL:   m.aiConfig.BaseURL,
		Endpoint:  "eino.openai.generate",
		Duration:  time.Since(startedAt),
		Request: map[string]any{
			"model":       m.aiConfig.ModelName,
			"messages":    buildEinoMessageLog(input),
			"optionCount": len(opts),
		},
		Response: buildEinoMessageResponseLog(out),
		Error:    err,
	})
	return out, err
}

func (m *upstreamLoggingChatModel) Stream(ctx context.Context, input []*schema.Message, opts ...model.Option) (*schema.StreamReader[*schema.Message], error) {
	startedAt := time.Now()
	out, err := m.inner.Stream(ctx, input, opts...)
	ai.LogUpstreamCall(ctx, ai.UpstreamLogEntry{
		Operation: "chat.stream",
		ModelType: string(m.aiConfig.ModelType),
		Provider:  string(m.aiConfig.Provider),
		ModelName: m.aiConfig.ModelName,
		BaseURL:   m.aiConfig.BaseURL,
		Endpoint:  "eino.openai.stream",
		Duration:  time.Since(startedAt),
		Request: map[string]any{
			"model":       m.aiConfig.ModelName,
			"messages":    buildEinoMessageLog(input),
			"optionCount": len(opts),
		},
		Response: map[string]any{
			"streamCreated": err == nil,
		},
		Error: err,
	})
	return out, err
}

func (m *upstreamLoggingChatModel) WithTools(tools []*schema.ToolInfo) (model.ToolCallingChatModel, error) {
	inner, err := m.inner.WithTools(tools)
	if err != nil {
		return nil, err
	}
	wrapped := &upstreamLoggingChatModel{
		inner:    inner,
		aiConfig: m.aiConfig,
	}
	return wrapped, nil
}

func buildEinoMessageLog(messages []*schema.Message) []map[string]any {
	result := make([]map[string]any, 0, len(messages))
	for _, message := range messages {
		if message == nil {
			continue
		}
		result = append(result, map[string]any{
			"role":                     string(message.Role),
			"name":                     message.Name,
			"content":                  message.Content,
			"reasoningContent":         message.ReasoningContent,
			"toolCallId":               message.ToolCallID,
			"toolName":                 message.ToolName,
			"toolCallCount":            len(message.ToolCalls),
			"multiContentCount":        len(message.MultiContent),
			"userInputPartCount":       len(message.UserInputMultiContent),
			"assistantOutputPartCount": len(message.AssistantGenMultiContent),
		})
	}
	return result
}

func buildEinoMessageResponseLog(message *schema.Message) map[string]any {
	if message == nil {
		return nil
	}
	response := map[string]any{
		"role":                     string(message.Role),
		"content":                  message.Content,
		"reasoningContent":         message.ReasoningContent,
		"toolCallCount":            len(message.ToolCalls),
		"assistantOutputPartCount": len(message.AssistantGenMultiContent),
	}
	if message.ResponseMeta != nil {
		response["finishReason"] = message.ResponseMeta.FinishReason
		if message.ResponseMeta.Usage != nil {
			response["usage"] = map[string]any{
				"promptTokens":     message.ResponseMeta.Usage.PromptTokens,
				"completionTokens": message.ResponseMeta.Usage.CompletionTokens,
				"totalTokens":      message.ResponseMeta.Usage.TotalTokens,
				"reasoningTokens":  message.ResponseMeta.Usage.CompletionTokensDetails.ReasoningTokens,
			}
		}
	}
	return response
}
