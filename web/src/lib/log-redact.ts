/**
 * Field redaction for structured logs — TS mirror of `agent/lib/log_redact.py`.
 * Same key sets, same masking rules, so log shape is consistent across web
 * and agent.
 */
const REDACT_KEYS = new Set([
	'auth_token',
	'password',
	'bearer',
	'api_key',
	'secret',
	'token',
	'authorization',
]);
const PHONE_KEYS = new Set([
	'caller_number',
	'phone_number',
	'from_number',
	'to_number',
]);
const BLOB_KEYS = new Set([
	'transcript',
	'summary',
	'notes',
	'auth_token_enc',
	'config_json',
]);
const EMAIL_KEYS = new Set(['email', 'from_email', 'to_email']);

const EMAIL_RE = /^([^@])[^@]*(@)[^.]*(\..+)$/;

function maskPhone(value: unknown): string {
	const s = String(value ?? '');
	if (s.length <= 4) return '+****';
	return '+****' + s.slice(-4);
}

function maskEmail(value: unknown): string {
	const m = EMAIL_RE.exec(String(value ?? ''));
	if (!m) return '<redacted>';
	return `${m[1]}****${m[2]}****${m[3]}`;
}

export function redactValue(key: string, value: unknown): unknown {
	const k = key.toLowerCase();
	if (REDACT_KEYS.has(k)) return '<redacted>';
	if (PHONE_KEYS.has(k)) return maskPhone(value);
	if (EMAIL_KEYS.has(k)) return maskEmail(value);
	if (BLOB_KEYS.has(k)) {
		let n = 0;
		try {
			n = (value as { length?: number })?.length ?? 0;
		} catch {
			n = 0;
		}
		return `<encrypted, ${n} bytes>`;
	}
	if (Array.isArray(value)) {
		return value.map((v) => redactValue(key, v));
	}
	if (value && typeof value === 'object') {
		return redactObject(value as Record<string, unknown>);
	}
	return value;
}

export function redactObject(
	obj: Record<string, unknown>,
): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(obj)) {
		out[k] = redactValue(k, v);
	}
	return out;
}
