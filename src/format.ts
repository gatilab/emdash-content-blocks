/**
 * Small display formatters shared by the renderers and JSON-LD builders.
 */

const CURRENCY_SYMBOLS: Readonly<Record<string, string>> = {
	"\u20ac": "EUR",
	"\u00a3": "GBP",
	"\u20b9": "INR",
};

/** ISO 4217 code for a currency value, or `undefined` when it cannot be determined. */
export function isoCurrency(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	if (/^[A-Za-z]{3}$/.test(trimmed)) return trimmed.toUpperCase();
	return CURRENCY_SYMBOLS[trimmed];
}

/**
 * Format a price for display. Uses `Intl` currency formatting when the
 * currency is an ISO code; otherwise prefixes the raw currency text.
 */
export function formatPrice(price: number, currency?: string, locale?: string): string {
	const code = isoCurrency(currency);
	const fractionDigits = Number.isInteger(price) ? 0 : 2;
	if (code) {
		try {
			return new Intl.NumberFormat(locale, {
				style: "currency",
				currency: code,
				minimumFractionDigits: fractionDigits,
				maximumFractionDigits: 2,
			}).format(price);
		} catch {
			// Unknown currency code: fall through to the plain format.
		}
	}
	let amount = price.toFixed(fractionDigits);
	try {
		amount = new Intl.NumberFormat(locale, {
			minimumFractionDigits: fractionDigits,
			maximumFractionDigits: 2,
		}).format(price);
	} catch {
		// Invalid locale: keep toFixed output.
	}
	if (!currency) return amount;
	return currency.length === 1 ? `${currency}${amount}` : `${currency} ${amount}`;
}

/** Compact count for numbers (1200 → "1.2K"); strings are returned trimmed. */
export function formatCount(value: string | number, locale?: string): string {
	if (typeof value === "string") return value.trim();
	try {
		return new Intl.NumberFormat(locale, {
			notation: value >= 10_000 ? "compact" : "standard",
			maximumFractionDigits: 1,
		}).format(value);
	} catch {
		return String(value);
	}
}

/** Display string for a rating: whole numbers without decimals, halves with one. */
export function formatRating(rating: number): string {
	return Number.isInteger(rating) ? String(rating) : rating.toFixed(1);
}

/** Rating 0–5 as the number of filled half stars (0–10). */
export function halfSteps(rating: number | undefined): number {
	if (rating === undefined || !Number.isFinite(rating)) return 0;
	return Math.min(10, Math.max(0, Math.round(rating * 2)));
}

/** `YYYY-MM-DD` for a date string, or `undefined` when it cannot be parsed. */
export function isoDate(value: string | undefined): string | undefined {
	if (!value) return undefined;
	const trimmed = value.trim();
	const direct = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
	if (direct) {
		const [, year, month, day] = direct;
		const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
		return Number.isNaN(date.getTime()) || date.getUTCDate() !== Number(day)
			? undefined
			: `${year}-${month}-${day}`;
	}
	// Non-ISO date strings ("September 30, 2026") parse as local midnight, so
	// read the local calendar date rather than converting to UTC.
	const parsed = new Date(trimmed);
	if (Number.isNaN(parsed.getTime())) return undefined;
	const pad = (n: number): string => String(n).padStart(2, "0");
	return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

/** Human-readable date (UTC, medium style) plus its ISO form for `<time datetime>`. */
export function formatDate(
	value: string | undefined,
	locale?: string,
): { iso?: string; label: string } | undefined {
	if (!value) return undefined;
	const iso = isoDate(value);
	if (!iso) return { label: value };
	try {
		const label = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
			new Date(`${iso}T00:00:00Z`),
		);
		return { iso, label };
	} catch {
		return { iso, label: iso };
	}
}

/** First letter of a name for avatar placeholders. */
export function initial(name: string | undefined): string {
	const match = name?.trim().match(/\p{L}|\p{N}/u);
	return match ? match[0].toUpperCase() : "?";
}
