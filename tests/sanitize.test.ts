import { describe, expect, it } from "vitest";

import {
	decodeEntities,
	escapeHtml,
	htmlToText,
	richText,
	safeRel,
	safeUrl,
	sanitizeHtml,
	stripTags,
	textToHtml,
} from "../src/sanitize.js";

describe("sanitizeHtml: allowlist", () => {
	it("keeps allowed tags", () => {
		const html =
			'<p>Hi <strong>there</strong> <em>you</em> <code>x</code><br>next</p><ul><li>a</li></ul><ol><li>b</li></ol><h3>T</h3><h4>U</h4>';
		expect(sanitizeHtml(html)).toBe(html);
	});

	it("rewrites b and i to strong and em", () => {
		expect(sanitizeHtml("<b>bold</b> <i>it</i>")).toBe("<strong>bold</strong> <em>it</em>");
	});

	it("unwraps unknown tags but keeps their text", () => {
		expect(sanitizeHtml('<div class="x"><span style="color:red">hello</span></div>')).toBe("hello");
		expect(sanitizeHtml("<h2>Heading</h2>")).toBe("Heading");
	});

	it("returns an empty string for non-strings", () => {
		expect(sanitizeHtml(undefined)).toBe("");
		expect(sanitizeHtml(42)).toBe("");
		expect(sanitizeHtml({ toString: () => "<b>x</b>" })).toBe("");
	});
});

describe("sanitizeHtml: dangerous input", () => {
	it("removes script and style elements with their content", () => {
		expect(sanitizeHtml("a<script>alert(1)</script>b")).toBe("ab");
		expect(sanitizeHtml("a<SCRIPT type=text/javascript>alert(1)</SCRIPT >b")).toBe("ab");
		expect(sanitizeHtml("a<style>p{color:red}</style>b")).toBe("ab");
		expect(sanitizeHtml("a<script>never closed")).toBe("a");
	});

	it("removes iframes, svg, math, templates and objects with content", () => {
		expect(sanitizeHtml('<iframe src="https://evil.example"></iframe>ok')).toBe("ok");
		expect(sanitizeHtml('<svg><script>alert(1)</script><a href="javascript:x">y</a></svg>ok')).toBe("ok");
		expect(sanitizeHtml("<math><mi>x</mi></math>ok")).toBe("ok");
		expect(sanitizeHtml("<template><p>t</p></template>ok")).toBe("ok");
		expect(sanitizeHtml('<object data="x.swf"></object><embed src="x">ok')).toBe("ok");
	});

	it("strips event handlers, style, class and id attributes", () => {
		expect(sanitizeHtml('<p onclick="alert(1)" style="x" class="c" id="i">t</p>')).toBe("<p>t</p>");
		expect(sanitizeHtml('<strong onmouseover=alert(1)>t</strong>')).toBe("<strong>t</strong>");
		expect(sanitizeHtml('<img src=x onerror="alert(1)">t')).toBe("t");
	});

	it("drops javascript:, data: and vbscript: links", () => {
		expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toBe("<a>x</a>");
		expect(sanitizeHtml('<a href="JaVaScRiPt:alert(1)">x</a>')).toBe("<a>x</a>");
		expect(sanitizeHtml('<a href=" \tjava\nscript:alert(1)">x</a>')).toBe("<a>x</a>");
		expect(sanitizeHtml('<a href="&#106;avascript:alert(1)">x</a>')).toBe("<a>x</a>");
		expect(sanitizeHtml('<a href="&#x6A;avascript&#58;alert(1)">x</a>')).toBe("<a>x</a>");
		expect(sanitizeHtml('<a href="javascript&colon;alert(1)">x</a>')).toBe("<a>x</a>");
		expect(sanitizeHtml('<a href="data:text/html,<script>alert(1)</script>">x</a>')).toBe("<a>x</a>");
		expect(sanitizeHtml('<a href="vbscript:msgbox">x</a>')).toBe("<a>x</a>");
	});

	it("re-escapes attribute values so they cannot break out", () => {
		expect(sanitizeHtml(`<a href='/x"onmouseover="alert(1)'>x</a>`)).toBe(
			'<a href="/x&quot;onmouseover=&quot;alert(1)">x</a>',
		);
		expect(sanitizeHtml('<a href="/a?b=1&amp;c=2" title="A &quot;q&quot;">x</a>')).toBe(
			'<a href="/a?b=1&amp;c=2" title="A &quot;q&quot;">x</a>',
		);
	});

	it("drops comments, doctypes, CDATA and processing instructions", () => {
		expect(sanitizeHtml("a<!-- <script>alert(1)</script> -->b")).toBe("ab");
		expect(sanitizeHtml("a<!--[if IE]><script>x</script><![endif]-->b")).toBe("ab");
		expect(sanitizeHtml("<!DOCTYPE html>a<![CDATA[x]]>b<?php echo 1 ?>c")).toBe("abc");
	});

	it("escapes stray angle brackets and bare ampersands in text", () => {
		expect(sanitizeHtml("1 < 2 && 3 > 2")).toBe("1 &lt; 2 &amp;&amp; 3 &gt; 2");
		expect(sanitizeHtml("Tom &amp; Jerry &copy; &#169;")).toBe("Tom &amp; Jerry &copy; &#169;");
		expect(sanitizeHtml('<a href="x" unterminated')).toBe('&lt;a href="x" unterminated');
	});

	it("does not allow tags to escape through malformed markup", () => {
		const out = sanitizeHtml("<p>ok</details></div><script>alert(1)</script></p>");
		expect(out).toBe("<p>ok</p>");
		expect(sanitizeHtml("<scr<script>ipt>alert(1)</script>")).not.toContain("<script");
	});

	it.each([
		["unclosed tags", "<a".repeat(50_000)],
		["unclosed tags with a final bracket", `${"<a".repeat(49_999)}>`],
		["unbalanced quotes", `${'<a b="'.repeat(16_000)}>`],
		["mixed quotes", `${"<a x='<a y=\"".repeat(9_000)}>`],
		["nested comment openers", "<!--".repeat(25_000)],
	])("stays fast on hostile input: %s", (_label, hostile) => {
		const started = performance.now();
		const out = sanitizeHtml(hostile);
		htmlToText(hostile);
		expect(performance.now() - started).toBeLessThan(1500);
		expect(out).not.toMatch(/<(?!\/?(?:a|strong|em|code|br|p|ul|ol|li|h3|h4)\b)[a-z]/i);
	});

	it("truncates input beyond maxLength", () => {
		expect(sanitizeHtml("abcdef", { maxLength: 3 })).toBe("abc");
	});
});

