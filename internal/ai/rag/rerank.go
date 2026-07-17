package rag

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"time"

	"agent-desk/internal/ai"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
)

type rerank struct{}

var Rerank = &rerank{}

const (
	volcengineRerankRegion  = "cn-north-1"
	volcengineRerankService = "air"
)

func (s *rerank) Rerank(ctx context.Context, query string, documents []string, topN int) ([]RerankResult, error) {
	if len(documents) == 0 {
		return nil, nil
	}

	if topN <= 0 {
		topN = len(documents)
	}

	results, err := s.callRerankAPI(ctx, query, documents, topN)
	if err != nil {
		return nil, err
	}

	return results, nil
}

func (s *rerank) callRerankAPI(ctx context.Context, query string, documents []string, topN int) ([]RerankResult, error) {
	config, err := ai.GetEnabledAIConfig(enums.AIModelTypeRerank)
	if err != nil {
		return nil, err
	}

	endpoint := buildRerankEndpoint(config.BaseURL)
	jsonBody, err := buildRerankRequestPayload(*config, endpoint, query, documents, topN)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}
	startedAt := time.Now()
	requestLog := buildRerankUpstreamLogRequest(*config, endpoint, query, documents, topN)

	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if isVolcengineKnowledgeRerankEndpoint(endpoint) {
		credential, err := parseVolcengineRerankCredential(config.APIKey)
		if err != nil {
			return nil, err
		}
		if err := signVolcengineKnowledgeRerankRequest(req, jsonBody, credential); err != nil {
			return nil, err
		}
	} else {
		req.Header.Set("Authorization", "Bearer "+config.APIKey)
	}

	client := &http.Client{
		Timeout: time.Duration(config.TimeoutMS) * time.Millisecond,
	}

	resp, err := client.Do(req)
	if err != nil {
		ai.LogUpstreamCall(ctx, ai.UpstreamLogEntry{
			Operation: "rerank.create",
			ModelType: string(config.ModelType),
			Provider:  string(config.Provider),
			ModelName: config.ModelName,
			BaseURL:   config.BaseURL,
			Endpoint:  endpoint,
			Duration:  time.Since(startedAt),
			Request:   requestLog,
			Error:     err,
		})
		return nil, fmt.Errorf("failed to call rerank API: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		ai.LogUpstreamCall(ctx, ai.UpstreamLogEntry{
			Operation:  "rerank.create",
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
		return nil, fmt.Errorf("failed to read response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		ai.LogUpstreamCall(ctx, ai.UpstreamLogEntry{
			Operation:  "rerank.create",
			ModelType:  string(config.ModelType),
			Provider:   string(config.Provider),
			ModelName:  config.ModelName,
			BaseURL:    config.BaseURL,
			Endpoint:   endpoint,
			StatusCode: resp.StatusCode,
			Duration:   time.Since(startedAt),
			Request:    requestLog,
			Response: map[string]any{
				"body": string(body),
			},
		})
		return nil, fmt.Errorf("failed to call rerank API: status=%d body=%s", resp.StatusCode, truncateRerankErrorBody(string(body), 500))
	}

	results, err := parseRerankResponseBody(endpoint, body, topN)
	ai.LogUpstreamCall(ctx, ai.UpstreamLogEntry{
		Operation:  "rerank.create",
		ModelType:  string(config.ModelType),
		Provider:   string(config.Provider),
		ModelName:  config.ModelName,
		BaseURL:    config.BaseURL,
		Endpoint:   endpoint,
		StatusCode: resp.StatusCode,
		Duration:   time.Since(startedAt),
		Request:    requestLog,
		Response: map[string]any{
			"resultCount": len(results),
			"results":     results,
			"body":        body,
		},
		Error: err,
	})
	return results, err
}

type volcengineKnowledgeRerankRequest struct {
	RerankModel string                          `json:"rerank_model"`
	Datas       []volcengineKnowledgeRerankData `json:"datas"`
}

type volcengineKnowledgeRerankData struct {
	Query   string `json:"query"`
	Content string `json:"content"`
}

type volcengineKnowledgeRerankResponse struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

type volcengineRerankCredential struct {
	AccessKey string
	SecretKey string
}

func parseVolcengineRerankCredential(apiKey string) (volcengineRerankCredential, error) {
	parts := strings.Split(apiKey, "|")
	if len(parts) != 2 {
		return volcengineRerankCredential{}, fmt.Errorf("volcengine rerank apiKey must use ak|sk format")
	}
	credential := volcengineRerankCredential{
		AccessKey: strings.TrimSpace(parts[0]),
		SecretKey: strings.TrimSpace(parts[1]),
	}
	if credential.AccessKey == "" || credential.SecretKey == "" {
		return volcengineRerankCredential{}, fmt.Errorf("volcengine rerank apiKey must include non-empty ak and sk")
	}
	return credential, nil
}

