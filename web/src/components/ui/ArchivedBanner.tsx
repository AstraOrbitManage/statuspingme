import { cn } from '../../lib/utils';

interface ArchivedBannerProps {
  variant?: 'public' | 'owner';
  className?: string;
}

export function ArchivedBanner({ variant = 'public', className }: ArchivedBannerProps) {
  const isPublic = variant === 'public';

  return (
    <div
      className={cn(
        'rounded-xl border p-4 animate-fade-in',
        isPublic
          ? 'bg-amber-50 border-amber-200'
          : 'bg-gray-50 border-gray-200',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
            isPublic ? 'bg-amber-100' : 'bg-gray-200'
          )}
        >
          <ArchiveIcon
            className={cn(
              'w-5 h-5',
              isPublic ? 'text-amber-600' : 'text-gray-500'
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <h3
            className={cn(
              'font-semibold',
              isPublic ? 'text-amber-800' : 'text-gray-700'
            )}
          >
            {isPublic ? 'This project has been archived' : 'Project Archived'}
          </h3>
          <p
            className={cn(
              'text-sm mt-0.5',
              isPublic ? 'text-amber-700' : 'text-gray-500'
            )}
          >
            {isPublic
              ? 'Updates are no longer being posted, but you can still view the history.'
              : 'This project is archived. Unarchive it to post new updates.'}
          </p>
        </div>
      </div>
    </div>
  );
}

// Compact badge for inline use
interface ArchivedBadgeProps {
  className?: string;
}

export function ArchivedBadge({ className }: ArchivedBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full',
        'text-xs font-medium',
        'bg-amber-100 text-amber-700 border border-amber-200',
        className
      )}
    >
      <ArchiveIcon className="w-3 h-3" />
      Archived
    </span>
  );
}

function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
      />
    </svg>
  );
}
