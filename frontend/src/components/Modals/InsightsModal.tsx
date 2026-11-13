import React, { useEffect, useState } from 'react';
import { JournalApiClient } from '../../api/client';
import { InsightsData } from '../../types/journal';
import { ModalBackdrop } from '../Common/ModalBackdrop';

interface InsightsModalProps {
  apiClient: JournalApiClient;
  onClose: () => void;
}

export const InsightsModal: React.FC<InsightsModalProps> = ({ apiClient, onClose }) => {
  const [data, setData] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    apiClient.fetchInsights().then((res) => {
      if (mounted) {
        setData(res);
        setLoading(false);
      }
    });
    return () => {
      mounted = false;
    };
  }, [apiClient]);

  const categoryLabels: Record<string, string> = {
    grammar_syntax: 'Grammar & Syntax',
    vocabulary_phrasing: 'Vocabulary & Phrasing',
    spelling_accents: 'Spelling & Accents',
  };

  return (
    <ModalBackdrop onClose={onClose} title="Learning Insights & Mistake Trends">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <div>
          <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100">
            Learning Insights
          </h3>
          <p className="text-xs text-zinc-400">Mistake patterns & improvement trends</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          Esc
        </button>
      </div>

      <div className="max-h-[75vh] overflow-y-auto p-6 space-y-6 text-sm">
        {loading ? (
          <div className="py-12 text-center text-zinc-400 font-mono text-xs">
            Loading insights...
          </div>
        ) : !data || data.totalEntries === 0 ? (
          <div className="py-12 text-center text-zinc-400">
            <p className="font-medium text-zinc-600 dark:text-zinc-300 mb-1">
              No journal history yet
            </p>
            <p className="text-xs">
              Write journal entries and review feedback to start tracking your mistake patterns!
            </p>
          </div>
        ) : (
          <>
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-100 dark:border-zinc-800">
                <span className="text-[11px] text-zinc-400 font-mono uppercase">Entries</span>
                <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
                  {data.totalEntries}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-100 dark:border-zinc-800">
                <span className="text-[11px] text-zinc-400 font-mono uppercase">Words Written</span>
                <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
                  {data.totalWords}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-100 dark:border-zinc-800">
                <span className="text-[11px] text-zinc-400 font-mono uppercase">Corrections</span>
                <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400 mt-1">
                  {data.acceptedDecisions}
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-100 dark:border-zinc-800">
                <span className="text-[11px] text-zinc-400 font-mono uppercase">Total Issues</span>
                <p className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-1">
                  {data.totalSuggestions}
                </p>
              </div>
            </div>

            {/* Category Breakdown */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 font-mono">
                Mistake Categories
              </h4>
              <div className="space-y-2.5">
                {data.categoryBreakdown.map((cat) => (
                  <div key={cat.category} className="space-y-1">
                    <div className="flex justify-between text-xs font-medium">
                      <span className="text-zinc-700 dark:text-zinc-300">
                        {categoryLabels[cat.category] || cat.category}
                      </span>
                      <span className="text-zinc-400 font-mono">
                        {cat.count} ({cat.percentage}%)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(100, cat.percentage)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Common Repeated Mistakes */}
            {data.topMistakes.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 font-mono">
                  Most Frequent Patterns
                </h4>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-100 dark:border-zinc-800 rounded-xl overflow-hidden">
                  {data.topMistakes.map((m, idx) => (
                    <div
                      key={m.ruleCode}
                      className="p-3 flex items-center justify-between text-xs bg-zinc-50/50 dark:bg-zinc-900/50"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-[10px] flex items-center justify-center font-mono font-semibold text-zinc-600 dark:text-zinc-300">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-medium text-zinc-800 dark:text-zinc-200">
                            {m.sampleExplanation}
                          </p>
                          <p className="text-[11px] text-zinc-400 font-mono">{m.ruleCode}</p>
                        </div>
                      </div>
                      <span className="font-mono font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                        {m.count} {m.count === 1 ? 'time' : 'times'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Improvement Trends */}
            {data.recentTrends.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 font-mono">
                  Activity & Trend
                </h4>
                <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-850/60 border border-zinc-100 dark:border-zinc-800 space-y-2">
                  <div className="grid grid-cols-3 text-[11px] font-mono text-zinc-400 pb-1 border-b border-zinc-200/60 dark:border-zinc-800">
                    <span>Date</span>
                    <span className="text-center">Entries</span>
                    <span className="text-right">Issues Found</span>
                  </div>
                  {data.recentTrends.map((t) => (
                    <div
                      key={t.date}
                      className="grid grid-cols-3 text-xs font-mono text-zinc-700 dark:text-zinc-300 py-1"
                    >
                      <span>{t.date}</span>
                      <span className="text-center">{t.entriesCount}</span>
                      <span className="text-right font-semibold text-zinc-900 dark:text-zinc-100">
                        {t.mistakesCount}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </ModalBackdrop>
  );
};
