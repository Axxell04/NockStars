<script lang="ts">
	interface TrendPoint {
		day: string;
		revenue: number;
		outflow: number;
	}

	interface Props {
		/** Server zero-filled daily series, zipped by the caller. */
		points: TrendPoint[];
	}

	let { points }: Props = $props();

	// Fixed plot height; the viewBox width tracks the container so strokes,
	// dots and axis text render at true pixel size on every breakpoint.
	const PLOT_HEIGHT = 240;
	const PAD = { top: 16, right: 12, bottom: 26, left: 60 };

	let container: HTMLDivElement | undefined = $state();
	let width = $state(640);
	let hoverIndex: number | null = $state(null);

	$effect(() => {
		if (!container) {
			return;
		}
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (entry) {
				width = entry.contentRect.width;
			}
		});
		observer.observe(container);
		return () => observer.disconnect();
	});

	const plotHeight = PLOT_HEIGHT - PAD.top - PAD.bottom;
	let plotWidth = $derived(Math.max(1, width - PAD.left - PAD.right));
	let hasActivity = $derived(points.some((point) => point.revenue > 0 || point.outflow > 0));
	let maxValue = $derived(
		Math.max(1, ...points.map((point) => Math.max(point.revenue, point.outflow)))
	);
	let showDots = $derived(points.length <= 7);

	let revenueTotal = $derived(points.reduce((sum, point) => sum + point.revenue, 0));
	let outflowTotal = $derived(points.reduce((sum, point) => sum + point.outflow, 0));
	let peakIndex = $derived(
		points.reduce((best, point, index) => (point.revenue > points[best].revenue ? index : best), 0)
	);

	let yTicks = $derived([0, maxValue / 2, maxValue]);
	let xTickIndexes = $derived(
		points.length <= 1
			? [0]
			: [0, Math.floor((points.length - 1) / 2), points.length - 1].filter(
					(index, position, list) => list.indexOf(index) === position
				)
	);

	function xAt(index: number): number {
		return (
			PAD.left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth)
		);
	}

	function yAt(value: number): number {
		return PAD.top + plotHeight - (value / maxValue) * plotHeight;
	}

	function buildPath(select: (point: TrendPoint) => number): string {
		return points
			.map(
				(point, index) =>
					`${index === 0 ? 'M' : 'L'}${xAt(index).toFixed(1)},${yAt(select(point)).toFixed(1)}`
			)
			.join(' ');
	}

	let revenuePath = $derived(buildPath((point) => point.revenue));
	let outflowPath = $derived(buildPath((point) => point.outflow));
	let revenueAreaPath = $derived(
		`${revenuePath} L${xAt(points.length - 1).toFixed(1)},${(PAD.top + plotHeight).toFixed(1)} L${xAt(0).toFixed(1)},${(PAD.top + plotHeight).toFixed(1)} Z`
	);

	let hoverPoint = $derived(hoverIndex === null ? null : points[hoverIndex]);

	let chartLabel = $derived.by(() => {
		const first = points[0];
		const last = points[points.length - 1];
		if (!first || !last) {
			return 'Tendencia diaria de ingresos y salidas.';
		}
		return `Tendencia diaria: ingresos vs. costos y gastos, del ${formatLongDay(first.day)} al ${formatLongDay(last.day)}.`;
	});

	let chartSummary = $derived.by(() => {
		const peak = points[peakIndex];
		if (!peak) {
			return 'Sin datos en el rango seleccionado.';
		}
		return `Totales del rango: ingresos $ ${revenueTotal.toFixed(2)}, costos y gastos $ ${outflowTotal.toFixed(2)}. Mayor ingreso diario: $ ${peak.revenue.toFixed(2)} el ${formatLongDay(peak.day)}.`;
	});

	function parseDay(day: string): Date {
		return new Date(
			Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10)))
		);
	}

	function formatDay(day: string): string {
		return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
	}

	function formatLongDay(day: string): string {
		return parseDay(day).toLocaleDateString('es-EC', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
			timeZone: 'UTC'
		});
	}

	function formatAxisMoney(value: number): string {
		return `$ ${value.toLocaleString('es-EC', { maximumFractionDigits: 0 })}`;
	}

	function formatMoney(value: number): string {
		return `$ ${value.toFixed(2)}`;
	}

	function handlePointerMove(event: PointerEvent) {
		// Touch taps fire pointermove too; the guide is a mouse affordance only.
		if (event.pointerType !== 'mouse' || points.length === 0) {
			return;
		}
		const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
		const relative = (event.clientX - bounds.left - PAD.left) / plotWidth;
		hoverIndex = Math.min(
			points.length - 1,
			Math.max(0, Math.round(relative * (points.length - 1)))
		);
	}
