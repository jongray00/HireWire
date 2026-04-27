export default function CallLogDetail({ log }) {
  if (!log) return null;

  const actions = log.actions || [];

  const customerInfo = actions.find((a) => a.action_type === "customer_info");
  const messages = actions.filter((a) => a.action_type === "message");
  const callbacks = actions.filter((a) => a.action_type === "callback");
  const emailsSent = actions.filter((a) => a.action_type === "email_sent");
  const smsSent = actions.filter((a) => a.action_type === "sms_sent");

  const sectionClass =
    "p-3 mb-2 rounded-md border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 text-gray-900 dark:text-gray-100";
  const headingClass =
    "text-xs font-bold mb-1.5 uppercase tracking-wide text-gray-600 dark:text-gray-300";
  const fieldClass = "flex gap-2 text-sm mb-0.5";
  const mutedClass = "text-gray-500 dark:text-gray-400";

  return (
    <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">
      {customerInfo && (
        <div className={sectionClass}>
          <div className={headingClass}>Customer Info</div>
          {customerInfo.data.name && <div className={fieldClass}><strong>Name:</strong> {customerInfo.data.name}</div>}
          {customerInfo.data.email && <div className={fieldClass}><strong>Email:</strong> {customerInfo.data.email}</div>}
          {customerInfo.data.phone && <div className={fieldClass}><strong>Phone:</strong> {customerInfo.data.phone}</div>}
          {customerInfo.data.company && <div className={fieldClass}><strong>Company:</strong> {customerInfo.data.company}</div>}
          {customerInfo.data.notes && <div className={fieldClass}><strong>Notes:</strong> {customerInfo.data.notes}</div>}
        </div>
      )}

      {log.summary && (
        <div className={sectionClass}>
          <div className={headingClass}>Call Summary</div>
          <p className="text-sm m-0">{log.summary}</p>
          {log.caller_intent && (
            <p className={`text-xs mt-1 m-0 ${mutedClass}`}>
              <strong>Intent:</strong> {log.caller_intent}
            </p>
          )}
          {log.follow_up && (
            <p className="text-xs mt-1 m-0 text-amber-700 dark:text-amber-400">
              <strong>Follow-up:</strong> {log.follow_up}
            </p>
          )}
        </div>
      )}

      {messages.length > 0 && (
        <div className={sectionClass}>
          <div className={headingClass}>Messages Taken</div>
          {messages.map((m, i) => (
            <div key={i} className="mb-1.5 text-sm">
              <strong>{m.data.name || "Caller"}:</strong> "{m.data.message}"
              {m.data.number && <span className={mutedClass}> — callback: {m.data.number}</span>}
            </div>
          ))}
        </div>
      )}

      {callbacks.length > 0 && (
        <div className={sectionClass}>
          <div className={headingClass}>Callbacks Scheduled</div>
          {callbacks.map((c, i) => (
            <div key={i} className="text-sm mb-1.5">
              <strong>{c.data.name}</strong> — {c.data.time}
              {c.data.number && <span className={mutedClass}> ({c.data.number})</span>}
              {c.data.reason && <div className={`text-xs ${mutedClass}`}>Reason: {c.data.reason}</div>}
            </div>
          ))}
        </div>
      )}

      {emailsSent.length > 0 && (
        <div className={sectionClass}>
          <div className={headingClass}>Emails Sent</div>
          {emailsSent.map((e, i) => (
            <div key={i} className="text-sm mb-1.5">
              To: <strong>{e.data.to || e.data.to_email}</strong>
              {e.data.subject && <span> — "{e.data.subject}"</span>}
              <span
                className={`ml-2 text-xs ${
                  e.data.status === "sent"
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                ({e.data.status || "sent"})
              </span>
            </div>
          ))}
        </div>
      )}

      {smsSent.length > 0 && (
        <div className={sectionClass}>
          <div className={headingClass}>SMS Sent</div>
          {smsSent.map((s, i) => (
            <div key={i} className="text-sm mb-1.5">
              To: <strong>{s.data.to || s.data.phone_number}</strong>
              {s.data.body && (
                <div className={`text-xs ${mutedClass}`}>"{(s.data.body || "").slice(0, 100)}"</div>
              )}
            </div>
          ))}
        </div>
      )}

      {log.topics && (
        <div className="flex gap-1 flex-wrap mt-2">
          {(typeof log.topics === "string" ? JSON.parse(log.topics) : log.topics).map((topic, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200"
            >
              {topic}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
