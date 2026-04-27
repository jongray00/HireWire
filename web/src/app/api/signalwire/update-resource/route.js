/**
 * Update Resource Route
 *
 * This route updates an existing SWML Script resource in SignalWire
 * with the webhook pointing to the Python backend
 */

import { getSwmlWebhookUrl } from '@/app/api/utils/getBaseUrl.js';
import { verifyAndCorrectSwmlWebhook } from '@/app/api/utils/verifySwml.js';

const AGENT_BACKEND_URL = process.env.AGENT_BACKEND_URL || 'http://localhost:8000';

export async function POST(request) {
  try {
    const { resourceId, displayName, credentials, prompt, resourceType, updates, webhookUrl: customWebhookUrl } = await request.json();

    if (!resourceId || !credentials) {
      return Response.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const { spaceUrl, projectId, apiToken } = credentials;

    if (!spaceUrl || !projectId || !apiToken) {
      return Response.json(
        { error: 'Missing required credentials' },
        { status: 400 }
      );
    }

    const normalizedSpaceUrl = spaceUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const baseUrl = `https://${normalizedSpaceUrl}`;
    const basicAuth = Buffer.from(`${projectId}:${apiToken}`).toString('base64');

    // Determine webhook URL to use
    let verifiedWebhookUrl = null;
    let verification = null;

    // If custom webhook URL provided, use it
    if (customWebhookUrl) {
      verifiedWebhookUrl = customWebhookUrl;
      console.log('Using custom webhook URL:', customWebhookUrl);
    } else {
      // Dynamically construct webhook URL based on current request to support any hosting environment
      const webhookUrl = getSwmlWebhookUrl(request);

      // Verify webhook URL before updating resource
      console.log('🔍 Verifying SWML webhook before updating resource...');
      verification = await verifyAndCorrectSwmlWebhook(webhookUrl);

      if (!verification.success) {
        console.error('❌ SWML webhook verification failed!');
        return Response.json(
          {
            error: 'SWML webhook verification failed',
            message: verification.error,
            suggestion: verification.suggestion,
            diagnostics: verification.diagnostics
          },
          { status: 500 }
        );
      }

      verifiedWebhookUrl = verification.url;
      console.log('✅ SWML webhook verified successfully');
    }

    console.log('Updating SWML Script resource:', resourceId);

    // If prompt is provided, update Python backend first
    if (prompt) {
      console.log('Updating Python backend with prompt...');
      try {
        const backendResponse = await fetch(`${AGENT_BACKEND_URL}/api/update-config`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ prompt })
        });

        if (!backendResponse.ok) {
          console.error('Failed to update Python backend:', await backendResponse.text());
        } else {
          console.log('Python backend updated successfully');
        }
      } catch (error) {
        console.error('Error updating Python backend:', error);
        // Continue even if backend update fails
      }
    }

    // First, get the current resource to determine its type
    const getResponse = await fetch(`${baseUrl}/api/fabric/resources/${resourceId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      }
    });

    if (!getResponse.ok) {
      const errorText = await getResponse.text();
      console.error('Failed to fetch resource:', getResponse.status, errorText);
      return Response.json(
        { error: 'Failed to fetch resource details' },
        { status: getResponse.status }
      );
    }

    const currentResource = await getResponse.json();
    console.log('Current resource type:', currentResource.type);

    // Determine resource type (use provided type or detected type)
    const effectiveResourceType = resourceType || currentResource.type;

    // Update based on resource type
    let updateUrl;
    let updateBody = {};
    let updateMethod = 'PATCH';

    // If custom updates object provided, use it directly
    if (updates && Object.keys(updates).length > 0) {
      updateUrl = `${baseUrl}/api/fabric/resources/${effectiveResourceType}/${resourceId}`;
      updateBody = updates;
      console.log('Using custom updates:', updateBody);
    } else {
      // Legacy/default behavior
      if (currentResource.type === 'swml_webhook' || effectiveResourceType === 'swml_webhooks') {
        updateUrl = `${baseUrl}/api/fabric/resources/swml_webhooks/${resourceId}`;
        updateBody = {
          primary_request_url: verifiedWebhookUrl,
          primary_request_method: 'GET'
        };

        if (displayName) {
          updateBody.display_name = displayName;
          updateBody.name = displayName.toLowerCase().replace(/\s+/g, '-');
        }
      } else if (currentResource.type === 'swml_script') {
        // Legacy support for SWML Scripts (inline content)
        return Response.json(
          { error: 'SWML Scripts cannot be updated to webhooks. Please create a new SWML Webhook resource.' },
          { status: 400 }
        );
      } else {
        // For other resource types, attempt generic update
        updateUrl = `${baseUrl}/api/fabric/resources/${effectiveResourceType}/${resourceId}`;
        updateBody = {};

        if (displayName) {
          updateBody.display_name = displayName;
        }
      }
    }

    // Update the SWML Webhook resource
    const updateResponse = await fetch(updateUrl, {
      method: updateMethod,
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateBody)
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('Failed to update SWML Webhook resource:', updateResponse.status, errorText);
      return Response.json(
        { error: 'Failed to update SWML Webhook resource: ' + errorText },
        { status: updateResponse.status }
      );
    }

    const resource = await updateResponse.json();
    console.log('SWML Webhook resource updated successfully:', resource.id);

    return Response.json({
      success: true,
      resource,
      webhookUrl: verifiedWebhookUrl,
      verification: verification?.diagnostics,
      message: `Resource ${resourceId} updated successfully`
    });

  } catch (error) {
    console.error('Error updating resource:', error);
    return Response.json(
      { error: 'Failed to update resource: ' + error.message },
      { status: 500 }
    );
  }
}
