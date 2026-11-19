# 09: Provide starter workflows and workspace defaults

**What to build:** Make ordinary task creation require minimal workflow knowledge through starter templates and a workspace default, using the same editor and execution model as custom workflows.

**Blocked by:** 08: Replace column automation with workflow-based execution

**Status:** complete

- [x] Offer Single agent, Implement and review, and Plan–implement–review templates; creating from a template produces an editable workspace workflow.
- [x] Single agent has one step. Implement and review contains implementation, the bounded review section, and final human approval. Plan–implement–review additionally includes planning and human plan approval before implementation.
- [x] Template setup chooses existing agent profiles and status mappings explicitly where no valid defaults exist; templates do not create duplicate agent profiles.
- [x] A workspace can select a default workflow; new tasks inherit that selection and allow an override. Changing the default does not alter existing tasks or active executions.
- [x] Normal use is create task, Run, inspect current progress, and respond when needed; opening the workflow editor is unnecessary.
- [x] Empty workspaces and missing or removed defaults show actionable setup states rather than silently selecting an unrelated workflow.
- [x] Tests cover template creation/customization, default inheritance, overrides, workspace isolation, changed defaults, and simple versus iterative execution. Storybook demonstrates the minimal task-creation flow.


Validation: 217 server tests passed; typecheck and Storybook build passed; lint has one pre-existing warning. Standards and Spec reviews have no remaining findings. Browser interaction verification could not run because the browser access host was unavailable.