describe("sanitizeHtml: structure", () => {
	it("closes unclosed tags", () => {
		expect(sanitizeHtml("<p><strong>bold")).toBe("<p><strong>bold</strong></p>");
	});

	it("ignores stray closing tags", () => {
		expect(sanitizeHtml("text</strong></p>")).toBe("text");
	});

	it("closes an open paragraph before block elements", () => {
		expect(sanitizeHtml("<p>intro<ul><li>a</li></ul>")).toBe("<p>intro</p><ul><li>a</li></ul>");
	});

	it("closes an open list item before the next one", () => {
		expect(sanitizeHtml("<ul><li>a<li>b</ul>")).toBe("<ul><li>a</li><li>b</li></ul>");
	});

	it("keeps nested lists inside their item", () => {
		expect(sanitizeHtml("<ul><li>a<ul><li>b</li></ul></li></ul>")).toBe(
			"<ul><li>a<ul><li>b</li></ul></li></ul>",
		);
	});

	it("does not nest links", () => {
		expect(sanitizeHtml('<a href="/a">a<a href="/b">b</a>')).toBe('<a href="/a">a</a><a href="/b">b</a>');
	});

	it("keeps a numeric start on ordered lists", () => {
		expect(sanitizeHtml('<ol start="3" type="a"><li>x</li></ol>')).toBe('<ol start="3"><li>x</li></ol>');
		expect(sanitizeHtml('<ol start="3x"><li>x</li></ol>')).toBe("<ol><li>x</li></ol>");
	});
});

describe("sanitizeHtml: links", () => {
	it("keeps safe hrefs, titles and new-tab targets", () => {
		expect(sanitizeHtml('<a href="https://example.com" title="Ex">x</a>')).toBe(
			'<a href="https://example.com" title="Ex">x</a>',
		);
		expect(sanitizeHtml('<a href="mailto:hi@example.com">x</a>')).toBe('<a href="mailto:hi@example.com">x</a>');
		expect(sanitizeHtml('<a href="/path#frag">x</a>')).toBe('<a href="/path#frag">x</a>');
	});

	it("adds noopener to new-tab links and filters rel tokens", () => {
		expect(sanitizeHtml('<a href="https://x.example" target="_blank" rel="sponsored evil">x</a>')).toBe(
			'<a href="https://x.example" target="_blank" rel="sponsored noopener">x</a>',
		);
		expect(sanitizeHtml('<a href="/x" target="_top">x</a>')).toBe('<a href="/x">x</a>');
	});

	it("uses the first of duplicated attributes", () => {
		expect(sanitizeHtml('<a href="/safe" href="javascript:alert(1)">x</a>')).toBe('<a href="/safe">x</a>');
		expect(sanitizeHtml('<a href="javascript:alert(1)" href="/safe">x</a>')).toBe("<a>x</a>");
	});
});

