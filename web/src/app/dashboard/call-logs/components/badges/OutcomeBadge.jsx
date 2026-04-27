export default function OutcomeBadge({ outcome }) {
  if (!outcome) return null;
  const map = {
    resolved: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
    transferred: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
    unresolved: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
    escalated: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  };
  const cls = map[outcome] || "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {outcome.charAt(0).toUpperCase() + outcome.slice(1)}
    </span>
  );
}
