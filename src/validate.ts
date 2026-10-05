/**
 * Schema validation for stored block data.
 *
 * `validateBlock()` checks a Portable Text node against the documented shapes
 * in SCHEMAS.md without any WordPress/ACF dependency. Use it in import scripts
 * and seed checks to catch malformed content before it is published.
 * Renderers do not need it: they normalize defensively and render what they can.
 *
 * Errors mean the node does not match the schema. Warnings flag values that
 * render, but probably not the way the author intended (an unknown tone,
 * a rating that is not a half step, a row without `_key`, and so on).
 */

import { isRecord } from "./normalize.js";
import { safeUrl } from "./sanitize.js";
import { CALLOUT_TONES, CONTENT_BLOCK_TYPES, REVIEW_SCHEMA_TYPES } from "./types.js";
import type { ContentBlock, ContentBlockType } from "./types.js";

export type FieldRule =
	| { kind: "string"; required?: boolean; html?: boolean }
	| { kind: "url"; required?: boolean }
	| { kind: "date"; required?: boolean }
	| { kind: "boolean"; required?: boolean }
	| { kind: "number"; required?: boolean; min?: number; max?: number; halfSteps?: boolean }
	| { kind: "enum"; required?: boolean; values: readonly string[]; fallback?: string }
	| { kind: "count"; required?: boolean }
	| { kind: "image"; required?: boolean }
	| {
			kind: "rows";
			required?: boolean;
			fields: Readonly<Record<string, FieldRule>>;
			minItems?: number;
			maxItems?: number;
	  };

export type BlockSchema = Readonly<Record<string, FieldRule>>;

const str = (required = false): FieldRule => ({ kind: "string", required });
const html = (): FieldRule => ({ kind: "string", required: true, html: true });
const bool = (required = true): FieldRule => ({ kind: "boolean", required });
const rating = (): FieldRule => ({ kind: "number", min: 0, max: 5, halfSteps: true });
const textRows = (): FieldRule => ({ kind: "rows", required: true, fields: { text: str(true) } });

/** Field rules for every block type, mirroring SCHEMAS.md. */
export const BLOCK_SCHEMAS: Readonly<Record<ContentBlockType, BlockSchema>> = {
	faq: {
		title: str(),
		schema: bool(),
		items: {
			kind: "rows",
			required: true,
			fields: { question: str(true), answer: html() },
		},
	},
	callout: {
		label: str(),
		tone: { kind: "enum", required: true, values: CALLOUT_TONES, fallback: "info" },
		body: html(),
		ctaLabel: str(),
		ctaUrl: { kind: "url" },
	},
	opinion: {
		name: str(),
		role: str(),
		avatar: { kind: "image" },
		body: html(),
	},
	stats: {
		items: {
			kind: "rows",
			required: true,
			fields: {
				value: str(true),
				label: str(true),
				prefix: str(),
				suffix: str(),
				icon: str(),
			},
		},
	},
	productReview: {
		name: str(true),
		brand: str(),
		image: { kind: "image" },
		rating: rating(),
		summary: str(),
		features: {
			kind: "rows",
			required: true,
			fields: { name: str(true), rating: rating() },
		},
		pros: textRows(),
		cons: textRows(),
		ctaLabel: str(),
		ctaUrl: { kind: "url" },
		ctaRel: str(),
		ctaNewTab: bool(false),
		price: { kind: "number", min: 0 },
		currency: str(),
		priceTerm: str(),
		schema: bool(),
		schemaType: { kind: "enum", values: REVIEW_SCHEMA_TYPES },
		appCategory: str(),
		operatingSystem: str(),
		sku: str(),
		reviewer: str(),
		reviewDate: { kind: "date" },
	},
	prosCons: {
		pros: textRows(),
		cons: textRows(),
	},
	compare: {
		columns: {
			kind: "rows",
			required: true,
			minItems: 2,
			maxItems: 4,
			fields: { title: str(true), text: str(true), highlight: bool() },
		},
	},
	checklist: {
		title: str(),
		interactive: bool(),
		items: {
			kind: "rows",
			required: true,
			fields: { text: str(true), checked: bool() },
		},
	},
	thread: {
		posts: {
			kind: "rows",
			required: true,
			fields: {
				name: str(true),
				handle: str(true),
				verified: bool(),
				text: str(true),
				time: str(true),
				likes: { kind: "count", required: true },
				replies: { kind: "count", required: true },
				reposts: { kind: "count", required: true },
			},
		},
	},
	relatedLinks: {
		title: str(),
		links: {
			kind: "rows",
			required: true,
			fields: { title: str(true), url: { kind: "url", required: true } },
		},
	},
};

export interface ValidationIssue {
	/** Dotted path to the offending value, e.g. `items[2].question`. */
	path: string;
	message: string;
	severity: "error" | "warning";
}

export interface ValidationResult {
	valid: boolean;
	type?: ContentBlockType;
	errors: ValidationIssue[];
	warnings: ValidationIssue[];
}

