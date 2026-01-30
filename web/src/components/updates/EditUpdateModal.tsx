import { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import type { Update } from '../../types';

interface EditUpdateModalProps {
  isOpen: boolean;
  update: Update | null;
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
}

const MAX_CHARACTERS = 5000;

export function EditUpdateModal({
  isOpen,
  update,
  onSave,
  onCancel,
}: EditUpdateModalProps) {
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialize content when update changes
  useEffect(() => {
    if (update) {
      setContent(update.content);
      setError(null);
    }
  }, [update]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
        // Move cursor to end
        textareaRef.current?.setSelectionRange(
          textareaRef.current.value.length,
          textareaRef.current.value.length
        );
      }, 100);
    }
  }, [isOpen]);

  // Handle ESC key and click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSaving) {
        onCancel();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node) && !isSaving) {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isSaving, onCancel]);

  // Prevent scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const characterCount = content.length;
  const isOverLimit = characterCount > MAX_CHARACTERS;
  const hasChanges = update ? content !== update.content : false;
  const canSave = content.trim().length > 0 && !isOverLimit && hasChanges;

  const handleSave = async () => {
    if (!canSave) return;

    setIsSaving(true);
    setError(null);

    try {
      await onSave(content.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save update');
      setIsSaving(false);
    }
  };

  // Handle Ctrl/Cmd + Enter to save
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && canSave) {
      e.preventDefault();
      handleSave();
    }
  };

  if (!isOpen || !update) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-dialog-title"
        className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 id="edit-dialog-title" className="text-lg font-semibold text-gray-900">
            Edit Update
          </h3>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
            aria-label="Close"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 flex-1 overflow-y-auto">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSaving}
            className={cn(
              'w-full min-h-[200px] p-3 rounded-lg border resize-y',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
              isOverLimit
                ? 'border-red-300 bg-red-50'
                : 'border-gray-300 bg-white',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
            placeholder="Write your update..."
          />

          {/* Character count */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">
              Tip: Press Ctrl+Enter to save
            </span>
            <span
              className={cn(
                'text-sm',
                isOverLimit ? 'text-red-500 font-medium' : 'text-gray-400'
              )}
            >
              {characterCount.toLocaleString()} / {MAX_CHARACTERS.toLocaleString()}
            </span>
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Info about images/links */}
          {(update.images?.length || update.link) && (
            <div className="mt-3 p-3 rounded-lg bg-gray-50 border border-gray-200 text-gray-600 text-sm">
              <strong>Note:</strong> Images and link previews cannot be edited. Only the text content can be modified.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className={cn(
              'px-4 py-2 rounded-lg border border-gray-300',
              'text-gray-700 font-medium',
              'hover:bg-gray-100',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors'
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className={cn(
              'px-4 py-2 rounded-lg',
              'bg-primary-600 text-white font-medium',
              'hover:bg-primary-700',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors',
              'flex items-center gap-2'
            )}
          >
            {isSaving ? (
              <>
                <LoadingSpinner />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
