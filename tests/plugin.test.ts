import { describe, expect, it } from "vitest";

import pkg from "../package.json" with { type: "json" };
import { blockComponents } from "../src/astro/index.js";
import { BLOCK_DEFINITIONS, DEFAULT_CATEGORY, getBlockDefinitions } from "../src/blocks.js";
import { contentBlocks, createPlugin, PACKAGE_NAME, PLUGIN_ID, PLUGIN_VERSION } from "../src/index.js";
import { CONTENT_BLOCK_TYPES } from "../src/types.js";
import { BLOCK_SCHEMAS } from "../src/validate.js";

const SCALAR_SUBFIELDS = new Set(["text_input", "number_input", "select", "toggle"]);
const PT_EDITOR_FIELDS = new Set([
	"text_input",
	"number_input",
	"select",
	"toggle",
	"repeater",
	"media_picker",
]);

describe("descriptor", () => {
	it("returns a native descriptor with the components entry", () => {
		expect(contentBlocks()).toEqual({
			id: "gt-content-blocks",
			version: "0.1.0",
			format: "native",
			entrypoint: "@gatilab/emdash-content-blocks",
			componentsEntry: "@gatilab/emdash-content-blocks/astro",
			options: {},
		});
	});

	it("passes options through", () => {
		const options = { blocks: ["faq" as const], category: "Editorial" };
		expect(contentBlocks(options).options).toBe(options);
	});

	it("keeps package, descriptor and runtime versions in sync", () => {
		expect(pkg.name).toBe(PACKAGE_NAME);
		expect(pkg.version).toBe(PLUGIN_VERSION);
		expect(pkg.exports["."]).toBe("./src/index.ts");
		expect(pkg.exports["./astro"]).toBe("./src/astro/index.ts");
		const plugin = createPlugin();
		expect(plugin.id).toBe(PLUGIN_ID);
		expect(plugin.version).toBe(PLUGIN_VERSION);
		expect(plugin.capabilities).toEqual([]);
	});
});

describe("editor definitions", () => {
	it("defines, renders and validates the same set of block types", () => {
		const defined = createPlugin().admin?.portableTextBlocks?.map((block) => block.type);
		expect(defined).toEqual([...CONTENT_BLOCK_TYPES]);
		expect(Object.keys(blockComponents).sort()).toEqual([...CONTENT_BLOCK_TYPES].sort());
		expect(Object.keys(BLOCK_DEFINITIONS).sort()).toEqual([...CONTENT_BLOCK_TYPES].sort());
	});

	it("groups every block under the default category", () => {
		for (const block of getBlockDefinitions()) expect(block.category).toBe(DEFAULT_CATEGORY);
		expect(getBlockDefinitions({ category: "Editorial" })[0]?.category).toBe("Editorial");
	});

	it("filters by the blocks option without changing order", () => {
		const types = getBlockDefinitions({ blocks: ["thread", "faq"] }).map((block) => block.type);
		expect(types).toEqual(["faq", "thread"]);
		const plugin = createPlugin({ blocks: ["callout"] });
		expect(plugin.admin?.portableTextBlocks?.map((block) => block.type)).toEqual(["callout"]);
	});

	it("uses only field types the Portable Text editor renders", () => {
		for (const block of getBlockDefinitions()) {
			const ids = new Set<string>();
			for (const field of block.fields ?? []) {
				expect(PT_EDITOR_FIELDS.has(field.type), `${block.type}.${field.type}`).toBe(true);
				expect(ids.has(field.action_id), `${block.type} duplicate ${field.action_id}`).toBe(false);
				ids.add(field.action_id);
				if (field.type === "repeater") {
					expect(field.fields.length).toBeGreaterThan(0);
					expect(field.fields[0]?.type, `${block.type}.${field.action_id} summary field`).toBe("text_input");
					for (const sub of field.fields) expect(SCALAR_SUBFIELDS.has(sub.type)).toBe(true);
				}
			}
		}
	});

	it("maps every schema field to an editor field with a matching kind", () => {
		for (const block of getBlockDefinitions()) {
			const schema = BLOCK_SCHEMAS[block.type as keyof typeof BLOCK_SCHEMAS];
			const fields = new Map((block.fields ?? []).map((field) => [field.action_id, field]));
			expect([...fields.keys()].sort(), block.type).toEqual(Object.keys(schema).sort());
			for (const [name, rule] of Object.entries(schema)) {
				const field = fields.get(name);
				if (!field) continue;
				if (rule.kind === "rows") {
					expect(field.type, `${block.type}.${name}`).toBe("repeater");
					if (field.type === "repeater") {
						expect(field.fields.map((sub) => sub.action_id).sort()).toEqual(Object.keys(rule.fields).sort());
					}
				}
				if (rule.kind === "boolean") expect(field.type, `${block.type}.${name}`).toBe("toggle");
				if (rule.kind === "image") expect(field.type, `${block.type}.${name}`).toBe("media_picker");
				if (rule.kind === "enum") expect(field.type, `${block.type}.${name}`).toBe("select");
				if (rule.kind === "number") {
					expect(field.type, `${block.type}.${name}`).toBe("number_input");
					// min/max would make browsers reject half steps such as 4.5.
					if (field.type === "number_input") {
						expect(field.min).toBeUndefined();
						expect(field.max).toBeUndefined();
					}
				}
			}
		}
	});
});
