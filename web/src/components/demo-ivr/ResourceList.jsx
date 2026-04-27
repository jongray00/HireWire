"use client";

import { useState, useEffect } from "react";
import { Zap, Phone, Users, Video, Radio, Plus, RefreshCw, Code } from "lucide-react";

const RESOURCE_TYPE_INFO = {
  swml_webhooks: {
    icon: Zap,
    label: "SWML Webhooks",
    color: "blue",
    description: "Dynamic SWML served from external webhooks"
  },
  swml_scripts: {
    icon: Code,
    label: "SWML Scripts",
    color: "indigo",
    description: "Inline SWML scripts stored in SignalWire"
  },
  ai_agents: {
    icon: Radio,
    label: "AI Agents",
    color: "purple",
    description: "SignalWire AI agents"
  },
  conference_rooms: {
    icon: Video,
    label: "Conference Rooms",
    color: "green",
    description: "Video and audio conference rooms"
  },
  subscribers: {
    icon: Users,
    label: "Subscribers",
    color: "orange",
    description: "Subscriber endpoints"
  },
  sip_endpoints: {
    icon: Phone,
    label: "SIP Endpoints",
    color: "red",
    description: "SIP calling endpoints"
  },
  other: {
    icon: Zap,
    label: "Other Resources",
    color: "gray",
    description: "Other dialable resources"
  }
};

export default function ResourceList({
  credentials,
  onResourceSelect,
  selectedResourceId,
  onRefresh,
  onCallResource
}) {
  const [resources, setResources] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchResources = async () => {
    if (!credentials) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/signalwire/list-resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credentials }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch resources");
      }

      const data = await response.json();
      setResources(data);
    } catch (err) {
      console.error("Error fetching resources:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, [credentials]);

  const handleRefresh = () => {
    fetchResources();
    if (onRefresh) onRefresh();
  };

  const renderResourceCategory = (categoryKey, categoryResources) => {
    if (categoryResources.length === 0) return null;

    const typeInfo = RESOURCE_TYPE_INFO[categoryKey] || RESOURCE_TYPE_INFO.other;
    const IconComponent = typeInfo.icon;

    return (
      <div key={categoryKey} className="mb-6">
        <div className="flex items-center space-x-2 mb-3">
          <div className={`w-8 h-8 bg-${typeInfo.color}-100 dark:bg-${typeInfo.color}-900/30 rounded-lg flex items-center justify-center`}>
            <IconComponent className={`text-${typeInfo.color}-600 dark:text-${typeInfo.color}-400`} size={16} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {typeInfo.label}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {typeInfo.description}
            </p>
          </div>
          <div className="ml-auto">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
              {categoryResources.length}
            </span>
          </div>
        </div>

        <div className="space-y-2">
          {categoryResources.map((resource) => (
            <div
              key={resource.id}
              className={`p-3 rounded-lg border transition-all duration-150 ${
                selectedResourceId === resource.id
                  ? `border-${typeInfo.color}-500 bg-${typeInfo.color}-50 dark:bg-${typeInfo.color}-900/20`
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600"
              }`}
            >
              <div className="flex items-start justify-between">
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => onResourceSelect(resource)}
                >
                  <div className="font-medium text-sm text-gray-900 dark:text-white">
                    {resource.display_name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Updated: {new Date(resource.updated_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-2">
                  {/* Call Button */}
                  {onCallResource && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCallResource(resource);
                      }}
                      className="p-2 bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50
                               text-green-600 dark:text-green-400 rounded-lg transition-all duration-150 hover:scale-110"
                      title="Call this resource"
                    >
                      <Phone size={16} />
                    </button>
                  )}
                  {/* Selected Indicator */}
                  {selectedResourceId === resource.id && (
                    <div className={`flex-shrink-0 w-6 h-6 bg-${typeInfo.color}-500 rounded-full flex items-center justify-center`}>
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading && !resources) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Loading resources...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-red-200 dark:border-red-700 p-6">
        <div className="text-center py-4">
          <p className="text-red-600 dark:text-red-400 mb-4">Error: {error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-3 rounded-t-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className="text-white" size={18} />
            <h3 className="text-sm font-semibold text-white">Available Resources</h3>
            {resources && (
              <div className="bg-white/20 px-2 py-0.5 rounded-full">
                <span className="text-xs font-medium text-white">
                  {resources.total || 0}
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh resources"
          >
            <RefreshCw className={`text-white ${loading ? 'animate-spin' : ''}`} size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {!resources || resources.total === 0 ? (
          <div className="text-center py-8">
            <Zap className="mx-auto text-gray-400 dark:text-gray-600 mb-3" size={48} />
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              No resources found
            </p>
            <button
              onClick={() => onResourceSelect(null)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-lg transition-all"
            >
              <Plus size={16} />
              <span>Create New Resource</span>
            </button>
          </div>
        ) : (
          <>
            {/* Create New Button */}
            <button
              onClick={() => onResourceSelect(null)}
              className="w-full mb-4 p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all group"
            >
              <div className="flex items-center justify-center space-x-2">
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center group-hover:bg-blue-500 transition-colors">
                  <Plus className="text-blue-600 dark:text-blue-400 group-hover:text-white" size={18} />
                </div>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  Create New SWML Webhook
                </span>
              </div>
            </button>

            {/* Resource Categories */}
            <div className="max-h-96 overflow-y-auto">
              {Object.entries(resources.categorized).map(([key, items]) =>
                renderResourceCategory(key, items)
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
