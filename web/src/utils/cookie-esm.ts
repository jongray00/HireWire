/**
 * Cookie ESM Entry Point
 *
 * This file forces Vite's dependency scanner to detect and pre-bundle the 'cookie' package.
 *
 * Problem: The cookie@0.7.2 package uses CommonJS exports (exports.parse = parse)
 * but browsers expect ESM imports (import { parse } from 'cookie').
 *
 * Solution: By creating this explicit entry point and adding it to optimizeDeps.include,
 * we force Vite to pre-bundle cookie into an ESM-compatible format in .vite/deps/
 *
 * This ensures browsers receive transformed ESM code instead of raw CommonJS.
 */

// Force Vite to detect and pre-bundle cookie package
export { parse, serialize } from 'cookie';
