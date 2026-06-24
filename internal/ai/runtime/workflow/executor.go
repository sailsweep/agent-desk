package workflow

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"time"

	"agent-desk/internal/ai"
	"agent-desk/internal/ai/runtime/graphs"
	"agent-desk/internal/ai/runtime/internal/impl/retrievers"
	"agent-desk/internal/ai/workflow/dsl"
	workflowregistry "agent-desk/internal/ai/workflow/registry"
	"agent-desk/internal/models"
	"agent-desk/internal/pkg/dto"
	"agent-desk/internal/pkg/dto/request"
	"agent-desk/internal/pkg/utils"
	"agent-desk/internal/services"
)

const maxWorkflowSteps = 128

type Input struct {
	Definition   dsl.Definition
	Conversation models.Conversation
	UserMessage  models.Message
	AIAgent      models.AIAgent
	AIConfig     models.AIConfig
}

type Result struct {
	Status           string
	ReplyText        string
	NodePath         []string
	NodeTraces       []NodeTrace
	PromptTokens     int
	CompletionTokens int
	RetrieverCount   int
	TraceData        string
	CheckPointID     string
	CheckPointData   string
	Interrupted      bool
	Interrupts       []InterruptSummary
}

type NodeTrace struct {
	NodeID        string
	NodeType      string
	Status        string
	InputPreview  string
	OutputPreview string
	ErrorMessage  string
	DurationMS    int
}

type InterruptSummary struct {
	Type        string
	ID          string
	InfoPreview string
}

type Executor struct{}

func NewExecutor() *Executor {
	return &Executor{}
}

type runState struct {
	input     Input
	nodesByID map[string]dsl.Node
	outgoing  map[string][]dsl.Edge
	vars      map[string]map[string]any
	result    Result
}

type workflowCheckPoint struct {
	Definition    dsl.Definition            `json:"definition"`
	ConfirmNodeID string                    `json:"confirmNodeId"`
	Vars          map[string]map[string]any `json:"vars"`
}

func (e *Executor) Execute(ctx context.Context, input Input) (*Result, error) {
	state := newRunState(input)
	currentID := strings.TrimSpace(input.Definition.EntryNodeID)
	if currentID == "" {
		return nil, fmt.Errorf("workflow entry node is required")
	}
	return e.executeFrom(ctx, state, currentID)
}

func (e *Executor) Resume(ctx context.Context, input Input, checkPointData string, resumeText string) (*Result, error) {
	var checkpoint workflowCheckPoint
	if err := json.Unmarshal([]byte(strings.TrimSpace(checkPointData)), &checkpoint); err != nil {
		return nil, fmt.Errorf("invalid workflow checkpoint: %w", err)
	}
	if len(checkpoint.Definition.Nodes) > 0 {
		input.Definition = checkpoint.Definition
	}
	state := newRunState(input)
	state.vars = checkpoint.Vars
	if state.vars == nil {
		state.vars = make(map[string]map[string]any)
	}
	confirmNodeID := strings.TrimSpace(checkpoint.ConfirmNodeID)
	if confirmNodeID == "" {
		return nil, fmt.Errorf("workflow checkpoint confirm node is required")
	}
	decision := graphs.ParseConfirmationDecision(resumeText)
	if decision == "" {
		node, ok := state.nodesByID[confirmNodeID]
		if !ok {
			return nil, fmt.Errorf("workflow node does not exist: %s", confirmNodeID)
		}
		if err := e.executeHumanConfirm(state, node); err != nil {
			return nil, err
		}
		state.result.Status = "interrupted"
		return &state.result, nil
	}
	state.setNodeVars(confirmNodeID, map[string]any{
		"confirmed":    decision == graphs.ConfirmationDecisionConfirm,
		"responseText": strings.TrimSpace(resumeText),
	})
	nextID, ok, err := state.nextNodeID(confirmNodeID)
	if err != nil {
		return nil, err
	}
	if !ok {
		state.result.Status = "completed"
		return &state.result, nil
	}
	return e.executeFrom(ctx, state, nextID)
}

