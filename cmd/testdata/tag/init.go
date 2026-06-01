package tag

import (
	"agent-desk/cmd/testdata/seedlang"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/repositories"
	"time"

	"github.com/mlogclub/simple/sqls"
)

func Init(lang seedlang.Language) error {
	seed := seedItems(lang)
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		now := time.Now()
		for _, row := range seed {
			existing := repositories.TagRepository.Get(ctx.Tx, row.id)
			if existing == nil {
				tag := &models.Tag{
					ID:       row.id,
					ParentID: row.parentID,
					Name:     row.name,
					Remark:   "",
					SortNo:   row.sortNo,
					Status:   enums.StatusOk,
					AuditFields: models.AuditFields{
						CreatedAt:      now,
						CreateUserID:   0,
						CreateUserName: "",
						UpdatedAt:      now,
						UpdateUserID:   0,
						UpdateUserName: "",
					},
				}
				if err := repositories.TagRepository.Create(ctx.Tx, tag); err != nil {
					return err
				}
				continue
			}
			if err := repositories.TagRepository.Updates(ctx.Tx, row.id, map[string]any{
				"parent_id":        row.parentID,
				"name":             row.name,
				"remark":           "",
				"sort_no":          row.sortNo,
				"status":           enums.StatusOk,
				"updated_at":       now,
				"update_user_id":   0,
				"update_user_name": "",
			}); err != nil {
				return err
			}
		}
		return nil
	})
}

type seedItem struct {
	id       int64
	parentID int64
	name     string
	sortNo   int
}

func seedItems(lang seedlang.Language) []seedItem {
	if lang == seedlang.English {
		return []seedItem{
			{1, 0, "Pre-sales", 1},
			{2, 1, "AgentDesk", 1},
			{3, 2, "Product Inquiry", 1},
			{4, 2, "Purchase Intent", 1},
			{5, 0, "After-sales", 2},
			{6, 5, "AgentDesk", 1},
			{7, 6, "Issue Feedback", 1},
			{8, 6, "Product Deployment", 2},
			{9, 6, "Feature Request", 3},
		}
	}
	return []seedItem{
		{1, 0, "售前", 1},
		{2, 1, "AgentDesk", 1},
		{3, 2, "产品咨询", 1},
		{4, 2, "购买意向", 1},
		{5, 0, "售后", 2},
		{6, 5, "AgentDesk", 1},
		{7, 6, "问题反馈", 1},
		{8, 6, "产品部署", 2},
		{9, 6, "需求工单", 3},
	}
}
