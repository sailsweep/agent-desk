package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"agent-desk/internal/models"
)

func TestCallVolcengineMultimodalEmbeddingAPI(t *testing.T) {
	var capturedPath string
	var capturedAuth string
	var capturedBody struct {
		Model string `json:"model"`
		Input []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"input"`
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedPath = r.URL.Path
		capturedAuth = r.Header.Get("Authorization")
		if err := json.NewDecoder(r.Body).Decode(&capturedBody); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"object": "list",
			"model": "doubao-embedding-vision-251215",
			"data": {
				"object": "embedding",
				"embedding": [0.1, -0.2, 0.3]
			},
			"usage": {
				"prompt_tokens": 8,
				"total_tokens": 8
			}
		}`))
	}))
	defer server.Close()

	result, err := (&embedding{}).callVolcengineMultimodalEmbeddingAPI(context.Background(), models.AIConfig{
		BaseURL:   server.URL,
		APIKey:    "test-key",
		ModelName: "doubao-embedding-vision-251215",
		TimeoutMS: 5000,
	}, "出差是否需要打卡？")
	if err != nil {
		t.Fatalf("call volcengine multimodal embedding: %v", err)
	}
	if capturedPath != "/embeddings/multimodal" {
		t.Fatalf("expected /embeddings/multimodal path, got %q", capturedPath)
	}
	if capturedAuth != "Bearer test-key" {
		t.Fatalf("expected bearer auth header, got %q", capturedAuth)
	}
	if capturedBody.Model != "doubao-embedding-vision-251215" {
		t.Fatalf("unexpected model in request: %q", capturedBody.Model)
	}
	if len(capturedBody.Input) != 1 || capturedBody.Input[0].Type != "text" || capturedBody.Input[0].Text != "出差是否需要打卡？" {
		t.Fatalf("unexpected multimodal input: %+v", capturedBody.Input)
	}
	if result.Dimension != 3 || len(result.Vector) != 3 {
		t.Fatalf("expected 3-dimension vector, got dimension=%d len=%d", result.Dimension, len(result.Vector))
	}
	if result.TokensUsed != 8 {
		t.Fatalf("expected total tokens 8, got %d", result.TokensUsed)
	}
	if result.ModelName != "doubao-embedding-vision-251215" {
		t.Fatalf("unexpected model name: %q", result.ModelName)
	}
}

func TestParseVolcengineEmbeddingDataSupportsArrayShape(t *testing.T) {
	vector, err := parseVolcengineEmbeddingData(json.RawMessage(`[{"embedding":[1,2]}]`))
	if err != nil {
		t.Fatalf("parse array embedding data: %v", err)
	}
	if len(vector) != 2 || vector[0] != 1 || vector[1] != 2 {
		t.Fatalf("unexpected vector: %+v", vector)
	}
}

func TestIsVolcengineMultimodalEmbeddingConfig(t *testing.T) {
	if !isVolcengineMultimodalEmbeddingConfig(models.AIConfig{
		BaseURL:   "https://ark.cn-beijing.volces.com/api/v3",
		ModelName: "doubao-embedding-vision-251215",
	}) {
		t.Fatal("expected volcengine vision embedding config to use multimodal endpoint")
	}
	if isVolcengineMultimodalEmbeddingConfig(models.AIConfig{
		BaseURL:   "https://ark.cn-beijing.volces.com/api/v3",
		ModelName: "doubao-embedding-text-240715",
	}) {
		t.Fatal("expected text embedding model to keep standard embedding endpoint")
	}
}
