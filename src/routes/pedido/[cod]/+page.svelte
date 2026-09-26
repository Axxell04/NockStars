<script lang="ts">
	const { data } = $props();
	const message = data.message;
</script>

<h1 class="p-10 text-center text-xl">
	{message}
</h1>
