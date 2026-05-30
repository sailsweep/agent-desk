package factory

import (
	"strings"

	runtimeinstruction "cs-ai-agent/internal/ai/runtime/instruction"
	einocallbacks "cs-ai-agent/internal/ai/runtime/internal/impl/callbacks"
	"cs-ai-agent/internal/ai/runtime/registry"
	runtimetooling "cs-ai-agent/internal/ai/runtime/tooling"
	"cs-ai-agent/internal/pkg/enums"
	"cs-ai-agent/internal/pkg/toolx"
)

func buildInstructionTraceSummary(summary runtimeinstruction.AssemblySummary) einocallbacks.InstructionTraceSummary {
	return einocallbacks.InstructionTraceSummary{
		SectionTitles: append([]string(nil), summary.SectionTitles...),
		HasAgentRule:  summary.HasAgentRule,
		HasSkillRule:  summary.HasSkillRule,
		HasToolRule:   summary.HasToolRule,
	}
}

func buildRuntimeTraceToolMetadata(
	dynamicToolDefinitions []runtimetooling.MCPToolDefinition,
	staticToolMetadata map[string]registry.ToolMetadata,
	includeSkillTool bool,
) map[string]einocallbacks.ToolMetadata {
	ret := make(map[string]einocallbacks.ToolMetadata, len(dynamicToolDefinitions)+len(staticToolMetadata)+1)
	for _, item := range dynamicToolDefinitions {
		modelName := strings.TrimSpace(item.ModelName)
		if modelName == "" {
			continue
		}
		ret[modelName] = einocallbacks.ToolMetadata{
			ToolCode:   strings.TrimSpace(item.ToolCode),
			ServerCode: strings.TrimSpace(item.ServerCode),
			ToolName:   strings.TrimSpace(item.ToolName),
			SourceType: enums.ToolSourceTypeMCP,
		}
	}
	for modelName, metadata := range staticToolMetadata {
		modelName = strings.TrimSpace(modelName)
		metadata.ToolCode = strings.TrimSpace(metadata.ToolCode)
		metadata.ServerCode = strings.TrimSpace(metadata.ServerCode)
		metadata.ToolName = strings.TrimSpace(metadata.ToolName)
		if modelName == "" || metadata.ToolCode == "" {
			continue
		}
		ret[modelName] = einocallbacks.ToolMetadata{
			ToolCode:   metadata.ToolCode,
			ServerCode: metadata.ServerCode,
			ToolName:   metadata.ToolName,
			SourceType: metadata.SourceType,
		}
	}
	if includeSkillTool {
		resolved := toolx.ResolveToolMetadata(toolx.BuiltinSkill.Code, toolx.BuiltinSkill.Name)
		ret[toolx.BuiltinSkill.Name] = einocallbacks.ToolMetadata{
			ToolCode:   resolved.ToolCode,
			ServerCode: resolved.ServerCode,
			ToolName:   resolved.ToolName,
			SourceType: resolved.SourceType,
		}
	}
	return ret
}
