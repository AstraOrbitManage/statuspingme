import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { cn } from '../../lib/utils';

interface Project {
  id: string;
  name: string;
  monitors: number;
  status: 'healthy' | 'degraded' | 'down';
  projectStatus?: 'active' | 'archived';
}

const mockProjects: Project[] = [
  { id: '1', name: 'Production API', monitors: 5, status: 'healthy', projectStatus: 'active' },
  { id: '2', name: 'Staging Environment', monitors: 3, status: 'healthy', projectStatus: 'active' },
  { id: '3', name: 'Marketing Site', monitors: 2, status: 'degraded', projectStatus: 'active' },
  { id: '4', name: 'Legacy System', monitors: 1, status: 'healthy', projectStatus: 'archived' },
];

export function ProjectsListPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your monitoring projects and their status pages.
          </p>
        </div>
        <Button>
          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Project
        </Button>
      </div>

      {/* Projects grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mockProjects.map((project) => {
          const isArchived = project.projectStatus === 'archived';
          
          return (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className={cn(
                "group rounded-lg border p-6 transition-shadow hover:shadow-md",
                isArchived
                  ? "border-gray-200 bg-gray-50 opacity-75 hover:opacity-100"
                  : "border-gray-200 bg-white"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={cn(
                      "font-medium truncate",
                      isArchived
                        ? "text-gray-500 group-hover:text-gray-700"
                        : "text-gray-900 group-hover:text-primary-600"
                    )}>
                      {project.name}
                    </h3>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {project.monitors} monitors
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 ml-3">
                  {isArchived ? (
                    <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 border border-amber-200">
                      <ArchiveIcon className="w-3 h-3" />
                      Archived
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        project.status === 'healthy'
                          ? 'bg-green-100 text-green-800'
                          : project.status === 'degraded'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      )}
                    >
                      {project.status === 'healthy' && '● '}
                      {project.status === 'degraded' && '● '}
                      {project.status}
                    </span>
                  )}
                </div>
              </div>
              <div className={cn(
                "mt-4 flex items-center text-sm",
                isArchived ? "text-gray-400" : "text-gray-500"
              )}>
                <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {isArchived ? 'Archived' : 'Last checked 2m ago'}
              </div>
            </Link>
          );
        })}

        {/* Empty state / Add new project card */}
        <button className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white p-6 text-gray-500 transition-colors hover:border-primary-500 hover:text-primary-500">
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span className="mt-2 text-sm font-medium">Add new project</span>
        </button>
      </div>
    </div>
  );
}

// Icon component
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
