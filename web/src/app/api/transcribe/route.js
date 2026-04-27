/**
 * Live Transcription Webhook Route
 *
 * Receives real-time transcript events from SignalWire's live_transcribe
 * and forwards them to the Python backend which has access to the call context.
 */

const PYTHON_BACKEND_URL = process.env.AGENT_BACKEND_URL || 'http://localhost:3030';

export async function POST(request) {
  try {
    const payload = await request.json();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 LIVE TRANSCRIPT EVENT RECEIVED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Payload:', JSON.stringify(payload, null, 2));

    // Extract transcript data from the payload
    const {
      event_type,
      transcript,
      text,
      speaker,
      call_id,
      confidence,
      is_final
    } = payload;

    const transcriptText = transcript || text;

    if (!transcriptText) {
      console.log('⚠️  No transcript text in payload, skipping');
      return Response.json({ success: true, message: 'No transcript to process' });
    }

    console.log(`🗣️  Speaker: ${speaker || 'unknown'}`);
    console.log(`💬 Text: ${transcriptText}`);
    console.log(`🎯 Call ID: ${call_id || 'N/A'}`);
    console.log(`✅ Is Final: ${is_final}`);

    // Forward to Python backend which has access to the call via Agent SDK
    console.log(`🔄 Forwarding transcript to Python backend: ${PYTHON_BACKEND_URL}/api/transcript-event`);

    try {
      const backendResponse = await fetch(`${PYTHON_BACKEND_URL}/api/transcript-event`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          speaker,
          text: transcriptText,
          call_id,
          confidence,
          is_final,
          event_type,
          timestamp: new Date().toISOString()
        })
      });

      if (backendResponse.ok) {
        console.log('✅ Transcript forwarded to Python backend successfully');
        return Response.json({ success: true, message: 'Transcript forwarded to backend' });
      } else {
        const errorText = await backendResponse.text();
        console.error(`❌ Backend failed to process transcript: ${backendResponse.status} - ${errorText}`);
        return Response.json(
          { error: 'Backend failed to process transcript: ' + errorText },
          { status: 500 }
        );
      }
    } catch (error) {
      console.error('❌ Error forwarding to Python backend:', error);
      return Response.json(
        { error: 'Failed to forward to backend: ' + error.message },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('❌ Error processing transcript webhook:', error);
    return Response.json(
      { error: 'Failed to process transcript: ' + error.message },
      { status: 500 }
    );
  }
}

// Also support GET for webhook verification
export async function GET(request) {
  return Response.json({
    status: 'ok',
    message: 'Transcript webhook endpoint is ready'
  });
}
