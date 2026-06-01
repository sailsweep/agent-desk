package quickreply

import (
	"agent-desk/cmd/testdata/seedlang"
	"regexp"
	"testing"
)

var hanTextPattern = regexp.MustCompile(`\p{Han}`)

func TestEnglishSeedItemsMatchChineseCount(t *testing.T) {
	englishItems := seedItems(seedlang.English)
	chineseItems := seedItems(seedlang.Chinese)

	if len(englishItems) != len(chineseItems) {
		t.Fatalf("english seed count = %d, want %d", len(englishItems), len(chineseItems))
	}
}

func TestEnglishSeedItemsDoNotContainChineseText(t *testing.T) {
	for _, item := range seedItems(seedlang.English) {
		for _, value := range []string{item.groupName, item.title, item.content} {
			if hanTextPattern.MatchString(value) {
				t.Fatalf("english quick reply %d contains Chinese text: %q", item.id, value)
			}
		}
	}
}
