// Unit test setup
import { beforeEach, vi } from 'vitest';

// Mock SvelteKit modules
vi.mock('$app/state', () => ({
	page: {
		url: new URL('http://localhost:5173'),
		params: {}
	}
}));

vi.mock('$app/navigation', () => ({
	invalidateAll: vi.fn()
}));

vi.mock('$app/forms', () => ({
	enhance: vi.fn()
}));

// Mock Iconify
vi.mock('@iconify/svelte', () => ({
	default: () => null
}));

// Global test utilities
global.ResizeObserver = vi.fn().mockImplementation(() => ({
	observe: vi.fn(),
	unobserve: vi.fn(),
	disconnect: vi.fn()
}));

beforeEach(() => {
	vi.clearAllMocks();
});
