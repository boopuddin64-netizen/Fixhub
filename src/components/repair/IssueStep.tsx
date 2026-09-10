import React from 'react';
import { IssueSelector } from '../customer/repair-flow/IssueSelector';
import { RepairIssue } from '../../types';
import { ArrowRight, Check } from 'lucide-react';

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
    <div className="space-y-3.5 animate-fadeIn">
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <IssueSelector
          selectedIssueIds={selectedIssueIds}
          onChange={onChangeSelectedIssues}
          otherDescription={otherDescription}
          onOtherDescriptionChange={onChangeOtherDescription}
          onIssuesLoaded={onIssuesLoaded}
        />

        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-xs font-semibold text-slate-600">
            {selectedIssueIds.length === 0 ? (
              <span className="text-amber-600 font-medium">Please select at least one problem</span>
            ) : (
              <span className="text-emerald-700 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                {selectedIssueIds.length} problem{selectedIssueIds.length > 1 ? 's' : ''} selected
              </span>
            )}
          </span>

          <button
            type="button"
            disabled={selectedIssueIds.length === 0}
            onClick={onContinue}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
          >
            <span>Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
