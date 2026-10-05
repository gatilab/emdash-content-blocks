/**
 * Coercion and normalization helpers.
 *
 * Block data can come from an importer, the EmDash editor, or a hand-written
 * seed file, so renderers treat every node as untrusted input. Each
 * `normalize*` function turns a raw node into a small, fully typed view model:
 * strings are trimmed, booleans and numbers are coerced, rich text is
 * sanitized, URLs are checked, and rows without content are dropped.
 */

import { richText, safeRel, safeUrl } from "./sanitize.js";
import { CALLOUT_TONES, REVIEW_SCHEMA_TYPES } from "./types.js";
import type { CalloutTone, ReviewSchemaType } from "./types.js";

type UnknownRecord = Record<string, unknown>;

// ── primitives ───────────────────────────────────────────────────────────────

export function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Trimmed string; numbers are stringified; anything else becomes "". */
export function asString(value: unknown): string {
	if (typeof value === "string") return value.trim();
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return "";
}

/** Like {@link asString} but returns `undefined` for empty values. */
export function asOptionalString(value: unknown): string | undefined {
	const result = asString(value);
	return result === "" ? undefined : result;
}

const TRUE_STRINGS = new Set(["true", "1", "yes", "on"]);
const FALSE_STRINGS = new Set(["false", "0", "no", "off", ""]);

/** Accepts booleans, 0/1 and common string spellings; otherwise returns `fallback`. */
export function asBoolean(value: unknown, fallback = false): boolean {
	if (typeof value === "boolean") return value;
	if (typeof value === "number") return value !== 0;
	if (typeof value === "string") {
		const lowered = value.trim().toLowerCase();
		if (TRUE_STRINGS.has(lowered)) return true;
		if (FALSE_STRINGS.has(lowered)) return false;
	}
	return fallback;
}

/** Finite number, or a numeric string converted to one; otherwise `undefined`. */
export function asNumber(value: unknown): number | undefined {
	if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
	if (typeof value === "string" && value.trim() !== "") {
		const parsed = Number(value.trim().replace(/,/g, ""));
		return Number.isFinite(parsed) ? parsed : undefined;
	}
	return undefined;
}

/** The object rows of an array; non-arrays and non-object rows are ignored. */
export function asRows(value: unknown): UnknownRecord[] {
	return Array.isArray(value) ? value.filter(isRecord) : [];
}

/** Clamp to 0..5 and round to the nearest half star. */
export function normalizeRating(value: unknown): number | undefined {
	const parsed = asNumber(value);
	if (parsed === undefined) return undefined;
	const clamped = Math.min(5, Math.max(0, parsed));
	return Math.round(clamped * 2) / 2;
}

export function normalizeTone(value: unknown): CalloutTone {
	const tone = asString(value).toLowerCase();
	return (CALLOUT_TONES as readonly string[]).includes(tone) ? (tone as CalloutTone) : "info";
}

export function normalizeSchemaType(value: unknown): ReviewSchemaType {
	const type = asString(value);
	return (REVIEW_SCHEMA_TYPES as readonly string[]).includes(type)
		? (type as ReviewSchemaType)
		: "Product";
}

/** Stable key for a row: its `_key`, or a positional fallback. */
export function rowKey(row: UnknownRecord, index: number): string {
	return asOptionalString(row._key) ?? `row-${index}`;
}

const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}/u;

/** Keep `icon` only when it contains an emoji (ACF icon slugs are ignored). */
export function normalizeEmoji(value: unknown): string | undefined {
	const icon = asString(value);
	if (!icon || icon.length > 16 || !EMOJI_RE.test(icon)) return undefined;
	return icon;
}

export interface NormalizedImage {
	src: string;
	alt: string;
	width?: number;
	height?: number;
}

/**
 * Accepts the stored image object (`{ id, src, alt, width, height }`) or the
 * URL string the editor's media picker writes. Returns `undefined` when there
 * is no safe `src`.
 */
export function normalizeImage(value: unknown, fallbackAlt = ""): NormalizedImage | undefined {
	if (typeof value === "string") {
		const src = safeUrl(value);
		return src ? { src, alt: fallbackAlt } : undefined;
	}
	if (!isRecord(value)) return undefined;
	const src = safeUrl(value.src);
	if (!src) return undefined;
	const width = asNumber(value.width);
	const height = asNumber(value.height);
	const image: NormalizedImage = { src, alt: asString(value.alt) || fallbackAlt };
	if (width !== undefined && width > 0) image.width = Math.round(width);
	if (height !== undefined && height > 0) image.height = Math.round(height);
	return image;
}

