import { describe, expect, it } from "vitest";

import { absoluteUrl, buildFaqJsonLd, buildProductReviewJsonLd, serializeJsonLd } from "../src/schema.js";
import type { JsonLd } from "../src/schema.js";
import { faq, productReview } from "./fixtures.js";

function containsKey(value: unknown, key: string): boolean {
	if (Array.isArray(value)) return value.some((item) => containsKey(item, key));
	if (value && typeof value === "object") {
		return Object.entries(value).some(([k, v]) => k === key || containsKey(v, key));
	}
	return false;
}

describe("buildFaqJsonLd", () => {
	it("builds FAQPage with plain-text answers", () => {
		expect(buildFaqJsonLd(faq)).toEqual({
			"@context": "https://schema.org",
			"@type": "FAQPage",
			mainEntity: [
				{
					"@type": "Question",
					name: "Do you offer refunds?",
					acceptedAnswer: { "@type": "Answer", text: "Yes, within 30 days. See the refund policy." },
				},
				{
					"@type": "Question",
					name: "Is support included?",
					acceptedAnswer: { "@type": "Answer", text: "Email support is included. Priority support costs extra." },
				},
			],
		});
	});

	it("skips items without a question or answer", () => {
		const result = buildFaqJsonLd({
			...faq,
			items: [
				{ question: "", answer: "orphan answer" },
				{ question: "No answer?", answer: "" },
				{ question: "Scripted?", answer: "<script>alert(1)</script>" },
				{ question: "Kept", answer: "Yes" },
			],
		});
		expect(result?.mainEntity).toEqual([
			{ "@type": "Question", name: "Kept", acceptedAnswer: { "@type": "Answer", text: "Yes" } },
		]);
	});

	it("returns null when nothing is usable", () => {
		expect(buildFaqJsonLd({ ...faq, items: [] })).toBeNull();
		expect(buildFaqJsonLd(null)).toBeNull();
	});
});

