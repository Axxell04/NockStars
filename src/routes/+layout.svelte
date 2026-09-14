<script lang="ts">
	import { page } from '$app/state';
	// import { onMount, type Snippet } from 'svelte';
	import Icon from '@iconify/svelte';
	import '../app.css';
	import NavItem from '$lib/components/NavItem.svelte';
	import { goto } from '$app/navigation';
	import type { LayoutProps } from './$types';
	import { scale, slide } from 'svelte/transition';
	let { data, children }: LayoutProps = $props();

	// SEO: pages override via `seo` in their +page.server.ts load return
	let pageData = $derived(page.data as Record<string, unknown>);
	let seo = $derived((pageData?.seo as Record<string, string>) ?? {});
	let seoTitle = $derived(seo.title ?? 'NockStars — Tienda de Camisetas');
	let seoDescription = $derived(seo.description ?? 'NockStars es tu tienda online de camisetas personalizadas. Catálogo exclusivo, pedidos por encargo y envíos a todo el país.');
	let seoImage = $derived(seo.image ?? '/nock-logo.png');
	let seoUrl = $derived(page.url.href);
	let seoType = $derived(seo.type ?? 'website');

	let actualRoute = $derived(page.route.id);

	let btnCardSelectNav: HTMLButtonElement | undefined = $state();
	let btnCardSelectNavHeight = $state(41);

	let cardSelectNavMenuIsVisible = $state(false);

	function toggleCardSelectNavMenuIsVisible(visible?: boolean) {
		if (typeof visible === 'undefined') {
			cardSelectNavMenuIsVisible = !cardSelectNavMenuIsVisible;
		} else {
			cardSelectNavMenuIsVisible = visible;
		}
	}

	function validityAnchor(endPoint: string) {
		if (data.user && actualRoute) {
			if (actualRoute.includes('/admin')) {
				return '/admin' + (endPoint === '/' ? '' : endPoint);
			}
		}
		return endPoint;
	}

	function cancelFocus(e: FocusEvent) {
		const target = e.target as HTMLButtonElement;
		if (target) {
			setTimeout(() => {
				target.blur();
			}, 200);
		}
	}

	$effect(() => {
		if (typeof btnCardSelectNav !== 'undefined') {
			btnCardSelectNavHeight = btnCardSelectNav.offsetHeight;
		}
	});

	// $inspect(actualRoute);
</script>

<svelte:head>
	<!-- Favicon -->
	<link rel="icon" type="image/png" href="/favicon-96x96.png" sizes="96x96" />
	<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
	<link rel="shortcut icon" href="/favicon.ico" />
	<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
	<meta name="apple-mobile-web-app-title" content="NockStars" />
	<link rel="manifest" href="/site.webmanifest" />

	<!-- LCP preload -->
	<link rel="preload" as="image" href="/nock-logo.png" />

	<!-- Fonts: preconnect + link (non-render-blocking) -->
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
	<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400..900&display=swap" rel="stylesheet" />
	<link href="https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,200..1000;1,200..1000&display=swap" rel="stylesheet" />

	<!-- SEO: Title & Description -->
	<title>{seoTitle}</title>
	<meta name="description" content={seoDescription} />

	<!-- SEO: Canonical -->
	<link rel="canonical" href={seoUrl} />

	<!-- Open Graph -->
	<meta property="og:type" content={seoType} />
	<meta property="og:title" content={seoTitle} />
	<meta property="og:description" content={seoDescription} />
	<meta property="og:image" content={seoImage} />
	<meta property="og:url" content={seoUrl} />
	<meta property="og:site_name" content="NockStars" />
	<meta property="og:locale" content="es_AR" />

	<!-- Twitter Card -->
	<meta name="twitter:card" content="summary_large_image" />
	<meta name="twitter:title" content={seoTitle} />
	<meta name="twitter:description" content={seoDescription} />
	<meta name="twitter:image" content={seoImage} />

	<!-- Schema.org structured data -->
	{@html `<script type="application/ld+json">${JSON.stringify({
		"@context": "https://schema.org",
		"@type": "Organization",
		"name": "NockStars",
		"url": seoUrl,
		"logo": seoImage,
		"description": seoDescription
	})}</script>`}
</svelte:head>

