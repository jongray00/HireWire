"use client";

import {
  Phone,
  PhoneOff,
  AlertCircle,
  CheckCircle,
  Copy,
  ExternalLink,
  Loader,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function CallControls({
  isCallActive,
  onCallStart,
  onCallEnd,
  onTranscriptUpdate,
  onEventUpdate,
  subscriberData,
  credentials,
}) {
  const [agentUrl, setAgentUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [widgetToken, setWidgetToken] = useState(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  const widgetRef = useRef(null);

  // Load SignalWire call widget script
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      !document.getElementById("sw-call-widget")
    ) {
      const script = document.createElement("script");
      script.id = "sw-call-widget";
      script.src =
        "https://cdn.jsdelivr.net/npm/@signalwire/call-widget/dist/c2c-widget-full.umd.min.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    if (subscriberData?.subscriberId) {
      const url = `${typeof window !== "undefined" ? window.location.origin : ""}/api/signalwire/agent/${subscriberData.subscriberId}`;
      setAgentUrl(url);
      onEventUpdate("system", "Agent webhook ready");

      // Get widget token
      fetchWidgetToken();
    }
  }, [subscriberData]);

  // Set up widget event listeners
  useEffect(() => {
    if (!widgetRef.current) return;

    const widget = widgetRef.current;

    const handleCallJoined = (event) => {
      onCallStart();
      onEventUpdate("call", "Call connected");
      onTranscriptUpdate("system", "Connected to AI agent...");
    };

    const handleCallLeft = (event) => {
      onCallEnd();
      onEventUpdate("call", "Call ended");
      onTranscriptUpdate("system", "Call disconnected");
    };

    const handleUserEvent = (event) => {
      console.log("User event:", event.detail);
      if (event.detail?.transcript) {
        onTranscriptUpdate(
          event.detail.speaker || "agent",
          event.detail.transcript,
        );
      }
    };

    widget.addEventListener("call.joined", handleCallJoined);
    widget.addEventListener("call.left", handleCallLeft);
    widget.addEventListener("user_event", handleUserEvent);

    return () => {
      widget.removeEventListener("call.joined", handleCallJoined);
      widget.removeEventListener("call.left", handleCallLeft);
      widget.removeEventListener("user_event", handleUserEvent);
    };
  }, [widgetRef.current]);

  const fetchWidgetToken = async () => {
    setIsLoadingToken(true);
    try {
      const response = await fetch("/api/signalwire/widget-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentials,
          subscriberId: subscriberData?.subscriberId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get widget token");
      }

      const data = await response.json();
      setWidgetToken(data.token);
      onEventUpdate("system", "Call widget ready");
    } catch (error) {
      console.error("Error fetching widget token:", error);
      onEventUpdate(
        "error",
        `Failed to initialize call widget: ${error.message}`,
      );
    } finally {
      setIsLoadingToken(false);
    }
  };

  const handleCopyUrl = async () => {
    if (agentUrl) {
      await navigator.clipboard.writeText(agentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatPhoneNumber = (number) => {
    if (!number) return "";
    const cleaned = number.replace(/\D/g, "");
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return cleaned.replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, "+$1 ($2) $3-$4");
    }
    if (cleaned.length === 10) {
      return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, "($1) $2-$3");
    }
    return number;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Phone className="text-white" size={20} />
            <h3 className="text-lg font-semibold text-white">
              Live Call Interface
            </h3>
          </div>

          <div className="flex items-center space-x-2">
            {isCallActive ? (
              <div className="flex items-center space-x-2 bg-white/20 px-3 py-1 rounded-full">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-white">
                  Live Call
                </span>
              </div>
            ) : widgetToken ? (
              <div className="flex items-center space-x-2 bg-white/20 px-3 py-1 rounded-full">
                <CheckCircle className="text-white" size={14} />
                <span className="text-sm font-medium text-white">Ready</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 bg-white/20 px-3 py-1 rounded-full">
                <Loader className="text-white animate-spin" size={14} />
                <span className="text-sm font-medium text-white">
                  Setting up...
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Agent Configuration */}
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Agent Configuration
          </h4>

          {agentUrl ? (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                    SWML Webhook URL
                  </label>
                  <code className="text-xs bg-white dark:bg-gray-800 px-2 py-1 rounded border font-mono break-all">
                    {agentUrl}
                  </code>
                </div>
                <div className="flex space-x-2 ml-3">
                  <button
                    onClick={handleCopyUrl}
                    className="p-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 
                             text-blue-600 dark:text-blue-400 rounded-lg transition-colors"
                    title="Copy URL"
                  >
                    {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                  </button>
                  <a
                    href={agentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 
                             text-green-600 dark:text-green-400 rounded-lg transition-colors"
                    title="View SWML"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Configure your SignalWire phone number to use this webhook URL
                to receive calls.
              </p>
            </div>
          ) : (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <AlertCircle
                  className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5"
                  size={16}
                />
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  Generate an agent first to enable calling.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Phone Number Info */}
        {subscriberData?.phoneNumber && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              SignalWire Phone Number
            </h4>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Phone className="text-blue-600 dark:text-blue-400" size={18} />
                <div>
                  <p className="font-mono text-lg font-semibold text-blue-900 dark:text-blue-100">
                    {formatPhoneNumber(subscriberData.phoneNumber)}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Configure this number to use the webhook above
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Browser Call Widget */}
        {widgetToken && subscriberData?.subscriberId && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Test Your Agent (Browser Call)
            </h4>

            <div
              className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 
                          border-2 border-green-200 dark:border-green-800 rounded-lg p-6"
            >
              <div className="text-center mb-4">
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                  Click below to call your AI agent directly from your browser
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  No phone number needed - uses WebRTC for instant connection
                </p>
              </div>

              <div className="flex justify-center">
                <button
                  id="call-widget-btn"
                  className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 
                           hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-lg shadow-lg
                           transition-all duration-200 hover:shadow-xl hover:scale-105 active:scale-95
                           flex items-center space-x-3"
                >
                  <Phone size={24} />
                  <span className="text-lg">Call AI Agent Now</span>
                </button>
              </div>

              {/* SignalWire Call Widget */}
              <call-widget
                ref={widgetRef}
                button-id="call-widget-btn"
                token={widgetToken}
                destination={`/private/${subscriberData.subscriberId}`}
                support-audio="true"
                support-video="false"
                window-mode="audio+transcript"
                log-level="info"
              ></call-widget>
            </div>
          </div>
        )}

        {isLoadingToken && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-3">
              <Loader
                className="animate-spin text-blue-600 dark:text-blue-400"
                size={18}
              />
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Initializing call widget...
              </p>
            </div>
          </div>
        )}

        {/* Connection Info */}
        {widgetToken && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Protocol
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  WebRTC
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Format
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  SWML
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Status
                </p>
                <p className="text-sm font-semibold text-green-600 dark:text-green-400">
                  {isCallActive ? "Active" : "Ready"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
