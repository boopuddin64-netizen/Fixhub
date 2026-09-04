import React from 'react';
import { RepairLifecycleStatus } from '../../types';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Wrench,
  PackageCheck,
  Truck,
  RotateCcw,
  Ban,
  DollarSign
} from 'lucide-react';

interface StatusBadgeProps {
  status: RepairLifecycleStatus | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', showIcon = true }) => {
  let label = status;
  let bg = 'bg-slate-100 text-slate-800 border-slate-200';
  let Icon = Clock;

  switch (status) {
    case 'REQUESTED':
      label = 'Finding Technicians';
      bg = 'bg-blue-50 text-blue-700 border-blue-200';
      Icon = Clock;
      break;
    case 'QUOTING':
      label = 'Quotes Received';
      bg = 'bg-cyan-50 text-cyan-800 border-cyan-200';
      Icon = DollarSign;
      break;
    case 'QUOTE_ACCEPTED':
      label = 'Quote Accepted';
      bg = 'bg-indigo-50 text-indigo-700 border-indigo-200';
      Icon = CheckCircle2;
      break;
    case 'PAYMENT_PENDING':
      label = 'Awaiting Payment';
      bg = 'bg-amber-50 text-amber-800 border-amber-200';
      Icon = DollarSign;
      break;
    case 'PAYMENT_CONFIRMED':
    case 'BOOKED':
      label = 'Payment Secured (Escrow)';
      bg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
      Icon = ShieldCheck;
      break;
    case 'DEVICE_DROPPED_OFF':
      label = 'Dropped Off at Shop';
      bg = 'bg-purple-50 text-purple-700 border-purple-200';
      Icon = Truck;
      break;
    case 'DEVICE_RECEIVED':
      label = 'Checked In at Shop';
      bg = 'bg-blue-50 text-blue-800 border-blue-200';
      Icon = PackageCheck;
      break;
    case 'DIAGNOSING':
      label = 'Diagnostic Scan';
      bg = 'bg-sky-50 text-sky-800 border-sky-200';
      Icon = Wrench;
      break;
    case 'REPAIR_IN_PROGRESS':
      label = 'Repair in Progress';
      bg = 'bg-indigo-50 text-indigo-800 border-indigo-200';
      Icon = Wrench;
      break;
    case 'ADDITIONAL_DIAGNOSIS':
      label = 'Additional Issue Review';
      bg = 'bg-amber-50 text-amber-900 border-amber-300 animate-pulse';
      Icon = AlertTriangle;
      break;
    case 'READY_FOR_PICKUP':
      label = 'Ready for Pickup';
      bg = 'bg-teal-50 text-teal-800 border-teal-300 font-semibold';
      Icon = CheckCircle2;
      break;
    case 'PICKED_UP':
      label = 'Phone Picked Up';
      bg = 'bg-slate-100 text-slate-800 border-slate-300';
      Icon = CheckCircle2;
      break;
    case 'COMPLETED':
      label = 'Repair Complete & Warranty Active';
      bg = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-medium';
      Icon = ShieldCheck;
      break;
    case 'DISPUTED':
      label = 'Dispute Under Review';
      bg = 'bg-rose-50 text-rose-800 border-rose-200';
      Icon = AlertTriangle;
      break;
    case 'CANCELLED':
      label = 'Cancelled';
      bg = 'bg-slate-100 text-slate-600 border-slate-200';
      Icon = Ban;
      break;
    case 'REFUNDED':
      label = 'Refunded';
      bg = 'bg-amber-50 text-amber-700 border-amber-200';
      Icon = RotateCcw;
      break;
    default:
      label = status.replace(/_/g, ' ');
  }

  const sizeClass =
    size === 'sm'
      ? 'text-xs px-2 py-0.5'
      : size === 'lg'
      ? 'text-sm px-3.5 py-1.5'
      : 'text-xs px-2.5 py-1';

  return (
    <span
      id={`status-badge-${status.toLowerCase()}`}
      className={`inline-flex items-center gap-1.5 rounded-full border ${bg} ${sizeClass} font-medium tracking-tight whitespace-nowrap`}
    >
      {showIcon && <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5'} />}
      <span>{label}</span>
    </span>
  );
};
