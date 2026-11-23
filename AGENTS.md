# Language

Every agent working in this workspace must use ASD-STE100 Simplified Technical English for all user-facing prose, regardless of role or board assignment. Before writing responses, progress updates, reports, or documentation, read [Common writing rules](docs/writing-rules.md) once per context. Apply this local reference throughout the task; routine writing requires no external lookup.

# UI changes

Before creating, editing, or reviewing UI components, layouts, styling, or interaction states, read [Design guidelines](docs/design-guidelines.md). Use the existing components and their typed variants; extend the shared component when a new visual treatment is needed.

Show all settings operation feedback with the shared toast helpers in `src/components/ui/toast.tsx`. Use `notifyOperation` for pending, success, and failure feedback. Use `toast.error` for load failures. Keep feedback out of inline status text and alerts. Keep field labels, help text, validation attributes, and retry controls accessible. Check this rule when adding or changing settings UI.

# Agent output

Before changing agent comments, feedback, handovers, prompts, or their rendering, read [Agent output formatting](docs/agent-output-formatting.md) and its linked writing policy.
