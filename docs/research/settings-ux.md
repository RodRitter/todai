# Settings UX research

Research date: 2026-11-27.

The proposed design separates settings by scope, groups related controls, and shows when changes take effect. Optional help belongs in short tooltips.

## Evidence

| Topic | Primary-source finding | Proposed use in Todai |
| --- | --- | --- |
| Scope | VS Code separates global user settings from workspace settings. Its settings editor provides separate scope tabs. [VS Code settings](https://code.visualstudio.com/docs/configure/settings) | Show “Global” and “Workspace” as visible scope labels. Include the active workspace name. |
| Groups | Related controls are easier to understand in small groups. W3C recommends visual grouping with matching semantic structure. [W3C grouping controls](https://www.w3.org/WAI/tutorials/forms/grouping/) | Group settings by purpose inside each scope. Use headings and labelled sections or fieldsets. |
| Save behavior | Carbon uses switches for reversible binary changes that apply immediately. It recommends other controls with buttons for deferred changes. [Carbon toggle guidance](https://www.carbondesignsystem.com/building-blocks/core/components/toggle/guidelines) | Preserve immediate switches. Use a consistent commit action for text and number fields. Explain this rule once. |
| Optional help | Carbon limits tooltips to brief, optional information. Required instructions must remain visible. Tooltips must not contain interactive controls. [Carbon tooltip guidance](https://www.carbondesignsystem.com/building-blocks/core/components/tooltip/guidelines) | Replace explanatory paragraphs with short help tooltips. Keep labels, scope, required formats, and validation accessible without hover. |
| Tooltip access | W3C requires additional hover content to be dismissible, hoverable, and persistent while applicable. [W3C hover and focus guidance](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html) | Use the shared tooltip with a named, focusable trigger. Check keyboard focus, Escape, pointer movement, and narrow screens. |

## Implementation recommendations

These recommendations are design conclusions from the evidence above. They are not claims about measured Todai user behavior.

1. Put scope before settings categories. Keep the selected scope visible above the content.
2. Name the specific workspace. “Current workspace” alone becomes unclear when users switch workspaces.
3. Use purpose-based groups, such as Identity, Credits, Execution, and Workspace maintenance.
4. Confirm each setting's storage scope before moving it. A global setting must not appear under a workspace heading.
5. Explain the save rule once. Following the user’s preference, fields now save on blur or Enter. Switches save immediately.
6. Show saved values as text buttons. Show input borders during editing. Escape cancels edits. Disable duplicate submissions during saves.
7. Keep edited values after a failed save. Give users a clear retry action.
8. Use the existing toast helpers for pending, success, and failure feedback, as required by the workspace instructions.
9. Keep destructive workspace actions separate from ordinary settings. Retain their confirmation dialogs.
10. Keep short scope descriptions visible. Scope determines the effect of a change and must not depend on a tooltip.

## Verification

Check keyboard navigation, accessible names, tooltip dismissal, and error recovery. Check narrow and wide layouts in both themes.

Confirm that scope labels match backend persistence. Confirm that each control follows the stated save rule.
