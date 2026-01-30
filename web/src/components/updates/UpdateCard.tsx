import { useState, useRef, useEffect } from 'react';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
import { cn } from '../../lib/utils';
import { MarkdownPreview } from './MarkdownPreview';
import { UpdateImageGallery } from './UpdateImageGallery';
import { LinkPreviewCard } from './LinkPreviewCard';
import type { Update } from '../../types';

interface UpdateCardProps {
  update: Update;
  isOwner?: boolean;
  onEdit?: (update: Update) => void;
  onDelete?: (updateId: string) => void;
  className?: string;
}

export function UpdateCard({
  update,
  isOwner = false,
  onEdit,
  onDelete,
  className,
}: UpdateCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    }

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  // Format the timestamp
  const formatTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    
    if (isToday(date)) {
      return `Today at ${format(date, 'h:mm a')}`;
    }
    
    if (isYesterday(date)) {
      return `Yesterday at ${format(date, 'h:mm a')}`;
    }
    
    // Within the last week, show relative time
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 7) {
      return formatDistanceToNow(date, { addSuffix: true });
    }
    
    // Older than a week, show full date
    return format(date, 'MMM d, yyyy');
  };

  const handleEdit = () => {
    setShowMenu(false);
    onEdit?.(update);
  };

  const handleDelete = () => {
    setShowMenu(false);
    // Pass to parent - the parent handles confirmation dialog
    onDelete?.(update.id);
  };

  return (
    <article
      className={cn(
        'rounded-lg border border-gray-200 bg-white shadow-sm',
        'hover:shadow-md transition-shadow duration-200',
        className
      )}
    >
      {/* Header - mobile responsive */}
      <header className="flex items-start sm:items-center justify-between px-3 sm:px-4 py-3 border-b border-gray-100 gap-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 min-w-0 flex-1">
          <time
            dateTime={update.createdAt}
            className="text-xs sm:text-sm text-gray-500 whitespace-nowrap"
            title={format(new Date(update.createdAt), 'PPpp')}
          >
            Posted {formatTimestamp(update.createdAt)}
          </time>
          {update.authorName && (
            <>
              <span className="hidden sm:inline text-gray-300">·</span>
              <span className="text-xs sm:text-sm text-gray-600 truncate">{update.authorName}</span>
            </>
          )}
        </div>

        {/* Actions menu for owners - larger touch target */}
        {isOwner && (onEdit || onDelete) && (
          <div className="relative flex-shrink-0" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 min-w-[44px] min-h-[44px] -m-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center"
              aria-label="Update options"
            >
              <MoreIcon className="w-5 h-5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 mt-1 w-36 rounded-md bg-white shadow-lg border border-gray-200 py-1 z-10">
                {onEdit && (
                  <button
                    type="button"
                    onClick={handleEdit}
                    className="w-full px-4 py-3 sm:py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <EditIcon className="w-4 h-4" />
                    Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="w-full px-4 py-3 sm:py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <TrashIcon className="w-4 h-4" />
                    Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Content - mobile responsive padding */}
      <div className="px-3 sm:px-4 py-3 sm:py-4">
        {/* Markdown content - proper text sizing */}
        <div className="prose prose-sm max-w-none prose-p:text-sm prose-p:leading-relaxed prose-headings:text-base sm:prose-headings:text-lg break-words">
          <MarkdownPreview content={update.content} />
        </div>

        {/* Images */}
        {update.images && update.images.length > 0 && (
          <div className="mt-3 sm:mt-4 -mx-1 sm:mx-0">
            <UpdateImageGallery images={update.images} />
          </div>
        )}

        {/* Link preview */}
        {update.link && (
          <div className="mt-3 sm:mt-4">
            <LinkPreviewCard preview={update.link} />
          </div>
        )}
      </div>
    </article>
  );
}

// Icons
function MoreIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
      />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}
