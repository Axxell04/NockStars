<script lang="ts">
    const { data } = $props();
    const message = data.message;

</script>
<h1 class="text-center p-10 text-xl">
    {message}
</h1>