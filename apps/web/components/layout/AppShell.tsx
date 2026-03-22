'use client';

import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';

interface AppShellProps {
  children: React.ReactNode;
  currentView: 'dashboard' | 'create' | 'generating' | 'output';
  title: string;
  showBack?: boolean;
  onBack?: () => void;
  showMobileBottomNav?: boolean;
}

export const AppShell = ({
  children,
  currentView,
  title,
  showBack = false,
  onBack,
  showMobileBottomNav = true,
}: AppShellProps) => (
  <div className="flex h-screen bg-[#F3F4F6] font-sans overflow-hidden antialiased lg:p-2">
    <div className="print:hidden">
      <Sidebar currentView={currentView} />
    </div>

    <div className="flex-1 flex flex-col lg:ml-[300px] print:ml-0 overflow-hidden relative lg:rounded-md">
      <div className="print:hidden">
        <Topbar title={title} showBack={showBack} onBack={onBack} />
      </div>

      <div className="flex-1 overflow-auto print:overflow-visible lg:rounded-xl">{children}</div>
    </div>

    {showMobileBottomNav ? <MobileBottomNav currentView={currentView} /> : null}
  </div>
);
