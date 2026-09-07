import React from 'react';
import { RepairLifecycleStatus } from '../../types';
import { StatusBadge } from '../common/StatusBadge';

interface RepairStatusProps {
  status: RepairLifecycleStatus | string;
  size?: 'sm' | 'md' | 'lg';
}

export const RepairStatus: React.FC<RepairStatusProps> = ({ status, size = 'md' }) => {
  return <StatusBadge status={status as RepairLifecycleStatus} size={size} />;
};
