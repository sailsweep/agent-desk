package ai

import (
	"bufio"
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestAIUpstreamLogSanitizesSecretsAndTruncates(t *testing.T) {
	got := sanitizeAIUpstreamLogValue(map[string]any{
		"Authorization": "Bearer secret-token",
		"apiKey":        "api-secret",
		"ak":            "access-key",
		"messages": []map[string]any{
			{"role": "user", "content": strings.Repeat("长", 20)},
		},
		"embedding": []float64{0.1, 0.2, 0.3, 0.4},
	}, 8, 2)

	raw, err := json.Marshal(got)
	if err != nil {
		t.Fatalf("marshal sanitized value: %v", err)
	}
	text := string(raw)
	for _, secret := range []string{"secret-token", "api-secret", "access-key"} {
		if strings.Contains(text, secret) {
			t.Fatalf("sanitized log leaked secret %q: %s", secret, text)
		}
	}
	if !strings.Contains(text, "[REDACTED]") {
		t.Fatalf("expected redacted marker in %s", text)
	}
	if !strings.Contains(text, "truncated") {
		t.Fatalf("expected truncated marker in %s", text)
	}
}

func TestLogUpstreamCallWritesJSONLToConfiguredFile(t *testing.T) {
	dir := t.TempDir()
	InitUpstreamLogger(UpstreamLogConfig{
		Enabled:        true,
		Dir:            dir,
		Filename:       "ai-upstream-test.log",
		MaxStringRunes: 64,
		MaxArrayItems:  4,
	})
	t.Cleanup(func() {
		InitUpstreamLogger(UpstreamLogConfig{})
	})

	LogUpstreamCall(context.Background(), UpstreamLogEntry{
		Operation:  "embedding.create",
		ModelType:  "embedding",
		Provider:   "openai",
		ModelName:  "test-embedding",
		BaseURL:    "https://example.com/v1",
		Endpoint:   "/embeddings",
		StatusCode: 200,
		Duration:   12 * time.Millisecond,
		Request: map[string]any{
			"model": "test-embedding",
			"input": "hello",
		},
		Response: map[string]any{
			"dimension": 3,
		},
	})

	file, err := os.Open(filepath.Join(dir, "ai-upstream-test.log"))
	if err != nil {
		t.Fatalf("open log file: %v", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	if !scanner.Scan() {
		t.Fatalf("expected one log line, scanner err=%v", scanner.Err())
	}
	var record map[string]any
	if err := json.Unmarshal(scanner.Bytes(), &record); err != nil {
		t.Fatalf("unmarshal jsonl record: %v", err)
	}
	if record["operation"] != "embedding.create" || record["modelType"] != "embedding" || record["endpoint"] != "/embeddings" {
		t.Fatalf("unexpected log record: %+v", record)
	}
}
