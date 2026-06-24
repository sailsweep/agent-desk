package services

import (
	"strings"
	"testing"

	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/enums"

	"github.com/glebarez/sqlite"
	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestChannelServiceRejectsAgentWithoutPublishedWorkflow(t *testing.T) {
	db := setupChannelServiceTestDB(t)
	agent := createChannelServiceTestAgent(t, db, 0)

	_, err := ChannelService.CreateChannel(request.CreateChannelRequest{
		ChannelType: enums.ChannelTypeWeb,
		AIAgentID:   agent.ID,
		Name:        "官网客服",
		Status:      int(enums.StatusOk),
	}, channelServiceTestOperator())
	if err == nil {
		t.Fatalf("expected channel creation to reject unpublished ai agent")
	}
}

func TestChannelServiceAllowsAgentWithPublishedWorkflow(t *testing.T) {
	db := setupChannelServiceTestDB(t)
	agent := createChannelServiceTestAgent(t, db, 1001)

	item, err := ChannelService.CreateChannel(request.CreateChannelRequest{
		ChannelType: enums.ChannelTypeWeb,
		AIAgentID:   agent.ID,
		Name:        "官网客服",
		Status:      int(enums.StatusOk),
	}, channelServiceTestOperator())
	if err != nil {
		t.Fatalf("create channel: %v", err)
	}
	if item == nil || item.AIAgentID != agent.ID {
		t.Fatalf("unexpected channel: %#v", item)
	}
}

func setupChannelServiceTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dbName := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	db, err := gorm.Open(sqlite.Open("file:"+dbName+"?mode=memory&cache=shared"), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{
			TablePrefix:   "t_",
			SingularTable: true,
		},
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})
	if err := db.AutoMigrate(&models.AIAgent{}, &models.Channel{}); err != nil {
		t.Fatalf("auto migrate: %v", err)
	}
	sqls.SetDB(db)
	return db
}

func createChannelServiceTestAgent(t *testing.T, db *gorm.DB, workflowVersionID int64) models.AIAgent {
	t.Helper()
	item := models.AIAgent{
		Name:              "测试 AI",
		Status:            enums.StatusOk,
		WorkflowVersionID: workflowVersionID,
	}
	if err := db.Create(&item).Error; err != nil {
		t.Fatalf("create ai agent: %v", err)
	}
	return item
}

func channelServiceTestOperator() *dto.AuthPrincipal {
	return &dto.AuthPrincipal{UserID: 1, Username: "admin"}
}
