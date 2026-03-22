'use client';

import React from 'react';
import Image from 'next/image';
import { ArrowLeft, Bell, ChevronDown, LayoutGrid, Menu } from 'lucide-react';
import { Logo } from '@/components/common/Logo';

interface TopbarProps {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
}

export const Topbar = ({ title, showBack, onBack }: TopbarProps) => (
  <div className="h-14 lg:h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30 shrink-0 mx-3  mb-2 rounded-2xl border shadow-[0_14px_34px_rgba(15,23,42,0.08)] lg:shadow-[0_18px_48px_rgba(15,23,42,0.10)]">
    <div className="flex lg:hidden items-center gap-3">
      <Logo />
      <span className="text-xl font-bold text-gray-900 tracking-tight">VedaAI</span>
    </div>

    <div className="hidden lg:flex items-center gap-4">
      {showBack ? (
        <button type="button" onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
      ) : null}
      <div className="flex items-center gap-2 text-gray-400">
        <LayoutGrid size={18} />
        <span className="font-medium text-gray-400">{title}</span>
      </div>
    </div>

    <div className="flex items-center gap-3 lg:gap-4">
      <button type="button" className="relative p-2 hover:bg-gray-100 rounded-full transition-colors">
        <Bell size={20} className="text-gray-600" />
        <span className="absolute top-2 right-2 w-2 h-2 bg-[#EA7A5B] rounded-full border border-white" />
      </button>

      <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 lg:p-1.5 rounded-full lg:pr-3 transition-colors">
        <Image
          src="https://api.dicebear.com/7.x/avataaars/svg?seed=John"
          alt="User"
          width={32}
          height={32}
          unoptimized={true}
          className="w-8 h-8 rounded-full bg-blue-100 object-cover"
        />
        <span className="hidden lg:block text-sm font-medium text-gray-700">John Doe</span>
        <ChevronDown size={16} className="hidden lg:block text-gray-400" />
      </div>

      <button type="button" className="lg:hidden p-2 text-gray-600">
        <Menu size={24} />
      </button>
    </div>
  </div>
);
