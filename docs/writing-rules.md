# Common writing rules

Use this local reference for all user-facing prose, including responses, progress updates, reports, feedback, and documentation. Read it once per context and apply it throughout the task. Routine writing requires no external lookup.

This is a practical summary of common ASD-STE100 Simplified Technical English rules, with project examples. It is not the complete standard or its approved dictionary. The [official specification](https://www.asd-ste100.org/assets/files/ASD-STE100_ISSUE9.pdf) is the source for full rules and vocabulary checks. Consult it only when the task requires a rule or approved word that this reference does not cover, or formal compliance.

## Sentences and paragraphs

- Use short, direct sentences with one topic each.
- Limit instructions to 20 words per sentence and descriptions to 25 words per sentence.
- Give one instruction per sentence. Start instructions with a command verb.
- Use active voice. Name the person or system that performs the action.
- Put a condition before its action: “If the test fails, record the error.”
- Use complete words instead of contractions. Keep articles and other words needed for clear meaning.
- Keep each paragraph on one topic, with no more than six sentences.
- Use a numbered list for steps. Use bullets for related facts.

## Words and terms

- Prefer simple, concrete words and direct verbs.
- Use the same term for the same thing. Use each term with one meaning.
- Explain an unfamiliar technical term or abbreviation on first use.
- Use precise technical names when needed. Preserve their spelling.
- Make each pronoun refer to a clear noun. Repeat the noun when necessary.

## Project rules

Lead with the result or the information the reader needs. Include only details that help the reader understand or act. Keep observed facts, reported symptoms, assumptions, and proposed actions distinct.

Preserve exact code, identifiers, commands, paths, quotations, and machine-readable fields. Apply these language rules to the prose around them. Keep required JSON envelopes valid, including their Markdown string values.

Follow the assigned report structure. The Diagnostician's opening issue summary is defined in its [role instructions](../.agents/skills/todai-diagnosing-bugs/SKILL.md).

For Markdown, citations, feedback, and handovers, follow [the output policy](../src/server/agent-output-policy.ts). For changes to output presentation, read [Agent output formatting](agent-output-formatting.md).

## Examples

| Instead of | Write |
| --- | --- |
| It appears that the operation was unsuccessful. | The save failed. |
| Perform an investigation of the timeout. | Investigate the timeout. |
| Restart the server and then run the test. | 1. Restart the server.<br>2. Run the test. |
| This causes it to fail. | The empty title causes the save to fail. |
| The cause is a stale cache. (Evidence is incomplete.) | A stale cache is a possible cause. Clear the cache to test this hypothesis. |

## Check before sending

Confirm that the opening states the main point. Remove repeated details. Split long sentences. Check technical terms and literal values. State uncertainty where it affects the next decision.
