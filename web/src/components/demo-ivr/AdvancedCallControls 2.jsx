"use client";

import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Settings,
  Wifi,
  WifiOff,
  CheckCircle,
  AlertCircle,
  Copy,
  ExternalLink,
  Loader,
  Activity,
  Signal,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function AdvancedCallControls({
  isCallActive,
  onCallStart,
  onCallEnd,
  onTranscriptUpdate,
  onEventUpdate,
  onAgentEvent,
  subscriberData,
  credentials,
}) {
  // SignalWire client and session state
  const [client, setClient] = useState(null);
  const [roomSession, setRoomSession] = useState(null);
  const [callState, setCallState] = useState('idle'); // idle, connecting, connected, failed
  const [connectionQuality, setConnectionQuality] = useState('excellent');
  
  // Call controls
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(50);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Agent configuration
  const [agentUrl, setAgentUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [webRtcToken, setWebRtcToken] = useState(null);
  const [isLoadingToken, setIsLoadingToken] = useState(false);
  
  // Statistics
  const [callDuration, setCallDuration] = useState(0);
  const [bytesReceived, setBytesReceived] = useState(0);
  const [eventsReceived, setEventsReceived] = useState(0);
  
  const callStartTime = useRef(null);
  const durationInterval = useRef(null);
  const statsInterval = useRef(null);

  // Load SignalWire Fabric SDK
  useEffect(() => {
    if (typeof window !== "undefined" && !window.SignalWire) {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/@signalwire/js@1/dist/signalwire.js";
      script.async = true;
      script.onload = () => {
        console.log("SignalWire Fabric SDK loaded");
        onEventUpdate("system", "SignalWire SDK loaded");
      };
      document.head.appendChild(script);
    }
  }, []);

  // Set up agent URL and get WebRTC token
  useEffect(() => {
    if (subscriberData?.subscriberId) {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const url = `${origin}/api/signalwire/agent/${subscriberData.subscriberId}`;
      setAgentUrl(url);
      onEventUpdate("system", "Agent webhook ready");
      
      // Get WebRTC token
      fetchWebRtcToken();
    }
  }, [subscriberData]);

  // Call duration timer
  useEffect(() => {
    if (callState === 'connected' && callStartTime.current) {
      durationInterval.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - callStartTime.current) / 1000);
        setCallDuration(elapsed);
      }, 1000);
    } else {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
      setCallDuration(0);
    }

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, [callState]);

  const fetchWebRtcToken = async () => {
    setIsLoadingToken(true);
    try {
      const response = await fetch("/api/signalwire/webrtc-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          credentials,
          subscriberId: subscriberData?.subscriberId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get WebRTC token");
      }

      const data = await response.json();
      setWebRtcToken(data.token);
      onEventUpdate("system", "WebRTC token acquired");
      
      // Initialize SignalWire client
      await initializeSignalWireClient(data.token);
      
    } catch (error) {
      console.error("Error fetching WebRTC token:", error);
      onEventUpdate("error", `Failed to get WebRTC token: ${error.message}`);
    } finally {
      setIsLoadingToken(false);
    }
  };

  const initializeSignalWireClient = async (token) => {
    try {
      if (!window.SignalWire) {
        throw new Error("SignalWire SDK not loaded");
      }

      const swClient = await window.SignalWire({
        token: token,
        logLevel: 'info'
      });

      // Global event handlers for real-time communication
      swClient.on('user_event', handleUserEvent);
      
      setClient(swClient);
      setCallState('ready');
      onEventUpdate("system", "SignalWire client ready");
      
    } catch (error) {
      console.error("Failed to initialize SignalWire client:", error);
      setCallState('failed');
      onEventUpdate("error", `Client initialization failed: ${error.message}`);
    }
  };

  const startCall = async () => {
    if (!client) {
      onEventUpdate("error", "SignalWire client not ready");
      return;
    }

    try {
      setIsConnecting(true);
      setCallState('connecting');
      onEventUpdate("call", "Initiating call...");

      // Generate session ID and context
      const sessionId = generateSessionId();
      const agentEndpoint = `/private/${subscriberData.subscriberId}`;

      // Dial with comprehensive configuration
      const session = await client.dial({
        to: agentEndpoint,
        audio: true,
        video: false,
        negotiateVideo: false,
        
        // Rich context for agent
        userVariables: {
          interface: 'advanced-web-ui',
          sessionId: sessionId,
          timestamp: new Date().toISOString(),
          demoMode: true,
          platform: 'browser',
          userAgent: navigator.userAgent,
          capabilities: ['real-time-events', 'transcript', 'call-controls']
        }
      });

      await session.start();
      setRoomSession(session);
      setCallState('connected');
      setIsConnecting(false);
      callStartTime.current = Date.now();
      
      // Set up session event handlers
      setupSessionEvents(session);
      
      // Notify parent components
      onCallStart();
      onEventUpdate("call", "Call connected successfully");
      onTranscriptUpdate("system", "Connected to AI agent...");
      
      // Start monitoring connection quality
      startStatsMonitoring(session);
      
    } catch (error) {
      console.error("Call failed:", error);
      setCallState('failed');
      setIsConnecting(false);
      onEventUpdate("error", `Call failed: ${error.message}`);
    }
  };

  const endCall = async () => {
    if (roomSession) {
      try {
        await roomSession.hangup();
        setRoomSession(null);
        setCallState('ready');
        callStartTime.current = null;
        
        // Stop monitoring
        if (statsInterval.current) {
          clearInterval(statsInterval.current);
        }
        
        onCallEnd();
        onEventUpdate("call", "Call ended");
        onTranscriptUpdate("system", "Call disconnected");
        
      } catch (error) {
        console.error("Error ending call:", error);
        onEventUpdate("error", `Error ending call: ${error.message}`);
      }
    }
  };

  const toggleMute = async () => {
    if (roomSession) {
      try {
        if (isMuted) {
          await roomSession.audioUnmute();
          onEventUpdate("call", "Microphone unmuted");
        } else {
          await roomSession.audioMute();
          onEventUpdate("call", "Microphone muted");
        }
        setIsMuted(!isMuted);
      } catch (error) {
        console.error("Error toggling mute:", error);
        onEventUpdate("error", `Mute toggle failed: ${error.message}`);
      }
    }
  };

  const updateVolume = async (newVolume) => {
    if (roomSession) {
      try {
        await roomSession.setOutputVolume({ volume: newVolume });
        setVolume(newVolume);
        onEventUpdate("call", `Volume set to ${newVolume}%`);
      } catch (error) {
        console.error("Error updating volume:", error);
      }
    }
  };

  const setupSessionEvents = (session) => {
    // Call state management
    session.on('call.state', (params) => {
      const state = params?.payload?.call_state || params?.call_state;
      if (state === 'ending' || state === 'ended') {
        setCallState('disconnected');
        onCallEnd();
        onEventUpdate("call", "Call ended by remote");
      }
    });

    // Connection quality monitoring
    session.on('call.connect', () => {
      setConnectionQuality('excellent');
      onEventUpdate("call", "Connection established");
    });

    // Real-time agent events (Holy Guacamole style!)
    session.on('user_event', handleSessionEvent);

    // Device events
    session.on('microphone.updated', (event) => {
      onEventUpdate("system", `Microphone: ${event.device.label}`);
    });

    // Error handling
    session.on('call.failed', (error) => {
      setCallState('failed');
      onEventUpdate("error", `Call failed: ${error.message}`);
    });

    // Disconnect events
    session.on('destroy', handleDisconnect);
    session.on('disconnected', handleDisconnect);
    session.on('room.left', handleDisconnect);
  };

  const handleUserEvent = (params) => {
    const eventData = params?.event || params;
    setEventsReceived(prev => prev + 1);
    
    // Handle transcript updates
    if (eventData.type === 'transcript') {
      onTranscriptUpdate(eventData.speaker, eventData.text);
      return;
    }
    
    // Forward all agent events to parent
    if (onAgentEvent) {
      onAgentEvent(eventData);
    }
    
    // Log interesting events
    onEventUpdate("agent", `Agent event: ${eventData.type}`);
  };

  const handleSessionEvent = (params) => {
    handleUserEvent(params);
  };

  const handleDisconnect = () => {
    setCallState('disconnected');
    setRoomSession(null);
    callStartTime.current = null;
    if (statsInterval.current) {
      clearInterval(statsInterval.current);
    }
    onCallEnd();
    onEventUpdate("call", "Connection lost");
  };

  const startStatsMonitoring = (session) => {
    statsInterval.current = setInterval(async () => {
      try {
        // Simulated stats - in real implementation, you'd get actual WebRTC stats
        setBytesReceived(prev => prev + Math.random() * 1000);
        
        // Monitor connection quality
        const quality = Math.random() > 0.1 ? 'excellent' : 'poor';
        setConnectionQuality(quality);
        
      } catch (error) {
        console.error("Error getting call stats:", error);
      }
    }, 2000);
  };

  const handleCopyUrl = async () => {
    if (agentUrl) {
      await navigator.clipboard.writeText(agentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatBytes = (bytes) => {
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const getConnectionIcon = () => {
    switch (connectionQuality) {
      case 'excellent': return <Signal className="text-green-500" size={16} />;
      case 'good': return <Signal className="text-yellow-500" size={16} />;
      case 'poor': return <WifiOff className="text-red-500" size={16} />;
      default: return <Wifi className="text-gray-500" size={16} />;
    }
  };

  const getStateColor = () => {
    switch (callState) {
      case 'connected': return 'text-green-600 dark:text-green-400';
      case 'connecting': return 'text-yellow-600 dark:text-yellow-400';
      case 'failed': return 'text-red-600 dark:text-red-400';
      default: return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Phone className="text-white" size={20} />
            <h3 className="text-lg font-semibold text-white">
              Advanced Call Interface
            </h3>
          </div>

          <div className="flex items-center space-x-4">
            {/* Connection Quality */}
            <div className="flex items-center space-x-2 bg-white/20 px-3 py-1 rounded-full">
              {getConnectionIcon()}
              <span className="text-sm font-medium text-white capitalize">
                {connectionQuality}
              </span>
            </div>

            {/* Call Status */}
            <div className="flex items-center space-x-2 bg-white/20 px-3 py-1 rounded-full">
              {callState === 'connected' ? (
                <>
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium text-white">
                    Live: {formatDuration(callDuration)}
                  </span>
                </>
              ) : callState === 'connecting' ? (
                <>
                  <Loader className="text-white animate-spin" size={14} />
                  <span className="text-sm font-medium text-white">
                    Connecting...
                  </span>
                </>
              ) : webRtcToken ? (
                <>
                  <CheckCircle className="text-white" size={14} />
                  <span className="text-sm font-medium text-white">Ready</span>
                </>
              ) : (
                <>
                  <Loader className="text-white animate-spin" size={14} />
                  <span className="text-sm font-medium text-white">
                    Setup...
                  </span>
                </>
              )}
            </div>
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

        {/* Call Controls */}
        {webRtcToken && (
          <div className="mb-6">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Advanced Call Controls
            </h4>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 
                            border-2 border-green-200 dark:border-green-800 rounded-lg p-6">
              
              {callState === 'idle' || callState === 'ready' || callState === 'disconnected' ? (
                <div className="text-center">
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">
                    Click below to call your AI agent using WebRTC
                  </p>
                  <button
                    onClick={startCall}
                    disabled={!client || isConnecting}
                    className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 
                             hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-lg shadow-lg
                             transition-all duration-200 hover:shadow-xl hover:scale-105 active:scale-95
                             flex items-center space-x-3 mx-auto
                             disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    <Phone size={24} />
                    <span className="text-lg">
                      {isConnecting ? 'Connecting...' : 'Call AI Agent'}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Active Call Controls */}
                  <div className="flex items-center justify-center space-x-4">
                    <button
                      onClick={toggleMute}
                      className={`p-3 rounded-lg transition-colors ${
                        isMuted 
                          ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' 
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                      title={isMuted ? 'Unmute' : 'Mute'}
                    >
                      {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>

                    <div className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-4 py-2">
                      <VolumeX size={16} className="text-gray-500" />
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={volume}
                        onChange={(e) => updateVolume(parseInt(e.target.value))}
                        className="w-24"
                      />
                      <Volume2 size={16} className="text-gray-500" />
                      <span className="text-xs text-gray-600 dark:text-gray-400 w-8">
                        {volume}%
                      </span>
                    </div>

                    <button
                      onClick={endCall}
                      className="p-3 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 
                               text-red-600 dark:text-red-400 rounded-lg transition-colors"
                      title="End Call"
                    >
                      <PhoneOff size={20} />
                    </button>
                  </div>

                  {/* Call Statistics */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-green-200 dark:border-green-800">
                    <div className="text-center">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Duration</div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatDuration(callDuration)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Data</div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatBytes(bytesReceived)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500 dark:text-gray-400">Events</div>
                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                        {eventsReceived}
                      </div>
                    </div>
                  </div>
                </div>
              )}
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
                Setting up WebRTC connection...
              </p>
            </div>
          </div>
        )}

        {/* Technical Details */}
        {webRtcToken && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-4 gap-4 text-center">
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
                  Quality
                </p>
                <p className={`text-sm font-semibold capitalize ${getStateColor()}`}>
                  {connectionQuality}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Status
                </p>
                <p className={`text-sm font-semibold capitalize ${getStateColor()}`}>
                  {callState}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}