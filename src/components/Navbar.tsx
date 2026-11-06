import React from 'react';
import { ShieldCheck, LogOut, Anchor } from 'lucide-react';

interface NavbarProps {
  currentView: 'home' | 'admin';
  onNavigate: (view: 'home' | 'admin') => void;
  isAdmin: boolean;
  adminEmail?: string | null;
  onLogout: () => void;
}

export default function Navbar({
  currentView,
  onNavigate,
  isAdmin,
  adminEmail,
  onLogout,
}: NavbarProps) {
  return (
    <nav className="sticky top-0 z-40 bg-[#0b1a22]/95 backdrop-blur-md border-b border-[#24414b]">
      <div className="wrap flex items-center justify-between min-h-[58px]">
        <button
          onClick={() => onNavigate('home')}
          className="text-left font-serif font-black text-xl tracking-tight text-[#ece6d6] hover:text-[#f2b84b] transition flex items-center gap-2 cursor-pointer"
        >
          <Anchor className="w-5 h-5 text-[#f2b84b]" />
          <span>등불항로</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('home')}
            className={`text-sm font-bold px-3.5 py-1.5 rounded-lg transition cursor-pointer ${
              currentView === 'home'
                ? 'bg-[#f2b84b] text-[#2a1a00]'
                : 'text-[#9db0ad] hover:text-[#ece6d6] hover:bg-[#11262f]'
            }`}
          >
            사전예약
          </button>

          <button
            onClick={() => onNavigate('admin')}
            className={`text-sm font-bold px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
              currentView === 'admin'
                ? 'bg-[#f2b84b] text-[#2a1a00]'
                : 'text-[#9db0ad] hover:text-[#ece6d6] hover:bg-[#11262f]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>관리자</span>
            {isAdmin && (
              <span className="w-2 h-2 rounded-full bg-[#7fd1a8] inline-block animate-pulse"></span>
            )}
          </button>

          {isAdmin && (
            <button
              onClick={onLogout}
              className="text-xs font-semibold px-2.5 py-1.5 rounded-md border border-[#24414b] text-[#9db0ad] hover:text-[#ff8f7a] hover:border-[#ff8f7a] transition flex items-center gap-1 ml-2 cursor-pointer"
              title={adminEmail ? `${adminEmail} 로그아웃` : '로그아웃'}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">로그아웃</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
