package dsl

import "encoding/json"

type Definition struct {
	SchemaVersion int    `json:"schemaVersion"`
	EntryNodeID   string `json:"entryNodeId"`
	Nodes         []Node `json:"nodes"`
	Edges         []Edge `json:"edges"`
}

type Node struct {
	ID       string          `json:"id"`
	Type     string          `json:"type"`
	Name     string          `json:"name"`
	Position Position        `json:"position"`
	Config   json.RawMessage `json:"config"`
}

type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type Edge struct {
	ID        string     `json:"id"`
	Source    string     `json:"source"`
	Target    string     `json:"target"`
	Condition *Condition `json:"condition,omitempty"`
}

type Condition struct {
	Expression string `json:"expression"`
}
