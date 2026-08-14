import React from 'react';
import { Play, RotateCcw, Code, Sparkles, BookOpen } from 'lucide-react';
import { PRESET_EXAMPLES } from '../data/presets';
import { PresetExample } from '../types';

interface CodeEditorProps {
  code: string;
  setCode: (code: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
  selectedPresetId: string;
  onSelectPreset: (preset: PresetExample) => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  setCode,
  onAnalyze,
  isAnalyzing,
  selectedPresetId,
  onSelectPreset,
}) => {
  const lineCount = code.split('\n').length;
  const lineNumbers = Array.from({ length: Math.max(lineCount, 12) }, (_, i) => i + 1);

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm flex flex-col overflow-hidden h-full">
      {/* Editor Header Toolbar */}
      <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <Code className="w-4 h-4 text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-800 uppercase tracking-wider font-mono">
            Transform Code Input
          </span>
          <span className="text-[11px] text-zinc-400 font-mono">
            (Python / NumPy / SciPy / PyTorch / ROS2)
          </span>
        </div>

        {/* Preset Selector Dropdown */}
        <div className="flex items-center space-x-2">
          <label className="text-xs text-zinc-500 flex items-center space-x-1 font-medium">
            <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">Presets:</span>
          </label>
          <select
            value={selectedPresetId}
            onChange={(e) => {
              const p = PRESET_EXAMPLES.find((item) => item.id === e.target.value);
              if (p) onSelectPreset(p);
            }}
            className="text-xs bg-white border border-zinc-300 rounded-md px-2.5 py-1 text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-sans cursor-pointer shadow-2xs"
          >
            <option value="" disabled>
              Select Bug Example / Benchmark...
            </option>
            {PRESET_EXAMPLES.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.title}
              </option>
            ))}
          </select>

          <button
            onClick={() => setCode('')}
            title="Clear editor"
            className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-200/60 rounded-md transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Clickable Example Snippet Chips */}
      <div className="px-4 py-2.5 bg-zinc-100/90 border-b border-zinc-200 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-mono text-zinc-500 font-semibold uppercase tracking-wider mr-1">
          Quick Snippets:
        </span>
        {PRESET_EXAMPLES.slice(0, 3).map((preset) => {
          const isSelected = selectedPresetId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPreset(preset)}
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

      {/* Editor Body with Line Numbers */}
      <div className="flex-1 relative flex min-h-[340px] bg-zinc-950 text-zinc-100 font-mono text-xs overflow-auto">
        {/* Line Numbers */}
        <div className="select-none py-3 px-3 text-right text-zinc-600 bg-zinc-900/60 border-r border-zinc-800 font-mono text-xs min-w-[40px]">
          {lineNumbers.map((num) => (
            <div key={num} className="leading-6">
              {num}
            </div>
          ))}
        </div>

        {/* Code Text Area */}
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste or write rigid-body transform code (Python numpy, SciPy, PyTorch, C++ Eigen, Sophus)..."
          spellCheck={false}
          className="flex-1 w-full p-3 bg-transparent text-zinc-200 font-mono text-xs leading-6 resize-none focus:outline-none focus:ring-0 selection:bg-indigo-900 selection:text-indigo-100 placeholder:text-zinc-600"
        />
      </div>

      {/* Editor Footer Action Bar */}
      <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-200 flex items-center justify-between">
        <div className="text-[11px] text-zinc-500 font-mono flex items-center space-x-2">
          <span>Press</span>
          <kbd className="px-1.5 py-0.5 bg-zinc-200 border border-zinc-300 rounded text-zinc-700 font-semibold text-[10px]">
            ⌘ + Enter
          </kbd>
          <span>or click Analyze</span>
        </div>

        <button
          onClick={onAnalyze}
          disabled={isAnalyzing || !code.trim()}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-xs shadow-sm transition-all ${
            isAnalyzing || !code.trim()
              ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
              : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]'
          }`}
        >
          {isAnalyzing ? (
            <>
              <Sparkles className="w-4 h-4 animate-spin text-indigo-200" />
              <span>Analyzing Frame Graph...</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-white text-white" />
              <span>Analyze Transforms</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
