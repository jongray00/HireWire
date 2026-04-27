"use client";

import { Phone, Video, X } from "lucide-react";

export default function CallOptionsModal({ isOpen, onClose, resource, onSelectCallType }) {
  if (!isOpen || !resource) return null;

  const handleCallType = (type) => {
    onSelectCallType(type);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-w-md w-full animate-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Call Resource
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {resource.display_name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-3">
            {/* Voice Call Option */}
            <button
              onClick={() => handleCallType('voice')}
              className="w-full flex items-center space-x-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20
                       hover:from-green-100 hover:to-emerald-100 dark:hover:from-green-900/30 dark:hover:to-emerald-900/30
                       border-2 border-green-200 dark:border-green-800 rounded-lg transition-all duration-150 hover:scale-105 active:scale-95"
            >
              <div className="flex-shrink-0 w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center">
                <Phone className="text-white" size={24} />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900 dark:text-white">
                  Voice Call
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Audio-only conversation
                </div>
              </div>
            </button>

            {/* Video Call Option */}
            <button
              onClick={() => handleCallType('video')}
              className="w-full flex items-center space-x-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20
                       hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-900/30 dark:hover:to-pink-900/30
                       border-2 border-purple-200 dark:border-purple-800 rounded-lg transition-all duration-150 hover:scale-105 active:scale-95"
            >
              <div className="flex-shrink-0 w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center">
                <Video className="text-white" size={24} />
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-gray-900 dark:text-white">
                  Video Call
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Audio + video conversation
                </div>
              </div>
            </button>
          </div>

          {/* Footer */}
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700 rounded-b-xl">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300
                       hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
