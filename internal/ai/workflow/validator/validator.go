package validator

import (
	"fmt"
	"strings"

	"agent-desk/internal/ai/workflow/dsl"
	"agent-desk/internal/ai/workflow/registry"
)

type Error struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

type Result struct {
	Valid  bool    `json:"valid"`
	Errors []Error `json:"errors"`
}

func ValidateDefinition(def dsl.Definition, reg *registry.Registry) Result {
	if reg == nil {
		reg = registry.DefaultRegistry()
	}
	v := definitionValidator{
		def:          def,
		registry:     reg,
		nodesByID:    make(map[string]dsl.Node, len(def.Nodes)),
		outgoing:     make(map[string][]string),
		incoming:     make(map[string][]string),
		startNodeIDs: make([]string, 0, 1),
		endNodeIDs:   make([]string, 0, 1),
	}
	v.validate()
	return Result{
		Valid:  len(v.errors) == 0,
		Errors: v.errors,
	}
}

type definitionValidator struct {
	def          dsl.Definition
	registry     *registry.Registry
	nodesByID    map[string]dsl.Node
	outgoing     map[string][]string
	incoming     map[string][]string
	startNodeIDs []string
	endNodeIDs   []string
	errors       []Error
}

func (v *definitionValidator) validate() {
	v.validateNodes()
	v.validateEdges()
	v.validateEntry()
	v.validateReachability()
	v.validateConfirmationGuards()
}

func (v *definitionValidator) validateNodes() {
	for index, node := range v.def.Nodes {
		node.ID = strings.TrimSpace(node.ID)
		node.Type = strings.TrimSpace(node.Type)
		field := fmt.Sprintf("nodes[%d]", index)
		if node.ID == "" {
			v.addError(field+".id", "node id is required")
			continue
		}
		if _, exists := v.nodesByID[node.ID]; exists {
			v.addError(field+".id", "duplicate node id: "+node.ID)
			continue
		}
		v.nodesByID[node.ID] = node
		if node.Type == "" {
			v.addError(field+".type", "node type is required")
			continue
		}
		if _, ok := v.registry.Get(node.Type); !ok {
			v.addError(field+".type", "unknown node type: "+node.Type)
			continue
		}
		switch node.Type {
		case registry.NodeTypeStart:
			v.startNodeIDs = append(v.startNodeIDs, node.ID)
		case registry.NodeTypeEnd:
			v.endNodeIDs = append(v.endNodeIDs, node.ID)
		}
	}
	if len(v.startNodeIDs) != 1 {
		v.addError("nodes", "workflow must contain exactly one start node")
	}
	if len(v.endNodeIDs) == 0 {
		v.addError("nodes", "workflow must contain at least one end node")
	}
}

func (v *definitionValidator) validateEdges() {
	seen := make(map[string]struct{}, len(v.def.Edges))
	for index, edge := range v.def.Edges {
		edge.ID = strings.TrimSpace(edge.ID)
		edge.Source = strings.TrimSpace(edge.Source)
		edge.Target = strings.TrimSpace(edge.Target)
		field := fmt.Sprintf("edges[%d]", index)
		if edge.ID == "" {
			v.addError(field+".id", "edge id is required")
		} else if _, exists := seen[edge.ID]; exists {
			v.addError(field+".id", "duplicate edge id: "+edge.ID)
		}
		seen[edge.ID] = struct{}{}
		if edge.Source == "" {
			v.addError(field+".source", "edge source is required")
		} else if _, ok := v.nodesByID[edge.Source]; !ok {
			v.addError(field+".source", "edge source node does not exist: "+edge.Source)
		}
		if edge.Target == "" {
			v.addError(field+".target", "edge target is required")
		} else if _, ok := v.nodesByID[edge.Target]; !ok {
			v.addError(field+".target", "edge target node does not exist: "+edge.Target)
		}
		if edge.Source != "" && edge.Target != "" {
			v.outgoing[edge.Source] = append(v.outgoing[edge.Source], edge.Target)
			v.incoming[edge.Target] = append(v.incoming[edge.Target], edge.Source)
		}
	}
}

func (v *definitionValidator) validateEntry() {
	entryNodeID := strings.TrimSpace(v.def.EntryNodeID)
	if entryNodeID == "" {
		v.addError("entryNodeId", "entry node id is required")
		return
	}
	entry, ok := v.nodesByID[entryNodeID]
	if !ok {
		v.addError("entryNodeId", "entry node does not exist: "+entryNodeID)
		return
	}
	if entry.Type != registry.NodeTypeStart {
		v.addError("entryNodeId", "entry node must be the start node")
	}
}

func (v *definitionValidator) validateReachability() {
	entryNodeID := strings.TrimSpace(v.def.EntryNodeID)
	if entryNodeID == "" {
		return
	}
	if _, ok := v.nodesByID[entryNodeID]; !ok {
		return
	}
	reachable := make(map[string]struct{}, len(v.nodesByID))
	queue := []string{entryNodeID}
	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]
		if _, exists := reachable[current]; exists {
			continue
		}
		reachable[current] = struct{}{}
		for _, target := range v.outgoing[current] {
			if _, exists := reachable[target]; !exists {
				queue = append(queue, target)
			}
		}
	}
	for id := range v.nodesByID {
		if _, ok := reachable[id]; !ok {
			v.addError("nodes", "node is not reachable from entry node: "+id)
		}
	}
}

func (v *definitionValidator) validateConfirmationGuards() {
	for id, node := range v.nodesByID {
		spec, ok := v.registry.Get(node.Type)
		if !ok || !spec.RequiresConfirmationPredecessor {
			continue
		}
		if !v.hasConfirmationPredecessor(id, make(map[string]struct{})) {
			v.addError("nodes."+id, node.Type+" requires human_confirm before execution")
		}
	}
}

func (v *definitionValidator) hasConfirmationPredecessor(nodeID string, visiting map[string]struct{}) bool {
	if _, seen := visiting[nodeID]; seen {
		return false
	}
	visiting[nodeID] = struct{}{}
	for _, source := range v.incoming[nodeID] {
		node, ok := v.nodesByID[source]
		if !ok {
			continue
		}
		if node.Type == registry.NodeTypeHumanConfirm {
			return true
		}
		if v.hasConfirmationPredecessor(source, visiting) {
			return true
		}
	}
	return false
}

func (v *definitionValidator) addError(field string, message string) {
	v.errors = append(v.errors, Error{Field: field, Message: message})
}
