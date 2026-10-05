import { describe, expect, it } from "vitest";

import {
	asBoolean,
	asNumber,
	normalizeCallout,
	normalizeChecklist,
	normalizeCompare,
	normalizeImage,
	normalizeOpinion,
	normalizeProductReview,
	normalizeRating,
	normalizeRelatedLinks,
	normalizeStats,
	normalizeThread,
	normalizeTone,
} from "../src/normalize.js";
import { CONTENT_BLOCK_TYPES } from "../src/types.js";
import { BLOCK_SCHEMAS, isContentBlock, validateBlock } from "../src/validate.js";
import * as fixtures from "./fixtures.js";

describe("validateBlock", () => {
	it("accepts every fixture without errors", () => {
		for (const block of fixtures.allBlocks) {
			const result = validateBlock(block);
			expect(result.errors, block._type).toEqual([]);
			expect(result.valid).toBe(true);
			expect(isContentBlock(block)).toBe(true);
		}
	});

	it("has a schema for every block type", () => {
		expect(Object.keys(BLOCK_SCHEMAS).sort()).toEqual([...CONTENT_BLOCK_TYPES].sort());
	});

	it("rejects non-objects and unknown types", () => {
		expect(validateBlock(null).valid).toBe(false);
		expect(validateBlock([]).valid).toBe(false);
		const unknown = validateBlock({ _type: "hero", _key: "h" });
		expect(unknown.valid).toBe(false);
		expect(unknown.errors[0]?.path).toBe("_type");
	});

	it("requires _key and required fields", () => {
		const result = validateBlock({ _type: "faq", items: [{ question: "Q" }] });
		const paths = result.errors.map((issue) => issue.path);
		expect(paths).toEqual(expect.arrayContaining(["_key", "schema", "items[0].answer"]));
		expect(result.warnings.map((issue) => issue.path)).toContain("items[0]._key");
	});

	it("reports wrong types with their paths", () => {
		const result = validateBlock({
			...fixtures.checklist,
			interactive: "yes",
			items: [{ _key: "a", text: 5, checked: "true" }],
		});
		expect(result.errors).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ path: "interactive", message: "must be a boolean (got string)" }),
				expect.objectContaining({ path: "items[0].text" }),
				expect.objectContaining({ path: "items[0].checked" }),
			]),
		);
	});

	it("warns, rather than fails, on an unknown callout tone", () => {
		const result = validateBlock({ ...fixtures.callout, tone: "fancy" });
		expect(result.valid).toBe(true);
		expect(result.warnings[0]?.message).toContain('renders as "info"');
	});

	it("checks rating ranges and half steps", () => {
		const tooHigh = validateBlock({ ...fixtures.productReview, rating: 6 });
		expect(tooHigh.errors[0]).toMatchObject({ path: "rating", message: "must be at most 5" });
		const oddStep = validateBlock({
			...fixtures.productReview,
			features: [{ _key: "f", name: "Speed", rating: 4.3 }],
		});
		expect(oddStep.valid).toBe(true);
		expect(oddStep.warnings[0]?.path).toBe("features[0].rating");
	});

	it("rejects unsafe URLs", () => {
		const result = validateBlock(fixtures.relatedLinks);
		expect(result.valid).toBe(true);
		const bad = validateBlock({
			...fixtures.relatedLinks,
			links: [{ _key: "x", title: "X", url: "javascript:alert(1)" }],
		});
		expect(bad.valid).toBe(false);
		expect(bad.errors[0]?.path).toBe("links[0].url");
	});

	it("accepts the media-picker URL string for images", () => {
		expect(validateBlock({ ...fixtures.opinion, avatar: "/_emdash/api/media/file/a.jpg" }).valid).toBe(true);
		expect(validateBlock({ ...fixtures.opinion, avatar: 12 }).valid).toBe(false);
		expect(validateBlock({ ...fixtures.opinion, avatar: { src: "data:image/png;base64,AA" } }).valid).toBe(false);
	});

	it("warns when compare has fewer than two or more than four columns", () => {
		const one = validateBlock({ ...fixtures.compare, columns: fixtures.compare.columns.slice(0, 1) });
		expect(one.warnings[0]?.message).toBe("should have at least 2 items");
	});

	it("accepts string or number engagement counts on thread posts", () => {
		expect(validateBlock(fixtures.thread).valid).toBe(true);
		const bad = validateBlock({
			...fixtures.thread,
			posts: [{ ...fixtures.thread.posts[0], likes: { n: 1 } }],
		});
		expect(bad.errors[0]?.path).toBe("posts[0].likes");
	});

	it("warns on non-ISO review dates", () => {
		const result = validateBlock({ ...fixtures.productReview, reviewDate: "Sept 30" });
		expect(result.warnings.map((issue) => issue.path)).toContain("reviewDate");
	});
});

