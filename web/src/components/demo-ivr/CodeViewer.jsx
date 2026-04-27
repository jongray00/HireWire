'use client';

import { Code, Copy, Check } from 'lucide-react';
import { useState } from 'react';

export default function CodeViewer({ code, isGenerating }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (code) {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="bg-sw-charcoal-700 rounded-xl shadow-2xl border border-sw-breeze/10 glow-accent overflow-hidden h-full">
      {/* Header */}
      <div className="bg-gradient-to-r from-sw-blue to-sw-pink dark:from-sw-pink dark:to-sw-breeze px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Code className="text-white" size={18} />
            <h3 className="text-sm font-semibold text-white">
              Generated Agent Code
            </h3>
          </div>
          {code && (
            <button
              onClick={handleCopy}
              className="flex items-center space-x-1 px-3 py-1 bg-sw-charcoal-900/50 hover:bg-sw-charcoal-900 border border-sw-breeze/20 rounded-lg transition-all duration-150"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-white" />
                  <span className="text-xs text-white font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} className="text-white" />
                  <span className="text-xs text-white font-medium">Copy</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Code Content */}
      <div className="h-[calc(100vh-400px)] min-h-[500px] overflow-y-auto">
        {isGenerating ? (
          <div className="h-full flex flex-col items-center justify-center p-8">
            <div className="w-12 h-12 border-4 border-sw-pink border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              Generating agent configuration...
            </p>
          </div>
        ) : !code ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-gray-400 dark:text-gray-500">
            <Code size={48} className="mb-3 opacity-20" />
            <p className="text-sm font-medium">No code generated yet</p>
            <p className="text-xs mt-1 text-center max-w-xs">
              Enter a prompt and click "Generate Agent" to see the code
            </p>
          </div>
        ) : (
          <pre className="p-4 text-xs leading-relaxed font-mono bg-sw-charcoal-900 text-gray-100 overflow-x-auto border-t border-sw-breeze/10">
            <code className="language-python">{code}</code>
          </pre>
        )}
      </div>

      {/* Footer with syntax info */}
      {code && (
        <div className="bg-sw-charcoal-800 px-4 py-2 border-t border-sw-breeze/10">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Python • SignalWire Agents SDK
            </p>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {code.split('\n').length} lines
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
