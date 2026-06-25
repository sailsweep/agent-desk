package services

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"
	"time"

	"agent-desk/internal/ai/workflow/dsl"
	workflowregistry "agent-desk/internal/ai/workflow/registry"
	workflowvalidator "agent-desk/internal/ai/workflow/validator"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/pkg/httpx/params"
	"agent-desk/internal/pkg/utils"
	"agent-desk/internal/repositories"

	"github.com/mlogclub/simple/sqls"
	"gorm.io/gorm"
)

var AIWorkflowService = newAIWorkflowService()

func newAIWorkflowService() *aiWorkflowService {
	return &aiWorkflowService{
		registry: workflowregistry.DefaultRegistry(),
	}
}

type aiWorkflowService struct {
	registry *workflowregistry.Registry
}

type AIWorkflowRunAuditItem struct {
	Run      models.AIWorkflowRun
	Workflow *models.AIWorkflow
	Version  *models.AIWorkflowVersion
	Agent    *models.AIAgent
}

func (s *aiWorkflowService) Get(id int64) *models.AIWorkflow {
	if id <= 0 {
		return nil
	}
	return repositories.AIWorkflowRepository.Get(sqls.DB(), id)
}

func (s *aiWorkflowService) GetVersion(id int64) *models.AIWorkflowVersion {
	if id <= 0 {
		return nil
	}
	return repositories.AIWorkflowVersionRepository.Get(sqls.DB(), id)
}

func (s *aiWorkflowService) FindPageByCnd(cnd *sqls.Cnd) (list []models.AIWorkflow, paging *sqls.Paging) {
	return repositories.AIWorkflowRepository.FindPageByCnd(sqls.DB(), cnd)
}

func (s *aiWorkflowService) FindVersionPageByParams(params *params.QueryParams) (list []models.AIWorkflowVersion, paging *sqls.Paging) {
	return repositories.AIWorkflowVersionRepository.FindPageByParams(sqls.DB(), params)
}

func (s *aiWorkflowService) FindRunPageByCnd(cnd *sqls.Cnd) (list []models.AIWorkflowRun, paging *sqls.Paging) {
	return repositories.AIWorkflowRunRepository.FindPageByCnd(sqls.DB(), cnd)
}

func (s *aiWorkflowService) BuildRunAuditItems(list []models.AIWorkflowRun) []AIWorkflowRunAuditItem {
	ret := make([]AIWorkflowRunAuditItem, 0, len(list))
	if len(list) == 0 {
		return ret
	}
	workflowIDs := make([]int64, 0, len(list))
	versionIDs := make([]int64, 0, len(list))
	agentIDs := make([]int64, 0, len(list))
	for _, item := range list {
		workflowIDs = appendNonZeroInt64(workflowIDs, item.WorkflowID)
		versionIDs = appendNonZeroInt64(versionIDs, item.WorkflowVersionID)
		agentIDs = appendNonZeroInt64(agentIDs, item.AIAgentID)
	}
	var workflows []models.AIWorkflow
	if len(workflowIDs) > 0 {
		workflows = repositories.AIWorkflowRepository.Find(sqls.DB(), sqls.NewCnd().In("id", workflowIDs))
	}
	var versions []models.AIWorkflowVersion
	if len(versionIDs) > 0 {
		versions = repositories.AIWorkflowVersionRepository.Find(sqls.DB(), sqls.NewCnd().In("id", versionIDs))
	}
	var agents []models.AIAgent
	if len(agentIDs) > 0 {
		agents = repositories.AIAgentRepository.Find(sqls.DB(), sqls.NewCnd().In("id", agentIDs))
	}
	workflowByID := make(map[int64]*models.AIWorkflow, len(workflows))
	for i := range workflows {
		item := workflows[i]
		workflowByID[item.ID] = &item
	}
	versionByID := make(map[int64]*models.AIWorkflowVersion, len(versions))
	for i := range versions {
		item := versions[i]
		versionByID[item.ID] = &item
	}
	agentByID := make(map[int64]*models.AIAgent, len(agents))
	for i := range agents {
		item := agents[i]
		agentByID[item.ID] = &item
	}
	for _, run := range list {
		ret = append(ret, AIWorkflowRunAuditItem{
			Run:      run,
			Workflow: workflowByID[run.WorkflowID],
			Version:  versionByID[run.WorkflowVersionID],
			Agent:    agentByID[run.AIAgentID],
		})
	}
	return ret
}

