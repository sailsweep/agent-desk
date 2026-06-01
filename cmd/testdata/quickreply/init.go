package quickreply

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
			existing := repositories.QuickReplyRepository.Get(ctx.Tx, row.id)
			if existing == nil {
				item := &models.QuickReply{
					ID:        row.id,
					GroupName: row.groupName,
					Title:     row.title,
					Content:   row.content,
					Status:    row.status,
					SortNo:    row.sortNo,
					AuditFields: models.AuditFields{
						CreatedAt:      now,
						CreateUserID:   0,
						CreateUserName: "system",
						UpdatedAt:      now,
						UpdateUserID:   0,
						UpdateUserName: "system",
					},
				}
				if err := repositories.QuickReplyRepository.Create(ctx.Tx, item); err != nil {
					return err
				}
				continue
			}
			if err := repositories.QuickReplyRepository.Updates(ctx.Tx, row.id, map[string]any{
				"group_name":       row.groupName,
				"title":            row.title,
				"content":          row.content,
				"status":           row.status,
				"sort_no":          row.sortNo,
				"updated_at":       now,
				"update_user_id":   0,
				"update_user_name": "system",
			}); err != nil {
				return err
			}
		}
		return nil
	})
}

type seedItem struct {
	id        int64
	groupName string
	title     string
	content   string
	status    enums.Status
	sortNo    int
}

