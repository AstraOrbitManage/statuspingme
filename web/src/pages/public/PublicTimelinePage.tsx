import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { UpdateCard } from '../../components/updates/UpdateCard';
import { SubscribeForm } from '../../components/public/SubscribeForm';
import { ArchivedBanner } from '../../components/ui/ArchivedBanner';
import { cn } from '../../lib/utils';
import type { Update } from '../../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface ProjectInfo {
  id: string;
  name: string;
  clientName: string | null;
  status: string;
  brandingLogoUrl: string | null;
  brandingColor: string | null;
}

interface PublicTimelineResponse {
  project: ProjectInfo;
  updates: Update[];
  total: number;
  hasMore: boolean;
}

const UPDATES_PER_PAGE = 10;
const DEFAULT_BRAND_COLOR = '#3B82F6'; // Blue-500

export function PublicTimelinePage() {
  const { token } = useParams<{ token: string }>();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [updates, setUpdates] = useState<Update[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Brand color with fallback
  const brandColor = project?.brandingColor || DEFAULT_BRAND_COLOR;

  // Compute last update time
  const lastUpdateTime = useMemo(() => {
    if (updates.length === 0) return null;
    const latest = updates[0];
    return formatDistanceToNow(new Date(latest.createdAt), { addSuffix: true });
  }, [updates]);

  // Set dynamic CSS variables for branding
  useEffect(() => {
    if (brandColor) {
      document.documentElement.style.setProperty('--brand-color', brandColor);
      // Create lighter variant for backgrounds
      document.documentElement.style.setProperty('--brand-color-light', `${brandColor}15`);
    }
    return () => {
      document.documentElement.style.removeProperty('--brand-color');
      document.documentElement.style.removeProperty('--brand-color-light');
    };
  }, [brandColor]);

  // Update document title with project name
  useEffect(() => {
    if (project?.name) {
      document.title = `${project.name} Updates | StatusPing`;
    }
    return () => {
      document.title = 'StatusPing';
    };
  }, [project?.name]);

  // Fetch timeline data
  const fetchTimeline = useCallback(async (offset = 0) => {
    const response = await fetch(
      `${API_URL}/api/public/timeline/${token}?limit=${UPDATES_PER_PAGE}&offset=${offset}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('invalid');
      }
      throw new Error('server');
    }

    return response.json() as Promise<PublicTimelineResponse>;
  }, [token]);

  // Initial load
  useEffect(() => {
    let cancelled = false;

    async function loadTimeline() {
      if (!token) {
        setError('invalid');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchTimeline();
        if (!cancelled) {
          setProject(data.project);
          setUpdates(data.updates);
          setHasMore(data.hasMore);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'server');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadTimeline();

    return () => {
      cancelled = true;
    };
  }, [token, fetchTimeline]);

  // Load more updates
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const data = await fetchTimeline(updates.length);
      setUpdates((prev) => [...prev, ...data.updates]);
      setHasMore(data.hasMore);
    } catch {
      // Silent fail on load more - user can try again
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Loading state - mobile optimized
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
          {/* Header skeleton */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="h-12 w-12 sm:h-16 sm:w-16 bg-gray-200 rounded-xl mx-auto mb-3 sm:mb-4 animate-pulse" />
            <div className="h-6 sm:h-8 bg-gray-200 rounded-lg w-40 sm:w-48 mx-auto mb-2 animate-pulse" />
            <div className="h-4 sm:h-5 bg-gray-200 rounded w-28 sm:w-32 mx-auto animate-pulse" />
          </div>

          {/* Update skeletons */}
          <div className="space-y-3 sm:space-y-4">
            {[...Array(3)].map((_, i) => (
              <div 
                key={i} 
                className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="h-3 sm:h-4 bg-gray-200 rounded w-28 sm:w-32 mb-3 sm:mb-4 animate-pulse" />
                <div className="space-y-2">
                  <div className="h-3 sm:h-4 bg-gray-200 rounded w-full animate-pulse" />
                  <div className="h-3 sm:h-4 bg-gray-200 rounded w-5/6 animate-pulse" />
                  <div className="h-3 sm:h-4 bg-gray-200 rounded w-4/6 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state - invalid link (mobile optimized)
  if (error === 'invalid') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md mx-auto text-center animate-fade-in">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <LinkBrokenIcon className="w-8 h-8 sm:w-10 sm:h-10 text-red-500" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">
            Link Not Found
          </h1>
          <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
            This link is invalid or has been revoked. Please contact the project owner for a new link.
          </p>
        </div>
      </div>
    );
  }

  // Error state - server error (mobile optimized)
  if (error === 'server') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="max-w-md mx-auto text-center animate-fade-in">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
            <WarningIcon className="w-8 h-8 sm:w-10 sm:h-10 text-amber-500" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 sm:mb-3">
            Something went wrong
          </h1>
          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 leading-relaxed">
            We couldn't load this page. Please try again later.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full sm:w-auto px-6 py-3 min-h-[48px] bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-all duration-200 active:scale-[0.98]"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Check if project is archived
  const isArchived = project?.status === 'archived';

  return (
    <div className={cn(
      "min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col",
      isArchived && "bg-gradient-to-b from-gray-100 to-gray-150"
    )}>
      {/* Header - mobile optimized */}
      <header className={cn(
        "bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm",
        isArchived && "bg-gray-50"
      )}>
        <div 
          className="h-1 w-full"
          style={{ 
            backgroundColor: isArchived ? '#9CA3AF' : brandColor,
            opacity: isArchived ? 0.6 : 1
          }}
        />
        <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6">
          <div className="text-center animate-fade-in">
            {project?.brandingLogoUrl ? (
              <img
                src={project.brandingLogoUrl}
                alt={project.name}
                className={cn(
                  "h-12 sm:h-14 mx-auto mb-2 sm:mb-3 object-contain max-w-[200px]",
                  isArchived && "opacity-60 grayscale"
                )}
              />
            ) : (
              <div 
                className={cn(
                  "w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center mx-auto mb-2 sm:mb-3 text-white font-bold text-xl sm:text-2xl shadow-lg",
                  isArchived && "opacity-70"
                )}
                style={{ backgroundColor: isArchived ? '#6B7280' : brandColor }}
              >
                {project?.name.charAt(0).toUpperCase()}
              </div>
            )}
            <h1 className={cn(
              "text-xl sm:text-2xl font-bold px-2 break-words",
              isArchived ? "text-gray-600" : "text-gray-900"
            )}>
              {project?.name}
            </h1>
            {project?.clientName && (
              <p className="text-sm sm:text-base text-gray-500 mt-1 px-2 break-words">
                For: {project.clientName}
              </p>
            )}
            {lastUpdateTime && (
              <p className="text-xs sm:text-sm text-gray-400 mt-2 flex items-center justify-center gap-1">
                <ClockIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                <span>Last update {lastUpdateTime}</span>
              </p>
            )}
          </div>
        </div>
      </header>

      {/* Archived banner */}
      {isArchived && (
        <div className="max-w-2xl mx-auto w-full px-4 pt-6">
          <ArchivedBanner variant="public" />
        </div>
      )}

      {/* Main content - mobile optimized */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 sm:py-8">
        {/* Empty state */}
        {updates.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 sm:p-12 text-center shadow-sm animate-fade-in">
            <div 
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-5"
              style={{ backgroundColor: `${brandColor}15` }}
            >
              <EmptyIcon className="w-8 h-8 sm:w-10 sm:h-10" style={{ color: brandColor }} />
            </div>
            <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
              No updates yet
            </h3>
            <p className="text-sm sm:text-base text-gray-500 max-w-sm mx-auto">
              Check back soon for updates on this project. The team is hard at work!
            </p>
          </div>
        ) : (
          <>
            {/* Updates timeline - responsive spacing */}
            <div className="space-y-3 sm:space-y-4">
              {updates.map((update, index) => (
                <div
                  key={update.id}
                  className="animate-fade-in-up"
                  style={{ 
                    animationDelay: `${Math.min(index * 50, 300)}ms`,
                    animationFillMode: 'both'
                  }}
                >
                  <UpdateCard
                    update={update}
                    isOwner={false}
                    className="shadow-sm hover:shadow-md transition-shadow duration-300"
                  />
                </div>
              ))}
            </div>

            {/* Load more button - touch-friendly */}
            {hasMore && (
              <div className="text-center pt-8 animate-fade-in">
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className={cn(
                    'w-full sm:w-auto px-6 py-4 sm:py-3 rounded-xl border-2 bg-white',
                    'font-medium',
                    'min-h-[48px]', // Touch-friendly minimum height
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'transition-all duration-200',
                    'hover:shadow-md active:scale-[0.98]'
                  )}
                  style={{ 
                    borderColor: brandColor,
                    color: brandColor
                  }}
                >
                  {isLoadingMore ? (
                    <span className="flex items-center justify-center gap-2">
                      <LoadingSpinner />
                      Loading...
                    </span>
                  ) : (
                    'Load more updates'
                  )}
                </button>
              </div>
            )}

            {/* Subscribe form - hidden for archived projects */}
            {token && !isArchived && (
              <div className="mt-8 sm:mt-12">
                <SubscribeForm 
                  token={token} 
                  brandColor={brandColor}
                  apiUrl={API_URL}
                />
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer - mobile optimized */}
      <footer className="border-t border-gray-200 bg-white mt-auto">
        <div className="max-w-2xl mx-auto px-4 py-4 sm:py-6">
          <p className="text-center text-xs sm:text-sm text-gray-500">
            Powered by{' '}
            <a
              href="/"
              className="font-semibold hover:underline transition-colors"
              style={{ color: brandColor }}
            >
              StatusPing
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
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 3l18 18"
      />
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

function EmptyIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
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

export default PublicTimelinePage;
