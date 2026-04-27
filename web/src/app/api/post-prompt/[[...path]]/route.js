/**
 * Post-Prompt Webhook Receiver
 *
 * Receives the post_conversation payload from SignalWire after an AI call
 * ends. Extracts key fields and stores in the SQLite database so the
 * Call Logs page can display them.
 *
 * URL pattern: POST /api/post-prompt/{employeeId}
 */

import { insertCallLog, getCallLogs, getEmployeeById, callLogRowToJson, insertCallAction, getCallActions } from '@/lib/db';

/**
 * Parse the post_prompt_data JSON that the AI produced.
 */
function parsePostPromptData(raw) {
  if (!raw) return null;
  const text = raw.substituted || raw.raw || '';
  try {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return { summary: text };
  }
}

/**
 * Compute call duration from microsecond epoch timestamps.
 */
function computeDuration(startUs, endUs) {
  if (!startUs) return 0;
  const endTime = endUs && endUs > 0 ? endUs : Date.now() * 1000;
  return Math.round((endTime - startUs) / 1_000_000);
}

export async function POST(request, context) {
  try {
    const payload = await request.json();
    const pathSegments = context?.params?.path || [];
    const employeeId = pathSegments[0] || 'unknown';

    console.log(`[PostPrompt] Received post_conversation for employee ${employeeId}, call ${payload.call_id || 'unknown'}`);

    // Read employee info from database
    let employeeName = employeeId;
    let employeeRole = '';
    const emp = getEmployeeById(employeeId);
    if (emp) {
      employeeName = emp.name;
      employeeRole = emp.role;
    }

    // Extract key fields from the post_conversation payload
    const callLog = payload.call_log || [];
    const swaigLog = payload.swaig_log || [];
    const postPromptData = parsePostPromptData(payload.post_prompt_data);
    const durationSec = computeDuration(payload.call_start_date, payload.call_end_date);

    // Count messages by role
    const userMessages = callLog.filter(m => m.role === 'user').length;
    const assistantMessages = callLog.filter(m => m.role === 'assistant').length;

    // Compute average assistant latency
    const assistantLatencies = callLog
      .filter(m => m.role === 'assistant' && m.audio_latency)
      .map(m => m.audio_latency);
    const avgLatency = assistantLatencies.length
      ? Math.round(assistantLatencies.reduce((a, b) => a + b, 0) / assistantLatencies.length)
      : null;

    const logId = payload.call_id || `call-${Date.now()}`;
    const logTimestamp = payload.call_start_date
      ? new Date(payload.call_start_date / 1000).toISOString()
      : new Date().toISOString();

    insertCallLog({
      id: logId,
      projectId: payload.project_id || payload.space_id || null,
      employeeId,
      employeeName,
      employeeRole,
      timestamp: logTimestamp,
      durationSec,
      summary: postPromptData?.summary || null,
      callerIntent: postPromptData?.caller_intent || null,
      outcome: postPromptData?.outcome || null,
      sentiment: postPromptData?.sentiment || null,
      topics: postPromptData?.topics || [],
      followUp: postPromptData?.follow_up || null,
      userMessages,
      assistantMessages,
      totalMessages: callLog.length,
      swaigCalls: swaigLog.length,
      avgLatencyMs: avgLatency,
      totalInputTokens: payload.total_input_tokens || 0,
      totalOutputTokens: payload.total_output_tokens || 0,
      rawPayload: payload,
    });

    console.log(`[PostPrompt] Stored call log: ${logId} (${employeeName}, ${durationSec}s, ${postPromptData?.outcome || 'unknown'})`);

    // Persist actions from global_data to call_actions table
    const globalData = payload?.global_data || {};
    const callId = logId;

    const actionMappings = [
      { key: 'customer_info', type: 'customer_info' },
      { key: 'message_taken', type: 'message' },
      { key: 'callback', type: 'callback' },
      { key: 'email_sent', type: 'email_sent' },
      { key: 'email_requested', type: 'email_sent' },
      { key: 'sms_sent', type: 'sms_sent' },
    ];

    for (const mapping of actionMappings) {
      const actionData = globalData[mapping.key];
      if (actionData && typeof actionData === 'object') {
        try {
          insertCallAction(callId, employeeId, mapping.type, actionData);
          console.log(`[post-prompt] Persisted ${mapping.type} action for call ${callId}`);
        } catch (err) {
          console.error(`[post-prompt] Failed to persist ${mapping.type}:`, err);
        }
      }
    }

    return Response.json({ success: true, id: logId });
  } catch (error) {
    console.error('[PostPrompt] Error processing payload:', error);
    return Response.json(
      { error: 'Failed to process post-prompt: ' + error.message },
      { status: 500 },
    );
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  const rows = getCallLogs(projectId || undefined);
  const logs = rows.map(callLogRowToJson);

  // Enrich logs with actions
  const enrichedLogs = logs.map(log => ({
    ...log,
    actions: getCallActions(log.id?.toString() || ''),
  }));

  return Response.json({ success: true, logs: enrichedLogs, count: enrichedLogs.length });
}
