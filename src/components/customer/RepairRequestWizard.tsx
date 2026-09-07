import React from 'react';
import { RepairConversation } from '../repair/RepairConversation';

interface RepairRequestWizardProps {
  onCancel: () => void;
  onRequestCreated: (requestId: string) => void;
  preselectedDevice?: string;
  preselectedBrand?: string;
  preselectedModel?: string;
  preselectedIssue?: string;
}

export const RepairRequestWizard: React.FC<RepairRequestWizardProps> = ({
  onCancel,
  onRequestCreated,
  preselectedDevice,
  preselectedBrand,
  preselectedModel,
  preselectedIssue,
}) => {
  return (
    <RepairConversation
      onCancel={onCancel}
      onRequestCreated={onRequestCreated}
      preselectedDevice={preselectedDevice}
      preselectedBrand={preselectedBrand}
      preselectedModel={preselectedModel}
      preselectedIssue={preselectedIssue}
    />
  );
};