func (e *Executor) executeFrom(ctx context.Context, state *runState, currentID string) (*Result, error) {
	for step := 0; step < maxWorkflowSteps; step++ {
		node, ok := state.nodesByID[currentID]
		if !ok {
			err := fmt.Errorf("workflow node does not exist: %s", currentID)
			state.result.Status = "error"
			return &state.result, err
		}
		state.result.NodePath = append(state.result.NodePath, node.ID)
		trace := NodeTrace{
			NodeID:       node.ID,
			NodeType:     node.Type,
			Status:       "running",
			InputPreview: workflowPreviewJSON(state.nodeInputPreview(node)),
		}
		startedAt := time.Now()
		if err := e.executeNode(ctx, state, node); err != nil {
			trace.Status = "failed"
			trace.ErrorMessage = err.Error()
			trace.DurationMS = int(time.Since(startedAt).Milliseconds())
			state.result.NodeTraces = append(state.result.NodeTraces, trace)
			state.result.Status = "error"
			return &state.result, err
		}
		trace.OutputPreview = workflowPreviewJSON(state.vars[node.ID])
		trace.DurationMS = int(time.Since(startedAt).Milliseconds())
		if state.result.Interrupted {
			trace.Status = "interrupted"
			state.result.NodeTraces = append(state.result.NodeTraces, trace)
			state.result.Status = "interrupted"
			return &state.result, nil
		}
		trace.Status = "completed"
		state.result.NodeTraces = append(state.result.NodeTraces, trace)
		if node.Type == workflowregistry.NodeTypeEnd {
			state.result.Status = "completed"
			return &state.result, nil
		}
		nextID, ok, err := state.nextNodeID(node.ID)
		if err != nil {
			state.result.Status = "error"
			return &state.result, err
		}
		if !ok {
			state.result.Status = "completed"
			return &state.result, nil
		}
		currentID = nextID
	}
	err := fmt.Errorf("workflow exceeded max steps")
	state.result.Status = "error"
	return &state.result, err
}

func newRunState(input Input) *runState {
	state := &runState{
		input:     input,
		nodesByID: make(map[string]dsl.Node, len(input.Definition.Nodes)),
		outgoing:  make(map[string][]dsl.Edge),
		vars:      make(map[string]map[string]any),
		result: Result{
			Status:     "started",
			NodePath:   make([]string, 0),
			NodeTraces: make([]NodeTrace, 0),
		},
	}
	for _, node := range input.Definition.Nodes {
		node.ID = strings.TrimSpace(node.ID)
		node.Type = strings.TrimSpace(node.Type)
		if node.ID != "" {
			state.nodesByID[node.ID] = node
		}
	}
	for _, edge := range input.Definition.Edges {
		state.outgoing[edge.Source] = append(state.outgoing[edge.Source], edge)
	}
	return state
}

func (e *Executor) executeNode(ctx context.Context, state *runState, node dsl.Node) error {
	switch node.Type {
	case workflowregistry.NodeTypeStart:
		state.setNodeVars(node.ID, map[string]any{
			"conversationId":    state.input.Conversation.ID,
			"messageId":         state.input.UserMessage.ID,
			"aiAgentId":         state.input.AIAgent.ID,
			"userMessage":       strings.TrimSpace(state.input.UserMessage.Content),
			"knowledgeBaseIds":  utils.SplitInt64s(state.input.AIAgent.KnowledgeIDs),
			"conversationState": state.input.Conversation.Status,
		})
	case workflowregistry.NodeTypeKnowledgeRetrieve:
		return e.executeKnowledgeRetrieve(ctx, state, node)
	case workflowregistry.NodeTypeAnswerabilityGate:
		return e.executeAnswerabilityGate(state, node)
	case workflowregistry.NodeTypeCondition:
		state.setNodeVars(node.ID, map[string]any{"matched": true})
	case workflowregistry.NodeTypeAnalyzeConversation:
		return e.executeAnalyzeConversation(ctx, state, node)
	case workflowregistry.NodeTypePrepareTicketDraft:
		return e.executePrepareTicketDraft(ctx, state, node)
	case workflowregistry.NodeTypeHumanConfirm:
		return e.executeHumanConfirm(state, node)
	case workflowregistry.NodeTypeCreateTicket:
		return e.executeCreateTicket(state, node)
	case workflowregistry.NodeTypeLLMReply:
		return e.executeLLMReply(ctx, state, node)
	case workflowregistry.NodeTypeSendReply:
		replyText := strings.TrimSpace(toString(state.resolveInput(node, "replyText")))
		state.result.ReplyText = replyText
		state.setNodeVars(node.ID, map[string]any{
			"sent":           replyText != "",
			"replyMessageId": int64(0),
		})
	case workflowregistry.NodeTypeHandoffToHuman:
		return e.executeHandoffToHuman(state, node)
	case workflowregistry.NodeTypeEnd:
		state.setNodeVars(node.ID, map[string]any{"status": "completed"})
	default:
		return fmt.Errorf("unsupported workflow node type: %s", node.Type)
	}
	return nil
}

