export default function PerformanceRatingBadge({ avgLatencyMs }) {
  if (avgLatencyMs == null) return null;
  let label, cls;
  if (avgLatencyMs < 500) {
    label = "Fast";
    cls = "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400";
  } else if (avgLatencyMs < 1500) {
    label = "OK";
    cls = "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400";
  } else {
    label = "Slow";
    cls = "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
