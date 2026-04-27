export async function POST(request) {
  try {
    const { credentials, subscriberReference } = await request.json();

    if (!credentials || !subscriberReference) {
      return Response.json(
        { error: "Missing required parameters: credentials and subscriberReference" },
        { status: 400 },
      );
    }

    const { spaceUrl, projectId, apiToken } = credentials;
    const normalizedSpaceUrl = spaceUrl
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "");
    const baseUrl = `https://${normalizedSpaceUrl}`;
    const basicAuth = Buffer.from(`${projectId}:${apiToken}`).toString("base64");

    console.log("Generating Call Fabric token for subscriber:", subscriberReference);

    // STEP 1: Check if subscriber already exists by reference
    let subscriber = null;

    try {
      const checkByRefResponse = await fetch(
        `${baseUrl}/api/fabric/subscribers?subscriber=${encodeURIComponent(subscriberReference)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Basic ${basicAuth}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (checkByRefResponse.ok) {
        const refData = await checkByRefResponse.json();
        if (refData.data && refData.data.length > 0) {
          subscriber = refData.data[0];
          console.log("♻️  REUSING existing subscriber:", subscriber.id);

          // Update subscriber to remove any calling restrictions
          // This allows the subscriber to call any resource
          try {
            const updateResponse = await fetch(
              `${baseUrl}/api/fabric/subscribers/${subscriber.id}`,
              {
                method: "PUT",
                headers: {
                  Authorization: `Basic ${basicAuth}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  channels: {}  // Empty channels removes restrictions
                }),
              }
            );

            if (updateResponse.ok) {
              console.log("✅ Updated subscriber to remove calling restrictions");
            } else {
              console.log("⚠️  Could not update subscriber, proceeding anyway");
            }
          } catch (updateError) {
            console.log("⚠️  Error updating subscriber:", updateError.message);
          }
        }
      }
    } catch (checkError) {
      console.log("Subscriber check failed, will attempt creation:", checkError.message);
    }

    // STEP 2: If subscriber doesn't exist, create it
    if (!subscriber) {
      console.log("Creating new subscriber:", subscriberReference);

      const createResponse = await fetch(`${baseUrl}/api/fabric/subscribers`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${basicAuth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subscriber: subscriberReference,
          display_name: "Sally Sales User",
          // No channels specified - allows calling any resource
        }),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();

        // If creation fails due to duplicate, try to fetch it again
        if (createResponse.status === 422 || errorText.includes("already")) {
          console.log("Subscriber already exists, fetching again...");
          const retryResponse = await fetch(
            `${baseUrl}/api/fabric/subscribers?subscriber=${encodeURIComponent(subscriberReference)}`,
            {
              method: "GET",
              headers: {
                Authorization: `Basic ${basicAuth}`,
                "Content-Type": "application/json",
              },
            }
          );

          if (retryResponse.ok) {
            const retryData = await retryResponse.json();
            if (retryData.data && retryData.data.length > 0) {
              subscriber = retryData.data[0];
              console.log("♻️  Retrieved existing subscriber after creation failure");
            }
          }
        }

        if (!subscriber) {
          console.error("Subscriber creation failed:", createResponse.status, errorText);
          return Response.json(
            {
              error: "Failed to create subscriber",
              details: errorText,
            },
            { status: createResponse.status },
          );
        }
      } else {
        subscriber = await createResponse.json();
        console.log("✅ New subscriber created:", subscriber.id);
      }
    }

    // STEP 3: Generate token for the subscriber (existing or newly created)
    const tokenResponse = await fetch(`${baseUrl}/api/fabric/subscribers/tokens`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reference: subscriberReference,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token generation failed:", tokenResponse.status, errorText);
      return Response.json(
        {
          error: "Failed to generate token",
          details: errorText,
        },
        { status: tokenResponse.status },
      );
    }

    const tokenData = await tokenResponse.json();
    console.log("✅ Token generated successfully for subscriber:", subscriberReference);

    return Response.json({
      token: tokenData.token,
      subscriberId: subscriber.id,
      subscriberReference: subscriberReference,
      reused: subscriber !== null,
    });
  } catch (error) {
    console.error("Error generating widget token:", error);
    return Response.json(
      { error: "Failed to generate widget token: " + error.message },
      { status: 500 },
    );
  }
}
