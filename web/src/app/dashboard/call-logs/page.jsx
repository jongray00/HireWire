"use client";

import { useState, useEffect } from "react";
import {
  Activity,
  Clock,
  Search,
  RefreshCw,
  ThumbsUp,
  Zap,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { formatDuration, formatDate } from "./components/helpers";
import SentimentBadge from "./components/badges/SentimentBadge";
import OutcomeBadge from "./components/badges/OutcomeBadge";
import PerformanceRatingBadge from "./components/badges/PerformanceRatingBadge";
import CallDetail from "./components/CallDetail";
import CallLogDetail from "@/components/dashboard/CallLogDetail";

// ---------------------------------------------------------------------------
// KPI Stat Cards
// ---------------------------------------------------------------------------

function KpiCards({ logs }) {
  const total = logs.length;
  const avgDuration = total
    ? Math.round(logs.reduce((a, l) => a + (l.durationSec || 0), 0) / total)
    : 0;
  const positive = logs.filter((l) => l.sentiment === "positive").length;
  const resolved = logs.filter((l) => l.outcome === "resolved").length;
  const totalTokens = logs.reduce(
    (a, l) => a + (l.totalInputTokens || 0) + (l.totalOutputTokens || 0),
    0,
  );
  const totalSwaig = logs.reduce((a, l) => a + (l.swaigCalls || 0), 0);
  const avgConfidence = (() => {
    let sum = 0, count = 0;
    logs.forEach((l) => {
      (l._raw?.call_log || []).forEach((m) => {
        if (m.role === "user" && m.confidence != null) { sum += m.confidence; count++; }
      });
    });
    return count ? Math.round((sum / count) * 100) : null;
  })();

  const cards = [
    { icon: Activity, color: "text-blue-500", label: "Total Calls", value: total },
    { icon: Clock, color: "text-purple-500", label: "Avg Duration", value: formatDuration(avgDuration) },
    { icon: ThumbsUp, color: "text-green-500", label: "Positive", value: positive },
    { icon: Zap, color: "text-amber-500", label: "Resolved", value: resolved },
    { icon: Activity, color: "text-indigo-500", label: "Total Tokens", value: totalTokens.toLocaleString() },
    { icon: Zap, color: "text-orange-500", label: "SWAIG Calls", value: totalSwaig },
    { icon: Activity, color: "text-cyan-500", label: "Avg ASR", value: avgConfidence != null ? `${avgConfidence}%` : "—" },
    { icon: Activity, color: "text-rose-500", label: "Calls Today", value: logs.filter((l) => { try { return new Date(l.timestamp).toDateString() === new Date().toDateString(); } catch { return false; } }).length },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c) => (
        <div key={c.label} className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <c.icon size={16} className={c.color} />
            <span className="text-xs text-gray-500 dark:text-gray-400">{c.label}</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CallLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState("");

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      // Get projectId from session to scope logs
      let url = "/api/post-prompt/logs";
      try {
        const session = JSON.parse(localStorage.getItem("sally_sales_session") || "{}");
        const projectId = session.credentials?.projectId;
        if (projectId) url += `?projectId=${encodeURIComponent(projectId)}`;
      } catch { /* ignore */ }

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setLogs((data.logs || []).reverse());
      }
    } catch (err) {
      console.error("Failed to fetch call logs:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchLogs();
  };

  const employeeNames = [...new Set(logs.map((l) => l.employeeName).filter(Boolean))];

  const filteredLogs = logs.filter((log) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      log.employeeName?.toLowerCase().includes(q) ||
      log.summary?.toLowerCase().includes(q) ||
      log.callerIntent?.toLowerCase().includes(q) ||
      log.topics?.some((t) => t.toLowerCase().includes(q));
    const matchesEmployee = !employeeFilter || log.employeeName === employeeFilter;
    const matchesSentiment = !sentimentFilter || log.sentiment === sentimentFilter;
    return matchesSearch && matchesEmployee && matchesSentiment;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Call Logs</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            AI-generated summaries and analytics from completed calls
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      <KpiCards logs={logs} />

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Search summaries, topics, intents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
            />
          </div>
          <select
            value={employeeFilter}
            onChange={(e) => setEmployeeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
          >
            <option value="">All Employees</option>
            {employeeNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            value={sentimentFilter}
            onChange={(e) => setSentimentFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white text-sm"
          >
            <option value="">All Sentiments</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
          {(searchQuery || employeeFilter || sentimentFilter) && (
            <button
              onClick={() => { setSearchQuery(""); setEmployeeFilter(""); setSentimentFilter(""); }}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Call Logs Table */}
      {filteredLogs.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <Activity className="mx-auto text-gray-400 dark:text-gray-600 mb-4" size={48} />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {logs.length === 0 ? "No call logs yet" : "No matching calls"}
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            {logs.length === 0
              ? "Call logs will appear here after your virtual employees handle calls. The post-prompt AI will automatically generate summaries."
              : "Try adjusting your search or filters."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredLogs.map((log) => {
            const isExpanded = expandedId === log.id;
            return (
              <div key={log.id} className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  className="w-full flex items-center gap-4 p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900 dark:text-white">{log.employeeName}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">{log.employeeRole}</span>
                      <PerformanceRatingBadge avgLatencyMs={log.avgLatencyMs} />
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-1">{log.summary || "—"}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDate(log.timestamp)}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatDuration(log.durationSec)}</span>
                    <SentimentBadge sentiment={log.sentiment} />
                    <OutcomeBadge outcome={log.outcome} />
                    {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4">
                    <CallLogDetail log={log} />
                    <CallDetail log={log} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
