import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

describe('useKeyboardShortcuts', () => {
  it('triggers onSave on Ctrl+S or Cmd+S with preventDefault', () => {
    const onSave = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onSave }));

    const event = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    window.dispatchEvent(event);

    expect(onSave).toHaveBeenCalled();
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('triggers onReview on Ctrl+Enter or Cmd+Enter', () => {
    const onReview = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onReview }));

    const event = new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);

    expect(onReview).toHaveBeenCalled();
  });

  it('triggers onOpenHistory on Ctrl+H or Alt+H', () => {
    const onOpenHistory = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onOpenHistory }));

    const event = new KeyboardEvent('keydown', { key: 'h', ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);

    expect(onOpenHistory).toHaveBeenCalled();
  });

  it('triggers onOpenSettings on Ctrl+, or Alt+T', () => {
    const onOpenSettings = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onOpenSettings }));

    const event = new KeyboardEvent('keydown', { key: ',', ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);

    expect(onOpenSettings).toHaveBeenCalled();
  });

  it('triggers onEscape on Esc', () => {
    const onEscape = vi.fn();
    renderHook(() => useKeyboardShortcuts({ onEscape }));

    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    window.dispatchEvent(event);

    expect(onEscape).toHaveBeenCalled();
  });
});
