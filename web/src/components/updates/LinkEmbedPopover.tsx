import { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface LinkEmbedPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (url: string) => void;
  isLoading?: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
}

export function LinkEmbedPopover({
  isOpen,
  onClose,
  onSubmit,
  isLoading = false,
  anchorRef,
}: LinkEmbedPopoverProps) {
  const [url, setUrl] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setUrl('');
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        isOpen &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose, anchorRef]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed) {
      onSubmit(trimmed);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={popoverRef}
      className={cn(
        'absolute z-50 mt-1',
        'bg-white rounded-lg shadow-lg border border-gray-200',
        'p-3 w-80',
        'animate-in fade-in slide-in-from-top-1 duration-150'
      )}
      style={{
        top: '100%',
        left: 0,
      }}
    >
      <form onSubmit={handleSubmit}>
        <label htmlFor="link-url" className="block text-sm font-medium text-gray-700 mb-1.5">
          Add link preview
        </label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            id="link-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            disabled={isLoading}
            className={cn(
              'flex-1 px-3 py-1.5 text-sm rounded-md border border-gray-300',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
              'placeholder:text-gray-400',
              'disabled:bg-gray-50 disabled:text-gray-500'
            )}
          />
          <button
            type="submit"
            disabled={!url.trim() || isLoading}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md',
              'bg-primary-600 text-white',
              'hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
              'disabled:bg-gray-300 disabled:cursor-not-allowed',
              'transition-colors'
            )}
          >
            {isLoading ? (
              <LoadingSpinner className="w-4 h-4" />
            ) : (
              'Add'
            )}
          </button>
        </div>
        <p className="mt-1.5 text-xs text-gray-500">
          Paste a URL to show a preview card
        </p>
      </form>
    </div>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      fill="none"
      viewBox="0 0 24 24"
    >
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
