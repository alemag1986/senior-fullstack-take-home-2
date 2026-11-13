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
        entryId: data.entryId || entry.id,
        entryRevision: data.entryRevision ?? entry.revision,
        sourceText: data.sourceText || entry.content,
        status: data.status || 'completed',
        offsetEncoding: data.offsetEncoding || 'utf-16',
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
        revision: saved.revision ?? entry.revision,
        updatedAt: saved.updatedAt || new Date().toISOString(),
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

  async fetchEntry(entryId: string): Promise<JournalEntry | null> {
    try {
      const response = await fetch(`${API_BASE}/entries/${entryId}`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  async deleteEntry(entryId: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE}/entries/${entryId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return response.ok;
    } catch {
      // Offline fallback: treat as succeeded locally
      return true;
    }
  }

  async submitDecisions(
    entryId: string,
    expectedRevision: number,
    decisions: Array<{ suggestionId: string; action: 'accepted' | 'dismissed' }>
  ): Promise<JournalEntry | null> {
    try {
      const response = await fetch(`${API_BASE}/entries/${entryId}/decisions`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          expectedRevision,
          requestId: `req-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          decisions,
        }),
      });
      if (!response.ok) {
        throw new Error(`Decision submit failed: ${response.status}`);
      }
      const data = await response.json();
      if (data && data.entry) {
        return {
          id: data.entry.id,
          title: data.entry.title,
          targetLanguage: data.entry.targetLanguage,
          content: data.entry.content,
          revision: data.entry.revision,
          createdAt: data.entry.createdAt,
          updatedAt: data.entry.updatedAt,
        };
      }
      return null;
    } catch (err) {
      console.error('Failed to submit decisions:', err);
      return null;
    }
  }

  async submitDecision(
    entryId: string,
    expectedRevision: number,
    suggestionId: string,
    action: 'accepted' | 'dismissed'
  ): Promise<JournalEntry | null> {
    return this.submitDecisions(entryId, expectedRevision, [{ suggestionId, action }]);
  }

  async fetchInsights(): Promise<import('../types/journal').InsightsData | null> {
    try {
      const response = await fetch(`${API_BASE}/insights`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) throw new Error('Insights fetch failed');
      return await response.json();
    } catch {
      return null;
    }
  }
}
