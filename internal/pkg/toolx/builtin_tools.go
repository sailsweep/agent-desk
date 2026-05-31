package toolx

import (
	"strings"

	"agent-desk/internal/pkg/enums"
	"agent-desk/internal/pkg/i18nx"
)

type ToolSpec struct {
	Code          string
	ServerCode    string
	Name          string
	Title         string
	Description   string
	SourceType    enums.ToolSourceType
	AutoInjected  bool
	DirectAccess  bool
	RuntimeStatic bool
	Aliases       []string
	Appendix      string
}

type ToolMetadata struct {
	ToolCode   string
	ServerCode string
	ToolName   string
	SourceType enums.ToolSourceType
}

var (
	BuiltinToolSearch = ToolSpec{
		Code:         "builtin/tool_search",
		ServerCode:   "builtin",
		Name:         "tool_search",
		Title:        "搜索并调用动态工具",
		Description:  "用于搜索当前允许使用的 MCP 工具，并在确认目标 toolCode 后动态调用该工具。适合处理长尾工具，不应替代固定内置流程工具。",
		SourceType:   enums.ToolSourceTypeBuiltin,
		AutoInjected: true,
		DirectAccess: true,
		Appendix: strings.TrimSpace(`
当你需要使用长尾 MCP 能力时，优先使用 tool_search 工具，并遵守以下规则：
1. 先调用 tool_search 搜索需要的动态工具，再继续使用已选中的真实工具。
2. 不要假设所有长尾工具一开始就可见；只有被 tool_search 选中的工具，后续模型调用才会暴露出来。
3. 如果当前已有固定内置工具可以完成任务，优先使用固定工具，不要滥用 tool_search。
`),
	}
	BuiltinSkill = ToolSpec{
		Code:         "builtin/skill",
		ServerCode:   "builtin",
		Name:         "skill",
		Title:        "加载专项技能说明",
		Description:  "用于按需加载当前 Agent 可用的专项技能说明文档，适合在需要专项处理规则时再注入上下文。",
		SourceType:   enums.ToolSourceTypeBuiltin,
		AutoInjected: true,
	}
	GraphTriageServiceRequest = ToolSpec{
		Code:          "graph/triage_service_request",
		ServerCode:    "graph",
		Name:          "triage_service_request",
		Title:         "Triage service request",
		Description:   "Graph Tool. Analyzes the current conversation to decide whether to continue answering, prepare a ticket draft, or hand off to a human. It also prepares a ticket draft when ticket creation is recommended.",
		SourceType:    enums.ToolSourceTypeGraph,
		RuntimeStatic: true,
		Appendix: strings.TrimSpace(`
When you need to decide between continuing the answer, creating a ticket, or handing off to a human, call triage_service_request first and follow these rules:
1. The tool returns recommendedAction and includes ticketDraft when ticket creation is needed.
2. If recommendedAction=continue_answering, continue clarifying or answering instead of escalating directly.
3. If recommendedAction=prepare_ticket, use ticketDraft or collect missing fields before calling create_ticket_with_confirmation.
4. If recommendedAction=handoff_to_human, confirm the reason is sufficient before calling handoff_to_human.
5. When the escalation path is unclear, use this tool instead of making a complex routing decision from the main prompt alone.
`),
	}
	GraphAnalyzeConversation = ToolSpec{
		Code:          "graph/analyze_conversation",
		ServerCode:    "graph",
		Name:          "analyze_conversation",
		Title:         "Analyze conversation risk and summary",
		Description:   "Graph Tool. Summarizes the current conversation, identifies risk signals, and recommends whether to continue answering, create a ticket, or hand off to a human.",
		SourceType:    enums.ToolSourceTypeGraph,
		RuntimeStatic: true,
		Appendix: strings.TrimSpace(`
When the conversation may involve escalation, refunds, compensation, clear negative sentiment, ticket creation, or human handoff, call analyze_conversation first and follow these rules:
1. This tool returns a structured summary, risk signals, and next-step recommendation. It does not create tickets or hand off to a human.
2. If the tool recommends handoff_to_human, confirm the handoff conditions before calling handoff_to_human.
3. If the tool recommends prepare_ticket, call prepare_ticket_draft or collect more information before creating a ticket.
4. If the tool recommends continue_answering, continue clarifying and answering instead of escalating too early.
`),
	}
	GraphPrepareTicketDraft = ToolSpec{
		Code:          "graph/prepare_ticket_draft",
		ServerCode:    "graph",
		Name:          "prepare_ticket_draft",
		Title:         "Prepare ticket draft",
		Description:   "Graph Tool. Prepares a ticket draft from the current conversation and collected information, including a suggested title, description, missing fields, and follow-up questions.",
		SourceType:    enums.ToolSourceTypeGraph,
		RuntimeStatic: true,
		Appendix: strings.TrimSpace(`
When the user has asked to create a ticket, file a complaint, report an issue, or request after-sales handling, but the title or description is still unclear, call prepare_ticket_draft first and follow these rules:
1. This tool prepares a ticket draft and returns a suggested title, suggested description, missing fields, and follow-up questions.
2. If ready=false, ask follow-up questions based on missingFields and followUpQuestions instead of creating a ticket directly.
3. If ready=true, use the result to consider calling create_ticket_with_confirmation.
4. This tool only prepares a draft. It does not create a ticket.
`),
	}
	GraphCreateTicketConfirm = ToolSpec{
		Code:          "graph/create_ticket_with_confirmation",
		ServerCode:    "graph",
		Name:          "create_ticket_with_confirmation",
		Title:         "Create ticket confirmation flow",
		Description:   "Graph Tool. Handles ticket parameter preparation, user confirmation, actual ticket creation, and result return.",
		SourceType:    enums.ToolSourceTypeGraph,
		DirectAccess:  true,
		RuntimeStatic: true,
		Aliases:       []string{"builtin/create_ticket_with_confirmation"},
		Appendix: strings.TrimSpace(`
You can call create_ticket_with_confirmation after enough information has been collected, but follow these rules:
1. Only consider this tool when the user explicitly wants to submit a ticket, complaint, issue report, or after-sales request.
2. Before calling it, prepare a clear ticket title and issue description. If the information is still scattered, call prepare_ticket_draft or ask follow-up questions first.
3. Once you are ready to create a ticket, you must call create_ticket_with_confirmation. Do not simply claim in text that the ticket has been created.
4. This Graph Tool asks the user for confirmation first. The ticket is created only after the user confirms; if the user cancels, the flow ends.
5. If the user is only asking questions, complaining generally, or expressing dissatisfaction without explicitly requesting a ticket, continue clarifying instead of proactively creating one.
`),
	}
	GraphHandoffConversation = ToolSpec{
		Code:          "graph/handoff_to_human",
		ServerCode:    "graph",
		Name:          "handoff_to_human",
		Title:         "Human handoff confirmation flow",
		Description:   "Graph Tool. Handles handoff reason preparation, user confirmation, actual human handoff, and result return.",
		SourceType:    enums.ToolSourceTypeGraph,
		DirectAccess:  true,
		RuntimeStatic: true,
		Appendix: strings.TrimSpace(`
You can call handoff_to_human after confirming that human help is needed, but follow these rules:
1. Only call this tool when the user explicitly asks for a human agent or you have determined that the issue must be handled by a human.
2. Before calling it, summarize the handoff reason clearly. If the reason is vague, ask a follow-up question first.
3. Once you decide to hand off, you must call handoff_to_human. Do not simply say in text that you have connected the user to a human.
4. This Graph Tool asks the user for confirmation first. The handoff happens only after the user confirms; if the user cancels, the flow ends.
5. If the issue can still be solved in the current conversation, continue helping instead of escalating too early.
6. If the tool returns terminal=true and shouldRetry=false, the handoff flow has ended. Do not call it repeatedly.
`),
	}
	RegisteredToolSpecs = []ToolSpec{
		BuiltinToolSearch,
		BuiltinSkill,
		GraphTriageServiceRequest,
		GraphAnalyzeConversation,
		GraphPrepareTicketDraft,
		GraphCreateTicketConfirm,
		GraphHandoffConversation,
	}
)

