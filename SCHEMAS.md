# Block schemas

This is the stored shape of every block provided by `@gatilab/emdash-content-blocks`. Each block is a Portable Text node with `_type` and `_key`. Arrays of objects carry a `_key` on each row.

The same contract is available in code:

- TypeScript types: `FaqBlock`, `CalloutBlock`, ... exported from the package root.
- Runtime validation: `validateBlock(node)` and `BLOCK_SCHEMAS`.

Fields marked **HTML** may contain inline HTML. Renderers sanitize them to this allowlist before output: `<a href title target rel>`, `<strong>`, `<em>`, `<code>`, `<br>`, `<p>`, `<ul>`, `<ol start>`, `<li>`, `<h3>`, `<h4>`. `<b>` and `<i>` become `<strong>` and `<em>`. Scripts, event handlers, `style` attributes and `javascript:`/`data:` URLs are removed. A value with no block-level markup is split into paragraphs on blank lines, the way WordPress `wpautop` would.

## Editor compatibility notes

These are properties of the EmDash editor, not changes to the schema. Renderers and `validateBlock()` accept both forms.

- **Row `_key`.** The repeater widget drops `_key` from rows when a block is saved in the editor. Imported content keeps it. Renderers fall back to the row position.
- **Images.** The `media_picker` field stores the picked asset's URL as a string. An image field therefore holds either the object below or a URL string. When it is a string, the alt text falls back to the person or product name.
- **Untouched fields are preserved.** Saving a block in the editor writes back every stored property, including ones the form does not show.

## Shared shapes

```ts
type ImageValue = {
  id?: string;      // media library ID, informational
  src?: string;     // required for the image to render
  alt?: string;
  width?: number;
  height?: number;
};
```

## faq

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | no | Shown above the questions as styled text, not a heading element. |
| `schema` | boolean | yes | Emit FAQPage JSON-LD. |
| `items` | `{ question: string, answer: string }[]` | yes | `answer` is **HTML**. Items without a question are skipped. |

FAQPage JSON-LD uses the answer text with tags stripped.

```json
{
  "_type": "faq",
  "_key": "a1b2",
  "title": "Common questions",
  "schema": true,
  "items": [
    { "_key": "q1", "question": "Do you offer refunds?", "answer": "<p>Yes, within <strong>30 days</strong>.</p>" }
  ]
}
```

## callout

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `label` | string | no | Defaults to the tone name (Info, Success, Warning, Important, Tip, Note). |
| `tone` | `"info" \| "success" \| "warning" \| "danger" \| "tip" \| "note"` | yes | Unknown values render as `info`. |
| `body` | string | yes | **HTML**. |
| `ctaLabel` | string | no | Button text. The button renders only with both label and URL. |
| `ctaUrl` | string | no | http(s), mailto, tel or relative URL. |

## opinion

An expert opinion or author quote box.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | no | |
| `role` | string | no | |
| `avatar` | `ImageValue` or URL string | no | Shown at 48 px. Without it, the name's first letter is shown. |
| `body` | string | yes | **HTML**. |

## stats

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `items` | `{ value: string, label: string, prefix?: string, suffix?: string, icon?: string }[]` | yes | `icon` is an emoji or empty. Non-emoji values are ignored. |

## productReview

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `name` | string | yes | The block renders nothing without a name. |
| `brand` | string | no | |
| `image` | `ImageValue` or URL string | no | |
| `rating` | number | no | 0 to 5 in half steps. Other values are clamped and rounded. |
| `summary` | string | no | Plain text or HTML. |
| `features` | `{ name: string, rating?: number }[]` | yes | Feature scores, 0 to 5. |
| `pros` | `{ text: string }[]` | yes | |
| `cons` | `{ text: string }[]` | yes | |
| `ctaLabel` | string | no | |
| `ctaUrl` | string | no | |
| `ctaRel` | string | no | Space-separated. Kept tokens: `nofollow`, `sponsored`, `ugc`, `noopener`, `noreferrer`, `external`. |
| `ctaNewTab` | boolean | no | Adds `target="_blank"` and `noopener`. |
| `price` | number | no | |
| `currency` | string | no | ISO 4217 code such as `USD`. `€`, `£` and `₹` are mapped to EUR, GBP and INR. |
| `priceTerm` | string | no | Shown after the price, for example `/month`. |
| `schema` | boolean | yes | Emit structured data. |
| `schemaType` | `"Product" \| "SoftwareApplication"` | no | Defaults to `Product`. |
| `appCategory` | string | no | `applicationCategory`, SoftwareApplication only. |
| `operatingSystem` | string | no | SoftwareApplication only. |
| `sku` | string | no | Product only. |
| `reviewer` | string | no | Review author (Person). |
| `reviewDate` | string | no | ISO date, `YYYY-MM-DD`. Other parseable dates are converted. |

Structured data, when `schema` is true:

- `@type` is `Product` or `SoftwareApplication`, with `name`, `image` (absolute), `description` (summary text) and `brand` (Product) or `publisher` (SoftwareApplication).
- `review` is a single `Review` with `author` (Person), `reviewRating` (`bestRating` 5, `worstRating` 0), `datePublished`, and pros and cons as `positiveNotes` / `negativeNotes`. It is emitted only when both `rating` and `reviewer` are set.
- `offers` is an `Offer` with `price`, `priceCurrency` and `url` (the CTA URL when absolute). It is emitted only when `price` is set and `currency` resolves to an ISO code.
- Nothing is emitted when neither a review nor an offer can be built.
- `AggregateRating` is never emitted. One editorial review is not an aggregate.

## prosCons

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `pros` | `{ text: string }[]` | yes | |
| `cons` | `{ text: string }[]` | yes | |

## compare

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `columns` | `{ title: string, text: string, highlight: boolean }[]` | yes | Two to four columns. `text` may be plain text (line breaks kept) or HTML. A highlighted column is marked "Recommended". |

## checklist

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | no | |
| `interactive` | boolean | yes | Real checkboxes with a progress count. Ticks are stored in `localStorage` under `gtcb-checklist:<_key>` and discarded when the item list changes. |
| `items` | `{ text: string, checked: boolean }[]` | yes | `checked` is the default state. |

## thread

A social media thread mock-up with a generic look.

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `posts` | `{ name, handle, verified, text, time, likes, replies, reposts }[]` | yes | See below. |

Post fields: `name` string, `handle` string (an `@` is added when missing), `verified` boolean, `text` plain text with significant newlines, `time` string such as `2h`, and `likes`, `replies`, `reposts` as a string (`"1.2K"`) or a number (numbers of 10,000 and above are shown compactly).

## relatedLinks

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | no | Also used as the navigation landmark's label. |
| `links` | `{ title: string, url: string }[]` | yes | Links with an unsafe URL or no title are skipped. |
