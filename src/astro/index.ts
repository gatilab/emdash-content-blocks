/**
 * Astro renderers for the content blocks.
 *
 * EmDash imports `blockComponents` from this module (the descriptor's
 * `componentsEntry`) and merges it into `<PortableText>`. Keys match the
 * stored `_type` of each block.
 *
 * The components are also exported by name so a site can render a block
 * directly or wrap one in its own override:
 *
 * ```astro
 * ---
 * import { Faq } from "@gatilab/emdash-content-blocks/astro";
 * ---
 * <Faq node={{ _type: "faq", _key: "a1", schema: false, items: [] }} />
 * ```
 */

import Callout from "./Callout.astro";
import Checklist from "./Checklist.astro";
import Compare from "./Compare.astro";
import Faq from "./Faq.astro";
import Opinion from "./Opinion.astro";
import ProductReview from "./ProductReview.astro";
import ProsCons from "./ProsCons.astro";
import RelatedLinks from "./RelatedLinks.astro";
import Stats from "./Stats.astro";
import Thread from "./Thread.astro";

export { Callout, Checklist, Compare, Faq, Opinion, ProductReview, ProsCons, RelatedLinks, Stats, Thread };

/** Renderers keyed by Portable Text `_type`. */
export const blockComponents = {
	faq: Faq,
	callout: Callout,
	opinion: Opinion,
	stats: Stats,
	productReview: ProductReview,
	prosCons: ProsCons,
	compare: Compare,
	checklist: Checklist,
	thread: Thread,
	relatedLinks: RelatedLinks,
} as const;
