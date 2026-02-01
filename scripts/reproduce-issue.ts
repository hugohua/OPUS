
import { buildSimpleDrill } from '../lib/templates/deterministic-drill';

const mockVocab = {
    id: 380,
    word: "attorney",
    definition_cn: "律师",
    commonExample: "The prosecuting attorney began with a short opening statement.",
    collocations: [
        {
            "text": "a defense attorney",
            "trans": "被告側弁護士.",
            "source": "abceed",
            "weight": 100
        },
        {
            "text": "a power of attorney",
            "trans": "委任権.",
            "source": "abceed",
            "weight": 100
        }
    ]
};

console.log("Testing buildSimpleDrill with mock vocab...");
const result = buildSimpleDrill(mockVocab as any, "PHRASE");

console.log(JSON.stringify(result, null, 2));

const segment = result.segments[0];
if (segment.content_markdown === "a defense attorney") {
    console.log("SUCCESS: Selected collocation.");
} else if (segment.content_markdown === mockVocab.commonExample) {
    console.log("FAILURE: Selected commonExample.");
} else {
    console.log("UNKNOWN: " + segment.content_markdown);
}
