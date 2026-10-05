# @gatilab/emdash-content-blocks

Ten editorial Portable Text blocks for [EmDash](https://github.com/emdash-cms/emdash): FAQ, callout, expert opinion, stats, product review, pros and cons, comparison, checklist, social thread and related links. Each block ships an editor form for the EmDash admin and an Astro renderer for the public site, and the FAQ and product review blocks can emit JSON-LD.

- Supports EmDash 1.1 and later on Astro 7.
- No capabilities, hooks, routes, settings or network access.
- No runtime dependencies. One small inline script, only on pages with an interactive checklist.

## Blocks

| `_type` | Editor label | Renders | Structured data |
| --- | --- | --- | --- |
| `faq` | FAQ | Accordion panels built on native `<details>`, no JavaScript | FAQPage (toggle) |
| `callout` | Callout | Tinted note with tone icon, text label, body and optional button | None |
| `opinion` | Expert opinion | Quote panel with photo, name and role | None |
| `stats` | Stats | Grid of headline numbers with labels | None |
| `productReview` | Product review | Image, stars, price, summary, feature scores, pros and cons, button, byline | Product or SoftwareApplication with one Review (toggle) |
| `prosCons` | Pros and cons | Two labeled lists, side by side on wide screens | None |
| `compare` | Comparison | Two to four options side by side, one marked "Recommended" | None |
| `checklist` | Checklist | Static list, or real checkboxes with progress saved in the browser | None |
| `thread` | Social thread | Generic social post thread mock-up, no platform branding | None |
| `relatedLinks` | Related links | Titled list of further reading | None |

Field-by-field shapes are in [SCHEMAS.md](./SCHEMAS.md).

## Install

```bash
pnpm add @gatilab/emdash-content-blocks
```

Register the descriptor in the EmDash integration. Native plugins go in `plugins`, not `sandboxed`:

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { contentBlocks } from "@gatilab/emdash-content-blocks";

export default defineConfig({
	integrations: [
		emdash({
			// database, storage, ...
			plugins: [contentBlocks()],
		}),
	],
});
```

Restart the dev server after changing `astro.config.mjs`. The blocks appear in the editor's slash menu under **Content blocks**, and EmDash's `<PortableText>` renders them automatically. No component wiring is needed.

### Options

```js
contentBlocks({
	// Only offer these blocks in the slash menu. Default: all ten.
	blocks: ["faq", "callout", "productReview"],
	// Slash-menu category. Default: "Content blocks".
	category: "Editorial",
});
```

`blocks` only limits what editors can insert. Renderers for every type stay registered, so existing content keeps rendering.

## Why this is a native plugin

EmDash loads Astro rendering components only from native plugins (`componentsEntry`). The plugin needs nothing else: it declares no capabilities, registers no hooks or routes, and makes no network requests. Like every native plugin, it runs in the host process with no isolation boundary, so its trust model is the same as any other npm dependency of your site.

## Editing

Each block opens a form in the editor. Lists (FAQ items, stats, features, pros, cons, columns, checklist items, posts, links) are repeaters with drag-and-drop ordering. Images use the media picker. Booleans are toggles; tone and structured data type are selects.

A few editor behaviors worth knowing:

- **Images.** The media picker saves the picked asset's URL as a string. Content imported with the `{ src, alt, width, height }` object keeps that shape until someone picks a new image. Renderers accept both.
- **Ratings and prices** use number fields without a minimum or maximum, because browsers reject half steps such as 4.5 when a minimum is set. Renderers clamp ratings to 0 to 5 and round to the nearest half.
- **Row keys.** The repeater drops `_key` from rows on save. Renderers fall back to the row position, and the checklist stores ticks by block `_key`, not row keys.
- **HTML fields** (FAQ answers, callout body, opinion body) accept a small HTML allowlist. See [Rich text](#rich-text).

## Rendering

### Overriding one renderer

Components passed to `<PortableText>` override plugin components with the same type key:

```astro
---
import { PortableText } from "emdash/ui";
import MyCallout from "../components/MyCallout.astro";
---

<PortableText value={entry.data.content} components={{ type: { callout: MyCallout } }} />
```

### Using a component directly

```astro
---
import { Faq } from "@gatilab/emdash-content-blocks/astro";
---

<Faq node={{ _type: "faq", _key: "pricing-faq", schema: false, items: [{ question: "Is there a free plan?", answer: "Yes." }] }} />
```

All ten components are exported by name (`Faq`, `Callout`, `Opinion`, `Stats`, `ProductReview`, `ProsCons`, `Compare`, `Checklist`, `Thread`, `RelatedLinks`) along with the `blockComponents` map.

### Rich text

HTML fields are sanitized on the server by a small, dependency-free sanitizer before they reach `set:html`:

- Kept: `<a href title target rel>`, `<strong>`, `<em>`, `<code>`, `<br>`, `<p>`, `<ul>`, `<ol start>`, `<li>`, `<h3>`, `<h4>`. `<b>` and `<i>` become `<strong>` and `<em>`.
- Removed with their content: `<script>`, `<style>`, `<iframe>`, `<object>`, `<svg>`, `<math>`, `<template>` and similar.
- Unwrapped (text kept): any other tag.
- Dropped: every other attribute, including `style`, `class` and `on*` handlers.
- Links: only http, https, mailto, tel and relative URLs, checked after decoding character references. New-tab links get `rel="noopener"`.

A value with no block-level markup is split into paragraphs on blank lines, which matches content imported from WordPress fields that relied on `wpautop`.

The sanitizer is exported if you need it elsewhere: `sanitizeHtml`, `richText`, `htmlToText`, `safeUrl`, `safeRel`.

### Structured data

- **FAQ:** with the block's toggle on, a FAQPage script with plain-text answers. Search engines expect one FAQPage per page, so turn the toggle off on secondary FAQ blocks.
- **Product review:** with the toggle on, a `Product` or `SoftwareApplication` with a single `Review` (author, rating, date, pros and cons as `positiveNotes` and `negativeNotes`) and an `Offer` when a price and ISO currency are set. The review needs both a rating and a reviewer name. `AggregateRating` is never emitted. Google's software app rich result also requires an offer, so set a price (0 for free apps) on `SoftwareApplication` reviews.

Relative image URLs are made absolute using `Astro.site`, or the request URL when `site` is not configured.

## Theming

Blocks inherit the site's typography: no `font-family` (except monospace for inline code) and no `letter-spacing` are set. Type sizes use a fixed ladder of 28, 21, 19, 16, 14, 12 and 11 px in rem, with weights up to 600.

Colors come from CSS custom properties. Set the `-override` variables anywhere above the blocks, usually on `:root`:

| Override | Used for | Light fallback |
| --- | --- | --- |
| `--gtcb-accent-override` | Buttons, open FAQ toggle, bullets, stars, bars, highlight border | `var(--color-primary, #c0392b)` |
| `--gtcb-on-accent-override` | Text and icons on accent fills | `#ffffff` |
| `--gtcb-ink-override` | Text on block surfaces | `#1c1c1e` |
| `--gtcb-muted-override` | Secondary text | `#5e5e66` |
| `--gtcb-surface-override` | Panel backgrounds | `#ffffff` |
| `--gtcb-tint-override` | Tinted panels, image wells, tracks | `#f6f6f4` |
| `--gtcb-hairline-override` | 1px borders and dividers | `#e3e3e0` |
| `--gtcb-accent-soft-override` | FAQ hover and open summary | 8% accent mixed into surface |
| `--gtcb-positive-override` / `--gtcb-negative-override` | Pros and cons marks | `#1e7b46` / `#b3261e` |
| `--gtcb-star-override` | Filled stars | accent |
| `--gtcb-info-override`, `--gtcb-success-override`, `--gtcb-warning-override`, `--gtcb-danger-override`, `--gtcb-tip-override`, `--gtcb-note-override` | Callout tones | see `src/astro/styles/base.css` |
| `--gtcb-radius-override` | Panel radius | `12px` |
| `--gtcb-block-gap-override` | Vertical margin around each block | `2rem` |

```css
:root {
	--gtcb-accent-override: #0b6e4f;
	--gtcb-radius-override: 14px;
}
```

### Dark mode

Block surfaces switch to dark values when either:

- the visitor's system prefers dark and `<html>` does not have `data-theme="light"`, or
- an ancestor has `data-theme="dark"`.

Text that sits directly on your page (such as the FAQ title) inherits your page's color, so it follows your theme. If your site is light-only, add `data-theme="light"` to `<html>` to keep the blocks light. To use your own dark palette, set the override variables inside your dark-mode rules.

### Class names

Every block root has `gtcb` plus a block class (`gtcb-faq`, `gtcb-callout`, `gtcb-opinion`, `gtcb-stats`, `gtcb-review`, `gtcb-proscons`, `gtcb-compare`, `gtcb-checklist`, `gtcb-thread`, `gtcb-related`) and `not-prose`, so Tailwind Typography leaves it alone. Selectors are scoped as `.gtcb .gtcb-*` to beat typical `.prose a` or `.prose li` rules without `!important`.

## Accessibility

- Blocks never emit `h1` to `h6`; titles are styled text, so they fit at any heading depth.
- Color is never the only signal: callouts show a text label, pros and cons are labeled, the recommended column has a text badge, and checked items show a mark and strike-through.
- The FAQ uses native `<details>` and `<summary>`, so it works with the keyboard and without JavaScript.
- Interactive controls (summaries, buttons, links, checklist rows) are at least 44 px tall.
- Focus is shown with a 3 px accent outline.
- Animations are limited to short transitions and are disabled under `prefers-reduced-motion`.
- The interactive checklist uses real checkboxes. Without JavaScript they still toggle; the progress row stays hidden and nothing is stored. Storage access is wrapped so private browsing and blocked storage do not throw.

## UI text

The renderers include a few English strings: tone names (Info, Success, Warning, Important, Tip, Note), "Pros", "Cons", "Ratings", "Recommended", "Reviewed by", "of N done", "Reset", "Verified account", "Replies", "Reposts", "Likes", "Related links" and "(opens in a new tab)". To translate them, override the affected renderer as shown above.

## Validation helpers

The package exports a schema validator for import scripts and seed checks. It has no WordPress or ACF dependency.

```ts
import { validateBlock } from "@gatilab/emdash-content-blocks";

const result = validateBlock(node);
if (!result.valid) console.error(result.errors); // [{ path: "items[2].answer", message: "is required", severity: "error" }]
console.warn(result.warnings); // unknown tone, rating not a half step, missing row _key, ...
```

Also exported: the TypeScript types for every block, `normalize*` view-model helpers, `buildFaqJsonLd`, `buildProductReviewJsonLd`, `serializeJsonLd`, `getBlockDefinitions` and `BLOCK_SCHEMAS`.

## Development

```bash
pnpm install
pnpm test        # vitest: sanitizer, JSON-LD, validation, editor definitions, rendered output
pnpm typecheck   # tsc --noEmit and astro check
```

The package publishes its TypeScript and `.astro` source; the host site's Vite build compiles it, as with EmDash's own plugins.

## License

GPL-2.0-or-later. See [LICENSE](./LICENSE).
