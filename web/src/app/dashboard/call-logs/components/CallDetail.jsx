export default function CallDetail({ log }) {
  if (!log) return null;
  const raw = log._raw;
  const callLog = raw?.call_log || [];

  return (
    <div className="mt-4 space-y-4">
      {/* Summary info grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        {log.callerIntent && (
          <div>
            <span className="text-gray-500 dark:text-gray-400 text-xs">Intent</span>
            <p className="text-gray-900 dark:text-white font-medium">{log.callerIntent}</p>
          </div>
        )}
        {log.followUp && (
          <div>
            <span className="text-gray-500 dark:text-gray-400 text-xs">Follow-up</span>
            <p className="text-gray-900 dark:text-white font-medium">{log.followUp}</p>
          </div>
        )}
        {log.topics?.length > 0 && (
          <div>
            <span className="text-gray-500 dark:text-gray-400 text-xs">Topics</span>
            <p className="text-gray-900 dark:text-white font-medium">{log.topics.join(", ")}</p>
          </div>
        )}
        <div>
          <span className="text-gray-500 dark:text-gray-400 text-xs">Messages</span>
          <p className="text-gray-900 dark:text-white font-medium">{log.totalMessages || 0}</p>
        </div>
        <div>
          <span className="text-gray-500 dark:text-gray-400 text-xs">Tokens</span>
          <p className="text-gray-900 dark:text-white font-medium">
            {((log.totalInputTokens || 0) + (log.totalOutputTokens || 0)).toLocaleString()}
          </p>
        </div>
        {log.avgLatencyMs != null && (
          <div>
            <span className="text-gray-500 dark:text-gray-400 text-xs">Avg Latency</span>
            <p className="text-gray-900 dark:text-white font-medium">{log.avgLatencyMs}ms</p>
          </div>
        )}
      </div>

      {/* Conversation transcript */}
      {callLog.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Transcript
          </h4>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {callLog.map((msg, i) => {
              if (msg.role === "system") return null;
              const isUser = msg.role === "user";
              return (
                <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[80%] px-3 py-2 rounded-lg text-sm ${
                      isUser
                        ? "bg-blue-100 dark:bg-blue-900/40 text-blue-900 dark:text-blue-100"
                        : "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                    }`}
                  >
                    <span className="text-xs font-semibold opacity-60 block mb-0.5 capitalize">{msg.role}</span>
                    {msg.content}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