<!-- Header principal -->
<header class="sticky top-0 z-50 w-full border-b border-white/5">
	<div class="glass">
		<!-- Barra superior: usuario + admin -->
		{#if data.user}
			<div class="flex items-center justify-end gap-4 px-6 py-1.5 text-sm border-b border-white/5">
				<span class="flex items-center gap-1.5 text-text-muted">
					<Icon icon="mdi:account-circle-outline" class="text-base" />
					{data.user?.username}
				</span>
				{#if data.user.admin}
					<a
						href="/admin/cuentas"
						class="flex items-center gap-1 text-text-muted transition-colors duration-200 hover:text-brand-400 focus:text-brand-400"
						onfocus={(e) => cancelFocus(e)}
						aria-label="Cuentas de administrador"
					>
						<Icon icon="mdi:shield-account-outline" class="text-base" />
						<span class="hidden sm:inline">Admin</span>
					</a>
					<div class="relative" role="menu" aria-label="Menú de administración financiera">
						<button
							bind:this={btnCardSelectNav}
							class="flex items-center gap-1 text-text-muted transition-colors duration-200 hover:text-brand-400 focus:text-brand-400"
							onclick={() => toggleCardSelectNavMenuIsVisible()}
							onfocus={(e) => cancelFocus(e)}
							aria-haspopup="true"
							aria-expanded={cardSelectNavMenuIsVisible}
						>
							<Icon icon="mdi:credit-card-outline" class="text-base" />
							<span class="hidden sm:inline">Finanzas</span>
						</button>
						{#if cardSelectNavMenuIsVisible}
							<div
								transition:scale={{ duration: 150, start: 0.95 }}
								class="absolute right-0 z-50 mt-1 w-40 overflow-hidden rounded-lg border border-white/10 bg-surface-1 shadow-depth"
								role="menu"
							>
								<a
									href="/admin/balance"
									class="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-brand-400"
									onclick={() => toggleCardSelectNavMenuIsVisible(false)}
									onfocus={(e) => cancelFocus(e)}
									role="menuitem"
								>
									<Icon icon="mdi:chart-line" class="text-base" />
									Balance
								</a>
								<a
									href="/admin/pedidos"
									class="flex items-center gap-2 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-brand-400"
									onclick={() => toggleCardSelectNavMenuIsVisible(false)}
									onfocus={(e) => cancelFocus(e)}
									role="menuitem"
								>
									<Icon icon="mdi:package-variant-closed" class="text-base" />
									Pedidos
								</a>
							</div>
						{/if}
					</div>
				{/if}
				<form method="post" action="/admin?/logout">
					<button
						class="flex items-center gap-1 text-text-muted transition-colors duration-200 hover:text-brand-400"
						aria-label="Cerrar sesión"
					>
						<Icon icon="mdi:logout" class="text-base" />
					</button>
				</form>
			</div>
		{/if}

		<!-- Barra principal: logo + nav + acciones -->
		<div class="flex items-center justify-between gap-4 px-6 py-3">
			<!-- Logo -->
			<div class="flex items-center gap-3">
				<button
					class="transition-transform duration-300 hover:scale-105 active:scale-95"
					onclick={() => goto('/admin')}
					onfocus={(e) => cancelFocus(e)}
					aria-label="Ir al panel de administración"
				>
					<img src="/nock-logo.png" alt="logo de NockStars" class="h-10 w-auto" />
				</button>
				<h1 class="text-xl font-bold tracking-wider text-text-accent sm:text-2xl">
					<a class="transition-colors duration-200 hover:text-brand-300" href="/" onfocus={(e) => cancelFocus(e)}>
						nockstars
					</a>
				</h1>
			</div>

			<!-- Navegación -->
			<nav class="hidden items-center gap-1 md:flex" aria-label="Navegación principal">
				<NavItem name="Tienda" endPoint={validityAnchor('/')} {actualRoute} />
				<NavItem name="Catálogo" endPoint={validityAnchor('/catalogo')} {actualRoute} />
				<NavItem name="Contacto" endPoint={validityAnchor('/contacto')} {actualRoute} />
			</nav>

			<!-- Acciones -->
			<div class="flex items-center gap-3">
				<!-- Mobile menu button -->
				<button
					class="flex items-center justify-center p-2 text-text-muted transition-colors hover:text-brand-400 md:hidden"
					onclick={() => toggleCardSelectNavMenuIsVisible()}
					aria-label="Menú de navegación"
				>
					<Icon icon="mdi:menu" class="text-2xl" />
				</button>

			<!-- Cart -->
			<a
				href="/carrito"
				class="group relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-text-muted transition-all duration-200 hover:bg-surface-2 hover:text-brand-400"
				onfocus={(e) => cancelFocus(e)}
				aria-label="Ir al carrito"
			>
				<Icon icon="bi:cart-fill" class="text-lg" />
				<span class="hidden sm:inline">Carrito</span>
			</a>
			</div>
		</div>

		<!-- Mobile nav drawer -->
		{#if cardSelectNavMenuIsVisible}
			<nav
				transition:slide={{ duration: 200 }}
				class="flex flex-col gap-1 border-t border-white/5 px-6 py-3 md:hidden"
				aria-label="Navegación móvil"
			>
				<a
					href={validityAnchor('/')}
					class="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-brand-400"
					onclick={() => toggleCardSelectNavMenuIsVisible(false)}
				>
					Tienda
				</a>
				<a
					href={validityAnchor('/catalogo')}
					class="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-brand-400"
					onclick={() => toggleCardSelectNavMenuIsVisible(false)}
				>
					Catálogo
				</a>
				<a
					href={validityAnchor('/contacto')}
					class="rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-2 hover:text-brand-400"
					onclick={() => toggleCardSelectNavMenuIsVisible(false)}
				>
					Contacto
				</a>
			</nav>
		{/if}
	</div>
</header>

<!-- Contenido principal -->
<main class="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
	{@render children()}
</main>

<style>
	:global(body) {
		background-color: var(--color-surface-0);
		color: var(--color-text-accent);
		max-width: 100dvw;
	}
</style>
