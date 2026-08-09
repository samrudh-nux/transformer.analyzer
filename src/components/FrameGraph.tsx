import React from 'react';
import { CompositionStep, IssueDetected } from '../types';
import { ArrowRight, CheckCircle2, AlertCircle, Layers } from 'lucide-react';

interface FrameGraphProps {
  compositionSteps: CompositionStep[];
  issues?: IssueDetected[];
}

export const FrameGraph: React.FC<FrameGraphProps> = ({ compositionSteps, issues = [] }) => {
  if (!compositionSteps || compositionSteps.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 p-6 text-center text-zinc-500 text-xs font-mono">
        No frame composition steps detected in code snippet.
      </div>
    );
  }

  const issueLineRefs = new Set(issues.map((i) => i.line_ref));

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-semibold text-zinc-800 uppercase tracking-wider font-mono">
            Frame Composition Pipeline
          </span>
        </div>
        <span className="text-[11px] font-mono text-zinc-500">
          {compositionSteps.length} Step{compositionSteps.length > 1 ? 's' : ''}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {compositionSteps.map((step) => {
          const isOk = step.frame_chain_consistent;
          const hasMatchingIssue = issueLineRefs.has(step.line_ref) || !isOk;

          return (
            <div
              key={step.step}
              className={`p-3.5 rounded-lg border text-xs font-mono transition-all ${
                hasMatchingIssue
                  ? 'bg-rose-50/60 border-rose-300 border-l-4 border-l-rose-500 text-rose-950'
                  : 'bg-emerald-50/40 border-emerald-200/80 border-l-4 border-l-emerald-500 text-emerald-950'
              }`}
            >
              {/* Header row */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                      hasMatchingIssue ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                    }`}
                  >
                    {step.step}
                  </span>
                  <span className="font-semibold text-zinc-800">
                    Line {step.line_ref}:
                  </span>
                  <code className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-900 border border-zinc-200 font-semibold">
                    {step.operation}
                  </code>
                </div>

                <div className="flex items-center space-x-1.5">
                  {!hasMatchingIssue ? (
                    <span className="flex items-center space-x-1 text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Consistent Chain</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1 text-rose-800 bg-rose-100 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                      <span>Issue / Chain Warning</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Visual Node Flow */}
              <div className="flex items-center space-x-3 bg-white/80 p-2.5 rounded border border-zinc-200/80 overflow-x-auto">
                <div className="flex items-center space-x-2">
                  <span className="px-2.5 py-1 rounded-md bg-zinc-900 text-white font-mono text-[11px] font-semibold">
                    {step.resulting_frame.from || 'Unknown'}
                  </span>
                  <ArrowRight className="w-4 h-4 text-zinc-400" />
                  <span className="px-2.5 py-1 rounded-md bg-indigo-600 text-white font-mono text-[11px] font-semibold">
                    {step.resulting_frame.to || 'Unknown'}
                  </span>
                </div>

                {hasMatchingIssue && (
                  <div className="text-[11px] text-rose-800 font-sans font-medium italic border-l border-rose-300 pl-3">
                    Warning: Step corresponds to detected issue or chain mismatch.
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

