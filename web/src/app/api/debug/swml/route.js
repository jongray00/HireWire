/**
 * SWML Debug Endpoint
 *
 * Comprehensive debugging tool for SWML webhook configuration.
 * Tests accessibility, validates SWML format, and provides diagnostics.
 */

import { getBaseUrl, getSwmlWebhookUrl } from '@/app/api/utils/getBaseUrl.js';
import { verifyAndCorrectSwmlWebhook } from '@/app/api/utils/verifySwml.js';

export async function GET(request) {
  const baseUrl = getBaseUrl(request);
  const swmlUrl = getSwmlWebhookUrl(request);

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🔧 SWML DEBUG ENDPOINT');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const debugInfo = {
    timestamp: new Date().toISOString(),
    environment: {
      baseUrl,
      swmlUrl,
      nodeEnv: process.env.NODE_ENV,
      agentBackendUrl: process.env.AGENT_BACKEND_URL || 'http://localhost:8000'
    },
    requestHeaders: {
      host: request.headers.get('host'),
      'x-forwarded-host': request.headers.get('x-forwarded-host'),
      'x-forwarded-proto': request.headers.get('x-forwarded-proto'),
      origin: request.headers.get('origin'),
      referer: request.headers.get('referer')
    },
    urlVariations: {
      current: swmlUrl,
      withTrailingSlash: swmlUrl + '/',
      withoutProtocol: swmlUrl.replace(/^https?:\/\//, ''),
      asRelative: '/api/swml'
    }
  };

  // Test the SWML endpoint
  console.log('Testing SWML endpoint...');
  const verification = await verifyAndCorrectSwmlWebhook(swmlUrl);

  debugInfo.verification = {
    success: verification.success,
    error: verification.error,
    suggestion: verification.suggestion,
    diagnostics: verification.diagnostics,
    swml: verification.swml ? {
      version: verification.swml.version,
      sectionsCount: verification.swml.sections?.length,
      format: verification.format
    } : null
  };

  // Test backend health
  console.log('Testing Python backend...');
  try {
    const backendUrl = process.env.AGENT_BACKEND_URL || 'http://localhost:8000';
    const healthResponse = await fetch(`${backendUrl}/api/agent-info`, {
      signal: AbortSignal.timeout(5000)
    });

    debugInfo.backend = {
      accessible: healthResponse.ok,
      status: healthResponse.status,
      url: backendUrl
    };

    if (healthResponse.ok) {
      const data = await healthResponse.json();
      debugInfo.backend.agentInfo = data;
    }
  } catch (error) {
    debugInfo.backend = {
      accessible: false,
      error: error.message,
      suggestion: 'Make sure the Python backend is running on port 8000'
    };
  }

  // Recommendations
  debugInfo.recommendations = [];

  if (!verification.success) {
    debugInfo.recommendations.push({
      severity: 'error',
      message: 'SWML webhook is not accessible',
      action: 'Check that the Python backend is running and accessible at the configured URL'
    });
  }

  if (debugInfo.backend && !debugInfo.backend.accessible) {
    debugInfo.recommendations.push({
      severity: 'error',
      message: 'Python backend is not responding',
      action: 'Start the Python backend with: python agent/main.py'
    });
  }

  if (baseUrl.includes('localhost')) {
    debugInfo.recommendations.push({
      severity: 'warning',
      message: 'Using localhost - not accessible by SignalWire',
      action: 'Use ngrok, Replit, or deploy to a public server for SignalWire to reach the webhook'
    });
  }

  if (debugInfo.recommendations.length === 0) {
    debugInfo.recommendations.push({
      severity: 'success',
      message: 'All systems operational',
      action: 'SWML webhook is ready to use with SignalWire'
    });
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  return Response.json(debugInfo, {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}
