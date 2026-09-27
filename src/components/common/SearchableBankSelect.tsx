import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Building2 } from 'lucide-react';
import { NigerianBank } from '../../data/nigerianBanks';
import { forceResetViewportZoom } from '../../utils/mobileViewport';

interface SearchableBankSelectProps {
  banks: NigerianBank[];
  selectedBankCode: string;
  selectedBankName?: string;
  onSelectBank: (code: string, name: string) => void;
  disabled?: boolean;
  theme?: 'light' | 'dark';
  placeholder?: string;
  id?: string;
}

export const SearchableBankSelect: React.FC<SearchableBankSelectProps> = ({
  banks,
  selectedBankCode,
  selectedBankName,
  onSelectBank,
  disabled = false,
  theme = 'light',
  placeholder = 'Search & select bank...',
  id = 'bank-search-select',
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find currently selected bank object
  const currentBank = useMemo(() => {
    return (
      banks.find((b) => b.code === selectedBankCode) ||
      (selectedBankName ? banks.find((b) => b.name.toLowerCase() === selectedBankName.toLowerCase()) : undefined)
    );
  }, [banks, selectedBankCode, selectedBankName]);

  // Filter banks based on search query
  const filteredBanks = useMemo(() => {
    if (!searchQuery.trim()) {
      return banks;
    }
    const query = searchQuery.toLowerCase().trim();
    return banks.filter(
      (b) =>
        b.name.toLowerCase().includes(query) ||
        b.code.includes(query) ||
        (b.slug && b.slug.toLowerCase().includes(query))
    );
  }, [banks, searchQuery]);

  // Handle clicking outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        forceResetViewportZoom();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      // Auto-focus search input when opened
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (bank: NigerianBank) => {
    onSelectBank(bank.code, bank.name);
    setIsOpen(false);
    setSearchQuery('');
    forceResetViewportZoom();
  };

  const handleSelectCustom = () => {
    const customName = searchQuery.trim();
    if (!customName) return;
    onSelectBank('999', customName);
    setIsOpen(false);
    setSearchQuery('');
    forceResetViewportZoom();
  };

  const isDark = theme === 'dark';

  return (
    <div ref={containerRef} className="relative w-full" id={id}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
            setSearchQuery('');
          }
        }}
        className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border text-base sm:text-sm font-semibold text-left transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
          isDark
            ? 'bg-slate-800 border-slate-700 text-white hover:bg-slate-750 focus:ring-2 focus:ring-indigo-500 focus:outline-none'
            : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50 focus:ring-2 focus:ring-emerald-500 focus:outline-none'
        } ${isOpen ? (isDark ? 'ring-2 ring-indigo-500' : 'ring-2 ring-emerald-500') : ''}`}
      >
        <div className="flex items-center gap-2 truncate min-w-0">
          <Building2 className={`w-4 h-4 shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
          <span className="truncate">
            {currentBank ? currentBank.name : (selectedBankName || placeholder)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-150 ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            } ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute left-0 right-0 top-full mt-1.5 z-50 rounded-xl shadow-xl border overflow-hidden transition-all duration-150 flex flex-col ${
            isDark
              ? 'bg-slate-900 border-slate-700 text-white shadow-black/60'
              : 'bg-white border-slate-200 text-slate-900 shadow-slate-400/20'
          }`}
          style={{ maxHeight: '320px' }}
        >
          {/* Search Input Bar */}
          <div
            className={`p-2.5 border-b sticky top-0 z-10 ${
              isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-slate-50/95 border-slate-200'
            } backdrop-blur-xs`}
          >
            <div className="relative">
              <Search
                className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${
                  isDark ? 'text-slate-400' : 'text-slate-400'
                }`}
              />
              <input
                ref={searchInputRef}
                type="text"
                inputMode="text"
                enterKeyHint="search"
                autoCapitalize="none"
                autoCorrect="off"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredBanks.length > 0) {
                      handleSelect(filteredBanks[0]);
                    } else if (searchQuery.trim()) {
                      handleSelectCustom();
                    }
                    searchInputRef.current?.blur();
                    forceResetViewportZoom();
                  }
                }}
                placeholder="Type bank name (e.g. Zenith, GTBank, OPay, Kuda)..."
                className={`w-full pl-8.5 pr-8 py-2.5 rounded-lg text-base sm:text-sm font-medium focus:outline-none ${
                  isDark
                    ? 'bg-slate-800 text-white placeholder-slate-400 focus:ring-1 focus:ring-indigo-400'
                    : 'bg-white text-slate-900 placeholder-slate-400 border border-slate-200 focus:ring-1 focus:ring-emerald-500'
                }`}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:opacity-80 cursor-pointer ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="mt-1 px-1 flex items-center justify-between text-[10px] text-slate-400">
                <span>Matching banks</span>
                <span>{filteredBanks.length} found</span>
              </div>
            )}
          </div>

          {/* Banks Scrollable List */}
          <div className="overflow-y-auto flex-1 p-1 divide-y divide-transparent">
            {filteredBanks.length === 0 ? (
              <div className="py-6 text-center px-4">
                <Building2 className={`w-8 h-8 mx-auto mb-2 opacity-40 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                <p className={`text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  No bank found for "{searchQuery}"
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 mb-3">
                  You can use "{searchQuery.trim()}" as your bank name
                </p>
                <button
                  type="button"
                  onClick={handleSelectCustom}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 mx-auto ${
                    isDark ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Use "{searchQuery.trim()}"</span>
                </button>
              </div>
            ) : (
              <>
                {filteredBanks.map((bank, index) => {
                  const isSelected = bank.code === selectedBankCode;
                  return (
                    <button
                      key={`${bank.code}-${bank.slug || index}`}
                      type="button"
                      onClick={() => handleSelect(bank)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-colors cursor-pointer ${
                        isSelected
                          ? isDark
                            ? 'bg-indigo-600/30 text-indigo-200 font-bold'
                            : 'bg-emerald-50 text-emerald-900 font-bold'
                          : isDark
                          ? 'hover:bg-slate-800 text-slate-200'
                          : 'hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <span className="truncate">{bank.name}</span>
                      </div>
                      {isSelected && (
                        <div className="flex items-center shrink-0">
                          <Check
                            className={`w-4 h-4 shrink-0 ${
                              isDark ? 'text-indigo-400' : 'text-emerald-600'
                            }`}
                          />
                        </div>
                      )}
                    </button>
                  );
                })}

                {/* If searchQuery is not empty and doesn't exactly match the first result, offer custom use */}
                {searchQuery.trim() &&
                  !filteredBanks.some(
                    (b) => b.name.toLowerCase() === searchQuery.trim().toLowerCase()
                  ) && (
                    <button
                      type="button"
                      onClick={handleSelectCustom}
                      className={`w-full mt-1 flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-semibold border-t ${
                        isDark
                          ? 'border-slate-800 text-indigo-300 hover:bg-slate-800'
                          : 'border-slate-100 text-emerald-700 hover:bg-emerald-50'
                      } cursor-pointer`}
                    >
                      <span className="truncate">Use custom: "{searchQuery.trim()}"</span>
                      <Check className="w-3 h-3 shrink-0" />
                    </button>
                  )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

