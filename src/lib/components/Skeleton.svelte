<!--
	Placeholder block for content that is still loading.

	Sits on the app's existing `.shimmer` gradient (surface-1 ↔ surface-2), so a
	loading placeholder speaks the same surface language as the content it is
	standing in for. Size and shape come entirely from `class`; reduced-motion
	users get a static block from the global rule in app.css.
-->
<script lang="ts">
	let { class: className = '' }: { class?: string } = $props();
</script>

<span class="shimmer block {className}"></span>
