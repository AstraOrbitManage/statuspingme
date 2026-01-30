import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { ArchivedBanner, ArchivedBadge } from '../../components/ui/ArchivedBanner';
import { UpdateComposer, UpdateTimeline } from '../../components/updates';
import { ShareModal } from '../../components/share';
import { SubscribersSettings } from '../../components/settings';
import { subscribersApi } from '../../lib/api';
import type { Update } from '../../types';

// Mock data - in real app, this would come from API based on user
const mockProject = {
  id: 'prod-api',
  name: 'Production API',
  description: 'Main production API service',
  status: 'active' as 'active' | 'archived', // Project status
  isOwner: true, // This would come from comparing current user with project owner
  magicLinkToken: 'abc123xyz789', // This would come from the API
  notificationsEnabled: true, // Default to true
};

const mockMonitors = [
  { id: '1', name: 'API Health Check', url: 'https://api.example.com/health', status: 'up', uptime: '99.99%' },
  { id: '2', name: 'Database Connection', url: 'tcp://db.example.com:5432', status: 'up', uptime: '99.95%' },
  { id: '3', name: 'Redis Cache', url: 'tcp://redis.example.com:6379', status: 'up', uptime: '100%' },
  { id: '4', name: 'Auth Service', url: 'https://auth.example.com/status', status: 'up', uptime: '99.90%' },
  { id: '5', name: 'CDN Endpoint', url: 'https://cdn.example.com', status: 'up', uptime: '99.99%' },
];

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<'updates' | 'monitors' | 'subscribers'>('updates');
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState<number>(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(mockProject.notificationsEnabled);
  
  // Reference to the callback function for adding updates to the timeline
  const addUpdateRef = useRef<(update: Update) => void>();

  // Load subscriber count
  useEffect(() => {
    if (mockProject.isOwner && id) {
      subscribersApi.list(id)
        .then((result) => setSubscriberCount(result.total))
        .catch(() => setSubscriberCount(0));
    }
  }, [id]);

  // Handler for regenerating the magic link
  const handleRegenerateLink = async () => {
    // TODO: Call API to regenerate magic link
    console.log('Regenerating magic link...');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated delay
    // In real app, this would update the magicLinkToken
  };

  // Handler for when a new update is posted
  const handleUpdatePosted = useCallback((update: Update) => {
    // Call the timeline's add function to insert the new update
    addUpdateRef.current?.(update);
  }, []);

  // Register the timeline's update callback
  const handleTimelineReady = useCallback((callback: (update: Update) => void) => {
    addUpdateRef.current = callback;
  }, []);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/projects" className="hover:text-primary-600">
          Projects
        </Link>
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-900">{mockProject.name}</span>
      </nav>

      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{mockProject.name}</h1>
            {mockProject.status === 'archived' && <ArchivedBadge />}
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Project ID: {id}
          </p>
        </div>
        <div className="flex gap-3">
          {/* Share button - prominent for easy access */}
          {mockProject.isOwner && (
            <Button onClick={() => setIsShareModalOpen(true)}>
              <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </Button>
          )}
          <Button variant="secondary">
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </Button>
          <Button variant="secondary">
            <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Monitor
          </Button>
        </div>
      </div>

      {/* Status overview */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-lg font-semibold text-green-600">All Systems Operational</p>
            <p className="text-sm text-gray-500">5 of 5 monitors are up</p>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          <button
            type="button"
            onClick={() => setActiveTab('updates')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'updates'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <UpdatesIcon className="w-4 h-4" />
              Updates
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('monitors')}
            className={`py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'monitors'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <MonitorsIcon className="w-4 h-4" />
              Monitors
              <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">
                {mockMonitors.length}
              </span>
            </span>
          </button>
          {mockProject.isOwner && (
            <button
              type="button"
              onClick={() => setActiveTab('subscribers')}
              className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'subscribers'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <SubscribersIcon className="w-4 h-4" />
                Subscribers
                {subscriberCount > 0 && (
                  <span className="bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full text-xs">
                    {subscriberCount}
                  </span>
                )}
              </span>
            </button>
          )}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === 'updates' ? (
        <div className="space-y-6">
          {/* Archived banner for owner view */}
          {mockProject.status === 'archived' && (
            <ArchivedBanner variant="owner" />
          )}

          {/* Update composer (only for owners of active projects) */}
          {mockProject.isOwner && mockProject.status !== 'archived' && (
            <UpdateComposer
              projectId={id || ''}
              onUpdatePosted={handleUpdatePosted}
            />
          )}

          {/* Updates timeline */}
          <UpdateTimeline
            projectId={id || ''}
            isOwner={mockProject.isOwner}
            onUpdateAdded={handleTimelineReady}
          />
        </div>
      ) : activeTab === 'monitors' ? (
        /* Monitors list */
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-medium text-gray-900">Monitors</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {mockMonitors.map((monitor) => (
              <div
                key={monitor.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      monitor.status === 'up' ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <div>
                    <p className="font-medium text-gray-900">{monitor.name}</p>
                    <p className="text-sm text-gray-500">{monitor.url}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900">{monitor.uptime}</p>
                    <p className="text-xs text-gray-500">30-day uptime</p>
                  </div>
                  <button className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Subscribers settings */
        <SubscribersSettings
          projectId={id || ''}
          notificationsEnabled={notificationsEnabled}
          onNotificationsChange={(enabled) => {
            setNotificationsEnabled(enabled);
          }}
        />
      )}

      {/* Share Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        projectName={mockProject.name}
        magicLinkToken={mockProject.magicLinkToken}
        onRegenerateLink={handleRegenerateLink}
      />
    </div>
  );
}

// Icons
function UpdatesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
      />
    </svg>
  );
}

function MonitorsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

function SubscribersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
      />
    </svg>
  );
}
