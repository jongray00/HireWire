/**
 * WebRTC Token Route
 *
 * Generates a Fabric subscriber token for WebRTC calling using SignalWire Fabric API
 * Uses reference-based authentication (no password or application_id required)
 */

export async function POST(request) {
  console.log('[WebRTC Token] POST request received');

  try {
    const body = await request.json();
    console.log('[WebRTC Token] Request body parsed:', {
      hasCredentials: !!body.credentials,
      subscriberId: body.subscriberId
    });

    const { credentials, subscriberId } = body;

    if (!credentials || !credentials.spaceUrl || !credentials.projectId || !credentials.apiToken) {
      console.error('[WebRTC Token] Missing credentials');
      return Response.json(
        { error: 'Missing required SignalWire credentials' },
        { status: 400 }
      );
    }

    if (!subscriberId) {
      console.error('[WebRTC Token] Missing subscriberId');
      return Response.json(
        { error: 'Missing subscriberId' },
        { status: 400 }
      );
    }

    // Normalize space URL
    const normalizedSpaceUrl = credentials.spaceUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const baseUrl = `https://${normalizedSpaceUrl}`;

    console.log('[WebRTC Token] Requesting subscriber token from SignalWire:', {
      baseUrl,
      endpoint: `${baseUrl}/api/fabric/subscribers/tokens`,
      subscriberId
    });

    // Generate Fabric subscriber token using JSON payload
    // This follows the reference implementation approach
    const payload = {
      reference: subscriberId
    };

    let tokenResponse;
    try {
      tokenResponse = await fetch(`${baseUrl}/api/fabric/subscribers/tokens`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${credentials.projectId}:${credentials.apiToken}`).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      console.log('[WebRTC Token] SignalWire API response status:', tokenResponse.status);
    } catch (fetchError) {
      console.error('[WebRTC Token] Fetch error:', fetchError);
      throw new Error(`Fetch failed: ${fetchError.message}`);
    }

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[WebRTC Token] SignalWire Fabric token generation failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        errorText
      });
      return Response.json(
        { error: `Failed to generate Fabric token: ${tokenResponse.status} ${errorText}` },
        { status: 500 }
      );
    }

    const tokenData = await tokenResponse.json();
    console.log('[WebRTC Token] Token generated successfully:', {
      hasToken: !!tokenData.token,
      subscriberId
    });

    return Response.json({
      token: tokenData.token,
      subscriberId: subscriberId,
      spaceUrl: normalizedSpaceUrl,
      success: true
    });

  } catch (error) {
    console.error('[WebRTC Token] Error generating Fabric token:', {
      message: error.message,
      stack: error.stack,
      error
    });
    return Response.json(
      { error: 'Failed to generate Fabric token: ' + error.message },
      { status: 500 }
    );
  }
}