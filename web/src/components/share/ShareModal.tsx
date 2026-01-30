import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import { CopyLinkInput } from './CopyLinkInput';
import { QRCode } from './QRCode';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  magicLinkToken: string;
  onRegenerateLink?: () => Promise<void>;
}

export function ShareModal({
  isOpen,
  onClose,
  projectName,
  magicLinkToken,
  onRegenerateLink,
}: ShareModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  // Construct the full share URL
  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${appUrl}/p/${magicLinkToken}`;

  // Email share content
  const emailSubject = `Project updates for ${projectName}`;
  const emailBody = `Hi,

I wanted to share a link where you can view real-time updates for ${projectName}:

${shareUrl}

You can bookmark this link to check back anytime for the latest project status.

Best regards`;

  const emailLink = `mailto:?subject=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  // Handle ESC key and click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isRegenerating) {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node) && !isRegenerating) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isRegenerating, onClose]);

  // Prevent scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  const handleRegenerate = async () => {
    if (!onRegenerateLink) return;
    
    setIsRegenerating(true);
    try {
      await onRegenerateLink();
      setShowRegenerateConfirm(false);
    } catch (err) {
      console.error('Failed to regenerate link:', err);
    } finally {
      setIsRegenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Dialog - mobile optimized */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-dialog-title"
        className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
      >
        {/* Header - mobile optimized */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <h3 id="share-dialog-title" className="text-base sm:text-lg font-semibold text-gray-900">
            Share with your client
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isRegenerating}
            className="p-2 -m-1 min-w-[44px] min-h-[44px] rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 flex items-center justify-center"
            aria-label="Close"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content - responsive padding */}
        <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-5 sm:space-y-6">
          {/* Client Link Section */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <LinkIcon className="w-4 h-4 flex-shrink-0" />
              Client Link
            </label>
            <CopyLinkInput url={shareUrl} />
          </div>

          {/* QR Code Section - responsive layout */}
          <div className="flex flex-col sm:flex-row items-center gap-4 py-4 border-y border-gray-100">
            {/* Larger QR code for better scanning on tablets */}
            <QRCode value={shareUrl} size={160} className="flex-shrink-0" />
            <div className="flex-1 text-center sm:text-left">
              <p className="font-medium text-gray-900">Scan to view updates</p>
              <p className="text-sm text-gray-500 mt-1">
                Your client can scan this QR code with their phone to instantly access project updates.
              </p>
            </div>
          </div>

          {/* Preview Section */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
              👁️ What your client sees
            </p>
            <p className="text-xs sm:text-sm text-gray-600">
              A clean timeline of project updates, status indicators, and any images or links you share. No login required.
            </p>
          </div>

          {/* Actions - touch-friendly buttons */}
          <div className="space-y-3">
            {/* Email share */}
            <a
              href={emailLink}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg',
                'min-h-[48px]', // Touch-friendly
                'border border-gray-300 text-gray-700 font-medium',
                'hover:bg-gray-50 active:bg-gray-100 transition-colors'
              )}
            >
              <EmailIcon className="w-5 h-5" />
              Send via Email
            </a>

            {/* Regenerate link */}
            {onRegenerateLink && (
              showRegenerateConfirm ? (
                <div className="p-3 sm:p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800 mb-3">
                    ⚠️ This will invalidate the current link. Your client will need the new link to access updates.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRegenerateConfirm(false)}
                      disabled={isRegenerating}
                      className="flex-1 px-3 py-3 min-h-[44px] text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 active:bg-gray-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleRegenerate}
                      disabled={isRegenerating}
                      className="flex-1 px-3 py-3 min-h-[44px] text-sm font-medium text-white bg-amber-600 rounded-md hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50"
                    >
                      {isRegenerating ? 'Regenerating...' : 'Confirm'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowRegenerateConfirm(true)}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg',
                    'min-h-[48px]', // Touch-friendly
                    'text-gray-500 font-medium',
                    'hover:bg-gray-100 active:bg-gray-200 transition-colors'
                  )}
                >
                  <RefreshIcon className="w-5 h-5" />
                  Regenerate Link
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Icons
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

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  );
}

function EmailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}
