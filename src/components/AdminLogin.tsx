import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { Shield, Eye, EyeOff, Lock, AlertCircle, LogIn } from 'lucide-react';

interface AdminLoginProps {
  onLoginSuccess: (email?: string) => void;
  showToast: (msg: string) => void;
}

export default function AdminLogin({ onLoginSuccess, showToast }: AdminLoginProps) {
  const [adminId, setAdminId] = useState('');
  const [adminPw, setAdminPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setGoogleLoading(true);
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const email = res.user.email || '';
      onLoginSuccess(email);
      showToast(`관리자(${email})로 로그인했습니다.`);
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setErrorMsg('Google 로그인에 실패했습니다. 팝업 창을 닫았거나 네트워크를 확인해 주세요.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const trimmedId = adminId.trim();
    if (!trimmedId || !adminPw) {
      setErrorMsg('아이디와 비밀번호를 모두 입력해 주세요.');
      return;
    }

    // Default admin passcode or quick pass
    if (
      (trimmedId === 'admin' && adminPw === 'admin1234') ||
      (trimmedId === 'admin' && adminPw === '1234') ||
      (trimmedId === 'hitodays@gmail.com' && adminPw === '1234')
    ) {
      onLoginSuccess(trimmedId);
      showToast('관리자 계정으로 로그인했습니다.');
      return;
    }

    // SHA-256 validation for demo compatibility
    try {
      const buf = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(`lantern-admin|${trimmedId}:${adminPw}`)
      );
      const hash = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
      if (hash === '43f263bb6ddceba7241be540c23213b36e332d65a39f5a9f0860a010cc43a423') {
        onLoginSuccess(trimmedId);
        showToast('관리자 계정으로 로그인했습니다.');
        return;
      }
    } catch (e) {
      // ignore
    }

    setErrorMsg('아이디 또는 비밀번호가 일치하지 않습니다.');
  };

  return (
    <div className="py-14 sm:py-20">
      <div className="wrap max-w-md mx-auto">
        <div className="bg-[#11262f] border border-[#24414b] rounded-2xl p-6 sm:p-8 grid gap-5 shadow-2xl">
          <div className="grid gap-1.5 text-center">
            <div className="w-12 h-12 rounded-full bg-[#f2b84b]/15 text-[#f2b84b] flex items-center justify-center mx-auto mb-1">
              <Shield className="w-6 h-6" />
            </div>
            <span className="eyebrow">주최자 전용</span>
            <h2 className="text-2xl font-serif text-[#ece6d6]">관리자 로그인</h2>
            <p className="text-xs text-[#9db0ad] leading-relaxed">
              Google 계정 또는 관리자 비밀번호로 로그인하면 실시간 참가자 명단 조회 및 관리가 가능합니다.
            </p>
          </div>

          {/* Google Sign-in button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
            className="w-full bg-[#ece6d6] text-[#0b1a22] hover:bg-[#fff] font-bold text-sm py-3 px-4 rounded-xl flex items-center justify-center gap-2.5 transition shadow-sm cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{googleLoading ? '인증 처리 중...' : 'Google 계정으로 1초 로그인'}</span>
          </button>

          <div className="flex items-center gap-3 text-xs text-[#9db0ad]/60 my-1">
            <span className="h-[1px] flex-1 bg-[#24414b]" />
            <span>또는 관리자 계정 입력</span>
            <span className="h-[1px] flex-1 bg-[#24414b]" />
          </div>

          <form onSubmit={handlePasswordLogin} className="grid gap-3.5">
            <div className="grid gap-1">
              <label className="text-xs font-semibold text-[#9db0ad]">관리자 ID</label>
              <input
                type="text"
                value={adminId}
                onChange={(e) => setAdminId(e.target.value)}
                placeholder="admin"
                className="w-full bg-[#0b1a22] border border-[#24414b] rounded-lg px-3 py-2.5 text-sm text-[#ece6d6] focus:outline-none focus:border-[#f2b84b]"
              />
            </div>

            <div className="grid gap-1">
              <label className="text-xs font-semibold text-[#9db0ad]">비밀번호</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={adminPw}
                  onChange={(e) => setAdminPw(e.target.value)}
                  placeholder="비밀번호 입력 (기본: 1234)"
                  className="w-full bg-[#0b1a22] border border-[#24414b] rounded-lg px-3 py-2.5 pr-10 text-sm text-[#ece6d6] focus:outline-none focus:border-[#f2b84b]"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9db0ad] hover:text-[#ece6d6] cursor-pointer"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-1.5 text-xs text-[#ff8f7a] bg-[#ff8f7a]/10 border border-[#ff8f7a]/30 rounded-lg p-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full py-2.5 text-sm font-bold flex items-center justify-center gap-1.5"
            >
              <LogIn className="w-4 h-4" />
              <span>로그인</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
