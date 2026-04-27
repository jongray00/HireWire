import { useState, useCallback } from "react";
import { useNavigate } from "react-router";

/**
 * useCallWidget Hook
 *
 * Reusable hook for initiating calls using the SignalWire Call Widget
 *
 * @returns {Object} { initiateCall, calling, error }
 */
export function useCallWidget() {
  const navigate = useNavigate();
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState(null);

  const initiateCall = useCallback(async (destination, userVariables = {}) => {
    if (!destination) {
      const errorMsg = "No call destination provided";
      setError(errorMsg);
      alert(errorMsg);
      return false;
    }

    try {
      setCalling(true);
      setError(null);

      // Get session data
      const session = localStorage.getItem("sally_sales_session");
      if (!session) {
        navigate("/login");
        return false;
      }

      const sessionData = JSON.parse(session);
      const credentials = sessionData.credentials;

      // Use the persistent subscriber from login session
      const subscriberReference = sessionData.subscriberData?.subscriberId || "sally_sales_default_user";

      console.log("Initiating call with subscriber:", subscriberReference);
      console.log("Calling destination:", destination);

      // Generate widget token for the session subscriber
      const response = await fetch("/api/signalwire/widget-token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credentials,
          subscriberReference,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate call token");
      }

      const { token } = await response.json();

      // Generate unique IDs
      const callId = Date.now() + Math.random().toString(36).substring(7);
      const buttonId = `call-button-${callId}`;
      const widgetId = `call-widget-${callId}`;

      // Clean up any existing widget
      const existingWidget = document.getElementById(widgetId);
      if (existingWidget) {
        existingWidget.remove();
      }

      // Create hidden trigger button
      let button = document.getElementById(buttonId);
      if (!button) {
        button = document.createElement("button");
        button.id = buttonId;
        button.style.display = "none";
        document.body.appendChild(button);
      }

      // Create call widget element
      const widget = document.createElement("call-widget");
      widget.id = widgetId;
      widget.setAttribute("button-id", buttonId);
      widget.setAttribute("token", token);
      widget.setAttribute("destination", destination);
      widget.setAttribute("support-audio", "true");
      widget.setAttribute("support-video", "true");
      widget.setAttribute("window-mode", "video+transcript");
      widget.setAttribute("log-level", "info");

      // Add user variables
      if (userVariables && Object.keys(userVariables).length > 0) {
        widget.setAttribute("user-variables", JSON.stringify(userVariables));
      }

      // Event listeners
      widget.addEventListener("call.joined", () => {
        console.log("Call joined:", destination);
      });

      widget.addEventListener("call.left", () => {
        console.log("Call ended:", destination);
        setCalling(false);
        // Clean up widgets after call ends
        setTimeout(() => {
          widget.remove();
          button.remove();
        }, 1000);
      });

      widget.addEventListener("call.error", (event) => {
        console.error("Call error:", event.detail);
        const errorDetail = event.detail;
        let errorMessage = "Call failed: ";

        if (errorDetail?.message) {
          errorMessage += errorDetail.message;
        } else if (errorDetail?.code) {
          errorMessage += `Error code ${errorDetail.code}`;
        } else {
          errorMessage += "Unknown error";
        }

        // Add specific guidance for URI errors
        if (errorDetail?.message?.includes("Uri is invalid") ||
            errorDetail?.message?.includes("invalid_parameter")) {
          errorMessage += "\n\nThis may indicate:\n" +
            "- The resource doesn't exist in your SignalWire space\n" +
            "- The resource name contains invalid characters\n" +
            "- The subscriber doesn't have permission to call this resource";
        }

        setError(errorMessage);
        setCalling(false);
      });

      // Append widget to body
      document.body.appendChild(widget);

      // Trigger call after short delay to ensure widget is ready
      setTimeout(() => {
        button.click();
      }, 500);

      return true;

    } catch (error) {
      console.error("Error initiating call:", error);
      const errorMsg = "Failed to initiate call: " + error.message;
      setError(errorMsg);
      alert(errorMsg);
      setCalling(false);
      return false;
    }
  }, [navigate]);

  return {
    initiateCall,
    calling,
    error,
    clearError: () => setError(null),
  };
}
