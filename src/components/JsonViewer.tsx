import React, { useState } from 'react';
import { AnalysisResult } from '../types';
import { Copy, Check, Download, FileCode } from 'lucide-react';

interface JsonViewerProps {
  result: AnalysisResult;
}

export const JsonViewer: React.FC<JsonViewerProps> = ({ result }) => {
  const [copied, setCopied] = useState(false);
  const jsonString = JSON.stringify(result, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transform-analysis.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-zinc-950 text-zinc-100 rounded-xl border border-zinc-800 shadow-sm overflow-hidden font-mono text-xs">
      <div className="px-4 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <FileCode className="w-4 h-4 text-indigo-400" />
          <span className="font-semibold text-zinc-200">
            Raw Analysis JSON Schema Output
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleCopy}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors text-xs"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownload}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-colors text-xs font-semibold"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>

      <pre className="p-4 overflow-auto max-h-[500px] text-zinc-300 leading-5">
        {jsonString}
      </pre>
    </div>
  );
};
