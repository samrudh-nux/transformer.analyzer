import React from 'react';
import { TransformDetected } from '../types';
import { Network, Tag, Sparkles, ArrowRightLeft } from 'lucide-react';

interface TransformsTableProps {
  transforms: TransformDetected[];
}

export const TransformsTable: React.FC<TransformsTableProps> = ({ transforms }) => {
  if (!transforms || transforms.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-zinc-200 p-6 text-center text-zinc-500 text-xs font-mono">
        No rotation or rigid transform variables detected in snippet.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Network className="w-4 h-4 text-indigo-600" />
          <span className="text-xs font-semibold text-zinc-800 uppercase tracking-wider font-mono">
            Detected Transform Variables
          </span>
        </div>
        <span className="text-[11px] font-mono text-zinc-500">
          {transforms.length} Found
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-zinc-100/70 border-b border-zinc-200 text-zinc-600 font-semibold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="py-2.5 px-4">Line</th>
              <th className="py-2.5 px-4">Variable Name</th>
              <th className="py-2.5 px-4">Representation</th>
              <th className="py-2.5 px-4">Inferred Frame (from → to)</th>
              <th className="py-2.5 px-4">Assumed Convention</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200/80">
            {transforms.map((t, idx) => {
              const isInferred = t.inferred_frame?.inferred === true;
              return (
                <tr key={idx} className="hover:bg-zinc-50/80 transition-colors">
                  <td className="py-2.5 px-4 text-zinc-400 font-bold">
                    #{t.line_ref}
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-zinc-900">
                    <code className="px-1.5 py-0.5 rounded bg-zinc-100 border border-zinc-200 text-indigo-700">
                      {t.variable_name}
                    </code>
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-200 text-zinc-800 border border-zinc-300">
                      {t.representation}
                    </span>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="flex items-center space-x-1.5 flex-wrap gap-1">
                      <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-200 font-semibold">
                        {t.inferred_frame.from || 'Unknown'}
                      </span>
                      <ArrowRightLeft className="w-3 h-3 text-zinc-400" />
                      <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-800 border border-zinc-200 font-semibold">
                        {t.inferred_frame.to || 'Unknown'}
                      </span>
                      {isInferred && (
                        <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-sans font-semibold">
                          <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                          <span>inferred</span>
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-4 text-zinc-600 italic">
                    {t.inferred_convention || 'Explicit in code / N/A'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