func (e *Executor) executeCreateTicket(state *runState, node dsl.Node) error {
	confirmed := truthy(state.resolveInput(node, "confirmed"))
	if !confirmed {
		state.setNodeVars(node.ID, map[string]any{
			"ticketId": int64(0),
			"created":  false,
		})
		return nil
	}
	draft := asMap(state.resolveInput(node, "ticketDraft"))
	title := strings.TrimSpace(toString(draft["title"]))
	description := strings.TrimSpace(toString(draft["description"]))
	item, err := services.TicketService.CreateFromConversation(request.CreateTicketFromConversationRequest{
		ConversationID: state.input.Conversation.ID,
		Title:          title,
		Description:    description,
	}, workflowAIPrincipal(state.input.AIAgent))
	if err != nil {
		return err
	}
	state.setNodeVars(node.ID, map[string]any{
		"ticketId": item.ID,
		"ticketNo": item.TicketNo,
		"created":  true,
	})
	return nil
}

func workflowAIPrincipal(aiAgent models.AIAgent) *dto.AuthPrincipal {
	username := strings.TrimSpace(aiAgent.Name)
	if username == "" {
		username = "AI"
	}
	return &dto.AuthPrincipal{
		UserID:   0,
		Username: username,
		Nickname: username,
	}
}

func (e *Executor) executeHumanConfirm(state *runState, node dsl.Node) error {
	prompt := strings.TrimSpace(toString(state.resolveInput(node, "prompt")))
	if prompt == "" {
		prompt = "请确认是否继续。"
	}
	infoPreview, err := json.Marshal(map[string]string{"message": prompt})
	if err != nil {
		return err
	}
	state.result.Interrupted = true
	state.result.CheckPointID = buildWorkflowCheckPointID(state.input, node.ID)
	checkpoint, err := json.Marshal(workflowCheckPoint{
		Definition:    state.input.Definition,
		ConfirmNodeID: node.ID,
		Vars:          state.vars,
	})
	if err != nil {
		return err
	}
	state.result.CheckPointData = string(checkpoint)
	state.result.Interrupts = []InterruptSummary{
		{
			Type:        workflowregistry.NodeTypeHumanConfirm,
			ID:          node.ID,
			InfoPreview: string(infoPreview),
		},
	}
	return nil
}

func buildWorkflowCheckPointID(input Input, nodeID string) string {
	return fmt.Sprintf("workflow:%d:%d:%s", input.Conversation.ID, input.UserMessage.ID, strings.TrimSpace(nodeID))
}

func (e *Executor) executePrepareTicketDraft(ctx context.Context, state *runState, node dsl.Node) error {
	issue := strings.TrimSpace(toString(state.resolveInput(node, "issue")))
	input := graphs.PrepareTicketDraftInput{
		Issue: issue,
	}
	if title := strings.TrimSpace(readStringConfig(node.Config, "title")); title != "" {
		input.Title = title
	}
	if description := strings.TrimSpace(readStringConfig(node.Config, "description")); description != "" {
		input.Description = description
	}
	if impact := strings.TrimSpace(readStringConfig(node.Config, "impact")); impact != "" {
		input.Impact = impact
	}
	if expectedOutcome := strings.TrimSpace(readStringConfig(node.Config, "expectedOutcome")); expectedOutcome != "" {
		input.ExpectedOutcome = expectedOutcome
	}
	if currentAttempt := strings.TrimSpace(readStringConfig(node.Config, "currentAttempt")); currentAttempt != "" {
		input.CurrentAttempt = currentAttempt
	}
	args, err := json.Marshal(input)
	if err != nil {
		return err
	}
	raw, err := graphs.NewPrepareTicketDraftGraph(state.input.Conversation).Run(ctx, string(args))
	if err != nil {
		return err
	}
	var result graphs.PrepareTicketDraftResult
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return err
	}
	state.setNodeVars(node.ID, map[string]any{
		"ticketDraft": map[string]any{
			"ready":             result.Ready,
			"title":             strings.TrimSpace(result.Title),
			"description":       strings.TrimSpace(result.Description),
			"missingFields":     result.MissingFields,
			"followUpQuestions": result.FollowUpQuestions,
			"conversationFacts": result.ConversationFacts,
		},
	})
	return nil
}

