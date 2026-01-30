import { useState, useEffect, useCallback } from 'react';
import { cn } from '../../lib/utils';
import { UpdateCard } from './UpdateCard';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { EditUpdateModal } from './EditUpdateModal';
import { updatesApi, ApiRequestError } from '../../lib/api';
import type { Update } from '../../types';

interface UpdateTimelineProps {
  projectId: string;
  isOwner?: boolean;
  className?: string;
  onUpdateAdded?: (callback: (update: Update) => void) => void;
}

const UPDATES_PER_PAGE = 10;

export function UpdateTimeline({
  projectId,
  isOwner = false,
  className,
  onUpdateAdded,
}: UpdateTimelineProps) {
  const [updates, setUpdates] = useState<Update[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  // Fetch updates from API
  const fetchUpdates = useCallback(async (offset?: number) => {
    try {
      const response = await updatesApi.list(projectId, {
        limit: UPDATES_PER_PAGE,
        offset: offset,
      });

      return {
        updates: response.updates as Update[],
        hasMore: response.hasMore,
        total: response.total,
      };
    } catch (err) {
      if (err instanceof ApiRequestError) {
        throw new Error(err.message);
      }
      throw err instanceof Error ? err : new Error('Unknown error');
    }
  }, [projectId]);

  // Initial load
  useEffect(() => {
    let cancelled = false;

    async function loadInitialUpdates() {
      setIsLoading(true);
      setError(null);

      try {
        const data = await fetchUpdates();
        if (!cancelled) {
          setUpdates(data.updates);
          setHasMore(data.hasMore);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load updates');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadInitialUpdates();

    return () => {
      cancelled = true;
    };
  }, [fetchUpdates]);

  // Register callback for when new updates are added
  useEffect(() => {
    if (onUpdateAdded) {
      onUpdateAdded((newUpdate: Update) => {
        // Add the new update at the top of the list (optimistic update)
        setUpdates((prev) => [newUpdate, ...prev]);
      });
    }
  }, [onUpdateAdded]);

  // Load more updates
  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const data = await fetchUpdates(updates.length);
      setUpdates((prev) => [...prev, ...data.updates]);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more updates');
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Edit modal state
  const [editingUpdate, setEditingUpdate] = useState<Update | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Delete confirmation dialog state
  const [deleteUpdateId, setDeleteUpdateId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Handle edit update - open modal
  const handleEditUpdate = (update: Update) => {
    setEditingUpdate(update);
    setIsEditModalOpen(true);
  };

  // Handle save from edit modal
  const handleSaveEdit = async (content: string) => {
    if (!editingUpdate) return;

    try {
      const response = await updatesApi.update(projectId, editingUpdate.id, { content });
      
      // Update the update in the list
      setUpdates((prev) =>
        prev.map((u) =>
          u.id === editingUpdate.id
            ? { ...u, content: response.update.content }
            : u
        )
      );

      // Close modal
      setIsEditModalOpen(false);
      setEditingUpdate(null);
    } catch (err) {
      console.error('Edit error:', err);
      const errorMessage = err instanceof ApiRequestError 
        ? err.message 
        : 'Failed to save update. Please try again.';
      throw new Error(errorMessage);
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setIsEditModalOpen(false);
    setEditingUpdate(null);
  };

  // Handle delete update - open confirmation dialog
  const handleDeleteUpdate = (updateId: string) => {
    setDeleteUpdateId(updateId);
    setIsDeleteDialogOpen(true);
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!deleteUpdateId) return;

    setIsDeleting(true);
    try {
      await updatesApi.delete(projectId, deleteUpdateId);
      
      // Remove the update from the list
      setUpdates((prev) => prev.filter((u) => u.id !== deleteUpdateId));

      // Close dialog
      setIsDeleteDialogOpen(false);
      setDeleteUpdateId(null);
    } catch (err) {
      console.error('Delete error:', err);
      const errorMessage = err instanceof ApiRequestError 
        ? err.message 
        : 'Failed to delete update. Please try again.';
      alert(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  // Cancel delete
  const handleCancelDelete = () => {
    setIsDeleteDialogOpen(false);
    setDeleteUpdateId(null);
  };

  // Loading skeleton
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {[...Array(3)].map((_, i) => (
          <UpdateCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error state
  if (error && updates.length === 0) {
    return (
      <div className={cn(
        'rounded-lg border border-red-200 bg-red-50 p-8 text-center',
        className
      )}>
        <ErrorIcon className="w-12 h-12 text-red-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-red-800 mb-2">
          Failed to load updates
        </h3>
        <p className="text-red-600 mb-4">{error}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Empty state
  if (updates.length === 0) {
    return (
      <div className={cn(
        'rounded-lg border border-gray-200 bg-white p-12 text-center',
        className
      )}>
        <EmptyIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          No updates yet
        </h3>
        <p className="text-gray-500 max-w-sm mx-auto">
          {isOwner
            ? "Share what's happening with your project. Post your first update above!"
            : 'This project has no updates yet. Check back later!'}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Updates list */}
      {updates.map((update) => (
        <UpdateCard
          key={update.id}
          update={update}
          isOwner={isOwner}
          onEdit={isOwner ? handleEditUpdate : undefined}
          onDelete={isOwner ? handleDeleteUpdate : undefined}
        />
      ))}

      {/* Load more button */}
      {hasMore && (
        <div className="text-center pt-4">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoadingMore}
            className={cn(
              'px-6 py-2 rounded-lg border border-gray-300 bg-white',
              'text-gray-700 font-medium',
              'hover:bg-gray-50 hover:border-gray-400',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              'transition-colors'
            )}
          >
            {isLoadingMore ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner />
                Loading...
              </span>
            ) : (
              'Load more updates'
            )}
          </button>
        </div>
      )}

      {/* Error loading more (non-blocking) */}
      {error && updates.length > 0 && (
        <div className="text-center py-4">
          <p className="text-red-600 text-sm">{error}</p>
          <button
            type="button"
            onClick={handleLoadMore}
            className="mt-2 text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            Try again
          </button>
        </div>
      )}

      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        isOpen={isDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDeleting={isDeleting}
      />

      {/* Edit update modal */}
      <EditUpdateModal
        isOpen={isEditModalOpen}
        update={editingUpdate}
        onSave={handleSaveEdit}
        onCancel={handleCancelEdit}
      />
    </div>
  );
}

// Loading skeleton for update cards
function UpdateCardSkeleton() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 animate-pulse">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="h-4 bg-gray-200 rounded w-32" />
        <div className="h-4 bg-gray-200 rounded w-20" />
      </div>
      
      {/* Content */}
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded w-full" />
        <div className="h-4 bg-gray-200 rounded w-5/6" />
        <div className="h-4 bg-gray-200 rounded w-4/6" />
      </div>

      {/* Image placeholder (sometimes) */}
      <div className="mt-4 h-40 bg-gray-200 rounded-lg" />
    </div>
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

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

function EmptyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
      />
    </svg>
  );
}
