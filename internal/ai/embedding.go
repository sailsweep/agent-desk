package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	openai "github.com/openai/openai-go/v3"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
)

type EmbeddingResult struct {
	Vector     []float32
	TokensUsed int
	ModelName  string
	Dimension  int
}

type embedding struct{}

var Embedding = &embedding{}

func (s *embedding) GetModel(ctx context.Context) (*models.AIConfig, error) {
	config, err := GetEnabledAIConfig(enums.AIModelTypeEmbedding)
	if err != nil {
		return nil, errorsx.BusinessErrorI18n(2001, "error.embeddingModel.noneEnabled")
	}
	return config, nil
}

func (s *embedding) GenerateEmbedding(ctx context.Context, text string) (*EmbeddingResult, error) {
	if text == "" {
		return nil, errorsx.InvalidParamI18n("error.e0215")
	}

	result, err := s.callEmbeddingAPI(ctx, text)
	if err != nil {
		return nil, err
	}

	return result, nil
}

func (s *embedding) GenerateBatchEmbeddings(ctx context.Context, texts []string) ([]EmbeddingResult, error) {
	if len(texts) == 0 {
		return nil, errorsx.InvalidParamI18n("error.e0216")
	}

	results := make([]EmbeddingResult, 0, len(texts))
	for _, text := range texts {
		result, err := s.callEmbeddingAPI(ctx, text)
		if err != nil {
			return nil, fmt.Errorf("failed to generate embedding for text: %w", err)
		}
		results = append(results, *result)
	}

	return results, nil
}

func (s *embedding) callEmbeddingAPI(ctx context.Context, text string) (*EmbeddingResult, error) {
	config, err := GetEnabledAIConfig(enums.AIModelTypeEmbedding)
	if err != nil {
		return nil, err
	}
	return s.callEmbeddingAPIWithConfig(ctx, *config, text)
}

func (s *embedding) callEmbeddingAPIWithConfig(ctx context.Context, config models.AIConfig, text string) (*EmbeddingResult, error) {
	if isVolcengineMultimodalEmbeddingConfig(config) {
		return s.callVolcengineMultimodalEmbeddingAPI(ctx, config, text)
	}
	return s.callOpenAIEmbeddingAPI(ctx, config, text)
}

func (s *embedding) callOpenAIEmbeddingAPI(ctx context.Context, config models.AIConfig, text string) (*EmbeddingResult, error) {
	client := newOpenAIClient(config)
	startedAt := time.Now()
	requestLog := map[string]any{
		"model": config.ModelName,
		"input": text,
	}
	embeddingResp, err := client.Embeddings.New(ctx, openai.EmbeddingNewParams{
		Input: openai.EmbeddingNewParamsInputUnion{
			OfString: openai.String(text),
		},
		Model: openai.EmbeddingModel(config.ModelName),
	})
	if err != nil {
		LogUpstreamCall(ctx, UpstreamLogEntry{
			Operation: "embedding.create",
			ModelType: string(config.ModelType),
			Provider:  string(config.Provider),
			ModelName: config.ModelName,
			BaseURL:   config.BaseURL,
			Endpoint:  "/embeddings",
			Duration:  time.Since(startedAt),
			Request:   requestLog,
			Error:     err,
		})
		return nil, fmt.Errorf("failed to call embedding api: %w", err)
	}

	if len(embeddingResp.Data) == 0 {
		err := fmt.Errorf("no embedding data in response")
		LogUpstreamCall(ctx, UpstreamLogEntry{
			Operation: "embedding.create",
			ModelType: string(config.ModelType),
			Provider:  string(config.Provider),
			ModelName: config.ModelName,
			BaseURL:   config.BaseURL,
			Endpoint:  "/embeddings",
			Duration:  time.Since(startedAt),
			Request:   requestLog,
			Response: map[string]any{
				"model":       embeddingResp.Model,
				"dataCount":   0,
				"totalTokens": embeddingResp.Usage.TotalTokens,
			},
			Error: err,
		})
		return nil, err
	}
	vector := make([]float32, 0, len(embeddingResp.Data[0].Embedding))
	for _, item := range embeddingResp.Data[0].Embedding {
		vector = append(vector, float32(item))
	}
	LogUpstreamCall(ctx, UpstreamLogEntry{
		Operation: "embedding.create",
		ModelType: string(config.ModelType),
		Provider:  string(config.Provider),
		ModelName: config.ModelName,
		BaseURL:   config.BaseURL,
		Endpoint:  "/embeddings",
		Duration:  time.Since(startedAt),
		Request:   requestLog,
		Response: map[string]any{
			"model":       embeddingResp.Model,
			"dataCount":   len(embeddingResp.Data),
			"dimension":   len(vector),
			"totalTokens": embeddingResp.Usage.TotalTokens,
		},
	})

	return &EmbeddingResult{
		Vector:     vector,
		TokensUsed: int(embeddingResp.Usage.TotalTokens),
		ModelName:  embeddingResp.Model,
		Dimension:  len(vector),
	}, nil
}

