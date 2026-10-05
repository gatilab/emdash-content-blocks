/**
 * Editor definitions (`admin.portableTextBlocks`) for every block.
 *
 * Each field's `action_id` is the property name stored on the block, so these
 * definitions are the editing half of the contract in SCHEMAS.md. A few notes
 * on how the EmDash editor treats them:
 *
 * - `repeater` sub-fields are limited to text, number, select and toggle
 *   inputs. The first text input is used as the collapsed row's summary, so
 *   each repeater lists its most identifying field first.
 * - `media_picker` stores the picked asset's URL string. Renderers accept the
 *   string or the stored `{ src, alt, width, height }` object.
 * - Ratings and prices use `number_input` without `min`/`max`: setting `min`
 *   makes browsers reject half steps such as 4.5 under the default `step`.
 * - Fields that are not declared here are preserved when a block is edited.
 */

import type { PortableTextBlockConfig, PortableTextBlockField } from "emdash";

import type { ContentBlockType } from "./types.js";
import { CONTENT_BLOCK_TYPES } from "./types.js";

export const DEFAULT_CATEGORY = "Content blocks";

const HTML_HINT = "HTML allowed: <a>, <strong>, <em>, <code>, <br>, <p>, <ul>, <ol>, <li>, <h3>, <h4>.";

type Field = PortableTextBlockField;
type RepeaterField = Extract<Field, { type: "repeater" }>;
type RepeaterSubField = RepeaterField["fields"][number];
type TextInput = Extract<Field, { type: "text_input" }>;
type ToggleInput = Extract<Field, { type: "toggle" }>;
type NumberInput = Extract<Field, { type: "number_input" }>;
type MediaPicker = Extract<Field, { type: "media_picker" }>;

const text = (actionId: string, label: string, placeholder?: string): TextInput => ({
	type: "text_input",
	action_id: actionId,
	label,
	...(placeholder !== undefined && { placeholder }),
});

const multiline = (actionId: string, label: string, placeholder?: string): TextInput => ({
	type: "text_input",
	action_id: actionId,
	label,
	multiline: true,
	...(placeholder !== undefined && { placeholder }),
});

const toggle = (actionId: string, label: string, initialValue?: boolean): ToggleInput => ({
	type: "toggle",
	action_id: actionId,
	label,
	...(initialValue !== undefined && { initial_value: initialValue }),
});

const number = (actionId: string, label: string): NumberInput => ({
	type: "number_input",
	action_id: actionId,
	label,
});

const repeater = (
	actionId: string,
	label: string,
	itemLabel: string,
	fields: RepeaterSubField[],
	limits: { min?: number; max?: number } = {},
): RepeaterField => ({
	type: "repeater",
	action_id: actionId,
	label,
	item_label: itemLabel,
	fields,
	...(limits.min !== undefined && { min_items: limits.min }),
	...(limits.max !== undefined && { max_items: limits.max }),
});

const image = (actionId: string, label: string): MediaPicker => ({
	type: "media_picker",
	action_id: actionId,
	label,
	mime_type_filter: "image/",
});

type BlockDefinition = Omit<PortableTextBlockConfig, "type" | "category">;