func signVolcengineKnowledgeRerankRequest(req *http.Request, body []byte, credential volcengineRerankCredential) error {
	if req == nil || req.URL == nil {
		return fmt.Errorf("volcengine rerank request is nil")
	}
	if credential.AccessKey == "" || credential.SecretKey == "" {
		return fmt.Errorf("volcengine rerank credential is incomplete")
	}

	now := time.Now().UTC()
	xDate := now.Format("20060102T150405Z")
	authDate := xDate[:8]
	payload := hexSHA256(body)
	if req.Host == "" {
		req.Host = req.URL.Host
	}
	if req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", "application/json")
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("X-Date", xDate)
	req.Header.Set("X-Content-Sha256", payload)

	signedHeaders := []string{"content-type", "host", "x-content-sha256", "x-date"}
	headerList := make([]string, 0, len(signedHeaders))
	for _, header := range signedHeaders {
		value := ""
		if header == "host" {
			value = req.Host
		} else {
			value = req.Header.Get(header)
		}
		headerList = append(headerList, header+":"+strings.TrimSpace(value))
	}

	canonicalURI := req.URL.EscapedPath()
	if canonicalURI == "" {
		canonicalURI = "/"
	}
	queryString := strings.ReplaceAll(req.URL.Query().Encode(), "+", "%20")
	canonicalString := strings.Join([]string{
		req.Method,
		canonicalURI,
		queryString,
		strings.Join(headerList, "\n") + "\n",
		strings.Join(signedHeaders, ";"),
		payload,
	}, "\n")
	hashedCanonicalString := hexSHA256([]byte(canonicalString))
	credentialScope := authDate + "/" + volcengineRerankRegion + "/" + volcengineRerankService + "/request"
	signString := strings.Join([]string{
		"HMAC-SHA256",
		xDate,
		credentialScope,
		hashedCanonicalString,
	}, "\n")

	signingKey := getVolcengineSignedKey(credential.SecretKey, authDate, volcengineRerankRegion, volcengineRerankService)
	signature := hex.EncodeToString(hmacSHA256(signingKey, signString))
	req.Header.Set("Authorization", "HMAC-SHA256"+
		" Credential="+credential.AccessKey+"/"+credentialScope+
		", SignedHeaders="+strings.Join(signedHeaders, ";")+
		", Signature="+signature)
	return nil
}

func getVolcengineSignedKey(secretKey, date, region, service string) []byte {
	kDate := hmacSHA256([]byte(secretKey), date)
	kRegion := hmacSHA256(kDate, region)
	kService := hmacSHA256(kRegion, service)
	return hmacSHA256(kService, "request")
}

func hmacSHA256(key []byte, content string) []byte {
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(content))
	return mac.Sum(nil)
}

func hexSHA256(data []byte) string {
	hash := sha256.New()
	_, _ = hash.Write(data)
	return hex.EncodeToString(hash.Sum(nil))
}

func buildRerankEndpoint(baseURL string) string {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	switch {
	case baseURL == "":
		return "/v1/rerank"
	case strings.HasSuffix(baseURL, "/api/knowledge/service/rerank"):
		return baseURL
	case strings.Contains(baseURL, "api-knowledgebase."):
		return baseURL + "/api/knowledge/service/rerank"
	case strings.HasSuffix(baseURL, "/v1/rerank"), strings.HasSuffix(baseURL, "/rerank"):
		return baseURL
	default:
		return baseURL + "/v1/rerank"
	}
}

func buildRerankRequestPayload(config models.AIConfig, endpoint string, query string, documents []string, topN int) ([]byte, error) {
	if isVolcengineKnowledgeRerankEndpoint(endpoint) {
		datas := make([]volcengineKnowledgeRerankData, 0, len(documents))
		for _, document := range documents {
			datas = append(datas, volcengineKnowledgeRerankData{
				Query:   query,
				Content: document,
			})
		}
		return json.Marshal(volcengineKnowledgeRerankRequest{
			RerankModel: config.ModelName,
			Datas:       datas,
		})
	}
	return json.Marshal(RerankRequest{
		Model:     config.ModelName,
		Query:     query,
		Documents: documents,
		TopN:      topN,
	})
}