func seedItems(lang seedlang.Language) []seedItem {
	if lang == seedlang.English {
		return []seedItem{
			{
				id:        1,
				groupName: "New Visitor Reception",
				title:     "First contact greeting",
				content:   "Hello, welcome to AgentDesk support. I am the consultant assisting you today. Tell me what product, pricing, or integration option you want to learn about, and I will help you assess it quickly.",
				status:    enums.StatusOk,
				sortNo:    100,
			},
			{
				id:        2,
				groupName: "Product Inquiry",
				title:     "Product capability overview",
				content:   "We currently support AI Q&A, knowledge base retrieval, human handoff, tag management, quick replies, and agent workspace administration. If you already have a business scenario, I can break down a solution for that scenario.",
				status:    enums.StatusOk,
				sortNo:    95,
			},
			{
				id:        3,
				groupName: "Product Inquiry",
				title:     "Deployment options",
				content:   "The system supports both private deployment and cloud deployment. If you have strong data compliance requirements, evaluate private deployment first. If you want to launch quickly, start with the cloud version.",
				status:    enums.StatusOk,
				sortNo:    90,
			},
			{
				id:        4,
				groupName: "Quotation Follow-up",
				title:     "Information before quotation",
				content:   "To prepare an accurate quote, please share the expected number of agent seats, average daily conversation volume, whether a knowledge base is needed, and whether private deployment is required. I will organize the information and follow up quickly.",
				status:    enums.StatusOk,
				sortNo:    85,
			},
			{
				id:        5,
				groupName: "Quotation Follow-up",
				title:     "Quotation sent reminder",
				content:   "Hello, the solution and quotation have been sent to you. Please review them when convenient. If you want me to walk through feature boundaries, implementation timeline, and delivery approach, I can arrange that directly.",
				status:    enums.StatusOk,
				sortNo:    80,
			},
			{
				id:        6,
				groupName: "Implementation",
				title:     "Confirm details before troubleshooting",
				content:   "Got it. I will help troubleshoot first. Please add the time the issue started, affected scope, exact error screenshot, and whether any configuration was changed recently. This will help us locate the cause faster.",
				status:    enums.StatusOk,
				sortNo:    75,
			},
			{
				id:        7,
				groupName: "Implementation",
				title:     "Configuration effective time",
				content:   "The configuration has been updated and usually takes effect within 1 to 3 minutes. Please refresh the page and run another test. If anything is still abnormal, I will continue following up.",
				status:    enums.StatusOk,
				sortNo:    70,
			},
			{
				id:        8,
				groupName: "After-sales Support",
				title:     "Issue escalation notice",
				content:   "I have recorded this issue and escalated it to the technical team. The current priority is marked as high. We expect to provide the first conclusion today, and I will update you as soon as there is progress.",
				status:    enums.StatusOk,
				sortNo:    65,
			},
			{
				id:        9,
				groupName: "After-sales Support",
				title:     "Version update notice template",
				content:   "Hello, a version update is scheduled for Thursday evening. It mainly includes knowledge retrieval optimization and workspace experience improvements. There may be brief fluctuations during the update, and we will prepare rollback plans in advance.",
				status:    enums.StatusOk,
				sortNo:    60,
			},
			{
				id:        10,
				groupName: "Customer Follow-up",
				title:     "Trial period follow-up",
				content:   "Hello, I would like to check your trial experience over the past few days. Which features are used most often? Have you encountered anything hard to understand, complex to configure, or unstable in effect?",
				status:    enums.StatusOk,
				sortNo:    55,
			},
		}
	}
	return []seedItem{
		{
			id:        1,
			groupName: "新客接待",
			title:     "首次接入欢迎语",
			content:   "您好，欢迎来到 AgentDesk 客服中心，我是今天为您服务的顾问。您可以直接告诉我您想了解的产品、价格或接入方式，我这边先帮您快速判断。",
			status:    enums.StatusOk,
			sortNo:    100,
		},
		{
			id:        2,
			groupName: "产品咨询",
			title:     "产品能力概览",
			content:   "我们当前支持智能问答、知识库检索、会话转人工、标签体系、快捷回复和客服工作台管理。如果您已经有业务场景，我可以按场景给您拆方案。",
			status:    enums.StatusOk,
			sortNo:    95,
		},
		{
			id:        3,
			groupName: "产品咨询",
			title:     "部署方式说明",
			content:   "系统支持私有化部署和云端部署两种方式。若您对数据合规要求较高，建议优先评估私有化；如果希望快速上线，可以先从云端版本开始。",
			status:    enums.StatusOk,
			sortNo:    90,
		},
		{
			id:        4,
			groupName: "报价跟进",
			title:     "报价前信息收集",
			content:   "为了给您更准确的报价，麻烦提供一下预计坐席人数、日均会话量、是否需要知识库和是否有私有化部署需求，我整理后尽快给您反馈。",
			status:    enums.StatusOk,
			sortNo:    85,
		},
		{
			id:        5,
			groupName: "报价跟进",
			title:     "报价已发送提醒",
			content:   "您好，方案和报价单已经发送给您了，您方便的时候可以先看下。若您希望我同步讲解功能边界、实施周期和交付方式，我可以直接给您安排。",
			status:    enums.StatusOk,
			sortNo:    80,
		},
		{
			id:        6,
			groupName: "实施上线",
			title:     "排查前确认信息",
			content:   "收到，我先帮您排查。麻烦补充一下问题出现时间、影响范围、具体报错截图，以及最近是否做过配置调整，这样能更快定位。",
			status:    enums.StatusOk,
			sortNo:    75,
		},
		{
			id:        7,
			groupName: "实施上线",
			title:     "配置生效说明",
			content:   "配置已经更新完成，通常 1 到 3 分钟内会生效。建议您刷新页面后重新发起一次测试，如果还有异常，我继续跟进处理。",
			status:    enums.StatusOk,
			sortNo:    70,
		},
		{
			id:        8,
			groupName: "售后支持",
			title:     "问题升级告知",
			content:   "这个问题我已经记录并升级给技术同学处理，当前优先级已标为高。预计今天内会给您第一轮结论，有进展我会第一时间同步。",
			status:    enums.StatusOk,
			sortNo:    65,
		},
		{
			id:        9,
			groupName: "售后支持",
			title:     "版本更新通知模板",
			content:   "您好，本周四晚间会进行一次版本更新，主要涉及知识库检索优化和工作台体验改进。更新期间可能出现短时波动，我们会提前做好回滚预案。",
			status:    enums.StatusOk,
			sortNo:    60,
		},
		{
			id:        10,
			groupName: "回访运营",
			title:     "试用期回访",
			content:   "您好，想跟您确认一下这几天的试用体验。当前最常用的是哪几个功能？有没有遇到理解成本高、配置复杂或效果不稳定的地方？",
			status:    enums.StatusOk,
			sortNo:    55,
		},
	}
}
