import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, renderHook } from '@testing-library/react';
import { useSessionGuid } from '../hooks/useSessionGuid';
import { useAutoSave } from '../hooks/useAutoSave';
import { ThemeModal } from '../components/Modals/ThemeModal';
import { HistoryModal } from '../components/Modals/HistoryModal';
import { App } from '../App';

describe('User Switching, Refreshing & Web Storage Synchronization', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('useSessionGuid Hook', () => {
    it('initializes from localStorage or creates a new GUID', () => {
      localStorage.setItem('journal_session_guid', 'user-test-123');
      const { result } = renderHook(() => useSessionGuid());
      expect(result.current.sessionGuid).toBe('user-test-123');
    });

    it('updates session GUID and persists to web storage for valid formats', () => {
      const { result } = renderHook(() => useSessionGuid());

      // Standard user ID
      act(() => {
        const ok = result.current.updateSessionGuid('user-new-456');
        expect(ok).toBe(true);
      });
      expect(result.current.sessionGuid).toBe('user-new-456');
      expect(localStorage.getItem('journal_session_guid')).toBe('user-new-456');

      // UUID format
      act(() => {
        const ok = result.current.updateSessionGuid('12345678-1234-4234-8234-123456789abc');
        expect(ok).toBe(true);
      });
      expect(result.current.sessionGuid).toBe('12345678-1234-4234-8234-123456789abc');

      // Rejects invalid/empty
      act(() => {
        const ok = result.current.updateSessionGuid('   ');
        expect(ok).toBe(false);
      });
    });

    it('regenerates a fresh session GUID and syncs to web storage', () => {
      const { result } = renderHook(() => useSessionGuid());
      const oldGuid = result.current.sessionGuid;

      act(() => {
        const fresh = result.current.regenerateGuid();
        expect(fresh).not.toBe(oldGuid);
      });

      expect(localStorage.getItem('journal_session_guid')).toBe(result.current.sessionGuid);
    });
  });

  describe('useAutoSave Draft Isolation across Users', () => {
    it('does not leak or overwrite draft when switching sessionGuid', () => {
      const entryUserA = {
        id: 'entry-1',
        title: 'User A Entry',
        targetLanguage: 'es',
        content: 'Draft for User A',
        revision: 1,
      };

      const { result, rerender } = renderHook(
        ({ entry, guid }: { entry: typeof entryUserA; guid: string }) =>
          useAutoSave(entry, guid),
        {
          initialProps: { entry: entryUserA, guid: 'user-A' },
        }
      );

      // Simulate switching to user-B
      const entryUserB = {
        id: 'entry-2',
        title: 'User B Entry',
        targetLanguage: 'es',
        content: '',
        revision: 1,
      };

      rerender({ entry: entryUserB, guid: 'user-B' });

      // Ensure user-B's draft is not polluted by user-A
      expect(result.current.restoreDraft('user-B')).toBeNull();
    });
  });

  describe('ThemeModal User Refresh and Switch Controls', () => {
    it('calls onRefreshUser when clicking Refresh User button', () => {
      const onRefreshUser = vi.fn();
      render(
        <ThemeModal
          theme="light"
          onSetTheme={vi.fn()}
          activeLanguageCode="es"
          detectedCode="es"
          isManualOverride={false}
          supportedLanguages={[{ code: 'es', name: 'Spanish', flag: '🇪🇸' }]}
          onSelectLanguage={vi.fn()}
          onResetAutoDetect={vi.fn()}
          sessionGuid="user-initial"
          onUpdateSessionGuid={vi.fn()}
          onRefreshUser={onRefreshUser}
          onClose={vi.fn()}
        />
      );

      const refreshBtn = screen.getByTestId('refresh-user-button');
      expect(refreshBtn).toBeInTheDocument();
      fireEvent.click(refreshBtn);
      expect(onRefreshUser).toHaveBeenCalledTimes(1);
    });

    it('submits new user ID, updates session, and shows success message', () => {
      const onUpdateGuid = vi.fn().mockReturnValue(true);
      render(
        <ThemeModal
          theme="light"
          onSetTheme={vi.fn()}
          activeLanguageCode="es"
          detectedCode="es"
          isManualOverride={false}
          supportedLanguages={[{ code: 'es', name: 'Spanish', flag: '🇪🇸' }]}
          onSelectLanguage={vi.fn()}
          onResetAutoDetect={vi.fn()}
          sessionGuid="user-initial"
          onUpdateSessionGuid={onUpdateGuid}
          onClose={vi.fn()}
        />
      );

      const input = screen.getByTestId('change-user-input');
      const submitBtn = screen.getByTestId('change-user-submit');

      fireEvent.change(input, { target: { value: 'user-target' } });
      fireEvent.click(submitBtn);

      expect(onUpdateGuid).toHaveBeenCalledWith('user-target');
      expect(screen.getByText('User switched & journals synced successfully!')).toBeInTheDocument();
    });
  });

  describe('HistoryModal Refresh Button', () => {
    it('triggers onRefresh when clicking Refresh button', () => {
      const onRefresh = vi.fn();
      render(
        <HistoryModal
          entries={[]}
          currentEntryId="none"
          onSelectEntry={vi.fn()}
          onNewEntry={vi.fn()}
          onRefresh={onRefresh}
          onClose={vi.fn()}
        />
      );

      const refreshBtn = screen.getByTestId('refresh-history-button');
      expect(refreshBtn).toBeInTheDocument();
      fireEvent.click(refreshBtn);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('handles entry deletion with two-step confirmation', async () => {
      const onDeleteEntry = vi.fn();
      const mockEntries = [
        {
          id: 'entry-to-del',
          title: 'To Delete',
          targetLanguage: 'es',
          content: 'Test delete content',
          revision: 1,
          updatedAt: '2026-11-12T10:00:00Z',
        },
      ];

      render(
        <HistoryModal
          entries={mockEntries}
          currentEntryId="other"
          onSelectEntry={vi.fn()}
          onNewEntry={vi.fn()}
          onDeleteEntry={onDeleteEntry}
          onClose={vi.fn()}
        />
      );

      // Delete icon is rendered
      const deleteBtn = screen.getByTestId('delete-entry-entry-to-del');
      expect(deleteBtn).toBeInTheDocument();

      // Click delete -> shows Confirm and Cancel buttons
      fireEvent.click(deleteBtn);
      const confirmBtn = screen.getByTestId('confirm-delete-entry-to-del');
      const cancelBtn = screen.getByTestId('cancel-delete-entry-to-del');
      expect(confirmBtn).toBeInTheDocument();
      expect(cancelBtn).toBeInTheDocument();

      // Click cancel -> confirmation dismissed without calling onDeleteEntry
      fireEvent.click(cancelBtn);
      expect(onDeleteEntry).not.toHaveBeenCalled();
      expect(screen.queryByTestId('confirm-delete-entry-to-del')).not.toBeInTheDocument();

      // Click delete again and confirm -> onDeleteEntry called
      fireEvent.click(screen.getByTestId('delete-entry-entry-to-del'));
      fireEvent.click(screen.getByTestId('confirm-delete-entry-to-del'));
      expect(onDeleteEntry).toHaveBeenCalledWith('entry-to-del');
    });
  });

  describe('App Full Flow: Soft Delete Entry', () => {
    it('deletes active entry and resets canvas state', async () => {
      const entryToDelete = {
        id: 'entry-active-1',
        title: 'Active To Delete',
        targetLanguage: 'es',
        content: 'Entry that is currently active and will be deleted',
        revision: 1,
        updatedAt: '2026-11-12T10:00:00Z',
      };

      localStorage.setItem('journal_session_guid', 'user-del-test');
      localStorage.setItem('journal_history_user-del-test', JSON.stringify([entryToDelete]));

      let deletedIdCalled: string | null = null;
      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        if (url.endsWith('/api/entries')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve([entryToDelete]),
          });
        }
        if (url.includes('/api/entries/entry-active-1') && options?.method === 'DELETE') {
          deletedIdCalled = 'entry-active-1';
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, id: 'entry-active-1', deletedAt: '2026-11-12T12:00:00Z' }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }) as any;

      const { unmount } = render(<App />);

      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      // Open history modal
      const historyBtn = screen.getByTestId('open-history-button');
      fireEvent.click(historyBtn);

      // Select the entry to make it active
      const entryRow = screen.getByText(/Entry that is currently active/i);
      fireEvent.click(entryRow);

      // Re-open history modal to delete it
      fireEvent.click(screen.getByTestId('open-history-button'));

      // Click delete button and confirm
      const deleteBtn = screen.getByTestId('delete-entry-entry-active-1');
      fireEvent.click(deleteBtn);
      const confirmBtn = screen.getByTestId('confirm-delete-entry-active-1');
      await act(async () => {
        fireEvent.click(confirmBtn);
      });

      expect(deletedIdCalled).toBe('entry-active-1');

      // Entry is removed from web storage
      const stored = JSON.parse(localStorage.getItem('journal_history_user-del-test') || '[]');
      expect(stored).toHaveLength(0);

      unmount();
    });
  });

  describe('App Full Flow: User change refreshes journals and syncs web storage', () => {
    it('fetches remote entries on user change and syncs them to web storage', async () => {
      // Mock global fetch
      const mockEntriesUserA = [
        {
          id: 'entry-a1',
          userId: 'user-A',
          title: 'Entry A1',
          targetLanguage: 'es',
          content: 'Hola desde usuario A',
          revision: 1,
          updatedAt: '2026-11-12T10:00:00Z',
        },
      ];

      const mockEntriesUserB = [
        {
          id: 'entry-b1',
          userId: 'user-B',
          title: 'Entry B1',
          targetLanguage: 'es',
          content: 'Bonjour depuis utilisateur B',
          revision: 1,
          updatedAt: '2026-11-12T11:00:00Z',
        },
      ];

      localStorage.setItem('journal_session_guid', 'user-A');

      global.fetch = vi.fn().mockImplementation((url: string, options?: RequestInit) => {
        const headers = (options?.headers as Record<string, string>) || {};
        const sessionId = headers['X-Session-ID'];

        if (url.endsWith('/api/entries')) {
          if (sessionId === 'user-B') {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve(mockEntriesUserB),
            });
          }
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockEntriesUserA),
          });
        }
        return Promise.reject(new Error('Unknown url'));
      }) as any;

      const { unmount } = render(<App />);

      // Wait for initial sync for User A
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      // User A's web storage should have entry-a1
      const storedA = JSON.parse(localStorage.getItem('journal_history_user-A') || '[]');
      expect(storedA).toHaveLength(1);
      expect(storedA[0].id).toBe('entry-a1');

      // Now open settings modal
      const settingsBtn = screen.getByTitle(/Language/i);
      fireEvent.click(settingsBtn);

      // Switch to user-B
      const input = screen.getByTestId('change-user-input');
      const submit = screen.getByTestId('change-user-submit');
      fireEvent.change(input, { target: { value: 'user-B' } });
      fireEvent.click(submit);

      // Wait for user B sync
      await act(async () => {
        await new Promise((r) => setTimeout(r, 50));
      });

      // User B's web storage should be synced with entry-b1
      const storedB = JSON.parse(localStorage.getItem('journal_history_user-B') || '[]');
      expect(storedB).toHaveLength(1);
      expect(storedB[0].id).toBe('entry-b1');
      expect(storedB[0].content).toBe('Bonjour depuis utilisateur B');

      unmount();
    });
  });
});
