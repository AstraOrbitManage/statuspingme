import { useState } from 'react';
import { cn } from '../../lib/utils';

interface SubscribeFormProps {
  token: string;
  brandColor: string;
  apiUrl: string;
}

type Frequency = 'instant' | 'daily' | 'weekly';

export function SubscribeForm({ token, brandColor, apiUrl }: SubscribeFormProps) {
  const [email, setEmail] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('instant');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) return;

    setIsSubmitting(true);
    setStatus('idle');
    setErrorMessage('');

    try {
      const response = await fetch(`${apiUrl}/api/public/timeline/${token}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim(), frequency }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to subscribe');
      }

      setStatus('success');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === 'success') {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6 shadow-sm animate-fade-in">
        <div className="text-center">
          <div 
            className="w-11 h-11 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3"
            style={{ backgroundColor: `${brandColor}20` }}
          >
            <CheckIcon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: brandColor }} />
          </div>
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1">
            You're subscribed!
          </h3>
          <p className="text-gray-600 text-sm">
            We'll notify you when there are new updates.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-6 shadow-sm animate-fade-in">
      <div className="flex items-center gap-2 mb-3 sm:mb-4">
        <BellIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />
        <h3 className="text-base sm:text-lg font-semibold text-gray-900">
          Get notified of new updates
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email input and button - stack on mobile, row on desktop */}
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className={cn(
              'flex-1 px-4 py-3 sm:py-2.5 rounded-lg border border-gray-300',
              'focus:outline-none focus:ring-2 focus:border-transparent',
              'text-gray-900 placeholder-gray-400',
              'transition-shadow',
              'text-base' // Prevents iOS zoom on focus
            )}
            style={{ 
              '--tw-ring-color': `${brandColor}40`,
            } as React.CSSProperties}
            disabled={isSubmitting}
          />
          <button
            type="submit"
            disabled={isSubmitting || !email.trim()}
            className={cn(
              'px-5 py-3 sm:py-2.5 rounded-lg font-medium text-white',
              'min-h-[44px]', // Touch-friendly minimum height
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-all duration-200',
              'hover:opacity-90 active:scale-[0.98]'
            )}
            style={{ backgroundColor: brandColor }}
          >
            {isSubmitting ? (
              <LoadingSpinner className="w-5 h-5 mx-auto" />
            ) : (
              'Subscribe'
            )}
          </button>
        </div>

        {/* Frequency selector - column on mobile, row on desktop */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3">
          <span className="text-sm text-gray-500 sm:self-center">Notify me:</span>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            {(['instant', 'daily', 'weekly'] as Frequency[]).map((freq) => (
              <label
                key={freq}
                className={cn(
                  'flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 sm:px-3 sm:py-1.5 rounded-full cursor-pointer',
                  'border transition-all duration-200',
                  'min-h-[44px] sm:min-h-0', // Touch-friendly on mobile
                  frequency === freq
                    ? 'border-transparent'
                    : 'border-gray-200 hover:border-gray-300'
                )}
                style={frequency === freq ? {
                  backgroundColor: `${brandColor}15`,
                  borderColor: brandColor,
                } : undefined}
              >
                <input
                  type="radio"
                  name="frequency"
                  value={freq}
                  checked={frequency === freq}
                  onChange={(e) => setFrequency(e.target.value as Frequency)}
                  className="sr-only"
                />
                <span 
                  className={cn(
                    'text-sm font-medium capitalize',
                    frequency === freq ? '' : 'text-gray-600'
                  )}
                  style={frequency === freq ? { color: brandColor } : undefined}
                >
                  {freq === 'instant' ? 'Instantly' : freq === 'daily' ? 'Daily digest' : 'Weekly digest'}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Error message */}
        {status === 'error' && (
          <div className="flex items-center gap-2 text-sm text-red-600 animate-shake">
            <AlertIcon className="w-4 h-4" />
            {errorMessage}
          </div>
        )}
      </form>
    </div>
  );
}

// Icons
function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

function CheckIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className)} fill="none" viewBox="0 0 24 24">
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
