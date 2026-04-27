export default function SentimentBadge({ sentiment }) {
  if (!sentiment) return null;
  const map = {
    positive: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
    neutral: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    negative: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  };
  const cls = map[sentiment] || map.neutral;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
    </span>
  );
}
