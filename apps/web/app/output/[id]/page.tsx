'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Download, Sparkles } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { apiUrl } from '@/lib/api';
import { AssignmentResponse, GenerateResponse, GeneratedPaper, GeneratedPaperResponse } from '@/types';
import { useStore } from '@/store/useStore';

const difficultyBadgeClass = {
  Easy: 'bg-green-50 text-green-700 border border-green-200',
  Moderate: 'bg-amber-50 text-amber-700 border border-amber-200',
  Challenging: 'bg-red-50 text-red-700 border border-red-200',
};

export default function OutputPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const assignmentId = params.id;
  const { setGeneratedPaper, setGeneratedPapers, setCurrentJob } = useStore();
  const [paper, setPaper] = useState<GeneratedPaper | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [bannerError, setBannerError] = useState('');

  useEffect(() => {
    let active = true;

    const loadPaper = async () => {
      try {
        const response = await fetch(apiUrl(`/api/generated-papers/${assignmentId}`), { cache: 'no-store' });

        if (!response.ok) {
          throw new Error('Backend is not reachable. Please ensure the backend server is running.');
        }

        const data = (await response.json()) as GeneratedPaperResponse;

        if (!active) {
          return;
        }

        if (response.ok && data.success && data.data?.length) {
          setPaper(data.data[0]);
          setGeneratedPaper(data.data[0]);
          setGeneratedPapers(assignmentId, data.data);
        } else {
          setError(data.error || 'Question paper not found.');
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load question paper.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadPaper();

    return () => {
      active = false;
    };
  }, [assignmentId, setGeneratedPaper, setGeneratedPapers]);

  const handleDownloadPDF = async () => {
    if (!paper) {
      return;
    }

    setIsDownloading(true);
    setBannerError('');

    try {
      const response = await fetch(apiUrl(`/api/generated-papers/${assignmentId}/pdf`), { cache: 'no-store' });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || 'Unable to download PDF. Please check if the backend is running.');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `question-paper-${paper.assignmentId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadIssue) {
      setBannerError(downloadIssue instanceof Error ? downloadIssue.message : 'Unable to download PDF. Please check if the backend is running.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setBannerError('');

    try {
      const assignmentResponse = await fetch(apiUrl(`/api/assignments/${assignmentId}`), { cache: 'no-store' });

      if (!assignmentResponse.ok) {
        throw new Error('Backend is not reachable. Please ensure the backend server is running.');
      }

      const assignmentData = (await assignmentResponse.json()) as AssignmentResponse;

      if (!assignmentData.success || !assignmentData.data) {
        throw new Error(assignmentData.error || 'Unable to load assignment details.');
      }

      const generateResponse = await fetch(apiUrl('/api/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId: assignmentData.data.id,
          questionTypes: assignmentData.data.questionTypes,
        }),
      });

      if (!generateResponse.ok) {
        throw new Error('Backend is not reachable. Please ensure the backend server is running.');
      }

      const generateData = (await generateResponse.json()) as GenerateResponse;

      if (!generateData.success || !generateData.data) {
        throw new Error(generateData.error || 'Unable to regenerate question paper.');
      }

      setCurrentJob({
        id: generateData.data.jobId,
        assignmentId: generateData.data.assignmentId,
        status: generateData.data.status,
        steps: [
          'Analyzing input and parameters...',
          'Structuring prompt for LLM...',
          'Job queued via BullMQ...',
          'AI Agent generating questions...',
          'Finalizing formatting & rubrics...',
        ],
        currentStep: 0,
        createdAt: new Date().toISOString(),
      });

      router.push(`/generating?assignmentId=${generateData.data.assignmentId}&jobId=${generateData.data.jobId}`);
    } catch (regenerateIssue) {
      setBannerError(regenerateIssue instanceof Error ? regenerateIssue.message : 'Unable to regenerate paper. Please check if the backend is running.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleBack = async () => {
    const assignmentResponse = await fetch(apiUrl(`/api/assignments/${assignmentId}`), { cache: 'no-store' });
    const assignmentData = (await assignmentResponse.json()) as AssignmentResponse;

    if (assignmentResponse.ok && assignmentData.success) {
      router.push('/dashboard');
      return;
    }

    router.back();
  };

  if (loading) {
    return (
      <AppShell currentView="output" title="Create New" showBack={true} onBack={() => router.push('/dashboard')}>
        <div className="flex items-center justify-center min-h-screen bg-[#F9FAFB]">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#EA7A5B]" />
        </div>
      </AppShell>
    );
  }

  if (!paper) {
    return (
      <AppShell currentView="output" title="Question Paper" showBack={true} onBack={() => router.push('/dashboard')}>
        <div className="flex-1 flex items-center justify-center min-h-screen bg-[#F9FAFB] px-6">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.707.293H19a2 2 0 012 2v7a2 2 0 01-2 2h-2m-4-4h.01M9 5h.01M15 5h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-3">No Question Paper Yet</h2>
            <p className="text-sm lg:text-base text-gray-500 mb-8 leading-relaxed">
              {error || 'This assignment doesn\'t have a generated question paper yet. You can generate one using AI.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="inline-flex h-12 items-center justify-center rounded-full bg-white border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Back to Dashboard
              </button>
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="inline-flex h-12 items-center justify-center rounded-full  px-6 py-3 text-sm font-semibold text-white bg-[#1C1C1C] hover:bg-black transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
              >
                {isRegenerating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12c0 4.418 0 7.267-2.768 7.956-1.264C17.267 11.268 18 9.767 18 8.001c0-4.418-3.582-8-8-8z"></path>
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} className="mr-2" />
                    Generate Question Paper
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell currentView="output" title="Create New" showBack={true} onBack={handleBack}>
      <div className="flex-1 bg-[#F9FAFB] lg:bg-[#2A2A2A] overflow-y-auto min-h-screen flex flex-col items-center pb-24 lg:py-10 print:bg-white print:py-0">
        <div className="w-full max-w-[850px] px-4 lg:px-0 mb-4 lg:mb-8 mt-4 lg:mt-0 print:hidden">
          <div className="bg-[#1C1C1C] rounded-2xl lg:rounded-3xl p-5 lg:p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between shadow-2xl gap-4">
            <p className="text-white text-[11px] lg:text-sm font-medium leading-relaxed lg:pr-8 opacity-90">
              Certainly, Lakshya! Here are customized Question Paper for your CBSE Grade 8 Science classes on
              the NCERT chapters:
            </p>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="inline-flex bg-[#333333] text-white hover:bg-[#444444] py-2.5 px-4 lg:py-3 lg:px-5 rounded-full lg:rounded-xl items-center justify-center gap-2 font-bold text-xs lg:text-sm transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isRegenerating ? 'Regenerating...' : 'Regenerate'}
              </button>
              <button
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="w-10 h-10 lg:w-auto lg:h-auto bg-[#333333] lg:bg-white text-white lg:text-[#1C1C1C] hover:bg-gray-200 lg:py-3 lg:px-6 rounded-full lg:rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-colors shrink-0 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Download size={18} />
                <span className="hidden lg:inline">{isDownloading ? 'Preparing PDF...' : 'Download as PDF'}</span>
              </button>
            </div>
          </div>

          {bannerError ? <p className="mt-3 text-sm font-medium text-red-600">{bannerError}</p> : null}
        </div>

        <div
          className="w-full lg:max-w-[850px] bg-white lg:rounded-[2rem] shadow-none lg:shadow-2xl px-6 py-10 lg:p-16 print:p-0 print:shadow-none print:rounded-none"
        >
          <div className="text-center mb-10">
            <h1 className="text-xl lg:text-3xl font-bold text-gray-900 mb-2">{paper.school}</h1>
            <h2 className="text-base lg:text-lg font-bold text-gray-800">Subject: {paper.subject}</h2>
            <h2 className="text-base lg:text-lg font-bold text-gray-800">Class: {paper.classLevel}</h2>
          </div>

          <div className="flex justify-between text-xs lg:text-sm font-bold text-gray-800 mb-6 border-b-2 border-gray-900 pb-4">
            <p>Time Allowed: {paper.timeAllowed}</p>
            <p>Maximum Marks: {paper.maxMarks}</p>
          </div>

          <div className="mb-10 text-xs lg:text-sm">
            <p className="font-bold text-gray-900 mb-5">All questions are compulsory unless stated otherwise.</p>
            <div className="space-y-4 font-bold text-gray-800 max-w-sm">
              <div className="flex items-end gap-2">
                <span className="shrink-0">Name:</span>
                <div className="border-b border-gray-400 flex-1" />
              </div>
              <div className="flex items-end gap-2">
                <span className="shrink-0">Roll Number:</span>
                <div className="border-b border-gray-400 flex-1" />
              </div>
              <div className="flex items-end gap-2">
                <span className="shrink-0">Class: {paper.classLevel} Section:</span>
                <div className="border-b border-gray-400 flex-1" />
              </div>
            </div>
          </div>

          {paper.sections.map((section) => (
            <div key={section.id} className="mb-12">
              <h3 className="text-center text-lg lg:text-xl font-extrabold text-gray-900 mb-8">{section.title}</h3>

              <div className="mb-6">
                <h4 className="font-bold text-gray-900 text-sm lg:text-base">{section.subtitle}</h4>
                <p className="italic text-xs lg:text-sm text-gray-600 mt-1">{section.instructions}</p>
              </div>

              <div className="space-y-6">
                {section.questions.map((question, index) => (
                  <div key={question.id} className="flex gap-2 text-sm lg:text-base">
                    <span className="text-gray-900">{index + 1}.</span>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            difficultyBadgeClass[question.difficulty]
                          }`}
                        >
                          {question.difficulty}
                        </span>
                        <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold bg-gray-100 text-gray-700 border border-gray-200">
                          {question.marks} Marks
                        </span>
                      </div>
                      <p className="text-gray-800 leading-relaxed font-normal">{question.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="font-extrabold text-gray-900 text-center border-t-2 border-gray-900 pt-6 mt-12 mb-8 text-sm lg:text-base uppercase tracking-wider">
            End of Question Paper
          </div>

          <div className="mt-16 bg-[#F9FAFB] p-6 lg:p-8 rounded-2xl print:bg-transparent print:p-0">
            <h3 className="font-bold text-base lg:text-lg text-gray-900 mb-6">Answer Key:</h3>
            <ol className="list-decimal list-outside ml-4 space-y-5 text-gray-700 text-xs lg:text-sm font-medium">
              {paper.answerKey.map((answer, index) => (
                <li key={`${paper.id}-${index}`} className="leading-relaxed pl-2 whitespace-pre-wrap">
                  {answer}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
