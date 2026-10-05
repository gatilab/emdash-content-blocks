/**
 * Stored shapes of the Portable Text blocks this package provides.
 *
 * These interfaces describe the data as it is saved in Portable Text. They are
 * the public contract documented in SCHEMAS.md. Renderers never trust them
 * blindly: every component runs the node through the matching `normalize*`
 * helper first, so malformed or partially edited content still renders.
 *
 * Two editor behaviors are reflected in the types:
 *
 * - The EmDash repeater widget strips `_key` from rows when it saves, so row
 *   `_key` is optional even though imported content always carries one.
 * - The `media_picker` field stores a plain URL string when an image is
 *   picked in the editor, so image fields accept `ImageValue | string`.
 */

/** Fields every Portable Text block carries. */
export interface BlockBase<TType extends string> {
	_type: TType;
	_key: string;
}

/** Fields every row inside a block array carries. */
export interface RowBase {
	/** Present on imported content; the editor's repeater drops it on save. */
	_key?: string;
}

/** Image reference used by `opinion.avatar` and `productReview.image`. */
export interface ImageValue {
	/** Media library ID. Informational only; renderers use `src`. */
	id?: string;
	src?: string;
	alt?: string;
	width?: number;
	height?: number;
}

/** An image as stored: the object shape, or a bare URL written by the media picker. */
export type ImageInput = ImageValue | string;

/** A row holding a single line of text (pros, cons). */
export interface TextRow extends RowBase {
	text: string;
}

// ── faq ──────────────────────────────────────────────────────────────────────

export interface FaqItem extends RowBase {
	question: string;
	/** HTML string, sanitized before rendering. */
	answer: string;
}

export interface FaqBlock extends BlockBase<"faq"> {
	title?: string;
	/** Emit FAQPage JSON-LD. */
	schema: boolean;
	items: FaqItem[];
}

// ── callout ──────────────────────────────────────────────────────────────────

export const CALLOUT_TONES = ["info", "success", "warning", "danger", "tip", "note"] as const;
export type CalloutTone = (typeof CALLOUT_TONES)[number];

export interface CalloutBlock extends BlockBase<"callout"> {
	label?: string;
	/** Unknown values render as `info`. */
	tone: CalloutTone;
	/** HTML string, sanitized before rendering. */
	body: string;
	ctaLabel?: string;
	ctaUrl?: string;
}

// ── opinion ──────────────────────────────────────────────────────────────────

export interface OpinionBlock extends BlockBase<"opinion"> {
	name?: string;
	role?: string;
	avatar?: ImageInput;
	/** HTML string, sanitized before rendering. */
	body: string;
}

// ── stats ────────────────────────────────────────────────────────────────────

export interface StatItem extends RowBase {
	value: string;
	label: string;
	prefix?: string;
	suffix?: string;
	/** An emoji, or empty. */
	icon?: string;
}

export interface StatsBlock extends BlockBase<"stats"> {
	items: StatItem[];
}

// ── productReview ────────────────────────────────────────────────────────────

export interface ReviewFeature extends RowBase {
	name: string;
	/** 0 to 5 in half steps. */
	rating?: number;
}

export const REVIEW_SCHEMA_TYPES = ["Product", "SoftwareApplication"] as const;
export type ReviewSchemaType = (typeof REVIEW_SCHEMA_TYPES)[number];

export interface ProductReviewBlock extends BlockBase<"productReview"> {
	name: string;
	brand?: string;
	image?: ImageInput;
	/** 0 to 5 in half steps. */
	rating?: number;
	summary?: string;
	features: ReviewFeature[];
	pros: TextRow[];
	cons: TextRow[];
	ctaLabel?: string;
	ctaUrl?: string;
	/** Space-separated rel tokens, e.g. "nofollow sponsored". */
	ctaRel?: string;
	ctaNewTab?: boolean;
	price?: number;
	/** ISO 4217 code such as "USD". */
	currency?: string;
	/** Billing term shown after the price, e.g. "/month". */
	priceTerm?: string;
	/** Emit Product or SoftwareApplication JSON-LD. */
	schema: boolean;
	schemaType?: ReviewSchemaType;
	appCategory?: string;
	operatingSystem?: string;
	sku?: string;
	reviewer?: string;
	/** ISO date (YYYY-MM-DD) or any date string `Date` can parse. */
	reviewDate?: string;
}

// ── prosCons ─────────────────────────────────────────────────────────────────

export interface ProsConsBlock extends BlockBase<"prosCons"> {
	pros: TextRow[];
	cons: TextRow[];
}

// ── compare ──────────────────────────────────────────────────────────────────

export interface CompareColumn extends RowBase {
	title: string;
	text: string;
	/** The recommended column. */
	highlight: boolean;
}

export interface CompareBlock extends BlockBase<"compare"> {
	/** Two to four columns. */
	columns: CompareColumn[];
}

// ── checklist ────────────────────────────────────────────────────────────────

export interface ChecklistItem extends RowBase {
	text: string;
	checked: boolean;
}

export interface ChecklistBlock extends BlockBase<"checklist"> {
	title?: string;
	/** Real checkboxes with a progress count, remembered in localStorage. */
	interactive: boolean;
	items: ChecklistItem[];
}

// ── thread ───────────────────────────────────────────────────────────────────

export interface ThreadPost extends RowBase {
	name: string;
	handle: string;
	verified: boolean;
	/** Plain text. Newlines are significant. */
	text: string;
	time: string;
	likes: string | number;
	replies: string | number;
	reposts: string | number;
}

export interface ThreadBlock extends BlockBase<"thread"> {
	posts: ThreadPost[];
}

// ── relatedLinks ─────────────────────────────────────────────────────────────

export interface RelatedLink extends RowBase {
	title: string;
	url: string;
}

export interface RelatedLinksBlock extends BlockBase<"relatedLinks"> {
	title?: string;
	links: RelatedLink[];
}

// ── union ────────────────────────────────────────────────────────────────────

export type ContentBlock =
	| FaqBlock
	| CalloutBlock
	| OpinionBlock
	| StatsBlock
	| ProductReviewBlock
	| ProsConsBlock
	| CompareBlock
	| ChecklistBlock
	| ThreadBlock
	| RelatedLinksBlock;

export type ContentBlockType = ContentBlock["_type"];

/** Every block type this package renders, in slash-menu order. */
export const CONTENT_BLOCK_TYPES = [
	"faq",
	"callout",
	"opinion",
	"stats",
	"productReview",
	"prosCons",
	"compare",
	"checklist",
	"thread",
	"relatedLinks",
] as const satisfies readonly ContentBlockType[];