func (e *Executor) executeAnalyzeConversation(ctx context.Context, state *runState, node dsl.Node) error {
	userMessage := strings.TrimSpace(toString(state.resolveInput(node, "userMessage")))
	input := graphs.AnalyzeConversationInput{
		ObservedIssue: userMessage,
	}
	if strings.TrimSpace(readStringConfig(node.Config, "goal")) != "" {
		input.Goal = strings.TrimSpace(readStringConfig(node.Config, "goal"))
	}
	if readBoolConfig(node.Config, "needTicket") {
		input.NeedTicket = true
	}
	if readBoolConfig(node.Config, "needHumanHandoff") {
		input.NeedHumanHandoff = true
	}
	if readBoolConfig(node.Config, "needQualityCheck") {
		input.NeedQualityCheck = true
	}
	if strings.TrimSpace(readStringConfig(node.Config, "additionalContext")) != "" {
		input.AdditionalContext = strings.TrimSpace(readStringConfig(node.Config, "additionalContext"))
	}
	args, err := json.Marshal(input)
	if err != nil {
		return err
	}
	raw, err := graphs.NewAnalyzeConversationGraph(state.input.Conversation).Run(ctx, string(args))
	if err != nil {
		return err
	}
	var result graphs.AnalyzeConversationResult
	if err := json.Unmarshal([]byte(raw), &result); err != nil {
		return err
	}
	nextAction := strings.TrimSpace(result.RecommendedNextAction)
	state.setNodeVars(node.ID, map[string]any{
		"intent":           strings.TrimSpace(result.UserIntent),
		"riskLevel":        strings.TrimSpace(result.RiskLevel),
		"needTicket":       nextAction == "prepare_ticket",
		"needHumanHandoff": nextAction == "handoff_to_human",
	})
	return nil
}

func (e *Executor) executeHandoffToHuman(state *runState, node dsl.Node) error {
	if _, hasConfirmedInput := node.Inputs["confirmed"]; hasConfirmedInput && !truthy(state.resolveInput(node, "confirmed")) {
		state.setNodeVars(node.ID, map[string]any{
			"handoffId":  int64(0),
			"reason":     strings.TrimSpace(toString(state.resolveInput(node, "reason"))),
			"decision":   "cancelled",
			"teamId":     int64(0),
			"assigneeId": int64(0),
			"message":    "",
			"skipped":    true,
		})
		return nil
	}
	reason := strings.TrimSpace(toString(state.resolveInput(node, "reason")))
	result, err := services.ConversationHumanDispatchService.HandoffByAIWithRequestID(
		state.input.Conversation.ID,
		state.input.AIAgent,
		reason,
		strings.TrimSpace(state.input.UserMessage.RequestID),
	)
	if err != nil {
		return err
	}
	output := map[string]any{
		"handoffId":  int64(0),
		"reason":     reason,
		"decision":   "",
		"teamId":     int64(0),
		"assigneeId": int64(0),
		"message":    "",
	}
	if result != nil {
		output["decision"] = string(result.Decision)
		output["teamId"] = result.TeamID
		output["assigneeId"] = result.AssigneeID
		output["message"] = strings.TrimSpace(result.Message)
	}
	state.setNodeVars(node.ID, output)
	return nil
}

