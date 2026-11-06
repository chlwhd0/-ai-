import React, { useState } from 'react';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { ServerInfo, Registration } from '../types';
import { Check, Copy, AlertCircle, Loader2, Sparkles, Smartphone } from 'lucide-react';

interface PreRegisterFormProps {
  servers: ServerInfo[];
  registrations: Registration[];
  onSuccess: (reg: Registration) => void;
  showToast: (msg: string) => void;
}

export default function PreRegisterForm({
  servers,
  registrations,
  onSuccess,
  showToast,
}: PreRegisterFormProps) {
  const [os, setOs] = useState<'Android' | 'iOS'>('Android');
  const [selectedServerId, setSelectedServerId] = useState<string>(servers[0]?.id || 'north');
  const [selectedChannel, setSelectedChannel] = useState<number>(1);
  const [phoneRaw, setPhoneRaw] = useState<string>('');
  const [agAge, setAgAge] = useState<boolean>(false);
  const [agPrivacy, setAgPrivacy] = useState<boolean>(false);
  const [agMkt, setAgMkt] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [completedReg, setCompletedReg] = useState<Registration | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Selected server
  const currentServer = servers.find((s) => s.id === selectedServerId) || servers[0];

  // Calculate live channel counts based on base + Firestore registrations
  const getChannelCount = (serverId: string, chNum: number) => {
    const s = servers.find((x) => x.id === serverId);
    const baseCount = s?.base[chNum - 1] || 0;
    const liveMine = registrations.filter((r) => r.server === serverId && r.ch === chNum).length;
    return baseCount + liveMine;
  };

  const getChannelCap = (serverId: string, chNum: number) => {
    const s = servers.find((x) => x.id === serverId);
    return s?.cap[chNum - 1] || 5000;
  };

  // Format phone number
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setErrorMsg('');
    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
    let formatted = digits;
    if (digits.length > 7) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4)}-${digits.slice(-4)}`;
    } else if (digits.length > 3) {
      formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    }
    setPhoneRaw(formatted);
  };

  const handleAllAgree = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setAgAge(checked);
    setAgPrivacy(checked);
    setAgMkt(checked);
    setErrorMsg('');
  };

  const isAllAgreed = agAge && agPrivacy && agMkt;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const digits = phoneRaw.replace(/\D/g, '');

    // Validation
    if (!digits || !/^01[016789]\d{7,8}$/.test(digits)) {
      setErrorMsg('010으로 시작하는 10~11자리 휴대폰 번호를 올바르게 입력해 주세요.');
      return;
    }

    if (!agAge || !agPrivacy) {
      setErrorMsg('필수 약관(만 14세 이상, 개인정보 수집·이용)에 모두 동의해 주세요.');
      return;
    }

    const curCap = getChannelCap(currentServer.id, selectedChannel);
    const curCount = getChannelCount(currentServer.id, selectedChannel);
    if (curCount >= curCap) {
      setErrorMsg(`${currentServer.name} ${selectedChannel}채널은 정원이 마감되었습니다. 다른 채널을 선택해 주세요.`);
      return;
    }

    setLoading(true);

    try {
      // 1. Check for duplicate phone in Firestore
      const regRef = collection(db, 'registrations');
      const q = query(regRef, where('phoneDigits', '==', digits));
      const existingSnap = await getDocs(q);

      if (!existingSnap.empty) {
        const existingData = existingSnap.docs[0].data() as Registration;
        const masked = digits.length === 11
          ? `${digits.slice(0, 3)}-****-${digits.slice(7)}`
          : `${digits.slice(0, 3)}-****-${digits.slice(6)}`;

        setCompletedReg({
          ...existingData,
          id: existingSnap.docs[0].id,
          phone: masked,
        });
        showToast('이미 사전예약이 완료된 휴대폰 번호입니다.');
        setLoading(false);
        return;
      }

      // 2. Generate unique coupon
      const randPart = () => Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, 'X');
      const couponCode = `LNTN-${randPart()}-${randPart()}`;

      const maskedPhone = digits.length === 11
        ? `${digits.slice(0, 3)}-****-${digits.slice(7)}`
        : `${digits.slice(0, 3)}-****-${digits.slice(6)}`;

      // 3. Save to Firestore
      const newEntry = {
        phone: maskedPhone,
        phoneDigits: digits,
        os,
        server: currentServer.id,
        serverName: currentServer.name,
        ch: selectedChannel,
        mkt: agMkt,
        coupon: couponCode,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(regRef, newEntry);

      const savedReg: Registration = {
        id: docRef.id,
        ...newEntry,
      };

      setCompletedReg(savedReg);
      onSuccess(savedReg);
      showToast('사전예약이 성공적으로 완료되었습니다!');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'registrations');
      setErrorMsg('사전예약 처리 중 네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCoupon = () => {
    if (!completedReg?.coupon) return;
    navigator.clipboard.writeText(completedReg.coupon);
    setCopied(true);
    showToast('쿠폰 번호가 복사되었습니다!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setCompletedReg(null);
    setPhoneRaw('');
    setAgAge(false);
    setAgPrivacy(false);
    setAgMkt(false);
    setErrorMsg('');
  };

  // Completed Screen
  if (completedReg) {
    return (
      <div className="bg-[#11262f] border border-[#7fd1a8] rounded-2xl p-6 sm:p-8 grid gap-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#7fd1a8]/20 flex items-center justify-center text-[#7fd1a8]">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-serif text-[#7fd1a8]">
              사전예약이 완료되었습니다!
            </h3>
            <p className="text-xs text-[#9db0ad] mt-0.5">
              정식 출시 당일 등록하신 번호로 문자 쿠폰이 발송됩니다.
            </p>
          </div>
        </div>

        <div className="bg-[#0b1a22] border border-[#24414b] rounded-xl p-4 text-sm grid gap-2.5">
          <div className="flex justify-between border-b border-[#24414b]/60 pb-2">
            <span className="text-[#9db0ad]">휴대폰 번호</span>
            <span className="font-mono text-[#ece6d6] font-semibold">{completedReg.phone} ({completedReg.os})</span>
          </div>
          <div className="flex justify-between border-b border-[#24414b]/60 pb-2">
            <span className="text-[#9db0ad]">시작 서버 · 채널</span>
            <span className="text-[#f2b84b] font-medium">{completedReg.serverName} 서버 {completedReg.ch}채널</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#9db0ad]">이벤트 소식 수신</span>
            <span className={completedReg.mkt ? 'text-[#7fd1a8]' : 'text-[#9db0ad]'}>
              {completedReg.mkt ? '동의함' : '미동의'}
            </span>
          </div>
        </div>

        <div className="grid gap-2">
          <label className="text-xs text-[#9db0ad] font-semibold">사전예약 쿠폰 번호</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 font-mono text-lg sm:text-xl font-bold tracking-widest bg-[#0b1a22] border border-dashed border-[#f2b84b] text-[#f2b84b] py-3 px-4 rounded-lg text-center select-all">
              {completedReg.coupon}
            </div>
            <button
              onClick={handleCopyCoupon}
              className="btn-primary py-3 px-4 shrink-0 text-sm font-semibold flex items-center gap-1.5"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? '복사됨' : '복사'}</span>
            </button>
          </div>
          <p className="text-[11px] text-[#9db0ad]">
            * 실제 쿠폰은 2026.12.17(목) 출시 당일 문자로도 함께 전송됩니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={handleReset}
            className="btn-ghost text-sm text-[#f2b84b] border-[#f2b84b]/40 hover:border-[#f2b84b]"
          >
            다른 번호로 사전예약하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#11262f] border border-[#24414b] rounded-2xl p-5 sm:p-7 grid gap-5 shadow-xl"
      noValidate
    >
      <div className="grid gap-1">
        <span className="eyebrow flex items-center gap-1.5">
          <Smartphone className="w-4 h-4 text-[#f2b84b]" />
          사전예약 신청
        </span>
        <h2 className="text-xl sm:text-2xl font-serif text-[#ece6d6]">
          출항 전에 이름을 올려 두세요
        </h2>
        <p className="text-xs sm:text-sm text-[#9db0ad] m-0">
          출시 당일 문자로 쿠폰 번호와 다운로드 링크를 보내드립니다.
        </p>
      </div>

      {/* Platform selection */}
      <fieldset className="border-0 p-0 m-0 grid gap-2">
        <legend className="text-xs font-bold text-[#9db0ad] mb-1">운영체제(OS)</legend>
        <div className="grid grid-cols-2 gap-2">
          <label
            className={`border rounded-lg p-3 text-center cursor-pointer font-medium text-sm transition-all ${
              os === 'Android'
                ? 'border-[#f2b84b] bg-[#f2b84b]/10 text-[#f2b84b] shadow-sm'
                : 'border-[#24414b] text-[#ece6d6] hover:bg-[#0b1a22]'
            }`}
          >
            <input
              type="radio"
              name="os"
              value="Android"
              checked={os === 'Android'}
              onChange={() => setOs('Android')}
              className="sr-only"
            />
            Android
          </label>
          <label
            className={`border rounded-lg p-3 text-center cursor-pointer font-medium text-sm transition-all ${
              os === 'iOS'
                ? 'border-[#f2b84b] bg-[#f2b84b]/10 text-[#f2b84b] shadow-sm'
                : 'border-[#24414b] text-[#ece6d6] hover:bg-[#0b1a22]'
            }`}
          >
            <input
              type="radio"
              name="os"
              value="iOS"
              checked={os === 'iOS'}
              onChange={() => setOs('iOS')}
              className="sr-only"
            />
            iOS (아이폰)
          </label>
        </div>
      </fieldset>

      {/* Server selection */}
      <fieldset className="border-0 p-0 m-0 grid gap-2">
        <legend className="text-xs font-bold text-[#9db0ad] mb-1">시작 서버</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {servers.map((s) => {
            const isSelected = s.id === selectedServerId;
            return (
              <label
                key={s.id}
                className={`border rounded-lg p-3 cursor-pointer text-left grid gap-1.5 transition-all ${
                  isSelected
                    ? 'border-[#f2b84b] bg-[#f2b84b]/10 text-[#f2b84b]'
                    : 'border-[#24414b] text-[#ece6d6] hover:bg-[#0b1a22]'
                }`}
              >
                <input
                  type="radio"
                  name="server"
                  value={s.id}
                  checked={isSelected}
                  onChange={() => {
                    setSelectedServerId(s.id);
                    setSelectedChannel(1);
                  }}
                  className="sr-only"
                />
                <span
                  className={`self-start text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    s.tag[0] === 'new'
                      ? 'text-[#7fd1a8] border-[#7fd1a8]'
                      : s.tag[0] === 'busy'
                      ? 'text-[#ff8f7a] border-[#ff8f7a]'
                      : 'text-[#9db0ad] border-[#24414b]'
                  }`}
                >
                  {s.tag[1]}
                </span>
                <b className="font-serif text-base text-[#ece6d6]">{s.name}</b>
                <small className="text-[11px] text-[#9db0ad] leading-tight line-clamp-2">
                  {s.desc}
                </small>
              </label>
            );
          })}
        </div>
        <span className="text-[11px] text-[#9db0ad]">
          * 정식 출시 후 1회 서버 무료 이전이 지원됩니다.
        </span>
      </fieldset>

      {/* Channel selection */}
      <fieldset className="border-0 p-0 m-0 grid gap-2">
        <legend className="text-xs font-bold text-[#9db0ad] mb-1 flex items-center justify-between">
          <span>채널 선택 ({currentServer.name})</span>
          <span className="text-[11px] text-[#f2b84b] font-normal">
            선택: {selectedChannel}채널
          </span>
        </legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {currentServer.base.map((_, idx) => {
            const chNum = idx + 1;
            const count = getChannelCount(currentServer.id, chNum);
            const cap = getChannelCap(currentServer.id, chNum);
            const isFull = count >= cap;
            const isSelected = selectedChannel === chNum;
            const meterPercent = Math.min(100, (count / cap) * 100);

            return (
              <label
                key={chNum}
                className={`border rounded-lg p-2.5 text-center cursor-pointer grid gap-1 transition-all ${
                  isFull
                    ? 'opacity-40 cursor-not-allowed border-[#24414b] line-through'
                    : isSelected
                    ? 'border-[#f2b84b] bg-[#f2b84b]/10 text-[#f2b84b]'
                    : 'border-[#24414b] text-[#ece6d6] hover:bg-[#0b1a22]'
                }`}
              >
                <input
                  type="radio"
                  name="channel"
                  value={chNum}
                  disabled={isFull}
                  checked={isSelected}
                  onChange={() => setSelectedChannel(chNum)}
                  className="sr-only"
                />
                <span className="text-xs font-bold">{chNum}채널</span>
                <small className="text-[11px] text-[#9db0ad]">
                  {isFull ? '마감' : `${count.toLocaleString()}명`}
                </small>
                <span className="h-1 rounded-full bg-[#24414b] overflow-hidden mt-1">
                  <i
                    className={`block h-full transition-all duration-300 ${
                      isSelected ? 'bg-[#f2b84b]' : 'bg-[#9db0ad]'
                    }`}
                    style={{ width: `${meterPercent}%` }}
                  />
                </span>
              </label>
            );
          })}
        </div>
        <span className="text-[11px] text-[#9db0ad]">
          같은 채널 사전예약자끼리 출시 당일 같은 항구에서 출발합니다.
        </span>
      </fieldset>

      {/* Phone input */}
      <div className="grid gap-1.5">
        <label htmlFor="phone-input" className="text-xs font-bold text-[#9db0ad]">
          휴대폰 번호
        </label>
        <input
          id="phone-input"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          placeholder="010-0000-0000"
          maxLength={13}
          value={phoneRaw}
          onChange={handlePhoneChange}
          className="w-full font-mono text-base bg-[#0b1a22] text-[#ece6d6] border border-[#24414b] rounded-lg px-3.5 py-3 focus:outline-none focus:border-[#f2b84b] transition placeholder:text-[#9db0ad]/40"
        />
        <span className="text-[11px] text-[#9db0ad]">
          본인 명의 번호 1개당 1회 참여할 수 있습니다.
        </span>
      </div>

      {/* Agreements */}
      <div className="grid gap-2.5 border-t border-[#24414b] pt-4">
        <label className="flex items-center gap-2.5 text-sm font-bold text-[#ece6d6] cursor-pointer">
          <input
            type="checkbox"
            checked={isAllAgreed}
            onChange={handleAllAgree}
            className="w-4 h-4 accent-[#f2b84b] rounded"
          />
          전체 동의
        </label>

        <label className="flex items-start gap-2.5 text-xs sm:text-sm text-[#ece6d6]/90 cursor-pointer">
          <input
            type="checkbox"
            checked={agAge}
            onChange={(e) => setAgAge(e.target.checked)}
            className="w-4 h-4 accent-[#f2b84b] rounded mt-0.5 shrink-0"
          />
          <span>
            <span className="text-[11px] font-bold text-[#f2b84b] mr-1.5">[필수]</span>
            만 14세 이상입니다
          </span>
        </label>

        <label className="flex items-start gap-2.5 text-xs sm:text-sm text-[#ece6d6]/90 cursor-pointer">
          <input
            type="checkbox"
            checked={agPrivacy}
            onChange={(e) => setAgPrivacy(e.target.checked)}
            className="w-4 h-4 accent-[#f2b84b] rounded mt-0.5 shrink-0"
          />
          <span>
            <span className="text-[11px] font-bold text-[#f2b84b] mr-1.5">[필수]</span>
            개인정보 수집·이용 동의 (휴대폰 번호, 보관: 쿠폰 발송 후 30일)
          </span>
        </label>

        <label className="flex items-start gap-2.5 text-xs sm:text-sm text-[#ece6d6]/90 cursor-pointer">
          <input
            type="checkbox"
            checked={agMkt}
            onChange={(e) => setAgMkt(e.target.checked)}
            className="w-4 h-4 accent-[#f2b84b] rounded mt-0.5 shrink-0"
          />
          <span>
            <span className="text-[11px] font-bold text-[#9db0ad] mr-1.5">[선택]</span>
            이벤트·업데이트 소식 문자 수신 동의
          </span>
        </label>
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 text-xs text-[#ff8f7a] bg-[#ff8f7a]/10 border border-[#ff8f7a]/30 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full text-base py-3.5"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>사전예약 신청 중...</span>
          </>
        ) : (
          <span>사전예약 완료하기</span>
        )}
      </button>
    </form>
  );
}
