/**
 * Create Virtual Employee Route
 *
 * This route:
 * 1. Sends employee configuration to the Python backend
 * 2. Creates a unique SWML Script resource in SignalWire
 * 3. Inserts the employee into the SQLite database
 * 4. Returns the resource address for calling the virtual employee
 */

import { getSwmlWebhookUrl } from '@/app/api/utils/getBaseUrl.js';
import { verifyAndCorrectSwmlWebhook } from '@/app/api/utils/verifySwml.js';
import { upsertEmployee, employeeRowToJson } from '@/lib/db';

const AGENT_BACKEND_URL = process.env.AGENT_BACKEND_URL || 'http://localhost:8000';

function sanitizeResourceName(name) {
  console.log('🔧 Sanitizing resource name:', name);

  let sanitized = name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 30)
    .replace(/-+$/, '');

  console.log('✅ Sanitized resource name:', sanitized);

  if (!/[a-z0-9]/.test(sanitized)) {
    console.error('❌ Invalid sanitized name (no alphanumeric chars):', sanitized);
    throw new Error('Resource name must contain at least one letter or number');
  }

  return sanitized;
}

export async function POST(request) {
  try {
    const { employeeData, credentials } = await request.json();

    if (!employeeData || !credentials) {
      return Response.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const { spaceUrl, projectId, apiToken } = credentials;

    if (!spaceUrl || !projectId || !apiToken) {
      return Response.json(
        { error: 'Missing required SignalWire credentials' },
        { status: 400 }
      );
    }

    // Step 1: Create employee in Python backend
    console.log('Creating virtual employee in Python backend...');
    const backendResponse = await fetch(`${AGENT_BACKEND_URL}/api/create-employee`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...employeeData,
        business_hours_start: employeeData.businessHoursStart ?? employeeData.business_hours_start ?? 9,
        business_hours_end: employeeData.businessHoursEnd ?? employeeData.business_hours_end ?? 18,
        business_days: employeeData.businessDays ?? employeeData.business_days ?? [0, 1, 2, 3, 4],
        documents: employeeData.documents ?? [],
        sendgrid_api_key: employeeData.sendgridApiKey ?? employeeData.sendgrid_api_key ?? '',
        email_from_address: employeeData.emailFromAddress ?? employeeData.email_from_address ?? '',
        email_from_name: employeeData.emailFromName ?? employeeData.email_from_name ?? '',
        space_name: spaceUrl?.replace(/^https?:\/\//, '').replace(/\/$/, '') || '',
        project_id: projectId,
        token: apiToken,
      })
    });

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Failed to create employee in backend:', errorText);
      return Response.json(
        { error: 'Failed to create virtual employee in backend: ' + errorText },
        { status: 500 }
      );
    }

    const backendData = await backendResponse.json();
    const employee = backendData.employee;
    const employeeId = employee.id;

    console.log(`✅ Employee created in backend: ${employee.name} (${employeeId})`);

    // Step 2: Create SWML Webhook resource in SignalWire
    const baseUrl = `https://${spaceUrl}`;
    const basicAuth = Buffer.from(`${projectId}:${apiToken}`).toString('base64');

    const webhookUrl = getSwmlWebhookUrl(request, `/swml/${employeeId}/`);

    console.log('🔍 Verifying SWML webhook...');
    const verification = await verifyAndCorrectSwmlWebhook(webhookUrl);

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

    const verifiedWebhookUrl = verification.url;
    console.log('✅ SWML webhook verified successfully');

    const sanitizedName = sanitizeResourceName(employee.name);
    const resourceName = `employee-${sanitizedName}-${employeeId}`;
    const displayName = employee.name;

    console.log(`Creating SWML webhook resource: ${resourceName}`);

    const createResponse = await fetch(`${baseUrl}/api/fabric/resources/swml_webhooks`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: resourceName,
        display_name: displayName,
        primary_request_url: verifiedWebhookUrl,
        primary_request_method: 'GET'
      })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Failed to create SWML Webhook resource:', createResponse.status, errorText);

      // Clean up: delete employee from backend
      try {
        await fetch(`${AGENT_BACKEND_URL}/api/employee/${employeeId}`, {
          method: 'DELETE'
        });
        console.log('Cleaned up employee from backend after SignalWire error');
      } catch (cleanupError) {
        console.error('Failed to clean up employee:', cleanupError);
      }

      return Response.json(
        { error: 'Failed to create SWML Webhook resource: ' + errorText },
        { status: createResponse.status }
      );
    }

    const resource = await createResponse.json();
    console.log('✅ SWML Webhook resource created successfully:', resource.id);

    const callFabricAddress = `/public/${resourceName}`;

    // Step 3: Persist employee to database
    upsertEmployee({
      id: employeeId,
      projectId,
      name: employee.name,
      role: employee.role,
      greeting: employee.greeting,
      prompt: employee.prompt,
      voice: employee.voice,
      language: employee.language,
      temperature: employee.temperature,
      speechHints: employee.speech_hints,
      enabledFunctions: employee.enabled_functions,
      transferNumber: employee.transfer_number || '',
      transferFrom: employee.transfer_from || '',
      smsFromNumber: employee.sms_from_number || '',
      phoneNumber: employee.phone_number || '',
      videoIdleUrl: employee.video_idle_url || '',
      videoTalkingUrl: employee.video_talking_url || '',
      businessHoursStart: employeeData.business_hours_start ?? employeeData.businessHoursStart ?? 9,
      businessHoursEnd: employeeData.business_hours_end ?? employeeData.businessHoursEnd ?? 18,
      businessDays: employeeData.business_days ?? employeeData.businessDays ?? [0, 1, 2, 3, 4],
      documents: employeeData.documents ?? [],
      emailProvider: employeeData.email_provider ?? employeeData.emailProvider ?? '',
      sendgridApiKey: employeeData.sendgrid_api_key ?? employeeData.sendgridApiKey ?? '',
      emailFromAddress: employeeData.email_from_address ?? employeeData.emailFromAddress ?? '',
      emailFromName: employeeData.email_from_name ?? employeeData.emailFromName ?? '',
      resourceId: resource.id,
      resourceName,
      callFabricAddress,
      webhookUrl: verifiedWebhookUrl,
    });

    console.log(`[DB] Employee ${employeeId} persisted to database`);

    console.log(`\n${'='.repeat(60)}`);
    console.log(`📞 VIRTUAL EMPLOYEE CREATED SUCCESSFULLY`);
    console.log(`${'='.repeat(60)}`);
    console.log(`   Employee Name:     ${employee.name}`);
    console.log(`   Employee Role:     ${employee.role}`);
    console.log(`   Employee ID:       ${employee.id}`);
    console.log(`   Resource Name:     ${resourceName}`);
    console.log(`   Resource ID:       ${resource.id}`);
    console.log(`   Call Address:      ${callFabricAddress}`);
    console.log(`   Webhook URL:       ${verifiedWebhookUrl}`);
    console.log(`${'='.repeat(60)}\n`);

    return Response.json({
      success: true,
      employee: {
        ...employee,
        resourceId: resource.id,
        resourceName: resourceName,
        callFabricAddress: callFabricAddress,
        webhookUrl: verifiedWebhookUrl
      },
      message: `Virtual employee "${employee.name}" created successfully`
    });

  } catch (error) {
    console.error('Error creating virtual employee:', error);
    return Response.json(
      { error: 'Failed to create virtual employee: ' + error.message },
      { status: 500 }
    );
  }
}
