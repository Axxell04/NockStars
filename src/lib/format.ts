/**
 * Single source of truth for money display on the finance surfaces.
 *
 * The output (`$ 12.34`) replicates the incumbent inline
 * `` `$ {value.toFixed(2)}` `` rendering byte for byte — uniformity is the
 * goal of this helper, not a visual change. Adjust the format here once when
 * the design calls for it; never re-inline `toFixed(2)` at call sites.
 */
export function formatCurrency(value: number): string {
	return `$ ${value.toFixed(2)}`;
}