func (s *aiWorkflowService) GetRunDetail(id int64) (*models.AIWorkflowRun, []models.AIWorkflowNodeRun) {
	if id <= 0 {
		return nil, nil
	}
	run := repositories.AIWorkflowRunRepository.Get(sqls.DB(), id)
	if run == nil {
		return nil, nil
	}
	nodes := repositories.AIWorkflowNodeRunRepository.Find(sqls.DB(), sqls.NewCnd().Eq("workflow_run_id", id).Asc("id"))
	return run, nodes
}

func appendNonZeroInt64(list []int64, value int64) []int64 {
	if value <= 0 {
		return list
	}
	for _, item := range list {
		if item == value {
			return list
		}
	}
	return append(list, value)
}

func (s *aiWorkflowService) GetByAgentID(agentID int64) *models.AIWorkflow {
	if agentID <= 0 {
		return nil
	}
	return repositories.AIWorkflowRepository.Take(sqls.DB(), "agent_id = ? AND status <> ?", agentID, enums.StatusDeleted)
}

func (s *aiWorkflowService) GetOrCreateAgentWorkflow(agentID int64, operator *dto.AuthPrincipal) (*models.AIWorkflow, error) {
	if operator == nil {
		return nil, errorsx.UnauthorizedI18n("error.auth.expired")
	}
	if agentID <= 0 {
		return nil, errorsx.InvalidParam("agent id is required")
	}
	if agent := AIAgentService.Get(agentID); agent == nil || agent.Status == enums.StatusDeleted {
		return nil, errorsx.InvalidParamI18n("error.e0002")
	}
	if item := s.GetByAgentID(agentID); item != nil {
		return item, nil
	}
	var item *models.AIWorkflow
	err := sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		if current := repositories.AIWorkflowRepository.Take(ctx.Tx, "agent_id = ? AND status <> ?", agentID, enums.StatusDeleted); current != nil {
			item = current
			return nil
		}
		agent := repositories.AIAgentRepository.Get(ctx.Tx, agentID)
		if agent == nil || agent.Status == enums.StatusDeleted {
			return errorsx.InvalidParamI18n("error.e0002")
		}
		created, err := s.createDefaultAgentWorkflow(ctx.Tx, agent, operator)
		if err != nil {
			return err
		}
		item = created
		return nil
	})
	if err != nil {
		return nil, err
	}
	return item, nil
}

func (s *aiWorkflowService) ListNodeSpecs() []workflowregistry.NodeSpec {
	return s.registry.List()
}

func (s *aiWorkflowService) ValidateDefinition(def dsl.Definition) workflowvalidator.Result {
	return workflowvalidator.ValidateDefinition(def, s.registry)
}

func (s *aiWorkflowService) CreateWorkflow(req request.CreateAIWorkflowRequest, operator *dto.AuthPrincipal) (*models.AIWorkflow, error) {
	return s.SaveAgentWorkflow(req, operator)
}

func (s *aiWorkflowService) SaveAgentWorkflow(req request.SaveAIWorkflowRequest, operator *dto.AuthPrincipal) (*models.AIWorkflow, error) {
	if operator == nil {
		return nil, errorsx.UnauthorizedI18n("error.auth.expired")
	}
	agent := AIAgentService.Get(req.AgentID)
	if agent == nil || agent.Status == enums.StatusDeleted {
		return nil, errorsx.InvalidParamI18n("error.e0002")
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		name = defaultAgentWorkflowName(agent.Name)
	}
	definition, err := marshalDefinition(req.Definition)
	if err != nil {
		return nil, err
	}
	current := s.GetByAgentID(req.AgentID)
	if current == nil {
		item := &models.AIWorkflow{
			Name:            name,
			Description:     strings.TrimSpace(req.Description),
			AgentID:         req.AgentID,
			Status:          enums.StatusOk,
			DraftDefinition: definition,
			AuditFields:     utils.BuildAuditFields(operator),
		}
		if err := repositories.AIWorkflowRepository.Create(sqls.DB(), item); err != nil {
			return nil, err
		}
		return item, nil
	}
	if err := repositories.AIWorkflowRepository.Updates(sqls.DB(), current.ID, map[string]interface{}{
		"name":             name,
		"description":      strings.TrimSpace(req.Description),
		"agent_id":         req.AgentID,
		"draft_definition": definition,
		"update_user_id":   operator.UserID,
		"update_user_name": operator.Username,
		"updated_at":       time.Now(),
	}); err != nil {
		return nil, err
	}
	return s.Get(current.ID), nil
}

