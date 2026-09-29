<!--
	Inline stroke spinner for in-flight button states.
	Rotates via Tailwind's animate-spin, inherits the control's own tint through
	currentColor, and stops spinning entirely for reduced-motion users.
	Fixed at 16px on purpose: every cart control speaks the same spinner size.
-->
<svg
	class="h-4 w-4 animate-spin motion-reduce:animate-none"
	width="16"
	height="16"
	viewBox="0 0 24 24"
	fill="none"
	aria-hidden="true"
	focusable="false"
>
	<!-- Faint full-ring track; rotation is invisible on a full circle, so it reads as static. -->
	<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" class="opacity-25" />
	<!-- Quarter-arc with a round cap: crisp, modern, and cheap to render. -->
	<path
		d="M12 2a10 10 0 0 1 10 10"
		stroke="currentColor"
		stroke-width="2.5"
		stroke-linecap="round"
	/>
</svg>
