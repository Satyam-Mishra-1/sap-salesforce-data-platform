export function InsightCard({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim());
  return (
    <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-2">
        AI Insights · GPT-4o
      </p>
      <ul className="space-y-1">
        {lines.map((l, i) => (
          <li key={i} className="text-sm text-gray-700 dark:text-gray-300">
            {l}
          </li>
        ))}
      </ul>
    </div>
  );
}
