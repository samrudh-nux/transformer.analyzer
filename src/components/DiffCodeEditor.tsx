import React from 'react';
import { Play, RotateCcw, GitCompare, Sparkles, BookOpen } from 'lucide-react';
import { DIFF_PRESET_PAIRS, DiffPresetPair } from '../data/diffPresets';

interface DiffCodeEditorProps {
  beforeCode: string;
  setBeforeCode: (code: string) => void;
  afterCode: string;
  setAfterCode: (code: string) => void;
  onAnalyzeDiff: () => void;
  isAnalyzing: boolean;
  selectedPresetId: string;
  onSelectPresetPair: (preset: DiffPresetPair) => void;
}

export const DiffCodeEditor: React.FC<DiffCodeEditorProps> = ({
  beforeCode,
  setBeforeCode,
  afterCode,
  setAfterCode,
  onAnalyzeDiff,
  isAnalyzing,
  selectedPresetId,
  onSelectPresetPair,
}) => {
  const beforeLines = beforeCode.split('\n');
  const afterLines = afterCode.split('\n');

  const beforeLineNumbers = Array.from({ length: Math.max(beforeLines.length, 10) }, (_, i) => i + 1);
  const afterLineNumbers = Array.from({ length: Math.max(afterLines.length, 10) }, (_, i) => i + 1);

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm flex flex-col overflow-hidden h-full">
      {/* Editor Header Toolbar */}
      <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <GitCompare className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-semibold text-zinc-800 uppercase tracking-wider font-mono">
            Diff Mode: Compare Before vs After
          </span>
          <span className="text-[11px] text-zinc-400 font-mono hidden sm:inline">
            (Semantic Rotation & Frame Review)
          </span>
        </div>

        {/* Preset Selector Dropdown */}
        <div className="flex items-center space-x-2">
          <label className="text-xs text-zinc-500 flex items-center space-x-1 font-medium">
            <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Preset Pair:</span>
          </label>
          <select
            value={selectedPresetId}
            onChange={(e) => {
              const p = DIFF_PRESET_PAIRS.find((item) => item.id === e.target.value);
              if (p) onSelectPresetPair(p);
            }}
            className="text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans cursor-pointer shadow-2xs"
          >
            <option value="" disabled>
              Select PR / Diff Benchmark...
            </option>
            {DIFF_PRESET_PAIRS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.title}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setBeforeCode('');
              setAfterCode('');
            }}
            title="Clear both editors"
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 rounded-md transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Preset Chips */}
      <div className="px-4 py-2 bg-zinc-100/90 border-b border-zinc-200 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-mono text-zinc-500 font-semibold uppercase tracking-wider mr-1">
          Preset Pairs:
        </span>
        {DIFF_PRESET_PAIRS.map((preset) => {
          const isSelected = selectedPresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPresetPair(preset)}
              className={`px-3 py-1 rounded-full text-xs font-medium font-mono transition-all flex items-center space-x-1.5 border shadow-2xs ${
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-600 font-semibold ring-2 ring-indigo-200'
                  : 'bg-white text-zinc-700 border-zinc-300 hover:bg-zinc-50 hover:border-zinc-400'
              }`}
            >
              <span>{preset.title}</span>
            </button>
          );
        })}
      </div>

      {/* Dual Code Area (Side-by-Side or Stacked) */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800 bg-zinc-950 text-zinc-100 font-mono text-xs min-h-[340px]">
        {/* BEFORE Editor */}
        <div className="flex flex-col h-full min-h-[170px]">
          <div className="px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[11px] font-bold text-rose-400 uppercase tracking-wider flex items-center justify-between">
            <span>1. Before Code (Original)</span>
            <span className="text-[10px] text-zinc-500 font-normal">Input BEFORE</span>
          </div>
          <div className="flex-1 relative flex overflow-auto">
            <div className="select-none py-2.5 px-2.5 text-right text-zinc-600 bg-zinc-900/60 border-r border-zinc-800 font-mono text-xs min-w-[36px]">
              {beforeLineNumbers.map((num) => (
                <div key={num} className="leading-5">
                  {num}
                </div>
              ))}
            </div>
            <textarea
              value={beforeCode}
              onChange={(e) => setBeforeCode(e.target.value)}
              placeholder="Paste 'BEFORE' code version here..."
              spellCheck={false}
              className="flex-1 w-full p-2.5 bg-transparent text-zinc-200 font-mono text-xs leading-5 resize-none focus:outline-none focus:ring-0 selection:bg-rose-950 selection:text-rose-100 placeholder:text-zinc-600"
            />
          </div>
        </div>

        {/* AFTER Editor */}
        <div className="flex flex-col h-full min-h-[170px]">
          <div className="px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
            <span>2. After Code (Modified)</span>
            <span className="text-[10px] text-zinc-500 font-normal">Input AFTER</span>
          </div>
          <div className="flex-1 relative flex overflow-auto">
            <div className="select-none py-2.5 px-2.5 text-right text-zinc-600 bg-zinc-900/60 border-r border-zinc-800 font-mono text-xs min-w-[36px]">
              {afterLineNumbers.map((num) => (
                <div key={num} className="leading-5">
                  {num}
                </div>
              ))}
            </div>
            <textarea
              value={afterCode}
              onChange={(e) => setAfterCode(e.target.value)}
              placeholder="Paste 'AFTER' code version here..."
              spellCheck={false}
              className="flex-1 w-full p-2.5 bg-transparent text-zinc-200 font-mono text-xs leading-5 resize-none focus:outline-none focus:ring-0 selection:bg-emerald-950 selection:text-emerald-100 placeholder:text-zinc-600"
            />
          </div>
        </div>
      </div>

      {/* Footer Action Bar */}
      <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
        <div className="text-[11px] text-zinc-500 font-mono flex items-center space-x-2">
          <span>Press</span>
          <kbd className="px-1.5 py-0.5 bg-zinc-200 border border-zinc-300 rounded text-zinc-700 font-semibold text-[10px]">
            ⌘ + Enter
          </kbd>
          <span>to compare diffs</span>
        </div>

        <button
          onClick={onAnalyzeDiff}
          disabled={isAnalyzing || (!beforeCode.trim() && !afterCode.trim())}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-xs shadow-sm transition-all ${
            isAnalyzing || (!beforeCode.trim() && !afterCode.trim())
              ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]'
          }`}
        >
          {isAnalyzing ? (
            <>
              <Sparkles className="w-4 h-4 animate-spin text-indigo-200" />
              <span>Analyzing PR Diff...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white text-white" />
              <span>Compare Before & After</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
