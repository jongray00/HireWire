"use client";

import { X } from "lucide-react";

export default function ResourceSelector({
  isOpen,
  onClose,
  onSelect,
  selectedResource
}) {
  if (!isOpen) return null;

  const handleSelect = (resource) => {
    onSelect(resource);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">
            Select Resource
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="text-white" size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Choose an existing resource to update or create a new one
          </p>

          {selectedResource ? (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <div className="font-medium text-blue-900 dark:text-blue-100">
                Selected: {selectedResource.display_name}
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Type: {selectedResource.type}
              </div>
            </div>
          ) : (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
              <div className="font-medium text-green-900 dark:text-green-100">
                Creating new SWML Script resource
              </div>
              <div className="text-sm text-green-700 dark:text-green-300 mt-1">
                A new resource will be created when you generate the agent
              </div>
            </div>
          )}

          <div className="mt-6 flex space-x-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSelect(selectedResource)}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all"
            >
              Confirm Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
