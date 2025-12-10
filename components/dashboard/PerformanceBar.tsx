'use client';

interface PerformanceBarProps {
  current: number;
  target: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function PerformanceBar({ current, target, showLabel = true, size = 'md' }: PerformanceBarProps) {
  const percentage = target > 0 ? Math.round((current / target) * 100) : 0;
  
  const getColor = () => {
    if (percentage >= 80) return { bg: 'bg-green-500', text: 'text-green-600', light: 'bg-green-100' };
    if (percentage >= 50) return { bg: 'bg-amber-500', text: 'text-amber-600', light: 'bg-amber-100' };
    return { bg: 'bg-red-500', text: 'text-red-600', light: 'bg-red-100' };
  };

  const colors = getColor();
  
  const heights = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3'
  };

  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${colors.light} rounded-full overflow-hidden ${heights[size]}`}>
        <div 
          className={`h-full ${colors.bg} rounded-full transition-all duration-500`}
          style={{ width: `${Math.min(percentage, 100)}%` }}
        />
      </div>
      {showLabel && (
        <span className={`text-sm font-semibold ${colors.text} min-w-[3rem] text-right`}>
          {percentage}%
        </span>
      )}
    </div>
  );
}

export function getPerformanceColor(percentage: number) {
  if (percentage >= 80) return { bg: 'bg-green-500', text: 'text-green-600', badge: 'bg-green-100 text-green-700' };
  if (percentage >= 50) return { bg: 'bg-amber-500', text: 'text-amber-600', badge: 'bg-amber-100 text-amber-700' };
  return { bg: 'bg-red-500', text: 'text-red-600', badge: 'bg-red-100 text-red-700' };
}
