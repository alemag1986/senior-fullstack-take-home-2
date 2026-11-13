import React, { useEffect, useRef, useState } from 'react';
import { ActiveSuggestion } from '../../types/journal';
import { InlineDecorations } from './InlineDecorations';
import { SuggestionPopover } from './SuggestionPopover';

interface BlankCanvasProps {
  content: string;
  activeSuggestions: ActiveSuggestion[];
  selectedSuggestionId: string | null;
  onChange: (value: string) => void;
  onSelectSuggestion: (id: string | null, rect?: DOMRect) => void;
  onAcceptSuggestion: (id: string) => void;
  onDismissSuggestion: (id: string) => void;
  isStale?: boolean;
  isSidePanelOpen?: boolean;
}

export const BlankCanvas: React.FC<BlankCanvasProps> = ({
  content,
  activeSuggestions,
  selectedSuggestionId,
  onChange,
  onSelectSuggestion,
  onAcceptSuggestion,
  onDismissSuggestion,
  isStale,
  isSidePanelOpen,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [popoverAnchor, setPopoverAnchor] = useState<DOMRect | null>(null);

  // Auto-focus immediately on mount with cursor on top
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(0, 0);
    }
  }, []);

  // Auto-resize textarea to fit content height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(window.innerHeight - 160, textareaRef.current.scrollHeight)}px`;
    }
  }, [content]);

  // Handle Tab indentation (insert 2 spaces)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + '  ' + content.substring(end);

      onChange(newContent);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleSuggestionClick = (id: string, rect?: DOMRect) => {
    onSelectSuggestion(id);
    if (rect) {
      setPopoverAnchor(rect);
    }
  };

  const pendingSuggestions = activeSuggestions.filter((s) => s.state === 'pending');
  const selectedSuggestion = pendingSuggestions.find((s) => s.id === selectedSuggestionId);
  const selectedIndex = selectedSuggestion
    ? pendingSuggestions.findIndex((s) => s.id === selectedSuggestion.id)
    : -1;

  const hasDecorations = pendingSuggestions.length > 0 && !isStale;

  return (
    <div
      className={`relative w-full max-w-2xl mx-auto min-h-[calc(100vh-120px)] pt-12 pb-32 px-6 transition-all duration-300 ${
        isSidePanelOpen ? 'lg:mr-96 lg:max-w-xl xl:max-w-2xl' : ''
      }`}
    >
      {/* Distraction-Free Writing Canvas */}
      <div className="relative font-mono text-lg leading-[1.75] tracking-tight">
        {/* If we have active suggestions, render the decoration view alongside textarea */}
        {hasDecorations ? (
          <div className="relative min-h-[calc(100vh-160px)]">
            {/* Interactive Decorations Layer */}
            <div
              data-testid="decorated-canvas"
              onClick={(e) => {
                // Focus hidden textarea when clicking on background/plain text
                if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === 'SPAN') {
                  textareaRef.current?.focus();
                }
              }}
              className="relative z-10 w-full min-h-[calc(100vh-160px)] whitespace-pre-wrap select-text text-zinc-900 dark:text-zinc-100 cursor-text"
            >
              <InlineDecorations
                text={content}
                activeSuggestions={activeSuggestions}
                selectedSuggestionId={selectedSuggestionId}
                onSelectSuggestion={handleSuggestionClick}
              />
            </div>

            {/* Hidden / sync textarea behind for typing edits */}
            <textarea
              ref={textareaRef}
              data-testid="journal-textarea"
              value={content}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              className="absolute inset-0 z-0 w-full h-full opacity-0 cursor-text resize-none p-0 border-none outline-none focus:ring-0"
              placeholder="Start writing in your target language..."
            />
          </div>
        ) : (
          /* Pure distraction-free blank textarea */
          <textarea
            ref={textareaRef}
            data-testid="journal-textarea"
            value={content}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            className="w-full min-h-[calc(100vh-160px)] bg-transparent resize-none border-none outline-none focus:ring-0 p-0 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-300 dark:placeholder:text-zinc-700 caret-[#00a8ff]"
            placeholder="Start writing..."
          />
        )}
      </div>

      {/* Floating Popover for Selected Suggestion (only when side panel is closed) */}
      {selectedSuggestion && !isSidePanelOpen && (
        <SuggestionPopover
          suggestion={selectedSuggestion}
          anchorRect={popoverAnchor}
          currentIndex={selectedIndex}
          totalCount={pendingSuggestions.length}
          onAccept={(id) => {
            onAcceptSuggestion(id);
            setPopoverAnchor(null);
          }}
          onDismiss={(id) => {
            onDismissSuggestion(id);
            setPopoverAnchor(null);
          }}
          onClose={() => {
            onSelectSuggestion(null);
            setPopoverAnchor(null);
            textareaRef.current?.focus();
          }}
        />
      )}
    </div>
  );
};
