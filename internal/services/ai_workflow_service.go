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
			{ID: "start_1", Type: workflowregistry.NodeTypeStart, Name: "开始", Position: dsl.Position{X: 0, Y: 120}},
			{ID: "retrieve_1", Type: workflowregistry.NodeTypeKnowledgeRetrieve, Name: "知识检索", Position: dsl.Position{X: 260, Y: 120}, Inputs: map[string]dsl.VariableSelector{
				"query": {NodeID: "start_1", Field: "userMessage"},
			}},
			{ID: "reply_1", Type: workflowregistry.NodeTypeLLMReply, Name: "AI 回复", Position: dsl.Position{X: 520, Y: 120}, Inputs: map[string]dsl.VariableSelector{
				"userMessage":    {NodeID: "start_1", Field: "userMessage"},
				"knowledgeItems": {NodeID: "retrieve_1", Field: "items"},
			}},
			{ID: "send_1", Type: workflowregistry.NodeTypeSendReply, Name: "发送回复", Position: dsl.Position{X: 780, Y: 120}, Inputs: map[string]dsl.VariableSelector{
				"replyText": {NodeID: "reply_1", Field: "replyText"},
			}},
			{ID: "end_1", Type: workflowregistry.NodeTypeEnd, Name: "结束", Position: dsl.Position{X: 1040, Y: 120}},
		},
		Edges: []dsl.Edge{
			{ID: "edge_start_retrieve", Source: "start_1", Target: "retrieve_1"},
			{ID: "edge_retrieve_reply", Source: "retrieve_1", Target: "reply_1"},
			{ID: "edge_reply_send", Source: "reply_1", Target: "send_1"},
			{ID: "edge_send_end", Source: "send_1", Target: "end_1"},
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