describe("buildProductReviewJsonLd", () => {
	it("builds a Product with one Review and an Offer", () => {
		const data = buildProductReviewJsonLd(productReview, { baseUrl: "https://site.example/blog/post/" });
		expect(data).toEqual({
			"@context": "https://schema.org",
			"@type": "Product",
			name: "Acme Hosting",
			image: "https://site.example/media/acme.png",
			description: "Fast, simple managed hosting with honest pricing.",
			brand: { "@type": "Brand", name: "Acme" },
			sku: "ACME-PRO",
			review: {
				"@type": "Review",
				author: { "@type": "Person", name: "Gaurav Tiwari" },
				reviewRating: { "@type": "Rating", ratingValue: 4.5, bestRating: 5, worstRating: 0 },
				datePublished: "2026-09-30",
				positiveNotes: {
					"@type": "ItemList",
					itemListElement: [
						{ "@type": "ListItem", position: 1, name: "Fast time to first byte" },
						{ "@type": "ListItem", position: 2, name: "Free migrations" },
					],
				},
				negativeNotes: {
					"@type": "ItemList",
					itemListElement: [{ "@type": "ListItem", position: 1, name: "No email hosting" }],
				},
			},
			offers: {
				"@type": "Offer",
				price: 29.99,
				priceCurrency: "USD",
				url: "https://acme.example/?ref=test",
			},
		});
	});

	it("never emits AggregateRating", () => {
		const data = buildProductReviewJsonLd(productReview);
		expect(containsKey(data, "aggregateRating")).toBe(false);
		expect(JSON.stringify(data)).not.toContain("AggregateRating");
	});

	it("builds a SoftwareApplication with category, OS and publisher", () => {
		const data = buildProductReviewJsonLd({
			...productReview,
			schemaType: "SoftwareApplication",
			appCategory: "BusinessApplication",
			operatingSystem: "Web",
		}) as JsonLd;
		expect(data["@type"]).toBe("SoftwareApplication");
		expect(data.applicationCategory).toBe("BusinessApplication");
		expect(data.operatingSystem).toBe("Web");
		expect(data.publisher).toEqual({ "@type": "Organization", name: "Acme" });
		expect(data.brand).toBeUndefined();
		expect(data.sku).toBeUndefined();
	});

	it("falls back to Product for unknown schema types", () => {
		const data = buildProductReviewJsonLd({ ...productReview, schemaType: "Movie" as never }) as JsonLd;
		expect(data["@type"]).toBe("Product");
	});

	it("omits the review without a reviewer, and the offer without an ISO currency", () => {
		const data = buildProductReviewJsonLd({ ...productReview, reviewer: "", currency: "dollars" });
		expect(data).toBeNull();

		const offerOnly = buildProductReviewJsonLd({ ...productReview, reviewer: undefined }) as JsonLd;
		expect(offerOnly.review).toBeUndefined();
		expect(offerOnly.offers).toBeDefined();

		const reviewOnly = buildProductReviewJsonLd({ ...productReview, price: undefined }) as JsonLd;
		expect(reviewOnly.offers).toBeUndefined();
		expect(reviewOnly.review).toBeDefined();
	});

	it("maps unambiguous currency symbols and accepts zero prices", () => {
		const data = buildProductReviewJsonLd({ ...productReview, price: 0, currency: "\u20ac" }) as JsonLd;
		expect(data.offers).toMatchObject({ price: 0, priceCurrency: "EUR" });
	});

	it("clamps and rounds ratings", () => {
		const high = buildProductReviewJsonLd({ ...productReview, rating: 7 }) as JsonLd;
		expect((high.review as JsonLd).reviewRating).toMatchObject({ ratingValue: 5 });
		const odd = buildProductReviewJsonLd({ ...productReview, rating: "4.3" as never }) as JsonLd;
		expect((odd.review as JsonLd).reviewRating).toMatchObject({ ratingValue: 4.5 });
	});

	it("accepts the media-picker URL string for the image", () => {
		const data = buildProductReviewJsonLd(
			{ ...productReview, image: "/_emdash/api/media/file/abc.png" },
			{ baseUrl: "https://site.example" },
		) as JsonLd;
		expect(data.image).toBe("https://site.example/_emdash/api/media/file/abc.png");
	});

	it("drops unsafe image and offer URLs", () => {
		const data = buildProductReviewJsonLd({
			...productReview,
			image: { src: "javascript:alert(1)" },
			ctaUrl: "javascript:alert(1)",
		}) as JsonLd;
		expect(data.image).toBeUndefined();
		expect((data.offers as JsonLd).url).toBeUndefined();
	});

	it("normalizes non-ISO review dates", () => {
		const data = buildProductReviewJsonLd({ ...productReview, reviewDate: "September 30, 2026" }) as JsonLd;
		expect((data.review as JsonLd).datePublished).toBe("2026-09-30");
		const bad = buildProductReviewJsonLd({ ...productReview, reviewDate: "someday" }) as JsonLd;
		expect((bad.review as JsonLd).datePublished).toBeUndefined();
	});

	it("returns null without a name", () => {
		expect(buildProductReviewJsonLd({ ...productReview, name: "" })).toBeNull();
	});
});

describe("serializeJsonLd", () => {
	it("escapes characters that could end the script element", () => {
		const json = serializeJsonLd({ name: "</script><script>alert(1)</script> & \u2028" });
		expect(json).not.toContain("<");
		expect(json).not.toContain(">");
		expect(json).toContain("\\u003c/script\\u003e");
		expect(json).toContain("\\u0026");
		expect(json).toContain("\\u2028");
		expect(JSON.parse(json)).toEqual({ name: "</script><script>alert(1)</script> & \u2028" });
	});
});

describe("absoluteUrl", () => {
	it("resolves relative URLs against the base", () => {
		expect(absoluteUrl("/a.png", "https://x.example/blog/")).toBe("https://x.example/a.png");
		expect(absoluteUrl("a.png", new URL("https://x.example/blog/"))).toBe("https://x.example/blog/a.png");
		expect(absoluteUrl("//cdn.example/a.png")).toBe("https://cdn.example/a.png");
		expect(absoluteUrl("https://y.example/a.png", "https://x.example")).toBe("https://y.example/a.png");
		expect(absoluteUrl("/a.png")).toBe("/a.png");
	});
});