type volcengineMultimodalEmbeddingRequest struct {
	Model string                              `json:"model"`
	Input []volcengineMultimodalEmbeddingItem `json:"input"`
}

type volcengineMultimodalEmbeddingItem struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type volcengineMultimodalEmbeddingResponse struct {
	Data  json.RawMessage `json:"data"`
	Model string          `json:"model"`
	Usage struct {
		TotalTokens int `json:"total_tokens"`
	} `json:"usage"`
}

type volcengineEmbeddingData struct {
	Embedding []float64 `json:"embedding"`
}

func (s *embedding) callVolcengineMultimodalEmbeddingAPI(ctx context.Context, config models.AIConfig, text string) (*EmbeddingResult, error) {
	if strings.TrimSpace(config.BaseURL) == "" {
		return nil, fmt.Errorf("volcengine multimodal embedding base url is empty")
	}
	startedAt := time.Now()
	endpoint := strings.TrimRight(config.BaseURL, "/") + "/embeddings/multimodal"
	requestLog := volcengineMultimodalEmbeddingRequest{
		Model: config.ModelName,
		Input: []volcengineMultimodalEmbeddingItem{
			{Type: "text", Text: text},
		},
	}
	body, err := json.Marshal(volcengineMultimodalEmbeddingRequest{
		Model: config.ModelName,
		Input: []volcengineMultimodalEmbeddingItem{
			{Type: "text", Text: text},
		},
	})
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+config.APIKey)

	client := &http.Client{}
	if config.TimeoutMS > 0 {
		client.Timeout = time.Duration(config.TimeoutMS) * time.Millisecond
	}
	resp, err := client.Do(req)
	if err != nil {
		LogUpstreamCall(ctx, UpstreamLogEntry{
			Operation: "embedding.create",
			ModelType: string(config.ModelType),
			Provider:  string(config.Provider),
			ModelName: config.ModelName,
			BaseURL:   config.BaseURL,
			Endpoint:  endpoint,
			Duration:  time.Since(startedAt),
			Request:   requestLog,
			Error:     err,
		})
		return nil, fmt.Errorf("failed to call volcengine multimodal embedding api: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 8<<20))
	if err != nil {
		LogUpstreamCall(ctx, UpstreamLogEntry{
			Operation:  "embedding.create",
			ModelType:  string(config.ModelType),
			Provider:   string(config.Provider),
			ModelName:  config.ModelName,
			BaseURL:    config.BaseURL,
			Endpoint:   endpoint,
			StatusCode: resp.StatusCode,
			Duration:   time.Since(startedAt),
			Request:    requestLog,
			Error:      err,
		})
		return nil, fmt.Errorf("failed to read volcengine multimodal embedding response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		LogUpstreamCall(ctx, UpstreamLogEntry{
			Operation:  "embedding.create",
			ModelType:  string(config.ModelType),
			Provider:   string(config.Provider),
			ModelName:  config.ModelName,
			BaseURL:    config.BaseURL,
			Endpoint:   endpoint,
			StatusCode: resp.StatusCode,
			Duration:   time.Since(startedAt),
			Request:    requestLog,
			Response: map[string]any{
				"body": string(respBody),
			},
		})
		return nil, fmt.Errorf("failed to call volcengine multimodal embedding api: status=%d body=%s", resp.StatusCode, truncateErrorBody(string(respBody), 500))
	}

	var parsed volcengineMultimodalEmbeddingResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		LogUpstreamCall(ctx, UpstreamLogEntry{
			Operation:  "embedding.create",
			ModelType:  string(config.ModelType),
			Provider:   string(config.Provider),
			ModelName:  config.ModelName,
			BaseURL:    config.BaseURL,
			Endpoint:   endpoint,
			StatusCode: resp.StatusCode,
			Duration:   time.Since(startedAt),
			Request:    requestLog,
			Response: map[string]any{
				"body": string(respBody),
			},
			Error: err,
		})
		return nil, fmt.Errorf("failed to parse volcengine multimodal embedding response: %w", err)
	}
	vectorValues, err := parseVolcengineEmbeddingData(parsed.Data)
	if err != nil {
		LogUpstreamCall(ctx, UpstreamLogEntry{
			Operation:  "embedding.create",
			ModelType:  string(config.ModelType),
			Provider:   string(config.Provider),
			ModelName:  config.ModelName,
			BaseURL:    config.BaseURL,
			Endpoint:   endpoint,
			StatusCode: resp.StatusCode,
			Duration:   time.Since(startedAt),
			Request:    requestLog,
			Response: map[string]any{
				"model":       parsed.Model,
				"totalTokens": parsed.Usage.TotalTokens,
				"data":        parsed.Data,
			},
			Error: err,
		})
		return nil, err
	}
	vector := make([]float32, 0, len(vectorValues))
	for _, item := range vectorValues {
		vector = append(vector, float32(item))
	}
	modelName := firstNonEmpty(parsed.Model, config.ModelName)
	LogUpstreamCall(ctx, UpstreamLogEntry{
		Operation:  "embedding.create",
		ModelType:  string(config.ModelType),
		Provider:   string(config.Provider),
		ModelName:  config.ModelName,
		BaseURL:    config.BaseURL,
		Endpoint:   endpoint,
		StatusCode: resp.StatusCode,
		Duration:   time.Since(startedAt),
		Request:    requestLog,
		Response: map[string]any{
			"model":       modelName,
			"dimension":   len(vector),
			"totalTokens": parsed.Usage.TotalTokens,
		},
	})
	return &EmbeddingResult{
		Vector:     vector,
		TokensUsed: parsed.Usage.TotalTokens,
		ModelName:  modelName,
		Dimension:  len(vector),
	}, nil
}