var (
	toolSpecByCode       = buildToolSpecByCode()
	toolSpecByName       = buildToolSpecByName()
	toolAliasToCanonical = buildToolAliasToCanonical()
)

func buildToolSpecByCode() map[string]ToolSpec {
	ret := make(map[string]ToolSpec, len(RegisteredToolSpecs))
	for _, spec := range RegisteredToolSpecs {
		if strings.TrimSpace(spec.Code) == "" {
			continue
		}
		ret[spec.Code] = spec
	}
	return ret
}

func buildToolAliasToCanonical() map[string]string {
	ret := make(map[string]string)
	for _, spec := range RegisteredToolSpecs {
		for _, alias := range spec.Aliases {
			alias = strings.TrimSpace(alias)
			if alias == "" {
				continue
			}
			ret[alias] = spec.Code
		}
	}
	return ret
}

func buildToolSpecByName() map[string]ToolSpec {
	ret := make(map[string]ToolSpec, len(RegisteredToolSpecs))
	for _, spec := range RegisteredToolSpecs {
		name := strings.TrimSpace(spec.Name)
		if name == "" {
			continue
		}
		ret[name] = spec
	}
	return ret
}

func ListRegisteredToolSpecs() []ToolSpec {
	return append([]ToolSpec(nil), RegisteredToolSpecs...)
}

