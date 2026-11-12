import React, { useState } from 'react';
import { LanguageDetectorAvailability, SupportedLanguage } from '../../hooks/useLanguageDetector';
import { ThemeMode } from '../../types/journal';
import { ModalBackdrop } from '../Common/ModalBackdrop';

interface ThemeModalProps {
  theme: ThemeMode;
  onSetTheme: (theme: ThemeMode) => void;
  activeLanguageCode: string;
  detectedCode: string;
  detectionEngine?: 'native-api' | 'fallback';
  detectorAvailability?: LanguageDetectorAvailability;
  downloadProgress?: number | null;
  nativeConfidence?: number | null;
  onActivateNativeDetector?: () => void;
  isManualOverride: boolean;
  supportedLanguages: SupportedLanguage[];
  onSelectLanguage: (code: string) => void;
  onResetAutoDetect: () => void;
  sessionGuid: string;
  onUpdateSessionGuid: (guid: string) => boolean;
  onClose: () => void;
}

export const ThemeModal: React.FC<ThemeModalProps> = ({
  theme,
  onSetTheme,
  activeLanguageCode,
  detectedCode,
  detectionEngine = 'fallback',
  detectorAvailability = 'unsupported',
  downloadProgress = null,
  nativeConfidence = null,
  onActivateNativeDetector,
  isManualOverride,
  supportedLanguages,
  onSelectLanguage,
  onResetAutoDetect,
  sessionGuid,
  onUpdateSessionGuid,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [customGuid, setCustomGuid] = useState('');
  const [guidError, setGuidError] = useState<string | null>(null);
  const [guidSuccess, setGuidSuccess] = useState(false);

  const handleCopyGuid = () => {
    navigator.clipboard.writeText(sessionGuid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyCustomGuid = (e: React.FormEvent) => {
    e.preventDefault();
    setGuidError(null);
    setGuidSuccess(false);

    const valid = onUpdateSessionGuid(customGuid);
    if (valid) {
      setGuidSuccess(true);
      setTimeout(() => setGuidSuccess(false), 2500);
    } else {
      setGuidError('Invalid UUID format. Expected format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
    }
  };

  const detectedLangObj = supportedLanguages.find((l) => l.code === detectedCode) || supportedLanguages[0];

  return (
    <ModalBackdrop onClose={onClose} title="Screen & Session Options">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
        <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100">
          Screen & Session Settings
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-1 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          Esc
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* 1. Theme Selection */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2.5">
            Display Theme
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => onSetTheme('light')}
              className={`p-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                theme === 'light'
                  ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800 ring-2 ring-zinc-900/10'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-white border border-zinc-300 shadow-sm" />
              <span>Light</span>
            </button>

            <button
              type="button"
              onClick={() => onSetTheme('dark')}
              className={`p-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                theme === 'dark'
                  ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800 ring-2 ring-zinc-900/10'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-zinc-900 border border-zinc-700 shadow-sm" />
              <span>Dark</span>
            </button>

            <button
              type="button"
              onClick={() => onSetTheme('sepia')}
              className={`p-3 rounded-xl border text-xs font-medium flex flex-col items-center gap-1.5 transition-all ${
                theme === 'sepia'
                  ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-50 dark:bg-zinc-800 ring-2 ring-zinc-900/10'
                  : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-[#f7f4eb] border border-[#d5cdb7] shadow-sm" />
              <span>Warm Sepia</span>
            </button>
          </div>
        </div>

        {/* 2. Target Language & Auto-Detection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Target Language
            </label>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-zinc-500">Auto-detected:</span>
              <span className="font-medium text-zinc-800 dark:text-zinc-200">
                {detectedLangObj.flag} {detectedLangObj.name}
              </span>
              {detectionEngine === 'native-api' && nativeConfidence !== null && (
                <span
                  data-testid="native-detector-badge"
                  className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-mono"
                >
                  Web AI {Math.round(nativeConfidence * 100)}%
                </span>
              )}
              {isManualOverride && (
                <button
                  type="button"
                  onClick={onResetAutoDetect}
                  className="ml-1 text-[11px] underline text-blue-500 hover:text-blue-600"
                >
                  (Reset to auto)
                </button>
              )}
            </div>
          </div>

          <select
            data-testid="language-select"
            value={activeLanguageCode}
            onChange={(e) => onSelectLanguage(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/60 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 font-mono"
          >
            {supportedLanguages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.name} ({lang.code.toUpperCase()})
                {!isManualOverride && lang.code === detectedCode ? ' — [Auto-detected]' : ''}
              </option>
            ))}
          </select>

          {/* Built-in Browser LanguageDetector API Status & User-Gesture Model Activation */}
          <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-400">
            <span>
              Engine:{' '}
              {detectionEngine === 'native-api'
                ? 'Browser LanguageDetector API'
                : detectorAvailability === 'available'
                ? 'Browser LanguageDetector API (ready — write 3+ words)'
                : 'Heuristic fallback'}
            </span>
            {detectorAvailability === 'downloadable' && onActivateNativeDetector && (
              <button
                type="button"
                data-testid="download-detector-btn"
                onClick={onActivateNativeDetector}
                className="underline text-blue-500 hover:text-blue-600 font-medium"
              >
                Download on-device LanguageDetector model
              </button>
            )}
            {detectorAvailability === 'downloading' && (
              <span data-testid="downloading-detector-status" className="text-blue-500">
                Downloading AI model{downloadProgress !== null ? ` (${downloadProgress}%)` : '...'}
              </span>
            )}
          </div>
        </div>

        {/* 3. Session GUID & Traceability */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
          <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
            Browser Session GUID (Traceability)
          </label>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 leading-relaxed">
            Unique identifier stored in browser data for session traceability. You can copy it to back up your session or paste an existing GUID to restore a previous session.
          </p>

          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              readOnly
              value={sessionGuid}
              data-testid="session-guid-display"
              className="flex-1 px-3 py-1.5 font-mono text-xs rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 select-all"
            />
            <button
              type="button"
              onClick={handleCopyGuid}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Form to enter / restore existing GUID */}
          <form onSubmit={handleApplyCustomGuid} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Paste an existing GUID to restore..."
                value={customGuid}
                onChange={(e) => setCustomGuid(e.target.value)}
                className="flex-1 px-3 py-1.5 font-mono text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:opacity-90"
              >
                Restore
              </button>
            </div>
            {guidError && (
              <p className="text-[11px] text-rose-500 mt-0.5">{guidError}</p>
            )}
            {guidSuccess && (
              <p className="text-[11px] text-emerald-500 mt-0.5">Session GUID updated successfully!</p>
            )}
          </form>
        </div>
      </div>
    </ModalBackdrop>
  );
};
