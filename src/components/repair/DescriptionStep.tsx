import React from 'react';
import { Send, Sparkles, ArrowRight } from 'lucide-react';

interface DescriptionStepProps {
  description: string;
  onChangeDescription: (text: string) => void;
  onContinue: () => void;
}

const COMMON_SYMPTOM_CHIPS = [
  'Fell on concrete/tile',
  'Touch stops responding',
  'Screen flickers / lines',
  'Battery drains very fast',
  'Water / tea spilled on it',
  'Overheats when charging',
  'Speaker crackles / no sound',
];

export const DescriptionStep: React.FC<DescriptionStepProps> = ({
  description,
  onChangeDescription,
  onContinue,
}) => {
  const handleChipClick = (chip: string) => {
    if (!description.trim()) {
      onChangeDescription(chip);
    } else if (!description.includes(chip)) {
      onChangeDescription(`${description.trim()}, ${chip.toLowerCase()}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (description.trim()) {
        onContinue();
      }
    }
  };

  return (
    <div className="space-y-3.5 animate-fadeIn">
      {/* Suggestion Chips */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Quick Symptom Suggestions</span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {COMMON_SYMPTOM_CHIPS.map((chip) => {
            const isIncluded = description.toLowerCase().includes(chip.toLowerCase());
            return (
              <button
                key={chip}
                type="button"
                onClick={() => handleChipClick(chip)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                  isIncluded
                    ? 'bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-400/30'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                + {chip}
              </button>
            );
          })}
        </div>
      </div>

      {/* Inline Conversational Composer */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <textarea
          rows={3}
          value={description}
          onChange={(e) => onChangeDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="E.g. Phone fell on concrete, screen cracked and touch stopped responding on the lower right..."
          className="w-full p-3 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 resize-none"
        />

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <span className="text-[11px] text-slate-400">
            {description.trim().length > 0 ? `${description.length} characters` : 'Optional if issues are selected'}
          </span>

          <div className="flex items-center gap-2">
            {!description.trim() && (
              <button
                type="button"
                onClick={onContinue}
                className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              >
                Skip this
              </button>
            )}

            <button
              type="button"
              onClick={onContinue}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span>{description.trim() ? 'Send Description' : 'Continue'}</span>
              {description.trim() ? <Send className="w-3.5 h-3.5" /> : <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
