package channel

import (
	"agent-desk/cmd/testdata/seedlang"
	"regexp"
	"testing"
)

var hanTextPattern = regexp.MustCompile(`\p{Han}`)

func TestEnglishChannelSeedDoesNotContainChineseText(t *testing.T) {
	for _, item := range buildSeedItems(seedlang.English, 1) {
		values := []string{item.Name, item.ConfigJSON, item.Remark}
		for _, value := range values {
			if hanTextPattern.MatchString(value) {
				t.Fatalf("english channel seed contains Chinese text: %q", value)
			}
		}
	}
}
