import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export interface SupportedLanguage {
  code: string;
  name: string;
  flag: string;
}

export type LanguageDetectorAvailability =
  | 'available'
  | 'downloadable'
  | 'downloading'
  | 'unavailable'
  | 'unsupported';

export interface LanguageDetectionResult {
  detectedLanguage: string;
  confidence: number;
}

export interface LanguageDetectorMonitorEvent extends Event {
  loaded: number;
  total?: number;
}

export interface LanguageDetectorMonitor {
  addEventListener(
    type: 'downloadprogress',
    listener: (event: LanguageDetectorMonitorEvent) => void
  ): void;
}

export interface LanguageDetectorCreateOptions {
  monitor?: (monitor: LanguageDetectorMonitor) => void;
  signal?: AbortSignal;
}

export interface LanguageDetectorInstance {
  detect(input: string, options?: { signal?: AbortSignal }): Promise<LanguageDetectionResult[]>;
  destroy?: () => void;
}

export interface LanguageDetectorStatic {
  availability(): Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>;
  create(options?: LanguageDetectorCreateOptions): Promise<LanguageDetectorInstance>;
}

declare global {
  interface Window {
    LanguageDetector?: LanguageDetectorStatic;
  }
  var LanguageDetector: LanguageDetectorStatic | undefined;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
];

const SUPPORTED_CODES = new Set(SUPPORTED_LANGUAGES.map((l) => l.code));

// Minimum text length and word count before invoking the built-in AI LanguageDetector.detect(),
// since accuracy drops significantly on single words or very short phrases.
const MIN_CHARS_FOR_NATIVE_DETECT = 15;
const MIN_WORDS_FOR_NATIVE_DETECT = 3;

/**
 * Lightweight heuristic language detector used as a fallback when the Web
 * LanguageDetector API is unsupported, unavailable, or text is too short.
 */
export function detectLanguage(text: string): string {
  if (!text || text.trim().length < 5) return 'es';

  // Japanese Kanji/Hiragana/Katakana
  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text)) {
    return 'ja';
  }

  const lower = text.toLowerCase();

  const countMatches = (regex: RegExp) => (lower.match(regex) || []).length;

  const scores: Record<string, number> = {
    es:
      countMatches(/[¿¡ñ]/g) * 3 +
      countMatches(/[áéíóú]/g) +
      countMatches(/\b(el|los|las|una|hoy|pero|ayer|con|para|por|fui|muy|estoy|tengo)\b/g) * 2,
    fr:
      countMatches(/[çœæèêëàâîïôùû]/g) * 2 +
      countMatches(/\b(le|les|une|avec|dans|pour|mais|hier|suis|est|je|mes|aux|des)\b/g) * 2,
    de:
      countMatches(/[äöüß]/g) * 3 +
      countMatches(/\b(der|die|das|ein|eine|mit|nicht|heute|aber|war|und|ich|wir)\b/g) * 2,
    it:
      countMatches(/\b(il|lo|gli|uno|con|per|ma|oggi|ieri|molto|sono|della|nella)\b/g) * 2,
    pt:
      countMatches(/[ãõç]/g) * 3 +
      countMatches(/\b(os|as|uma|com|para|mas|hoje|ontem|muito|não|estou)\b/g) * 2,
    en:
      countMatches(/\b(the|and|with|for|that|this|today|yesterday|was|were|have)\b/g) * 2,
  };

  let bestCode = 'es';
  let bestScore = 0;
  for (const [code, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCode = code;
    }
  }

  return bestCode;
}

function getLanguageDetectorApi(): LanguageDetectorStatic | null {
  if (typeof self !== 'undefined' && 'LanguageDetector' in self && self.LanguageDetector) {
    return self.LanguageDetector;
  }
  return null;
}

