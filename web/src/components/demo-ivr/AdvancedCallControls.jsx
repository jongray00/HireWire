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
import * as SignalWireModule from "@signalwire/js";

export default function AdvancedCallControls({
  isCallActive,
  onCallStart,
  onCallEnd,
  onTranscriptUpdate,
  onEventUpdate,
  onAgentEvent,
  subscriberData,
  credentials,
  agentAddress, // The SignalWire address to dial (e.g., /subscriber_123/sally-agent)
  videoElementRef, // Ref to video container element for video rendering
  externalCallTrigger, // External trigger for initiating calls from resource list
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
  const [clientReady, setClientReady] = useState(false);
  
  // Statistics
  const [callDuration, setCallDuration] = useState(0);
  const [bytesReceived, setBytesReceived] = useState(0);
  const [eventsReceived, setEventsReceived] = useState(0);
  
  const callStartTime = useRef(null);
  const durationInterval = useRef(null);
  const statsInterval = useRef(null);
  const listenersAdded = useRef(false); // Track if event listeners have been added

  // Fetch WebRTC token from backend
  const fetchWebRTCToken = async () => {
    try {
      if (!subscriberData?.subscriberId || !credentials) {
        throw new Error('Missing subscriber data or credentials');
      }

      onEventUpdate("system", "Generating WebRTC token...");

      const response = await fetch('/api/signalwire/webrtc-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriberId: subscriberData.subscriberId,
          credentials: credentials
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate WebRTC token');
      }

      const data = await response.json();

      if (!data.token) {
        throw new Error('No token received from server');
      }

      onEventUpdate("system", "WebRTC token generated successfully");
      return data.token;

    } catch (error) {
      console.error('Failed to fetch WebRTC token:', error);
      onEventUpdate("error", `Token generation failed: ${error.message}`);
      throw error;
    }
  };

  // Fetch agent credentials and set SWML URL
  useEffect(() => {
    const fetchCredentials = async () => {
      try {
        const response = await fetch('/api/credentials');
        const data = await response.json();

        if (data.success && data.swml_url) {
          setAgentUrl(data.swml_url);
          onEventUpdate("system", `Agent SWML URL loaded: ${data.swml_url.substring(0, 50)}...`);
        }
      } catch (error) {
        console.error('Failed to fetch agent credentials:', error);
        onEventUpdate("error", "Failed to load agent credentials");
      }
    };

    fetchCredentials();
  }, []);

  // Initialize SignalWire client when subscriber data becomes available
  useEffect(() => {
    const initializeClient = async () => {
      if (!subscriberData?.subscriberId || !credentials) {
        console.log('Waiting for subscriber data and credentials...');
        return;
      }

      // Only initialize once
      if (client || clientReady) {
        console.log('Client already initialized, skipping');
        return;
      }

      try {
        onEventUpdate("system", "Initializing SignalWire client...");

        // Fetch dynamic WebRTC token
        const token = await fetchWebRTCToken();

        // Initialize client with dynamic token
        await initializeSignalWireClient(token);

      } catch (error) {
        console.error('Failed to initialize client:', error);
        setCallState('failed');
        setClientReady(false);
      }
    };

    initializeClient();
  }, [subscriberData, credentials]); // Re-run when subscriber data or credentials change

  // Handle external call triggers from resource list
  useEffect(() => {
    if (!externalCallTrigger) return;
    if (!client || !clientReady) {
      onEventUpdate("error", "Client not ready for calls yet");
      return;
    }
    if (callState === 'connected' || callState === 'connecting') {
      onEventUpdate("error", "Already in a call");
      return;
    }

    console.log('External call trigger received:', externalCallTrigger);

    // Start call with specified type
    const { resource, type } = externalCallTrigger;
    startCallWithResource(resource, type);

  }, [externalCallTrigger]);

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

  const initializeSignalWireClient = async (token) => {
    try {
      // Extract SignalWire from the module (handles CommonJS/ESM interop)
      const SignalWire = SignalWireModule.SignalWire || SignalWireModule.default || SignalWireModule;

      // Set up global handler for unhandled promise rejections from deviceWatcher
      const handleRejection = (event) => {
        if (event.reason?.message?.includes('createDeviceWatcher') ||
            event.reason?.message?.includes('getUserMedia')) {
          event.preventDefault(); // Suppress the error
          console.log('Suppressed deviceWatcher permission warning (expected behavior)');
        }
      };
      window.addEventListener('unhandledrejection', handleRejection);

      // Suppress device watcher errors by setting up error handler
      const originalError = console.error;
      console.error = (...args) => {
        // Filter out device watcher permission errors
        if (args[0]?.toString().includes('createDeviceWatcher') ||
            args[0]?.toString().includes('getUserMedia')) {
          return; // Suppress these warnings
        }
        originalError(...args);
      };

      // Initialize SignalWire client using the npm package (holy-guacamole pattern)
      const swClient = await SignalWire({
        token: token,
        logLevel: 'debug' // Match holy-guacamole for better debugging
      });

      // Restore original console.error and remove rejection handler
      console.error = originalError;
      window.removeEventListener('unhandledrejection', handleRejection);

      // Global event handlers for real-time communication (holy-guacamole pattern)
      swClient.on('user_event', handleUserEvent);

      // AI transcript events - Send each piece immediately for real-time feedback
      // Parent component handles accumulation by appending to existing bubble
      // Only add listeners once to prevent duplicates
      if (!listenersAdded.current) {
        console.log('Adding AI transcript event listeners...');

        swClient.on('ai.response_utterance', (params) => {
          // AI speaking - send only the new utterance piece
          const utterance = params?.utterance || '';
          if (utterance) {
            // Send just this piece - parent will append to existing bubble
            onTranscriptUpdate('ai', utterance);
            console.log('AI utterance piece sent:', utterance);
          }
        });

        swClient.on('ai.completion', (params) => {
          // AI response complete - turn ended
          console.log('AI completion - turn ended');
        });

        swClient.on('ai.partial_result', (params) => {
          // User speaking - send partial results immediately for real-time updates
          const text = params?.text || '';
          if (text) {
            // Send to UI immediately - parent will replace existing bubble text
            onTranscriptUpdate('user', text);
            console.log('User partial speech sent (real-time):', text);
          }
        });

        swClient.on('ai.speech_detect', (params) => {
          // User speaking - final transcript
          const cleanText = params?.text?.replace(/\{confidence=[\d.]+\}/g, '') || '';
          if (cleanText) {
            console.log('User speech final:', cleanText);
            // Send final text - parent will replace existing bubble one last time
            onTranscriptUpdate('user', cleanText);
          }
        });

        listenersAdded.current = true;
        console.log('AI transcript event listeners added successfully');
      } else {
        console.log('Skipping duplicate listener registration');
      }

      setClient(swClient);
      setClientReady(true); // Signal that client is ready for calls
      setCallState('ready');
      onEventUpdate("system", "SignalWire Fabric client initialized - ready to call");
      console.log("SignalWire Fabric SDK initialized successfully with dynamic token");

    } catch (error) {
      console.error("Failed to initialize SignalWire client:", error);
      setCallState('failed');
      setClientReady(false);
      onEventUpdate("error", `Client initialization failed: ${error.message}`);
    }
  };

  const startCallWithResource = async (resource, callType) => {
    if (!client) {
      onEventUpdate("error", "SignalWire client not ready");
      return;
    }

    if (!resource) {
      onEventUpdate("error", "No resource specified");
      return;
    }

    try {
      setIsConnecting(true);
      setCallState('connecting');

      const isVideoCall = callType === 'video';
      onEventUpdate("call", `Requesting ${isVideoCall ? 'camera and ' : ''}microphone permission...`);

      // Request media permissions before call
      try {
        const mediaConstraints = isVideoCall
          ? { audio: true, video: true }
          : { audio: true };
        const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        // Stop the stream immediately - we just needed permission
        stream.getTracks().forEach(track => track.stop());
        onEventUpdate("call", "Media permission granted");
      } catch (permError) {
        console.error("Media permission denied:", permError);
        onEventUpdate("error", `${isVideoCall ? 'Camera and microphone' : 'Microphone'} permission required for calls`);
        setIsConnecting(false);
        setCallState('failed');
        return;
      }

      onEventUpdate("call", `Initiating ${callType} call to ${resource.display_name}...`);

      // Generate session ID
      const sessionId = generateSessionId();

      // Determine dial address based on resource type
      let dialAddress;
      if (resource.type === 'swml_webhook' || resource.type === 'swml_script') {
        // For SWML resources, use public alias or resource name
        dialAddress = '/public/sally-sales';
      } else if (resource.type === 'subscriber') {
        dialAddress = `/private/${resource.display_name}`;
      } else {
        // For other resources, try using display name
        dialAddress = `/public/${resource.display_name}`;
      }

      console.log(`Dialing ${callType} call to:`, dialAddress);

      // Get video container
      const videoContainer = document.getElementById('video-container') || videoElementRef?.current;

      if (!videoContainer) {
        console.warn('Video container not found - video may not display');
      } else {
        console.log('Video container found:', videoContainer);
      }

      // Dial with appropriate configuration
      const session = await client.dial({
        to: dialAddress,
        audio: true,
        video: isVideoCall,
        negotiateVideo: isVideoCall,
        rootElement: isVideoCall ? videoContainer : undefined,

        // Rich context for agent
        userVariables: {
          interface: 'advanced-web-ui',
          sessionId: sessionId,
          timestamp: new Date().toISOString(),
          resourceId: resource.id,
          resourceName: resource.display_name,
          resourceType: resource.type,
          callType: callType,
          platform: 'browser',
          userAgent: navigator.userAgent,
          capabilities: ['real-time-events', 'transcript', 'call-controls', isVideoCall ? 'video' : 'audio-only']
        }
      });

      await session.start();
      setRoomSession(session);
      setCallState('connected');
      setIsConnecting(false);
      callStartTime.current = Date.now();

      // Set up session event handlers
      setupSessionEvents(session);

      // Debug local stream info
      if (session.localStream) {
        console.log('Local stream available:', session.localStream);
        const videoTracks = session.localStream.getVideoTracks();
        const audioTracks = session.localStream.getAudioTracks();
        console.log(`Local stream: ${videoTracks.length} video tracks, ${audioTracks.length} audio tracks`);
      } else {
        console.warn('No local stream available on session');
      }

      // Check video elements after a short delay (for video calls)
      if (isVideoCall) {
        setTimeout(() => {
          const container = document.getElementById('video-container') || videoElementRef?.current;
          if (container) {
            const videos = container.querySelectorAll('video');
            console.log(`Video elements in container: ${videos.length}`);
            videos.forEach((video, index) => {
              console.log(`Video ${index}:`, video, 'Has stream:', !!video.srcObject);
              if (video.srcObject) {
                const tracks = video.srcObject.getTracks();
                console.log(`  - Tracks: ${tracks.length}`, tracks.map(t => `${t.kind}:${t.enabled}`));
              }
            });
          } else {
            console.error('Video container not found in DOM');
          }
        }, 1000);
      }

      // Notify parent components
      onCallStart();
      onEventUpdate("call", `${callType} call connected successfully to ${resource.display_name}`);
      onTranscriptUpdate("system", `Connected to ${resource.display_name}...`);

      // Start monitoring connection quality
      startStatsMonitoring(session);

    } catch (error) {
      console.error("Call failed:", error);
      setCallState('failed');
      setIsConnecting(false);
      onEventUpdate("error", `Call failed: ${error.message}`);
    }
  };

  const startCall = async () => {
    if (!client) {
      onEventUpdate("error", "SignalWire client not ready");
      return;
    }

    if (!agentAddress) {
      onEventUpdate("error", "Agent address not configured. Please generate agent first.");
      return;
    }

    try {
      setIsConnecting(true);
      setCallState('connecting');
      onEventUpdate("call", "Requesting microphone permission...");

      // Request microphone permission before call to ensure audio works
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Stop the stream immediately - we just needed permission
        stream.getTracks().forEach(track => track.stop());
        onEventUpdate("call", "Microphone permission granted");
      } catch (permError) {
        console.error("Microphone permission denied:", permError);
        onEventUpdate("error", "Microphone permission required for calls");
        setIsConnecting(false);
        setCallState('failed');
        return;
      }

      onEventUpdate("call", "Initiating call...");

      // Generate session ID and context
      const sessionId = generateSessionId();

      console.log('Dialing SignalWire public alias: /public/sally-sales');

      // Get video container - use getElementById as primary method (like holy-guacamole)
      const videoContainer = document.getElementById('video-container') || videoElementRef?.current;

      if (!videoContainer) {
        console.warn('Video container not found - video may not display');
      } else {
        console.log('Video container found:', videoContainer);
      }

      // Dial with comprehensive configuration
      const session = await client.dial({
        to: '/public/sally-sales', // Static public alias for all users
        audio: true,
        video: true,  // Enable video for agent avatar
        negotiateVideo: true,  // Allow video negotiation
        rootElement: videoContainer,  // Attach video to container

        // Rich context for agent
        userVariables: {
          interface: 'advanced-web-ui',
          sessionId: sessionId,
          timestamp: new Date().toISOString(),
          demoMode: true,
          platform: 'browser',
          userAgent: navigator.userAgent,
          capabilities: ['real-time-events', 'transcript', 'call-controls', 'video']
        }
      });

      await session.start();
      setRoomSession(session);
      setCallState('connected');
      setIsConnecting(false);
      callStartTime.current = Date.now();

      // Set up session event handlers
      setupSessionEvents(session);

      // Debug local stream info
      if (session.localStream) {
        console.log('Local stream available:', session.localStream);
        const videoTracks = session.localStream.getVideoTracks();
        const audioTracks = session.localStream.getAudioTracks();
        console.log(`Local stream: ${videoTracks.length} video tracks, ${audioTracks.length} audio tracks`);
      } else {
        console.warn('No local stream available on session');
      }

      // Check video elements after a short delay
      setTimeout(() => {
        const container = document.getElementById('video-container') || videoElementRef?.current;
        if (container) {
          const videos = container.querySelectorAll('video');
          console.log(`Video elements in container: ${videos.length}`);
          videos.forEach((video, index) => {
            console.log(`Video ${index}:`, video, 'Has stream:', !!video.srcObject);
            if (video.srcObject) {
              const tracks = video.srcObject.getTracks();
              console.log(`  - Tracks: ${tracks.length}`, tracks.map(t => `${t.kind}:${t.enabled}`));
            }
          });
        } else {
          console.error('Video container not found in DOM');
        }
      }, 1000);

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

  const toggleMute = () => {
    if (!roomSession) {
      console.log("Cannot toggle mute: No active call");
      return;
    }

    // Toggle mute state first
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    // For Call objects (Fabric SDK), we need to manipulate local stream tracks directly
    try {
      if (roomSession.localStream) {
        const audioTracks = roomSession.localStream.getAudioTracks();
        console.log(`${newMutedState ? 'Muting' : 'Unmuting'} ${audioTracks.length} audio tracks`);
        audioTracks.forEach(track => {
          track.enabled = !newMutedState;
        });
        onEventUpdate("call", newMutedState ? "Microphone muted" : "Microphone unmuted");
      } else if (roomSession.peer && roomSession.peer.localStream) {
        // Try alternate method for peer connection
        const audioTracks = roomSession.peer.localStream.getAudioTracks();
        console.log(`${newMutedState ? 'Muting' : 'Unmuting'} ${audioTracks.length} audio tracks (via peer)`);
        audioTracks.forEach(track => {
          track.enabled = !newMutedState;
        });
        onEventUpdate("call", newMutedState ? "Microphone muted" : "Microphone unmuted");
      } else {
        console.warn('Unable to find local stream to mute/unmute');
        onEventUpdate("error", "Could not access microphone stream");
      }
    } catch (error) {
      console.error("Error toggling mute:", error);
      onEventUpdate("error", `Mute toggle failed: ${error.message}`);
    }
  };

  const updateVolume = async (newVolume) => {
    if (!roomSession) {
      console.log("Cannot update volume: No active call");
      // Still update local state for UI responsiveness
      setVolume(newVolume);
      return;
    }

    try {
      await roomSession.setOutputVolume({ volume: newVolume });
      setVolume(newVolume);
      onEventUpdate("call", `Volume set to ${newVolume}%`);
    } catch (error) {
      // Silently handle capability errors (call not fully connected yet)
      if (error.message?.includes('Missing setOutputVolume capability')) {
        console.log("Volume capability not available yet");
        // Still update local state for UI responsiveness
        setVolume(newVolume);
      } else {
        console.error("Error updating volume:", error);
      }
    }
  };

  const setupSessionEvents = (session) => {
    // Call joined event
    session.on('call.joined', (params) => {
      console.log('Call joined event:', params);
      onEventUpdate("call", "Joined call successfully");
    });

    // Stream events for debugging
    session.on('stream.started', (params) => {
      console.log('Stream started:', params);
      onEventUpdate("system", "Media stream started");
    });

    session.on('stream.ended', (params) => {
      console.log('Stream ended:', params);
      onEventUpdate("system", "Media stream ended");
    });

    // Call state management
    session.on('call.state', (params) => {
      const state = params?.payload?.call_state || params?.call_state;
      console.log('Call state changed:', state);
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

    // Transcript/Caption events - SignalWire's built-in transcript support
    session.on('call.caption', (event) => {
      const caption = event?.caption || event?.text;
      const speaker = event?.speaker || 'agent';
      if (caption) {
        onTranscriptUpdate(speaker, caption);
        onEventUpdate("transcript", `Caption: ${caption.substring(0, 50)}...`);
      }
    });

    session.on('room.updated', (event) => {
      // Check if this update contains caption/transcript data
      if (event?.captions || event?.transcript) {
        const text = event.captions || event.transcript;
        onTranscriptUpdate('agent', text);
      }
    });

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
              ) : clientReady ? (
                <>
                  <CheckCircle className="text-white" size={14} />
                  <span className="text-sm font-medium text-white">Ready</span>
                </>
              ) : (
                <>
                  <Loader className="text-white animate-spin" size={14} />
                  <span className="text-sm font-medium text-white">
                    Initializing...
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
        {clientReady && (
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

        {/* Technical Details */}
        {clientReady && (
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