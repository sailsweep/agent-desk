package kb

import (
	"agent-desk/cmd/testdata/seedlang"
	"regexp"
	"testing"
)

var hanTextPattern = regexp.MustCompile(`\p{Han}`)

func TestEnglishKnowledgeBaseTextDoesNotContainChineseText(t *testing.T) {
	name, description, remark := faqKnowledgeBaseText(seedlang.English)
	for _, value := range []string{name, description, remark} {
		if hanTextPattern.MatchString(value) {
			t.Fatalf("english knowledge base text contains Chinese text: %q", value)
		}
	}
}

func TestEnglishKnowledgeFAQSeedsDoNotContainChineseText(t *testing.T) {
	seeds := knowledgeFAQSeeds(seedlang.English)
	if len(seeds) == 0 {
		t.Fatal("english FAQ seeds are empty")
	}
	for _, seed := range seeds {
		values := []string{seed.Question, seed.Answer, seed.Remark}
		values = append(values, seed.SimilarQuestions...)
		for _, value := range values {
			if hanTextPattern.MatchString(value) {
				t.Fatalf("english FAQ seed contains Chinese text: %q", value)
			}
		}
	}
}