describe("coercion helpers", () => {
	it("coerces booleans", () => {
		expect([true, 1, "1", "true", "yes", "on"].map((v) => asBoolean(v))).toEqual(Array(6).fill(true));
		expect([false, 0, "0", "false", "no", "off", ""].map((v) => asBoolean(v, true))).toEqual(Array(7).fill(false));
		expect(asBoolean("maybe", true)).toBe(true);
		expect(asBoolean(undefined)).toBe(false);
	});

	it("coerces numbers", () => {
		expect(asNumber(4.5)).toBe(4.5);
		expect(asNumber(" 1,299.50 ")).toBe(1299.5);
		expect(asNumber("abc")).toBeUndefined();
		expect(asNumber(Number.NaN)).toBeUndefined();
		expect(asNumber("")).toBeUndefined();
	});

	it("normalizes ratings to half steps within 0..5", () => {
		expect(normalizeRating(4.74)).toBe(4.5);
		expect(normalizeRating(4.76)).toBe(5);
		expect(normalizeRating(-2)).toBe(0);
		expect(normalizeRating("3.5")).toBe(3.5);
		expect(normalizeRating(null)).toBeUndefined();
	});

	it("maps unknown tones to info", () => {
		expect(normalizeTone("TIP")).toBe("tip");
		expect(normalizeTone("purple")).toBe("info");
		expect(normalizeTone(undefined)).toBe("info");
	});

	it("normalizes images from objects and strings", () => {
		expect(normalizeImage({ src: "/a.jpg", alt: "", width: "96", height: 96.4 }, "Fallback")).toEqual({
			src: "/a.jpg",
			alt: "Fallback",
			width: 96,
			height: 96,
		});
		expect(normalizeImage("/b.jpg", "Alt")).toEqual({ src: "/b.jpg", alt: "Alt" });
		expect(normalizeImage({ id: "only-id" })).toBeUndefined();
		expect(normalizeImage("javascript:alert(1)")).toBeUndefined();
	});
});

describe("block normalizers", () => {
	it("drops empty rows and falls back to positional keys", () => {
		const stats = normalizeStats({
			_type: "stats",
			_key: "s",
			items: [{ value: "1", label: "One" }, { value: "", label: "" }, "junk", null],
		});
		expect(stats.items).toEqual([{ key: "row-0", value: "1", label: "One", prefix: undefined, suffix: undefined, icon: undefined }]);
	});

	it("keeps only emoji icons", () => {
		const stats = normalizeStats(fixtures.stats);
		expect(stats.items.map((item) => item.icon)).toEqual(["\u{1F680}", undefined, undefined]);
		expect(normalizeStats({ items: [{ value: "1", label: "x", icon: "fa-rocket" }] }).items[0]?.icon).toBeUndefined();
	});

	it("builds the callout CTA only with a label and a safe URL", () => {
		expect(normalizeCallout(fixtures.callout).cta).toEqual({
			label: "Read the backup guide",
			href: "https://example.com/backup",
		});
		expect(normalizeCallout({ ...fixtures.callout, ctaUrl: "javascript:x" }).cta).toBeUndefined();
		expect(normalizeCallout({ ...fixtures.callout, ctaLabel: "" }).cta).toBeUndefined();
	});

	it("sanitizes opinion bodies and uses the name as avatar alt fallback", () => {
		const opinion = normalizeOpinion({
			...fixtures.opinion,
			avatar: "/pic.jpg",
			body: '<p onclick="x">Hi</p>',
		});
		expect(opinion.bodyHtml).toBe("<p>Hi</p>");
		expect(opinion.avatar).toEqual({ src: "/pic.jpg", alt: "Jane Doe" });
	});

	it("normalizes product review CTA rel and new-tab handling", () => {
		const review = normalizeProductReview(fixtures.productReview);
		expect(review.cta).toEqual({
			label: "Visit Acme",
			href: "https://acme.example/?ref=test",
			newTab: true,
			rel: "nofollow sponsored noopener",
		});
		expect(normalizeProductReview({ ...fixtures.productReview, ctaNewTab: false }).cta?.rel).toBe(
			"nofollow sponsored",
		);
		expect(normalizeProductReview({ ...fixtures.productReview, price: -1 }).price).toBeUndefined();
	});

	it("renders compare text as rich text in both plain and HTML forms", () => {
		const compare = normalizeCompare(fixtures.compare);
		expect(compare.columns[0]?.textHtml).toBe("<p>Cheap.<br>Slow under load.</p>");
		expect(compare.columns[1]?.textHtml).toBe("<ul><li>Fast</li><li>Scales</li></ul>");
		expect(compare.columns[1]?.highlight).toBe(true);
	});

	it("normalizes checklist booleans", () => {
		const checklist = normalizeChecklist({
			...fixtures.checklist,
			interactive: "1",
			items: [{ text: "A", checked: "true" }, { text: " ", checked: true }],
		});
		expect(checklist.interactive).toBe(true);
		expect(checklist.items).toEqual([{ key: "row-0", text: "A", checked: true }]);
	});

	it("normalizes thread handles, counts and text", () => {
		const thread = normalizeThread(fixtures.thread);
		expect(thread.posts.map((post) => post.handle)).toEqual(["@gatilab", "@gatilab"]);
		expect(thread.posts[0]?.text).toBe("We moved 40 sites this month.\nHere is what broke:");
		expect(thread.posts[0]?.likes).toBe(1200);
		expect(thread.posts[1]?.reposts).toBe(0);
		expect(normalizeThread({ posts: [{ name: "A", text: "\r\n\r\nHi\r\nthere\r\n" }] }).posts[0]?.text).toBe("Hi\nthere");
	});

	it("drops related links with unsafe URLs", () => {
		const related = normalizeRelatedLinks(fixtures.relatedLinks);
		expect(related.links).toHaveLength(2);
		const filtered = normalizeRelatedLinks({
			...fixtures.relatedLinks,
			links: [
				{ title: "Safe", url: "/safe" },
				{ title: "Bad", url: "javascript:alert(1)" },
				{ title: "", url: "/no-title" },
			],
		});
		expect(filtered.links).toEqual([{ key: "row-0", title: "Safe", href: "/safe" }]);
	});
});
