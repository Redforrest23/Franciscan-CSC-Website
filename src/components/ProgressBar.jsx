export default function ProgressBar({
  label,
  completed,
  total,
  percent,
  color = 'bg-fus-green-500',
  showFraction = true,
}) {
  const pct = percent ?? (total === 0 ? 0 : Math.round((completed / total) * 100))

  return (
    <div className="w-full">
      {(label || showFraction) && (
        <div className="flex justify-between items-baseline text-sm mb-1.5">
          {label && (
            <span className="text-gray-700 font-medium text-sm">{label}</span>
          )}
          {showFraction && total > 0 && (
            <span className="text-gray-400 text-xs ml-auto">
              {completed}/{total} &nbsp;({pct}%)
            </span>
          )}
        </div>
      )}
      <div className="h-2 w-full rounded-full bg-gray-100 border border-gray-200">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
