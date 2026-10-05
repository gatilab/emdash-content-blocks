/**
 * @gatilab/emdash-content-blocks
 *
 * Native EmDash plugin that adds ten editorial Portable Text blocks: FAQ,
 * callout, expert opinion, stats, product review, pros and cons, comparison,
 * checklist, social thread and related links.
 *
 * The plugin needs no capabilities. It contributes editor definitions through
 * `admin.portableTextBlocks` and Astro renderers through `componentsEntry`,
 * which is why it uses the native format.
 *
 * @example
 * ```js
 * // astro.config.mjs
 * import emdash from "emdash/astro";
 * import { contentBlocks } from "@gatilab/emdash-content-blocks";
 *
 * export default defineConfig({
 *   integrations: [emdash({ plugins: [contentBlocks()] })],
 * });
 * ```
 */

import { definePlugin } from "emdash";
import type { PluginDescriptor, ResolvedPlugin } from "emdash";

import { getBlockDefinitions } from "./blocks.js";
import type { BlockDefinitionOptions } from "./blocks.js";

export const PLUGIN_ID = "gt-content-blocks";
export const PLUGIN_VERSION = "0.1.0";
export const PACKAGE_NAME = "@gatilab/emdash-content-blocks";

/** Options accepted by {@link contentBlocks} and passed through to {@link createPlugin}. */
export type ContentBlocksOptions = BlockDefinitionOptions;

/**
 * Descriptor factory for `astro.config.mjs`.
 *
 * `blocks` only limits what editors can insert from the slash menu. Renderers
 * for every block type stay registered, so existing content keeps rendering.
 */
export function contentBlocks(
	options: ContentBlocksOptions = {},
): PluginDescriptor<ContentBlocksOptions> {
	return {
		id: PLUGIN_ID,
		version: PLUGIN_VERSION,
		format: "native",
		entrypoint: PACKAGE_NAME,
		componentsEntry: `${PACKAGE_NAME}/astro`,
		options,
	};
}

/** Runtime entry. EmDash imports this by name and passes the descriptor's options. */
export function createPlugin(options: ContentBlocksOptions = {}): ResolvedPlugin {
	return definePlugin({
		id: PLUGIN_ID,
		version: PLUGIN_VERSION,
		capabilities: [],
		admin: {
			portableTextBlocks: getBlockDefinitions(options),
		},
	});
}

export default createPlugin;

export { BLOCK_DEFINITIONS, DEFAULT_CATEGORY, getBlockDefinitions } from "./blocks.js";
export type { BlockDefinitionOptions } from "./blocks.js";
export * from "./types.js";
export {
	decodeEntities,
	escapeHtml,
	htmlToText,
	isAbsoluteUrl,
	richText,
	safeRel,
	safeUrl,
	sanitizeHtml,
	stripTags,
	textToHtml,
} from "./sanitize.js";
export type { SanitizeOptions } from "./sanitize.js";
export {
	absoluteUrl,
	buildFaqJsonLd,
	buildProductReviewJsonLd,
	serializeJsonLd,
} from "./schema.js";
export type { JsonLd, JsonLdValue, ReviewJsonLdOptions } from "./schema.js";
export { BLOCK_SCHEMAS, isContentBlock, isContentBlockType, validateBlock } from "./validate.js";
export type { BlockSchema, FieldRule, ValidationIssue, ValidationResult } from "./validate.js";
export {
	asBoolean,
	asNumber,
	asOptionalString,
	asRows,
	asString,
	normalizeCallout,
	normalizeChecklist,
	normalizeCompare,
	normalizeFaq,
	normalizeImage,
	normalizeOpinion,
	normalizeProductReview,
	normalizeProsCons,
	normalizeRating,
	normalizeRelatedLinks,
	normalizeStats,
	normalizeThread,
	normalizeTone,
} from "./normalize.js";
export type {
	NormalizedCallout,
	NormalizedChecklist,
	NormalizedFaq,
	NormalizedImage,
	NormalizedOpinion,
	NormalizedProductReview,
} from "./normalize.js";
