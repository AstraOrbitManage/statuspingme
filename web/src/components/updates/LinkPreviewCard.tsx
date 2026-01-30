import { cn } from '../../lib/utils';

interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  imageUrl: string | null;
  domain: string;
}

interface LinkPreviewCardProps {
  preview: LinkPreviewData;
  onRemove?: () => void;
  isLoading?: boolean;
  error?: string;
  className?: string;
}

export function LinkPreviewCard({
  preview,
  onRemove,
  isLoading = false,
  error,
  className,
}: LinkPreviewCardProps) {
  if (error) {
    return (
      <div className={cn(
        'rounded-lg border border-red-200 bg-red-50 p-3',
        className
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-red-600">
            <ErrorIcon className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1 text-red-400 hover:text-red-600 transition-colors"
              title="Remove"
            >
              <XIcon className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn(
        'rounded-lg border border-gray-200 bg-gray-50 p-3',
        className
      )}>
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 bg-gray-200 rounded animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
            <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
            <div className="h-3 bg-gray-200 rounded w-1/4 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'relative rounded-lg border border-gray-200 bg-white overflow-hidden',
      'hover:border-gray-300 transition-colors',
      className
    )}>
      <a
        href={preview.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex gap-3 p-3"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image - responsive sizing */}
        {preview.imageUrl && (
          <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded overflow-hidden bg-gray-100">
            <img
              src={preview.imageUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                // Hide image on error
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          {preview.title && (
            <h4 className="font-medium text-gray-900 line-clamp-2 text-sm break-words">
              {preview.title}
            </h4>
          )}

          {/* Description */}
          {preview.description && (
            <p className="text-gray-500 text-xs mt-1 line-clamp-2 break-words">
              {preview.description}
            </p>
          )}

          {/* Domain */}
          <div className="flex items-center gap-1 mt-2 text-gray-400 text-xs">
            <LinkIcon className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{preview.domain}</span>
          </div>
        </div>
      </a>

      {/* Remove button - larger touch target */}
      {onRemove && (
        <div className="absolute top-2 right-2">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove();
            }}
            className="p-2 min-w-[36px] min-h-[36px] bg-gray-800/60 hover:bg-gray-800/80 text-white rounded-full transition-colors flex items-center justify-center"
            title="Remove link preview"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// Compact version for preview display
export function LinkPreviewCompact({
  preview,
  onRemove,
}: {
  preview: LinkPreviewData;
  onRemove?: () => void;
}) {
  return (
    <div className="relative group rounded-lg border border-gray-200 bg-gray-50 overflow-hidden">
      <a
        href={preview.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image thumbnail */}
        {preview.imageUrl ? (
          <div className="flex-shrink-0 w-12 h-12 rounded overflow-hidden bg-gray-100">
            <img
              src={preview.imageUrl}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        ) : (
          <div className="flex-shrink-0 w-12 h-12 rounded bg-gray-100 flex items-center justify-center">
            <LinkIcon className="w-5 h-5 text-gray-400" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-gray-900 text-sm truncate">
            {preview.title || preview.url}
          </h4>
          <div className="flex items-center gap-1 text-gray-400 text-xs">
            <span>{preview.domain}</span>
          </div>
        </div>
      </a>

      {/* Remove button */}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-1 right-1 p-1 bg-gray-600 hover:bg-gray-700 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remove link preview"
        >
          <XIcon className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// Icons
function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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

function ErrorIcon({ className }: { className?: string }) {
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
