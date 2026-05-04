import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import {
	SignalWireProvisioningError,
	provisionForLogin,
	__test,
} from '@/lib/signalwire-provisioning';

const SPACE = 'acme.signalwire.com';
const PROJECT = 'proj-1';
const TOKEN = 'PT_token';
const WEBHOOK_PW = 'whp_test_password_long';
const BASE_AGENT = 'https://agent.example.com';

interface MockedRoute {
	method: string;
	urlPattern: RegExp;
	respond: () => Response;
}

let routes: MockedRoute[];
let calls: { url: string; init: RequestInit }[];

beforeEach(() => {
	routes = [];
	calls = [];
	const fetchSpy = vi
		.spyOn(globalThis, 'fetch')
		.mockImplementation(async (url, init) => {
			const u = String(url);
			calls.push({ url: u, init: init ?? {} });
			const method = (init?.method ?? 'GET').toUpperCase();
			// Consume routes FIFO so multiple matches at the same URL pattern
			// can return distinct responses in order.
			for (let i = 0; i < routes.length; i++) {
				const r = routes[i];
				if (r.method === method && r.urlPattern.test(u)) {
					routes.splice(i, 1);
					return r.respond();
				}
			}
			return new Response('not mocked: ' + u, { status: 599 });
		});
	void fetchSpy;
});

afterEach(() => {
	vi.restoreAllMocks();
});

function mockOnce(route: MockedRoute) {
	routes.push(route);
}

function listEmpty(name: string) {
	mockOnce({
		method: 'GET',
		urlPattern: new RegExp(
			`/api/fabric/resources\\?page_size=\\d+&name=${name}$`,
		),
		respond: () => new Response(JSON.stringify({ data: [] }), { status: 200 }),
	});
}

function listExisting(name: string, id: string) {
	mockOnce({
		method: 'GET',
		urlPattern: new RegExp(
			`/api/fabric/resources\\?page_size=\\d+&name=${name}$`,
		),
		respond: () =>
			new Response(JSON.stringify({ data: [{ id, name }] }), { status: 200 }),
	});
}

function createResource(name: string, id: string) {
	mockOnce({
		method: 'POST',
		urlPattern: /\/api\/fabric\/resources$/,
		respond: () =>
			new Response(JSON.stringify({ id, name, type: 'swml' }), {
				status: 201,
			}),
	});
}

function patchResource() {
	mockOnce({
		method: 'PATCH',
		urlPattern: /\/api\/fabric\/resources\/[^/]+$/,
		respond: () => new Response('{}', { status: 200 }),
	});
}

