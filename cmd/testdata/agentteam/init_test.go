package agentteam

import (
	"agent-desk/cmd/testdata/seedlang"
	"regexp"
	"testing"
)

var hanTextPattern = regexp.MustCompile(`\p{Han}`)

func TestEnglishAgentTeamTextDoesNotContainChineseText(t *testing.T) {
	values := []string{localizedTeamName(seedlang.English)}
	for _, user := range localizedAgentUsers(seedlang.English, "admin") {
		values = append(values, user.nickname)
	}

	for _, value := range values {
		if hanTextPattern.MatchString(value) {
			t.Fatalf("english agent team seed contains Chinese text: %q", value)
		}
	}
}
