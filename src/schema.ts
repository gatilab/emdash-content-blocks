/**
 * JSON-LD builders for the blocks that can emit structured data.
 *
 * Builders take the stored block node (the same object the renderer receives),
 * normalize it, and return a plain object or `null` when there is not enough
 * data for valid markup. They do not look at the block's `schema` toggle; the
 * renderers decide whether to call them.
 *
 * Product reviews carry exactly one `Review`. No builder emits
 * `AggregateRating`: a single editorial review is not an aggregate.
 */

import { isoCurrency, isoDate } from "./format.js";
import { normalizeFaq, normalizeProductReview } from "./normalize.js";
import type { NormalizedTextRow } from "./normalize.js";
import { htmlToText } from "./sanitize.js";

export type JsonLd = { [key: string]: JsonLdValue };
export type JsonLdValue = string | number | boolean | null | JsonLd | JsonLdValue[];

const CONTEXT = "https://schema.org";

/**
 * Serialize JSON-LD for an inline `<script type="application/ld+json">`.
 * Escapes characters that could close the script element or break parsing.
 */
export function serializeJsonLd(data: JsonLd): string {
	return JSON.stringify(data)
		.replace(/</g, "\\u003c")
		.replace(/>/g, "\\u003e")
		.replace(/&/g, "\\u0026")
		.replace(/\u2028/g, "\\u2028")
		.replace(/\u2029/g, "\\u2029");
}

/** Resolve a URL against `baseUrl`. Absolute http(s) URLs are returned unchanged. */
export function absoluteUrl(url: string, baseUrl?: string | URL): string | undefined {
	if (/^https?:\/\//i.test(url)) return url;
	if (url.startsWith("//")) return `https:${url}`;
	if (!baseUrl) return url;
	try {
		const resolved = new URL(url, baseUrl).href;
		return /^https?:\/\//i.test(resolved) ? resolved : undefined;
	} catch {
		return undefined;
	}
}

// ── FAQPage ──────────────────────────────────────────────────────────────────

/**
 * FAQPage JSON-LD for a stored `faq` block. Answers are flattened to plain
 * text. Returns `null` when no item has both a question and an answer.
 */
export function buildFaqJsonLd(node: unknown): JsonLd | null {
	const faq = normalizeFaq(node);
	const mainEntity: JsonLd[] = [];
	for (const item of faq.items) {
		const answer = htmlToText(item.answerHtml);
		if (!item.question || !answer) continue;
		mainEntity.push({
			"@type": "Question",
			name: item.question,
			acceptedAnswer: { "@type": "Answer", text: answer },
		});
	}
	if (mainEntity.length === 0) return null;
	return { "@context": CONTEXT, "@type": "FAQPage", mainEntity };
}

// ── Product / SoftwareApplication review ────────────────────────────────────

export interface ReviewJsonLdOptions {
	/**
	 * Base used to make relative image and offer URLs absolute,
	 * typically `Astro.site` or the current page URL.
	 */
	baseUrl?: string | URL;
}

function itemList(rows: NormalizedTextRow[]): JsonLd {
	return {
		"@type": "ItemList",
		itemListElement: rows.map((row, index) => ({
			"@type": "ListItem",
			position: index + 1,
			name: row.text,
		})),
	};
}

/**
 * Product or SoftwareApplication JSON-LD for a stored `productReview` block.
 *
 * - `review` is included when the block has a rating and a reviewer name
 *   (search engines require a review author). Pros and cons become
 *   `positiveNotes` / `negativeNotes`.
 * - `offers` is included when the block has a price and an ISO currency.
 * - Returns `null` when neither a review nor an offer can be built, or the
 *   block has no name.
 */
export function buildProductReviewJsonLd(
	node: unknown,
	options: ReviewJsonLdOptions = {},
): JsonLd | null {
	const review = normalizeProductReview(node);
	if (!review.name) return null;

	const type = review.schemaType;
	const data: JsonLd = { "@context": CONTEXT, "@type": type, name: review.name };

	if (review.image) {
		const image = absoluteUrl(review.image.src, options.baseUrl);
		if (image) data.image = image;
	}
	const description = htmlToText(review.summaryHtml);
	if (description) data.description = description;

	if (type === "Product") {
		if (review.brand) data.brand = { "@type": "Brand", name: review.brand };
		if (review.sku) data.sku = review.sku;
	} else {
		if (review.brand) data.publisher = { "@type": "Organization", name: review.brand };
		if (review.appCategory) data.applicationCategory = review.appCategory;
		if (review.operatingSystem) data.operatingSystem = review.operatingSystem;
	}

	let hasReview = false;
	if (review.rating !== undefined && review.reviewer) {
		const reviewData: JsonLd = {
			"@type": "Review",
			author: { "@type": "Person", name: review.reviewer },
			reviewRating: {
				"@type": "Rating",
				ratingValue: review.rating,
				bestRating: 5,
				worstRating: 0,
			},
		};
		const published = isoDate(review.reviewDate);
		if (published) reviewData.datePublished = published;
		if (review.pros.length > 0) reviewData.positiveNotes = itemList(review.pros);
		if (review.cons.length > 0) reviewData.negativeNotes = itemList(review.cons);
		data.review = reviewData;
		hasReview = true;
	}

	let hasOffer = false;
	const currency = isoCurrency(review.currency);
	if (review.price !== undefined && currency) {
		const offer: JsonLd = { "@type": "Offer", price: review.price, priceCurrency: currency };
		if (review.cta) {
			const url = absoluteUrl(review.cta.href, options.baseUrl);
			if (url && /^https?:\/\//i.test(url)) offer.url = url;
		}
		data.offers = offer;
		hasOffer = true;
	}

	return hasReview || hasOffer ? data : null;
}