describe('provisionForLogin', () => {
	test('creates both resources when neither exists', async () => {
		listEmpty('wizard-agent');
		createResource('wizard-agent', 'wiz-1');
		listEmpty('hirewire-agent');
		createResource('hirewire-agent', 'hw-1');

		const result = await provisionForLogin({
			credentials: { spaceUrl: SPACE, projectId: PROJECT, apiToken: TOKEN },
			publicBaseUrlAgent: BASE_AGENT,
			webhookBasicAuthPassword: WEBHOOK_PW,
		});

		expect(result.wizardResourceId).toBe('wiz-1');
		expect(result.hirewireAgentResourceId).toBe('hw-1');
		expect(result.webhookBasicAuthUser).toBe(PROJECT);
		expect(result.webhookBasicAuthPassword).toBe(WEBHOOK_PW);

		// 2 lists + 2 creates
		expect(calls).toHaveLength(4);
	});

	test('reuses + PATCHes existing wizard resource', async () => {
		listExisting('wizard-agent', 'wiz-existing');
		patchResource();
		listEmpty('hirewire-agent');
		createResource('hirewire-agent', 'hw-new');

		const result = await provisionForLogin({
			credentials: { spaceUrl: SPACE, projectId: PROJECT, apiToken: TOKEN },
			publicBaseUrlAgent: BASE_AGENT,
			webhookBasicAuthPassword: WEBHOOK_PW,
		});

		expect(result.wizardResourceId).toBe('wiz-existing');
		expect(result.hirewireAgentResourceId).toBe('hw-new');

		const patches = calls.filter((c) => (c.init.method ?? 'GET') === 'PATCH');
		expect(patches).toHaveLength(1);
		const body = JSON.parse(patches[0].init.body as string);
		expect(body.swml_url).toContain('/swml/wizard-agent');
		expect(body.swml_password).toBe(WEBHOOK_PW);
		expect(body.swml_username).toBe(PROJECT);
	});

	test('PATCH always rotates webhook creds on existing resource', async () => {
		listExisting('wizard-agent', 'wiz-1');
		patchResource();
		listExisting('hirewire-agent', 'hw-1');
		patchResource();

		await provisionForLogin({
			credentials: { spaceUrl: SPACE, projectId: PROJECT, apiToken: TOKEN },
			publicBaseUrlAgent: BASE_AGENT,
			webhookBasicAuthPassword: 'rotated_pw',
		});

		const patches = calls.filter((c) => (c.init.method ?? 'GET') === 'PATCH');
		expect(patches).toHaveLength(2);
		for (const p of patches) {
			const body = JSON.parse(p.init.body as string);
			expect(body.swml_password).toBe('rotated_pw');
		}
	});

	test('throws when SignalWire returns 5xx', async () => {
		mockOnce({
			method: 'GET',
			urlPattern: /\/api\/fabric\/resources\?/,
			respond: () => new Response('boom', { status: 503 }),
		});
		await expect(
			provisionForLogin({
				credentials: { spaceUrl: SPACE, projectId: PROJECT, apiToken: TOKEN },
				publicBaseUrlAgent: BASE_AGENT,
				webhookBasicAuthPassword: WEBHOOK_PW,
			}),
		).rejects.toThrow(SignalWireProvisioningError);
	});

	test('throws when SignalWire returns 401 on initial list', async () => {
		mockOnce({
			method: 'GET',
			urlPattern: /\/api\/fabric\/resources\?/,
			respond: () => new Response('unauthorized', { status: 401 }),
		});
		const err = await provisionForLogin({
			credentials: { spaceUrl: SPACE, projectId: PROJECT, apiToken: 'wrong' },
			publicBaseUrlAgent: BASE_AGENT,
			webhookBasicAuthPassword: WEBHOOK_PW,
		}).catch((e) => e);
		expect(err).toBeInstanceOf(SignalWireProvisioningError);
		expect(err.statusCode).toBe(401);
	});

	test('honors a custom defaultEmployeeId in the hirewire-agent SWML URL', async () => {
		listEmpty('wizard-agent');
		createResource('wizard-agent', 'w');
		listEmpty('hirewire-agent');
		createResource('hirewire-agent', 'h');

		await provisionForLogin({
			credentials: { spaceUrl: SPACE, projectId: PROJECT, apiToken: TOKEN },
			publicBaseUrlAgent: BASE_AGENT,
			webhookBasicAuthPassword: WEBHOOK_PW,
			defaultEmployeeId: 'emp-42',
		});

		const creates = calls.filter((c) => (c.init.method ?? 'GET') === 'POST');
		const hirewireCreate = creates.find((c) => {
			const body = JSON.parse(c.init.body as string);
			return body.name === 'hirewire-agent';
		});
		expect(hirewireCreate).toBeDefined();
		const body = JSON.parse(hirewireCreate!.init.body as string);
		expect(body.swml_url).toBe(`${BASE_AGENT}/swml/emp-42`);
	});
});

describe('helpers', () => {
	test('normalizeSpaceUrl adds https:// and strips trailing slash', () => {
		expect(__test.normalizeSpaceUrl('acme.signalwire.com')).toBe(
			'https://acme.signalwire.com',
		);
		expect(__test.normalizeSpaceUrl('https://acme.signalwire.com/')).toBe(
			'https://acme.signalwire.com',
		);
	});

	test('basicAuth produces RFC-7617 header', () => {
		expect(__test.basicAuth('u', 'p')).toBe(
			'Basic ' + Buffer.from('u:p').toString('base64'),
		);
	});
});
