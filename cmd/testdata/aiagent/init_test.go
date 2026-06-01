package aiagent

import (
	"agent-desk/cmd/testdata/seedlang"
	"regexp"
	"testing"
)

var hanTextPattern = regexp.MustCompile(`\p{Han}`)

func TestEnglishAIAgentSeedDoesNotContainChineseText(t *testing.T) {
	for _, item := range buildSeedItems(seedlang.English, 1, []int64{2}, "3", "4") {
		values := []string{item.Name, item.Description, item.SystemPrompt, item.WelcomeMessage, item.FallbackMessage}
		for _, value := range values {
			if hanTextPattern.MatchString(value) {
				t.Fatalf("english AI agent seed contains Chinese text: %q", value)
			}
		}
	}
}
