'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { apiUrl, getApiBaseUrl } from '@/lib/api';
import { JobStatusPayload } from '@/types';

function GeneratingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const assignmentId = searchParams.get('assignmentId') ?? '';
  const jobId = searchParams.get('jobId') ?? '';
  const [step, setStep] = useState(0);

  const steps = useMemo(
    () => [
      'Analyzing input and parameters...',
      'Structuring prompt for LLM...',
      'Job queued via BullMQ...',
      'AI Agent generating questions...',
      'Finalizing formatting & rubrics...',
    ],
    []
  );

  useEffect(() => {
    if (!assignmentId || !jobId) {
      router.replace('/dashboard');
      return;
    }

    let active = true;
    let stopSocket = () => undefined;

    const poll = async () => {
      try {
        const response = await fetch(apiUrl(`/api/generate?jobId=${jobId}`), { cache: 'no-store' });
        const data = (await response.json()) as { success: boolean; data?: JobStatusPayload };

        if (!active || !data.success || !data.data) {
          return;
        }

        if (data.data.status === 'completed') {
          router.replace(`/output/${assignmentId}`);
          return;
        }

        const nextStep =
          data.data.status === 'queued'
            ? 1
            : data.data.status === 'processing'
            ? Math.min(Math.max(data.data.currentStep, 1), steps.length - 1)
            : 0;

        setStep(nextStep);
      } catch {
        // Keep progress UI visible while polling retries.
      }
    };

    const connectSocket = async () => {
      try {
        const { io } = await import('socket.io-client');
        const socket = io(getApiBaseUrl(), {
          path: '/api/websocket',
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 3,
        });

        socket.on('connect', () => {
          socket.emit('job:subscribe', jobId);
        });

        socket.on('job:updated', (payload: JobStatusPayload) => {
          if (!active || payload.jobId !== jobId) {
            return;
          }

          if (payload.status === 'completed') {
            router.replace(`/output/${assignmentId}`);
            return;
          }

          const nextStep =
            payload.status === 'queued'
              ? 1
              : payload.status === 'processing'
              ? Math.min(Math.max(payload.currentStep, 1), steps.length - 1)
              : 0;

          setStep(nextStep);
        });

        socket.on('job:completed', (payload: { jobId: string }) => {
          if (!active || payload.jobId !== jobId) {
            return;
          }

          router.replace(`/output/${assignmentId}`);
        });

        stopSocket = () => {
          socket.emit('job:unsubscribe', jobId);
          socket.close();
        };
      } catch {
        // Polling remains active as a fallback.
      }
    };

    poll();
    void connectSocket();
    const interval = setInterval(poll, 1200);

    return () => {
      active = false;
      clearInterval(interval);
      stopSocket();
    };
  }, [assignmentId, jobId, router, steps.length]);

  return (
    <AppShell currentView="generating" title="Processing">
      <div className="flex-1 flex flex-col items-center justify-center bg-[#F9FAFB] min-h-[calc(100vh-64px)] p-4">
        <div className="bg-white p-8 lg:p-12 rounded-[2rem] shadow-xl border border-gray-100 flex flex-col items-center max-w-md w-full text-center">
          <div className="relative mb-8">
            <div className="w-20 h-20 rounded-full border-4 border-gray-50 flex items-center justify-center">
              <Loader2 size={36} className="text-[#EA7A5B] animate-spin" />
            </div>
            <div className="absolute top-0 right-0 -mr-2 -mt-2 bg-blue-100 p-1.5 rounded-full animate-pulse">
              <Sparkles size={14} className="text-blue-500" />
            </div>
          </div>
          <h2 className="text-xl lg:text-2xl font-bold text-gray-900 mb-6">Generating Assessment</h2>

          <div className="w-full bg-gray-100 h-1.5 rounded-full mb-8 overflow-hidden">
            <div
              className="h-full bg-[#EA7A5B] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>

          <ul className="text-xs lg:text-sm text-left space-y-4 w-full pl-2 lg:pl-4">
            {steps.map((item, index) => (
              <li
                key={item}
                className={`flex items-center gap-3 transition-opacity duration-300 ${
                  index <= step ? 'opacity-100' : 'opacity-30'
                }`}
              >
                {index < step ? (
                  <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                ) : index === step ? (
                  <Loader2 size={16} className="text-[#EA7A5B] animate-spin shrink-0" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-gray-300 shrink-0" />
                )}
                <span className={index === step ? 'text-gray-900 font-semibold' : 'text-gray-500 font-medium'}>
                  {item}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AppShell>
  );
}

export default function GeneratingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white" />}>
      <GeneratingContent />
    </Suspense>
  );
}
