import { useState } from 'react';
import { cn } from '../../lib/utils';

interface CopyLinkInputProps {
  url: string;
  className?: string;
}

export function CopyLinkInput({ url, className }: CopyLinkInputProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Truncate URL for display - shorter on mobile
  const displayUrl = url.length > 30 
    ? url.substring(0, 25) + '...' + url.substring(url.length - 6)
    : url;

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex-1 flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
        <input
          type="text"
          value={displayUrl}
          readOnly
          className="flex-1 min-w-0 px-3 py-2.5 bg-transparent text-gray-700 text-xs sm:text-sm focus:outline-none cursor-default truncate"
          onClick={(e) => e.currentTarget.select()}
        />
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'flex-shrink-0 px-3 sm:px-4 py-2.5 min-h-[44px] border-l border-gray-200 font-medium text-sm transition-all',
            copied
              ? 'bg-green-50 text-green-600'
              : 'bg-white text-gray-600 hover:bg-gray-100 active:bg-gray-200 hover:text-gray-800'
          )}
        >
          {copied ? (
            <span className="flex items-center gap-1.5">
              <CheckIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Copied!</span>
              <span className="sm:hidden">✓</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <CopyIcon className="w-4 h-4" />
              <span>Copy</span>
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}
