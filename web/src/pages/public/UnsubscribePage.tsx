import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { cn } from '../../lib/utils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const DEFAULT_BRAND_COLOR = '#3B82F6';

type Frequency = 'instant' | 'daily' | 'weekly';
type PageState = 'loading' | 'confirm' | 'success' | 'already-unsubscribed' | 'resubscribed' | 'error-invalid' | 'error-server';

interface ProjectInfo {
  id: string;
  name: string;
  brandingLogoUrl: string | null;
  brandingColor: string | null;
}

interface SubscriptionStatus {
  subscribed: boolean;
  frequency?: string;
}

export function UnsubscribePage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [pageState, setPageState] = useState<PageState>('loading');
  const [isProcessing, setIsProcessing] = useState(false);
  const [resubscribeFrequency, setResubscribeFrequency] = useState<Frequency>('instant');

  const brandColor = project?.brandingColor || DEFAULT_BRAND_COLOR;

  // Set dynamic CSS variables for branding
  useEffect(() => {
    if (brandColor) {
      document.documentElement.style.setProperty('--brand-color', brandColor);
      document.documentElement.style.setProperty('--brand-color-light', `${brandColor}15`);
    }
    return () => {
      document.documentElement.style.removeProperty('--brand-color');
      document.documentElement.style.removeProperty('--brand-color-light');
    };
  }, [brandColor]);

  // Update document title
  useEffect(() => {
    document.title = 'Unsubscribe | SitRep';
    return () => {
      document.title = 'SitRep';
    };
  }, []);

  // Fetch project info and subscription status
  const fetchInitialData = useCallback(async () => {
    if (!token || !email) {
      setPageState('error-invalid');
      return;
    }

    try {
      // Fetch project info
      const projectResponse = await fetch(`${API_URL}/api/public/timeline/${token}?limit=0`);
      if (!projectResponse.ok) {
        if (projectResponse.status === 404) {
          setPageState('error-invalid');
          return;
        }
        throw new Error('server');
      }

      const projectData = await projectResponse.json();
      setProject(projectData.project);

      // Check subscription status
      const statusResponse = await fetch(
        `${API_URL}/api/public/timeline/${token}/subscription-status?email=${encodeURIComponent(email)}`
      );
      
      if (!statusResponse.ok) {
        throw new Error('server');
      }

      const statusData: SubscriptionStatus = await statusResponse.json();

      if (statusData.subscribed) {
        setPageState('confirm');
        // Pre-select their current frequency for potential resubscribe
        if (statusData.frequency) {
          setResubscribeFrequency(statusData.frequency as Frequency);
        }
      } else {
        setPageState('already-unsubscribed');
      }
    } catch (err) {
      console.error('Failed to load unsubscribe page:', err);
      setPageState(err instanceof Error && err.message === 'server' ? 'error-server' : 'error-invalid');
    }
  }, [token, email]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Handle unsubscribe
  const handleUnsubscribe = async () => {
    if (!token || !email || isProcessing) return;

    setIsProcessing(true);
    try {
      const response = await fetch(
        `${API_URL}/api/public/timeline/${token}/unsubscribe?email=${encodeURIComponent(email)}`,
        { method: 'DELETE' }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        if (response.status === 404 && data.error === 'Subscription not found') {
          setPageState('already-unsubscribed');
          return;
        }
        throw new Error('Failed to unsubscribe');
      }

      setPageState('success');
    } catch (err) {
      console.error('Unsubscribe failed:', err);
      setPageState('error-server');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle resubscribe
  const handleResubscribe = async () => {
    if (!token || !email || isProcessing) return;

    setIsProcessing(true);
    try {
      const response = await fetch(`${API_URL}/api/public/timeline/${token}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, frequency: resubscribeFrequency }),
      });

      if (!response.ok) {
        throw new Error('Failed to resubscribe');
      }

      setPageState('resubscribed');
    } catch (err) {
      console.error('Resubscribe failed:', err);
      setPageState('error-server');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle going back to timeline
  const handleGoToTimeline = () => {
    if (token) {
      window.location.href = `/p/${token}`;
    }
  };

  // Loading state
  if (pageState === 'loading') {
    return (
      <PageContainer>
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 bg-gray-200 rounded-xl mx-auto mb-4 animate-pulse" />
          <div className="h-6 bg-gray-200 rounded w-48 mx-auto mb-2 animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-32 mx-auto animate-pulse" />
        </div>
      </PageContainer>
    );
  }

  // Invalid token/link error
  if (pageState === 'error-invalid') {
    return (
      <PageContainer>
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <LinkBrokenIcon className="w-8 h-8 sm:w-10 sm:h-10 text-red-500" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">
            Invalid Link
          </h1>
          <p className="text-sm sm:text-base text-gray-600 leading-relaxed max-w-sm mx-auto">
            This unsubscribe link is invalid or has expired. Please check your email for the correct link.
          </p>
        </div>
      </PageContainer>
    );
  }

  // Server error
  if (pageState === 'error-server') {
    return (
      <PageContainer>
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <WarningIcon className="w-8 h-8 sm:w-10 sm:h-10 text-amber-500" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">
            Something went wrong
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 leading-relaxed">
            We couldn't process your request. Please try again later.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto px-6 py-3 min-h-[48px] bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-all duration-200 active:scale-[0.98]"
          >
            Try Again
          </button>
        </div>
      </PageContainer>
    );
  }

  // Confirm unsubscribe
  if (pageState === 'confirm') {
    return (
      <PageContainer brandColor={brandColor} project={project}>
        <div className="animate-fade-in">
          <div className="text-center mb-6">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6"
              style={{ backgroundColor: `${brandColor}15` }}
            >
              <UnsubscribeIcon className="w-8 h-8 sm:w-10 sm:h-10" style={{ color: brandColor }} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">
              Unsubscribe from Updates
            </h1>
            <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
              You're about to unsubscribe from updates for
            </p>
            <p className="text-base sm:text-lg font-semibold text-gray-900 mt-1">
              "{project?.name}"
            </p>
          </div>

          {/* Email display */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <EmailIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500 mb-0.5">Email</p>
                <p className="text-sm sm:text-base text-gray-900 font-medium truncate">
                  {email}
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleUnsubscribe}
              disabled={isProcessing}
              className={cn(
                'flex-1 px-5 py-3 rounded-lg font-medium text-white',
                'min-h-[48px]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-all duration-200 active:scale-[0.98]'
              )}
              style={{ backgroundColor: '#EF4444' }}
            >
              {isProcessing ? <LoadingSpinner className="w-5 h-5 mx-auto" /> : 'Unsubscribe'}
            </button>
            <button
              type="button"
              onClick={handleGoToTimeline}
              disabled={isProcessing}
              className={cn(
                'flex-1 px-5 py-3 rounded-lg font-medium',
                'min-h-[48px]',
                'border-2 transition-all duration-200 active:scale-[0.98]',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              style={{ borderColor: brandColor, color: brandColor }}
            >
              Cancel - Keep Subscription
            </button>
          </div>
        </div>
      </PageContainer>
    );
  }

  // Successfully unsubscribed
  if (pageState === 'success') {
    return (
      <PageContainer brandColor={brandColor} project={project}>
        <div className="animate-fade-in">
          <div className="text-center mb-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <CheckIcon className="w-8 h-8 sm:w-10 sm:h-10 text-green-600" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">
              Successfully Unsubscribed
            </h1>
            <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
              You won't receive any more updates for
            </p>
            <p className="text-base sm:text-lg font-semibold text-gray-900 mt-1">
              "{project?.name}"
            </p>
          </div>

          {/* Resubscribe option */}
          <div className="bg-gray-50 rounded-lg p-4 sm:p-5 mb-4">
            <p className="text-sm sm:text-base text-gray-700 font-medium mb-3">
              Changed your mind?
            </p>

            {/* Frequency selector */}
            <div className="flex flex-col gap-2 mb-4">
              {(['instant', 'daily', 'weekly'] as Frequency[]).map((freq) => (
                <label
                  key={freq}
                  className={cn(
                    'flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 rounded-lg cursor-pointer',
                    'border transition-all duration-200',
                    'min-h-[44px]',
                    resubscribeFrequency === freq
                      ? 'border-transparent bg-white shadow-sm'
                      : 'border-transparent hover:bg-gray-100'
                  )}
                  style={resubscribeFrequency === freq ? {
                    borderColor: brandColor,
                  } : undefined}
                >
                  <input
                    type="radio"
                    name="frequency"
                    value={freq}
                    checked={resubscribeFrequency === freq}
                    onChange={(e) => setResubscribeFrequency(e.target.value as Frequency)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      'text-sm font-medium',
                      resubscribeFrequency === freq ? '' : 'text-gray-600'
                    )}
                    style={resubscribeFrequency === freq ? { color: brandColor } : undefined}
                  >
                    {freq === 'instant' ? 'Instant updates' : freq === 'daily' ? 'Daily digest' : 'Weekly digest'}
                  </span>
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={handleResubscribe}
              disabled={isProcessing}
              className={cn(
                'w-full px-5 py-3 rounded-lg font-medium text-white',
                'min-h-[48px]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-all duration-200 active:scale-[0.98]'
              )}
              style={{ backgroundColor: brandColor }}
            >
              {isProcessing ? <LoadingSpinner className="w-5 h-5 mx-auto" /> : 'Resubscribe'}
            </button>
          </div>

          {/* Go to timeline link */}
          <button
            type="button"
            onClick={handleGoToTimeline}
            className="w-full text-center text-sm text-gray-500 hover:text-gray-700 py-2"
          >
            View project updates →
          </button>
        </div>
      </PageContainer>
    );
  }

  // Already unsubscribed
  if (pageState === 'already-unsubscribed') {
    return (
      <PageContainer brandColor={brandColor} project={project}>
        <div className="animate-fade-in">
          <div className="text-center mb-6">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <InfoIcon className="w-8 h-8 sm:w-10 sm:h-10 text-gray-500" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">
              Already Unsubscribed
            </h1>
            <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
              You're not subscribed to updates for
            </p>
            <p className="text-base sm:text-lg font-semibold text-gray-900 mt-1">
              "{project?.name}"
            </p>
          </div>

          {/* Email display */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <EmailIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500 mb-0.5">Email</p>
                <p className="text-sm sm:text-base text-gray-900 font-medium truncate">
                  {email}
                </p>
              </div>
            </div>
          </div>

          {/* Resubscribe option */}
          <div className="bg-gray-50 rounded-lg p-4 sm:p-5 mb-4">
            <p className="text-sm sm:text-base text-gray-700 font-medium mb-3">
              Want to resubscribe?
            </p>

            {/* Frequency selector */}
            <div className="flex flex-col gap-2 mb-4">
              {(['instant', 'daily', 'weekly'] as Frequency[]).map((freq) => (
                <label
                  key={freq}
                  className={cn(
                    'flex items-center justify-center sm:justify-start gap-2 px-4 py-2.5 rounded-lg cursor-pointer',
                    'border transition-all duration-200',
                    'min-h-[44px]',
                    resubscribeFrequency === freq
                      ? 'border-transparent bg-white shadow-sm'
                      : 'border-transparent hover:bg-gray-100'
                  )}
                  style={resubscribeFrequency === freq ? {
                    borderColor: brandColor,
                  } : undefined}
                >
                  <input
                    type="radio"
                    name="frequency"
                    value={freq}
                    checked={resubscribeFrequency === freq}
                    onChange={(e) => setResubscribeFrequency(e.target.value as Frequency)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      'text-sm font-medium',
                      resubscribeFrequency === freq ? '' : 'text-gray-600'
                    )}
                    style={resubscribeFrequency === freq ? { color: brandColor } : undefined}
                  >
                    {freq === 'instant' ? 'Instant updates' : freq === 'daily' ? 'Daily digest' : 'Weekly digest'}
                  </span>
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={handleResubscribe}
              disabled={isProcessing}
              className={cn(
                'w-full px-5 py-3 rounded-lg font-medium text-white',
                'min-h-[48px]',
                'disabled:opacity-50 disabled:cursor-not-allowed',
                'transition-all duration-200 active:scale-[0.98]'
              )}
              style={{ backgroundColor: brandColor }}
            >
              {isProcessing ? <LoadingSpinner className="w-5 h-5 mx-auto" /> : 'Subscribe'}
            </button>
          </div>

          {/* Go to timeline link */}
          <button
            type="button"
            onClick={handleGoToTimeline}
            className="w-full text-center text-sm text-gray-500 hover:text-gray-700 py-2"
          >
            View project updates →
          </button>
        </div>
      </PageContainer>
    );
  }

  // Successfully resubscribed
  if (pageState === 'resubscribed') {
    return (
      <PageContainer brandColor={brandColor} project={project}>
        <div className="animate-fade-in">
          <div className="text-center mb-6">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6"
              style={{ backgroundColor: `${brandColor}15` }}
            >
              <BellIcon className="w-8 h-8 sm:w-10 sm:h-10" style={{ color: brandColor }} />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">
              Welcome Back!
            </h1>
            <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
              You're now subscribed to{' '}
              <span className="font-semibold text-gray-900">
                {resubscribeFrequency === 'instant' ? 'instant' : resubscribeFrequency}
              </span>
              {' '}updates for
            </p>
            <p className="text-base sm:text-lg font-semibold text-gray-900 mt-1">
              "{project?.name}"
            </p>
          </div>

          {/* Email display */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3">
              <EmailIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500 mb-0.5">Notifications will be sent to</p>
                <p className="text-sm sm:text-base text-gray-900 font-medium truncate">
                  {email}
                </p>
              </div>
            </div>
          </div>

          {/* Go to timeline */}
          <button
            type="button"
            onClick={handleGoToTimeline}
            className={cn(
              'w-full px-5 py-3 rounded-lg font-medium text-white',
              'min-h-[48px]',
              'transition-all duration-200 active:scale-[0.98]'
            )}
            style={{ backgroundColor: brandColor }}
          >
            View Project Updates
          </button>
        </div>
      </PageContainer>
    );
  }

  return null;
}

// Page container component
function PageContainer({
  children,
  brandColor,
  project,
}: {
  children: React.ReactNode;
  brandColor?: string;
  project?: ProjectInfo | null;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col">
      {/* Header brand stripe */}
      {brandColor && (
        <div className="h-1 w-full" style={{ backgroundColor: brandColor }} />
      )}

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Project branding */}
          {project && (
            <div className="text-center mb-6 animate-fade-in">
              {project.brandingLogoUrl ? (
                <img
                  src={project.brandingLogoUrl}
                  alt={project.name}
                  className="h-10 sm:h-12 mx-auto object-contain max-w-[180px]"
                />
              ) : (
                <div
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mx-auto text-white font-bold text-lg sm:text-xl shadow-lg"
                  style={{ backgroundColor: brandColor || DEFAULT_BRAND_COLOR }}
                >
                  {project.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          )}

          {/* Card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 sm:p-6">
            {children}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-md mx-auto px-4 py-4 sm:py-6">
          <p className="text-center text-xs sm:text-sm text-gray-500">
            Powered by{' '}
            <a
              href="/"
              className="font-semibold hover:underline transition-colors"
              style={{ color: brandColor || DEFAULT_BRAND_COLOR }}
            >
              SitRep
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

// Icons
function LinkBrokenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function UnsubscribeIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
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

function BellIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
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

export default UnsubscribePage;