/** `{ label, href }` when both a label and a safe URL are present. */
export interface NormalizedLink {
	label: string;
	href: string;
}

function link(label: unknown, url: unknown): NormalizedLink | undefined {
	const text = asString(label);
	const href = safeUrl(url);
	return text && href ? { label: text, href } : undefined;
}

// ── block view models ────────────────────────────────────────────────────────

export interface NormalizedFaq {
	key: string;
	title?: string;
	schema: boolean;
	items: Array<{ key: string; question: string; answerHtml: string }>;
}

export function normalizeFaq(node: unknown): NormalizedFaq {
	const raw = isRecord(node) ? node : {};
	return {
		key: asString(raw._key),
		title: asOptionalString(raw.title),
		schema: asBoolean(raw.schema),
		items: asRows(raw.items)
			.map((row, index) => ({
				key: rowKey(row, index),
				question: asString(row.question),
				answerHtml: richText(row.answer),
			}))
			.filter((item) => item.question !== ""),
	};
}

export interface NormalizedCallout {
	key: string;
	label?: string;
	tone: CalloutTone;
	bodyHtml: string;
	cta?: NormalizedLink;
}

export function normalizeCallout(node: unknown): NormalizedCallout {
	const raw = isRecord(node) ? node : {};
	return {
		key: asString(raw._key),
		label: asOptionalString(raw.label),
		tone: normalizeTone(raw.tone),
		bodyHtml: richText(raw.body),
		cta: link(raw.ctaLabel, raw.ctaUrl),
	};
}

export interface NormalizedOpinion {
	key: string;
	name?: string;
	role?: string;
	avatar?: NormalizedImage;
	bodyHtml: string;
}

export function normalizeOpinion(node: unknown): NormalizedOpinion {
	const raw = isRecord(node) ? node : {};
	const name = asOptionalString(raw.name);
	return {
		key: asString(raw._key),
		name,
		role: asOptionalString(raw.role),
		avatar: normalizeImage(raw.avatar, name ?? ""),
		bodyHtml: richText(raw.body),
	};
}

export interface NormalizedStat {
	key: string;
	value: string;
	label: string;
	prefix?: string;
	suffix?: string;
	icon?: string;
}

export function normalizeStats(node: unknown): { key: string; items: NormalizedStat[] } {
	const raw = isRecord(node) ? node : {};
	return {
		key: asString(raw._key),
		items: asRows(raw.items)
			.map((row, index) => ({
				key: rowKey(row, index),
				value: asString(row.value),
				label: asString(row.label),
				prefix: asOptionalString(row.prefix),
				suffix: asOptionalString(row.suffix),
				icon: normalizeEmoji(row.icon),
			}))
			.filter((item) => item.value !== "" || item.label !== ""),
	};
}

export interface NormalizedTextRow {
	key: string;
	text: string;
}

export function normalizeTextRows(value: unknown): NormalizedTextRow[] {
	return asRows(value)
		.map((row, index) => ({ key: rowKey(row, index), text: asString(row.text) }))
		.filter((row) => row.text !== "");
}

export function normalizeProsCons(node: unknown): {
	key: string;
	pros: NormalizedTextRow[];
	cons: NormalizedTextRow[];
} {
	const raw = isRecord(node) ? node : {};
	return {
		key: asString(raw._key),
		pros: normalizeTextRows(raw.pros),
		cons: normalizeTextRows(raw.cons),
	};
}

export interface NormalizedReviewCta extends NormalizedLink {
	rel?: string;
	newTab: boolean;
}

export interface NormalizedProductReview {
	key: string;
	name: string;
	brand?: string;
	image?: NormalizedImage;
	rating?: number;
	summary?: string;
	summaryHtml: string;
	features: Array<{ key: string; name: string; rating?: number }>;
	pros: NormalizedTextRow[];
	cons: NormalizedTextRow[];
	cta?: NormalizedReviewCta;
	price?: number;
	currency?: string;
	priceTerm?: string;
	schema: boolean;
	schemaType: ReviewSchemaType;
	appCategory?: string;
	operatingSystem?: string;
	sku?: string;
	reviewer?: string;
	reviewDate?: string;
}

