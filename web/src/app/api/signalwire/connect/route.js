export async function POST(request) {
  try {
    const { spaceUrl, projectId, apiToken, subscriberId: providedSubscriberId } = await request.json();

    // Validate credentials
    if (!spaceUrl || !projectId || !apiToken) {
      return Response.json(
        { error: 'Missing required credentials' },
        { status: 400 }
      );
    }

    // Ensure spaceUrl has proper format
    const normalizedSpaceUrl = spaceUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const baseUrl = `https://${normalizedSpaceUrl}`;
    const basicAuth = Buffer.from(`${projectId}:${apiToken}`).toString('base64');

    // Test credentials by making a test API call
    const testResponse = await fetch(`${baseUrl}/api/laml/2010-04-01/Accounts/${projectId}/IncomingPhoneNumbers.json`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!testResponse.ok) {
      const errorText = await testResponse.text();
      console.error('SignalWire test API call failed:', testResponse.status, errorText);
      return Response.json(
        { error: 'Invalid SignalWire credentials or API access denied' },
        { status: 401 }
      );
    }

    const phoneNumbers = await testResponse.json();

    // Get the first available phone number or indicate none available
    const firstNumber = phoneNumbers.incoming_phone_numbers?.[0]?.phone_number || null;

    // Use fixed default subscriber ID to prevent wasteful creation
    // This ensures we always reuse the same subscriber instead of creating expensive new ones
    const DEFAULT_SUBSCRIBER_ID = 'sally_sales_default_user';
    const subscriberId = providedSubscriberId || DEFAULT_SUBSCRIBER_ID;
    const subscriberEmail = `${subscriberId}@sally-sales.signalwire.com`;
    const isReusing = !!providedSubscriberId;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📋 Subscriber Management:`);
    console.log(`   Action: ${isReusing ? '♻️  REUSING existing subscriber' : '🆕 Will attempt to use/create default subscriber'}`);
    console.log(`   Subscriber ID: ${subscriberId}`);
    console.log(`   Subscriber Email: ${subscriberEmail}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Check if subscriber exists in SignalWire, create if not
    let subscriber = null;
    let subscriberCreated = false;

    try {
      // SAFEGUARD 1: First, check if subscriber exists by email
      console.log('🔍 Checking if subscriber already exists by email...');
      const checkResponse = await fetch(`${baseUrl}/api/fabric/subscribers?email=${encodeURIComponent(subscriberEmail)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json'
        }
      });

      if (checkResponse.ok) {
        const checkData = await checkResponse.json();
        if (checkData.data && checkData.data.length > 0) {
          // Subscriber exists - reuse it
          subscriber = checkData.data[0];
          console.log('✅ SUCCESS: Subscriber exists in SignalWire');
          console.log(`   ♻️  REUSING subscriber ID: ${subscriber.id}`);
          console.log(`   💰 Cost saved by reusing instead of creating new subscriber`);
        } else {
          // SAFEGUARD 2: Before creating, double-check by subscriber reference
          console.log('🔍 Double-checking by subscriber reference...');
          const checkByRefResponse = await fetch(`${baseUrl}/api/fabric/subscribers?subscriber=${encodeURIComponent(subscriberId)}`, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${basicAuth}`,
              'Content-Type': 'application/json'
            }
          });

          if (checkByRefResponse.ok) {
            const refData = await checkByRefResponse.json();
            if (refData.data && refData.data.length > 0) {
              // Found by reference - reuse it
              subscriber = refData.data[0];
              console.log('✅ SUCCESS: Subscriber found by reference');
              console.log(`   ♻️  REUSING subscriber ID: ${subscriber.id}`);
              console.log(`   💰 Cost saved by reusing instead of creating new subscriber`);
            }
          }

          // SAFEGUARD 3: Only create if not found by either email or reference
          if (!subscriber) {
            // Create new subscriber
            console.log('⚠️  Subscriber not found, creating new one...');
          const createResponse = await fetch(`${baseUrl}/api/fabric/subscribers`, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${basicAuth}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              subscriber: subscriberId,
              alias: `Sally Sales User - ${new Date().toISOString()}`,
              email: subscriberEmail,
              display_name: `Sally Sales User`
            })
          });

          if (createResponse.ok) {
            subscriber = await createResponse.json();
            subscriberCreated = true;
            console.log('✅ Subscriber created successfully in SignalWire');
            console.log(`   🆕 NEW subscriber ID: ${subscriber.id}`);
            console.log(`   📧 Email: ${subscriberEmail}`);
          } else {
            const errorText = await createResponse.text();
            // If email already taken, retry query
            if (createResponse.status === 422 && errorText.includes('Email has already been taken')) {
              const retryResponse = await fetch(`${baseUrl}/api/fabric/subscribers?email=${encodeURIComponent(subscriberEmail)}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Basic ${basicAuth}`,
                  'Content-Type': 'application/json'
                }
              });
              if (retryResponse.ok) {
                const retryData = await retryResponse.json();
                if (retryData.data && retryData.data.length > 0) {
                  subscriber = retryData.data[0];
                  console.log('✅ Subscriber retrieved after email conflict');
                  console.log(`   ♻️  REUSING subscriber ID: ${subscriber.id}`);
                }
              }
            } else {
              console.error('Failed to create subscriber:', errorText);
            }
          }
        }
      }
      }
    } catch (error) {
      console.error('Error managing subscriber:', error);
      // Continue even if subscriber management fails
    }

    // Return connection success with subscriber info
    return Response.json({
      success: true,
      subscriberId,
      signalwireSubscriberId: subscriber?.id || null,
      spaceUrl: normalizedSpaceUrl,
      phoneNumber: firstNumber,
      availableNumbers: phoneNumbers.incoming_phone_numbers?.length || 0,
      subscriberCreated,
      message: 'Successfully connected to SignalWire'
    });

  } catch (error) {
    console.error('Error connecting to SignalWire:', error);
    return Response.json(
      { error: 'Failed to connect to SignalWire: ' + error.message },
      { status: 500 }
    );
  }
}