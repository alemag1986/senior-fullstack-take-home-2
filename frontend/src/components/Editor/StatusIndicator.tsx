import React, { useEffect, useState } from 'react';
import { SupportedLanguage } from '../../hooks/useLanguageDetector';

interface StatusIndicatorProps {
  wordCount: number;
  language: SupportedLanguage;
  isAutoDetected: boolean;
  isDirty: boolean;
  isStale: boolean;
  isLoading: boolean;
  error?: string | null;
  isMock?: boolean;
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  onReview: () => void;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  wordCount,
  language,
  isAutoDetected,
  isDirty,
  isStale,
  isLoading,
  error,
  isMock,
  onOpenSettings,
  onOpenHelp,
  onReview,
}) => {
  const [isVisible, setIsVisible] = useState(true);

  // Mouse activity restores visibility
  useEffect(() => {
    let fadeTimeout: NodeJS.Timeout;

    const handleActivity = () => {
      setIsVisible(true);
      clearTimeout(fadeTimeout);
      fadeTimeout = setTimeout(() => {
        setIsVisible(false);
      }, 4000);
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);

    return () => {
      clearTimeout(fadeTimeout);
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, []);

  return (
    <div
      data-testid="status-indicator"
      className={`fixed bottom-5 right-6 z-40 transition-opacity duration-500 font-mono text-xs flex flex-col items-end gap-2 select-none ${
        isVisible || isStale || isLoading || error ? 'opacity-100' : 'opacity-25 hover:opacity-100'
      }`}
    >
      {/* Stale notice */}
      {isStale && (
        <div
          data-testid="stale-notice"
          className="px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/80 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 shadow-sm flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2"
        >
          <span>Your writing changed.</span>
          <button
            type="button"
            onClick={onReview}
            className="underline font-semibold hover:text-amber-950 dark:hover:text-amber-100"
          >
            Review again (Ctrl+Enter)
          </button>
        </div>
      )}

      {/* Error notice */}
      {error && (
        <div
          data-testid="error-notice"
          className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200 shadow-sm flex items-center gap-2"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={onReview}
            className="underline font-semibold hover:text-rose-950 dark:hover:text-rose-100"
          >
            Retry
          </button>
        </div>
      )}

      {/* Bottom control pill */}
      <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-zinc-100/90 dark:bg-zinc-900/90 backdrop-blur-md border border-zinc-200/80 dark:border-zinc-800/80 text-zinc-600 dark:text-zinc-400 shadow-sm">
        {/* Loading spinner */}
        {isLoading && (
          <span className="flex items-center gap-1.5 text-blue-500 font-medium">
            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Reviewing...
          </span>
        )}

        {/* Demo feedback tag */}
        {isMock && !isLoading && (
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
            Demo
          </span>
        )}

        {/* Word count */}
        <span>{wordCount} {wordCount === 1 ? 'word' : 'words'}</span>

        <span className="text-zinc-300 dark:text-zinc-700">•</span>

        {/* Language button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
          title={isAutoDetected ? 'Language auto-detected' : 'Language manually chosen'}
        >
          <span>{language.flag}</span>
          <span className="uppercase">{language.code}</span>
          {isAutoDetected && <span className="text-[10px] opacity-60">auto</span>}
        </button>

        <span className="text-zinc-300 dark:text-zinc-700">•</span>

        {/* Save status */}
        <span className={isDirty ? 'text-amber-500' : 'text-zinc-400'}>
          {isDirty ? 'Unsaved' : 'Saved'}
        </span>

        <span className="text-zinc-300 dark:text-zinc-700">•</span>

        {/* Help button */}
        <button
          type="button"
          onClick={onOpenHelp}
          className="hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors opacity-70 hover:opacity-100"
          title="Keyboard shortcuts (Ctrl+/)"
        >
          ?
        </button>
      </div>
    </div>
  );
};