export function normalizeProductReview(node: unknown): NormalizedProductReview {
	const raw = isRecord(node) ? node : {};
	const name = asString(raw.name);
	const newTab = asBoolean(raw.ctaNewTab);
	const ctaLink = link(raw.ctaLabel, raw.ctaUrl);
	const price = asNumber(raw.price);
	const summary = asOptionalString(raw.summary);
	return {
		key: asString(raw._key),
		name,
		brand: asOptionalString(raw.brand),
		image: normalizeImage(raw.image, name),
		rating: normalizeRating(raw.rating),
		summary,
		summaryHtml: richText(summary),
		features: asRows(raw.features)
			.map((row, index) => ({
				key: rowKey(row, index),
				name: asString(row.name),
				rating: normalizeRating(row.rating),
			}))
			.filter((feature) => feature.name !== ""),
		pros: normalizeTextRows(raw.pros),
		cons: normalizeTextRows(raw.cons),
		cta: ctaLink ? { ...ctaLink, newTab, rel: safeRel(raw.ctaRel, newTab) } : undefined,
		price: price !== undefined && price >= 0 ? price : undefined,
		currency: asOptionalString(raw.currency),
		priceTerm: asOptionalString(raw.priceTerm),
		schema: asBoolean(raw.schema),
		schemaType: normalizeSchemaType(raw.schemaType),
		appCategory: asOptionalString(raw.appCategory),
		operatingSystem: asOptionalString(raw.operatingSystem),
		sku: asOptionalString(raw.sku),
		reviewer: asOptionalString(raw.reviewer),
		reviewDate: asOptionalString(raw.reviewDate),
	};
}

export interface NormalizedCompareColumn {
	key: string;
	title: string;
	textHtml: string;
	highlight: boolean;
}

export function normalizeCompare(node: unknown): { key: string; columns: NormalizedCompareColumn[] } {
	const raw = isRecord(node) ? node : {};
	return {
		key: asString(raw._key),
		columns: asRows(raw.columns)
			.map((row, index) => ({
				key: rowKey(row, index),
				title: asString(row.title),
				textHtml: richText(row.text),
				highlight: asBoolean(row.highlight),
			}))
			.filter((column) => column.title !== "" || column.textHtml !== ""),
	};
}

export interface NormalizedChecklist {
	key: string;
	title?: string;
	interactive: boolean;
	items: Array<{ key: string; text: string; checked: boolean }>;
}

export function normalizeChecklist(node: unknown): NormalizedChecklist {
	const raw = isRecord(node) ? node : {};
	return {
		key: asString(raw._key),
		title: asOptionalString(raw.title),
		interactive: asBoolean(raw.interactive),
		items: asRows(raw.items)
			.map((row, index) => ({
				key: rowKey(row, index),
				text: asString(row.text),
				checked: asBoolean(row.checked),
			}))
			.filter((item) => item.text !== ""),
	};
}

export interface NormalizedThreadPost {
	key: string;
	name: string;
	handle?: string;
	verified: boolean;
	text: string;
	time?: string;
	likes?: string | number;
	replies?: string | number;
	reposts?: string | number;
}

function asCount(value: unknown): string | number | undefined {
	if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : undefined;
	return asOptionalString(value);
}

/** Plain text with line endings normalized; leading/trailing blank lines removed. */
function asPlainText(value: unknown): string {
	if (typeof value !== "string") return asString(value);
	return value.replace(/\r\n?/g, "\n").replace(/^\s*\n|\n\s*$/g, "").trimEnd();
}

export function normalizeThread(node: unknown): { key: string; posts: NormalizedThreadPost[] } {
	const raw = isRecord(node) ? node : {};
	return {
		key: asString(raw._key),
		posts: asRows(raw.posts)
			.map((row, index) => {
				const handle = asString(row.handle).replace(/^@+/, "");
				const text = asPlainText(row.text);
				return {
					key: rowKey(row, index),
					name: asString(row.name),
					handle: handle ? `@${handle}` : undefined,
					verified: asBoolean(row.verified),
					text: text.trim() === "" ? "" : text,
					time: asOptionalString(row.time),
					likes: asCount(row.likes),
					replies: asCount(row.replies),
					reposts: asCount(row.reposts),
				};
			})
			.filter((post) => post.text !== "" || post.name !== ""),
	};
}

export function normalizeRelatedLinks(node: unknown): {
	key: string;
	title?: string;
	links: Array<{ key: string; title: string; href: string }>;
} {
	const raw = isRecord(node) ? node : {};
	const links: Array<{ key: string; title: string; href: string }> = [];
	asRows(raw.links).forEach((row, index) => {
		const href = safeUrl(row.url);
		const title = asString(row.title);
		if (href && title) links.push({ key: rowKey(row, index), title, href });
	});
	return { key: asString(raw._key), title: asOptionalString(raw.title), links };
}
