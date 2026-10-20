/**
 * Day-level range math for the balance dashboard, shared by the page's `load`
 * (URL params) and the list actions (form data). Extracted from
 * `admin/finanzas/+page.server.ts` so both consumers resolve ranges through
 * exactly the same validation and fail-safe.
 *
 * America/Guayaquil is UTC-5 with no DST, so a fixed offset is exact and
 * independent of the server's timezone — mirroring finance-analytics.
 */
import type { FinanceRangePreset } from '$lib/interfaces/analytics';

const MS_PER_DAY = 86_400_000;
const GUAYAQUIL_UTC_OFFSET_MS = -5 * 60 * 60 * 1000;
/** Longest accepted range, in days; anything wider falls back to the default. */
const MAX_RANGE_DAYS = 366;
const DAY_PARAM_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Day-index bounds of every preset, computed from "today" in Guayaquil. */
export interface PresetBounds {
	today: number;
	currentMonthFrom: number;
	currentMonthToExclusive: number;
	previousMonthFrom: number;
	last7From: number;
}

export interface ResolvedRange {
	fromDay: number;
	/** Exclusive, matching the `[from, to)` semantics of the analytics SQL. */
	toDayExclusive: number;
	preset: FinanceRangePreset;
}

export function utcDayIndex(year: number, month: number, day: number): number {
	return Math.floor(Date.UTC(year, month, day) / MS_PER_DAY);
}

/** 'YYYY-MM-DD' label of a report day index. */
export function dayIndexLabel(dayIndex: number): string {
	return new Date(dayIndex * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Midnight (America/Guayaquil) of a report day index. */
export function dayIndexInstant(dayIndex: number): Date {
	return new Date(dayIndex * MS_PER_DAY - GUAYAQUIL_UTC_OFFSET_MS);
}

export function currentPresetBounds(): PresetBounds {
	const today = Math.floor((Date.now() + GUAYAQUIL_UTC_OFFSET_MS) / MS_PER_DAY);
	const todayUtc = new Date(today * MS_PER_DAY);
	const year = todayUtc.getUTCFullYear();
	const month = todayUtc.getUTCMonth();

	return {
		today,
		currentMonthFrom: utcDayIndex(year, month, 1),
		currentMonthToExclusive: today + 1,
		previousMonthFrom: utcDayIndex(month === 0 ? year - 1 : year, month === 0 ? 11 : month - 1, 1),
		last7From: today - 6
	};
}

/** Parses a 'YYYY-MM-DD' day param into a day index; null if malformed. */
export function parseDayParam(value: string | null): number | null {
	if (value === null) {
		return null;
	}

	const match = DAY_PARAM_PATTERN.exec(value);
	if (!match) {
		return null;
	}

	const year = Number(match[1]);
	const month = Number(match[2]) - 1;
	const day = Number(match[3]);
	const probe = new Date(Date.UTC(year, month, day));
	if (
		probe.getUTCFullYear() !== year ||
		probe.getUTCMonth() !== month ||
		probe.getUTCDate() !== day
	) {
		// Round-trip mismatch, e.g. 2026-02-31 auto-rolled into March.
		return null;
	}

	return utcDayIndex(year, month, day);
}

/**
 * Resolves the `from`/`to` pair (inclusive 'YYYY-MM-DD' labels) against the
 * current preset bounds. Both params must be present, parse to real calendar
 * days, and describe a non-empty range of at most MAX_RANGE_DAYS — otherwise
 * the fail-safe default (current month to date) applies, so a malformed or
 * missing range can never widen the window past the default.
 */
export function resolveRange(searchParams: URLSearchParams, bounds: PresetBounds): ResolvedRange {
	const fromParam = searchParams.get('from');
	const toParam = searchParams.get('to');

	if (fromParam !== null && toParam !== null) {
		const fromDay = parseDayParam(fromParam);
		const toDay = parseDayParam(toParam);

		if (fromDay !== null && toDay !== null) {
			// `from`/`to` in the URL are inclusive; analytics ranges are half-open.
			const toDayExclusive = toDay + 1;
			const days = toDayExclusive - fromDay;

			if (days > 0 && days <= MAX_RANGE_DAYS) {
				let preset: FinanceRangePreset = 'custom';
				if (
					fromDay === bounds.currentMonthFrom &&
					toDayExclusive === bounds.currentMonthToExclusive
				) {
					preset = 'month';
				} else if (
					fromDay === bounds.previousMonthFrom &&
					toDayExclusive === bounds.currentMonthFrom
				) {
					preset = 'last-month';
				} else if (fromDay === bounds.last7From && toDayExclusive === bounds.today + 1) {
					preset = 'last-7-days';
				}

				return { fromDay, toDayExclusive, preset };
			}
		}
	}

	// Default — and fail-safe fallback for any malformed, inverted or oversized
	// range: current month to date.
	return {
		fromDay: bounds.currentMonthFrom,
		toDayExclusive: bounds.currentMonthToExclusive,
		preset: 'month'
	};
}

/**
 * SQL-ready instant bounds of a resolved range: `createdAt >= from AND
 * createdAt < to` (half-open, matching finance-analytics).
 */
export function rangeInstants(range: ResolvedRange): { from: Date; to: Date } {
	return { from: dayIndexInstant(range.fromDay), to: dayIndexInstant(range.toDayExclusive) };
}
