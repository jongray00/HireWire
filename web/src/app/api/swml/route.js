/**
 * SWML Proxy Route
 *
 * This route proxies all requests to the Python backend that serves SWML
 * for the SignalWire AI agent. This allows SignalWire to access the SWML
 * at the public URL /api/swml while the Python backend runs on localhost:8000.
 * The proxy adds BasicAuth headers for the Python backend.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const PYTHON_BACKEND_URL = process.env.AGENT_BACKEND_URL || 'http://localhost:8000';

/**
 * Read current agent credentials from the file written by Python backend
 */
function getAgentCredentials() {
  try {
    // Python backend writes to /web/agent-credentials.json
    const credentialsPath = join(process.cwd(), 'agent-credentials.json');
    const credentialsData = readFileSync(credentialsPath, 'utf-8');
    const credentials = JSON.parse(credentialsData);
    return `${credentials.username}:${credentials.password}`;
  } catch (error) {
    console.error('[SWML Proxy] Error reading agent credentials:', error.message);
    // Fallback to default credentials
    return 'signalwire:signalwire';
  }
}

/**
 * Handle all HTTP methods by proxying to the Python backend
 */
async function handleRequest(request) {
  try {
    // Get the full URL from the request
    const url = new URL(request.url);

    // Strip /api from the pathname to get /swml
    // url.pathname will be /api/swml, we want to forward to /swml/
    // Note: FastAPI requires trailing slash, so we append it
    const targetPath = url.pathname.replace('/api', '');

    // Build the proxied URL with trailing slash for FastAPI
    const backendUrl = `${PYTHON_BACKEND_URL}${targetPath}/${url.search}`;

    console.log(`[SWML Proxy] ${request.method} ${url.pathname} -> ${backendUrl}`);

    // Prepare headers with forwarded host information
    const headers = new Headers(request.headers);
    headers.set('X-Forwarded-Host', url.host);
    headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));

    // Add BasicAuth header for Python backend
    // SignalWire doesn't support auth in webhook URLs, so we add it in the proxy
    // Read current credentials from the file written by Python backend
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
      fetchOptions.duplex = 'half'; // Required for streaming request bodies
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
