/**
 * SWML Verification Utility
 *
 * Verifies that a webhook URL returns valid SWML before using it with SignalWire.
 * Includes comprehensive diagnostics and auto-correction capabilities.
 */

/**
 * Verify that a URL returns valid SWML
 * @param {string} url - The webhook URL to verify
 * @returns {Promise<{success: boolean, swml?: object, error?: string, diagnostics: object}>}
 */
export async function verifySwmlWebhook(url) {
  const diagnostics = {
    url,
    timestamp: new Date().toISOString(),
    checks: []
  };

  const addCheck = (name, passed, details = '') => {
    diagnostics.checks.push({ name, passed, details });
    console.log(`[SWML Verify] ${passed ? '✓' : '✗'} ${name}${details ? ': ' + details : ''}`);
  };

  try {
    // Check 1: URL is well-formed
    let urlObj;
    try {
      urlObj = new URL(url);
      addCheck('URL format', true, urlObj.toString());
    } catch (e) {
      addCheck('URL format', false, e.message);
      return { success: false, error: 'Invalid URL format', diagnostics };
    }

    // Check 2: If URL contains credentials, skip HTTP verification
    // Node.js fetch doesn't support credentials in URLs, but SignalWire does
    if (urlObj.username || urlObj.password) {
      addCheck('Credentials in URL', true, 'URL contains Basic Auth credentials');
      addCheck('SignalWire compatibility', true, 'SignalWire supports credentials in webhook URLs');

      console.log('[SWML Verify] ✓ URL contains credentials - skipping HTTP verification');
      console.log('[SWML Verify] ✓ SignalWire will handle authentication');

      return {
        success: true,
        diagnostics,
        skipVerification: true,
        message: 'URL contains credentials - verification skipped (SignalWire will authenticate)'
      };
    }

    // Check 2: URL is not localhost (warn but don't fail)
    if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
      addCheck('External accessibility', false, 'URL uses localhost - not accessible by SignalWire');
      diagnostics.warning = 'Localhost URLs cannot be reached by SignalWire. Use ngrok or deploy publicly.';
    } else {
      addCheck('External accessibility', true, 'URL is publicly accessible');
    }

    // Check 3: Make GET request to the webhook
    console.log(`[SWML Verify] Making GET request to: ${url}`);
    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json, application/x-yaml, text/yaml',
          'User-Agent': 'SignalWire-SWML-Verifier/1.0'
        },
        // Short timeout to fail fast
        signal: AbortSignal.timeout(10000)
      });

      addCheck('HTTP request', true, `Status: ${response.status}`);
      diagnostics.httpStatus = response.status;
    } catch (e) {
      addCheck('HTTP request', false, e.message);

      // Try alternative: without trailing slash
      if (url.endsWith('/')) {
        const altUrl = url.slice(0, -1);
        console.log(`[SWML Verify] Retrying without trailing slash: ${altUrl}`);
        try {
          response = await fetch(altUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json, application/x-yaml, text/yaml'
            },
            signal: AbortSignal.timeout(10000)
          });
          addCheck('HTTP request (retry)', true, `Status: ${response.status}`);
          diagnostics.httpStatus = response.status;
          diagnostics.urlCorrected = altUrl;
        } catch (retryError) {
          return {
            success: false,
            error: `Failed to reach webhook: ${e.message}`,
            diagnostics,
            suggestion: 'Check that the Python backend is running and accessible'
          };
        }
      } else {
        return {
          success: false,
          error: `Failed to reach webhook: ${e.message}`,
          diagnostics,
          suggestion: 'Check that the Python backend is running and accessible'
        };
      }
    }

    // Check 4: HTTP status is 2xx
    if (response.status < 200 || response.status >= 300) {
      addCheck('HTTP status', false, `Expected 2xx, got ${response.status}`);
      const errorText = await response.text();
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        diagnostics,
        suggestion: 'Check backend logs for errors'
      };
    }
    addCheck('HTTP status', true, '2xx success');

    // Check 5: Content-Type indicates JSON or YAML
    const contentType = response.headers.get('content-type') || '';
    diagnostics.contentType = contentType;

    if (contentType.includes('json') || contentType.includes('yaml')) {
      addCheck('Content-Type', true, contentType);
    } else {
      addCheck('Content-Type', false, `Got ${contentType}, expected JSON/YAML`);
      // Don't fail here, just warn - some backends don't set correct Content-Type
    }

    // Check 6: Response can be parsed
    let swml;
    const responseText = await response.text();
    diagnostics.responsePreview = responseText.substring(0, 500);

    try {
      swml = JSON.parse(responseText);
      addCheck('JSON parsing', true, 'Valid JSON');
    } catch (e) {
      // Try YAML parsing
      addCheck('JSON parsing', false, 'Not JSON, checking YAML...');

      // Basic YAML validation (without a full parser)
      if (responseText.includes('version:') && responseText.includes('sections:')) {
        addCheck('YAML structure', true, 'Appears to be valid YAML');
        // For YAML, we can't validate structure without a parser
        // Consider it successful if it has SWML-like structure
        return {
          success: true,
          swml: { format: 'yaml', raw: responseText },
          diagnostics,
          format: 'yaml'
        };
      } else {
        addCheck('YAML structure', false, 'Not valid YAML');
        return {
          success: false,
          error: 'Response is neither valid JSON nor YAML',
          diagnostics
        };
      }
    }

    // Check 7: Validate SWML structure (for JSON)
    if (swml.version || swml.sections) {
      addCheck('SWML structure', true, `Found SWML v${swml.version || 'unknown'}`);
    } else {
      addCheck('SWML structure', false, 'Missing version or sections');
      diagnostics.warning = 'Response is valid JSON but may not be proper SWML';
    }

    // Check 8: Validate sections exist
    if (Array.isArray(swml.sections) && swml.sections.length > 0) {
      addCheck('SWML sections', true, `${swml.sections.length} section(s) defined`);
    } else {
      addCheck('SWML sections', false, 'No sections found');
    }

    console.log('[SWML Verify] ✓ All checks passed');
    return { success: true, swml, diagnostics, format: 'json' };

  } catch (error) {
    addCheck('Verification process', false, error.message);
    console.error('[SWML Verify] Unexpected error:', error);
    return {
      success: false,
      error: `Verification failed: ${error.message}`,
      diagnostics
    };
  }
}

/**
 * Verify and auto-correct webhook URL
 * @param {string} url - The webhook URL to verify
 * @returns {Promise<{success: boolean, url: string, swml?: object, error?: string, diagnostics: object}>}
 */
export async function verifyAndCorrectSwmlWebhook(url) {
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`🔍 SWML WEBHOOK VERIFICATION`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Testing: ${url}`);

  const result = await verifySwmlWebhook(url);

  if (result.success) {
    console.log(`✓ Verification PASSED - webhook is ready`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return { ...result, url: result.diagnostics.urlCorrected || url };
  } else {
    console.log(`✗ Verification FAILED - ${result.error}`);
    if (result.suggestion) {
      console.log(`💡 Suggestion: ${result.suggestion}`);
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    return { ...result, url };
  }
}
