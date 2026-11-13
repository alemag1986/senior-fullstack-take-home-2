import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { JournalApiClient } from './api/client';
import { BlankCanvas } from './components/Editor/BlankCanvas';
import { StatusIndicator } from './components/Editor/StatusIndicator';
import { VersionCompare } from './components/Compare/VersionCompare';
import { SideReviewPanel } from './components/Review/SideReviewPanel';
import { HistoryModal } from './components/Modals/HistoryModal';
import { ThemeModal } from './components/Modals/ThemeModal';
import { HelpModal } from './components/Modals/HelpModal';
// import { InsightsModal } from './components/Modals/InsightsModal';
import { useAutoSave } from './hooks/useAutoSave';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useLanguageDetector } from './hooks/useLanguageDetector';
import { useSessionGuid } from './hooks/useSessionGuid';
import { useSuggestions } from './hooks/useSuggestions';
import { useTheme } from './hooks/useTheme';
import { JournalEntry } from './types/journal';

export const App: React.FC = () => {
  const { sessionGuid, updateSessionGuid, regenerateGuid } = useSessionGuid();
  const { theme, setTheme } = useTheme();

  // Create API client with current session GUID
  const apiClient = useMemo(() => new JournalApiClient(sessionGuid), [sessionGuid]);

  // Initial Entry
  const [entry, setEntry] = useState<JournalEntry>(() => {
    return {
      id: `entry-${Date.now()}`,
      title: 'Journal Entry',
      targetLanguage: 'es',
      content: '',
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  });

  // Saved Entries List for History Modal
  const [entriesHistory, setEntriesHistory] = useState<JournalEntry[]>(() => {
    try {
      const stored = localStorage.getItem(`journal_history_${sessionGuid}`);
      if (stored) return JSON.parse(stored);
    } catch {
      // Ignore parse error
    }
    return [];
  });

  // Modal visibility states
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isCompareOpen, setIsCompareOpen] = useState(false);
  // Insights hidden for now: const [isInsightsOpen, setIsInsightsOpen] = useState(false);
  const [isSidePanelOpen, setIsSidePanelOpen] = useState(false);

  // Sync entries from backend DB and local web storage
  const syncJournals = useCallback(async (guid = sessionGuid) => {
    try {
      // 1. Immediately reflect web storage for this user to ensure instant responsiveness
      let localEntries: JournalEntry[] = [];
      try {
        const stored = localStorage.getItem(`journal_history_${guid}`);
        if (stored) localEntries = JSON.parse(stored);
      } catch {
        localEntries = [];
      }
      setEntriesHistory(localEntries);

      // 2. Fetch remote entries from backend for this user
      const client = new JournalApiClient(guid);
      const remoteEntries = await client.fetchEntries();

      // 3. Merge remote entries with local entries (remote entries take precedence)
      const map = new Map<string, JournalEntry>();
      localEntries.forEach((e) => map.set(e.id, e));
      if (Array.isArray(remoteEntries)) {
        remoteEntries.forEach((e) => map.set(e.id, e));
      }

      const merged = Array.from(map.values());
      // 4. Sync back to web storage
      localStorage.setItem(`journal_history_${guid}`, JSON.stringify(merged));
      setEntriesHistory(merged);
      return merged;
    } catch (err) {
      console.error('Failed to sync journals:', err);
      try {
        const stored = localStorage.getItem(`journal_history_${guid}`);
        const local = stored ? JSON.parse(stored) : [];
        setEntriesHistory(local);
        return local;
      } catch {
        setEntriesHistory([]);
        return [];
      }
    }
  }, [sessionGuid]);

  // Sync journals on mount and whenever user / sessionGuid changes
  useEffect(() => {
    syncJournals(sessionGuid);
  }, [syncJournals, sessionGuid]);

  // Auto-Save Draft
  const { isDirty, restoreDraft } = useAutoSave(entry, sessionGuid);

  // Language auto-detection
  const {
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
    activateNativeDetector,
    supportedLanguages,
  } = useLanguageDetector(entry.targetLanguage, entry.content);

  // Restore draft or reset to clean entry when user changes
  useEffect(() => {
    const savedDraft = restoreDraft(sessionGuid);
    if (savedDraft && savedDraft.content) {
      setEntry((prev) => ({
        ...prev,
        ...savedDraft,
      }));
    } else {
      setEntry({
        id: `entry-${Date.now()}`,
        title: 'New Journal Entry',
        targetLanguage: activeLanguageCode,
        content: '',
        revision: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }, [sessionGuid]);

  const handleUpdateSessionGuid = useCallback(
    (newGuid: string) => {
      const valid = updateSessionGuid(newGuid);
      return valid;
    },
    [updateSessionGuid]
  );

  const handleRefreshUser = useCallback(() => {
    regenerateGuid();
  }, [regenerateGuid]);

  // Sync language with entry
  useEffect(() => {
    if (entry.targetLanguage !== activeLanguageCode) {
      setEntry((prev) => ({ ...prev, targetLanguage: activeLanguageCode }));
    }
  }, [activeLanguageCode]);

  // Suggestions and Analysis Lifecycle
  const handleUpdateContent = useCallback((newContent: string, newRevision: number) => {
    setEntry((prev) => ({
      ...prev,
      content: newContent,
      revision: newRevision,
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const {
    analysis,
    activeSuggestions,
    isStale,
    isLoading,
    error,
    selectedSuggestionId,
    setIsLoading,
    setSelectedSuggestionId,
    applyAnalysis,
    acceptSuggestion,
    dismissSuggestion,
    acceptAllSuggestions,
    dismissAllSuggestions,
    notifyManualEdit,
  } = useSuggestions(entry, handleUpdateContent);

  // User typing in editor canvas
  const handleEditorChange = (newContent: string) => {
    notifyManualEdit();
    setEntry((prev) => ({
      ...prev,
      content: newContent,
      updatedAt: new Date().toISOString(),
    }));
  };

  // Synchronize decisions to backend for mistake tracking
  const handleAcceptSuggestion = (id: string) => {
    acceptSuggestion(id);
    apiClient.submitDecision(entry.id, entry.revision, id, 'accepted');
  };

  const handleDismissSuggestion = (id: string) => {
    dismissSuggestion(id);
    apiClient.submitDecision(entry.id, entry.revision, id, 'dismissed');
  };

  const handleAcceptAll = () => {
    const pending = activeSuggestions.filter((s) => s.state === 'pending');
    acceptAllSuggestions();
    pending.forEach((s) => {
      apiClient.submitDecision(entry.id, entry.revision, s.id, 'accepted');
    });
  };

  const handleDismissAll = () => {
    const pending = activeSuggestions.filter((s) => s.state === 'pending');
    dismissAllSuggestions();
    pending.forEach((s) => {
      apiClient.submitDecision(entry.id, entry.revision, s.id, 'dismissed');
    });
  };

  // Action: Save Entry (Ctrl+S / Cmd+S)
  const handleSave = useCallback(async () => {
    if (!entry.content.trim()) return;

    const saved = await apiClient.saveEntry(entry);
    setEntriesHistory((prev) => {
      const filtered = prev.filter((e) => e.id !== saved.id);
      const updated = [saved, ...filtered];
      localStorage.setItem(`journal_history_${sessionGuid}`, JSON.stringify(updated));
      return updated;
    });
  }, [entry, apiClient, sessionGuid]);

  // Action: Review Entry with AI (Ctrl+Enter / Cmd+Enter / Alt+R)
  const handleReview = useCallback(async () => {
    if (!entry.content.trim() || isLoading) return;

    setIsLoading(true);
    const result = await apiClient.analyze(entry);
    applyAnalysis(result, entry);
    if (result.suggestions && result.suggestions.length > 0) {
      setIsSidePanelOpen(true);
    }

    // Sync analyzed entry to local history and web storage
    setEntriesHistory((prev) => {
      const filtered = prev.filter((e) => e.id !== entry.id);
      const updated = [{ ...entry, updatedAt: new Date().toISOString() }, ...filtered];
      localStorage.setItem(`journal_history_${sessionGuid}`, JSON.stringify(updated));
      return updated;
    });
  }, [entry, isLoading, apiClient, applyAnalysis, setIsLoading, sessionGuid]);

  // Action: Create New Blank Entry
  const handleNewEntry = useCallback(() => {
    const fresh: JournalEntry = {
      id: `entry-${Date.now()}`,
      title: 'New Journal Entry',
      targetLanguage: activeLanguageCode,
      content: '',
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEntry(fresh);
    setSelectedSuggestionId(null);
    setIsSidePanelOpen(false);
  }, [activeLanguageCode, setSelectedSuggestionId]);

  // Action: Select Past Entry from History
  const handleSelectEntry = useCallback((selected: JournalEntry) => {
    setEntry(selected);
    setSelectedSuggestionId(null);
  }, [setSelectedSuggestionId]);

  // Action: Remove / Soft Delete Entry
  const handleDeleteEntry = useCallback(
    async (entryId: string) => {
      await apiClient.deleteEntry(entryId);
      setEntriesHistory((prev) => {
        const filtered = prev.filter((e) => e.id !== entryId);
        localStorage.setItem(`journal_history_${sessionGuid}`, JSON.stringify(filtered));
        return filtered;
      });

      if (entry.id === entryId) {
        handleNewEntry();
      }
    },
    [apiClient, sessionGuid, entry.id, handleNewEntry]
  );

  // Global Keyboard Shortcuts
  const anyModalOpen =
    isHistoryOpen || isSettingsOpen || isHelpOpen || isCompareOpen;

  useKeyboardShortcuts({
    onSave: handleSave,
    onReview: handleReview,
    onOpenHistory: () => setIsHistoryOpen(true),
    onOpenSettings: () => setIsSettingsOpen(true),
    onOpenHelp: () => setIsHelpOpen(true),
    // onOpenInsights: () => setIsInsightsOpen(true),
    onToggleReviewPanel: () => setIsSidePanelOpen((prev) => !prev),
    onToggleCompare: () => {
      if (!isStale && activeSuggestions.length > 0) {
        setIsCompareOpen((prev) => !prev);
      }
    },
    onEscape: () => {
      if (anyModalOpen) {
        setIsHistoryOpen(false);
        setIsSettingsOpen(false);
        setIsHelpOpen(false);
        setIsCompareOpen(false);
      } else if (isSidePanelOpen) {
        setIsSidePanelOpen(false);
      } else if (selectedSuggestionId) {
        setSelectedSuggestionId(null);
      }
    },
  });

  // Calculate word count
  const wordCount = useMemo(() => {
    const trimmed = entry.content.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  }, [entry.content]);

  return (
    <main
      data-testid="app-container"
      className="min-h-screen w-full bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200"
    >
      {/* 1. Distraction-Free Blank Writing Canvas */}
      <BlankCanvas
        content={entry.content}
        activeSuggestions={activeSuggestions}
        selectedSuggestionId={selectedSuggestionId}
        onChange={handleEditorChange}
        onSelectSuggestion={setSelectedSuggestionId}
        onAcceptSuggestion={handleAcceptSuggestion}
        onDismissSuggestion={handleDismissSuggestion}
        isStale={isStale}
        isSidePanelOpen={isSidePanelOpen}
      />

      {/* 2. Side Review Panel (Click to jump to correction point) */}
      <SideReviewPanel
        isOpen={isSidePanelOpen}
        onClose={() => setIsSidePanelOpen(false)}
        activeSuggestions={activeSuggestions}
        selectedSuggestionId={selectedSuggestionId}
        content={entry.content}
        isStale={isStale}
        onSelectSuggestion={setSelectedSuggestionId}
        onAcceptSuggestion={handleAcceptSuggestion}
        onDismissSuggestion={handleDismissSuggestion}
        onAcceptAll={handleAcceptAll}
        onDismissAll={handleDismissAll}
        onReviewAgain={handleReview}
      />

      {/* 3. Non-Intrusive Faded Status Indicator */}
      <StatusIndicator
        wordCount={wordCount}
        language={activeLanguage}
        isAutoDetected={!isManualOverride}
        isDirty={isDirty}
        isStale={isStale}
        isLoading={isLoading}
        error={error}
        isMock={analysis?.isMock}
        pendingSuggestionsCount={
          activeSuggestions.filter((s) => s.state === 'pending').length
        }
        isSidePanelOpen={isSidePanelOpen}
        onToggleSidePanel={() => setIsSidePanelOpen((prev) => !prev)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        /* onOpenInsights={() => setIsInsightsOpen(true)} */
        onReview={handleReview}
      />

      {/* 4. Version Comparison Diff Overlay */}
      {isCompareOpen && (
        <VersionCompare
          currentText={entry.content}
          activeSuggestions={activeSuggestions}
          isStale={isStale}
          onClose={() => setIsCompareOpen(false)}
        />
      )}

      {/* 4. History Modal (Ctrl+H / Cmd+O) */}
      {isHistoryOpen && (
        <HistoryModal
          entries={entriesHistory}
          currentEntryId={entry.id}
          onSelectEntry={handleSelectEntry}
          onNewEntry={handleNewEntry}
          onRefresh={() => syncJournals(sessionGuid)}
          onDeleteEntry={handleDeleteEntry}
          onClose={() => setIsHistoryOpen(false)}
        />
      )}

      {/* 5. Screen & Session Options Modal (Ctrl+, / Alt+T) */}
      {isSettingsOpen && (
        <ThemeModal
          theme={theme}
          onSetTheme={setTheme}
          activeLanguageCode={activeLanguageCode}
          detectedCode={detectedCode}
          detectionEngine={detectionEngine}
          detectorAvailability={detectorAvailability}
          downloadProgress={downloadProgress}
          nativeConfidence={nativeConfidence}
          onActivateNativeDetector={() => {
            void activateNativeDetector();
          }}
          isManualOverride={isManualOverride}
          supportedLanguages={supportedLanguages}
          onSelectLanguage={selectLanguage}
          onResetAutoDetect={resetToAutoDetect}
          sessionGuid={sessionGuid}
          onUpdateSessionGuid={handleUpdateSessionGuid}
          onRefreshUser={handleRefreshUser}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}

      {/* 6. Learning Insights Modal (Ctrl+I) - hidden for now */}
      {/* {isInsightsOpen && (
        <InsightsModal
          apiClient={apiClient}
          onClose={() => setIsInsightsOpen(false)}
        />
      )} */}

      {/* 7. Help Modal (Ctrl+/ / ?) */}
      {isHelpOpen && <HelpModal onClose={() => setIsHelpOpen(false)} />}
    </main>
  );
};

export default App;
