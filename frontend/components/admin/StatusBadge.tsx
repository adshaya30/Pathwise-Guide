import React from 'react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const s = status ? status.toUpperCase() : 'UNKNOWN';

  let colorClasses = 'bg-gray-100 text-gray-700 border-gray-300';

  if (s === 'COMPLETED' || s === 'APPROVED' || s === 'ACTIVE' || s === 'VERIFIED') {
    colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-300';
  } else if (s === 'PROCESSING' || s === 'PROCESSED') {
    colorClasses = 'bg-blue-50 text-blue-700 border-blue-300';
  } else if (s === 'PENDING' || s === 'QUEUED' || s === 'UPLOADED') {
    colorClasses = 'bg-amber-50 text-amber-700 border-amber-300';
  } else if (s === 'FAILED' || s === 'REJECTED' || s === 'CANCELLED') {
    colorClasses = 'bg-rose-50 text-rose-700 border-rose-300';
  }

  const padding = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center justify-center font-medium rounded-full border ${padding} ${colorClasses}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 currentColor" style={{ backgroundColor: 'currentColor' }} />
      {s}
    </span>
  );
};

