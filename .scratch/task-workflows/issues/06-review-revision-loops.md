# 06: Run an implement–review–revise loop

**What to build:** Add a bounded review section to the visual workflow editor so a reviewer and revision agent can iterate automatically, then continue on approval or request human intervention.

**Blocked by:** 05: Add human checkpoints and actionable feedback

**Status:** complete

- [x] A review section specifies reviewer and revision agent steps, their instructions, and a positive review-round limit; default to three rounds. The editor makes the repeated section and exit visible.
- [x] Reviewer output has validated explicit approved or changes-requested outcomes with findings. Successful process execution alone is never treated as approval; malformed output pauses for recovery.
- [x] Approval exits the section. Changes requested supplies the findings to the revision agent and then reruns review; each reviewer attempt counts as one round.
- [x] Persist section position, round number, review outcome, findings, and links to reviewed attempts and nominated artifact revisions.
- [x] At the limit, pause for human intervention before another revision run. Offer an explicit additional round or stop; approval never occurs automatically at the limit.
- [x] The Workflow tab and task summary show the current step and round; stopping, failure, feedback, and restart recovery preserve the loop position.
- [x] Tests exercise immediate approval, multiple revision rounds, exhausted limits, invalid outcomes, failure, cancellation, restart, and duplicate results. Storybook demonstrates the loop and intervention state.


Verification: 199 server integration tests passed; typecheck and Storybook build passed. Lint passed with one existing character-counter demo warning. Standards and spec reviews have no remaining findings. Browser interaction and visual verification remain pending: browser access host unavailable and native Chrome screen capture failed.