func GetRegisteredToolSpec(toolCode string) (ToolSpec, bool) {
	toolCode = NormalizeToolCodeAlias(strings.TrimSpace(toolCode))
	spec, ok := toolSpecByCode[toolCode]
	return spec, ok
}

func GetRegisteredToolSpecByName(name string) (ToolSpec, bool) {
	name = strings.TrimSpace(name)
	spec, ok := toolSpecByName[name]
	return spec, ok
}

func GetRegisteredToolTitle(toolCode string) string {
	spec, ok := GetRegisteredToolSpec(toolCode)
	if !ok {
		return ""
	}
	return spec.Title
}

func GetRegisteredToolTitleLocale(toolCode string, locale string) string {
	spec, ok := GetRegisteredToolSpec(toolCode)
	if !ok {
		return ""
	}
	if i18nx.NormalizeLocale(locale) != i18nx.LocaleEnUS {
		return spec.Title
	}
	if text := registeredToolEnglishTitle(spec.Code); text != "" {
		return text
	}
	return spec.Title
}

func GetRegisteredToolDescription(toolCode string) string {
	spec, ok := GetRegisteredToolSpec(toolCode)
	if !ok {
		return ""
	}
	return spec.Description
}

func GetRegisteredToolDescriptionLocale(toolCode string, locale string) string {
	spec, ok := GetRegisteredToolSpec(toolCode)
	if !ok {
		return ""
	}
	if i18nx.NormalizeLocale(locale) != i18nx.LocaleEnUS {
		return spec.Description
	}
	if text := registeredToolEnglishDescription(spec.Code); text != "" {
		return text
	}
	return spec.Description
}

func registeredToolEnglishTitle(toolCode string) string {
	switch toolCode {
	case BuiltinToolSearch.Code:
		return "Search and Run Dynamic Tools"
	case BuiltinSkill.Code:
		return "Load Skill Instructions"
	case GraphTriageServiceRequest.Code:
		return "Route Service Request"
	case GraphAnalyzeConversation.Code:
		return "Analyze Conversation Risk and Summary"
	case GraphPrepareTicketDraft.Code:
		return "Prepare Ticket Draft"
	case GraphCreateTicketConfirm.Code:
		return "Create Ticket With Confirmation"
	case GraphHandoffConversation.Code:
		return "Handoff to Human With Confirmation"
	default:
		return ""
	}
}

