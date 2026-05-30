package bootstrap

import (
	"context"
	"cs-ai-agent/internal/ai/rag/vectordb"
	"cs-ai-agent/internal/oidcclient"
	"cs-ai-agent/internal/pkg/config"
	"cs-ai-agent/internal/pkg/logx"
	"cs-ai-agent/internal/services/cronx"
	"cs-ai-agent/internal/wxwork"
	"log/slog"

	_ "cs-ai-agent/internal/services/event_handlers"
)

func Init(configPath string) error {
	cfg, err := config.Load(configPath)
	if err != nil {
		slog.Error("init config failed", "error", err)
		return err
	}
	config.SetCurrent(cfg)

	logx.Init(logx.Config{
		Level:     cfg.Logger.Level,
		Format:    cfg.Logger.Format,
		AddSource: cfg.Logger.AddSource,
	})

	if _, err := InitDB(cfg.DB); err != nil {
		slog.Error("init db failed", "error", err)
		return err
	}
	if err := InitMigrations(); err != nil {
		slog.Error("init migrations failed", "error", err)
		return err
	}
	if err := vectordb.Init(&cfg.VectorDB); err != nil {
		slog.Error("init vector db failed", "error", err)
		return err
	}

	// 启动任务调度器
	cronx.Init()

	wxwork.Init()
	if err := oidcclient.Init(context.Background()); err != nil {
		slog.Error("init oidc failed", "error", err)
		return err
	}
	return nil
}
