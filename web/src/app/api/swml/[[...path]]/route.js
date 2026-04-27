/**
 * SWML Dynamic Proxy Route (Optional Catch-All)
 *
 * This route proxies requests to the Python backend for SWML generation.
 * Handles both:
 * - /api/swml (legacy, default employee)
 * - /api/swml/{employee_id} (specific employee)
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const PYTHON_BACKEND_URL = process.env.AGENT_BACKEND_URL || 'http://localhost:8000';

/**
 * Read current agent credentials from the file written by Python backend
 */
function getAgentCredentials() {
  try {
    const credentialsPath = join(process.cwd(), 'agent-credentials.json');
    const credentialsData = readFileSync(credentialsPath, 'utf-8');
    const credentials = JSON.parse(credentialsData);
    return `${credentials.username}:${credentials.password}`;
  } catch (error) {
    console.error('[SWML Proxy] Error reading agent credentials:', error.message);
    return 'signalwire:signalwire';
  }
}

/**
 * Handle all HTTP methods by proxying to the Python backend
 */
async function handleRequest(request, context) {
  try {
    const url = new URL(request.url);

    // Get the path segments from the optional catch-all route
    // context.params.path will be an array like ['employee_id'] or undefined for /api/swml
    const pathSegments = context?.params?.path || [];

    // Construct the target path
    // If pathSegments is empty, this is a request to /api/swml (legacy/default)
    // Otherwise, it's /api/swml/{employee_id}
    let targetPath = '/swml';
    if (pathSegments.length > 0) {
      targetPath = `/swml/${pathSegments.join('/')}`;
    }

    // Ensure trailing slash for FastAPI
    if (!targetPath.endsWith('/')) {
      targetPath += '/';
    }

    // Build the proxied URL
    const backendUrl = `${PYTHON_BACKEND_URL}${targetPath}${url.search}`;

    console.log(`[SWML Proxy] ${request.method} ${url.pathname} -> ${backendUrl}`);

    // Prepare headers with forwarded host information
    const headers = new Headers(request.headers);
    headers.set('X-Forwarded-Host', url.host);
    headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

    // Add BasicAuth header for Python backend
    const authCredentials = getAgentCredentials();
    const base64Auth = Buffer.from(authCredentials).toString('base64');
    headers.set('Authorization', `Basic ${base64Auth}`);

    // Forward the request to Python backend
    const fetchOptions = {
      method: request.method,
      headers: headers,
    };

    // Add body and duplex option for non-GET/HEAD requests
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      fetchOptions.body = request.body;
      fetchOptions.duplex = 'half';
    }

    const response = await fetch(backendUrl, fetchOptions);

    // Get the response body
    const body = await response.text();

    // Log response for debugging
    console.log(`[SWML Proxy] Response ${response.status} from backend`);

    // Return the proxied response with original headers
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });

  } catch (error) {
    console.error('[SWML Proxy] Error proxying request:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to proxy SWML request',
        message: error.message
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Export handlers for all HTTP methods
export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
export const HEAD = handleRequest;
export const OPTIONS = handleRequest;
