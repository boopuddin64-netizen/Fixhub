import React from 'react';

interface DescriptionStepProps {
  description: string;
  onChangeDescription: (text: string) => void;
  onContinue: () => void;
}

export const DescriptionStep: React.FC<DescriptionStepProps> = ({
  description,
  onChangeDescription,
  onContinue,
}) => {
  return (
    <div className="space-y-4 animate-fadeIn">
      <div>
        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Anything else happening?
        </h3>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Provide any extra details about how the issue occurred or current symptoms.
        </p>
      </div>

      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
          Problem Details & Symptoms
        </label>
        <textarea
          rows={4}
          value={description}
          onChange={(e) => onChangeDescription(e.target.value)}
          placeholder="E.g. Phone fell on concrete, screen cracked and touch stopped responding on the lower right..."
          className="w-full p-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
        />
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="button"
          onClick={onContinue}
          className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-2xl transition-all shadow-md cursor-pointer"
        >
          Continue →
        </button>
      </div>
    </div>
  );
};
