/**
 * List Resources Route
 *
 * This route fetches all dialable resources from SignalWire Fabric API
 * and categorizes them by type (SWML Scripts, AI Agents, Conference Rooms, etc.)
 *
 * Supports both GET and POST methods
 * Query params (GET): ?type=swml_webhooks (optional filter)
 * Body (POST): { credentials, type? }
 */

// Helper function to get resource name for addressing
function getResourceName(resource) {
  // Priority: name > display_name > id
  return resource.name || resource.display_name?.toLowerCase().replace(/\s+/g, '-') || resource.id;
}

// Helper function to generate callable address
function getResourceAddress(resource, addressType = 'public') {
  const name = getResourceName(resource);
  return `/${addressType}/${name}`;
}

async function handleRequest(credentials, typeFilter = null) {
  if (!credentials) {
    return Response.json(
      { error: 'Missing credentials' },
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

  console.log('Fetching resources from SignalWire...', typeFilter ? `(filter: ${typeFilter})` : '');

  // Fetch from specific type endpoint if filter provided, otherwise get all
  let fetchUrl = `${baseUrl}/api/fabric/resources`;
  if (typeFilter) {
    fetchUrl = `${baseUrl}/api/fabric/resources/${typeFilter}`;
  }

  const resourcesResponse = await fetch(fetchUrl, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json'
    }
  });

  if (!resourcesResponse.ok) {
    const errorText = await resourcesResponse.text();
    console.error('Failed to fetch resources:', resourcesResponse.status, errorText);
    return Response.json(
      { error: 'Failed to fetch resources from SignalWire' },
      { status: resourcesResponse.status }
    );
  }

  const resourcesData = await resourcesResponse.json();
  console.log('Resources fetched:', resourcesData.data?.length || 0);

    // Categorize resources by type
    const categorized = {
      swml_webhooks: [],
      swml_scripts: [],
      ai_agents: [],
      conference_rooms: [],
      subscribers: [],
      sip_endpoints: [],
      other: []
    };

    // Define dialable resource types based on the API spec
    const dialableTypes = [
      'swml_webhook',
      'swml_script',
      'ai_agent',
      'conference_room',
      'subscriber',
      'sip_endpoint',
      'call_flow',
      'relay_application'
    ];

    const resources = resourcesData.data || [];

    resources.forEach(resource => {
      if (!dialableTypes.includes(resource.type)) {
        return; // Skip non-dialable resources
      }

      const resourceName = getResourceName(resource);
      const publicAddress = getResourceAddress(resource, 'public');
      const privateAddress = getResourceAddress(resource, 'private');

      const resourceInfo = {
        id: resource.id,
        name: resource.name,
        display_name: resource.display_name,
        type: resource.type,
        created_at: resource.created_at,
        updated_at: resource.updated_at,
        // Callable address information
        resourceName: resourceName,
        publicAddress: publicAddress,
        privateAddress: privateAddress,
        callable: true,
        // Include type-specific data
        details: resource[resource.type] || null,
        // For SWML webhooks, include webhook URL
        webhookUrl: resource.swml_webhook?.primary_request_url || null,
      };

      switch (resource.type) {
        case 'swml_webhook':
          categorized.swml_webhooks.push(resourceInfo);
          break;
        case 'swml_script':
          categorized.swml_scripts.push(resourceInfo);
          break;
        case 'ai_agent':
          categorized.ai_agents.push(resourceInfo);
          break;
        case 'conference_room':
          categorized.conference_rooms.push(resourceInfo);
          break;
        case 'subscriber':
          categorized.subscribers.push(resourceInfo);
          break;
        case 'sip_endpoint':
          categorized.sip_endpoints.push(resourceInfo);
          break;
        default:
          categorized.other.push(resourceInfo);
      }
    });

    // Sort each category by updated_at (most recent first)
    Object.keys(categorized).forEach(key => {
      categorized[key].sort((a, b) =>
        new Date(b.updated_at) - new Date(a.updated_at)
      );
    });

    return Response.json({
      success: true,
      total: resources.length,
      categorized,
      all: resources.filter(r => dialableTypes.includes(r.type)),
      filtered: typeFilter !== null,
      filterType: typeFilter
    });
}

export async function POST(request) {
  try {
    const { credentials, type } = await request.json();
    return await handleRequest(credentials, type);
  } catch (error) {
    console.error('Error listing resources:', error);
    return Response.json(
      { error: 'Failed to list resources: ' + error.message },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    // Get credentials from query params or headers
    const url = new URL(request.url);
    const typeFilter = url.searchParams.get('type');

    // For GET, we expect credentials to be passed differently
    // You might want to use session-based auth here instead
    const session = request.headers.get('x-session-data');

    if (!session) {
      return Response.json(
        { error: 'Missing session data. Use POST method with credentials in body.' },
        { status: 400 }
      );
    }

    const sessionData = JSON.parse(session);
    return await handleRequest(sessionData.credentials, typeFilter);
  } catch (error) {
    console.error('Error listing resources:', error);
    return Response.json(
      { error: 'Failed to list resources: ' + error.message },
      { status: 500 }
    );
  }
}
