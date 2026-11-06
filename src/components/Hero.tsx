import { useState, useEffect } from 'react';
import SkyCanvas from './SkyCanvas';
import { Compass, Flame } from 'lucide-react';

export default function Hero({ onScrollToReserve }: { onScrollToReserve: () => void }) {
  const [timeLeft, setTimeLeft] = useState({ d: '00', h: '00', m: '00', s: '00' });

  useEffect(() => {
    const launchTime = new Date('2026-12-17T00:00:00+09:00').getTime();
    const pad = (n: number) => String(n).padStart(2, '0');

    const tick = () => {
      let diff = Math.max(0, Math.floor((launchTime - Date.now()) / 1000));
      const d = Math.floor(diff / 86400);
      diff %= 86400;
      const h = Math.floor(diff / 3600);
      diff %= 3600;
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setTimeLeft({ d: pad(d), h: pad(h), m: pad(m), s: pad(s) });
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="relative overflow-hidden border-b border-[#24414b] bg-[radial-gradient(120%_80%_at_70%_0%,#173a45_0%,#0b1a22_60%)]">
      <SkyCanvas />

      <div className="wrap relative py-12 md:py-16 grid gap-7">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="eyebrow flex items-center gap-1.5">
            <Compass className="w-4 h-4" />
            모바일 해양 탐험 RPG
          </span>
          <span className="sample-tag flex items-center gap-1">
            <Flame className="w-3.5 h-3.5 text-[#f2b84b]" />
            사전예약 접수 중
          </span>
        </div>

        <div>
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black font-serif tracking-tight text-[#ece6d6] leading-[1.05]">
            등불항로
            <span className="block text-[0.25em] font-medium tracking-[0.28em] text-[#9db0ad] mt-2">
              LANTERN ROUTE
            </span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-[#ece6d6]/90 max-w-2xl leading-relaxed">
            안개에 잠긴 군도를 등불 하나로 밝혀 나가는 항해 RPG. 선원을 모으고, 꺼진 등대를 다시 켜고, 지도에 없는 섬을 기록하세요.
          </p>
        </div>

        <div className="flex flex-wrap items-end gap-6 pt-2">
          <div className="flex gap-2.5" aria-label="출시까지 남은 시간">
            <div className="min-w-[64px] text-center bg-[#0b1a22]/80 border border-[#24414b] rounded-lg p-2 shadow-inner">
              <b className="block font-mono text-2xl text-[#f2b84b] leading-tight">{timeLeft.d}</b>
              <span className="text-[11px] text-[#9db0ad]">일</span>
            </div>
            <div className="min-w-[64px] text-center bg-[#0b1a22]/80 border border-[#24414b] rounded-lg p-2 shadow-inner">
              <b className="block font-mono text-2xl text-[#f2b84b] leading-tight">{timeLeft.h}</b>
              <span className="text-[11px] text-[#9db0ad]">시간</span>
            </div>
            <div className="min-w-[64px] text-center bg-[#0b1a22]/80 border border-[#24414b] rounded-lg p-2 shadow-inner">
              <b className="block font-mono text-2xl text-[#f2b84b] leading-tight">{timeLeft.m}</b>
              <span className="text-[11px] text-[#9db0ad]">분</span>
            </div>
            <div className="min-w-[64px] text-center bg-[#0b1a22]/80 border border-[#24414b] rounded-lg p-2 shadow-inner">
              <b className="block font-mono text-2xl text-[#f2b84b] leading-tight">{timeLeft.s}</b>
              <span className="text-[11px] text-[#9db0ad]">초</span>
            </div>
          </div>

          <div className="text-xs sm:text-sm text-[#9db0ad]">
            <strong className="block text-sm sm:text-base text-[#ece6d6] font-semibold">
              2026.12.17 (목) 정식 출시
            </strong>
            iOS · Android 동시 출시 예정
          </div>
        </div>

        <div>
          <button
            onClick={onScrollToReserve}
            className="btn-primary"
          >
            사전예약하고 보상 받기 →
          </button>
        </div>
      </div>
    </header>
  );
}
