"use client";

import { useState, useEffect, useRef } from "react";
import {
  Phone,
  PhoneOff,
  Settings,
  Code,
  MessageSquare,
  Zap,
  LogIn,
  User,
} from "lucide-react";
import TranscriptPanel from "@/components/demo-ivr/TranscriptPanel";
import CodeViewer from "@/components/demo-ivr/CodeViewer";
import AdvancedCallControls from "@/components/demo-ivr/AdvancedCallControls";
import ResourceList from "@/components/demo-ivr/ResourceList";
import ResourceSelector from "@/components/demo-ivr/ResourceSelector";
import CallOptionsModal from "@/components/demo-ivr/CallOptionsModal";
import * as SignalWire from "@signalwire/js";

const EXAMPLE_PROMPTS = [
  "I run a pizza shop. Customers should be able to: 1) Order pizza with size and toppings, 2) Check delivery status by order number, 3) Speak to a manager",
  "I'm a dental office. Callers can: 1) Schedule an appointment, 2) Check appointment status, 3) Ask about services, 4) Talk to the receptionist",
  "I'm a tech support line. Options: 1) Report a bug with severity level, 2) Request a feature, 3) Check ticket status, 4) Escalate to engineer",
];

export default function DemoIVRPage() {
  const [prompt, setPrompt] = useState(EXAMPLE_PROMPTS[0]);

  // Make SignalWire SDK available globally
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.SignalWire = SignalWire;
      console.log('SignalWire SDK loaded from npm package');
    }
  }, []);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [transcript, setTranscript] = useState([]);
  const [generatedCode, setGeneratedCode] = useState("");
  const [events, setEvents] = useState([]);
  const [callDuration, setCallDuration] = useState(0);
  const [agentEvents, setAgentEvents] = useState([]);
  const [agentAddress, setAgentAddress] = useState(null); // Store the address to dial

  // SignalWire credentials
  const [credentials, setCredentials] = useState({
    spaceUrl: "demo.signalwire.com",
    projectId: "5d30e1ba-32c2-4d62-b94c-4855c2ba739e",
    apiToken: "PTe6d2153a3f9aa2043072c4c51936ba752e94fac0dd15b70f",
  });
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [subscriberData, setSubscriberData] = useState(null);
  const [selectedResource, setSelectedResource] = useState(null);
  const [showResourceSelector, setShowResourceSelector] = useState(false);

  // Call modal state
  const [showCallModal, setShowCallModal] = useState(false);
  const [resourceToCall, setResourceToCall] = useState(null);
  const [callType, setCallType] = useState(null); // 'voice' or 'video'
  const [externalCallTrigger, setExternalCallTrigger] = useState(null);

  const callStartTimeRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const videoElementRef = useRef(null); // Ref for video container element

  // Update call duration timer
  useEffect(() => {
    if (isCallActive && callStartTimeRef.current) {
      timerIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor(
          (Date.now() - callStartTimeRef.current) / 1000,
        );
        setCallDuration(elapsed);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      setCallDuration(0);
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isCallActive]);

  const handleSignalWireLogin = async () => {
    setIsConnecting(true);
    setEvents([]);

    try {
      // ALWAYS use the default subscriber ID to avoid creating expensive duplicates
      const DEFAULT_SUBSCRIBER_ID = 'sally_sales_default_user';

      // Migration: Check for old random subscriber IDs and clear them
      const storedSubscriberId = typeof window !== 'undefined' ? localStorage.getItem('sally_sales_subscriber_id') : null;

      let migrated = false;
      if (storedSubscriberId && storedSubscriberId !== DEFAULT_SUBSCRIBER_ID) {
        // Check if it's an old random ID pattern: subscriber_1234567890_abc123xyz
        if (storedSubscriberId.match(/^subscriber_\d+_[a-z0-9]+$/)) {
          console.log(`🔄 MIGRATION: Replacing old random subscriber ID (${storedSubscriberId}) with optimized default (${DEFAULT_SUBSCRIBER_ID})`);
          console.log('💰 This prevents creating expensive duplicate subscribers');
          migrated = true;

          // Clear old subscriber ID
          if (typeof window !== 'undefined') {
            localStorage.removeItem('sally_sales_subscriber_id');
          }
        }
      }

      // Always use the default subscriber ID
      const subscriberId = DEFAULT_SUBSCRIBER_ID;

      // Store the default for future sessions
      if (typeof window !== 'undefined') {
        localStorage.setItem('sally_sales_subscriber_id', DEFAULT_SUBSCRIBER_ID);
      }

      // Test credentials and create/reuse subscriber
      const response = await fetch("/api/signalwire/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...credentials,
          subscriberId: subscriberId
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to connect to SignalWire");
      }

      const data = await response.json();

      // Show migration message if applicable
      if (migrated) {
        console.log('✅ Successfully migrated to optimized subscriber management');
      }

      setSubscriberData(data);
      setIsLoggedIn(true);

      setEvents([
        {
          type: "system",
          message: `Connected to SignalWire Space: ${credentials.spaceUrl}`,
          timestamp: new Date().toISOString(),
        },
        {
          type: "system",
          message: `Subscriber: ${data.subscriberId} ${data.subscriberCreated ? '(new)' : '(reused)'}`,
          timestamp: new Date().toISOString(),
        },
        {
          type: "system",
          message: `Phone number: ${data.phoneNumber || "Not assigned"}`,
          timestamp: new Date().toISOString(),
        },
      ]);

      setIsConnecting(false);
    } catch (error) {
      console.error("Error connecting to SignalWire:", error);
      setEvents([
        {
          type: "error",
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      ]);
      setIsConnecting(false);
    }
  };

  const handleGenerateAndCall = async () => {
    if (!isLoggedIn) {
      setEvents([
        {
          type: "error",
          message: "Please connect to SignalWire first",
          timestamp: new Date().toISOString(),
        },
      ]);
      return;
    }

    setIsGenerating(true);
    setTranscript([]);
    setGeneratedCode("");

    try {
      // Generate agent configuration from prompt
      const response = await fetch("/api/signalwire/generate-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          credentials,
          subscriberId: subscriberData?.subscriberId,
          resourceId: selectedResource?.id,
          displayName: selectedResource?.display_name
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate agent configuration");
      }

      const data = await response.json();
      setGeneratedCode(data.backendConfig?.prompt || prompt); // Show the prompt that was configured
      setAgentAddress(data.callTo); // Store the address to dial

      // Add events
      setEvents((prev) => [
        ...prev,
        {
          type: "system",
          message: `SWML Agent ${data.resourceAction || 'configured'}`,
          timestamp: new Date().toISOString(),
        },
        {
          type: "system",
          message: `Resource: ${data.resource?.display_name || 'Unknown'}`,
          timestamp: new Date().toISOString(),
        },
        {
          type: "system",
          message: `Agent deployed to: ${data.agentUrl}`,
          timestamp: new Date().toISOString(),
        },
        {
          type: "system",
          message: `Call address: ${data.callTo}`,
          timestamp: new Date().toISOString(),
        },
      ]);

      setIsGenerating(false);
    } catch (error) {
      console.error("Error generating agent:", error);
      setEvents((prev) => [
        ...prev,
        {
          type: "error",
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      ]);
      setIsGenerating(false);
    }
  };

  const handleResourceSelect = (resource) => {
    setSelectedResource(resource);
    console.log('Selected resource:', resource);
  };

  const handleCallResource = (resource) => {
    setResourceToCall(resource);
    setShowCallModal(true);
  };

  const handleSelectCallType = (type) => {
    setCallType(type);
    // Trigger external call with resource and type
    setExternalCallTrigger({
      resource: resourceToCall,
      type: type,
      timestamp: Date.now()
    });
    console.log(`Initiating ${type} call to:`, resourceToCall.display_name);
  };

  const handleCallStart = () => {
    setIsCallActive(true);
    callStartTimeRef.current = Date.now();
    setTranscript([
      {
        speaker: "system",
        text: "Call connected...",
        timestamp: new Date().toISOString(),
      },
    ]);
    setEvents((prev) => [
      ...prev,
      {
        type: "call",
        message: "Call initiated",
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const handleCallEnd = () => {
    setIsCallActive(false);
    callStartTimeRef.current = null;
    setTranscript((prev) => [
      ...prev,
      {
        speaker: "system",
        text: "Call ended",
        timestamp: new Date().toISOString(),
      },
    ]);
    setEvents((prev) => [
      ...prev,
      {
        type: "call",
        message: "Call terminated",
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const handleTranscriptUpdate = (speaker, text) => {
    setTranscript((prev) => {
      // Check if last message is from the same speaker - if so, update it for real-time feedback
      // This ensures one bubble per speaking turn that updates as text arrives
      if (prev.length > 0 && prev[prev.length - 1].speaker === speaker) {
        const updated = [...prev];
        const lastMessage = updated[updated.length - 1];

        // For AI: append new utterance pieces (each event is a new piece)
        // For User: replace text (partial_result already contains full accumulated text)
        if (speaker === 'ai' || speaker === 'bot') {
          // AI utterances are incremental - append with space
          updated[updated.length - 1] = {
            ...lastMessage,
            text: `${lastMessage.text} ${text}`.trim(),
          };
        } else {
          // User text is already accumulated - replace
          updated[updated.length - 1] = {
            ...lastMessage,
            text: text,
          };
        }
        return updated;
      } else {
        // Append new message for different speaker or first message
        return [
          ...prev,
          {
            speaker,
            text,
            timestamp: new Date().toISOString(),
          },
        ];
      }
    });
  };

  const handleEventUpdate = (type, message) => {
    setEvents((prev) => [
      ...prev,
      {
        type,
        message,
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  const handleAgentEvent = (eventData) => {
    setAgentEvents((prev) => [
      ...prev,
      {
        ...eventData,
        timestamp: new Date().toISOString(),
      },
    ]);

    // Handle specific agent events for UI updates
    switch(eventData.type) {
      case 'order_started':
        handleEventUpdate("agent", "Customer started placing an order");
        break;
      case 'item_added':
        handleEventUpdate("agent", `Added ${eventData.item?.name || 'item'} to order`);
        break;
      case 'routing_decision':
        handleEventUpdate("agent", `Routing to ${eventData.department || 'department'}`);
        break;
      case 'agent_thinking':
        handleEventUpdate("agent", `Agent processing: ${eventData.status || 'thinking'}`);
        break;
      default:
        handleEventUpdate("agent", `Agent event: ${eventData.type}`);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sw-charcoal-900 to-sw-charcoal-800">
      {/* Header */}
      <header className="bg-sw-charcoal-800 border-b border-sw-border-dark backdrop-blur-sm bg-opacity-95 sticky top-0 z-10 glow-border">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-sw-blue to-sw-pink rounded-lg flex items-center justify-center shadow-lg shadow-sw-pink/50">
                <Zap className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  SignalWire AI IVR Demo
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Configure your phone menu with natural language
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {isLoggedIn && (
                <div className="flex items-center space-x-3">
                  <div className="flex items-center space-x-2 bg-green-100 dark:bg-green-900/30 px-4 py-2 rounded-full">
                    <User
                      className="text-green-600 dark:text-green-400"
                      size={16}
                    />
                    <span className="text-sm font-medium text-green-700 dark:text-green-300">
                      Connected
                    </span>
                  </div>
                  {subscriberData && (
                    <div className={`flex items-center space-x-2 px-4 py-2 rounded-full ${
                      subscriberData.subscriberCreated
                        ? 'bg-sw-yellow/20 border border-sw-yellow/30'
                        : 'bg-sw-blue/20 border border-sw-blue/30'
                    }`} title={`Subscriber ID: ${subscriberData.subscriberId}`}>
                      <span className="text-sm font-medium">
                        {subscriberData.subscriberCreated ? '🆕 New' : '♻️ Reused'}
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                        {subscriberData.subscriberId}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {isCallActive && (
                <div className="flex items-center space-x-2 bg-sw-pink/20 px-4 py-2 rounded-full border border-sw-pink/30">
                  <div className="w-2 h-2 bg-sw-pink rounded-full animate-pulse shadow-lg shadow-sw-pink/50"></div>
                  <span className="text-sm font-medium text-sw-breeze">
                    Call Active: {formatDuration(callDuration)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-[1800px] mx-auto px-6 py-8">
        {/* SignalWire Setup Guide & Login */}
        {!isLoggedIn && (
          <div className="space-y-6 mb-6">
            {/* Setup Guide */}
            <div className="bg-gradient-to-br from-sw-charcoal-700 to-sw-charcoal-800 rounded-xl border border-sw-blue/20 p-6 glow-accent">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-gradient-to-br from-sw-blue to-sw-pink rounded-lg flex items-center justify-center shadow-lg shadow-sw-blue/30">
                    <Zap className="text-white" size={24} />
                  </div>
                </div>
                
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-sw-breeze mb-2">
                    🚀 Quick Setup Guide
                  </h3>
                  
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-sw-charcoal-700 rounded-lg p-4 border border-sw-pink/20 glow-accent">
                      <div className="text-sw-pink font-semibold text-sm mb-2">
                        Step 1: Get SignalWire Account
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                        Sign up at signalwire.com (free trial available)
                      </p>
                      <a 
                        href="https://signalwire.com/signup" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                      >
                        Sign Up Free →
                      </a>
                    </div>
                    
                    <div className="bg-sw-charcoal-700 rounded-lg p-4 border border-sw-pink/20 glow-accent">
                      <div className="text-sw-pink font-semibold text-sm mb-2">
                        Step 2: Access API Credentials
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                        Go to your Space → API → Copy credentials
                      </p>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Space URL, Project ID, API Token
                      </div>
                    </div>
                    
                    <div className="bg-sw-charcoal-700 rounded-lg p-4 border border-sw-pink/20 glow-accent">
                      <div className="text-sw-pink font-semibold text-sm mb-2">
                        Step 3: Connect & Demo
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
                        Paste credentials below and start building
                      </p>
                      <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                        No phone required! ✨
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-sw-yellow/10 border border-sw-yellow/30 rounded-lg p-3">
                    <div className="flex items-start space-x-2">
                      <div className="text-sw-yellow text-xs font-medium">💡 Pro Tip:</div>
                      <div className="text-xs text-gray-300">
                        This demo uses <strong>WebRTC</strong> for browser calling - no phone number setup needed! 
                        Just enter your API credentials and click the call button to talk directly to your AI agent.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Credentials Input */}
            <div className="bg-sw-charcoal-700 rounded-xl shadow-2xl border border-sw-breeze/10 glow-accent p-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-sw-charcoal-800 rounded-lg flex items-center justify-center border border-sw-blue/30">
                    <LogIn
                      className="text-sw-blue"
                      size={24}
                    />
                  </div>
                </div>

                <div className="flex-1">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
                    Enter Your SignalWire API Credentials
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Space URL
                      </label>
                      <input
                        type="text"
                        value={credentials.spaceUrl}
                        onChange={(e) =>
                          setCredentials((prev) => ({
                            ...prev,
                            spaceUrl: e.target.value,
                          }))
                        }
                        placeholder="your-space.signalwire.com"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                 bg-sw-charcoal-900 text-white text-sm border-sw-breeze/20
                                 focus:border-sw-pink focus:ring-2 focus:ring-sw-pink/30"
                      />
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Found in Space → Settings
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        Project ID
                      </label>
                      <input
                        type="text"
                        value={credentials.projectId}
                        onChange={(e) =>
                          setCredentials((prev) => ({
                            ...prev,
                            projectId: e.target.value,
                          }))
                        }
                        placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                 bg-sw-charcoal-900 text-white text-sm border-sw-breeze/20
                                 focus:border-sw-pink focus:ring-2 focus:ring-sw-pink/30"
                      />
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Found in Space → API
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                        API Token
                      </label>
                      <input
                        type="password"
                        value={credentials.apiToken}
                        onChange={(e) =>
                          setCredentials((prev) => ({
                            ...prev,
                            apiToken: e.target.value,
                          }))
                        }
                        placeholder="PT..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                                 bg-sw-charcoal-900 text-white text-sm border-sw-breeze/20
                                 focus:border-sw-pink focus:ring-2 focus:ring-sw-pink/30"
                      />
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Found in Space → API
                      </p>
                    </div>
                  </div>

                  <div className="bg-sw-charcoal-800 rounded-lg p-3 mb-4 border border-sw-pink/10">
                    <div className="text-xs text-gray-600 dark:text-gray-300">
                      <strong>🔒 Security:</strong> Your credentials are only used to connect to your SignalWire space and generate WebRTC tokens.
                      They're never stored permanently and only exist in your browser session.
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <button
                    onClick={handleSignalWireLogin}
                    disabled={
                      isConnecting ||
                      !credentials.spaceUrl ||
                      !credentials.projectId ||
                      !credentials.apiToken
                    }
                    className="h-12 px-6 bg-gradient-to-r from-sw-blue to-sw-pink hover:from-sw-deepSea hover:to-sw-pink-light dark:from-sw-pink dark:to-sw-breeze dark:hover:from-sw-pink-light dark:hover:to-sw-breeze
                             text-white font-semibold rounded-lg shadow-lg
                             disabled:opacity-50 disabled:cursor-not-allowed
                             transition-all duration-150 hover:shadow-xl hover:scale-105 active:scale-95
                             flex items-center space-x-2"
                  >
                    {isConnecting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <LogIn size={18} />
                        <span>Connect</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Advanced Call Controls */}
        {generatedCode && (
          <div className="mb-6">
            <AdvancedCallControls
              isCallActive={isCallActive}
              onCallStart={handleCallStart}
              onCallEnd={handleCallEnd}
              onTranscriptUpdate={handleTranscriptUpdate}
              onEventUpdate={handleEventUpdate}
              onAgentEvent={handleAgentEvent}
              subscriberData={subscriberData}
              credentials={credentials}
              agentAddress={agentAddress}
              videoElementRef={videoElementRef}
              externalCallTrigger={externalCallTrigger}
            />
          </div>
        )}

        {/* Resource List - Show after login, before generating */}
        {isLoggedIn && !isCallActive && !generatedCode && (
          <div className="mb-6">
            <ResourceList
              credentials={credentials}
              onResourceSelect={handleResourceSelect}
              selectedResourceId={selectedResource?.id}
              onCallResource={handleCallResource}
              onRefresh={() => {
                setEvents(prev => [...prev, {
                  type: 'system',
                  message: 'Resources refreshed',
                  timestamp: new Date().toISOString()
                }]);
              }}
            />
          </div>
        )}

        {/* Resource Selection Summary - Show after generating */}
        {isLoggedIn && generatedCode && selectedResource && !isCallActive && (
          <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-700 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Zap className="text-blue-600 dark:text-blue-400" size={20} />
                <div>
                  <div className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                    Using: {selectedResource.display_name}
                  </div>
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    Type: {selectedResource.type}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setGeneratedCode("");
                  setAgentAddress(null);
                }}
                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
              >
                Change Resource
              </button>
            </div>
          </div>
        )}

        {/* Resource Selector Modal */}
        <ResourceSelector
          isOpen={showResourceSelector}
          onClose={() => setShowResourceSelector(false)}
          onSelect={handleResourceSelect}
          selectedResource={selectedResource}
        />

        {/* Call Options Modal */}
        <CallOptionsModal
          isOpen={showCallModal}
          onClose={() => setShowCallModal(false)}
          resource={resourceToCall}
          onSelectCallType={handleSelectCallType}
        />

        {/* Prompt Input Section - Only show when logged in */}
        {isLoggedIn && (
          <div className="bg-sw-charcoal-700 rounded-xl shadow-2xl border border-sw-breeze/10 glow-accent p-6 mb-6">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-sw-charcoal-800 rounded-lg flex items-center justify-center border border-sw-pink/30">
                  <Settings
                    className="text-sw-pink"
                    size={24}
                  />
                </div>
              </div>

              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Describe Your IVR Menu
                  </label>
                  {selectedResource && (
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-gray-500 dark:text-gray-400">Updating:</span>
                      <span className="font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                        {selectedResource.display_name}
                      </span>
                    </div>
                  )}
                  {!selectedResource && (
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                        Creating new resource
                      </span>
                    </div>
                  )}
                </div>

                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  disabled={isCallActive}
                  className="w-full h-32 px-4 py-3 border-2 border-sw-breeze/20 rounded-lg
                           bg-sw-charcoal-900 text-white
                           focus:border-sw-pink focus:ring-2 focus:ring-sw-pink/30
                           disabled:opacity-50 disabled:cursor-not-allowed
                           resize-none font-mono text-sm leading-relaxed"
                  placeholder="Describe your phone menu in plain English..."
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Quick examples:
                  </span>
                  {EXAMPLE_PROMPTS.map((example, idx) => (
                    <button
                      key={idx}
                      onClick={() => setPrompt(example)}
                      disabled={isCallActive}
                      className="text-xs px-3 py-1 bg-sw-charcoal-800 hover:bg-sw-charcoal-700 border border-sw-breeze/20
                               text-gray-300 rounded-full transition-all duration-150 hover:border-sw-pink/40
                               disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Example {idx + 1}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-shrink-0">
                <button
                  onClick={handleGenerateAndCall}
                  disabled={isGenerating || isCallActive || !prompt.trim()}
                  className="h-12 px-6 bg-gradient-to-r from-sw-blue to-sw-pink hover:from-sw-deepSea hover:to-sw-pink-light dark:from-sw-pink dark:to-sw-breeze dark:hover:from-sw-pink-light dark:hover:to-sw-breeze
                           text-white font-semibold rounded-lg shadow-lg
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all duration-150 hover:shadow-xl hover:scale-105 active:scale-95
                           flex items-center space-x-2"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Zap size={18} />
                      <span>{selectedResource ? 'Update Agent' : 'Create Agent'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Video Display Section */}
        {isLoggedIn && (
          <div className="bg-sw-charcoal-700 rounded-xl shadow-2xl border border-sw-breeze/10 glow-accent overflow-hidden mb-6">
            <div className="bg-gradient-to-r from-sw-blue to-sw-pink dark:from-sw-pink dark:to-sw-breeze px-4 py-3">
              <div className="flex items-center space-x-2">
                <User className="text-white" size={18} />
                <h3 className="text-sm font-semibold text-white">AI Agent Video</h3>
                {isCallActive && (
                  <div className="ml-auto flex items-center space-x-1">
                    <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                    <span className="text-xs text-white font-medium">LIVE</span>
                  </div>
                )}
              </div>
            </div>
            <div className="p-4 bg-sw-charcoal-900">
              {/* Video container - SignalWire SDK will automatically create and attach video elements here */}
              <div
                id="video-container"
                ref={videoElementRef}
                className="relative w-full aspect-video bg-sw-charcoal-900 rounded-lg overflow-hidden border border-sw-breeze/10"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {!isCallActive && (
                  <div className="absolute inset-0 flex items-center justify-center text-center text-gray-500 dark:text-gray-400 z-10">
                    <div>
                      <User className="mx-auto mb-2" size={48} />
                      <p className="text-sm">Video will appear when call is connected</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Split Panel View */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel: Transcript & Events */}
          <div className="space-y-6">
            <TranscriptPanel transcript={transcript} isActive={isCallActive} />

            {/* System Events Panel */}
            <div className="bg-sw-charcoal-700 rounded-xl shadow-2xl border border-sw-breeze/10 glow-accent overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 dark:from-emerald-700 dark:to-teal-700 px-4 py-3">
                <div className="flex items-center space-x-2">
                  <Zap className="text-white" size={18} />
                  <h3 className="text-sm font-semibold text-white">
                    System Events
                  </h3>
                </div>
              </div>

              <div className="p-4 max-h-64 overflow-y-auto">
                {events.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 dark:text-gray-500 text-sm">
                    No events yet. Generate an agent to begin.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {events.map((event, idx) => (
                      <div
                        key={idx}
                        className={`flex items-start space-x-2 p-2 rounded-lg text-xs ${
                          event.type === "error"
                            ? "bg-red-900/30 text-red-300 border border-red-500/30"
                            : event.type === "call"
                              ? "bg-sw-blue/20 text-sw-breeze border border-sw-blue/30"
                              : event.type === "agent"
                                ? "bg-sw-pink/20 text-pink-200 border border-sw-pink/30"
                                : "bg-sw-charcoal-800 text-gray-300 border border-sw-breeze/10"
                        }`}
                      >
                        <span className="font-mono opacity-50">
                          {new Date(event.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="font-medium">{event.message}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Agent Events Panel */}
            {agentEvents.length > 0 && (
              <div className="bg-sw-charcoal-700 rounded-xl shadow-2xl border border-sw-breeze/10 glow-accent overflow-hidden">
                <div className="bg-gradient-to-r from-sw-blue to-sw-pink dark:from-sw-pink dark:to-sw-breeze px-4 py-3">
                  <div className="flex items-center space-x-2">
                    <MessageSquare className="text-white" size={18} />
                    <h3 className="text-sm font-semibold text-white">
                      Real-Time Agent Events
                    </h3>
                    <div className="bg-white/20 px-2 py-0.5 rounded-full">
                      <span className="text-xs font-medium text-white">
                        {agentEvents.length}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-4 max-h-64 overflow-y-auto">
                  <div className="space-y-3">
                    {agentEvents.slice(-10).map((event, idx) => (
                      <div key={idx} className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3">
                        <div className="flex items-start justify-between mb-1">
                          <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                            {event.type}
                          </span>
                          <span className="text-xs text-purple-500 dark:text-purple-400 font-mono">
                            {new Date(event.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        {event.status && (
                          <div className="text-xs text-purple-600 dark:text-purple-400 mb-1">
                            Status: {event.status}
                          </div>
                        )}
                        {event.department && (
                          <div className="text-xs text-purple-600 dark:text-purple-400 mb-1">
                            Department: {event.department}
                          </div>
                        )}
                        {event.item && (
                          <div className="text-xs text-purple-600 dark:text-purple-400">
                            Item: {event.item.name} (${event.item.price})
                          </div>
                        )}
                        {event.message && (
                          <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {event.message}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Generated Code */}
          <div>
            <CodeViewer code={generatedCode} isGenerating={isGenerating} />
          </div>
        </div>
      </div>
    </div>
  );
}
