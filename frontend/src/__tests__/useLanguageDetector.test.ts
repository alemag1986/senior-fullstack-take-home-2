import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLanguageDetector } from '../hooks/useLanguageDetector';

describe('useLanguageDetector (Web LanguageDetector API & Fallback)', () => {
  afterEach(() => {
    delete (self as unknown as Record<string, unknown>).LanguageDetector;
    vi.restoreAllMocks();
  });

  it('falls back to heuristic detection when LanguageDetector is not in self', () => {
    const { result } = renderHook(() =>
      useLanguageDetector('es', 'Hier je suis allé à la bibliothèque avec mes amis.')
    );

    expect(result.current.detectorAvailability).toBe('unsupported');
    expect(result.current.detectionEngine).toBe('fallback');
    expect(result.current.detectedCode).toBe('fr');
    expect(result.current.activeLanguageCode).toBe('fr');
  });

  it('uses native LanguageDetector.detect() when available and text has 3+ words', async () => {
    const detectMock = vi.fn().mockResolvedValue([
      { detectedLanguage: 'de', confidence: 0.98 },
      { detectedLanguage: 'en', confidence: 0.01 },
    ]);
    const createMock = vi.fn().mockResolvedValue({
      detect: detectMock,
      destroy: vi.fn(),
    });
    const availabilityMock = vi.fn().mockResolvedValue('available');

    (self as unknown as Record<string, unknown>).LanguageDetector = {
      availability: availabilityMock,
      create: createMock,
    };

    const { result, rerender } = renderHook(
      ({ text }) => useLanguageDetector('es', text),
      {
        initialProps: { text: 'Hallo und herzlich willkommen in Berlin!' },
      }
    );

    await waitFor(() => {
      expect(availabilityMock).toHaveBeenCalled();
      expect(createMock).toHaveBeenCalled();
    });

    // Trigger re-evaluation once detector is created
    rerender({ text: 'Hallo und herzlich willkommen in unserer schönen Stadt!' });

    await waitFor(() => {
      expect(detectMock).toHaveBeenCalledWith(
        'Hallo und herzlich willkommen in unserer schönen Stadt!'
      );
      expect(result.current.detectionEngine).toBe('native-api');
      expect(result.current.detectedCode).toBe('de');
      expect(result.current.nativeConfidence).toBeCloseTo(0.98);
    });
  });

  it('skips native LanguageDetector.detect() on single words or very short phrases', async () => {
    const detectMock = vi.fn().mockResolvedValue([
      { detectedLanguage: 'it', confidence: 0.95 },
    ]);
    (self as unknown as Record<string, unknown>).LanguageDetector = {
      availability: vi.fn().mockResolvedValue('available'),
      create: vi.fn().mockResolvedValue({ detect: detectMock }),
    };

    renderHook(() => useLanguageDetector('es', 'Ciao'));

    await waitFor(() => {
      expect((self as unknown as { LanguageDetector: { create: unknown } }).LanguageDetector.create).toHaveBeenCalled();
    });

    expect(detectMock).not.toHaveBeenCalled();
  });

  it('waits for user gesture activation when availability is downloadable and tracks downloadprogress', async () => {
    let progressHandler: ((e: { loaded: number }) => void) | null = null;
    const detectMock = vi.fn().mockResolvedValue([
      { detectedLanguage: 'it', confidence: 0.94 },
    ]);
    const createMock = vi.fn().mockImplementation(async (options?: { monitor?: (m: { addEventListener: (t: string, cb: (e: { loaded: number }) => void) => void }) => void }) => {
      if (options?.monitor) {
        options.monitor({
          addEventListener: (_type: string, cb: (e: { loaded: number }) => void) => {
            progressHandler = cb;
          },
        });
      }
      if (progressHandler) {
        progressHandler({ loaded: 0.5 });
      }
      return { detect: detectMock };
    });

    (self as unknown as Record<string, unknown>).LanguageDetector = {
      availability: vi.fn().mockResolvedValue('downloadable'),
      create: createMock,
    };

    const { result } = renderHook(() =>
      useLanguageDetector('es', 'Oggi sono andato al mercato con la mia famiglia.')
    );

    await waitFor(() => {
      expect(result.current.detectorAvailability).toBe('downloadable');
    });

    // Not created until user gesture triggers activateNativeDetector
    expect(createMock).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.activateNativeDetector();
    });

    expect(createMock).toHaveBeenCalled();
    expect(result.current.detectorAvailability).toBe('available');
  });
});
