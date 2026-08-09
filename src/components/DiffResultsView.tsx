import React, { useState } from 'react';
import { DiffAnalysis, DiffIssueItem } from '../types';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Wrench,
  Copy,
  Check,
  Info,
  FileDown,
} from 'lucide-react';

interface DiffResultsViewProps {
  diffAnalysis: DiffAnalysis;
  onExportPDF?: () => void;
}

export const DiffResultsView: React.FC<DiffResultsViewProps> = ({ diffAnalysis, onExportPDF }) => {
  const [showIntroduced, setShowIntroduced] = useState(true);
  const [showFixed, setShowFixed] = useState(true);
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<string | null>(null);

  const {
    classification,
    one_line_verdict,
    issues_fixed = [],
    issues_introduced = [],
    issues_unchanged = [],
    no_semantic_impact_changes = [],
  } = diffAnalysis;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(id);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const getBadgeStyle = () => {
    switch (classification) {
      case 'introduces_issue':
        return {
          bg: 'bg-rose-600 text-white',
          border: 'border-rose-300 bg-rose-50/80 text-rose-950',
          label: 'INTRODUCES ISSUE',
          icon: <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />,
        };
      case 'fixes_issue':
        return {
          bg: 'bg-emerald-600 text-white',
          border: 'border-emerald-300 bg-emerald-50/80 text-emerald-950',
          label: 'FIXES ISSUE',
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
        };
      case 'unclear':
        return {
          bg: 'bg-amber-600 text-white',
          border: 'border-amber-300 bg-amber-50/80 text-amber-950',
          label: 'NEEDS DOMAIN VERIFICATION',
          icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
        };
      case 'neutral':
      default:
        return {
          bg: 'bg-zinc-600 text-white',
          border: 'border-zinc-300 bg-zinc-50/80 text-zinc-900',
          label: 'NEUTRAL',
          icon: <HelpCircle className="w-5 h-5 text-zinc-500 shrink-0" />,
        };
    }
  };

  const badgeInfo = getBadgeStyle();

  const renderIssueCard = (issue: DiffIssueItem, index: number, sectionKey: string) => {
    const isHigh = issue.severity === 'high';
    const isMedium = issue.severity === 'medium';
    const copyKey = `${sectionKey}-${index}`;

    return (
      <div
        key={copyKey}
        className={`rounded-xl border p-4 shadow-sm transition-all ${
          isHigh
            ? 'bg-rose-50/40 border-rose-200'
            : isMedium
            ? 'bg-amber-50/40 border-amber-200'
            : 'bg-zinc-50 border-zinc-200'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
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

          <div className="flex items-center space-x-1.5 text-xs font-mono text-zinc-600 bg-white/80 px-2.5 py-0.5 rounded border border-zinc-200">
            <span className="text-[10px] uppercase text-zinc-400 font-sans font-medium">
              Confidence:
            </span>
            <span className="font-bold text-zinc-900">
              {(issue.confidence * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        <p className="text-xs text-zinc-800 leading-relaxed font-sans mb-3 font-normal">
          {issue.description}
        </p>

        {issue.suggested_fix && (
          <div className="bg-zinc-900 text-zinc-100 rounded-lg p-3 font-mono text-xs border border-zinc-800">
            <div className="flex items-center justify-between mb-1.5 text-[10px] text-zinc-400 uppercase tracking-wider font-sans border-b border-zinc-800 pb-1">
              <span className="flex items-center space-x-1 font-semibold text-emerald-400">
                <Wrench className="w-3 h-3" />
                <span>Suggested Fix</span>
              </span>

              <button
                onClick={() => handleCopy(issue.suggested_fix, copyKey)}
                className="flex items-center space-x-1 text-zinc-400 hover:text-white transition-colors"
              >
                {copiedIdx === copyKey ? (
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
  };

  return (
    <div className="space-y-6">
      {/* Prominent PR Verdict Header */}
      <div className={`p-5 rounded-xl border flex flex-wrap items-start justify-between gap-3 shadow-sm ${badgeInfo.border}`}>
        <div className="flex items-start space-x-3 flex-1 min-w-0">
          {badgeInfo.icon}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider font-mono ${badgeInfo.bg}`}
              >
                {badgeInfo.label}
              </span>
              <span className="text-xs font-mono text-zinc-500 font-semibold uppercase tracking-wider">
                PR Diff Verdict
              </span>
            </div>

            <h2 className="text-base sm:text-lg font-bold font-sans text-zinc-900 leading-snug">
              {one_line_verdict}
            </h2>
          </div>
        </div>
      </div>

      {/* Collapsible Section 1: Issues Introduced (Red Accent) */}
      <div className="border border-rose-200 bg-rose-50/20 rounded-xl overflow-hidden shadow-2xs">
        <button
          onClick={() => setShowIntroduced(!showIntroduced)}
          className="w-full px-4 py-3 bg-rose-100/50 hover:bg-rose-100/80 border-b border-rose-200/80 flex items-center justify-between text-left transition-colors"
        >
          <div className="flex items-center space-x-2">
            {showIntroduced ? (
              <ChevronDown className="w-4 h-4 text-rose-700" />
            ) : (
              <ChevronRight className="w-4 h-4 text-rose-700" />
            )}
            <span className="font-bold text-xs uppercase tracking-wider font-mono text-rose-900">
              Issues Introduced ({issues_introduced.length})
            </span>
          </div>

          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-rose-600 text-white">
            {issues_introduced.length === 0 ? 'None Introduced' : 'Requires Attention'}
          </span>
        </button>

        {showIntroduced && (
          <div className="p-4 space-y-3">
            {issues_introduced.length === 0 ? (
              <p className="text-xs text-zinc-600 font-mono italic">
                No new transform or frame issues were introduced by this change.
              </p>
            ) : (
              issues_introduced.map((issue, idx) => renderIssueCard(issue, idx, 'introduced'))
            )}
          </div>
        )}
      </div>

      {/* Collapsible Section 2: Issues Fixed (Green Accent) */}
      <div className="border border-emerald-200 bg-emerald-50/20 rounded-xl overflow-hidden shadow-2xs">
        <button
          onClick={() => setShowFixed(!showFixed)}
          className="w-full px-4 py-3 bg-emerald-100/50 hover:bg-emerald-100/80 border-b border-emerald-200/80 flex items-center justify-between text-left transition-colors"
        >
          <div className="flex items-center space-x-2">
            {showFixed ? (
              <ChevronDown className="w-4 h-4 text-emerald-700" />
            ) : (
              <ChevronRight className="w-4 h-4 text-emerald-700" />
            )}
            <span className="font-bold text-xs uppercase tracking-wider font-mono text-emerald-900">
              Issues Fixed ({issues_fixed.length})
            </span>
          </div>

          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-600 text-white">
            {issues_fixed.length} Resolved
          </span>
        </button>

        {showFixed && (
          <div className="p-4 space-y-3">
            {issues_fixed.length === 0 ? (
              <p className="text-xs text-zinc-600 font-mono italic">
                No prior issues were resolved in this change.
              </p>
            ) : (
              issues_fixed.map((issue, idx) => renderIssueCard(issue, idx, 'fixed'))
            )}
          </div>
        )}
      </div>

      {/* Collapsible Section 3: Issues Unchanged (Gray Accent) */}
      <div className="border border-zinc-200 bg-zinc-50/50 rounded-xl overflow-hidden shadow-2xs">
        <button
          onClick={() => setShowUnchanged(!showUnchanged)}
          className="w-full px-4 py-3 bg-zinc-100 hover:bg-zinc-200/60 border-b border-zinc-200 flex items-center justify-between text-left transition-colors"
        >
          <div className="flex items-center space-x-2">
            {showUnchanged ? (
              <ChevronDown className="w-4 h-4 text-zinc-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-zinc-600" />
            )}
            <span className="font-bold text-xs uppercase tracking-wider font-mono text-zinc-800">
              Issues Unchanged ({issues_unchanged.length})
            </span>
          </div>

          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold font-mono bg-zinc-200 text-zinc-700">
            {issues_unchanged.length} Persistent
          </span>
        </button>

        {showUnchanged && (
          <div className="p-4 space-y-3">
            {issues_unchanged.length === 0 ? (
              <p className="text-xs text-zinc-500 font-mono italic">
                No lingering or unchanged issues detected.
              </p>
            ) : (
              issues_unchanged.map((issue, idx) => renderIssueCard(issue, idx, 'unchanged'))
            )}
          </div>
        )}
      </div>

      {/* Non-semantic changes note */}
      {no_semantic_impact_changes && no_semantic_impact_changes.length > 0 && (
        <div className="p-3 bg-zinc-100 border border-zinc-200 rounded-lg text-xs font-mono text-zinc-600 flex items-start space-x-2">
          <Info className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-zinc-700">Non-semantic changes noted: </span>
            <span>{no_semantic_impact_changes.join(' • ')}</span>
          </div>
        </div>
      )}
    </div>
  );
};
