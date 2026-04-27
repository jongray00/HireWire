/**
 * Generate Agent Route
 *
 * This route:
 * 1. Sends the prompt to the Python backend to update agent configuration
 * 2. Creates or updates a SWML Script resource in SignalWire
 * 3. Returns the resource address for the frontend to call
 */

import { getSwmlWebhookUrl } from '@/app/api/utils/getBaseUrl.js';
import { verifyAndCorrectSwmlWebhook } from '@/app/api/utils/verifySwml.js';

const AGENT_BACKEND_URL = process.env.AGENT_BACKEND_URL || 'http://localhost:8000';

export async function POST(request) {
  try {
    const { prompt, credentials, subscriberId, resourceId, displayName } = await request.json();

    if (!prompt || !credentials || !subscriberId) {
      return Response.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const { spaceUrl, projectId, apiToken } = credentials;
    const baseUrl = `https://${spaceUrl}`;
    const basicAuth = Buffer.from(`${projectId}:${apiToken}`).toString('base64');

    // Step 1: Update Python backend configuration with the new prompt
    console.log('Sending prompt to Python backend...');
    const backendResponse = await fetch(`${AGENT_BACKEND_URL}/api/update-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ prompt })
    });

    if (!backendResponse.ok) {
      console.error('Failed to update Python backend:', await backendResponse.text());
      return Response.json(
        { error: 'Failed to update agent backend configuration' },
        { status: 500 }
      );
    }

    const backendData = await backendResponse.json();
    console.log('Python backend updated successfully');

    // Step 2: Create or update subscriber in SignalWire
    console.log(`Creating/updating subscriber: ${subscriberId}`);
    console.log(`BaseURL: ${baseUrl}`);

    // Construct email from subscriber ID
    const subscriberEmail = `${subscriberId}@demo.signalwire.com`;
    console.log(`Checking for subscriber with email: ${subscriberEmail}`);

    // Check if subscriber exists by querying with email filter
    let checkSubscriber;
    try {
      checkSubscriber = await fetch(`${baseUrl}/api/fabric/subscribers?email=${encodeURIComponent(subscriberEmail)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('Check subscriber response status:', checkSubscriber.status);
    } catch (error) {
      console.error('Error checking subscriber:', error);
      return Response.json(
        { error: 'Error checking subscriber: ' + error.message },
        { status: 500 }
      );
    }

    let subscriber;
    if (checkSubscriber.ok) {
      // Parse the response - it will be an array of subscribers
      const checkData = await checkSubscriber.json();

      if (checkData.data && checkData.data.length > 0) {
        // Subscriber exists - reuse it
        console.log('Subscriber already exists, reusing');
        subscriber = checkData.data[0];
      } else {
        // No subscriber found - need to create one
        console.log('No subscriber found with that email, creating new one');
        try {
          const createResponse = await fetch(`${baseUrl}/api/fabric/subscribers`, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${basicAuth}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              subscriber: subscriberId,
              alias: `Sally Sales Demo - ${Date.now()}`,
              email: subscriberEmail
            })
          });

          console.log('Create subscriber response status:', createResponse.status);

          if (!createResponse.ok) {
            const errorText = await createResponse.text();

            // If email already exists (422), query again to get the subscriber
            if (createResponse.status === 422 && errorText.includes('Email has already been taken')) {
              console.log('Email already taken, querying again by email');
              const retryCheck = await fetch(`${baseUrl}/api/fabric/subscribers?email=${encodeURIComponent(subscriberEmail)}`, {
                method: 'GET',
                headers: {
                  'Authorization': `Basic ${basicAuth}`,
                  'Content-Type': 'application/json'
                }
              });

              if (retryCheck.ok) {
                const retryData = await retryCheck.json();
                if (retryData.data && retryData.data.length > 0) {
                  subscriber = retryData.data[0];
                  console.log('Retrieved existing subscriber after email conflict');
                } else {
                  console.error('Subscriber not found even after email conflict');
                  return Response.json(
                    { error: 'Subscriber exists but could not be retrieved' },
                    { status: 500 }
                  );
                }
              } else {
                console.error('Failed to retrieve subscriber after email conflict');
                return Response.json(
                  { error: 'Subscriber exists but could not be retrieved' },
                  { status: 500 }
                );
              }
            } else {
              console.error('Failed to create subscriber:', createResponse.status, errorText);
              return Response.json(
                { error: 'Failed to create subscriber: ' + errorText },
                { status: 500 }
              );
            }
          } else {
            subscriber = await createResponse.json();
            console.log('Subscriber created successfully:', subscriber);
          }
        } catch (error) {
          console.error('Error creating subscriber:', error);
          return Response.json(
            { error: 'Error creating subscriber: ' + error.message },
            { status: 500 }
          );
        }
      }
    } else {
      // Error from check subscriber query
      const errorText = await checkSubscriber.text();
      console.error('Error checking subscriber:', checkSubscriber.status, errorText);
      return Response.json(
        { error: 'Error checking subscriber: ' + errorText },
        { status: 500 }
      );
    }

    // Step 3: Create or update SWML Script resource
    // SignalWire doesn't support BasicAuth in webhook URLs, so we use unauthenticated URL
    // The Next.js proxy at /api/swml will add BasicAuth headers before forwarding to Python backend
    // Dynamically construct webhook URL based on current request to support any hosting environment
    const webhookUrl = getSwmlWebhookUrl(request);

    // CRITICAL: Verify webhook URL before updating SignalWire resource
    // This prevents setting an incorrect URL that would break calls
    console.log('🔍 Verifying SWML webhook before updating SignalWire resource...');
    const verification = await verifyAndCorrectSwmlWebhook(webhookUrl);

    if (!verification.success) {
      console.error('❌ SWML webhook verification failed!');
      console.error('Error:', verification.error);
      console.error('Diagnostics:', JSON.stringify(verification.diagnostics, null, 2));

      return Response.json(
        {
          error: 'SWML webhook verification failed',
          message: verification.error,
          suggestion: verification.suggestion,
          diagnostics: verification.diagnostics,
          webhookUrl
        },
        { status: 500 }
      );
    }

    // Use corrected URL if verification made adjustments
    const verifiedWebhookUrl = verification.url;
    console.log('✅ SWML webhook verified successfully');
    if (verifiedWebhookUrl !== webhookUrl) {
      console.log(`🔧 URL auto-corrected: ${webhookUrl} → ${verifiedWebhookUrl}`);
    }

    let resource;
    let resourceAction;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 COMPREHENSIVE RESOURCE SEARCH AND CLEANUP');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // ALWAYS search for ALL existing "sally-sales" resources to prevent duplicates
    let sallySalesResources = [];
    try {
      console.log('📋 Fetching ALL SWML webhook resources...');
      const listResponse = await fetch(`${baseUrl}/api/fabric/resources/swml_webhooks`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json'
        }
      });

      if (listResponse.ok) {
        const listData = await listResponse.json();
        const allResources = listData.data || [];
        console.log(`📊 Total SWML webhooks found: ${allResources.length}`);

        // Filter for resources with display_name "sally-sales"
        // Note: API returns name as undefined, so we must filter by display_name
        sallySalesResources = allResources.filter(r =>
          r.display_name === 'sally-sales' || r.name === 'sally-sales'
        );
        console.log(`🎯 Resources with display_name "sally-sales": ${sallySalesResources.length}`);

        if (sallySalesResources.length > 0) {
          console.log('📝 Found sally-sales resources:');
          sallySalesResources.forEach((r, i) => {
            console.log(`   ${i + 1}. ID: ${r.id}`);
            console.log(`      Display: ${r.display_name || r.name}`);
            console.log(`      URL: ${r.primary_request_url || 'N/A'}`);
          });
        }
      } else {
        console.log('⚠️  Failed to list resources:', listResponse.status);
      }
    } catch (error) {
      console.log('⚠️  Error listing resources:', error.message);
    }

    // Handle multiple resources: keep one, delete others
    let targetResourceId = null;
    if (sallySalesResources.length > 1) {
      console.log(`⚠️  WARNING: Found ${sallySalesResources.length} duplicate "sally-sales" resources!`);
      console.log('🗑️  Deleting duplicates, keeping only the first one...');

      targetResourceId = sallySalesResources[0].id;

      // Delete all duplicates
      for (let i = 1; i < sallySalesResources.length; i++) {
        const duplicateId = sallySalesResources[i].id;
        try {
          console.log(`   Deleting duplicate resource: ${duplicateId}`);
          const deleteResponse = await fetch(`${baseUrl}/api/fabric/resources/swml_webhooks/${duplicateId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Basic ${basicAuth}`,
              'Content-Type': 'application/json'
            }
          });

          if (deleteResponse.ok) {
            console.log(`   ✅ Deleted duplicate: ${duplicateId}`);
          } else {
            console.log(`   ⚠️  Failed to delete ${duplicateId}: ${deleteResponse.status}`);
          }
        } catch (error) {
          console.log(`   ❌ Error deleting ${duplicateId}:`, error.message);
        }
      }

      resourceAction = 'cleaned_and_updated';
    } else if (sallySalesResources.length === 1) {
      targetResourceId = sallySalesResources[0].id;
      console.log(`✅ Found exactly ONE "sally-sales" resource: ${targetResourceId}`);
      resourceAction = 'updated';
    } else {
      console.log('📝 No existing "sally-sales" resource found, will create new one');
      resourceAction = 'created';
    }

    // Update existing or create new resource
    if (targetResourceId) {
      // Update existing resource
      console.log(`🔄 Updating resource ${targetResourceId} with authenticated webhook URL...`);
      const updateResponse = await fetch(`${baseUrl}/api/fabric/resources/swml_webhooks/${targetResourceId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'sally-sales', // Fixed name for consistent addressing
          display_name: 'sally-sales', // Fixed display_name to ensure we can find it later
          primary_request_url: verifiedWebhookUrl,
          primary_request_method: 'GET'
        })
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error('❌ Failed to update resource:', updateResponse.status, errorText);
        return Response.json(
          { error: 'Failed to update SWML Webhook resource: ' + errorText },
          { status: updateResponse.status }
        );
      }

      resource = await updateResponse.json();
      console.log('✅ Resource updated successfully');
    } else {
      // Create new resource
      const resourceName = 'sally-sales';
      // Use fixed display_name to ensure we can find and update it later
      const resourceDisplayName = 'sally-sales';
      console.log(`🆕 Creating new resource: ${resourceName} (${resourceDisplayName})`);

      const createResponse = await fetch(`${baseUrl}/api/fabric/resources/swml_webhooks`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: resourceName, // Fixed name for addressing
          display_name: resourceDisplayName, // Human-readable name for UI
          primary_request_url: verifiedWebhookUrl,
          primary_request_method: 'GET'
        })
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        console.error('❌ Failed to create resource:', createResponse.status, errorText);
        return Response.json(
          { error: 'Failed to create SWML Webhook resource: ' + errorText },
          { status: createResponse.status }
        );
      }

      resource = await createResponse.json();
      console.log('✅ Resource created successfully');
    }

    // VERIFICATION: Read the resource back to confirm the URL was saved correctly
    console.log('🔍 Verifying resource configuration...');
    try {
      const verifyResponse = await fetch(`${baseUrl}/api/fabric/resources/swml_webhooks/${resource.id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json'
        }
      });

      if (verifyResponse.ok) {
        const verifiedResource = await verifyResponse.json();
        console.log('📋 Verified resource configuration:');
        console.log(`   ID: ${verifiedResource.id}`);
        console.log(`   Name: ${verifiedResource.name}`);
        console.log(`   Display: ${verifiedResource.display_name || 'N/A'}`);
        console.log(`   Webhook URL: ${verifiedResource.primary_request_url}`);

        // Check if the URL matches what we set
        if (verifiedResource.primary_request_url === verifiedWebhookUrl) {
          console.log('✅ VERIFIED: Webhook URL matches! SWML endpoint correctly configured.');
        } else {
          console.log('⚠️  WARNING: Webhook URL DOES NOT MATCH!');
          console.log(`   Expected: ${verifiedWebhookUrl}`);
          console.log(`   Got: ${verifiedResource.primary_request_url}`);
        }
      } else {
        console.log('⚠️  Could not verify resource configuration:', verifyResponse.status);
      }
    } catch (error) {
      console.log('⚠️  Error verifying resource:', error.message);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Construct the dial address
    // For SWML scripts, we can dial them via /public/{name} or /{subscriber}/{name}
    const callTo = `/public/sally-sales`; // Using public address for simplicity

    console.log(`SWML endpoint configured at: ${verifiedWebhookUrl}`);
    console.log(`Resource ${resourceAction}: ${resource.display_name}`);
    console.log(`Call address: ${callTo}`);

    // Return success with calling information
    return Response.json({
      success: true,
      subscriberId,
      resource: {
        id: resource.id,
        display_name: resource.display_name,
        type: resource.type
      },
      resourceAction,
      agentUrl: verifiedWebhookUrl,
      swmlEndpoint: verifiedWebhookUrl,
      callTo,
      backendConfig: backendData.config,
      verification: verification.diagnostics,
      message: `Agent ${resourceAction}. Call ${callTo} to connect.`
    });

  } catch (error) {
    console.error('Error generating agent:', error);
    return Response.json(
      { error: 'Failed to generate agent: ' + error.message },
      { status: 500 }
    );
  }
}
