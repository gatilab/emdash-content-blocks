/**
 * Dependency-free HTML sanitizer for the rich-text fields of the content blocks.
 *
 * Renderers run on the server (including Cloudflare Workers, where there is no
 * DOM), so this is a small string tokenizer rather than a DOM walker. It never
 * passes input through: every tag it emits is rebuilt from an allowlist, every
 * attribute value is decoded, checked and re-escaped, and all text is escaped.
 *
 * Output allowlist:
 *   a[href|title|target|rel], strong, em, code, br, p, ul, ol[start], li, h3, h4
 *
 * `<b>` and `<i>` are rewritten to `<strong>` and `<em>`. Unknown tags are
 * unwrapped (their text is kept). Script-like elements are removed together
 * with their content. Comments, doctypes and processing instructions are
 * dropped. Event handlers, `style`, `class` and every other attribute are
 * dropped. Links are limited to http, https, mailto, tel and relative URLs.
 */

const ALLOWED_TAGS = new Set(["a", "strong", "em", "code", "br", "p", "ul", "ol", "li", "h3", "h4"]);

const TAG_ALIASES: Readonly<Record<string, string>> = { b: "strong", i: "em" };

const VOID_TAGS = new Set(["br"]);

/** Opening one of these closes an open paragraph, as an HTML parser would. */
const BLOCK_TAGS = new Set(["p", "ul", "ol", "h3", "h4"]);

const HEADING_TAGS = new Set(["h3", "h4"]);

const LIST_TAGS = new Set(["ul", "ol"]);

/** Elements removed together with everything inside them. */
const DROP_CONTENT_TAGS = new Set([
	"script",
	"style",
	"iframe",
	"frameset",
	"object",
	"applet",
	"noscript",
	"noembed",
	"noframes",
	"template",
	"textarea",
	"title",
	"xmp",
	"plaintext",
	"svg",
	"math",
	"select",
	"head",
]);

/** Tags that separate words when HTML is flattened to text. */
const TEXT_BREAK_TAGS = new Set([
	"br",
	"p",
	"div",
	"li",
	"ul",
	"ol",
	"dl",
	"dt",
	"dd",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"blockquote",
	"pre",
	"hr",
	"table",
	"tr",
	"td",
	"th",
	"section",
	"article",
	"header",
	"footer",
	"figure",
	"figcaption",
]);

const SAFE_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

const REL_TOKENS = new Set(["nofollow", "noopener", "noreferrer", "sponsored", "ugc", "external"]);

const DEFAULT_MAX_LENGTH = 100_000;

/** `<` or `</` followed by a tag name. */
const TAG_START_RE = /^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)/;

/**
 * Tags longer than this are treated as text. Real inline markup is far
 * shorter; the cap keeps scanning linear on hostile input.
 */
const MAX_TAG_LENGTH = 4096;

const ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const ENTITY_RE = /&(?:#(\d{1,7});?|#[xX]([0-9a-fA-F]{1,6});?|([a-zA-Z][a-zA-Z0-9]{1,31});)/g;

const BARE_AMPERSAND_RE = /&(?!(?:#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,31});)/g;

const BLOCK_MARKUP_RE = /<\/?(?:p|ul|ol|li|h[1-6]|div|blockquote|table|pre|section|figure|dl)\b/i;

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: "\u00a0",
	ndash: "\u2013",
	mdash: "\u2014",
	hellip: "\u2026",
	lsquo: "\u2018",
	rsquo: "\u2019",
	sbquo: "\u201a",
	ldquo: "\u201c",
	rdquo: "\u201d",
	bdquo: "\u201e",
	laquo: "\u00ab",
	raquo: "\u00bb",
	bull: "\u2022",
	middot: "\u00b7",
	copy: "\u00a9",
	reg: "\u00ae",
	trade: "\u2122",
	times: "\u00d7",
	divide: "\u00f7",
	deg: "\u00b0",
	euro: "\u20ac",
	pound: "\u00a3",
	yen: "\u00a5",
	cent: "\u00a2",
	rarr: "\u2192",
	larr: "\u2190",
	check: "\u2713",
	colon: ":",
	semi: ";",
	comma: ",",
	period: ".",
	excl: "!",
	quest: "?",
	num: "#",
	sol: "/",
	bsol: "\\",
	lpar: "(",
	rpar: ")",
	equals: "=",
	Tab: "\t",
	NewLine: "\n",
};

// ── escaping and decoding ────────────────────────────────────────────────────

/** Escape a string for use as HTML text or a double-quoted attribute value. */
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/** Escape text content while keeping existing character references intact. */
function escapeText(value: string): string {
	return value.replace(BARE_AMPERSAND_RE, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function codePointToString(codePoint: number): string {
	if (
		!Number.isFinite(codePoint) ||
		codePoint <= 0 ||
		codePoint > 0x10ffff ||
		(codePoint >= 0xd800 && codePoint <= 0xdfff)
	) {
		return "\ufffd";
	}
	return String.fromCodePoint(codePoint);
}

/**
 * Decode numeric character references and the common named entities.
 * Unknown named entities are left as written.
 */
export function decodeEntities(value: string): string {
	if (!value.includes("&")) return value;
	return value.replace(
		ENTITY_RE,
		(match, dec: string | undefined, hex: string | undefined, name: string | undefined) => {
			if (dec !== undefined) return codePointToString(Number.parseInt(dec, 10));
			if (hex !== undefined) return codePointToString(Number.parseInt(hex, 16));
			if (name !== undefined && Object.hasOwn(NAMED_ENTITIES, name)) {
				return NAMED_ENTITIES[name] ?? match;
			}
			return match;
		},
	);
}

// ── URLs and rel ─────────────────────────────────────────────────────────────

/**
 * Return a URL that is safe to place in `href` or `src`, or `undefined`.
 *
 * Allows http, https, mailto and tel URLs plus relative, root-relative,
 * protocol-relative, query and fragment URLs. Character references are decoded
 * before the scheme check, and control characters are removed, so obfuscated
 * `javascript:` and `data:` URLs are rejected.
 */
export function safeUrl(value: unknown): string | undefined {
	if (typeof value !== "string") return undefined;
	// eslint-disable-next-line no-control-regex
	const decoded = decodeEntities(value).replace(/[\u0000-\u001f\u007f]/g, "").trim();
	if (!decoded) return undefined;
	// Browsers ignore whitespace and control characters inside a scheme, so the
	// scheme check runs on a copy with all of them removed.
	// eslint-disable-next-line no-control-regex
	const compact = decoded.replace(/[\u0000-\u0020\u007f-\u009f\u200b-\u200d\u2028\u2029\ufeff]/g, "");
	const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(compact);
	if (scheme) {
		return SAFE_SCHEMES.has((scheme[1] ?? "").toLowerCase()) ? decoded : undefined;
	}
	// A colon before the first slash, `?` or `#` would be read as a scheme.
	const firstDelimiter = compact.search(/[/?#]/);
	const colon = compact.indexOf(":");
	if (colon !== -1 && (firstDelimiter === -1 || colon < firstDelimiter)) return undefined;
	return decoded;
}

/** True for absolute http(s) or protocol-relative URLs. */
export function isAbsoluteUrl(url: string): boolean {
	return /^(?:https?:)?\/\//i.test(url);
}

/**
 * Filter a `rel` value to known link types. When the link opens a new tab,
 * `noopener` is added. `noreferrer` is kept only when the author asked for it,
 * because it removes the Referer header that affiliate attribution relies on.
 */
export function safeRel(rel: unknown, newTab = false): string | undefined {
	const tokens = new Set<string>();
	if (typeof rel === "string") {
		for (const token of rel.toLowerCase().split(/[\s,]+/)) {
			if (REL_TOKENS.has(token)) tokens.add(token);
		}
	}
	if (newTab) tokens.add("noopener");
	return tokens.size > 0 ? [...tokens].join(" ") : undefined;
}

// ── tokenizer ────────────────────────────────────────────────────────────────

interface ScanHandlers {
	text(raw: string): void;
	tag(name: string, isEnd: boolean, attrs: string, selfClosing: boolean): void;
}

function prepare(input: unknown, maxLength: number): string {
	if (typeof input !== "string" || input.length === 0) return "";
	const trimmed = input.length > maxLength ? input.slice(0, maxLength) : input;
	return trimmed.replace(/\u0000/g, "");
}

/**
 * Index of the `>` that closes the tag opened at `start`, or -1.
 * Quotes only delimit attribute values (after `=`), as in the HTML tokenizer.
 */
function findTagEnd(html: string, start: number): number {
	const limit = Math.min(html.length, start + MAX_TAG_LENGTH);
	let quote = "";
	let afterEquals = false;
	for (let i = start + 1; i < limit; i++) {
		const ch = html[i];
		if (quote) {
			if (ch === quote) quote = "";
			continue;
		}
		if (ch === ">") return i;
		if (ch === "=") {
			afterEquals = true;
			continue;
		}
		if (afterEquals) {
			if (ch === '"' || ch === "'") {
				quote = ch;
				afterEquals = false;
			} else if (ch !== " " && ch !== "\t" && ch !== "\n" && ch !== "\r" && ch !== "\f") {
				afterEquals = false;
			}
		}
	}
	return -1;
}

function scan(html: string, handlers: ScanHandlers): void {
	const length = html.length;
	let index = 0;
	// Position of the next `>` at or after the current `<`, cached so that
	// runs of unclosed `<` stay linear.
	let nextGt = -1;
	while (index < length) {
		const lt = html.indexOf("<", index);
		if (lt === -1) {
			handlers.text(html.slice(index));
			return;
		}
		if (lt > index) handlers.text(html.slice(index, lt));

		if (html.startsWith("<!--", lt)) {
			const end = html.indexOf("-->", lt + 4);
			index = end === -1 ? length : end + 3;
			continue;
		}
		const next = html[lt + 1];
		if (next === "!" || next === "?") {
			const end = html.indexOf(">", lt + 2);
			index = end === -1 ? length : end + 1;
			continue;
		}

		if (nextGt !== -1 && nextGt < lt) nextGt = -1;
		if (nextGt === -1) nextGt = html.indexOf(">", lt);
		if (nextGt === -1) {
			// No tag can close: the rest is text.
			handlers.text(html.slice(lt));
			return;
		}
		if (nextGt - lt > MAX_TAG_LENGTH) {
			handlers.text("<");
			index = lt + 1;
			continue;
		}

		const end = findTagEnd(html, lt);
		const match = end === -1 ? null : TAG_START_RE.exec(html.slice(lt, Math.min(end, lt + 64)));
		if (!match) {
			handlers.text("<");
			index = lt + 1;
			continue;
		}
		index = end + 1;

		const isEnd = match[1] === "/";
		const name = (match[2] ?? "").toLowerCase();
		const attrs = html.slice(lt + match[0].length, end);
		const selfClosing = /\/\s*$/.test(attrs);

		if (!isEnd && DROP_CONTENT_TAGS.has(name)) {
			if (selfClosing) continue;
			const close = new RegExp(`</${name}(?=[\\s/>])[^>]*>`, "gi");
			close.lastIndex = index;
			const closeMatch = close.exec(html);
			index = closeMatch ? closeMatch.index + closeMatch[0].length : length;
			continue;
		}
		if (isEnd && DROP_CONTENT_TAGS.has(name)) continue;

		handlers.tag(name, isEnd, attrs, selfClosing);
	}
}

function parseAttributes(attrs: string): Map<string, string> {
	const result = new Map<string, string>();
	for (const match of attrs.matchAll(ATTR_RE)) {
		const name = (match[1] ?? "").toLowerCase();
		// Browsers keep the first occurrence of a repeated attribute.
		if (!name || result.has(name)) continue;
		result.set(name, decodeEntities(match[2] ?? match[3] ?? match[4] ?? ""));
	}
	return result;
}

function anchorAttributes(attrs: string): string {
	const parsed = parseAttributes(attrs);
	const parts: string[] = [];
	const href = safeUrl(parsed.get("href"));
	if (href) parts.push(`href="${escapeHtml(href)}"`);
	const title = parsed.get("title")?.trim();
	if (title) parts.push(`title="${escapeHtml(title)}"`);
	const newTab = parsed.get("target")?.trim().toLowerCase() === "_blank";
	if (newTab) parts.push('target="_blank"');
	const rel = safeRel(parsed.get("rel"), newTab);
	if (rel) parts.push(`rel="${rel}"`);
	return parts.length > 0 ? ` ${parts.join(" ")}` : "";
}

function orderedListAttributes(attrs: string): string {
	const start = parseAttributes(attrs).get("start")?.trim();
	return start && /^-?\d{1,6}$/.test(start) ? ` start="${start}"` : "";
}

// ── public API ───────────────────────────────────────────────────────────────

export interface SanitizeOptions {
	/** Input longer than this is truncated before parsing. Default 100,000 characters. */
	maxLength?: number;
}

/**
 * Sanitize an HTML fragment to the inline/basic-block allowlist.
 * The result is well formed: every emitted tag is closed.
 */
export function sanitizeHtml(input: unknown, options: SanitizeOptions = {}): string {
	const html = prepare(input, options.maxLength ?? DEFAULT_MAX_LENGTH);
	if (!html) return "";

	const out: string[] = [];
	const stack: string[] = [];

	const closeUntil = (tag: string): void => {
		while (stack.length > 0) {
			const open = stack.pop() as string;
			out.push(`</${open}>`);
			if (open === tag) return;
		}
	};
	const top = (): string | undefined => stack[stack.length - 1];

	scan(html, {
		text(raw) {
			out.push(escapeText(raw));
		},
		tag(rawName, isEnd, attrs, selfClosing) {
			const tag = TAG_ALIASES[rawName] ?? rawName;
			if (!ALLOWED_TAGS.has(tag)) return;

			if (isEnd) {
				if (!VOID_TAGS.has(tag) && stack.includes(tag)) closeUntil(tag);
				return;
			}
			if (VOID_TAGS.has(tag)) {
				out.push(`<${tag}>`);
				return;
			}

			if (BLOCK_TAGS.has(tag) && stack.includes("p")) closeUntil("p");
			if (HEADING_TAGS.has(tag) && HEADING_TAGS.has(top() ?? "")) closeUntil(top() as string);
			if (tag === "a" && stack.includes("a")) closeUntil("a");
			if (tag === "li") {
				// Close an open item that belongs to the current list.
				for (let i = stack.length - 1; i >= 0; i--) {
					const open = stack[i] as string;
					if (LIST_TAGS.has(open)) break;
					if (open === "li") {
						closeUntil("li");
						break;
					}
				}
			}

			let attributes = "";
			if (tag === "a") attributes = anchorAttributes(attrs);
			else if (tag === "ol") attributes = orderedListAttributes(attrs);

			out.push(`<${tag}${attributes}>`);
			if (selfClosing) out.push(`</${tag}>`);
			else stack.push(tag);
		},
	});

	while (stack.length > 0) out.push(`</${stack.pop() as string}>`);
	return out.join("");
}

/**
 * Flatten HTML to plain text: removes tags (and the content of script-like
 * elements), decodes character references and collapses whitespace. Used for
 * JSON-LD values and accessible names.
 */
export function htmlToText(input: unknown, options: SanitizeOptions = {}): string {
	const html = prepare(input, options.maxLength ?? DEFAULT_MAX_LENGTH);
	if (!html) return "";
	const parts: string[] = [];
	scan(html, {
		text(raw) {
			parts.push(raw);
		},
		tag(name) {
			if (TEXT_BREAK_TAGS.has(name)) parts.push(" ");
		},
	});
	return decodeEntities(parts.join(""))
		.replace(/[\s\u00a0]+/g, " ")
		.trim();
}

/** Alias of {@link htmlToText}. */
export const stripTags = htmlToText;

/** Convert plain text to paragraphs: blank lines split paragraphs, single newlines become `<br>`. */
export function textToHtml(input: unknown): string {
	if (typeof input !== "string") return "";
	const normalized = input.replace(/\r\n?/g, "\n").trim();
	if (!normalized) return "";
	return normalized
		.split(/\n[ \t]*\n+/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean)
		.map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
		.join("");
}

/**
 * Prepare a rich-text field for `set:html`.
 *
 * Content imported from WordPress often relies on `wpautop`, so a value with
 * no block-level markup is split into paragraphs on blank lines (single
 * newlines become `<br>`) before sanitizing. Values that already contain
 * block markup are sanitized as written.
 */
export function richText(input: unknown, options: SanitizeOptions = {}): string {
	if (typeof input !== "string") return "";
	const value = input.replace(/\r\n?/g, "\n").trim();
	if (!value) return "";
	if (BLOCK_MARKUP_RE.test(value)) return sanitizeHtml(value, options);
	const paragraphs = value
		.split(/\n[ \t]*\n+/)
		.map((paragraph) => paragraph.trim())
		.filter(Boolean)
		.map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`);
	return sanitizeHtml(paragraphs.join(""), options);
}