func (e *Executor) executeKnowledgeRetrieve(ctx context.Context, state *runState, node dsl.Node) error {
	query := strings.TrimSpace(toString(state.resolveInput(node, "query")))
	retriever := retrievers.NewKnowledgeRetriever(state.input.AIAgent)
	result, err := retriever.RetrieveContext(ctx, query)
	if err != nil {
		return err
	}
	items := make([]map[string]any, 0, len(result.ContextResults))
	for _, item := range result.ContextResults {
		items = append(items, map[string]any{
			"knowledgeBaseId": item.KnowledgeBaseID,
			"documentId":      item.DocumentID,
			"chunkId":         item.ChunkID,
			"content":         item.Content,
			"score":           item.Score,
		})
	}
	state.result.RetrieverCount = len(result.Hits)
	state.setNodeVars(node.ID, map[string]any{
		"items":   items,
		"summary": result.ContextText,
	})
	return nil
}

func (e *Executor) executeAnswerabilityGate(state *runState, node dsl.Node) error {
	items := state.resolveInput(node, "knowledgeItems")
	answerability := "unanswerable"
	reason := "no retrieved knowledge items"
	if hasItems(items) {
		answerability = "answerable"
		reason = "retrieved knowledge items are available"
	}
	state.setNodeVars(node.ID, map[string]any{
		"answerability": answerability,
		"reason":        reason,
	})
	return nil
}

func (e *Executor) executeLLMReply(ctx context.Context, state *runState, node dsl.Node) error {
	if staticReply := strings.TrimSpace(readStringConfig(node.Config, "staticReply")); staticReply != "" {
		state.setNodeVars(node.ID, map[string]any{"replyText": staticReply})
		return nil
	}
	userPrompt := strings.TrimSpace(toString(state.resolveInput(node, "userMessage")))
	if userPrompt == "" {
		userPrompt = strings.TrimSpace(state.input.UserMessage.Content)
	}
	knowledgeItems := toString(state.resolveInput(node, "knowledgeItems"))
	systemPrompt := strings.TrimSpace(state.input.AIAgent.SystemPrompt)
	if prompt := strings.TrimSpace(readStringConfig(node.Config, "prompt")); prompt != "" {
		systemPrompt = strings.TrimSpace(systemPrompt + "\n\n" + prompt)
	}
	if knowledgeItems != "" {
		userPrompt = userPrompt + "\n\nKnowledge context:\n" + knowledgeItems
	}
	result, err := ai.LLM.ChatWithConfig(ctx, state.input.AIConfig, systemPrompt, userPrompt)
	if err != nil {
		return err
	}
	state.result.PromptTokens += result.PromptTokens
	state.result.CompletionTokens += result.CompletionTokens
	state.setNodeVars(node.ID, map[string]any{"replyText": result.Content})
	return nil
}

func (s *runState) nextNodeID(sourceNodeID string) (string, bool, error) {
	edges := s.outgoing[sourceNodeID]
	if len(edges) == 0 {
		return "", false, nil
	}
	for _, edge := range edges {
		if edge.Condition == nil {
			continue
		}
		matched, err := s.evaluateCondition(edge.Condition)
		if err != nil {
			return "", false, err
		}
		if matched {
			return strings.TrimSpace(edge.Target), true, nil
		}
	}
	for _, edge := range edges {
		if edge.Condition == nil {
			return strings.TrimSpace(edge.Target), true, nil
		}
	}
	return "", false, nil
}

func (s *runState) evaluateCondition(condition *dsl.Condition) (bool, error) {
	if condition == nil {
		return true, nil
	}
	left := s.resolveSelector(condition.Left)
	operator := strings.TrimSpace(condition.Operator)
	if operator == "" && strings.TrimSpace(condition.Expression) != "" {
		return false, fmt.Errorf("free-form workflow condition expressions are not supported")
	}
	switch operator {
	case "eq", "equals":
		return compareString(left, condition.Right) == 0, nil
	case "neq", "not_equals":
		return compareString(left, condition.Right) != 0, nil
	case "contains":
		return strings.Contains(toString(left), toString(condition.Right)), nil
	case "exists":
		return exists(left), nil
	case "not_exists":
		return !exists(left), nil
	case "truthy", "is_true":
		return truthy(left), nil
	case "falsy", "is_false":
		return !truthy(left), nil
	case "gt":
		return compareNumber(left, condition.Right) > 0, nil
	case "gte":
		return compareNumber(left, condition.Right) >= 0, nil
	case "lt":
		return compareNumber(left, condition.Right) < 0, nil
	case "lte":
		return compareNumber(left, condition.Right) <= 0, nil
	default:
		return false, fmt.Errorf("unsupported workflow condition operator: %s", operator)
	}
}

