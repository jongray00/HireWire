/**
 * Idempotent SignalWire address provisioning called from the login flow.
 *
 * For a tenant logging in:
 *  1. Ensure the `wizard-agent` SWML resource exists, pointing at
 *     ${PUBLIC_BASE_URL_AGENT}/swml/wizard-agent
 *  2. Ensure the `hirewire-agent` SWML address exists, pointing at the
 *     per-employee SWML route the agent serves.
 *  3. Both resources carry HTTP Basic Auth where the username is the
 *     project_id and the password is the per-project plaintext webhook
 *     password (caller is responsible for encrypting/storing).
 *
 * The contract is idempotent — repeated calls produce the same end state.
 */

export class SignalWireProvisioningError extends Error {
	readonly statusCode: number | undefined;
	constructor(message: string, statusCode?: number) {
		super(message);
		this.name = 'SignalWireProvisioningError';
		this.statusCode = statusCode;
	}
}

export interface ProvisioningCredentials {
	spaceUrl: string;
	projectId: string;
	apiToken: string;
}

export interface ProvisioningResult {
	wizardResourceId: string;
	hirewireAgentResourceId: string;
	webhookBasicAuthUser: string;
	webhookBasicAuthPassword: string;
}

interface FabricResource {
	id: string;
	name: string;
	type?: string;
	display_name?: string;
}

const DEFAULT_TIMEOUT_MS = 10_000;

function normalizeSpaceUrl(spaceUrl: string): string {
	const s = spaceUrl.trim().replace(/\/$/, '');
	if (s.startsWith('http://') || s.startsWith('https://')) return s;
	return 'https://' + s;
}

function basicAuth(projectId: string, token: string): string {
	return (
		'Basic ' + Buffer.from(`${projectId}:${token}`, 'utf-8').toString('base64')
	);
}

async function fetchWithTimeout(
	url: string,
	init: RequestInit,
	timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		return await fetch(url, { ...init, signal: ctrl.signal });
	} finally {
		clearTimeout(timer);
	}
}

async function listResourcesByName(
	spaceUrl: string,
	creds: ProvisioningCredentials,
	name: string,
): Promise<FabricResource[]> {
	const url = `${spaceUrl}/api/fabric/resources?page_size=50&name=${encodeURIComponent(name)}`;
	const res = await fetchWithTimeout(url, {
		method: 'GET',
		headers: { Authorization: basicAuth(creds.projectId, creds.apiToken) },
	});
	if (!res.ok) {
		throw new SignalWireProvisioningError(
			`list resources failed: ${res.status}`,
			res.status,
		);
	}
	const body = (await res.json()) as { data?: FabricResource[] };
	return Array.isArray(body.data) ? body.data : [];
}

async function createSwmlResource(
	spaceUrl: string,
	creds: ProvisioningCredentials,
	input: {
		name: string;
		swmlUrl: string;
		basicAuthUser: string;
		basicAuthPassword: string;
	},
): Promise<FabricResource> {
	const url = `${spaceUrl}/api/fabric/resources`;
	const res = await fetchWithTimeout(url, {
		method: 'POST',
		headers: {
			Authorization: basicAuth(creds.projectId, creds.apiToken),
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			name: input.name,
			type: 'swml',
			swml_url: input.swmlUrl,
			swml_username: input.basicAuthUser,
			swml_password: input.basicAuthPassword,
		}),
	});
	if (!res.ok) {
		throw new SignalWireProvisioningError(
			`create resource ${input.name} failed: ${res.status}`,
			res.status,
		);
	}
	return (await res.json()) as FabricResource;
}

async function updateSwmlResource(
	spaceUrl: string,
	creds: ProvisioningCredentials,
	resourceId: string,
	input: {
		swmlUrl: string;
		basicAuthUser: string;
		basicAuthPassword: string;
	},
): Promise<void> {
	const url = `${spaceUrl}/api/fabric/resources/${resourceId}`;
	const res = await fetchWithTimeout(url, {
		method: 'PATCH',
		headers: {
			Authorization: basicAuth(creds.projectId, creds.apiToken),
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			swml_url: input.swmlUrl,
			swml_username: input.basicAuthUser,
			swml_password: input.basicAuthPassword,
		}),
	});
	if (!res.ok) {
		throw new SignalWireProvisioningError(
			`update resource ${resourceId} failed: ${res.status}`,
			res.status,
		);
	}
}

async function ensureSwmlResource(
	spaceUrl: string,
	creds: ProvisioningCredentials,
	input: {
		name: string;
		swmlUrl: string;
		basicAuthUser: string;
		basicAuthPassword: string;
	},
): Promise<string> {
	const existing = await listResourcesByName(spaceUrl, creds, input.name);
	if (existing.length === 0) {
		const created = await createSwmlResource(spaceUrl, creds, input);
		return created.id;
	}
	// Reuse the first match; PATCH it so the URL + creds are current.
	const reused = existing[0];
	await updateSwmlResource(spaceUrl, creds, reused.id, {
		swmlUrl: input.swmlUrl,
		basicAuthUser: input.basicAuthUser,
		basicAuthPassword: input.basicAuthPassword,
	});
	return reused.id;
}

export interface ProvisionArgs {
	credentials: ProvisioningCredentials;
	publicBaseUrlAgent: string;
	webhookBasicAuthPassword: string;
	defaultEmployeeId?: string;
}

/**
 * Provision the two HireWire SWML resources (`wizard-agent` and
 * `hirewire-agent`) on the given SignalWire space. Idempotent.
 *
 * `webhookBasicAuthPassword` is the plaintext password the caller has already
 * generated and persisted (encrypted) into the projects table. We pass it
 * through to SignalWire so that incoming SWML/SWAIG webhooks include it as
 * Basic Auth, and the agent's webhook middleware can verify it.
 *
 * The basic-auth username is set to the `project_id` to match the agent's
 * webhook auth lookup model (username = project_id, password = decrypted
 * `webhook_password_enc`).
 */
export async function provisionForLogin(
	args: ProvisionArgs,
): Promise<ProvisioningResult> {
	const space = normalizeSpaceUrl(args.credentials.spaceUrl);
	const baseAgent = args.publicBaseUrlAgent.replace(/\/$/, '');
	const employee = args.defaultEmployeeId ?? 'default';
	const basicAuthUser = args.credentials.projectId;
	const basicAuthPassword = args.webhookBasicAuthPassword;

	const wizardId = await ensureSwmlResource(space, args.credentials, {
		name: 'wizard-agent',
		swmlUrl: `${baseAgent}/swml/wizard-agent`,
		basicAuthUser,
		basicAuthPassword,
	});

	const hirewireId = await ensureSwmlResource(space, args.credentials, {
		name: 'hirewire-agent',
		swmlUrl: `${baseAgent}/swml/${employee}`,
		basicAuthUser,
		basicAuthPassword,
	});

	return {
		wizardResourceId: wizardId,
		hirewireAgentResourceId: hirewireId,
		webhookBasicAuthUser: basicAuthUser,
		webhookBasicAuthPassword: basicAuthPassword,
	};
}

/** Test seam: exposed for unit tests that want to mock individual steps. */
export const __test = {
	listResourcesByName,
	createSwmlResource,
	updateSwmlResource,
	normalizeSpaceUrl,
	basicAuth,
};
