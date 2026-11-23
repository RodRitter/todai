# Design guidelines

## Start with existing components

1. Inspect `src/components/ui` and the relevant feature components before building UI. Read their props and adjacent Storybook stories to find an existing treatment.
2. Choose typed props for appearance: `variant`, `size`, `layout`, `align`, `weight`, `reveal`, or `segment`. Add a narrowly named variant to the owning component when the existing API cannot express the required treatment. Use CVA for independent variant axes or a typed union for simple alternatives.
3. Keep call-site `className` for composition: width constraints, grid placement, flex growth, margins, and responsive visibility. Put control height, internal padding, typography, colors, borders, radii, shadows, hover, focus, and disabled styling inside the component. Give recurring layouts a shared component when their structure repeats.
4. Keep runtime measurements in inline `style` only when CSS cannot represent them, such as a measured animated height. Static visual choices belong in variants or theme tokens. Third-party integration styles belong in the integration wrapper.

## Component choices

For agent comments, feedback, and execution output, follow the [agent output presentation contract](agent-output-formatting.md#presentation-contract).

| Need | Existing API |
| --- | --- |
| Primary, secondary, quiet, or destructive action | `Button` variants `default`, `secondary`, `outline`, `ghost`, `ghost-muted`, `destructive`, `ghost-destructive`, `link` |
| Compact control | `Button size="sm"`; dense metadata actions use `xs` or `icon-xs`; regular icon actions use `icon` |
| Navigation or multiline action | `Button align="navigation"`, `align="start"`, or `size="row"` |
| Hover-revealed action | `Button reveal="hover"` inside a `group`; keyboard and touch visibility are built in |
| Muted form metadata | `Label variant="metadata"`; sidebar captions use `variant="caption"` |
| Split action | Adjacent buttons with `segment="start"` and `segment="end"` |
| Form field | `Input`, `Textarea`, `NativeSelect`, `Select`, `Combobox`, `Label`, `Switch`; preserve labels and error associations |
| Prominent title, search field, source editor | `Input variant="title"`, `Input variant="search"` (caller supplies icon), `Textarea variant="code"` |
| Task status selector / column agent selector | `NativeSelect variant="status"` / `SelectTrigger variant="badge" size="sm"` |
| Scrollable content | `ScrollArea` with `orientation="vertical|horizontal|both"`; use `variant="table|code|modal"` for those surfaces |
| Content surface | `Card` variants `default`, `compact`, `task`, `flush`; `elevation="flat"` for embedded surfaces; `interactive`, `dragging`, and `attention` own task card state styling |
| Modal | `DialogContent size="default|wide|large"`; use `layout="workspace"`, `DialogHeader variant="actions"`, and `DialogFooter variant="workspace"` for a full-height editing workspace |
| Execution state | `AgentStatus` for text with a status icon; `variant="badge"` for a filled badge |
| Rich content | `DescriptionEditor`, `EditorSurface`, and `Markdown`; keep editor focus and disabled treatment in their owners |
| Run history | `Trace` and its collapsible, line, icon, title, and description parts from `ui/trace.tsx` |
| Feedback | `Alert`, toast helpers, and `DeleteConfirmation`; use established loading, empty, error, and retry patterns |

## Layout and visual language

Use the semantic theme tokens in `src/app/globals.css`: background/foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, and ring. Status palettes belong in the status component so cards and dialogs agree. Pair foreground and background treatments for dark mode.

Page content uses `p-4 md:p-8`. Settings/forms constrain reading width; boards can span available width. Use `min-w-0` for flex/grid content, wrapping for long names, and explicit scrolling boundaries for tall dialogs. Preserve the app shell's responsive navigation and header spacing.

Use the Tailwind spacing scale: small related controls typically use `gap-2`, form sections `space-y-4` or `space-y-6`. Default controls are 36px tall, small controls 32px, dense actions 28px. Reserve compact actions for dense secondary UI and keep icon controls accessible by name.

Body/control text is generally `text-sm`, supporting metadata `text-xs`, section headings `text-lg` with medium or semibold weight. Let primitives own their corner radii: controls are small, cards use `rounded-2xl`, editing dialogs `rounded-3xl`, confirmation prompts `rounded-xl`. Reuse these choices through props instead of locally reshaping a primitive.

Prefer the shared Base UI `ScrollArea` for bounded lists, panels, previews, tables, and code output. Set a height or maximum height on the root. Keep native page scrolling, text fields, Radix Select scrolling, and Tiptap table/code scrolling under their existing owners. These controls manage their own viewport or editable DOM.

Use the shared shadcn `Dialog` component for all application prompts and confirmations. Follow the [Dialog composition](https://ui.shadcn.com/docs/components/base/dialog). Do not use browser `alert`, `confirm`, or `prompt` calls. Browser-controlled page exit warnings must use `beforeunload`.

Task modals open in the expanded view by default. The Task actions menu lets users collapse or expand the current modal.

Place modal titles on the left and close buttons on the right. Use compact headers and footers without divider lines. Use `DialogContent layout="prompt"` for confirmation prompts. Use `Button size="sm"` for prompt actions and `size="icon-sm"` for close buttons. Use `variant="ghost-destructive"` for delete buttons. Outside clicks close dialogs unless an operation is pending.

## Interaction and accessibility

Use semantic buttons and links with keyboard operation. Icon-only actions need a specific accessible label. Keep focus rings visible, retain disabled/busy behavior, and expose validation with `aria-invalid` and associated error text. Hover-revealed actions must also appear on keyboard focus and touch devices. Status must include text or an icon, not color alone. Respect reduced motion for animation.

Use Radix-backed dialogs, selects, collapsibles, and tooltips for their focus and keyboard behavior. Preserve accessible modal titles, focus restoration, and close guards during pending operations.

Run history follows the [shadcn Chain of Thought composition](https://ui.shadcn.com/docs/ai-elements/base/chain-of-thought), adapted to the existing Radix dependency. Display recorded run data and summaries, with running/pending/error/complete trace states. Keep nested summaries mounted across collapse; pause polling while the history is hidden and abort requests on cleanup.

## Completion checks

Add or update Storybook examples for changed variants and meaningful interaction states. Check narrow and wide layouts, long content, keyboard focus, disabled/loading/error states, and both themes where appearance changes. For run history, cover expansion, summary retention, empty/error/retry, and active/failed runs.

Run the repository lint and typecheck scripts plus a Storybook build for UI changes. Execute relevant interaction checks when changing behavior. Inspect the resulting UI where browser tooling is available; report any verification that could not be completed. Review the diff for visual overrides left at call sites and move them into the owning component before finishing.

## Theme contract

The app header provides an Appearance popout menu with a Dark mode toggle switch.
The menu uses the same icon button and popover pattern as Running servers.
The app follows operating system changes until the user selects a theme.
The switch saves an explicit light or dark preference.
The browser stores the selection under `todai-theme`. The selection applies to all workspaces and synchronizes between tabs.
If browser storage is unavailable, the selection remains active until the page reloads.

`src/lib/theme.ts` owns the storage key, valid values, and startup script. The root layout runs this script before page content appears.
`ThemeProvider` connects components to the browser state in `src/lib/theme-store.ts`. Use `useTheme()` for integrations that require a resolved theme, such as notifications.
Apply the `dark` class only to the document root. This keeps dialogs, menus, tooltips, and other portals consistent.
The root color scheme also controls native form fields and scrollbars.

Define each semantic color in both token sets in `src/app/globals.css`. Keep foreground and background colors together.
Reuse semantic tokens in components. Keep specialized palettes inside their shared component, with explicit light and dark treatments.
Do not add theme state, storage keys, or document class changes inside feature components.

Use the Storybook theme toolbar to inspect components. Use `globals: { theme: "dark" }` for dark stories.
Do not use a local `.dark` wrapper: portals render outside that wrapper.
Check both themes for fields, menus, dialogs, notifications, reference badges, status indicators, and editor content.
Run `npm run test:theme` after changes to theme behavior or tokens.