export function isContentBlockType(value: unknown): value is ContentBlockType {
	return typeof value === "string" && (CONTENT_BLOCK_TYPES as readonly string[]).includes(value);
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;

function describe(value: unknown): string {
	if (value === null) return "null";
	if (Array.isArray(value)) return "array";
	return typeof value;
}

function checkField(
	rule: FieldRule,
	value: unknown,
	path: string,
	issues: ValidationIssue[],
): void {
	const error = (message: string): void => {
		issues.push({ path, message, severity: "error" });
	};
	const warn = (message: string): void => {
		issues.push({ path, message, severity: "warning" });
	};

	if (value === undefined || value === null) {
		if (rule.required) error("is required");
		return;
	}

	switch (rule.kind) {
		case "string":
			if (typeof value !== "string") error(`must be a string (got ${describe(value)})`);
			return;
		case "url":
			if (typeof value !== "string") {
				error(`must be a URL string (got ${describe(value)})`);
			} else if (value.trim() !== "" && !safeUrl(value)) {
				error("must be an http(s), mailto, tel or relative URL");
			} else if (rule.required && value.trim() === "") {
				error("is required");
			}
			return;
		case "date":
			if (typeof value !== "string") {
				error(`must be a date string (got ${describe(value)})`);
			} else if (value.trim() !== "" && !ISO_DATE_RE.test(value.trim())) {
				warn("should be an ISO date such as 2026-01-31");
			}
			return;
		case "boolean":
			if (typeof value !== "boolean") error(`must be a boolean (got ${describe(value)})`);
			return;
		case "number":
			if (typeof value !== "number" || !Number.isFinite(value)) {
				error(`must be a number (got ${describe(value)})`);
				return;
			}
			if (rule.min !== undefined && value < rule.min) error(`must be at least ${rule.min}`);
			if (rule.max !== undefined && value > rule.max) error(`must be at most ${rule.max}`);
			if (rule.halfSteps && !Number.isInteger(value * 2)) {
				warn("is rounded to the nearest half when rendered");
			}
			return;
		case "enum":
			if (typeof value !== "string" || !rule.values.includes(value)) {
				const message = `must be one of ${rule.values.join(", ")}`;
				if (rule.fallback && typeof value === "string") warn(`${message}; renders as "${rule.fallback}"`);
				else error(message);
			}
			return;
		case "count":
			if (typeof value !== "string" && (typeof value !== "number" || !Number.isFinite(value))) {
				error(`must be a string or number (got ${describe(value)})`);
			}
			return;
		case "image":
			if (typeof value === "string") {
				if (value.trim() !== "" && !safeUrl(value)) error("must be a safe image URL");
				return;
			}
			if (!isRecord(value)) {
				error(`must be an image object or URL string (got ${describe(value)})`);
				return;
			}
			for (const key of ["id", "src", "alt"] as const) {
				if (value[key] !== undefined && typeof value[key] !== "string") {
					issues.push({ path: `${path}.${key}`, message: "must be a string", severity: "error" });
				}
			}
			for (const key of ["width", "height"] as const) {
				const dimension = value[key];
				if (dimension !== undefined && (typeof dimension !== "number" || !Number.isFinite(dimension))) {
					issues.push({ path: `${path}.${key}`, message: "must be a number", severity: "error" });
				}
			}
			if (typeof value.src === "string" && value.src.trim() !== "" && !safeUrl(value.src)) {
				issues.push({ path: `${path}.src`, message: "must be a safe image URL", severity: "error" });
			}
			if (value.src === undefined || (typeof value.src === "string" && value.src.trim() === "")) {
				warn("has no src and will not render");
			}
			return;
		case "rows": {
			if (!Array.isArray(value)) {
				error(`must be an array (got ${describe(value)})`);
				return;
			}
			if (rule.minItems !== undefined && value.length < rule.minItems) {
				warn(`should have at least ${rule.minItems} items`);
			}
			if (rule.maxItems !== undefined && value.length > rule.maxItems) {
				warn(`should have at most ${rule.maxItems} items`);
			}
			value.forEach((row: unknown, index) => {
				const rowPath = `${path}[${index}]`;
				if (!isRecord(row)) {
					issues.push({ path: rowPath, message: "must be an object", severity: "error" });
					return;
				}
				if (typeof row._key !== "string" || row._key === "") {
					issues.push({ path: `${rowPath}._key`, message: "is missing", severity: "warning" });
				}
				for (const [field, fieldRule] of Object.entries(rule.fields)) {
					checkField(fieldRule, row[field], `${rowPath}.${field}`, issues);
				}
			});
			return;
		}
	}
}

/** Validate one stored block against its schema. */
export function validateBlock(node: unknown): ValidationResult {
	const issues: ValidationIssue[] = [];
	if (!isRecord(node)) {
		issues.push({ path: "", message: `must be an object (got ${describe(node)})`, severity: "error" });
		return { valid: false, errors: issues, warnings: [] };
	}
	if (!isContentBlockType(node._type)) {
		issues.push({
			path: "_type",
			message: `must be one of ${CONTENT_BLOCK_TYPES.join(", ")}`,
			severity: "error",
		});
		return { valid: false, errors: issues, warnings: [] };
	}
	const type = node._type;
	if (typeof node._key !== "string" || node._key === "") {
		issues.push({ path: "_key", message: "is required", severity: "error" });
	}
	for (const [field, rule] of Object.entries(BLOCK_SCHEMAS[type])) {
		checkField(rule, node[field], field, issues);
	}
	const errors = issues.filter((issue) => issue.severity === "error");
	const warnings = issues.filter((issue) => issue.severity === "warning");
	return { valid: errors.length === 0, type, errors, warnings };
}

/** Type guard: true when the node passes {@link validateBlock} without errors. */
export function isContentBlock(node: unknown): node is ContentBlock {
	return validateBlock(node).valid;
}
