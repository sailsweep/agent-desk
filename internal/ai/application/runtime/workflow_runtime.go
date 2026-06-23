package runtime

import (
	"encoding/json"
	"strings"

	"agent-desk/internal/ai/workflow/compiler"
	"agent-desk/internal/ai/workflow/dsl"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/errorsx"
	"agent-desk/internal/repositories"

	"github.com/mlogclub/simple/sqls"
)

func resolveAgentWorkflow(aiAgent models.AIAgent) (compiler.Result, error) {
	if aiAgent.WorkflowVersionID <= 0 {
		return compiler.Result{}, errorsx.InvalidParam("workflow version is required")
	}
	version := repositories.AIWorkflowVersionRepository.Get(sqls.DB(), aiAgent.WorkflowVersionID)
	if version == nil || version.Status != enums.StatusOk {
		return compiler.Result{}, errorsx.InvalidParam("workflow version does not exist")
	}
	var def dsl.Definition
	if err := json.Unmarshal([]byte(version.Definition), &def); err != nil {
		return compiler.Result{}, errorsx.InvalidParam("workflow definition is invalid")
	}
	return compiler.Compile(def), nil
}

func prepareWorkflowAgent(aiAgent models.AIAgent) (models.AIAgent, error) {
	result, err := resolveAgentWorkflow(aiAgent)
	if err != nil {
		return aiAgent, err
	}
	if strings.TrimSpace(result.Appendix) == "" {
		return aiAgent, nil
	}
	prompt := strings.TrimSpace(aiAgent.SystemPrompt)
	appendix := strings.TrimSpace(result.Appendix)
	if prompt == "" {
		aiAgent.SystemPrompt = appendix
		return aiAgent, nil
	}
	aiAgent.SystemPrompt = prompt + "\n\n" + appendix
	return aiAgent, nil
}
