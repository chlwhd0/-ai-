import { Milestone } from '../types';
import { Award, CheckCircle2 } from 'lucide-react';

const STOPS: Milestone[] = [
  { g: 100000, r: '골드 30,000 · 등불 기름 5통' },
  { g: 300000, r: '5성 선원 선택권 1장' },
  { g: 500000, r: '한정 선박 외형 「호박빛 범선」' },
  { g: 1000000, r: '전설 등불 「첫 번째 불씨」' },
];

export default function Milestones({ totalCount }: { totalCount: number }) {
  const fmt = (n: number) => n.toLocaleString('ko-KR');
  const progressPercent = Math.min(100, (totalCount / 1000000) * 100);

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <span className="eyebrow flex items-center gap-1.5">
          <Award className="w-4 h-4 text-[#f2b84b]" />
          누적 보상 항로
        </span>
        <h2 className="text-2xl sm:text-3xl font-serif text-[#ece6d6]">
          예약자가 늘수록 보상이 커집니다
        </h2>
        <p className="text-sm text-[#9db0ad] m-0">
          달성한 단계의 보상은 사전예약자 전원에게 지급됩니다.
        </p>
      </div>

      <div className="flex justify-between items-baseline gap-3 flex-wrap">
        <b className="font-mono text-3xl sm:text-4xl text-[#f2b84b] tabular-nums">
          {fmt(totalCount)}
        </b>
        <span className="text-xs sm:text-sm text-[#9db0ad]">
          명 참여 (실시간 집계 중)
        </span>
      </div>

      <div
        className="h-2.5 bg-[#11262f] border border-[#24414b] rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={totalCount}
        aria-valuemin={0}
        aria-valuemax={1000000}
      >
        <div
          className="h-full bg-gradient-to-r from-[#c98a25] to-[#f2b84b] transition-all duration-700 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <ol className="list-none m-0 p-0 grid divide-y divide-[#24414b]">
        {STOPS.map((s) => {
          const hit = totalCount >= s.g;
          return (
            <li
              key={s.g}
              className={`grid grid-cols-[28px_1fr_auto] gap-3.5 items-center py-3.5 transition-colors ${
                hit ? 'text-[#ece6d6]' : 'text-[#9db0ad]'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 rounded-full border-2 justify-self-center transition-all ${
                  hit
                    ? 'bg-[#f2b84b] border-[#f2b84b] shadow-[0_0_10px_#f2b84b]'
                    : 'border-[#24414b] bg-transparent'
                }`}
              />
              <div>
                <div className="font-mono text-xs text-[#9db0ad] tabular-nums">
                  {fmt(s.g)}명
                </div>
                <div className="font-medium text-sm text-[#ece6d6]">{s.r}</div>
              </div>
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full border whitespace-nowrap flex items-center gap-1 ${
                  hit
                    ? 'border-[#f2b84b] text-[#f2b84b] bg-[#f2b84b]/10'
                    : 'border-[#24414b] text-[#9db0ad]'
                }`}
              >
                {hit ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    달성
                  </>
                ) : (
                  `남은 ${fmt(s.g - totalCount)}명`
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