func registeredToolEnglishDescription(toolCode string) string {
	switch toolCode {
	case BuiltinToolSearch.Code:
		return "Searches the MCP tools currently available to the agent and runs the selected tool after its toolCode is confirmed. Best for long-tail tools; it should not replace fixed built-in workflow tools."
	case BuiltinSkill.Code:
		return "Loads specialized skill instructions for the current agent when extra task-specific guidance is needed."
	case GraphTriageServiceRequest.Code:
		return "Analyzes the current conversation to decide whether to keep answering, prepare a ticket draft, or hand off to a human, including a ticket draft when ticket creation is appropriate."
	case GraphAnalyzeConversation.Code:
		return "Summarizes the current conversation, identifies risk signals, and recommends whether to keep answering, create a ticket, or hand off to a human."
	case GraphPrepareTicketDraft.Code:
		return "Turns the current conversation and collected details into a ticket draft with a suggested title, description, missing fields, and follow-up questions."
	case GraphCreateTicketConfirm.Code:
		return "Guides ticket creation with parameter preparation, customer confirmation, actual ticket creation, and final result delivery."
	case GraphHandoffConversation.Code:
		return "Guides human handoff with reason preparation, customer confirmation, actual transfer, and final result delivery."
	default:
		return ""
	}
}

func GetRegisteredToolIdentity(toolCode string) (serverCode, toolName string, ok bool) {
	spec, ok := GetRegisteredToolSpec(toolCode)
	if !ok {
		return "", "", false
	}
	return spec.ServerCode, spec.Name, true
}

func ResolveToolSourceType(toolCode string) enums.ToolSourceType {
	if spec, ok := GetRegisteredToolSpec(toolCode); ok {
		return spec.SourceType
	}
	toolCode = strings.TrimSpace(toolCode)
	switch {
	case strings.HasPrefix(toolCode, "graph/"):
		return enums.ToolSourceTypeGraph
	case strings.HasPrefix(toolCode, "builtin/"):
		return enums.ToolSourceTypeBuiltin
	default:
		return enums.ToolSourceTypeMCP
	}
}

func IsAutoInjectedToolCode(toolCode string) bool {
	spec, ok := GetRegisteredToolSpec(toolCode)
	return ok && spec.AutoInjected
}

func ListAgentDirectToolSpecs() []ToolSpec {
	ret := make([]ToolSpec, 0, len(RegisteredToolSpecs))
	for _, spec := range RegisteredToolSpecs {
		if !spec.DirectAccess {
			continue
		}
		ret = append(ret, spec)
	}
	return ret
}

func ListRuntimeStaticToolSpecs() []ToolSpec {
	ret := make([]ToolSpec, 0, len(RegisteredToolSpecs))
	for _, spec := range RegisteredToolSpecs {
		if !spec.RuntimeStatic {
			continue
		}
		ret = append(ret, spec)
	}
	return ret
}

func IsAgentDirectToolCode(toolCode string) bool {
	toolCode = NormalizeToolCodeAlias(strings.TrimSpace(toolCode))
	spec, ok := GetRegisteredToolSpec(toolCode)
	return ok && spec.DirectAccess
}

func IsAgentDirectGraphToolCode(toolCode string) bool {
	toolCode = NormalizeToolCodeAlias(strings.TrimSpace(toolCode))
	spec, ok := GetRegisteredToolSpec(toolCode)
	return ok && spec.DirectAccess && spec.SourceType == enums.ToolSourceTypeGraph
}

func NormalizeToolCodeAlias(toolCode string) string {
	toolCode = strings.TrimSpace(toolCode)
	if canonical, ok := toolAliasToCanonical[toolCode]; ok {
		return canonical
	}
	return toolCode
}

func BuildToolAppendices(hasDynamicMCPTools bool, toolCodes map[string]string) []string {
	return BuildToolAppendicesForCodes(hasDynamicMCPTools, toolCodesFromMap(toolCodes))
}