func (s *aiWorkflowService) UpdateWorkflow(req request.UpdateAIWorkflowRequest, operator *dto.AuthPrincipal) error {
	if operator == nil {
		return errorsx.UnauthorizedI18n("error.auth.expired")
	}
	if s.Get(req.ID) == nil {
		return errorsx.InvalidParamI18n("error.e0002")
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		return errorsx.InvalidParam("workflow name is required")
	}
	if req.AgentID <= 0 {
		return errorsx.InvalidParam("agent id is required")
	}
	definition, err := marshalDefinition(req.Definition)
	if err != nil {
		return err
	}
	return repositories.AIWorkflowRepository.Updates(sqls.DB(), req.ID, map[string]interface{}{
		"name":             name,
		"description":      strings.TrimSpace(req.Description),
		"agent_id":         req.AgentID,
		"draft_definition": definition,
		"update_user_id":   operator.UserID,
		"update_user_name": operator.Username,
		"updated_at":       time.Now(),
	})
}

func (s *aiWorkflowService) DeleteWorkflow(id int64, operator *dto.AuthPrincipal) error {
	if operator == nil {
		return errorsx.UnauthorizedI18n("error.auth.expired")
	}
	if s.Get(id) == nil {
		return errorsx.InvalidParamI18n("error.e0002")
	}
	return repositories.AIWorkflowRepository.Updates(sqls.DB(), id, map[string]interface{}{
		"status":           enums.StatusDeleted,
		"update_user_id":   operator.UserID,
		"update_user_name": operator.Username,
		"updated_at":       time.Now(),
	})
}

func (s *aiWorkflowService) PublishWorkflow(req request.PublishAIWorkflowRequest, operator *dto.AuthPrincipal) (*models.AIWorkflowVersion, error) {
	if req.AgentID > 0 {
		return s.PublishAgentWorkflow(req, operator)
	}
	if operator == nil {
		return nil, errorsx.UnauthorizedI18n("error.auth.expired")
	}
	workflow := s.Get(req.WorkflowID)
	if workflow == nil || workflow.Status == enums.StatusDeleted {
		return nil, errorsx.InvalidParamI18n("error.e0002")
	}
	result := s.ValidateDefinition(req.Definition)
	if !result.Valid {
		return nil, errorsx.InvalidParam("workflow definition is invalid")
	}
	definition, err := marshalDefinition(req.Definition)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	var version *models.AIWorkflowVersion
	err = sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		nextVersion := repositories.AIWorkflowVersionRepository.MaxVersionByWorkflowID(ctx.Tx, req.WorkflowID) + 1
		version = &models.AIWorkflowVersion{
			WorkflowID:      req.WorkflowID,
			Version:         nextVersion,
			Status:          enums.StatusOk,
			Definition:      definition,
			DefinitionHash:  hashDefinition(definition),
			PublishedAt:     &now,
			PublishedByID:   operator.UserID,
			PublishedByName: operator.Username,
			AuditFields:     utils.BuildAuditFields(operator),
		}
		if err := repositories.AIWorkflowVersionRepository.Create(ctx.Tx, version); err != nil {
			return err
		}
		return repositories.AIWorkflowRepository.Updates(ctx.Tx, req.WorkflowID, map[string]interface{}{
			"draft_definition":     definition,
			"published_version_id": version.ID,
			"update_user_id":       operator.UserID,
			"update_user_name":     operator.Username,
			"updated_at":           now,
		})
	})
	if err != nil {
		return nil, err
	}
	return version, nil
}

