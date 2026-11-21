# Design System

This document is the shared source of truth for the Storefront and Admin applications. Read `DESIGN.md` before creating or modifying any UI component, page, layout, or styling.

## Brand configuration and generated tokens

The canonical editable brand configuration is `packages/design-system/src/theme.config.ts`. It contains exactly three HEX values:

- `primary`: Cacao, anchored at shade 700
- `secondary`: Taupe, anchored at shade 500
- `tertiary`: Khaki, anchored at shade 200

All 33 shades (950 through 50 for each brand) are generated programmatically in OKLCH, with monotonic lightness, reduced chroma near gamut boundaries, and sRGB gamut mapping. Anchor shades preserve their configured HEX values exactly. The generated stylesheet is `packages/design-system/generated/tokens.css`; never edit it manually.

To change the brand, edit only the three values in `theme.config.ts`, then run `pnpm generate:theme` from either application (or `pnpm --dir packages/design-system generate`) and `pnpm test:theme`. Do not add brand HEX values to application CSS or components. Both applications consume the same generated package output.

## Semantic tokens

Components must use semantic tokens exposed by Tailwind v4 and shadcn/ui: `background`, `foreground`, `card`, `popover`, `primary`, `secondary`, `tertiary`, `accent`, `muted`, `border`, `input`, `ring`, `hover`, `active`, `selected`, and `disabled`, with their corresponding foreground tokens where applicable. Light and dark mappings are generated centrally. Status colors (`destructive`, `success`, `warning`, and `info`) are functional colors and remain separate from the brand palette.

Use classes such as `bg-primary`, `text-foreground`, `border-border`, `bg-card`, and `ring-ring`. Never use arbitrary brand HEX values in UI code. Pair status colors with text, icons, or labels; never communicate important state by color alone.

## Brand usage

The identity is warm, architectural, quiet, and tactile. Cacao provides authority and focus, Taupe supports hierarchy and restraint, and Khaki creates calm editorial space. The Storefront should feel premium, minimal, editorial, architectural, elegant, and photography-focused. The Admin should feel clean, professional, functional, and information-dense without becoming visually harsh.

## Typography

Use the system sans stack until a product-approved typeface is introduced: Arial, Helvetica, sans-serif. Use strong compact headings, readable regular body text, and labels no smaller than 12px. Do not use more than three weights in one view. Recommended type sizes are 12, 14, 16, 18, 24, 30, 36, 48, and 60px.

## Spacing, radius, and elevation

Use a 4px base grid with preferred spacing of 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, and 96px. Small controls use 6px radius, standard controls and cards 10px, large panels 14px, and pills 9999px. Prefer borders before shadows. Use the generated shadow tokens for purposeful elevation.

## Components and architecture

- Use semantic shadcn/ui tokens for buttons, forms, cards, menus, and dialogs.
- Buttons expose default, hover, active, focus-visible, disabled, and loading states.
- Keep business logic separate from presentational components.
- Keep React Server Components as the default; use Client Components only for interaction or browser APIs.
- Preserve the existing Storefront and Admin setup screens until an approved product design replaces them.

## Accessibility

Target WCAG 2.2 AA: normal text contrast at least 4.5:1, large text at least 3:1, and relevant non-text UI contrast at least 3:1. Generated semantic foreground pairings are tested automatically. Every interactive element needs a visible keyboard focus state, a semantic name, and understandable hover, active, selected, disabled, and loading states. Respect reduced motion when animation is introduced.

## Themes and responsive behavior

Light mode is the default. Dark mode uses the `.dark` class and generated deep Cacao and warm charcoal surfaces, not pure black. Resolve theme selection before hydration when a switcher is introduced. Design mobile-first, preserve readable line lengths, allow controls to wrap, and avoid horizontal scrolling.

## Application-specific rules

### Storefront

Prefer generous whitespace, strong editorial hierarchy, large image presentation, calm surfaces, and subtle transitions. Photography is the visual focus and UI chrome should recede.

### Admin

Prefer clear hierarchy, practical spacing, readable tables and forms, persistent focus states, and explicit status indicators. Information density should support scanning without sacrificing touch targets or contrast.

#### Admin form system

All Admin forms and CMS editors must use the shared Admin form component system. Do not use unstyled native file inputs, duplicate form styles, or hardcoded brand colors.

- Controls use consistent 40px heights, 10px radii, semantic borders, and visible `ring-ring` focus states.
- Group fields with `FormSection`; use labels, required indicators, help text, and nearby validation messages consistently.
- Use the shared `TextField`, `TextareaField`, `SelectField`, `SwitchField`, `CheckboxField`, `ActionButton`, and `ImageUploadField` components for CMS editors.
- Primary actions use the primary semantic token; draft actions use outline or secondary treatment; destructive actions require explicit destructive styling and confirmation where appropriate.
- Loading actions disable themselves, show progress or a spinner, and prevent duplicate submissions. Feedback is announced with `aria-live` where appropriate.
- Image uploaders must provide drag-and-drop and keyboard file selection, show supported formats and the 10 MB limit, preserve previews, expose retry/error states, and never delete a published asset automatically when replacing a draft asset.
- Forms use one column by default, introduce two-column groups at comfortable widths, and stack cleanly on mobile. Sticky action bars are reserved for long editing workflows.

## Mandatory implementation rule

Before creating or modifying any UI component, page, layout, or styling, read `DESIGN.md`. All UI components must consume generated theme tokens. Never introduce arbitrary color values or inconsistent component styles. Brand HEX values may only be edited in `packages/design-system/src/theme.config.ts`. Update this document when an approved design-system rule changes.