func parseVolcengineEmbeddingData(raw json.RawMessage) ([]float64, error) {
	if len(bytes.TrimSpace(raw)) == 0 {
		return nil, fmt.Errorf("no embedding data in volcengine multimodal response")
	}
	var single volcengineEmbeddingData
	if err := json.Unmarshal(raw, &single); err == nil && len(single.Embedding) > 0 {
		return single.Embedding, nil
	}
	var list []volcengineEmbeddingData
	if err := json.Unmarshal(raw, &list); err != nil {
		return nil, fmt.Errorf("failed to parse volcengine multimodal embedding data: %w", err)
	}
	if len(list) == 0 || len(list[0].Embedding) == 0 {
		return nil, fmt.Errorf("no embedding data in volcengine multimodal response")
	}
	return list[0].Embedding, nil
}

func isVolcengineMultimodalEmbeddingConfig(config models.AIConfig) bool {
	baseURL := strings.ToLower(strings.TrimSpace(config.BaseURL))
	modelName := strings.ToLower(strings.TrimSpace(config.ModelName))
	return strings.Contains(baseURL, "volces.com") && strings.Contains(modelName, "embedding-vision")
}

func truncateErrorBody(text string, limit int) string {
	text = strings.TrimSpace(text)
	if limit <= 0 || len([]rune(text)) <= limit {
		return text
	}
	return string([]rune(text)[:limit]) + "..."
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func (s *embedding) GetDimension(ctx context.Context) (int, error) {
	model, err := s.GetModel(ctx)
	if err != nil {
		return 0, err
	}
	return model.Dimension, nil
}
