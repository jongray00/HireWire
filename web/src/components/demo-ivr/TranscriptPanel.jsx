'use client';

import { MessageSquare, User, Bot } from 'lucide-react';
import { useEffect, useRef } from 'react';

export default function TranscriptPanel({ transcript, isActive }) {
  const scrollRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  return (
    <div className="bg-sw-charcoal-700 rounded-xl shadow-2xl border border-sw-breeze/10 glow-accent overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-sw-blue to-sw-pink dark:from-sw-pink dark:to-sw-breeze px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MessageSquare className="text-white" size={18} />
            <h3 className="text-sm font-semibold text-white">
              Live Transcript
            </h3>
          </div>
          {isActive && (
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-xs text-white/90 font-medium">Recording</span>
            </div>
          )}
        </div>
      </div>

      {/* Transcript Messages */}
      <div
        ref={scrollRef}
        className="h-[500px] overflow-y-auto p-4 space-y-3 bg-sw-charcoal-800"
      >
        {transcript.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
            <MessageSquare size={48} className="mb-3 opacity-20" />
            <p className="text-sm font-medium">No conversation yet</p>
            <p className="text-xs mt-1">Generate an agent and start a call to see the transcript</p>
          </div>
        ) : (
          transcript.map((message, idx) => {
            const isAI = message.speaker === 'ai' || message.speaker === 'bot';
            const isUser = message.speaker === 'user' || message.speaker === 'customer';
            const isSystem = message.speaker === 'system';

            if (isSystem) {
              return (
                <div key={idx} className="flex justify-center">
                  <div className="bg-sw-charcoal-700 px-4 py-2 rounded-full border border-sw-breeze/20">
                    <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                      {message.text}
                    </p>
                  </div>
                </div>
              );
            }

            return (
              <div 
                key={idx} 
                className={`flex ${isUser ? 'justify-end' : 'justify-start'} items-start space-x-2`}
              >
                {isAI && (
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-sw-pink to-sw-breeze rounded-full flex items-center justify-center">
                    <Bot size={16} className="text-white" />
                  </div>
                )}

                <div
                  className={`max-w-[75%] ${
                    isUser
                      ? 'bg-sw-pink dark:bg-sw-pink text-white'
                      : 'bg-sw-charcoal-700 text-white border border-sw-breeze/20'
                  } rounded-lg px-4 py-2 shadow-sm`}
                >
                  <div className="flex items-baseline space-x-2 mb-1">
                    <span className={`text-xs font-semibold ${
                      isUser ? 'text-white/90' : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {isAI ? 'AI Agent' : 'Customer'}
                    </span>
                    <span className={`text-xs ${
                      isUser ? 'text-white/70' : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{message.text}</p>
                </div>

                {isUser && (
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                    <User size={16} className="text-white" />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {transcript.length > 0 && (
        <div className="bg-sw-charcoal-800 px-4 py-2 border-t border-sw-breeze/10">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {transcript.length} message{transcript.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
