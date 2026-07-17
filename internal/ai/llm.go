package ai

import (
	"context"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/mlogclub/simple/common/strs"
	openai "github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/shared"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
)

type ChatCompletionResult struct {
	Content          string
	ModelName        string
	PromptTokens     int
	CompletionTokens int
}

type llm struct{}

var LLM = &llm{}

func (s *llm) Chat(ctx context.Context, systemPrompt string, userPrompt string) (*ChatCompletionResult, error) {
	config, err := GetEnabledAIConfig(enums.AIModelTypeLLM)
	if err != nil {
		return nil, err
	}
	return s.ChatWithConfig(ctx, *config, systemPrompt, userPrompt)
}

func (s *llm) ChatWithConfig(ctx context.Context, config models.AIConfig, systemPrompt string, userPrompt string) (*ChatCompletionResult, error) {
	messages := make([]openai.ChatCompletionMessageParamUnion, 0, 2)
	if strs.IsNotBlank(systemPrompt) {
		messages = append(messages, openai.ChatCompletionMessageParamUnion{
			OfSystem: &openai.ChatCompletionSystemMessageParam{
				Content: openai.ChatCompletionSystemMessageParamContentUnion{
					OfString: openai.String(systemPrompt),
				},
			},
		})
	}
	messages = append(messages, openai.ChatCompletionMessageParamUnion{
		OfUser: &openai.ChatCompletionUserMessageParam{
			Content: openai.ChatCompletionUserMessageParamContentUnion{
				OfString: openai.String(userPrompt),
			},
		},
	})

	params := openai.ChatCompletionNewParams{
		Messages: messages,
		Model:    shared.ChatModel(config.ModelName),
	}
	if config.MaxOutputTokens > 0 {
		params.MaxCompletionTokens = openai.Int(int64(config.MaxOutputTokens))
	}
	applyProviderSpecificChatParams(&params, config)

	client := newOpenAIClient(config)
	startedAt := time.Now()
	requestLog := map[string]any{
		"model": config.ModelName,
		"messages": []map[string]any{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userPrompt},
		},
		"maxCompletionTokens": config.MaxOutputTokens,
	}
	chatResp, err := client.Chat.Completions.New(ctx, params)
	if err != nil {
		LogUpstreamCall(ctx, UpstreamLogEntry{
			Operation: "chat.completions.create",
			ModelType: string(config.ModelType),
			Provider:  string(config.Provider),
			ModelName: config.ModelName,
			BaseURL:   config.BaseURL,
			Endpoint:  "/chat/completions",
			Duration:  time.Since(startedAt),
			Request:   requestLog,
			Error:     err,
		})
		return nil, fmt.Errorf("failed to call llm api (model=%s provider=%s system_chars=%d user_chars=%d max_output_tokens=%d): %w",
			config.ModelName, config.Provider, utf8.RuneCountInString(systemPrompt), utf8.RuneCountInString(userPrompt), config.MaxOutputTokens, err)
	}
	if len(chatResp.Choices) == 0 {
		err := fmt.Errorf("no llm choices in response")
		LogUpstreamCall(ctx, UpstreamLogEntry{
			Operation: "chat.completions.create",
			ModelType: string(config.ModelType),
			Provider:  string(config.Provider),
			ModelName: config.ModelName,
			BaseURL:   config.BaseURL,
			Endpoint:  "/chat/completions",
			Duration:  time.Since(startedAt),
			Request:   requestLog,
			Response: map[string]any{
				"choiceCount":      0,
				"promptTokens":     chatResp.Usage.PromptTokens,
				"completionTokens": chatResp.Usage.CompletionTokens,
				"totalTokens":      chatResp.Usage.TotalTokens,
			},
			Error: err,
		})
		return nil, err
	}

	content := strings.TrimSpace(chatResp.Choices[0].Message.Content)
	LogUpstreamCall(ctx, UpstreamLogEntry{
		Operation: "chat.completions.create",
		ModelType: string(config.ModelType),
		Provider:  string(config.Provider),
		ModelName: config.ModelName,
		BaseURL:   config.BaseURL,
		Endpoint:  "/chat/completions",
		Duration:  time.Since(startedAt),
		Request:   requestLog,
		Response: map[string]any{
			"model":            chatResp.Model,
			"choiceCount":      len(chatResp.Choices),
			"finishReason":     chatResp.Choices[0].FinishReason,
			"content":          content,
			"promptTokens":     chatResp.Usage.PromptTokens,
			"completionTokens": chatResp.Usage.CompletionTokens,
			"totalTokens":      chatResp.Usage.TotalTokens,
		},
	})
	return &ChatCompletionResult{
		Content:          content,
		ModelName:        config.ModelName,
		PromptTokens:     int(chatResp.Usage.PromptTokens),
		CompletionTokens: int(chatResp.Usage.CompletionTokens),
	}, nil
}

func applyProviderSpecificChatParams(params *openai.ChatCompletionNewParams, config models.AIConfig) {
	if params == nil {
		return
	}
	if isDashScopeQwenThinkingModel(config) {
		params.SetExtraFields(map[string]any{
			"enable_thinking": false,
		})
	}
}

func isDashScopeQwenThinkingModel(config models.AIConfig) bool {
	baseURL := strings.ToLower(strings.TrimSpace(config.BaseURL))
	modelName := strings.ToLower(strings.TrimSpace(config.ModelName))
	return strings.Contains(baseURL, "dashscope.aliyuncs.com") && strings.HasPrefix(modelName, "qwen3")
}
