import React, { useEffect, useRef } from 'react';

interface ModalBackdropProps {
  children: React.ReactNode;
  onClose: () => void;
  title?: string;
}

export const ModalBackdrop: React.FC<ModalBackdropProps> = ({ children, onClose, title }) => {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      role="dialog"
      aria-label={title || 'Dialog'}
      onClick={(e) => {
        if (e.target === backdropRef.current) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden animate-in zoom-in-95 font-sans">
        {children}
      </div>
    </div>
  );
};