func (s *aiWorkflowService) PublishAgentWorkflow(req request.PublishAIWorkflowRequest, operator *dto.AuthPrincipal) (*models.AIWorkflowVersion, error) {
	if operator == nil {
		return nil, errorsx.UnauthorizedI18n("error.auth.expired")
	}
	workflow, err := s.GetOrCreateAgentWorkflow(req.AgentID, operator)
	if err != nil {
		return nil, err
	}
	req.WorkflowID = workflow.ID
	result := s.ValidateDefinition(req.Definition)
	if !result.Valid {
		return nil, errorsx.InvalidParam("workflow definition is invalid")
	}
	definition, err := marshalDefinition(req.Definition)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	var version *models.AIWorkflowVersion
	err = sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		current := repositories.AIWorkflowRepository.Get(ctx.Tx, workflow.ID)
		if current == nil || current.AgentID != req.AgentID || current.Status == enums.StatusDeleted {
			return errorsx.InvalidParamI18n("error.e0002")
		}
		nextVersion := repositories.AIWorkflowVersionRepository.MaxVersionByWorkflowID(ctx.Tx, current.ID) + 1
		version = &models.AIWorkflowVersion{
			WorkflowID:      current.ID,
			Version:         nextVersion,
			Status:          enums.StatusOk,
			Definition:      definition,
			DefinitionHash:  hashDefinition(definition),
			PublishedAt:     &now,
			PublishedByID:   operator.UserID,
			PublishedByName: operator.Username,
			AuditFields:     utils.BuildAuditFields(operator),
		}
		if err := repositories.AIWorkflowVersionRepository.Create(ctx.Tx, version); err != nil {
			return err
		}
		if err := repositories.AIWorkflowRepository.Updates(ctx.Tx, current.ID, map[string]interface{}{
			"draft_definition":     definition,
			"published_version_id": version.ID,
			"update_user_id":       operator.UserID,
			"update_user_name":     operator.Username,
			"updated_at":           now,
		}); err != nil {
			return err
		}
		return repositories.AIAgentRepository.Updates(ctx.Tx, req.AgentID, map[string]any{
			"workflow_version_id": version.ID,
			"update_user_id":      operator.UserID,
			"update_user_name":    operator.Username,
			"updated_at":          now,
		})
	})
	if err != nil {
		return nil, err
	}
	return version, nil
}

func (s *aiWorkflowService) createDefaultAgentWorkflow(db *gorm.DB, agent *models.AIAgent, operator *dto.AuthPrincipal) (*models.AIWorkflow, error) {
	definition, err := marshalDefinition(defaultAgentWorkflowDefinition())
	if err != nil {
		return nil, err
	}
	item := &models.AIWorkflow{
		Name:            defaultAgentWorkflowName(agent.Name),
		AgentID:         agent.ID,
		Status:          enums.StatusOk,
		DraftDefinition: definition,
		AuditFields:     utils.BuildAuditFields(operator),
	}
	if err := repositories.AIWorkflowRepository.Create(db, item); err != nil {
		return nil, err
	}
	return item, nil
}