export function useLanguageDetector(initialLanguage = 'es', currentContent = '') {
  const [selectedLanguage, setSelectedLanguage] = useState<string>(initialLanguage);
  const [isManualOverride, setIsManualOverride] = useState<boolean>(false);

  const [detectorAvailability, setDetectorAvailability] =
    useState<LanguageDetectorAvailability>('unsupported');
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [nativeDetectedCode, setNativeDetectedCode] = useState<string | null>(null);
  const [nativeConfidence, setNativeConfidence] = useState<number | null>(null);

  const detectorRef = useRef<LanguageDetectorInstance | null>(null);
  const creatingPromiseRef = useRef<Promise<LanguageDetectorInstance | null> | null>(null);

  /**
   * Instantiate LanguageDetector.
   * Must be initiated by a user gesture (click / keydown) when the model is
   * in a 'downloadable' or 'downloading' state to prevent NotAllowedError.
   */
  const initNativeDetector = useCallback(async (): Promise<LanguageDetectorInstance | null> => {
    if (detectorRef.current) return detectorRef.current;
    if (creatingPromiseRef.current) return creatingPromiseRef.current;

    const api = getLanguageDetectorApi();
    if (!api) {
      setDetectorAvailability('unsupported');
      return null;
    }

    creatingPromiseRef.current = (async () => {
      try {
        const availability = await api.availability();
        setDetectorAvailability(availability);

        if (availability === 'unavailable') {
          return null;
        }

        const instance = await api.create({
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              setDetectorAvailability('downloading');
              setDownloadProgress(Math.round((e.loaded || 0) * 100));
            });
          },
        });

        detectorRef.current = instance;
        setDetectorAvailability('available');
        setDownloadProgress(null);
        return instance;
      } catch {
        // E.g. NotAllowedError if called without user gesture while downloadable
        return null;
      } finally {
        creatingPromiseRef.current = null;
      }
    })();

    return creatingPromiseRef.current;
  }, []);

  // Check initial availability on mount; if already 'available' on-device,
  // or on first user gesture (keydown/click), instantiate the detector.
  useEffect(() => {
    let mounted = true;
    const api = getLanguageDetectorApi();
    if (!api) {
      setDetectorAvailability('unsupported');
      return;
    }

    api
      .availability()
      .then((status) => {
        if (!mounted) return;
        setDetectorAvailability(status);
        if (status === 'available') {
          void initNativeDetector();
        }
      })
      .catch(() => {
        if (mounted) setDetectorAvailability('unsupported');
      });

    const handleUserGesture = () => {
      if (!detectorRef.current) {
        void initNativeDetector();
      }
    };

    window.addEventListener('keydown', handleUserGesture, { once: true });
    window.addEventListener('click', handleUserGesture, { once: true });

    return () => {
      mounted = false;
      window.removeEventListener('keydown', handleUserGesture);
      window.removeEventListener('click', handleUserGesture);
      detectorRef.current?.destroy?.();
      detectorRef.current = null;
    };
  }, [initNativeDetector]);

  // Run native LanguageDetector.detect() when content is long enough
  useEffect(() => {
    const trimmed = currentContent.trim();
    const wordCount = trimmed ? trimmed.split(/\s+/).length : 0;

    // Avoid running on single words or very short phrases where accuracy drops
    if (
      trimmed.length < MIN_CHARS_FOR_NATIVE_DETECT ||
      wordCount < MIN_WORDS_FOR_NATIVE_DETECT
    ) {
      setNativeDetectedCode(null);
      setNativeConfidence(null);
      return;
    }

    const detector = detectorRef.current;
    if (!detector) return;

    let cancelled = false;

    const runDetection = async () => {
      try {
        const results = await detector.detect(trimmed);
        if (cancelled || !Array.isArray(results) || results.length === 0) return;

        // Results are ranked by confidence from highest to lowest
        for (const result of results) {
          if (!result.detectedLanguage) continue;
          const baseCode = result.detectedLanguage.split('-')[0].toLowerCase();
          if (SUPPORTED_CODES.has(baseCode) && result.confidence >= 0.2) {
            setNativeDetectedCode(baseCode);
            setNativeConfidence(result.confidence);
            return;
          }
        }
      } catch {
        // Fallback silently on detection error
      }
    };

    void runDetection();

    return () => {
      cancelled = true;
    };
  }, [currentContent, detectorAvailability]);

  // Synchronous heuristic fallback
  const fallbackCode = useMemo(() => {
    return detectLanguage(currentContent);
  }, [currentContent]);

  // Prefer native Web API LanguageDetector result when available; otherwise fallback
  const detectedCode = nativeDetectedCode ?? fallbackCode;
  const detectionEngine: 'native-api' | 'fallback' =
    nativeDetectedCode !== null ? 'native-api' : 'fallback';

  // If user hasn't manually overridden, follow detected language
  const activeLanguageCode = isManualOverride ? selectedLanguage : detectedCode;

  const activeLanguage = useMemo(() => {
    return SUPPORTED_LANGUAGES.find((l) => l.code === activeLanguageCode) || SUPPORTED_LANGUAGES[0];
  }, [activeLanguageCode]);

  const selectLanguage = (code: string) => {
    setSelectedLanguage(code);
    setIsManualOverride(true);
  };

  const resetToAutoDetect = () => {
    setIsManualOverride(false);
  };

  return {
    activeLanguage,
    activeLanguageCode,
    detectedCode,
    detectionEngine,
    detectorAvailability,
    downloadProgress,
    nativeConfidence,
    isManualOverride,
    selectLanguage,
    resetToAutoDetect,
    activateNativeDetector: initNativeDetector,
    supportedLanguages: SUPPORTED_LANGUAGES,
  };
}
