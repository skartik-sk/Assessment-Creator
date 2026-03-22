'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, FileText, LayoutGrid, Sparkles } from 'lucide-react';

interface MobileBottomNavProps {
  currentView: 'dashboard' | 'create' | 'generating' | 'output';
}

export const MobileBottomNav = ({ currentView }: MobileBottomNavProps) => {
  const router = useRouter();
  const assignmentActive = currentView === 'dashboard' || currentView === 'create' || currentView === 'generating' || currentView === 'output';

  const itemClass = (active: boolean, disabled = false) =>
    `flex flex-col items-center gap-1 transition-colors ${
      active ? 'text-white' : disabled ? 'opacity-50 text-gray-400' : 'text-gray-400'
    }`;

  return (
    <div className="lg:hidden fixed bottom-6 left-4 right-4 bg-[#1C1C1C] rounded-3xl px-10 py-4 flex justify-between items-center text-gray-400 z-50 shadow-2xl">
      <button disabled className={itemClass(false, true)} type="button">
        <LayoutGrid size={22} />
        <span className="text-[10px] font-medium">Home</span>
      </button>
      <button onClick={() => router.push('/dashboard')} className={itemClass(assignmentActive)} type="button">
        <FileText size={22} />
        <span className="text-[10px] font-medium">Assignments</span>
      </button>
      <button disabled className={itemClass(false, true)} type="button">
        <BookOpen size={22} />
        <span className="text-[10px] font-medium">Library</span>
      </button>
      <button disabled className={itemClass(false, true)} type="button">
        <Sparkles size={22} />
        <span className="text-[10px] font-medium">AI Toolkit</span>
      </button>
    </div>
  );
};
