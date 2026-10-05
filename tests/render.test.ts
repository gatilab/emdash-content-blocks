import { experimental_AstroContainer as AstroContainer } from "astro/container";
import { beforeAll, describe, expect, it } from "vitest";

import {
	blockComponents,
	Callout,
	Checklist,
	Compare,
	Faq,
	Opinion,
	ProductReview,
	ProsCons,
	RelatedLinks,
	Stats,
	Thread,
} from "../src/astro/index.js";
import * as fixtures from "./fixtures.js";

let container: AstroContainer;

beforeAll(async () => {
	container = await AstroContainer.create();
});

async function render(component: unknown, node: unknown): Promise<string> {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const html = await container.renderToString(component as any, { props: { node } });
	// Dev builds annotate elements with their source location; drop that noise.
	return html.replace(/\s+data-astro-source-(?:file|loc)="[^"]*"/g, "");
}

function jsonLdBlocks(html: string): unknown[] {
	return [...html.matchAll(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map((match) =>
		JSON.parse(match[1] ?? "null"),
	);
}

describe("all renderers", () => {
	it("render every fixture without throwing and without inline styles or event handlers", async () => {
		for (const block of fixtures.allBlocks) {
			const component = blockComponents[block._type];
			const html = await render(component, block);
			expect(html, block._type).toContain("gtcb");
			expect(html, block._type).not.toMatch(/\sstyle="/);
			expect(html, block._type).not.toMatch(/\son[a-z]+=/i);
			expect(html, block._type).not.toMatch(/<h[1-6][\s>]/);
		}
	});

	it("render nothing for empty or malformed nodes", async () => {
		for (const component of Object.values(blockComponents)) {
			const html = await render(component, { _type: "x", _key: "k" });
			expect(html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<link[^>]*>/g, "").trim()).toBe("");
			await expect(render(component, null)).resolves.toBeTypeOf("string");
		}
	});
});

describe("Faq", () => {
	it("renders details panels and FAQPage JSON-LD", async () => {
		const html = await render(Faq, fixtures.faq);
		expect(html.match(/<details class="gtcb-faq__item">/g)).toHaveLength(2);
		expect(html).toContain('<summary class="gtcb-faq__summary">');
		expect(html).toContain('<p class="gtcb-heading gtcb-faq__title">Common questions</p>');
		expect(html).toContain('<a href="/refunds">refund policy</a>');
		expect(html).toContain("<p>Email support is included.</p><p>Priority support costs extra.</p>");
		const [schema] = jsonLdBlocks(html);
		expect(schema).toMatchObject({ "@type": "FAQPage" });
	});

	it("omits JSON-LD when schema is off and sanitizes answers", async () => {
		const html = await render(Faq, {
			...fixtures.faq,
			schema: false,
			items: [{ question: "Q", answer: '<img src=x onerror=alert(1)><script>alert(1)</script>A' }],
		});
		expect(jsonLdBlocks(html)).toHaveLength(0);
		expect(html).not.toContain("onerror");
		expect(html).not.toContain("alert(1)");
	});

	it("escapes questions", async () => {
		const html = await render(Faq, { ...fixtures.faq, items: [{ question: "<b>Q</b>", answer: "A" }] });
		expect(html).toContain("&lt;b&gt;Q&lt;/b&gt;");
	});
});

describe("Callout", () => {
	it("renders tone, label, body and CTA", async () => {
		const html = await render(Callout, fixtures.callout);
		expect(html).toContain('data-tone="warning"');
		expect(html).toContain('role="note"');
		expect(html).toContain('aria-label="Before you start"');
		expect(html).toContain("<em>Always.</em>");
		expect(html).toContain('href="https://example.com/backup"');
	});

	it("falls back to info and the tone name", async () => {
		const html = await render(Callout, { ...fixtures.callout, tone: "loud", label: "" });
		expect(html).toContain('data-tone="info"');
		expect(html).toContain('aria-label="Info"');
	});
});

describe("Opinion", () => {
	it("renders the quote, author and decorative avatar", async () => {
		const html = await render(Opinion, fixtures.opinion);
		expect(html).toContain("<blockquote");
		expect(html).toContain('src="https://cdn.example.com/jane.jpg"');
		// Astro prints an empty alt as a bare attribute, which HTML reads as alt="".
		expect(html).toMatch(/<img[^>]*\salt(?:="")?[\s>]/);
		expect(html).not.toMatch(/<img[^>]*alt="Jane/);
		expect(html).toContain("Jane Doe");
		expect(html).toContain("Performance engineer");
	});

	it("uses an initial when there is no avatar", async () => {
		const html = await render(Opinion, { ...fixtures.opinion, avatar: undefined });
		expect(html).toContain("gtcb-opinion__avatar--initial");
		expect(html).toMatch(/aria-hidden="true">\s*J\s*</);
	});
});

describe("Stats", () => {
	it("renders a description list with affixes", async () => {
		const html = await render(Stats, fixtures.stats);
		expect(html).toContain("<dl");
		expect(html).toContain("1,200+");
		expect(html).toContain("~4");
		expect(html.match(/gtcb-stats__icon/g)).toHaveLength(1);
	});
});

describe("ProductReview", () => {
	it("renders the review card and Product JSON-LD", async () => {
		const html = await render(ProductReview, fixtures.productReview);
		expect(html).toContain('aria-label="Review: Acme Hosting"');
		expect(html).toContain('aria-label="Rated 4.5 out of 5"');
		expect(html).toContain('data-gtcb-half="9"');
		expect(html).toContain("$29.99");
		expect(html).toContain("/month");
		expect(html).toContain('rel="nofollow sponsored noopener"');
		expect(html).toContain('target="_blank"');
		expect(html).toContain('<time datetime="2026-09-30">');
		expect(html).toContain(">Pros<");
		expect(html).toContain(">Cons<");
		const [schema] = jsonLdBlocks(html);
		expect(schema).toMatchObject({ "@type": "Product", review: { "@type": "Review" } });
		expect(JSON.stringify(schema)).not.toContain("ggregateRating");
	});

	it("omits JSON-LD when schema is off", async () => {
		const html = await render(ProductReview, { ...fixtures.productReview, schema: false });
		expect(jsonLdBlocks(html)).toHaveLength(0);
	});

	it("renders without optional parts", async () => {
		const html = await render(ProductReview, {
			_type: "productReview",
			_key: "min",
			name: "Bare",
			features: [],
			pros: [],
			cons: [],
			schema: false,
		});
		expect(html).toContain("Bare");
		expect(html).not.toContain("gtcb-stars");
		expect(html).not.toContain("gtcb-review__footer");
	});
});

describe("ProsCons", () => {
	it("labels both lists in text", async () => {
		const html = await render(ProsCons, fixtures.prosCons);
		expect(html).toContain(">Pros<");
		expect(html).toContain(">Cons<");
		expect(html.match(/<ul class="gtcb-pc__list">/g)).toHaveLength(2);
	});

	it("renders a single column when one side is empty", async () => {
		const html = await render(ProsCons, { ...fixtures.prosCons, cons: [] });
		expect(html).toContain("gtcb-pc--single");
		expect(html).not.toContain(">Cons<");
	});
});

describe("Compare", () => {
	it("renders columns and a text badge on the highlight", async () => {
		const html = await render(Compare, fixtures.compare);
		expect(html).toContain('data-cols="3"');
		expect(html.match(/<li class="gtcb-compare__col/g)).toHaveLength(3);
		expect(html).toContain("Recommended");
		expect(html).toContain("gtcb-compare__col--highlight");
	});
});

describe("Checklist", () => {
	it("renders real checkboxes with a hidden progress row when interactive", async () => {
		const html = await render(Checklist, fixtures.checklist);
		expect(html.match(/type="checkbox"/g)).toHaveLength(3);
		expect(html).toMatch(/<input[^>]*checked/);
		expect(html).toContain('data-gtcb-key="ck1"');
		expect(html).toMatch(/data-gtcb-progress[^>]*hidden/);
		expect(html).toContain("of 3 done");
	});

	it("renders a static list when not interactive", async () => {
		const html = await render(Checklist, { ...fixtures.checklist, interactive: false });
		expect(html).not.toContain('type="checkbox"');
		expect(html).not.toContain("data-gtcb-checklist");
		expect(html).toContain("(done)");
		expect(html).toContain("(to do)");
	});
});

describe("Thread", () => {
	it("renders posts with handles, verified text and counts", async () => {
		const html = await render(Thread, fixtures.thread);
		expect(html.match(/<li class="gtcb-thread__post/g)).toHaveLength(2);
		expect(html).toContain("@gatilab");
		expect(html).not.toContain("@@gatilab");
		expect(html).toContain("Verified account");
		expect(html).toContain("We moved 40 sites this month.\nHere is what broke:");
		expect(html).toContain("1,200");
		expect(html).toContain("Replies:");
	});
});

describe("RelatedLinks", () => {
	it("renders safe links only", async () => {
		const html = await render(RelatedLinks, {
			...fixtures.relatedLinks,
			links: [...fixtures.relatedLinks.links, { _key: "bad", title: "Bad link", url: "javascript:alert(1)" }],
		});
		expect(html).toContain('aria-label="Keep reading"');
		expect(html).toContain('href="/blog/speed-up-wordpress/"');
		expect(html).not.toContain("javascript:");
		expect(html).not.toContain("Bad link");
	});
});
