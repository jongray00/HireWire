/**
 * GET /api/signalwire/campaign-registry-numbers
 *
 * Returns the deduplicated set of phone numbers currently assigned to a
 * Campaign Registry campaign on the caller's SignalWire project. These are
 * the numbers eligible for 10DLC / TCR-registered SMS traffic — i.e. the
 * pool a "SMS From Number" picker should restrict itself to.
 *
 * Traversal:
 *   GET /api/relay/rest/registry/beta/brands
 *   → for each brand:
 *     GET /api/relay/rest/registry/beta/brands/{brand_id}/campaigns
 *     → for each campaign:
 *       GET /api/relay/rest/registry/beta/campaigns/{campaign_id}/numbers
 *
 * If the project has no brands/campaigns yet, returns an empty list so the
 * picker gracefully falls back to "Custom number...".
 *
 * Query params: spaceUrl, projectId, apiToken — same shape as the sibling
 * phone-numbers route.
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
  const base = `https://${normalizedSpaceUrl}`;
  const basicAuth = Buffer.from(`${projectId}:${apiToken}`).toString("base64");
  const authHeader = { Authorization: `Basic ${basicAuth}` };

  const fetchJson = async (path) => {
    const res = await fetch(`${base}${path}`, { headers: authHeader });
    if (!res.ok) {
      const errorText = await res.text();
      const err = new Error(
        `SignalWire ${res.status} ${path}: ${errorText.slice(0, 200)}`,
      );
      err.status = res.status;
      throw err;
    }
    return res.json();
  };

  try {
    // 1. Brands
    const brandsBody = await fetchJson("/api/relay/rest/registry/beta/brands");
    const brands = Array.isArray(brandsBody?.data) ? brandsBody.data : [];
    if (brands.length === 0) {
      return Response.json({ success: true, phoneNumbers: [] });
    }

    // 2. Campaigns per brand (parallel)
    const campaignsByBrand = await Promise.all(
      brands.map((b) =>
        fetchJson(
          `/api/relay/rest/registry/beta/brands/${encodeURIComponent(b.id)}/campaigns`,
        ).catch((err) => {
          console.warn(
            `[campaign-registry-numbers] brand ${b.id} campaigns failed:`,
            err.message,
          );
          return { data: [] };
        }),
      ),
    );
    const campaignIds = new Set();
    for (const body of campaignsByBrand) {
      for (const c of body?.data || []) {
        if (c?.id) campaignIds.add(c.id);
      }
    }
    if (campaignIds.size === 0) {
      return Response.json({ success: true, phoneNumbers: [] });
    }

    // 3. Phone-number assignments per campaign (parallel)
    const numbersByCampaign = await Promise.all(
      Array.from(campaignIds).map((cid) =>
        fetchJson(
          `/api/relay/rest/registry/beta/campaigns/${encodeURIComponent(cid)}/numbers`,
        ).catch((err) => {
          console.warn(
            `[campaign-registry-numbers] campaign ${cid} numbers failed:`,
            err.message,
          );
          return { data: [] };
        }),
      ),
    );

    // Deduplicate by E.164 number string
    const seen = new Map();
    for (const body of numbersByCampaign) {
      for (const a of body?.data || []) {
        const num = a?.phone_number?.number;
        if (!num || seen.has(num)) continue;
        seen.set(num, {
          phoneNumber: num,
          friendlyName: a.phone_number?.name || "",
          campaignId: a.campaign_id || null,
          state: a.state || null,
        });
      }
    }
    const phoneNumbers = Array.from(seen.values());
    return Response.json({ success: true, phoneNumbers });
  } catch (err) {
    console.error("[campaign-registry-numbers] failed:", err);
    const status =
      err.status === 401 || err.status === 403
        ? err.status
        : 502;
    return Response.json(
      { success: false, error: err.message || "fetch failed", phoneNumbers: [] },
      { status },
    );
  }
}
