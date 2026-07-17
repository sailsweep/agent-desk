package rag

import (
	"bytes"
	"encoding/json"
	"net/http"
	"testing"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
)

func TestBuildRerankEndpointSupportsVolcengineKnowledgeHost(t *testing.T) {
	got := buildRerankEndpoint("https://api-knowledgebase.mlp.cn-beijing.volces.com")
	want := "https://api-knowledgebase.mlp.cn-beijing.volces.com/api/knowledge/service/rerank"
	if got != want {
		t.Fatalf("expected %q, got %q", want, got)
	}
}

func TestBuildRerankEndpointKeepsFullEndpoint(t *testing.T) {
	got := buildRerankEndpoint("https://api.example.com/api/knowledge/service/rerank")
	if got != "https://api.example.com/api/knowledge/service/rerank" {
		t.Fatalf("unexpected endpoint: %q", got)
	}
}

func TestBuildRerankRequestPayloadUsesVolcengineKnowledgeFormat(t *testing.T) {
	config := models.AIConfig{
		ModelName: "m3-v2-rerank",
		ModelType: enums.AIModelTypeRerank,
	}
	endpoint := "https://api-knowledgebase.mlp.cn-beijing.volces.com/api/knowledge/service/rerank"

	body, err := buildRerankRequestPayload(config, endpoint, "停车费怎么报销？", []string{
		"停车怎么计费？",
		"怎么申请报销？",
	}, 2)
	if err != nil {
		t.Fatalf("buildRerankRequestPayload() error = %v", err)
	}

	var payload struct {
		RerankModel string `json:"rerank_model"`
		Datas       []struct {
			Query   string `json:"query"`
			Content string `json:"content"`
		} `json:"datas"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		t.Fatalf("invalid json payload: %v", err)
	}
	if payload.RerankModel != "m3-v2-rerank" {
		t.Fatalf("unexpected rerank model: %q", payload.RerankModel)
	}
	if len(payload.Datas) != 2 || payload.Datas[0].Query != "停车费怎么报销？" || payload.Datas[1].Content != "怎么申请报销？" {
		t.Fatalf("unexpected datas payload: %+v", payload.Datas)
	}
}

func TestParseRerankResponseBodySupportsVolcengineScoresArray(t *testing.T) {
	body := []byte(`{"code":0,"message":"success","data":[0.12,0.91,0.33],"token_usage":42}`)
	results, err := parseRerankResponseBody("https://api-knowledgebase.mlp.cn-beijing.volces.com/api/knowledge/service/rerank", body, 2)
	if err != nil {
		t.Fatalf("parseRerankResponseBody() error = %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}
	if results[0].Index != 1 || results[0].RelevanceScore != 0.91 {
		t.Fatalf("expected highest score from index 1 first, got %+v", results[0])
	}
	if results[1].Index != 2 || results[1].RelevanceScore != 0.33 {
		t.Fatalf("expected second score from index 2, got %+v", results[1])
	}
}

func TestParseVolcengineRerankCredential(t *testing.T) {
	credential, err := parseVolcengineRerankCredential(" ak | sk ")
	if err != nil {
		t.Fatalf("parseVolcengineRerankCredential() error = %v", err)
	}
	if credential.AccessKey != "ak" || credential.SecretKey != "sk" {
		t.Fatalf("unexpected credential: %+v", credential)
	}
}

func TestParseVolcengineRerankCredentialRejectsInvalidFormat(t *testing.T) {
	if _, err := parseVolcengineRerankCredential("ak"); err == nil {
		t.Fatal("expected invalid credential format error")
	}
}

func TestSignVolcengineKnowledgeRerankRequestDoesNotUseBearer(t *testing.T) {
	req, err := http.NewRequest(http.MethodPost, "https://api-knowledgebase.mlp.cn-beijing.volces.com/api/knowledge/service/rerank", bytes.NewBufferString(`{}`))
	if err != nil {
		t.Fatalf("NewRequest() error = %v", err)
	}
	req.Header.Set("Content-Type", "application/json")

	err = signVolcengineKnowledgeRerankRequest(req, []byte(`{}`), volcengineRerankCredential{
		AccessKey: "ak",
		SecretKey: "sk",
	})
	if err != nil {
		t.Fatalf("signVolcengineKnowledgeRerankRequest() error = %v", err)
	}
	if got := req.Header.Get("Authorization"); got == "" || got[:11] == "Bearer " {
		t.Fatalf("unexpected authorization header: %q", got)
	}
	if req.Header.Get("X-Date") == "" || req.Header.Get("X-Content-Sha256") == "" {
		t.Fatalf("missing volcengine signed headers: %+v", req.Header)
	}
	if req.Header.Get("V-Account-Id") != "" {
		t.Fatalf("unexpected tenant header: %+v", req.Header)
	}
}

func TestRerankResultsPreservesDenseScoreAndSetsRerankScore(t *testing.T) {
	results := []RetrieveResult{
		{ChunkID: 1, Content: "first", Score: 0.61},
		{ChunkID: 2, Content: "second", Score: 0.59},
		{ChunkID: 3, Content: "third", Score: 0.57},
	}
	rerankResults := []RerankResult{
		{Index: 2, RelevanceScore: 0.95},
		{Index: 0, RelevanceScore: 0.91},
	}

	got := applyRerankResults(results, rerankResults, 2)
	if len(got) != 2 {
		t.Fatalf("expected 2 results, got %d", len(got))
	}
	if got[0].ChunkID != 3 || got[0].Score != 0.57 || got[0].RerankScore != 0.95 {
		t.Fatalf("unexpected first reranked result: %+v", got[0])
	}
	if got[1].ChunkID != 1 || got[1].Score != 0.61 || got[1].RerankScore != 0.91 {
		t.Fatalf("unexpected second reranked result: %+v", got[1])
	}
}