func defaultAgentWorkflowDefinition() dsl.Definition {
	return dsl.Definition{
		SchemaVersion: 1,
		EntryNodeID:   "start_1",
		Nodes: []dsl.Node{
			{ID: "start_1", Type: workflowregistry.NodeTypeStart, Name: "开始", Position: dsl.Position{X: 0, Y: 260}},
			{ID: "route_intent_1", Type: workflowregistry.NodeTypeCondition, Name: "意图分流", Position: dsl.Position{X: 260, Y: 260}},
			{ID: "handoff_1", Type: workflowregistry.NodeTypeHandoffToHuman, Name: "转人工", Position: dsl.Position{X: 560, Y: 80}, Inputs: map[string]dsl.VariableSelector{
				"reason": {NodeID: "start_1", Field: "userMessage"},
			}},
			{ID: "handoff_end_1", Type: workflowregistry.NodeTypeEnd, Name: "结束", Position: dsl.Position{X: 860, Y: 80}},
			{ID: "draft_ticket_1", Type: workflowregistry.NodeTypePrepareTicketDraft, Name: "整理工单草稿", Position: dsl.Position{X: 560, Y: 240}, Inputs: map[string]dsl.VariableSelector{
				"issue": {NodeID: "start_1", Field: "userMessage"},
			}},
			{ID: "ticket_confirm_prompt_1", Type: workflowregistry.NodeTypeLLMReply, Name: "建单确认文案", Position: dsl.Position{X: 860, Y: 240}, Config: json.RawMessage(`{"staticReply":"我已整理工单草稿。请回复“确认”创建工单，或回复“取消”放弃。"}`), Inputs: map[string]dsl.VariableSelector{
				"userMessage": {NodeID: "start_1", Field: "userMessage"},
			}},
			{ID: "ticket_confirm_1", Type: workflowregistry.NodeTypeHumanConfirm, Name: "确认建单", Position: dsl.Position{X: 1160, Y: 240}, Inputs: map[string]dsl.VariableSelector{
				"prompt": {NodeID: "ticket_confirm_prompt_1", Field: "replyText"},
			}},
			{ID: "create_ticket_1", Type: workflowregistry.NodeTypeCreateTicket, Name: "创建工单", Position: dsl.Position{X: 1460, Y: 180}, Inputs: map[string]dsl.VariableSelector{
				"ticketDraft": {NodeID: "draft_ticket_1", Field: "ticketDraft"},
				"confirmed":   {NodeID: "ticket_confirm_1", Field: "confirmed"},
			}},
			{ID: "ticket_result_reply_1", Type: workflowregistry.NodeTypeSendReply, Name: "发送建单结果", Position: dsl.Position{X: 1760, Y: 180}, Inputs: map[string]dsl.VariableSelector{
				"replyText": {NodeID: "create_ticket_1", Field: "message"},
			}},
			{ID: "ticket_cancel_reply_1", Type: workflowregistry.NodeTypeLLMReply, Name: "取消建单提示", Position: dsl.Position{X: 1460, Y: 320}, Config: json.RawMessage(`{"staticReply":"已取消创建工单。你可以继续补充问题，我会继续帮你处理。"}`), Inputs: map[string]dsl.VariableSelector{
				"userMessage": {NodeID: "start_1", Field: "userMessage"},
			}},
			{ID: "send_ticket_cancel_1", Type: workflowregistry.NodeTypeSendReply, Name: "发送取消提示", Position: dsl.Position{X: 1760, Y: 320}, Inputs: map[string]dsl.VariableSelector{
				"replyText": {NodeID: "ticket_cancel_reply_1", Field: "replyText"},
			}},
			{ID: "retrieve_1", Type: workflowregistry.NodeTypeKnowledgeRetrieve, Name: "知识检索", Position: dsl.Position{X: 560, Y: 500}, Inputs: map[string]dsl.VariableSelector{
				"query": {NodeID: "start_1", Field: "userMessage"},
			}},
			{ID: "answerability_1", Type: workflowregistry.NodeTypeAnswerabilityGate, Name: "可回答判断", Position: dsl.Position{X: 860, Y: 500}, Inputs: map[string]dsl.VariableSelector{
				"userMessage":    {NodeID: "start_1", Field: "userMessage"},
				"knowledgeItems": {NodeID: "retrieve_1", Field: "items"},
			}},
			{ID: "reply_1", Type: workflowregistry.NodeTypeLLMReply, Name: "AI 回复", Position: dsl.Position{X: 1160, Y: 440}, Inputs: map[string]dsl.VariableSelector{
				"userMessage":    {NodeID: "start_1", Field: "userMessage"},
				"knowledgeItems": {NodeID: "retrieve_1", Field: "items"},
			}},
			{ID: "send_1", Type: workflowregistry.NodeTypeSendReply, Name: "发送回复", Position: dsl.Position{X: 1460, Y: 440}, Inputs: map[string]dsl.VariableSelector{
				"replyText": {NodeID: "reply_1", Field: "replyText"},
			}},
			{ID: "fallback_reply_1", Type: workflowregistry.NodeTypeLLMReply, Name: "兜底追问", Position: dsl.Position{X: 1160, Y: 600}, Inputs: map[string]dsl.VariableSelector{
				"userMessage":    {NodeID: "start_1", Field: "userMessage"},
				"knowledgeItems": {NodeID: "retrieve_1", Field: "items"},
			}},
			{ID: "send_fallback_1", Type: workflowregistry.NodeTypeSendReply, Name: "发送兜底", Position: dsl.Position{X: 1460, Y: 600}, Inputs: map[string]dsl.VariableSelector{
				"replyText": {NodeID: "fallback_reply_1", Field: "replyText"},
			}},
			{ID: "end_1", Type: workflowregistry.NodeTypeEnd, Name: "结束", Position: dsl.Position{X: 2060, Y: 440}},
		},
		Edges: []dsl.Edge{
			{ID: "edge_start_route_intent", Source: "start_1", Target: "route_intent_1"},
			{ID: "edge_intent_handoff", Source: "route_intent_1", Target: "handoff_1", Condition: &dsl.Condition{
				Left:     &dsl.VariableSelector{NodeID: "start_1", Field: "userMessage"},
				Operator: "contains",
				Right:    "人工",
			}},
			{ID: "edge_intent_ticket", Source: "route_intent_1", Target: "draft_ticket_1", Condition: &dsl.Condition{
				Left:     &dsl.VariableSelector{NodeID: "start_1", Field: "userMessage"},
				Operator: "contains",
				Right:    "工单",
			}},
			{ID: "edge_intent_complaint", Source: "route_intent_1", Target: "draft_ticket_1", Condition: &dsl.Condition{
				Left:     &dsl.VariableSelector{NodeID: "start_1", Field: "userMessage"},
				Operator: "contains",
				Right:    "投诉",
			}},
			{ID: "edge_intent_incident", Source: "route_intent_1", Target: "draft_ticket_1", Condition: &dsl.Condition{
				Left:     &dsl.VariableSelector{NodeID: "start_1", Field: "userMessage"},
				Operator: "contains",
				Right:    "报障",
			}},
			{ID: "edge_intent_knowledge_default", Source: "route_intent_1", Target: "retrieve_1"},
			{ID: "edge_handoff_end", Source: "handoff_1", Target: "handoff_end_1"},
			{ID: "edge_draft_ticket_confirm_prompt", Source: "draft_ticket_1", Target: "ticket_confirm_prompt_1"},
			{ID: "edge_ticket_prompt_confirm", Source: "ticket_confirm_prompt_1", Target: "ticket_confirm_1"},
			{ID: "edge_ticket_confirm_create", Source: "ticket_confirm_1", Target: "create_ticket_1", Condition: &dsl.Condition{
				Left:     &dsl.VariableSelector{NodeID: "ticket_confirm_1", Field: "confirmed"},
				Operator: "is_true",
			}},
			{ID: "edge_ticket_confirm_cancel", Source: "ticket_confirm_1", Target: "ticket_cancel_reply_1"},
			{ID: "edge_create_ticket_result", Source: "create_ticket_1", Target: "ticket_result_reply_1"},
			{ID: "edge_ticket_result_end", Source: "ticket_result_reply_1", Target: "end_1"},
			{ID: "edge_ticket_cancel_send", Source: "ticket_cancel_reply_1", Target: "send_ticket_cancel_1"},
			{ID: "edge_ticket_cancel_end", Source: "send_ticket_cancel_1", Target: "end_1"},
			{ID: "edge_retrieve_answerability", Source: "retrieve_1", Target: "answerability_1"},
			{ID: "edge_answerability_reply", Source: "answerability_1", Target: "reply_1", Condition: &dsl.Condition{
				Left:     &dsl.VariableSelector{NodeID: "answerability_1", Field: "answerability"},
				Operator: "eq",
				Right:    "answerable",
			}},
			{ID: "edge_answerability_fallback", Source: "answerability_1", Target: "fallback_reply_1"},
			{ID: "edge_reply_send", Source: "reply_1", Target: "send_1"},
			{ID: "edge_fallback_send", Source: "fallback_reply_1", Target: "send_fallback_1"},
			{ID: "edge_send_end", Source: "send_1", Target: "end_1"},
			{ID: "edge_send_fallback_end", Source: "send_fallback_1", Target: "end_1"},
		},
	}
}

func defaultAgentWorkflowName(agentName string) string {
	agentName = strings.TrimSpace(agentName)
	if agentName == "" {
		return "会话流程"
	}
	return agentName + " 会话流程"
}

func marshalDefinition(def dsl.Definition) (string, error) {
	buf, err := json.Marshal(def)
	if err != nil {
		return "", errorsx.InvalidParam("invalid workflow definition")
	}
	return string(buf), nil
}

func hashDefinition(definition string) string {
	sum := sha256.Sum256([]byte(definition))
	return hex.EncodeToString(sum[:])
}