</script>

{#snippet legendDot(color: string)}
	<span class="h-2 w-2 rounded-full {color}"></span>
{/snippet}

<div class="flex flex-row flex-wrap items-center gap-4 text-xs">
	<span class="text-text-secondary flex flex-row items-center gap-1.5">
		{@render legendDot('bg-brand-400')}
		Ingresos
	</span>
	<span class="text-text-secondary flex flex-row items-center gap-1.5">
		{@render legendDot('bg-text-secondary')}
		Costos + gastos
	</span>
</div>

{#if !hasActivity}
	<div
		class="text-text-secondary flex min-h-40 items-center justify-center p-6 text-center text-sm"
	>
		Sin actividad registrada en este rango. Prueba con otro periodo.
	</div>
{:else}
	<div bind:this={container} class="relative w-full">
		<svg
			viewBox="0 0 {width} {PLOT_HEIGHT}"
			class="block h-60 w-full"
			role="img"
			aria-label={chartLabel}
			onpointermove={handlePointerMove}
			onpointerleave={() => (hoverIndex = null)}
		>
			<defs>
				<linearGradient id="finance-revenue-area" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stop-color="var(--color-brand-400)" stop-opacity="0.16" />
					<stop offset="100%" stop-color="var(--color-brand-400)" stop-opacity="0" />
				</linearGradient>
			</defs>
			{#each yTicks as tick (tick)}
				<line
					x1={PAD.left}
					x2={width - PAD.right}
					y1={yAt(tick)}
					y2={yAt(tick)}
					class="stroke-surface-3"
					stroke-width="1"
				/>
				<text
					x={PAD.left - 8}
					y={yAt(tick)}
					class="fill-text-muted"
					font-size="11"
					text-anchor="end"
					dominant-baseline="middle">{formatAxisMoney(tick)}</text
				>
			{/each}
			{#each xTickIndexes as index (index)}
				<text
					x={xAt(index)}
					y={PLOT_HEIGHT - 8}
					class="fill-text-muted"
					font-size="11"
					text-anchor="middle">{formatDay(points[index].day)}</text
				>
			{/each}
			<path d={revenueAreaPath} fill="url(#finance-revenue-area)" />
			<path
				d={outflowPath}
				fill="none"
				stroke="var(--color-text-secondary)"
				stroke-width="2"
				stroke-linejoin="round"
				stroke-linecap="round"
			/>
			<path
				d={revenuePath}
				fill="none"
				stroke="var(--color-brand-400)"
				stroke-width="2"
				stroke-linejoin="round"
				stroke-linecap="round"
			/>
			{#if showDots}
				{#each points as point, index (index)}
					<circle
						cx={xAt(index)}
						cy={yAt(point.outflow)}
						r="3"
						class="fill-surface-1 stroke-text-secondary"
						stroke-width="2"
					/>
					<circle
						cx={xAt(index)}
						cy={yAt(point.revenue)}
						r="3"
						class="fill-surface-1 stroke-brand-400"
						stroke-width="2"
					/>
				{/each}
			{/if}
			{#if hoverIndex !== null}
				<line
					x1={xAt(hoverIndex)}
					x2={xAt(hoverIndex)}
					y1={PAD.top}
					y2={PAD.top + plotHeight}
					class="stroke-text-muted"
					stroke-width="1"
					stroke-dasharray="3 3"
				/>
			{/if}
		</svg>
		{#if hoverPoint}
			<div
				class="bg-surface-1/95 shadow-depth pointer-events-none absolute top-2 right-2 rounded-xl border border-white/8 px-3 py-2 text-xs backdrop-blur-xl"
			>
				<span class="text-text-primary block font-medium">
					{formatLongDay(hoverPoint.day)}
				</span>
				<span class="text-brand-400 block tabular-nums">
					Ingresos: {formatMoney(hoverPoint.revenue)}
				</span>
				<span class="text-text-secondary block tabular-nums">
					Costos + gastos: {formatMoney(hoverPoint.outflow)}
				</span>
			</div>
		{/if}
	</div>
	<p class="sr-only">{chartSummary}</p>
{/if}
