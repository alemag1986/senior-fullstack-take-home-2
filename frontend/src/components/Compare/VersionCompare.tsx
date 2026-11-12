import React, { useMemo } from 'react';
import { ActiveSuggestion, DiffPart } from '../../types/journal';
import { computeWordDiff, deriveProposedText } from '../../utils/diffUtils';

interface VersionCompareProps {
  currentText: string;
  activeSuggestions: ActiveSuggestion[];
  isStale: boolean;
  onClose: () => void;
}

export const VersionCompare: React.FC<VersionCompareProps> = ({
  currentText,
  activeSuggestions,
  isStale,
  onClose,
}) => {
  // Derive corrected version by applying pending valid suggestions right-to-left
  const proposedText = useMemo(() => {
    return deriveProposedText(currentText, activeSuggestions);
  }, [currentText, activeSuggestions]);

  // Compute word-level diff
  const diffParts = useMemo(() => {
    return computeWordDiff(currentText, proposedText);
  }, [currentText, proposedText]);

  if (isStale) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
        <div className="w-full max-w-md p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl text-center">
          <h3 className="text-base font-semibold mb-2">Version Comparison Disabled</h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
            Your writing changed since the last review. Review again to compare updated versions.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-label="Version Comparison"
      className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-zinc-950 font-mono text-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 select-none">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-base tracking-tight text-zinc-900 dark:text-zinc-100">
            Version Comparison
          </h2>
          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
            Word-level Diff
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1 text-xs rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          Close <kbd className="ml-1 opacity-60">Esc</kbd>
        </button>
      </div>

      {/* Side-by-side or stacked panels */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-200 dark:divide-zinc-800 overflow-y-auto">
        {/* Left: Current Draft */}
        <div className="p-6 md:p-8 overflow-y-auto">
          <div className="text-xs uppercase tracking-wider font-semibold text-zinc-400 mb-4 select-none">
            Current Draft
          </div>
          <div className="whitespace-pre-wrap leading-relaxed text-zinc-800 dark:text-zinc-200">
            {currentText}
          </div>
        </div>

        {/* Right: Proposed Corrected Version with Diff Highlighting */}
        <div className="p-6 md:p-8 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-900/30">
          <div className="text-xs uppercase tracking-wider font-semibold text-zinc-400 mb-4 select-none">
            Proposed Corrected Version
          </div>
          <div className="whitespace-pre-wrap leading-relaxed text-zinc-800 dark:text-zinc-200">
            {diffParts.map((part: DiffPart, idx: number) => {
              if (part.type === 'delete') {
                return (
                  <span
                    key={idx}
                    className="bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 line-through px-0.5 rounded"
                  >
                    {part.value}
                  </span>
                );
              }
              if (part.type === 'insert') {
                return (
                  <span
                    key={idx}
                    className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold px-0.5 rounded"
                  >
                    {part.value}
                  </span>
                );
              }
              return <span key={idx}>{part.value}</span>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
