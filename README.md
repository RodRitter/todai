# Todai

Component foundation for the local agent task manager described in [the MVP plan](docs/todai-plan.md). This bootstrap contains Next.js, TypeScript, Tailwind CSS, shadcn/ui primitives, and Storybook. Product screens, storage, and the worker are deferred; the `/` route intentionally renders nothing.

## Getting started

Use Node.js 24 LTS (`nvm use`) and npm.

```sh
npm install
npm run storybook
```

Open http://127.0.0.1:6006 for the component explorer. Stories include automatic documentation, editable controls, action logging, accessibility checks, and a light/dark toolbar selector. The same global CSS is used by the app and Storybook, including portaled dialogs.

```sh
npm run dev             # Next.js on http://127.0.0.1:3000 (empty root route)
npm run lint
npm run typecheck       # App, components, stories, and Storybook configuration
npm run typecheck:app   # App and components only
npm run build
npm run start           # Serves an existing production build; no worker yet
npm run build-storybook # Static component explorer in storybook-static/
```

## Components

Source and colocated stories live in `src/components/ui/`:

- Actions: Button.
- Forms: Input, Textarea, Label, Checkbox, Switch.
- Feedback: Badge, Alert, Progress, Skeleton.
- Navigation: Tabs.
- Overlays: Dialog.
- Primitives: Separator.

Stories cover the stock variants and relevant disabled, invalid, checked, loading, or selected states. Example wrapper dimensions only give isolated primitives enough room in Storybook; they are not application layouts.

## Design conventions

Use the standard shadcn/ui New York style, neutral light/dark semantic colors, default radii, Lucide icons, and Radix primitives. There are no Todai-specific component variants or visual overrides. Tailwind's default system font stack keeps builds independent of remote font downloads.

Import primitives directly, for example `import { Button } from "@/components/ui/button"`. Keep new primitives aligned with shadcn; compose them when screens are introduced later. Configuration is in `components.json`, theme tokens are in `src/app/globals.css`, and `cn` is in `src/lib/utils.ts`.

Add another standard component with:

```sh
npx shadcn@latest add select
```

Add a colocated `*.stories.tsx` file for its variants and accessible usage. Preserve the existing shadcn configuration rather than applying a new preset. Custom branding and overrides are a later step.

References: [shadcn Next.js setup](https://ui.shadcn.com/docs/installation/next), [Storybook Next.js/Vite integration](https://storybook.js.org/docs/get-started/frameworks/nextjs-vite).

## Bootstrap environment limitation

Verified locally: `npm run lint`, `npm run typecheck:app`, and `npm run build` passed. The explorer contains 54 stories across 13 primitives.

The initial environment blocked npm network access. App dependencies were installed from the local cache, but Storybook packages were unavailable. Storybook is configured and declared in `package.json`; its installation, full-project type check, interactive preview, and static build still need verification after `npm install` with registry access. No incomplete lockfile is included. Generate and commit `package-lock.json` after that first successful install, then use `npm ci` for repeatable installs.
