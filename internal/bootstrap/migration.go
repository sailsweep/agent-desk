package bootstrap

import (
	"cs-ai-agent/internal/migration"
	"cs-ai-agent/internal/models"

	"github.com/mlogclub/simple/sqls"
)

func InitMigrations() error {
	if err := sqls.DB().AutoMigrate(models.Models...); err != nil {
		return err
	}
	return migration.Migrate()
}
