/**
 * AES-GCM-256 field encryption — wire-format compatible with
 * `agent/lib/crypto.py`. Use this on the web side (server only) to encrypt /
 * decrypt secrets stored in the shared SQLite DB.
 *
 * Wire format:
 *   version (1 byte = 0x01) || nonce (12 bytes) || ciphertext || tag (16 bytes)
 *
 * The Python KAT vector in `agent/tests/test_crypto.py` is the cross-stack
 * test fixture — `tests/crypto.kat.test.ts` decrypts the same bytes.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const VERSION_BYTE = 0x01;
export const NONCE_LEN = 12;
export const TAG_LEN = 16;
export const MIN_BLOB_LEN = 1 + NONCE_LEN + TAG_LEN;

export class CryptoError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CryptoError';
	}
}

let _cachedKey: Buffer | null = null;

function loadKey(): Buffer {
	if (_cachedKey) return _cachedKey;
	const raw = process.env.ENCRYPTION_KEY;
	if (!raw) {
		throw new CryptoError('ENCRYPTION_KEY env var is not set');
	}
	let decoded: Buffer;
	try {
		decoded = Buffer.from(raw, 'base64');
	} catch (e) {
		throw new CryptoError('ENCRYPTION_KEY must be base64-encoded');
	}
	if (decoded.length !== 32) {
		throw new CryptoError(
			`ENCRYPTION_KEY must decode to exactly 32 bytes; got ${decoded.length}`,
		);
	}
	_cachedKey = decoded;
	return decoded;
}

/** Test-only: clear cached key so a fresh ENCRYPTION_KEY env value takes effect. */
export function _resetCacheForTests(): void {
	_cachedKey = null;
}

export function encrypt(plaintext: string | Buffer | Uint8Array): Buffer {
	const key = loadKey();
	const data =
		typeof plaintext === 'string'
			? Buffer.from(plaintext, 'utf-8')
			: Buffer.from(plaintext);
	const nonce = randomBytes(NONCE_LEN);
	const cipher = createCipheriv('aes-256-gcm', key, nonce);
	const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
	const tag = cipher.getAuthTag();
	return Buffer.concat([Buffer.from([VERSION_BYTE]), nonce, ciphertext, tag]);
}

export function decrypt(blob: Buffer | Uint8Array): Buffer {
	const buf = Buffer.from(blob);
	if (buf.length < MIN_BLOB_LEN) {
		throw new CryptoError(
			`blob too short (${buf.length} bytes; min ${MIN_BLOB_LEN})`,
		);
	}
	const version = buf[0];
	if (version !== VERSION_BYTE) {
		throw new CryptoError(
			`unknown crypto version byte 0x${version.toString(16).padStart(2, '0')}`,
		);
	}
	const nonce = buf.subarray(1, 1 + NONCE_LEN);
	// Tag is the last 16 bytes; ciphertext is everything between.
	const ciphertext = buf.subarray(1 + NONCE_LEN, buf.length - TAG_LEN);
	const tag = buf.subarray(buf.length - TAG_LEN);
	const key = loadKey();
	const decipher = createDecipheriv('aes-256-gcm', key, nonce);
	decipher.setAuthTag(tag);
	try {
		return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	} catch (e) {
		throw new CryptoError(
			'decryption failed (tag mismatch or corrupted ciphertext)',
		);
	}
}

/** Convenience: encrypt and return a hex string. */
export function encryptToHex(plaintext: string): string {
	return encrypt(plaintext).toString('hex');
}

/** Convenience: decrypt from hex string back to UTF-8. */
export function decryptFromHex(hex: string): string {
	return decrypt(Buffer.from(hex, 'hex')).toString('utf-8');
}
