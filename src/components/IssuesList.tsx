import React from 'react';
import { IssueDetected } from '../types';
import { ShieldAlert, AlertCircle, Info, Check, Copy, Wrench, Sparkles } from 'lucide-react';

interface IssuesListProps {
  issues: IssueDetected[];
  onApplyFix?: (suggestedFix: string, lineRef: number) => void;
}

export const IssuesList: React.FC<IssuesListProps> = ({ issues, onApplyFix }) => {
  const [copiedIdx, setCopiedIdx] = React.useState<number | null>(null);

  if (!issues || issues.length === 0) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 text-center text-emerald-900 font-sans">
        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
          <Check className="w-6 h-6 text-emerald-600" />
        </div>
        <h3 className="font-semibold text-sm text-emerald-900 mb-1">
          No Rigid-Body Transform Bugs Found
        </h3>
        <p className="text-xs text-emerald-700 max-w-md mx-auto">
          Frame compositions are mathematically consistent, quaternions maintain normalization, and frame conventions match expected representations.
        </p>
      </div>
    );
  }

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-zinc-800 uppercase tracking-wider font-mono flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>Senior PR Reviewer Findings ({issues.length})</span>
        </h3>
      </div>

      <div className="space-y-3.5">
        {issues.map((issue, idx) => {
          const isHigh = issue.severity === 'high';
          const isMedium = issue.severity === 'medium';

          return (
            <div
              key={idx}
              className={`rounded-xl border p-4 shadow-sm transition-all ${
                isHigh
                  ? 'bg-rose-50/50 border-rose-200/90'
                  : isMedium
                  ? 'bg-amber-50/50 border-amber-200/90'
                  : 'bg-zinc-50 border-zinc-200'
              }`}
            >
              {/* Header: Severity, Category, Line, Confidence */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      isHigh
                        ? 'bg-rose-600 text-white'
                        : isMedium
                        ? 'bg-amber-600 text-white'
                        : 'bg-zinc-700 text-white'
                    }`}
                  >
                    {issue.severity} Severity
                  </span>

                  <span className="px-2 py-0.5 rounded bg-white text-zinc-800 border border-zinc-300 font-mono text-[11px] font-semibold">
                    Line #{issue.line_ref}
                  </span>

                  <span className="px-2 py-0.5 rounded bg-zinc-200/70 text-zinc-700 font-mono text-[11px]">
                    {issue.category}
                  </span>
                </div>

                {/* Confidence Meter */}
                <div className="flex items-center space-x-1.5 text-xs font-mono text-zinc-600 bg-white/80 px-2.5 py-0.5 rounded border border-zinc-200">
                  <span className="text-[10px] uppercase text-zinc-400 font-sans font-medium">
                    Confidence:
                  </span>
                  <span className="font-bold text-zinc-900">
                    {(issue.confidence * 100).toFixed(0)}%
                  </span>
                  <div className="w-12 h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        issue.confidence >= 0.8
                          ? 'bg-emerald-500'
                          : issue.confidence >= 0.5
                          ? 'bg-amber-500'
                          : 'bg-zinc-400'
                      }`}
                      style={{ width: `${issue.confidence * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Description comment */}
              <p className="text-xs text-zinc-800 leading-relaxed font-sans font-normal mb-3">
                {issue.description}
              </p>

              {/* Code Fix Box */}
              {issue.suggested_fix && (
                <div className="bg-zinc-900 text-zinc-100 rounded-lg p-3 font-mono text-xs border border-zinc-800">
                  <div className="flex items-center justify-between mb-1.5 text-[10px] text-zinc-400 uppercase tracking-wider font-sans border-b border-zinc-800 pb-1">
                    <span className="flex items-center space-x-1 font-semibold text-emerald-400">
                      <Wrench className="w-3 h-3" />
                      <span>Suggested Fix</span>
                    </span>

                    <button
                      onClick={() => handleCopy(issue.suggested_fix, idx)}
                      className="flex items-center space-x-1 text-zinc-400 hover:text-white transition-colors"
                    >
                      {copiedIdx === idx ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>

                  <pre className="overflow-x-auto text-emerald-300 font-mono text-xs whitespace-pre-wrap leading-5">
                    {issue.suggested_fix}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
