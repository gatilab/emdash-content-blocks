# Changelog

All notable changes to `@gatilab/emdash-content-blocks` are documented here. This project follows [Semantic Versioning](https://semver.org/).

## 0.1.0 - 2026-10-05

Initial release.

### Added

- Ten Portable Text blocks with editor definitions and Astro renderers: `faq`, `callout`, `opinion`, `stats`, `productReview`, `prosCons`, `compare`, `checklist`, `thread`, `relatedLinks`.
- FAQPage JSON-LD for the FAQ block, and Product or SoftwareApplication JSON-LD with a single Review and an Offer for the product review block. No AggregateRating.
- Dependency-free HTML sanitizer for rich-text fields, with `wpautop`-style paragraph handling for imported content.
- `validateBlock()` schema validation, TypeScript types and `normalize*` helpers.
- Theming through `--gtcb-*-override` custom properties, with dark mode via `prefers-color-scheme` and `data-theme`.
- Interactive checklist with progress saved in `localStorage`.
- `contentBlocks({ blocks, category })` options to limit the slash menu and rename its category.
