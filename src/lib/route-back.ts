export function resolveSafeReturnTarget({
	currentOrigin,
	referrer,
	returnTo,
	fallback = '/'
}: {
	currentOrigin: string;
	referrer?: string;
	returnTo?: string | null;
	fallback?: string;
}): string {
	const normalizePath = (value: string) => {
		if (!value || value === '#') return null;
		const trimmed = value.trim();
		if (!trimmed || trimmed === 'null' || trimmed === 'undefined') return null;
		return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
	};

	const isSafeInternalPath = (pathname: string) => {
		if (!pathname || pathname === '/login') return false;
		if (pathname.startsWith('/admin/producto/')) return false;
		return pathname.startsWith('/') || pathname === '/';
	};

	const candidate = normalizePath(returnTo ?? '');
	if (candidate && isSafeInternalPath(candidate)) {
		try {
			const returnUrl = new URL(candidate, currentOrigin);
			if (returnUrl.origin === currentOrigin) {
				if (returnUrl.pathname === '/login' || returnUrl.pathname.startsWith('/admin/producto/')) {
					return fallback;
				}
				return `${returnUrl.pathname}${returnUrl.search}` || fallback;
			}
		} catch {
			// ignore invalid returnTo values and continue to the referrer fallback
		}
	}

	if (!referrer) {
		return fallback;
	}

	try {
		const referrerUrl = new URL(referrer);
		if (referrerUrl.origin !== currentOrigin) {
			return fallback;
		}

		const pathname = referrerUrl.pathname;
		if (pathname === '/login' || pathname.startsWith('/admin/producto/')) {
			return fallback;
		}

		if (pathname.startsWith('/admin')) {
			return `${pathname}${referrerUrl.search}` || fallback;
		}

		const target = `${pathname}${referrerUrl.search}`;
		return target || fallback;
	} catch {
		return fallback;
	}
}