func (s *runState) setNodeVars(nodeID string, values map[string]any) {
	s.vars[nodeID] = values
}

func (s *runState) resolveInput(node dsl.Node, inputName string) any {
	selector, ok := node.Inputs[inputName]
	if !ok {
		return nil
	}
	return s.resolveSelector(&selector)
}

func (s *runState) nodeInputPreview(node dsl.Node) map[string]any {
	inputs := make(map[string]any, len(node.Inputs))
	for name, selector := range node.Inputs {
		inputs[name] = s.resolveSelector(&selector)
	}
	ret := map[string]any{
		"inputs": inputs,
	}
	if len(node.Config) > 0 {
		var cfg any
		if err := json.Unmarshal(node.Config, &cfg); err == nil {
			ret["config"] = cfg
		} else {
			ret["config"] = string(node.Config)
		}
	}
	return ret
}

func workflowPreviewJSON(value any) string {
	raw, err := json.Marshal(value)
	if err != nil {
		return ""
	}
	const maxPreviewBytes = 2000
	if len(raw) <= maxPreviewBytes {
		return string(raw)
	}
	return string(raw[:maxPreviewBytes])
}

func (s *runState) resolveSelector(selector *dsl.VariableSelector) any {
	if selector == nil {
		return nil
	}
	fields := s.vars[strings.TrimSpace(selector.NodeID)]
	if fields == nil {
		return nil
	}
	return fields[strings.TrimSpace(selector.Field)]
}

func readStringConfig(raw json.RawMessage, key string) string {
	if len(raw) == 0 {
		return ""
	}
	var cfg map[string]any
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return ""
	}
	return toString(cfg[key])
}

func readBoolConfig(raw json.RawMessage, key string) bool {
	if len(raw) == 0 {
		return false
	}
	var cfg map[string]any
	if err := json.Unmarshal(raw, &cfg); err != nil {
		return false
	}
	return truthy(cfg[key])
}

func compareString(left any, right any) int {
	return strings.Compare(toString(left), toString(right))
}

func compareNumber(left any, right any) int {
	leftNum := toFloat(left)
	rightNum := toFloat(right)
	switch {
	case leftNum > rightNum:
		return 1
	case leftNum < rightNum:
		return -1
	default:
		return 0
	}
}

func toString(value any) string {
	switch v := value.(type) {
	case nil:
		return ""
	case string:
		return v
	case fmt.Stringer:
		return v.String()
	case []map[string]any:
		buf, _ := json.Marshal(v)
		return string(buf)
	default:
		return strings.TrimSpace(fmt.Sprint(v))
	}
}

func toFloat(value any) float64 {
	switch v := value.(type) {
	case int:
		return float64(v)
	case int64:
		return float64(v)
	case float64:
		return v
	case float32:
		return float64(v)
	case json.Number:
		f, _ := v.Float64()
		return f
	case string:
		f, _ := strconv.ParseFloat(strings.TrimSpace(v), 64)
		return f
	default:
		return 0
	}
}

func asMap(value any) map[string]any {
	switch v := value.(type) {
	case map[string]any:
		return v
	case map[string]string:
		ret := make(map[string]any, len(v))
		for key, item := range v {
			ret[key] = item
		}
		return ret
	case string:
		var ret map[string]any
		if err := json.Unmarshal([]byte(strings.TrimSpace(v)), &ret); err == nil {
			return ret
		}
	}
	return map[string]any{}
}

func truthy(value any) bool {
	switch v := value.(type) {
	case nil:
		return false
	case bool:
		return v
	case string:
		normalized := strings.ToLower(strings.TrimSpace(v))
		return normalized != "" && normalized != "false" && normalized != "0"
	default:
		return !reflect.ValueOf(value).IsZero()
	}
}

func exists(value any) bool {
	if value == nil {
		return false
	}
	switch v := value.(type) {
	case string:
		return strings.TrimSpace(v) != ""
	default:
		return true
	}
}

func hasItems(value any) bool {
	if value == nil {
		return false
	}
	rv := reflect.ValueOf(value)
	switch rv.Kind() {
	case reflect.Array, reflect.Slice, reflect.Map:
		return rv.Len() > 0
	default:
		return exists(value)
	}
}
