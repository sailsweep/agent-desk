package tag

import (
	"agent-desk/cmd/testdata/seedlang"
	"regexp"
	"testing"
)

var hanTextPattern = regexp.MustCompile(`\p{Han}`)

func TestEnglishTagSeedsDoNotContainChineseText(t *testing.T) {
	for _, item := range seedItems(seedlang.English) {
		if hanTextPattern.MatchString(item.name) {
			t.Fatalf("english tag seed contains Chinese text: %q", item.name)
		}
	}
}
