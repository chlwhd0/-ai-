import { Map, Users, Lightbulb, ChevronDown } from 'lucide-react';

export default function GameFeatures() {
  return (
    <>
      {/* Three Core Features */}
      <section className="bg-[#11262f] border-y border-[#24414b] py-14">
        <div className="wrap grid gap-8">
          <div className="grid gap-2">
            <span className="eyebrow">게임 소개</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-[#ece6d6]">
              항해일지에 남길 세 가지
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="grid gap-2.5 content-start border-t-2 border-[#f2b84b] pt-4">
              <span className="font-mono text-xs text-[#9db0ad] flex items-center gap-1.5">
                <Map className="w-3.5 h-3.5 text-[#f2b84b]" />
                항로 개척
              </span>
              <h3 className="text-lg font-serif text-[#ece6d6]">안개를 걷어내는 탐험</h3>
              <p className="text-xs sm:text-sm text-[#9db0ad] m-0 leading-relaxed">
                등불 반경만큼만 보이는 바다. 연료를 아껴 쓸지, 멀리 비출지 매 항해마다 선택합니다.
              </p>
            </div>

            <div className="grid gap-2.5 content-start border-t-2 border-[#f2b84b] pt-4">
              <span className="font-mono text-xs text-[#9db0ad] flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#f2b84b]" />
                선원 편성
              </span>
              <h3 className="text-lg font-serif text-[#ece6d6]">40명의 선원, 5개 직책</h3>
              <p className="text-xs sm:text-sm text-[#9db0ad] m-0 leading-relaxed">
                항해사·포수·요리사·측량사·등불지기를 조합해 배마다 다른 전술을 꾸립니다.
              </p>
            </div>

            <div className="grid gap-2.5 content-start border-t-2 border-[#f2b84b] pt-4">
              <span className="font-mono text-xs text-[#9db0ad] flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-[#f2b84b]" />
                등대 복원
              </span>
              <h3 className="text-lg font-serif text-[#ece6d6]">함께 켜는 서버 등대</h3>
              <p className="text-xs sm:text-sm text-[#9db0ad] m-0 leading-relaxed">
                길드원이 모은 기름으로 꺼진 등대를 밝히면 서버 전체 항로가 열립니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Notices */}
      <section className="py-14">
        <div className="wrap grid gap-6">
          <div className="grid gap-2">
            <span className="eyebrow">유의사항</span>
            <h2 className="text-2xl sm:text-3xl font-serif text-[#ece6d6]">
              참여 전에 확인해 주세요
            </h2>
          </div>

          <div className="divide-y divide-[#24414b] border-y border-[#24414b]">
            <details className="py-4 group cursor-pointer" open>
              <summary className="font-bold text-sm sm:text-base text-[#ece6d6] flex justify-between items-center list-none">
                <span>보상 지급 안내</span>
                <ChevronDown className="w-4 h-4 text-[#9db0ad] transition-transform group-open:rotate-180" />
              </summary>
              <ul className="mt-3 pl-5 text-xs sm:text-sm text-[#9db0ad] space-y-1.5 leading-relaxed">
                <li>쿠폰은 정식 출시일(2026.12.17)에 입력하신 번호로 문자 발송됩니다.</li>
                <li>쿠폰 사용 기한은 2027.01.31까지이며, 계정당 1회 사용할 수 있습니다.</li>
                <li>누적 보상은 출시 시점의 최종 참여자 수 기준으로 지급됩니다.</li>
              </ul>
            </details>

            <details className="py-4 group cursor-pointer">
              <summary className="font-bold text-sm sm:text-base text-[#ece6d6] flex justify-between items-center list-none">
                <span>개인정보 처리 및 보안 안내</span>
                <ChevronDown className="w-4 h-4 text-[#9db0ad] transition-transform group-open:rotate-180" />
              </summary>
              <ul className="mt-3 pl-5 text-xs sm:text-sm text-[#9db0ad] space-y-1.5 leading-relaxed">
                <li>수집 항목: 휴대폰 번호, 운영체제(OS) 및 희망 서버·채널 정보</li>
                <li>이용 목적: 사전예약 보상 쿠폰 발송 및 서비스 출시 알림</li>
                <li>보유 기간: 쿠폰 발송 후 30일 뒤 안전하게 파기</li>
                <li>실시간 데이터베이스: Google Cloud Firebase Firestore를 통해 안전하게 암호화 보관됩니다.</li>
              </ul>
            </details>

            <details className="py-4 group cursor-pointer">
              <summary className="font-bold text-sm sm:text-base text-[#ece6d6] flex justify-between items-center list-none">
                <span>기타 안내</span>
                <ChevronDown className="w-4 h-4 text-[#9db0ad] transition-transform group-open:rotate-180" />
              </summary>
              <ul className="mt-3 pl-5 text-xs sm:text-sm text-[#9db0ad] space-y-1.5 leading-relaxed">
                <li>본 페이지는 실제 사전예약 신청을 Firebase Firestore 실시간 데이터베이스로 즉시 저장 및 연동합니다.</li>
                <li>관리자 탭에서 실시간 신청자 명단 조회, 서버·채널 현황 관리 및 CSV 다운로드가 가능합니다.</li>
              </ul>
            </details>
          </div>
        </div>
      </section>
    </>
  );
}
