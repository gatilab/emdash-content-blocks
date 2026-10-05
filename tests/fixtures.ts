import type {
	CalloutBlock,
	ChecklistBlock,
	CompareBlock,
	ContentBlock,
	FaqBlock,
	OpinionBlock,
	ProductReviewBlock,
	ProsConsBlock,
	RelatedLinksBlock,
	StatsBlock,
	ThreadBlock,
} from "../src/types.js";

export const faq: FaqBlock = {
	_type: "faq",
	_key: "faq1",
	title: "Common questions",
	schema: true,
	items: [
		{
			_key: "q1",
			question: "Do you offer refunds?",
			answer: "<p>Yes, within <strong>30 days</strong>. See the <a href=\"/refunds\">refund policy</a>.</p>",
		},
		{
			_key: "q2",
			question: "Is support included?",
			answer: "Email support is included.\n\nPriority support costs extra.",
		},
	],
};

export const callout: CalloutBlock = {
	_type: "callout",
	_key: "c1",
	label: "Before you start",
	tone: "warning",
	body: "Back up your site first. <em>Always.</em>",
	ctaLabel: "Read the backup guide",
	ctaUrl: "https://example.com/backup",
};

export const opinion: OpinionBlock = {
	_type: "opinion",
	_key: "o1",
	name: "Jane Doe",
	role: "Performance engineer",
	avatar: { id: "m1", src: "https://cdn.example.com/jane.jpg", alt: "Jane Doe", width: 96, height: 96 },
	body: "<p>Cache at the edge before you optimize anything else.</p>",
};

export const stats: StatsBlock = {
	_type: "stats",
	_key: "s1",
	items: [
		{ _key: "s1a", value: "1,200", label: "Sites launched", suffix: "+", icon: "\u{1F680}" },
		{ _key: "s1b", value: "99.9", label: "Uptime", suffix: "%", icon: "" },
		{ _key: "s1c", value: "4", label: "Average days to launch", prefix: "~" },
	],
};

export const productReview: ProductReviewBlock = {
	_type: "productReview",
	_key: "r1",
	name: "Acme Hosting",
	brand: "Acme",
	image: { id: "m2", src: "/media/acme.png", alt: "Acme logo", width: 400, height: 400 },
	rating: 4.5,
	summary: "Fast, simple managed hosting with honest pricing.",
	features: [
		{ _key: "f1", name: "Speed", rating: 5 },
		{ _key: "f2", name: "Support", rating: 4 },
	],
	pros: [
		{ _key: "p1", text: "Fast time to first byte" },
		{ _key: "p2", text: "Free migrations" },
	],
	cons: [{ _key: "n1", text: "No email hosting" }],
	ctaLabel: "Visit Acme",
	ctaUrl: "https://acme.example/?ref=test",
	ctaRel: "nofollow sponsored",
	ctaNewTab: true,
	price: 29.99,
	currency: "USD",
	priceTerm: "/month",
	schema: true,
	schemaType: "Product",
	appCategory: "",
	operatingSystem: "",
	sku: "ACME-PRO",
	reviewer: "Gaurav Tiwari",
	reviewDate: "2026-09-30",
};

export const prosCons: ProsConsBlock = {
	_type: "prosCons",
	_key: "pc1",
	pros: [{ _key: "a", text: "Quick setup" }],
	cons: [{ _key: "b", text: "Limited themes" }],
};

export const compare: CompareBlock = {
	_type: "compare",
	_key: "cmp1",
	columns: [
		{ _key: "x", title: "Shared hosting", text: "Cheap.\nSlow under load.", highlight: false },
		{ _key: "y", title: "Managed VPS", text: "<ul><li>Fast</li><li>Scales</li></ul>", highlight: true },
		{ _key: "z", title: "Dedicated", text: "Overkill for most sites.", highlight: false },
	],
};

export const checklist: ChecklistBlock = {
	_type: "checklist",
	_key: "ck1",
	title: "Launch checklist",
	interactive: true,
	items: [
		{ _key: "i1", text: "Point DNS", checked: true },
		{ _key: "i2", text: "Install SSL", checked: false },
		{ _key: "i3", text: "Submit sitemap", checked: false },
	],
};

export const thread: ThreadBlock = {
	_type: "thread",
	_key: "t1",
	posts: [
		{
			_key: "tp1",
			name: "Gatilab",
			handle: "gatilab",
			verified: true,
			text: "We moved 40 sites this month.\nHere is what broke:",
			time: "2h",
			likes: 1200,
			replies: "18",
			reposts: 42,
		},
		{
			_key: "tp2",
			name: "Gatilab",
			handle: "@gatilab",
			verified: true,
			text: "1. DNS TTLs\n2. Mixed content",
			time: "2h",
			likes: "340",
			replies: 3,
			reposts: 0,
		},
	],
};

export const relatedLinks: RelatedLinksBlock = {
	_type: "relatedLinks",
	_key: "rl1",
	title: "Keep reading",
	links: [
		{ _key: "l1", title: "How to speed up WordPress", url: "/blog/speed-up-wordpress/" },
		{ _key: "l2", title: "Edge caching explained", url: "https://example.com/edge-caching" },
	],
};

export const allBlocks: ContentBlock[] = [
	faq,
	callout,
	opinion,
	stats,
	productReview,
	prosCons,
	compare,
	checklist,
	thread,
	relatedLinks,
];
