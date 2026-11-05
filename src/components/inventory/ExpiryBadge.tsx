import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';

interface ExpiryBadgeProps {
  expiryDate: string;
  daysToExpiry?: number;
  className?: string;
}

export default function ExpiryBadge({ expiryDate, daysToExpiry, className = '' }: ExpiryBadgeProps) {
  // Calculate days if not provided
  let days = daysToExpiry;
  if (days === undefined) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDate);
    exp.setHours(0, 0, 0, 0);
    days = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  if (days <= 0) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300 animate-pulse ${className}`}
        title={`Expired on ${expiryDate}. Do NOT dispense.`}
      >
        <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
        <span>EXPIRED ({Math.abs(days)}d ago)</span>
      </span>
    );
  }

  if (days <= 90) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300 ${className}`}
        title={`Expiring in ${days} days on ${expiryDate}. Use first!`}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        <span>Expiring in {days}d</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 ${className}`}
      title={`Valid until ${expiryDate}`}
    >
      <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
      <span>Exp: {expiryDate}</span>
    </span>
  );
}
