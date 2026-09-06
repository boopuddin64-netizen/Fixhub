import React, { useState, useMemo } from 'react';
import { RepairIssue, RepairIssueCategory } from '../../../types';
import {
  Smartphone,
  BatteryCharging,
  Camera,
  Volume2,
  Wifi,
  Droplets,
  Cpu,
  HelpCircle,
  Check,
  Search,
  AlertCircle
} from 'lucide-react';

interface IssueSelectorProps {
  issues: RepairIssue[];
  selectedIssueIds: string[];
  onToggleIssue: (issueId: string) => void;
  otherDescription: string;
  onOtherDescriptionChange: (text: string) => void;
}

export const IssueSelector: React.FC<IssueSelectorProps> = ({
  issues,
  selectedIssueIds,
  onToggleIssue,
  otherDescription,
  onOtherDescriptionChange,
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const categories: { id: string; label: string; icon: React.ElementType }[] = [
    { id: 'ALL', label: 'All Issues', icon: Smartphone },
    { id: 'Screen & Display', label: 'Screen & Display', icon: Smartphone },
    { id: 'Power & Battery', label: 'Power & Battery', icon: BatteryCharging },
    { id: 'Camera', label: 'Camera', icon: Camera },
    { id: 'Audio', label: 'Audio', icon: Volume2 },
    { id: 'Network & Connectivity', label: 'Network', icon: Wifi },
    { id: 'Physical Damage', label: 'Physical Damage', icon: Droplets },
    { id: 'Software', label: 'Software', icon: Cpu },
    { id: 'Other', label: 'Other', icon: HelpCircle },
  ];

  // Group issues by category or filter by search query
  const filteredIssues = useMemo(() => {
    let list = issues;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q) ||
          (i.description && i.description.toLowerCase().includes(q))
      );
    }

    if (selectedCategory !== 'ALL') {
      list = list.filter((i) => i.category === selectedCategory);
    }

    return list;
  }, [issues, searchQuery, selectedCategory]);

  const isOtherSelected = selectedIssueIds.includes('issue_other') || selectedIssueIds.includes('other');

  return (
    <div id="repair-issue-selector" className="space-y-4">
      {/* Search & Category Pills */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search problem (e.g., cracked screen, not charging, water)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 font-bold p-1 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Category Horizontal Filter Pills */}
        {!searchQuery && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none no-scrollbar">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = selectedCategory === cat.id;
              const countInCategory = cat.id === 'ALL'
                ? issues.length
                : issues.filter((i) => i.category === cat.id).length;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <span>{cat.label}</span>
                  <span className={`text-[10px] px-1 py-0.2 rounded-full ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {countInCategory}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Issues Selection Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            {searchQuery ? `Search Results (${filteredIssues.length})` : selectedCategory}
          </span>
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            {selectedIssueIds.length} problem{selectedIssueIds.length === 1 ? '' : 's'} selected
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto pr-1">
          {filteredIssues.map((issue) => {
            const isSelected = selectedIssueIds.includes(issue.id);
            return (
              <div
                key={issue.id}
                onClick={() => onToggleIssue(issue.id)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                  isSelected
                    ? 'border-emerald-600 bg-emerald-50/70 shadow-xs ring-1 ring-emerald-600/30'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                {/* Selection Checkbox */}
                <div
                  className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                    isSelected
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'border border-slate-300 bg-white'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className={`text-xs font-bold ${isSelected ? 'text-emerald-950' : 'text-slate-900'}`}>
                      {issue.name}
                    </p>
                    <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                      {issue.category}
                    </span>
                  </div>
                  {issue.description && (
                    <p className={`text-[11px] line-clamp-2 mt-0.5 ${isSelected ? 'text-emerald-800' : 'text-slate-500'}`}>
                      {issue.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* "Other" Issue Detailed Prompt */}
      {isOtherSelected && (
        <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 space-y-2 animate-fadeIn">
          <div className="flex items-center gap-2 text-amber-900">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="text-xs font-bold">Tell us what is happening</span>
          </div>
          <textarea
            rows={3}
            placeholder="Describe the problem in your own words..."
            value={otherDescription}
            onChange={(e) => onOtherDescriptionChange(e.target.value)}
            className="w-full p-3 rounded-xl border border-amber-300 bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 shadow-xs"
          />
        </div>
      )}
    </div>
  );
};
