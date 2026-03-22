'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  BookOpen,
  Clock,
  FileText,
  LayoutGrid,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react';
import { Logo } from '@/components/common/Logo';
import { useStore } from '@/store/useStore';

interface SidebarProps {
  currentView: 'dashboard' | 'create' | 'generating' | 'output';
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}

const NavItem = ({ icon, label, badge, active, onClick, disabled }: NavItemProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-colors ${
      active ? 'bg-[#F3F4F6] text-gray-900 font-bold' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900 font-medium'
    } ${disabled ? 'opacity-50 cursor-default hover:bg-transparent hover:text-gray-500' : ''}`}
  >
    <div className="flex items-center gap-3">
      {icon}
      <span>{label}</span>
    </div>
    {badge ? (
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-bold ${
          active ? 'bg-[#EA7A5B] text-white' : 'bg-gray-200 text-gray-600'
        }`}
      >
        {badge}
      </span>
    ) : null}
  </button>
);

export const Sidebar = ({ currentView }: SidebarProps) => {
  const router = useRouter();
  const { assignments } = useStore();
  const assignmentActive = currentView === 'dashboard' || currentView === 'create' || currentView === 'output' || currentView === 'generating';

  return (
    <div className="hidden lg:flex w-[300px] bg-white h-[calc(100vh-1rem)] border border-white/70 flex-col rounded-2xl justify-between fixed left-2 top-2 z-20 shrink-0 shadow-[0_24px_60px_rgba(15,23,42,0.16)]">
      <div>
        <div className="p-6 flex items-center gap-3 cursor-pointer" onClick={() => router.push('/dashboard')}>
          <Logo />
          <span className="text-3xl font-bold text-gray-900 tracking-tight">VedaAI</span>
        </div>

        <div className="px-5 mt-6 mb-9">
          <button
            type="button"
            onClick={() => router.push('/create')}
            className="w-full  bg-[#2A2A2A] hover:bg-black text-white py-2 px-3 rounded-full flex items-center justify-center gap-2 font-medium transition-all border-[5px] border-[#EA7A5B]"
          >
            <Sparkles size={14} className="text-white fill-amber-50" />
            Create Assignment
          </button>
        </div>

        <nav className="px-4 space-y-2">
          <NavItem icon={<LayoutGrid size={20} />} label="Home" disabled />
          <NavItem icon={<Users size={20} />} label="My Groups" disabled />
          <NavItem
            icon={<FileText size={20} />}
            label="Assignments"
            badge={assignments.length > 0 ? String(assignments.length) : undefined}
            active={assignmentActive}
            onClick={() => router.push('/dashboard')}
          />
          <NavItem icon={<BookOpen size={20} />} label="AI Teacher's Toolkit" disabled />
          <NavItem icon={<Clock size={20} />} label="My Library"  disabled />
        </nav>
      </div>

      <div className="p-4 space-y-3">
        <NavItem icon={<Settings size={20} />} label="Settings" disabled />
        <div className="bg-[#F4F4F5] p-4 rounded-[1.6rem] flex items-center gap-3 ">
          <Image
            src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix"
            alt="User"
            width={40}
            height={40}
            unoptimized={true}
            className="w-10 h-10 rounded-full "
          />
          <div className="overflow-hidden">
            <p className="text-sm font-bold text-gray-900 leading-tight truncate">Delhi Public School</p>
            <p className="text-xs text-gray-500 truncate">Bokaro Steel City</p>
          </div>
        </div>
      </div>
    </div>
  );
};