describe("safeUrl", () => {
	it.each([
		["https://example.com/a?b=c#d", "https://example.com/a?b=c#d"],
		["http://example.com", "http://example.com"],
		["//cdn.example.com/x.png", "//cdn.example.com/x.png"],
		["/relative/path", "/relative/path"],
		["relative/path", "relative/path"],
		["?q=1", "?q=1"],
		["#top", "#top"],
		["tel:+15551234567", "tel:+15551234567"],
		["  https://example.com  ", "https://example.com"],
		["/a?x=a:b", "/a?x=a:b"],
	])("allows %s", (input, expected) => {
		expect(safeUrl(input)).toBe(expected);
	});

	it.each([
		"javascript:alert(1)",
		" javascript:alert(1)",
		"java\tscript:alert(1)",
		"&#106;avascript:alert(1)",
		"data:image/svg+xml;base64,AAAA",
		"vbscript:x",
		"file:///etc/passwd",
		"ftp://example.com",
		"page:2",
		"",
		"   ",
	])("rejects %j", (input) => {
		expect(safeUrl(input)).toBeUndefined();
	});

	it("rejects non-strings", () => {
		expect(safeUrl(null)).toBeUndefined();
		expect(safeUrl(1)).toBeUndefined();
	});
});

describe("safeRel", () => {
	it("filters unknown tokens and dedupes", () => {
		expect(safeRel("nofollow Sponsored nofollow onclick")).toBe("nofollow sponsored");
	});

	it("adds noopener for new tabs but never forces noreferrer", () => {
		expect(safeRel("sponsored", true)).toBe("sponsored noopener");
		expect(safeRel(undefined, true)).toBe("noopener");
	});

	it("returns undefined when nothing is left", () => {
		expect(safeRel("bogus")).toBeUndefined();
		expect(safeRel(undefined)).toBeUndefined();
	});
});

describe("entities and text helpers", () => {
	it("decodes numeric and named references", () => {
		expect(decodeEntities("&amp;&lt;&gt;&quot;&#39;&#x41;&#66;&nbsp;&mdash;")).toBe("&<>\"'AB\u00a0\u2014");
		expect(decodeEntities("&unknown; &#0; &#xD800;")).toBe("&unknown; \ufffd \ufffd");
	});

	it("escapes all special characters", () => {
		expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
	});

	it("flattens HTML to text with word breaks between blocks", () => {
		expect(htmlToText("<p>One</p><p>Two <strong>three</strong></p><ul><li>a</li><li>b</li></ul>")).toBe(
			"One Two three a b",
		);
		expect(htmlToText("Fish &amp; chips<script>alert(1)</script>")).toBe("Fish & chips");
		expect(stripTags("line<br>break")).toBe("line break");
	});

	it("converts plain text to paragraphs", () => {
		expect(textToHtml("One\nline\n\nTwo <b>")).toBe("<p>One<br>line</p><p>Two &lt;b&gt;</p>");
		expect(textToHtml("   ")).toBe("");
	});
});

describe("richText", () => {
	it("adds paragraphs to wpautop-style content", () => {
		expect(richText("First para with <strong>bold</strong>.\n\nSecond\nline.")).toBe(
			"<p>First para with <strong>bold</strong>.</p><p>Second<br>line.</p>",
		);
	});

	it("leaves block markup as written", () => {
		expect(richText("<p>A</p>\n\n<ul><li>B</li></ul>")).toBe("<p>A</p>\n\n<ul><li>B</li></ul>");
	});

	it("sanitizes whichever path it takes", () => {
		expect(richText('Hi<script>alert(1)</script> <a href="javascript:x">y</a>')).toBe("<p>Hi <a>y</a></p>");
	});

	it("returns an empty string for empty input", () => {
		expect(richText("")).toBe("");
		expect(richText(undefined)).toBe("");
	});
});
