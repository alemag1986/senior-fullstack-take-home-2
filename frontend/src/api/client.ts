import { Analysis, JournalEntry } from '../types/journal';
import { analyzeEntry as analyzeEntryMock } from './mockAdapter';

const API_BASE = '/api';

export interface ApiClientOptions {
  sessionGuid: string;
}

export class JournalApiClient {
  private sessionGuid: string;

  constructor(sessionGuid: string) {
    this.sessionGuid = sessionGuid;
  }

  setSessionGuid(guid: string) {
    this.sessionGuid = guid;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Session-ID': this.sessionGuid,
    };
  }

  async analyze(entry: JournalEntry): Promise<Analysis> {
    try {
      const response = await fetch(`${API_BASE}/entries/analyze`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          entry_id: entry.id,
          content: entry.content,
          target_language: entry.targetLanguage,
          revision: entry.revision,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data = await response.json();
      return {
        id: data.id || `analysis-${Date.now()}`,
        entryId: entry.id,
        entryRevision: entry.revision,
        sourceText: entry.content,
        status: 'completed',
        offsetEncoding: 'utf-16',
        suggestions: data.suggestions || [],
        isMock: false,
      };
    } catch {
      // Fallback gracefully to decoupled mock adapter
      return analyzeEntryMock(entry);
    }
  }

  async saveEntry(entry: JournalEntry): Promise<JournalEntry> {
    try {
      const response = await fetch(`${API_BASE}/entries`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          id: entry.id,
          title: entry.title || 'Journal Entry',
          content: entry.content,
          target_language: entry.targetLanguage,
          revision: entry.revision,
        }),
      });

      if (!response.ok) {
        throw new Error(`Save failed: ${response.status}`);
      }

      const saved = await response.json();
      return {
        ...entry,
        id: saved.id || entry.id,
        updatedAt: new Date().toISOString(),
      };
    } catch {
      // Offline local fallback
      return {
        ...entry,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  async fetchEntries(): Promise<JournalEntry[]> {
    try {
      const response = await fetch(`${API_BASE}/entries`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) throw new Error('Fetch failed');
      return await response.json();
    } catch {
      return [];
    }
  }
}
