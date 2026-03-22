'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Filter, Plus, Search, Trash2 } from 'lucide-react';
import { EmptyStateIllustration } from '@/components/common/EmptyStateIllustration';
import { MoreVerticalIcon } from '@/components/common/Icons';
import { AppShell } from '@/components/layout/AppShell';
import { apiUrl } from '@/lib/api';
import { useStore } from '@/store/useStore';
import { AssignmentsResponse } from '@/types';
import { formatDisplayDate } from '@/lib/utils';

export default function DashboardPage() {
  const router = useRouter();
  const { assignments, setAssignments, filterSearch, setFilterSearch, deleteAssignment } = useStore();
  const [loading, setLoading] = useState(assignments.length === 0);
  const [loadError, setLoadError] = useState('');
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    let active = true;

    const loadAssignments = async () => {
      try {
        const response = await fetch(apiUrl('/api/assignments'), { cache: 'no-store' });

        if (!response.ok) {
          throw new Error('Backend is not reachable. Please ensure the backend server is running.');
        }

        const data = (await response.json()) as AssignmentsResponse;

        if (!active || !data.success || !data.data) {
          if (data.error) {
            setLoadError(data.error);
          }
          return;
        }

        setAssignments(data.data.assignments);
        setLoadError('');
      } catch (err) {
        if (active) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load assignments. Please check your connection.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadAssignments();

    return () => {
      active = false;
    };
  }, [setAssignments]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeMenu) {
        const menuElement = menuRefs.current[activeMenu];
        if (menuElement && !menuElement.contains(event.target as Node)) {
          setActiveMenu(null);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activeMenu]);

  const filteredAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.title.toLowerCase().includes(filterSearch.toLowerCase())),
    [assignments, filterSearch]
  );

  const handleMenuToggle = (assignmentId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setActiveMenu(activeMenu === assignmentId ? null : assignmentId);
  };

  const handleViewAssignment = (assignmentId: string) => {
    setActiveMenu(null);
    router.push(`/output/${assignmentId}`);
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    try {
      await fetch(apiUrl(`/api/assignments/${assignmentId}`), {
        method: 'DELETE',
      });
      deleteAssignment(assignmentId);
      setActiveMenu(null);
    } catch (error) {
      console.error('Failed to delete assignment:', error);
    }
  };

  if (!loading && assignments.length === 0) {
    return (
      <AppShell currentView="dashboard" title="Assignment" showMobileBottomNav={true}>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6  py-12 bg-[#F9FAFB] lg:bg-[#F3F4F6]  pb-32">
          {loadError ? (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-3">Connection Error</h2>
              <p className="text-xs lg:text-base text-red-600 max-w-xl mb-4 leading-relaxed px-4">
                {loadError}
              </p>
              <p className="text-xs lg:text-sm text-gray-500 max-w-xl mb-8 leading-relaxed px-4">
                Make sure the backend server is running on port 4000. Run <code className="bg-gray-200 px-2 py-1 rounded">bun run dev:backend</code> in a separate terminal.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="bg-[#1C1C1C] hover:bg-black text-white py-3 lg:py-3.5 px-4 lg:px-6 rounded-full flex items-center justify-center gap-2 font-semibold transition-all shadow-md"
              >
                Retry
              </button>
            </>
          ) : (
            <>
              <EmptyStateIllustration />

              <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-3">No assignments yet</h2>

              <p className="text-xs lg:text-base text-gray-500 max-w-xl mb-8 leading-relaxed px-4">
                Create your first assignment to start collecting and grading student submissions. You can set up rubrics, define marking criteria, and let AI assist with grading.
              </p>

              <button
                type="button"
                onClick={() => router.push('/create')}
                className="bg-[#1C1C1C] hover:bg-black text-white py-3 lg:py-3.5 px-4 lg:px-6 rounded-full flex items-center justify-center gap-2 font-semibold transition-all shadow-md w-full max-w-xs"
              >
                <Plus size={20} />
                Create Your First Assignment
              </button>
            </>
          )}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell currentView="dashboard" title="Assignment" showMobileBottomNav={true}>
      <div className="flex-1 bg-[#F9FAFB] p-4 lg:p-8 flex flex-col min-h-screen pb-32 lg:pb-8">
        <div className="lg:hidden flex items-center gap-3 mb-6">
          <ArrowLeft size={20} className="text-gray-600" onClick={() => router.back()} />
          <h1 className="text-xl font-bold text-gray-900">Assignments</h1>
        </div>

        <div className="hidden lg:flex mb-6 items-center space-x-4">
          <span className="w-3.5 h-3.5 rounded-full bg-green-500 inline-block shadow-lg outline outline-4 outline-green-200" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              Assignments
            </h1>
            <p className="text-sm text-gray-500 mt-1">Manage and create assignments for your classes.</p>
          </div>
        </div>

        <div className="bg-white p-2 rounded-2xl    flex  flex-row md justify-between items-center gap-2 md:gap-4 mb-6 lg:mb-8">
          <button type="button" className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-2.5 text-gray-500 hover:bg-gray-50 rounded-xl transition-colors font-medium text-sm">
            <Filter size={18} />
            Filter By
          </button>
          <div className="w-full md:w-80 flex items-center gap-3 px-4 py-2.5 bg-white border border-gray-200 rounded-full">
            <Search size={18} className="text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search Assignment"
              value={filterSearch}
              onChange={(event) => setFilterSearch(event.target.value)}
              className="w-full outline-none text-gray-700 bg-transparent text-sm placeholder:text-gray-400"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#EA7A5B]" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 pb-24">
            {filteredAssignments.map((assignment) => (
              <div
                key={assignment.id}
                className="bg-white p-5 lg:p-6 rounded-[1.25rem]   transition-shadow relative cursor-pointer group"
                onClick={() => router.push(`/output/${assignment.id}`)}
              >
                <div className="flex justify-between items-start mb-10 lg:mb-12">
                  <h3 className="font-bold text-lg text-gray-900 transition-colors">
                    {assignment.title}
                  </h3>
                  <div className="relative" ref={(el) => {
                    menuRefs.current[assignment.id] = el;
                  }}>
                    <button
                      type="button"
                      className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-50"
                      onClick={(e) => handleMenuToggle(assignment.id, e)}
                    >
                      <MoreVerticalIcon />
                    </button>
                    {activeMenu === assignment.id && (
                      <div className="absolute right-0 top-8 bg-white rounded-xl shadow-lg border border-gray-200 p-2 min-w-[200px] z-50">
                        <button
                          type="button"
                          onClick={() => handleViewAssignment(assignment.id)}
                          className="w-full px-4 py-2 text-left text-xs font-medium text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                        >
                          View Assignment
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAssignment(assignment.id)}
                          className="w-full px-4 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 size={16} />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 lg:gap-6 text-xs lg:text-sm">
                  <span className=" text-gray-900 font-semibold">
                    Assigned on : <span className="text-gray-500">{formatDisplayDate(assignment.assignedDate)}</span>
                  </span>
                  <span className=" text-gray-900 font-semibold">
                    Due : <span className="text-gray-500">{formatDisplayDate(assignment.dueDate)}</span>
                  </span>
                </div>
              </div>
            ))}
            
          </div>
        )}

        <div className="hidden  lg:flex fixed bottom-10 left-1/2 transform -translate-x-1/2 ml-[130px] z-20">
          <button
            type="button"
            onClick={() => router.push('/create')}
            className="bg-[#1C1C1C] hover:bg-black text-white py-3.5 px-8 rounded-full flex items-center gap-2 font-semibold transition-all shadow-xl"
          >
            <Plus size={20} />
            Create Assignment
          </button>
        </div>

        <div className="lg:hidden fixed bottom-28 right-6 z-40">
          <button
            type="button"
            onClick={() => router.push('/create')}
            className="w-14 h-14 bg-white text-[#EA7A5B] border border-gray-200 rounded-full flex items-center justify-center shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] transition-transform active:scale-95"
          >
            <Plus size={28} />
          </button>
        </div>
      </div>
    </AppShell>
  );
}
