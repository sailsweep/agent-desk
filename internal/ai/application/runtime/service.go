package runtime

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"agent-desk/internal/ai/runtime/executor"
	workflowexecutor "agent-desk/internal/ai/runtime/workflow"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/utils"
	"agent-desk/internal/repositories"

	"github.com/mlogclub/simple/sqls"
)

type Service struct {
	runtime *executor.Service
	catalog *toolCatalog
	prepare *prepareService
}

func NewService() *Service {
	catalog := newToolCatalog()
	return &Service{
		runtime: executor.NewService(),
		catalog: catalog,
		prepare: newPrepareService(catalog),
	}
}

func (s *Service) Run(ctx context.Context, req Request) (*Summary, error) {
	req.UserMessage.Content = utils.BuildRuntimeMessageText(req.UserMessage.MessageType, req.UserMessage.Content)
	aiAgent, workflow, err := prepareWorkflowAgent(req.AIAgent)
	if err != nil {
		return nil, err
	}
	req.AIAgent = aiAgent
	workflowResult, err := workflowexecutor.NewExecutor().Execute(ctx, workflowexecutor.Input{
		Definition:   workflow.Definition,
		Conversation: req.Conversation,
		UserMessage:  req.UserMessage,
		AIAgent:      req.AIAgent,
		AIConfig:     req.AIConfig,
	})
	if err != nil {
		return nil, err
	}
	if err := writeWorkflowRun(req, workflow, workflowResult, ""); err != nil {
		return nil, err
	}
	return toWorkflowSummary(workflowResult, req.AIConfig.ModelName), nil
}

func (s *Service) Resume(ctx context.Context, req ResumeRequest) (*Summary, error) {
	aiAgent, workflow, err := prepareWorkflowAgent(req.AIAgent)
	if err != nil {
		return nil, err
	}
	req.AIAgent = aiAgent
	if interrupt := repositories.ConversationInterruptRepository.GetByCheckPointID(sqls.DB(), req.CheckPointID); interrupt != nil && strings.TrimSpace(interrupt.RequestData) != "" {
		workflowResult, err := workflowexecutor.NewExecutor().Resume(ctx, workflowexecutor.Input{
			Definition:   workflow.Definition,
			Conversation: req.Conversation,
			AIAgent:      req.AIAgent,
			AIConfig:     req.AIConfig,
		}, interrupt.RequestData, firstWorkflowResumeText(req.ResumeData))
		if err != nil {
			return nil, err
		}
		return toWorkflowSummary(workflowResult, req.AIConfig.ModelName), nil
	}
	toolSet, err := s.prepare.prepareToolsForResume(req)
	if err != nil {
		return nil, err
	}
	req.ToolSet = toolSet
	summary, err := s.runtime.ExecuteResume(ctx, executor.ResumeInput{
		Conversation: req.Conversation,
		AIAgent:      req.AIAgent,
		AIConfig:     req.AIConfig,
		CheckPointID: req.CheckPointID,
		ResumeData:   req.ResumeData,
		ToolSet:      req.ToolSet,
	})
	if err != nil {
		return toSummary(summary), err
	}
	return toSummary(summary), nil
}

func firstWorkflowResumeText(data map[string]string) string {
	for _, value := range data {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func toWorkflowSummary(result *workflowexecutor.Result, modelName string) *Summary {
	if result == nil {
		return nil
	}
	trace := map[string]any{
		"status":   result.Status,
		"nodePath": result.NodePath,
	}
	traceData, _ := json.Marshal(trace)
	return &Summary{
		Status:           result.Status,
		ReplyText:        result.ReplyText,
		ModelName:        modelName,
		PromptTokens:     result.PromptTokens,
		CompletionTokens: result.CompletionTokens,
		RetrieverCount:   result.RetrieverCount,
		TraceData:        string(traceData),
		CheckPointID:     result.CheckPointID,
		CheckPointData:   result.CheckPointData,
		Interrupted:      result.Interrupted,
		Interrupts:       toWorkflowInterruptSummaries(result.Interrupts),
	}
}

func toWorkflowInterruptSummaries(items []workflowexecutor.InterruptSummary) []InterruptContextSummary {
	if len(items) == 0 {
		return nil
	}
	ret := make([]InterruptContextSummary, 0, len(items))
	for _, item := range items {
		ret = append(ret, InterruptContextSummary{
			Type:        item.Type,
			ID:          item.ID,
			InfoPreview: item.InfoPreview,
		})
	}
	return ret
}

func writeWorkflowRun(req Request, workflow resolvedWorkflow, result *workflowexecutor.Result, errorMessage string) error {
	if result == nil {
		return nil
	}
	now := time.Now()
	endedAt := now
	nodeTypes := make(map[string]string, len(workflow.Definition.Nodes))
	for _, node := range workflow.Definition.Nodes {
		nodeTypes[node.ID] = node.Type
	}
	return sqls.WithTransaction(func(ctx *sqls.TxContext) error {
		run := &models.AIWorkflowRun{
			WorkflowID:        workflow.WorkflowID,
			WorkflowVersionID: workflow.VersionID,
			ConversationID:    req.Conversation.ID,
			AIAgentID:         req.AIAgent.ID,
			MessageID:         req.UserMessage.ID,
			Status:            1,
			StartedAt:         now,
			EndedAt:           &endedAt,
			ErrorMessage:      errorMessage,
		}
		if err := repositories.AIWorkflowRunRepository.Create(ctx.Tx, run); err != nil {
			return err
		}
		for _, nodeID := range result.NodePath {
			nodeRun := &models.AIWorkflowNodeRun{
				WorkflowRunID: run.ID,
				NodeID:        nodeID,
				NodeType:      nodeTypes[nodeID],
				Status:        1,
				StartedAt:     now,
				EndedAt:       &endedAt,
			}
			if err := repositories.AIWorkflowNodeRunRepository.Create(ctx.Tx, nodeRun); err != nil {
				return err
			}
		}
		return nil
	})
}
