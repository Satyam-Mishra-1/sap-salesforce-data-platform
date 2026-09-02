interface Props {
  title: string;
  value: string;
  sub?: string;
  danger?: boolean;
}

export function KPICard({ title, value, sub, danger }: Props) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{title}</p>
      <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-gray-100">{value}</p>
      {sub && (
        <p className={`text-xs mt-1 ${danger ? "text-red-500" : "text-gray-400 dark:text-gray-500"}`}>
          {sub}
        </p>
      )}
    </div>
  );
}
