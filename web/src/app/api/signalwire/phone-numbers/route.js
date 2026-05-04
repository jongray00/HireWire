/**
 * GET /api/signalwire/phone-numbers
 *
 * Lists the SignalWire phone numbers on the caller's project. Used by the
 * employee form's PhoneNumberPicker dropdowns (transfer-to, transfer-from,
 * SMS-from) so users can pick existing numbers instead of typing them.
 *
 * Query params: spaceUrl, projectId, apiToken — same shape as the connect
 * route. All three are required; if any is missing we return an empty list
 * instead of erroring so the picker just shows "Custom number..." and the
 * user can still type one in.
 */
export async function GET(request) {
  const url = new URL(request.url);
  const spaceUrl = url.searchParams.get("spaceUrl");
  const projectId = url.searchParams.get("projectId");
  const apiToken = url.searchParams.get("apiToken");

  if (!spaceUrl || !projectId || !apiToken) {
    return Response.json({ success: true, phoneNumbers: [] });
  }

  const normalizedSpaceUrl = spaceUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const basicAuth = Buffer.from(`${projectId}:${apiToken}`).toString("base64");
  const apiUrl = `https://${normalizedSpaceUrl}/api/laml/2010-04-01/Accounts/${projectId}/IncomingPhoneNumbers.json?PageSize=200`;

  try {
    const res = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error("[phone-numbers] SignalWire API error", res.status, errorText.slice(0, 300));
      return Response.json(
        { success: false, error: `SignalWire API ${res.status}`, phoneNumbers: [] },
        { status: res.status === 401 || res.status === 403 ? res.status : 502 },
      );
    }

    const data = await res.json();
    const raw = Array.isArray(data?.incoming_phone_numbers) ? data.incoming_phone_numbers : [];

    const phoneNumbers = raw
      .map((p) => ({
        sid: p.sid,
        phoneNumber: p.phone_number,
        friendlyName: p.friendly_name && p.friendly_name !== p.phone_number ? p.friendly_name : "",
        capabilities: p.capabilities || null,
      }))
      .filter((p) => p.phoneNumber);

    return Response.json({ success: true, phoneNumbers });
  } catch (err) {
    console.error("[phone-numbers] fetch failed:", err);
    return Response.json(
      { success: false, error: err?.message || "fetch failed", phoneNumbers: [] },
      { status: 502 },
    );
  }
}
