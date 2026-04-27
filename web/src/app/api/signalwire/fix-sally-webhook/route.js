/**
 * Fix Sally-Sales Webhook URL
 *
 * This endpoint updates the sally-sales resource to use the correct
 * authenticated webhook URL with embedded credentials
 */

import { getSwmlWebhookUrl } from '@/app/api/utils/getBaseUrl.js';

export async function POST(request) {
  try {
    const { credentials } = await request.json();

    if (!credentials) {
      return Response.json(
        { error: 'Missing SignalWire credentials' },
        { status: 400 }
      );
    }

    const { spaceUrl, projectId, apiToken } = credentials;

    if (!spaceUrl || !projectId || !apiToken) {
      return Response.json(
        { error: 'Missing required SignalWire credentials (spaceUrl, projectId, apiToken)' },
        { status: 400 }
      );
    }

    const normalizedSpaceUrl = spaceUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const baseUrl = `https://${normalizedSpaceUrl}`;
    const basicAuth = Buffer.from(`${projectId}:${apiToken}`).toString('base64');

    // Get the authenticated webhook URL
    const webhookUrl = getSwmlWebhookUrl(request);
    console.log('🔧 Fixing sally-sales webhook URL to:', webhookUrl);

    // List all SWML webhook resources to find sally-sales
    const listResponse = await fetch(`${baseUrl}/api/fabric/resources/swml_webhooks`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      }
    });

    if (!listResponse.ok) {
      const errorText = await listResponse.text();
      console.error('Failed to list resources:', listResponse.status, errorText);
      return Response.json(
        { error: 'Failed to list resources: ' + errorText },
        { status: listResponse.status }
      );
    }

    const listData = await listResponse.json();
    const allResources = listData.data || [];

    // Find sally-sales resource
    const sallySalesResources = allResources.filter(r =>
      r.display_name === 'sally-sales' || r.name === 'sally-sales'
    );

    if (sallySalesResources.length === 0) {
      return Response.json(
        {
          error: 'No sally-sales resource found',
          message: 'Please create the resource first using the Generate Agent button'
        },
        { status: 404 }
      );
    }

    console.log(`Found ${sallySalesResources.length} sally-sales resource(s)`);

    // Update each sally-sales resource (usually just one)
    const updates = [];
    for (const resource of sallySalesResources) {
      console.log(`Updating resource ${resource.id} with webhook URL: ${webhookUrl}`);

      const updateResponse = await fetch(`${baseUrl}/api/fabric/resources/swml_webhooks/${resource.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          primary_request_url: webhookUrl,
          primary_request_method: 'GET'
        })
      });

      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        console.error(`Failed to update resource ${resource.id}:`, updateResponse.status, errorText);
        updates.push({
          id: resource.id,
          success: false,
          error: errorText
        });
      } else {
        const updatedResource = await updateResponse.json();
        console.log(`✅ Successfully updated resource ${resource.id}`);
        updates.push({
          id: resource.id,
          success: true,
          resource: updatedResource
        });
      }
    }

    // Verify the update
    const verifyResponse = await fetch(`${baseUrl}/api/fabric/resources/swml_webhooks/${sallySalesResources[0].id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      }
    });

    let verification = null;
    if (verifyResponse.ok) {
      const verifiedResource = await verifyResponse.json();
      verification = {
        id: verifiedResource.id,
        name: verifiedResource.name,
        display_name: verifiedResource.display_name,
        current_url: verifiedResource.primary_request_url,
        expected_url: webhookUrl,
        matches: verifiedResource.primary_request_url === webhookUrl
      };

      console.log('Verification:', verification);
    }

    return Response.json({
      success: true,
      message: 'Sally-sales webhook URL updated successfully',
      webhookUrl,
      updates,
      verification
    });

  } catch (error) {
    console.error('Error fixing sally-sales webhook:', error);
    return Response.json(
      { error: 'Failed to fix webhook: ' + error.message },
      { status: 500 }
    );
  }
}
