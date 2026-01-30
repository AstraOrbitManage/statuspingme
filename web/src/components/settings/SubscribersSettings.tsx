import { useState, useEffect, useCallback } from 'react';
import { subscribersApi, projectSettingsApi, type Subscriber } from '../../lib/api';

interface SubscribersSettingsProps {
  projectId: string;
  notificationsEnabled: boolean;
  onNotificationsChange?: (enabled: boolean) => void;
}

export function SubscribersSettings({
  projectId,
  notificationsEnabled: initialNotificationsEnabled,
  onNotificationsChange,
}: SubscribersSettingsProps) {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(initialNotificationsEnabled);
  const [updatingNotifications, setUpdatingNotifications] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Load subscribers
  const loadSubscribers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await subscribersApi.list(projectId);
      setSubscribers(result.subscribers);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscribers');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadSubscribers();
  }, [loadSubscribers]);

  // Toggle notifications
  const handleToggleNotifications = async () => {
    try {
      setUpdatingNotifications(true);
      const newValue = !notificationsEnabled;
      await projectSettingsApi.update(projectId, { notificationsEnabled: newValue });
      setNotificationsEnabled(newValue);
      onNotificationsChange?.(newValue);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update notifications setting');
    } finally {
      setUpdatingNotifications(false);
    }
  };

  // Remove a subscriber
  const handleRemoveSubscriber = async (subscriberId: string) => {
    if (!confirm('Are you sure you want to remove this subscriber? They will no longer receive updates.')) {
      return;
    }

    try {
      setRemovingId(subscriberId);
      await subscribersApi.remove(projectId, subscriberId);
      setSubscribers((prev) => prev.filter((s) => s.id !== subscriberId));
      setTotal((prev) => prev - 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove subscriber');
    } finally {
      setRemovingId(null);
    }
  };

  // Format frequency for display
  const formatFrequency = (frequency: Subscriber['frequency']) => {
    switch (frequency) {
      case 'instant':
        return 'Instant';
      case 'daily':
        return 'Daily digest';
      case 'weekly':
        return 'Weekly digest';
      default:
        return frequency;
    }
  };

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-medium text-gray-900">Subscribers</h2>
            <p className="text-sm text-gray-500">
              {total} {total === 1 ? 'person' : 'people'} subscribed to updates
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700">
            {total}
          </span>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-6 mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 font-medium underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Notifications toggle */}
      <div className="border-b border-gray-200 px-6 py-4">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <span className="text-sm font-medium text-gray-900">Enable email notifications</span>
            <p className="text-sm text-gray-500">
              When enabled, subscribers will receive email notifications for new updates
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notificationsEnabled}
            disabled={updatingNotifications}
            onClick={handleToggleNotifications}
            className={`
              relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent 
              transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
              ${notificationsEnabled ? 'bg-primary-600' : 'bg-gray-200'}
              ${updatingNotifications ? 'opacity-50 cursor-wait' : ''}
            `}
          >
            <span
              className={`
                pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 
                transition duration-200 ease-in-out
                ${notificationsEnabled ? 'translate-x-5' : 'translate-x-0'}
              `}
            />
          </button>
        </label>
      </div>

      {/* Subscriber list */}
      <div className="divide-y divide-gray-200">
        {subscribers.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h3 className="mt-4 text-sm font-medium text-gray-900">No subscribers yet</h3>
            <p className="mt-1 text-sm text-gray-500">
              Share your project link to let clients subscribe to updates.
            </p>
          </div>
        ) : (
          subscribers.map((subscriber) => (
            <div
              key={subscriber.id}
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  {/* Avatar with initial */}
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-medium text-gray-600">
                    {subscriber.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {subscriber.email}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <FrequencyIcon className="h-3 w-3" />
                        {formatFrequency(subscriber.frequency)}
                      </span>
                      <span>Subscribed {formatDate(subscriber.subscribedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => handleRemoveSubscriber(subscriber.id)}
                disabled={removingId === subscriber.id}
                className={`
                  ml-4 rounded-md px-3 py-1.5 text-sm font-medium text-red-600 
                  hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2
                  ${removingId === subscriber.id ? 'opacity-50 cursor-wait' : ''}
                `}
              >
                {removingId === subscriber.id ? 'Removing...' : 'Remove'}
              </button>
            </div>
          ))
        )}
      </div>

      {/* Footer hint */}
      {subscribers.length > 0 && (
        <div className="border-t border-gray-200 bg-gray-50 px-6 py-3">
          <p className="text-xs text-gray-500">
            Subscribers can unsubscribe at any time using the link in their email notifications.
          </p>
        </div>
      )}
    </div>
  );
}

// Small icon for frequency
function FrequencyIcon({ className }: { className?: string }) {
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

export default SubscribersSettings;
