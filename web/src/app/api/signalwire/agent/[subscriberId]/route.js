export async function GET(request, { params }) {
  try {
    const { subscriberId } = params;
    
    // Retrieve stored SWML configuration
    const config = getSWMLConfig(subscriberId);
    
    if (!config) {
      return Response.json(
        { error: 'Agent configuration not found' },
        { status: 404 }
      );
    }

    // Return SWML as plain text with correct content type
    return new Response(config.swml, {
      headers: {
        'Content-Type': 'application/x-yaml',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Error serving SWML:', error);
    return Response.json(
      { error: 'Failed to serve agent configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  try {
    const { subscriberId } = params;
    const body = await request.json();
    
    // Handle SWAIG function calls
    console.log('SWAIG function call received:', body);
    
    const { function: functionName, argument: args } = body;
    
    // Send real-time event: Agent is processing request
    const processingResponse = {
      response: "Let me help you with that...",
      user_event: {
        type: "agent_thinking",
        status: "processing",
        function: functionName,
        timestamp: new Date().toISOString()
      }
    };
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Route to appropriate function handler
    switch (functionName) {
      case 'route_to_order':
      case 'route_to_schedule':
      case 'route_to_appointment':
      case 'route_to_support':
      case 'route_to_sales':
      case 'route_to_billing':
      case 'route_to_status':
      case 'route_to_check':
        return handleRouting(functionName, args, subscriberId);
        
      case 'transfer_call':
        return handleTransfer(args, subscriberId);
        
      case 'demo_order_item':
        return handleDemoOrderItem(args, subscriberId);
        
      case 'demo_get_status':
        return handleDemoGetStatus(args, subscriberId);
        
      default:
        return Response.json({
          response: `I'm sorry, I don't have access to that function. Let me connect you with a human representative who can help you.`,
          user_event: {
            type: "function_not_found",
            function: functionName,
            timestamp: new Date().toISOString()
          },
          action: [
            {
              name: "transfer",
              to: "+15551234567"
            }
          ]
        });
    }

  } catch (error) {
    console.error('Error handling SWAIG function:', error);
    return Response.json({
      response: "I apologize, but I'm experiencing a technical issue. Let me connect you with someone who can help.",
      user_event: {
        type: "error",
        message: error.message,
        timestamp: new Date().toISOString()
      },
      action: [
        {
          name: "transfer",
          to: "+15551234567"
        }
      ]
    });
  }
}

function getSWMLConfig(subscriberId) {
  global.swmlConfigs = global.swmlConfigs || new Map();
  return global.swmlConfigs.get(subscriberId);
}

function handleRouting(functionName, args, subscriberId) {
  const department = functionName.replace('route_to_', '');
  const reason = args?.reason || 'General inquiry';
  
  // Log the routing request
  console.log(`Routing to ${department}: ${reason}`);
  
  // Send real-time event about routing decision
  const departmentNumbers = {
    order: '+15551234567',
    schedule: '+15551234568',
    appointment: '+15551234568',
    support: '+15551234569',
    sales: '+15551234567',
    billing: '+15551234570',
    status: '+15551234571',
    check: '+15551234571'
  };
  
  const transferNumber = departmentNumbers[department] || '+15551234567';
  
  return Response.json({
    response: `I'll connect you with our ${department} team right away. Please hold while I transfer your call.`,
    user_event: {
      type: "routing_decision",
      department: department,
      reason: reason,
      transfer_number: transferNumber,
      timestamp: new Date().toISOString()
    },
    action: [
      {
        name: "transfer",
        to: transferNumber
      }
    ]
  });
}

function handleDemoOrderItem(args, subscriberId) {
  const itemName = args?.item_name || 'item';
  const quantity = args?.quantity || 1;
  
  // Simulate order processing
  const mockItem = {
    name: itemName,
    quantity: quantity,
    price: 12.99,
    total: (quantity * 12.99).toFixed(2)
  };
  
  return Response.json({
    response: `Great! I've added ${quantity} ${itemName} to your order for $${mockItem.total}. Is there anything else you'd like to add?`,
    user_event: {
      type: "item_added",
      item: mockItem,
      order_total: mockItem.total,
      timestamp: new Date().toISOString()
    }
  });
}

function handleDemoGetStatus(args, subscriberId) {
  const orderNumber = args?.order_number || '12345';
  
  // Simulate status lookup
  const mockStatus = {
    order_number: orderNumber,
    status: 'In Progress',
    estimated_completion: '15 minutes',
    items: ['Pizza Margherita', 'Garlic Bread']
  };
  
  return Response.json({
    response: `Order ${orderNumber} is currently ${mockStatus.status}. Your ${mockStatus.items.join(' and ')} should be ready in about ${mockStatus.estimated_completion}.`,
    user_event: {
      type: "status_checked",
      order: mockStatus,
      timestamp: new Date().toISOString()
    }
  });
}

function handleTransfer(args, subscriberId) {
  const department = args?.department || 'general';
  const reason = args?.reason || 'Requested human assistance';
  
  console.log(`Transfer requested - Department: ${department}, Reason: ${reason}`);
  
  return Response.json({
    response: `I'll connect you with a representative from our ${department} team. Please hold while I transfer your call.`,
    action: [
      {
        name: "transfer",
        to: "+15551234567"
      }
    ]
  });
}

// Handle CORS preflight requests
export async function OPTIONS(request) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}