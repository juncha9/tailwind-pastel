# Changelog

All notable changes to **Tailwind Crayon** are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.1] - 2026-05-03

### Added

- Initial release.
- Category-based highlighting for Tailwind utility classes across six groups: **Layout**, **Box**, **Typography**, **Surface**, **Motion**, **Other**.
- Three-layer decoration per token:
    - **Anchor** — the prefix that determines the category (e.g. `bg` in `bg-red-500`) gets the category color in bold.
    - **Full** — the entire class gets a thin underline in the same color, alpha-toned-down so dense walls of classes stay readable.
    - **Variant** — modifier prefixes (`hover:`, `md:`, `dark:`, `!`, leading `-`) get the same color at normal weight, forming a natural typographic hierarchy with the bold anchor.
- CSS custom property highlighting — `--xxx` identifiers inside arbitrary values (e.g. `bg-[var(--brand)]`) get a distinct cool tone (slate-300) so they stand out from utility names.
- Variant-aware classification — strips variant prefixes (`md:`, `hover:`, `dark:`), `!important`, and negative `-` markers before category lookup.
- Arbitrary value support — bracket contents (`w-[calc(100%-2rem)]`, `bg-[#1a1a1a]`) tokenize correctly even with spaces or colons inside.
- Class string detection from:
    - Attributes: `class`, `className`, `ngClass`, `class:list`, plus their `[bracket]` Angular forms.
    - Helpers: `clsx`, `cn`, `cx`, `cva`, `tw`, `twMerge`, `twJoin`, `classNames`, `classnames` — including namespaced (`lib.cn(...)`) and tagged template (`` cn`...` ``) calls.
- Setting `tailwindCrayon.enabled` (boolean, default `true`).
- Commands:
    - `Tailwind Crayon: Toggle Highlighting` — flip the enabled setting (workspace target if defined, otherwise global).
    - `Tailwind Crayon: Inspect Class at Cursor` — show the category of the token under the cursor in the status bar.
- Supported languages: TypeScript React, JavaScript React, HTML, Vue, Svelte, Astro.
- Performance:
    - Debounced re-highlighting (150ms) on document changes.
    - Document-level token cache keyed by `TextDocument.version`.
    - Windowed incremental rescan for single-line edits — only the affected ±5 lines are re-extracted, the rest of the cache is shifted by the change delta.

[0.0.1]: https://github.com/alkemic-studio/tailwind-crayons/releases/tag/v0.0.1
