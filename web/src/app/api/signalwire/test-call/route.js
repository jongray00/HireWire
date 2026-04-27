export async function POST(request) {
  try {
    const { credentials, subscriberId, phoneNumber } = await request.json();

    if (!credentials || !subscriberId) {
      return Response.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const { spaceUrl, projectId, apiToken } = credentials;
    const baseUrl = `https://${spaceUrl}`;
    
    // Get the agent URL
    const agentUrl = `${process.env.APP_URL || 'http://localhost:3000'}/api/signalwire/agent/${subscriberId}`;

    if (!phoneNumber) {
      // If no phone number provided, return instructions for manual testing
      return Response.json({
        success: true,
        message: 'Agent is ready for testing',
        instructions: [
          'To test your agent:',
          '1. Use a SIP client or phone to call your SignalWire number',
          '2. Configure your SignalWire phone number to use this webhook URL:',
          `   ${agentUrl}`,
          '3. Or use the SignalWire REST API to initiate a test call'
        ],
        agentUrl,
        testUrl: `${baseUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls.json`
      });
    }

    // Create a test call using SignalWire REST API
    const callData = new URLSearchParams({
      To: phoneNumber,
      From: '+15551234567', // This would be your SignalWire number
      Url: agentUrl,
      Method: 'GET'
    });

    const callResponse = await fetch(`${baseUrl}/api/laml/2010-04-01/Accounts/${projectId}/Calls.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${projectId}:${apiToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: callData
    });

    if (!callResponse.ok) {
      const errorText = await callResponse.text();
      console.error('Failed to initiate test call:', callResponse.status, errorText);
      return Response.json(
        { error: 'Failed to initiate test call: ' + errorText },
        { status: 500 }
      );
    }

    const callResult = await callResponse.json();

    return Response.json({
      success: true,
      message: 'Test call initiated successfully',
      callSid: callResult.sid,
      status: callResult.status,
      agentUrl
    });

  } catch (error) {
    console.error('Error initiating test call:', error);
    return Response.json(
      { error: 'Failed to initiate test call: ' + error.message },
      { status: 500 }
    );
  }
}