func BuildToolAppendicesForCodes(hasDynamicMCPTools bool, toolCodes []string) []string {
	ret := make([]string, 0, len(toolCodes)+1)
	normalizedToolCodes := NormalizeToolCodes(toolCodes)
	if hasDynamicMCPTools && strings.TrimSpace(BuiltinToolSearch.Appendix) != "" {
		ret = append(ret, BuiltinToolSearch.Appendix)
	}
	for _, spec := range RegisteredToolSpecs {
		if strings.TrimSpace(spec.Appendix) == "" {
			continue
		}
		if spec.Code == BuiltinToolSearch.Code {
			continue
		}
		if containsNormalizedToolCode(normalizedToolCodes, spec.Code) {
			ret = append(ret, spec.Appendix)
		}
	}
	return ret
}

func BuildToolMetadata(toolCode string) (serverCode, toolName string, sourceType enums.ToolSourceType, ok bool) {
	spec, ok := GetRegisteredToolSpec(toolCode)
	if !ok {
		return "", "", ResolveToolSourceType(toolCode), false
	}
	return spec.ServerCode, spec.Name, spec.SourceType, true
}

func ResolveToolMetadata(toolCode string, fallbackName string) ToolMetadata {
	toolCode = NormalizeToolCodeAlias(strings.TrimSpace(toolCode))
	fallbackName = strings.TrimSpace(fallbackName)
	serverCode, toolName, sourceType, ok := BuildToolMetadata(toolCode)
	if !ok && toolName == "" {
		toolName = fallbackName
	}
	if toolName == "" {
		toolName = fallbackName
	}
	return ToolMetadata{
		ToolCode:   toolCode,
		ServerCode: strings.TrimSpace(serverCode),
		ToolName:   strings.TrimSpace(toolName),
		SourceType: sourceType,
	}
}

func IsAlwaysAllowedToolCode(toolCode string) bool {
	return NormalizeToolCodeAlias(strings.TrimSpace(toolCode)) == GraphHandoffConversation.Code
}

func IsImpliedAllowedToolCode(toolCode string, allowedToolCodes map[string]struct{}) bool {
	toolCode = NormalizeToolCodeAlias(strings.TrimSpace(toolCode))
	if toolCode == "" || len(allowedToolCodes) == 0 {
		return false
	}
	switch toolCode {
	case GraphTriageServiceRequest.Code, GraphAnalyzeConversation.Code:
		if _, ok := allowedToolCodes[GraphCreateTicketConfirm.Code]; ok {
			return true
		}
		if _, ok := allowedToolCodes[GraphHandoffConversation.Code]; ok {
			return true
		}
	case GraphPrepareTicketDraft.Code:
		_, ok := allowedToolCodes[GraphCreateTicketConfirm.Code]
		return ok
	}
	return false
}

func hasToolCode(toolCodes map[string]string, target string) bool {
	return containsNormalizedToolCode(toolCodesFromMap(toolCodes), target)
}

func containsNormalizedToolCode(toolCodes []string, target string) bool {
	target = strings.TrimSpace(target)
	if target == "" || len(toolCodes) == 0 {
		return false
	}
	for _, item := range NormalizeToolCodes(toolCodes) {
		if item == target {
			return true
		}
	}
	return false
}

func toolCodesFromMap(toolCodes map[string]string) []string {
	if len(toolCodes) == 0 {
		return nil
	}
	ret := make([]string, 0, len(toolCodes))
	for _, item := range toolCodes {
		ret = append(ret, item)
	}
	return ret
}

func NormalizeToolCodes(items []string) []string {
	if len(items) == 0 {
		return nil
	}
	ret := make([]string, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		item = NormalizeToolCodeAlias(strings.TrimSpace(item))
		if item == "" {
			continue
		}
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		ret = append(ret, item)
	}
	return ret
}

func IntersectToolCodes(left []string, right []string) []string {
	left = NormalizeToolCodes(left)
	right = NormalizeToolCodes(right)
	switch {
	case len(left) == 0:
		return right
	case len(right) == 0:
		return left
	}
	rightSet := make(map[string]struct{}, len(right))
	for _, item := range right {
		rightSet[item] = struct{}{}
	}
	ret := make([]string, 0, len(left))
	for _, item := range left {
		if _, ok := rightSet[item]; ok {
			ret = append(ret, item)
		}
	}
	return ret
}