func buildRerankUpstreamLogRequest(config models.AIConfig, endpoint string, query string, documents []string, topN int) map[string]any {
	if isVolcengineKnowledgeRerankEndpoint(endpoint) {
		datas := make([]map[string]any, 0, len(documents))
		for index, document := range documents {
			datas = append(datas, map[string]any{
				"index":   index,
				"query":   query,
				"content": document,
			})
		}
		return map[string]any{
			"rerank_model": config.ModelName,
			"topN":         topN,
			"datas":        datas,
		}
	}
	return map[string]any{
		"model":     config.ModelName,
		"query":     query,
		"documents": documents,
		"topN":      topN,
	}
}

func parseRerankResponseBody(endpoint string, body []byte, topN int) ([]RerankResult, error) {
	if isVolcengineKnowledgeRerankEndpoint(endpoint) {
		return parseVolcengineKnowledgeRerankResponse(body, topN)
	}

	var rerankResp RerankResponse
	if err := json.Unmarshal(body, &rerankResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	results := make([]RerankResult, 0, len(rerankResp.Results))
	for _, r := range rerankResp.Results {
		results = append(results, RerankResult{
			Index:          r.Index,
			RelevanceScore: r.RelevanceScore,
		})
	}
	return limitSortedRerankResults(results, topN), nil
}

func parseVolcengineKnowledgeRerankResponse(body []byte, topN int) ([]RerankResult, error) {
	var resp volcengineKnowledgeRerankResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal volcengine rerank response: %w", err)
	}
	if resp.Code != 0 {
		if resp.Message == "" {
			resp.Message = "unknown volcengine rerank error"
		}
		return nil, fmt.Errorf("volcengine rerank failed: code=%d message=%s", resp.Code, resp.Message)
	}

	var scores []float64
	if err := json.Unmarshal(resp.Data, &scores); err != nil {
		var wrapped struct {
			Scores []float64 `json:"scores"`
		}
		if wrappedErr := json.Unmarshal(resp.Data, &wrapped); wrappedErr != nil {
			return nil, fmt.Errorf("failed to parse volcengine rerank scores: %w", err)
		}
		scores = wrapped.Scores
	}
	results := make([]RerankResult, 0, len(scores))
	for index, score := range scores {
		results = append(results, RerankResult{
			Index:          index,
			RelevanceScore: score,
		})
	}
	return limitSortedRerankResults(results, topN), nil
}

func limitSortedRerankResults(results []RerankResult, topN int) []RerankResult {
	sort.SliceStable(results, func(i, j int) bool {
		if results[i].RelevanceScore == results[j].RelevanceScore {
			return results[i].Index < results[j].Index
		}
		return results[i].RelevanceScore > results[j].RelevanceScore
	})
	if topN > 0 && len(results) > topN {
		return results[:topN]
	}
	return results
}

func isVolcengineKnowledgeRerankEndpoint(endpoint string) bool {
	return strings.Contains(strings.ToLower(endpoint), "/api/knowledge/service/rerank")
}

func truncateRerankErrorBody(text string, limit int) string {
	text = strings.TrimSpace(text)
	if limit <= 0 || len([]rune(text)) <= limit {
		return text
	}
	return string([]rune(text)[:limit]) + "..."
}

func (s *rerank) RerankResults(ctx context.Context, query string, results []RetrieveResult, topN int) ([]RetrieveResult, error) {
	if len(results) == 0 {
		return nil, nil
	}

	if topN <= 0 {
		topN = len(results)
	}

	documents := make([]string, 0, len(results))
	for _, r := range results {
		documents = append(documents, r.Content)
	}

	rerankResults, err := s.Rerank(ctx, query, documents, topN)
	if err != nil {
		return nil, err
	}

	return applyRerankResults(results, rerankResults, topN), nil
}

func applyRerankResults(results []RetrieveResult, rerankResults []RerankResult, topN int) []RetrieveResult {
	if len(results) == 0 || len(rerankResults) == 0 {
		return nil
	}
	if topN <= 0 || topN > len(rerankResults) {
		topN = len(rerankResults)
	}
	rerankedResults := make([]RetrieveResult, 0, topN)
	for _, rr := range rerankResults {
		if rr.Index < 0 || rr.Index >= len(results) {
			continue
		}
		result := results[rr.Index]
		result.RerankScore = rr.RelevanceScore
		rerankedResults = append(rerankedResults, result)
		if len(rerankedResults) >= topN {
			break
		}
	}
	return rerankedResults
}

func (s *rerank) SimpleRerank(query string, results []RetrieveResult, topN int) []RetrieveResult {
	if len(results) == 0 {
		return nil
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Score > results[j].Score
	})

	if topN > 0 && len(results) > topN {
		return results[:topN]
	}

	return results
}
