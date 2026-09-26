<script lang="ts">
	import { page } from '$app/state';
	import Icon from '@iconify/svelte';
	import '../app.css';
	import NavItem from '$lib/components/NavItem.svelte';
	import { goto } from '$app/navigation';
	import { renderJsonLdScript } from '$lib/json-ld';
	import type { LayoutProps } from './$types';
	import { scale, slide } from 'svelte/transition';

	let { data, children }: LayoutProps = $props();

	// SEO: pages override via `seo` in their +page.server.ts load return
	let pageData = $derived(page.data as Record<string, unknown>);
	let seo = $derived((pageData?.seo as Record<string, unknown>) ?? {});
	let seoTitle = $derived((seo.title as string) ?? 'NockStars — Tienda de Camisetas');
	let seoDescription = $derived(
		(seo.description as string) ??
			'NockStars es tu tienda online de camisetas personalizadas. Catálogo exclusivo, pedidos por encargo y envíos a todo el país.'
	);
	let seoImage = $derived((seo.image as string) ?? '/nock-logo.png');
	let seoUrl = $derived(page.url.href);
	let seoType = $derived((seo.type as string) ?? 'website');

	// Schema.org structured data. Routed through renderJsonLdScript because
	// Svelte escapes text interpolation, which would corrupt the JSON, so it has
	// to be injected as raw markup and the escaping is ours to guarantee.
	let jsonLd = $derived(
		renderJsonLdScript({
			'@context': 'https://schema.org',
			'@type': 'Organization',
			name: 'NockStars',
			url: seoUrl,
			logo: seoImage,
			description: seoDescription
		})
	);

	let cartCount = $derived((data.cartCount as number) ?? 0);

	let actualRoute = $derived(page.route.id);

	let cardSelectNavMenuIsVisible = $state(false);
	let mobileNavIsVisible = $state(false);

	function toggleCardSelectNavMenuIsVisible(visible?: boolean) {
		if (typeof visible === 'undefined') {
			cardSelectNavMenuIsVisible = !cardSelectNavMenuIsVisible;
		} else {
			cardSelectNavMenuIsVisible = visible;
		}
	}

	function toggleMobileNavIsVisible(visible?: boolean) {
		if (typeof visible === 'undefined') {
			mobileNavIsVisible = !mobileNavIsVisible;
		} else {
			mobileNavIsVisible = visible;
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

	<!-- Fonts: preconnect + link — Only essential weights -->
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
	<!-- Cinzel: only 400, 700, 900 (titles/brand) -->
	<link
		href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&display=swap"
		rel="stylesheet"
	/>
	<!-- PT Sans: 400, 700 + italic (body text) -->
	<link
		href="https://fonts.googleapis.com/css2?family=PT+Sans:ital,wght@0,400;0,700;1,400;1,700&display=swap"
		rel="stylesheet"
	/>

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
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- JSON-LD cannot use Svelte's escaping or it stops being valid JSON; renderJsonLdScript escapes every `<` so the payload cannot close this script element early -->
	{@html jsonLd}
</svelte:head>

<!-- Threadverse animated background -->
<div class="threadverse-bg" aria-hidden="true">
	<!-- Mesh gradient orbs -->
	<div class="mesh-orb mesh-orb-1"></div>
	<div class="mesh-orb mesh-orb-2"></div>
	<div class="mesh-orb mesh-orb-3"></div>
	<div class="mesh-orb mesh-orb-4"></div>

	<!-- Floating thread particles — Only 4 for performance -->
	<div class="thread-particles">
		<div class="thread-particle thread-particle-1"></div>
		<div class="thread-particle thread-particle-2"></div>
		<div class="thread-particle thread-particle-3"></div>
		<div class="thread-particle thread-particle-4"></div>
	</div>
</div>

<!-- Header principal — Threadverse immersive header -->
<header class="w-full">
	<!-- Thread accent line at top -->
	<div
		class="via-brand-400/30 absolute top-0 right-0 left-0 h-[1px] bg-gradient-to-r from-transparent to-transparent"
	></div>

	<!-- Barra superior: usuario + admin -->
	{#if data.user}
		<div
			class="flex items-center justify-end gap-3 border-b border-white/4 px-4 py-1.5 text-sm sm:gap-4 sm:px-6"
		>
			<span class="text-text-muted flex min-w-0 items-center gap-1.5">
				<Icon icon="mdi:account-circle-outline" class="flex-shrink-0 text-base" />
				<span class="max-w-[6rem] truncate">{data.user?.username}</span>
			</span>
			{#if data.user.admin}
				<a
					href="/admin/cuentas"
					class="text-text-muted hover:text-brand-400 focus:text-brand-400 flex items-center gap-1 transition-colors duration-200"
					onfocus={(e) => cancelFocus(e)}
					aria-label="Cuentas de administrador"
				>
					<Icon icon="mdi:shield-account-outline" class="text-base" />
					<span class="hidden sm:inline">Admin</span>
				</a>
				<div class="relative" role="menu" aria-label="Menú de administración financiera">
					<button
						class="text-text-muted hover:text-brand-400 focus:text-brand-400 flex items-center gap-1 transition-colors duration-200"
						onclick={() => {
							toggleCardSelectNavMenuIsVisible();
							toggleMobileNavIsVisible(false);
						}}
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
							class="bg-surface-1/95 shadow-depth absolute right-0 z-50 mt-1 w-44 overflow-hidden rounded-xl border border-white/8 backdrop-blur-xl"
							role="menu"
						>
							<a
								href="/admin/balance"
								class="text-text-secondary hover:bg-surface-2 hover:text-brand-400 flex items-center gap-2.5 px-4 py-2.5 text-sm transition-all hover:pl-5"
								onclick={() => toggleCardSelectNavMenuIsVisible(false)}
								onfocus={(e) => cancelFocus(e)}
								role="menuitem"
							>
								<Icon icon="mdi:chart-line" class="text-base" />
								Balance
							</a>
							<a
								href="/admin/pedidos"
								class="text-text-secondary hover:bg-surface-2 hover:text-brand-400 flex items-center gap-2.5 px-4 py-2.5 text-sm transition-all hover:pl-5"
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
					class="text-text-muted hover:text-brand-400 flex items-center gap-1 transition-colors duration-200"
					aria-label="Cerrar sesión"
				>
					<Icon icon="mdi:logout" class="text-base" />
				</button>
			</form>
		</div>
	{/if}

	<!-- Barra principal: logo + nav + acciones -->
	<div class="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
		<!-- Logo — Threadverse branded -->
		<div class="flex items-center gap-2 sm:gap-3">
			<button
				class="transition-transform duration-300 hover:scale-105 active:scale-95"
				onclick={() => goto('/admin')}
				onfocus={(e) => cancelFocus(e)}
				aria-label="Ir al panel de administración"
			>
				<img src="/nock-logo.png" alt="logo de NockStars" class="h-10 w-auto" />
			</button>
			<a
				class="group hover:text-brand-400 relative px-2 transition-colors duration-200"
				href="/"
				onfocus={(e) => cancelFocus(e)}
			>
				<h1
					class="text-text-primary text-lg font-bold tracking-wider min-[420px]:text-xl sm:text-2xl"
				>
					NockStars
					<span
						class="from-brand-400 to-brand-600 absolute -bottom-1 left-0 h-[2px] w-0 bg-gradient-to-r transition-all duration-500 group-hover:w-full"
					></span>
				</h1>
			</a>
		</div>

		<!-- Navegación — Thread-connected nav -->
		<nav class="hidden items-center gap-1 md:flex" aria-label="Navegación principal">
			<NavItem name="Tienda" endPoint={validityAnchor('/')} {actualRoute} />
			<NavItem name="Catálogo" endPoint={validityAnchor('/catalogo')} {actualRoute} />
			<NavItem name="Contacto" endPoint={validityAnchor('/contacto')} {actualRoute} />
		</nav>

		<!-- Acciones -->
		<div class="flex items-center gap-3">
			<!-- Mobile menu button -->
			<button
				class="text-text-muted hover:text-brand-400 flex items-center justify-center p-2 transition-colors md:hidden"
				onclick={() => {
					toggleMobileNavIsVisible();
					toggleCardSelectNavMenuIsVisible(false);
				}}
				aria-label="Menú de navegación"
			>
				<Icon icon="mdi:menu" class="text-2xl" />
			</button>

			<!-- Cart — Thread-wrapped -->
			<a
				href="/carrito"
				class="group text-text-muted hover:bg-surface-2 hover:text-brand-400 relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200"
				onfocus={(e) => cancelFocus(e)}
				aria-label="Ir al carrito"
			>
				<Icon icon="bi:cart-fill" class="text-lg" />
				<span class="hidden sm:inline">Carrito</span>
				{#if cartCount > 0}
					<span
						class="bg-brand-500 text-surface-0 shadow-glow-sm absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-bold transition-transform duration-300 group-hover:scale-110"
					>
						{cartCount > 99 ? '99+' : cartCount}
					</span>
				{/if}
			</a>
		</div>
	</div>

	<!-- Mobile nav drawer — Thread-animated -->
	{#if mobileNavIsVisible}
		<nav
			transition:slide={{ duration: 250, easing: (t) => 1 - Math.pow(1 - t, 3) }}
			class="flex flex-col gap-1 border-t border-white/5 px-6 py-3 md:hidden"
			aria-label="Navegación móvil"
		>
			<a
				href={validityAnchor('/')}
				class="text-text-secondary hover:bg-surface-2 hover:text-brand-400 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:pl-4"
				onclick={() => toggleMobileNavIsVisible(false)}
			>
				Tienda
			</a>
			<a
				href={validityAnchor('/catalogo')}
				class="text-text-secondary hover:bg-surface-2 hover:text-brand-400 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:pl-4"
				onclick={() => toggleMobileNavIsVisible(false)}
			>
				Catálogo
			</a>
			<a
				href={validityAnchor('/contacto')}
				class="text-text-secondary hover:bg-surface-2 hover:text-brand-400 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:pl-4"
				onclick={() => toggleMobileNavIsVisible(false)}
			>
				Contacto
			</a>
		</nav>
	{/if}
</header>

<!-- Contenido principal — Threadverse content area -->
<main class="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
	{@render children()}
</main>

<style>
	:global(body) {
		background-color: var(--color-surface-0);
		color: var(--color-text-primary);
		max-width: 100dvw;
	}
</style>