/** Editor metadata for each block type, keyed by `_type`. */
export const BLOCK_DEFINITIONS: Readonly<Record<ContentBlockType, BlockDefinition>> = {
	faq: {
		label: "FAQ",
		icon: "form",
		description: "Questions and answers in accordion panels, with optional FAQPage schema",
		fields: [
			text("title", "Title (optional)"),
			toggle("schema", "Output FAQPage structured data", true),
			repeater("items", "Questions", "question", [
				text("question", "Question"),
				multiline("answer", "Answer", HTML_HINT),
			]),
		],
	},
	callout: {
		label: "Callout",
		icon: "info",
		description: "Highlighted note, tip or warning with an optional button",
		fields: [
			{
				type: "select",
				action_id: "tone",
				label: "Tone",
				options: [
					{ value: "info", label: "Info" },
					{ value: "success", label: "Success" },
					{ value: "warning", label: "Warning" },
					{ value: "danger", label: "Danger" },
					{ value: "tip", label: "Tip" },
					{ value: "note", label: "Note" },
				],
				initial_value: "info",
			},
			text("label", "Label (optional)", "Defaults to the tone name"),
			multiline("body", "Body", HTML_HINT),
			text("ctaLabel", "Button label (optional)"),
			text("ctaUrl", "Button URL (optional)", "https://"),
		],
	},
	opinion: {
		label: "Expert opinion",
		icon: "quote",
		description: "Quote box with the expert's name, role and photo",
		fields: [
			text("name", "Name"),
			text("role", "Role or title"),
			image("avatar", "Photo"),
			multiline("body", "Opinion", HTML_HINT),
		],
	},
	stats: {
		label: "Stats",
		icon: "chart",
		description: "Row of headline numbers with labels",
		fields: [
			repeater("items", "Stats", "stat", [
				text("label", "Label", "Projects delivered"),
				text("value", "Value", "1,200"),
				text("prefix", "Prefix (optional)", "$"),
				text("suffix", "Suffix (optional)", "+"),
				text("icon", "Emoji (optional)"),
			]),
		],
	},
	productReview: {
		label: "Product review",
		icon: "star",
		description: "Review box with rating, feature scores, pros and cons, price and schema",
		fields: [
			text("name", "Product name"),
			text("brand", "Brand (optional)"),
			image("image", "Product image"),
			number("rating", "Overall rating (0 to 5, half steps)"),
			multiline("summary", "Summary"),
			repeater("features", "Feature ratings", "feature", [
				text("name", "Feature"),
				number("rating", "Rating (0 to 5, half steps)"),
			]),
			repeater("pros", "Pros", "pro", [text("text", "Pro")]),
			repeater("cons", "Cons", "con", [text("text", "Con")]),
			text("ctaLabel", "Button label", "Visit website"),
			text("ctaUrl", "Button URL", "https://"),
			text("ctaRel", "Button rel (optional)", "nofollow sponsored"),
			toggle("ctaNewTab", "Open button link in a new tab", false),
			number("price", "Price (optional)"),
			text("currency", "Currency code (optional)", "USD"),
			text("priceTerm", "Price term (optional)", "/month"),
			toggle("schema", "Output review structured data", true),
			{
				type: "select",
				action_id: "schemaType",
				label: "Structured data type",
				options: [
					{ value: "Product", label: "Product" },
					{ value: "SoftwareApplication", label: "Software application" },
				],
				initial_value: "Product",
			},
			text("appCategory", "Application category (software only)", "BusinessApplication"),
			text("operatingSystem", "Operating system (software only)", "Web, Windows, macOS"),
			text("sku", "SKU (product only, optional)"),
			text("reviewer", "Reviewer name"),
			text("reviewDate", "Review date", "YYYY-MM-DD"),
		],
	},
	prosCons: {
		label: "Pros and cons",
		icon: "form",
		description: "Two lists side by side: what works and what does not",
		fields: [
			repeater("pros", "Pros", "pro", [text("text", "Pro")]),
			repeater("cons", "Cons", "con", [text("text", "Con")]),
		],
	},
	compare: {
		label: "Comparison",
		icon: "columns",
		description: "Two to four options side by side, with one marked as recommended",
		fields: [
			repeater(
				"columns",
				"Columns",
				"column",
				[
					text("title", "Title"),
					multiline("text", "Text"),
					toggle("highlight", "Recommended", false),
				],
				{ max: 4 },
			),
		],
	},
	checklist: {
		label: "Checklist",
		icon: "form",
		description: "List of steps; optionally interactive with saved progress",
		fields: [
			text("title", "Title (optional)"),
			toggle("interactive", "Let readers tick items (progress is saved in their browser)", true),
			repeater("items", "Items", "item", [
				text("text", "Item"),
				toggle("checked", "Checked by default", false),
			]),
		],
	},
	thread: {
		label: "Social thread",
		icon: "chat",
		description: "Mock-up of a social media thread",
		fields: [
			repeater("posts", "Posts", "post", [
				text("name", "Display name"),
				text("handle", "Handle", "@handle"),
				toggle("verified", "Verified badge", false),
				multiline("text", "Post text (plain text; line breaks are kept)"),
				text("time", "Time", "2h"),
				text("replies", "Replies", "12"),
				text("reposts", "Reposts", "48"),
				text("likes", "Likes", "1.2K"),
			]),
		],
	},
	relatedLinks: {
		label: "Related links",
		icon: "link",
		description: "Short list of further reading",
		fields: [
			text("title", "Title (optional)", "Related reading"),
			repeater("links", "Links", "link", [text("title", "Link text"), text("url", "URL", "https://")]),
		],
	},
};

export interface BlockDefinitionOptions {
	/** Limit the slash menu to these block types. Defaults to all. */
	blocks?: readonly ContentBlockType[];
	/** Slash-menu category. Defaults to "Content blocks". */
	category?: string;
}

/** Build the `admin.portableTextBlocks` array for `definePlugin()`. */
export function getBlockDefinitions(options: BlockDefinitionOptions = {}): PortableTextBlockConfig[] {
	const enabled = new Set<string>(options.blocks ?? CONTENT_BLOCK_TYPES);
	const category = options.category?.trim() || DEFAULT_CATEGORY;
	return CONTENT_BLOCK_TYPES.filter((type) => enabled.has(type)).map((type) => ({
		type,
		category,
		...BLOCK_DEFINITIONS[type],
	}));
}
