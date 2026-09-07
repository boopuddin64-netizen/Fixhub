import React from 'react';
import { IssueSelector } from '../customer/repair-flow/IssueSelector';
import { RepairIssue } from '../../types';

interface IssueStepProps {
  deviceBrand: string;
  deviceModel: string;
  selectedIssueIds: string[];
  otherDescription: string;
  onChangeSelectedIssues: (issueIds: string[]) => void;
  onChangeOtherDescription: (text: string) => void;
  onIssuesLoaded?: (issues: RepairIssue[]) => void;
  onContinue: () => void;
}

export const IssueStep: React.FC<IssueStepProps> = ({
  deviceBrand,
  deviceModel,
  selectedIssueIds,
  otherDescription,
  onChangeSelectedIssues,
  onChangeOtherDescription,
  onIssuesLoaded,
  onContinue,
}) => {
  return (
    <div className="space-y-4 animate-fadeIn">
      <div>
        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Got it. What's wrong with your {deviceBrand} {deviceModel}?
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Select all problems that apply.
        </p>
      </div>

      <IssueSelector
        selectedIssueIds={selectedIssueIds}
        onChange={onChangeSelectedIssues}
        otherDescription={otherDescription}
        onOtherDescriptionChange={onChangeOtherDescription}
        onIssuesLoaded={onIssuesLoaded}
      />

      <div className="flex justify-end pt-4">
        <button
          type="button"
          disabled={selectedIssueIds.length === 0}
          onClick={onContinue}
          className="px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold text-xs sm:text-sm rounded-2xl transition-all shadow-md cursor-pointer disabled:cursor-not-allowed"
        >
          Continue →
        </button>
      </div>
    </div>
  );
};
