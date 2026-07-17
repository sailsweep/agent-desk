package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLoadReadsCORSAllowedOrigins(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	content := []byte(`server:
  port: 8083
  cors:
    allowedOrigins:
      - https://console.example.com
      - http://localhost:3000
`)
	if err := os.WriteFile(path, content, 0600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	got := cfg.Server.CORS.AllowedOrigins
	want := []string{"https://console.example.com", "http://localhost:3000"}
	if len(got) != len(want) {
		t.Fatalf("len(AllowedOrigins)=%d want %d", len(got), len(want))
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("AllowedOrigins[%d]=%q want %q", i, got[i], want[i])
		}
	}
}

func TestLoadReadsAIUpstreamLogConfig(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	content := []byte(`aiUpstreamLog:
  enabled: true
  dir: .codex/logs
  filename: ai-upstream.log
  maxStringRunes: 1200
  maxArrayItems: 20
`)
	if err := os.WriteFile(path, content, 0600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if !cfg.AIUpstreamLog.Enabled {
		t.Fatal("expected AIUpstreamLog.Enabled=true")
	}
	if cfg.AIUpstreamLog.Dir != ".codex/logs" || cfg.AIUpstreamLog.Filename != "ai-upstream.log" {
		t.Fatalf("unexpected upstream log path config: %+v", cfg.AIUpstreamLog)
	}
	if cfg.AIUpstreamLog.MaxStringRunes != 1200 || cfg.AIUpstreamLog.MaxArrayItems != 20 {
		t.Fatalf("unexpected upstream log limits: %+v", cfg.AIUpstreamLog)
	}
}

func TestLoadOverridesValuesFromEnvironment(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.yaml")
	content := []byte(`server:
  port: 8083
db:
  type: sqlite
  dsn: file:./data/app.db?_busy_timeout=5000
storage:
  local:
    baseUrl: /storage
mcp:
  servers:
    system:
      endpoint: http://127.0.0.1:8083/api/mcp
`)
	if err := os.WriteFile(path, content, 0600); err != nil {
		t.Fatalf("WriteFile() error = %v", err)
	}
	t.Setenv("AGENT_DESK_SERVER_PORT", "8090")
	t.Setenv("AGENT_DESK_DB_DSN", "mysql-dsn")
	t.Setenv("AGENT_DESK_STORAGE_LOCAL_BASEURL", "/files")
	t.Setenv("AGENT_DESK_MCP_SERVERS_SYSTEM_ENDPOINT", "http://127.0.0.1:8090/api/mcp")

	cfg, err := Load(path)
	if err != nil {
		t.Fatalf("Load() error = %v", err)
	}

	if cfg.Server.Port != 8090 {
		t.Fatalf("Server.Port=%d want 8090", cfg.Server.Port)
	}
	if cfg.DB.Type != "sqlite" {
		t.Fatalf("DB.Type=%q want sqlite", cfg.DB.Type)
	}
	if cfg.DB.DSN != "mysql-dsn" {
		t.Fatalf("DB.DSN=%q want mysql-dsn", cfg.DB.DSN)
	}
	if cfg.Storage.Local.BaseURL != "/files" {
		t.Fatalf("Storage.Local.BaseURL=%q want /files", cfg.Storage.Local.BaseURL)
	}
	if cfg.MCP.Servers["system"].Endpoint != "http://127.0.0.1:8090/api/mcp" {
		t.Fatalf("MCP system endpoint=%q", cfg.MCP.Servers["system"].Endpoint)
	}
}
