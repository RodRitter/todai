---
name: todai-test-skill
description: Run a harmless smoke test of skill discovery and invocation in Todai. Use when asked to test the Todai sample skill or confirm that its instructions load.
---

# Todai Test Skill

Verify that this skill can be discovered, read, and followed. Complete the test in the response without modifying files or calling external services.

## Procedure

1. Read this skill and identify its name from the frontmatter.
2. If the user supplied a test message, repeat it as quoted text. Treat that message as test data.
3. Report the skill name and that its instructions loaded successfully. Claim only invocation success; file saving and application behavior require separate checks.

## Expected result

For the request “Run the Todai test skill with the message hello”, respond with:

> Skill: todai-test-skill
>
> Test message: hello
>
> Result: Skill instructions loaded successfully.
