import React, { useState } from 'react';
import { doc, deleteDoc, updateDoc, writeBatch, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Registration, ServerInfo } from '../types';
import {
  Users,
  Search,
  Download,
  Trash2,
  Edit2,
  Check,
  X,
  Server,
  Plus,
  AlertTriangle,
  RefreshCw,
  Phone,
} from 'lucide-react';

interface AdminDashboardProps {
  registrations: Registration[];
  servers: ServerInfo[];
  totalMilestoneCount: number;
  onUpdateServers: (newServers: ServerInfo[]) => void;
  showToast: (msg: string) => void;
}

export default function AdminDashboard({
  registrations,
  servers,
  totalMilestoneCount,
  onUpdateServers,
  showToast,
}: AdminDashboardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterServer, setFilterServer] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 6;

  // Edit inline applicant state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editOs, setEditOs] = useState<'Android' | 'iOS'>('Android');
  const [editServer, setEditServer] = useState('');
  const [editCh, setEditCh] = useState(1);

  // Capacity edit mode
  const [capEditMode, setCapEditMode] = useState(false);
  const [draftServers, setDraftServers] = useState<ServerInfo[]>([]);

  // Add server form
  const [newSrvName, setNewSrvName] = useState('');
  const [newSrvDesc, setNewSrvDesc] = useState('');
  const [newSrvTag, setNewSrvTag] = useState<'new' | 'ok' | 'busy'>('new');
  const [newSrvChannels, setNewSrvChannels] = useState(4);
  const [newSrvCap, setNewSrvCap] = useState(5000);

  // Confirm delete modal
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{ id: string; name: string } | null>(null);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Filter and search
  const filteredList = registrations.filter((reg) => {
    const matchServer = !filterServer || reg.server === filterServer;
    const matchQuery =
      !searchTerm ||
      reg.phone.includes(searchTerm) ||
      reg.phoneDigits.includes(searchTerm) ||
      reg.serverName.includes(searchTerm) ||
      reg.coupon.toLowerCase().includes(searchTerm.toLowerCase());
    return matchServer && matchQuery;
  });

  const totalPages = Math.max(1, Math.ceil(filteredList.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const pagedList = filteredList.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // KPIs
  const androidCount = registrations.filter((r) => r.os === 'Android').length;
  const iosCount = registrations.filter((r) => r.os === 'iOS').length;
  const mktCount = registrations.filter((r) => r.mkt).length;
  const mktRate = registrations.length ? Math.round((mktCount / registrations.length) * 100) : 0;

  // Start inline editing
  const startEdit = (reg: Registration) => {
    setEditingId(reg.id);
    setEditOs(reg.os);
    setEditServer(reg.server);
    setEditCh(reg.ch);
  };

  const saveEdit = async (regId: string) => {
    setActionLoading(true);
    try {
      const targetServer = servers.find((s) => s.id === editServer);
      const regDocRef = doc(db, 'registrations', regId);
      await updateDoc(regDocRef, {
        os: editOs,
        server: editServer,
        serverName: targetServer?.name || editServer,
        ch: editCh,
        updatedAt: serverTimestamp(),
      });
      setEditingId(null);
      showToast('신청자 정보가 성공적으로 변경되었습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `registrations/${regId}`);
      showToast('정보 변경 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  // Delete single applicant
  const handleDeleteApplicant = async (regId: string) => {
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, 'registrations', regId));
      setDeleteConfirmTarget(null);
      showToast('신청자 데이터가 Firestore에서 삭제되었습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `registrations/${regId}`);
      showToast('삭제 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  // Clear all applicants
  const handleClearAll = async () => {
    if (!registrations.length) return;
    setActionLoading(true);
    try {
      const batch = writeBatch(db);
      registrations.forEach((r) => {
        batch.delete(doc(db, 'registrations', r.id));
      });
      await batch.commit();
      setClearAllConfirm(false);
      showToast(`신청자 ${registrations.length}건이 모두 삭제되었습니다.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'registrations');
      showToast('일괄 삭제 중 오류가 발생했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  // CSV download helper with UTF-8 BOM
  const downloadCsv = (filename: string, rows: (string | number)[][]) => {
    const csvContent =
      '\uFEFF' +
      rows
        .map((row) =>
          row
            .map((val) => {
              const str = val == null ? '' : String(val);
              return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
            })
            .join(',')
        )
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`${filename} 파일이 다운로드되었습니다.`);
  };

  const handleExportRosterCsv = () => {
    if (!registrations.length) {
      showToast('다운로드할 신청자 데이터가 없습니다.');
      return;
    }
    const headers = ['No.', '등록일시', '휴대폰 번호', 'OS', '서버', '채널', '마케팅동의', '쿠폰코드'];
    const rows = registrations.map((r, idx) => {
      let dateStr = '';
      if (r.createdAt?.toDate) {
        dateStr = r.createdAt.toDate().toLocaleString('ko-KR');
      } else if (r.createdAt) {
        dateStr = new Date(r.createdAt).toLocaleString('ko-KR');
      }
      return [
        idx + 1,
        dateStr,
        r.phone,
        r.os,
        r.serverName,
        `${r.ch}채널`,
        r.mkt ? '동의' : '미동의',
        r.coupon,
      ];
    });

    const now = new Date();
    const dateStamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(
      now.getDate()
    ).padStart(2, '0')}`;
    downloadCsv(`등불항로_사전예약명단_${dateStamp}.csv`, [headers, ...rows]);
  };

  const handleExportServerCsv = () => {
    const headers = ['서버ID', '서버이름', '상태', '설명', '채널', '현재인원', '정원', '마감여부'];
    const rows: (string | number)[][] = [];

    servers.forEach((s) => {
      s.base.forEach((_, idx) => {
        const chNum = idx + 1;
        const liveMine = registrations.filter((r) => r.server === s.id && r.ch === chNum).length;
        const count = s.base[idx] + liveMine;
        const cap = s.cap[idx] || 5000;
        rows.push([s.id, s.name, s.tag[1], s.desc, `${chNum}채널`, count, cap, count >= cap ? '마감' : '원활']);
      });
    });

    downloadCsv(`등불항로_서버현황.csv`, [headers, ...rows]);
  };

  // Capacity edit functions
  const startCapEdit = () => {
    setDraftServers(JSON.parse(JSON.stringify(servers)));
    setCapEditMode(true);
  };

  const saveCapEdit = async () => {
    try {
      const configRef = doc(db, 'settings', 'config');
      await setDoc(configRef, {
        servers: draftServers,
        updatedAt: serverTimestamp(),
      });
      onUpdateServers(draftServers);
      setCapEditMode(false);
      showToast('서버 및 채널 설정이 Firestore에 저장되었습니다.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/config');
      showToast('설정 저장 중 오류가 발생했습니다.');
    }
  };

  const handleAddServer = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSrvName.trim();
    if (!name) return;

    const tagLabel = newSrvTag === 'new' ? '신규' : newSrvTag === 'busy' ? '혼잡' : '원활';
    const newServerObj: ServerInfo = {
      id: `s_${Date.now().toString(36)}`,
      name,
      desc: newSrvDesc.trim() || '신규 오픈 서버',
      tag: [newSrvTag, tagLabel],
      base: Array(newSrvChannels).fill(0),
      cap: Array(newSrvChannels).fill(newSrvCap),
    };

    setDraftServers([...draftServers, newServerObj]);
    setNewSrvName('');
    setNewSrvDesc('');
    showToast(`"${name}" 서버가 추가되었습니다. [설정 저장] 버튼을 눌러 확정하세요.`);
  };

  const handleAddChannel = (serverIdx: number) => {
    const updated = [...draftServers];
    const s = updated[serverIdx];
    if (s.base.length >= 10) {
      showToast('채널은 서버당 최대 10개까지 추가 가능합니다.');
      return;
    }
    s.base.push(0);
    s.cap.push(5000);
    setDraftServers(updated);
  };

  return (
    <div className="py-10 sm:py-14">
      <div className="wrap grid gap-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#24414b] pb-6">
          <div className="grid gap-1">
            <span className="eyebrow flex items-center gap-1.5">
              <Users className="w-4 h-4 text-[#f2b84b]" />
              Firebase 실시간 관리 센터
            </span>
            <h2 className="text-2xl sm:text-3xl font-serif text-[#ece6d6]">
              사전예약 신청자 및 서버 관리
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-[#7fd1a8]/10 text-[#7fd1a8] border border-[#7fd1a8]/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#7fd1a8] animate-pulse"></span>
              Firestore 실시간 동기화 활성
            </span>
          </div>
        </div>

        {/* Live KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="bg-[#11262f] border border-[#24414b] rounded-xl p-4 sm:p-5 grid gap-1">
            <span className="text-xs text-[#9db0ad]">실제 신청자 (Firestore)</span>
            <b className="font-mono text-3xl text-[#f2b84b] tabular-nums">
              {registrations.length.toLocaleString()}
              <span className="text-sm font-sans text-[#ece6d6] ml-1.5 font-normal">명</span>
            </b>
            <small className="text-[11px] text-[#9db0ad]">
              누적 표기: {totalMilestoneCount.toLocaleString()}명
            </small>
          </div>

          <div className="bg-[#11262f] border border-[#24414b] rounded-xl p-4 sm:p-5 grid gap-1">
            <span className="text-xs text-[#9db0ad]">플랫폼 분포 (Android / iOS)</span>
            <b className="font-mono text-2xl text-[#ece6d6] tabular-nums">
              {androidCount} <span className="text-sm text-[#9db0ad]">/</span> {iosCount}
            </b>
            <small className="text-[11px] text-[#9db0ad]">
              Android {registrations.length ? Math.round((androidCount / registrations.length) * 100) : 0}% / iOS{' '}
              {registrations.length ? Math.round((iosCount / registrations.length) * 100) : 0}%
            </small>
          </div>

          <div className="bg-[#11262f] border border-[#24414b] rounded-xl p-4 sm:p-5 grid gap-1">
            <span className="text-xs text-[#9db0ad]">마케팅 알림 수신 동의</span>
            <b className="font-mono text-3xl text-[#7fd1a8] tabular-nums">
              {mktRate}%
            </b>
            <small className="text-[11px] text-[#9db0ad]">
              동의 {mktCount}건 / 전체 {registrations.length}건
            </small>
          </div>
        </div>

        {/* Applicant List Section */}
        <div className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-serif text-[#ece6d6] flex items-center gap-2">
              <Phone className="w-4 h-4 text-[#f2b84b]" />
              신청자 명단
              <span className="text-xs font-mono font-normal text-[#9db0ad]">
                ({filteredList.length}건)
              </span>
            </h3>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExportRosterCsv}
                className="btn-ghost flex items-center gap-1.5 text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV 다운로드</span>
              </button>
              <button
                type="button"
                onClick={() => setClearAllConfirm(true)}
                disabled={!registrations.length}
                className="btn-ghost danger flex items-center gap-1.5 text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>명단 전체 삭제</span>
              </button>
            </div>
          </div>

          {/* Search & Filter tools */}
          <div className="flex flex-wrap items-center gap-2 bg-[#11262f] p-3 rounded-xl border border-[#24414b]">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-[#9db0ad] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="전화번호 뒤 4자리, 서버 이름, 쿠폰 검색"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-[#0b1a22] border border-[#24414b] rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm text-[#ece6d6] focus:outline-none focus:border-[#f2b84b]"
              />
            </div>

            <select
              value={filterServer}
              onChange={(e) => {
                setFilterServer(e.target.value);
                setPage(1);
              }}
              className="bg-[#0b1a22] border border-[#24414b] rounded-lg px-3 py-2 text-xs sm:text-sm text-[#ece6d6] focus:outline-none focus:border-[#f2b84b]"
            >
              <option value="">전체 서버</option>
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="table-wrap">
            <table className="roster-table">
              <thead>
                <tr>
                  <th className="w-12">No.</th>
                  <th>신청 일시</th>
                  <th>휴대폰 번호</th>
                  <th>플랫폼</th>
                  <th>서버 · 채널</th>
                  <th>마케팅 수신</th>
                  <th>쿠폰 코드</th>
                  <th className="text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {!pagedList.length ? (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-[#9db0ad]">
                      {registrations.length === 0
                        ? '아직 등록된 사전예약 신청자가 없습니다. 메인 폼에서 신청하면 실시간으로 이곳에 등록됩니다.'
                        : '검색 조건과 일치하는 신청자가 없습니다.'}
                    </td>
                  </tr>
                ) : (
                  pagedList.map((reg, idx) => {
                    const rowNum = (currentPage - 1) * PAGE_SIZE + idx + 1;
                    const isEditing = editingId === reg.id;

                    let dateFormatted = '-';
                    if (reg.createdAt?.toDate) {
                      dateFormatted = reg.createdAt.toDate().toLocaleString('ko-KR', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                    }

                    if (isEditing) {
                      const curEditServerObj = servers.find((s) => s.id === editServer) || servers[0];
                      return (
                        <tr key={reg.id} className="bg-[#f2b84b]/5">
                          <td data-label="No." className="num">{rowNum}</td>
                          <td data-label="신청일시" className="text-xs text-[#9db0ad]">{dateFormatted}</td>
                          <td data-label="전화번호" className="num font-semibold text-[#f2b84b]">{reg.phone}</td>
                          <td data-label="플랫폼">
                            <select
                              value={editOs}
                              onChange={(e) => setEditOs(e.target.value as any)}
                              className="bg-[#0b1a22] border border-[#f2b84b] rounded p-1 text-xs text-[#ece6d6]"
                            >
                              <option value="Android">Android</option>
                              <option value="iOS">iOS</option>
                            </select>
                          </td>
                          <td data-label="서버·채널">
                            <div className="flex gap-1.5 flex-wrap">
                              <select
                                value={editServer}
                                onChange={(e) => {
                                  setEditServer(e.target.value);
                                  setEditCh(1);
                                }}
                                className="bg-[#0b1a22] border border-[#f2b84b] rounded p-1 text-xs text-[#ece6d6]"
                              >
                                {servers.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                              <select
                                value={editCh}
                                onChange={(e) => setEditCh(Number(e.target.value))}
                                className="bg-[#0b1a22] border border-[#f2b84b] rounded p-1 text-xs text-[#ece6d6]"
                              >
                                {curEditServerObj.base.map((_, i) => (
                                  <option key={i + 1} value={i + 1}>
                                    {i + 1}채널
                                  </option>
                                ))}
                              </select>
                            </div>
                          </td>
                          <td data-label="마케팅">
                            <span className={reg.mkt ? 'text-[#7fd1a8]' : 'text-[#9db0ad]'}>
                              {reg.mkt ? '동의' : '미동의'}
                            </span>
                          </td>
                          <td data-label="쿠폰" className="num text-xs">{reg.coupon}</td>
                          <td data-label="관리" className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => saveEdit(reg.id)}
                                disabled={actionLoading}
                                className="p-1.5 rounded bg-[#f2b84b] text-[#2a1a00] hover:bg-[#f2b84b]/90 text-xs font-bold"
                                title="저장"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="p-1.5 rounded bg-[#24414b] text-[#ece6d6] hover:bg-[#24414b]/80 text-xs"
                                title="취소"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={reg.id} className="hover:bg-[#11262f]/50 transition-colors">
                        <td data-label="No." className="num text-[#9db0ad]">{rowNum}</td>
                        <td data-label="신청일시" className="text-xs text-[#9db0ad]">{dateFormatted}</td>
                        <td data-label="전화번호" className="num font-semibold text-[#ece6d6]">{reg.phone}</td>
                        <td data-label="플랫폼">
                          <span
                            className={`text-xs px-2 py-0.5 rounded border ${
                              reg.os === 'iOS'
                                ? 'border-[#9db0ad]/30 text-[#ece6d6]'
                                : 'border-[#7fd1a8]/30 text-[#7fd1a8]'
                            }`}
                          >
                            {reg.os}
                          </span>
                        </td>
                        <td data-label="서버·채널">
                          <span className="text-xs text-[#f2b84b] font-medium">
                            {reg.serverName} · {reg.ch}채널
                          </span>
                        </td>
                        <td data-label="마케팅">
                          <span className={`text-xs ${reg.mkt ? 'text-[#7fd1a8]' : 'text-[#9db0ad]'}`}>
                            {reg.mkt ? '동의' : '미동의'}
                          </span>
                        </td>
                        <td data-label="쿠폰" className="num text-xs text-[#9db0ad] font-mono">
                          {reg.coupon}
                        </td>
                        <td data-label="관리" className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEdit(reg)}
                              className="p-1 text-[#9db0ad] hover:text-[#f2b84b] transition"
                              title="정보 변경"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmTarget({ id: reg.id, name: reg.phone })}
                              className="p-1 text-[#9db0ad] hover:text-[#ff8f7a] transition"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-2 pt-2 text-xs text-[#9db0ad]">
              <span>
                전체 {filteredList.length}건 중 {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(filteredList.length, currentPage * PAGE_SIZE)}건
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2.5 py-1 rounded border border-[#24414b] disabled:opacity-40"
                >
                  이전
                </button>
                <span className="px-2 font-mono text-[#ece6d6]">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 rounded border border-[#24414b] disabled:opacity-40"
                >
                  다음
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Server & Channel Management Section */}
        <div className="grid gap-4 border-t border-[#24414b] pt-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-serif text-[#ece6d6] flex items-center gap-2">
                <Server className="w-4 h-4 text-[#f2b84b]" />
                서버 · 채널 현황 및 정원 관리
              </h3>
              <p className="text-xs text-[#9db0ad] mt-0.5">
                채널별 인원 / 정원입니다. 정원 변경 및 새 서버 추가는 실시간으로 참가자 화면에 반영됩니다.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportServerCsv}
                className="btn-ghost flex items-center gap-1.5 text-xs"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV 다운로드</span>
              </button>

              {!capEditMode ? (
                <button
                  type="button"
                  onClick={startCapEdit}
                  className="btn-primary py-2 px-3.5 text-xs"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>정원 · 채널 수정</span>
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCapEditMode(false)}
                    className="btn-ghost text-xs py-2 px-3"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={saveCapEdit}
                    className="btn-primary text-xs py-2 px-3.5"
                  >
                    설정 저장
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Server Table */}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>서버</th>
                  <th>상태</th>
                  <th>채널별 인원 / 정원</th>
                  <th>총원</th>
                  {capEditMode && <th>채널 추가</th>}
                </tr>
              </thead>
              <tbody>
                {(capEditMode ? draftServers : servers).map((s, sIdx) => {
                  const totalCount = s.base.reduce((acc, curr, idx) => {
                    const mine = registrations.filter((r) => r.server === s.id && r.ch === idx + 1).length;
                    return acc + curr + mine;
                  }, 0);
                  const totalCap = s.cap.reduce((acc, curr) => acc + curr, 0);

                  return (
                    <tr key={s.id}>
                      <td className="font-serif font-bold text-sm text-[#ece6d6]">{s.name}</td>
                      <td>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            s.tag[0] === 'new'
                              ? 'text-[#7fd1a8] border-[#7fd1a8]'
                              : s.tag[0] === 'busy'
                              ? 'text-[#ff8f7a] border-[#ff8f7a]'
                              : 'text-[#9db0ad] border-[#24414b]'
                          }`}
                        >
                          {s.tag[1]}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          {s.base.map((baseVal, chIdx) => {
                            const chNum = chIdx + 1;
                            const mine = registrations.filter((r) => r.server === s.id && r.ch === chNum).length;
                            const count = baseVal + mine;
                            const capVal = s.cap[chIdx] || 5000;

                            if (capEditMode) {
                              return (
                                <div key={chNum} className="flex items-center gap-1 bg-[#0b1a22] border border-[#24414b] p-1.5 rounded">
                                  <span className="text-[11px] font-bold text-[#f2b84b]">{chNum}ch:</span>
                                  <input
                                    type="number"
                                    min={count}
                                    max={99999}
                                    value={capVal}
                                    onChange={(e) => {
                                      const updated = [...draftServers];
                                      updated[sIdx].cap[chIdx] = Number(e.target.value) || 1;
                                      setDraftServers(updated);
                                    }}
                                    className="w-16 bg-[#11262f] border border-[#24414b] rounded text-center text-xs py-0.5 text-[#ece6d6]"
                                  />
                                </div>
                              );
                            }

                            const isFull = count >= capVal;
                            return (
                              <span
                                key={chNum}
                                className={`text-xs px-2 py-1 rounded border ${
                                  isFull
                                    ? 'bg-[#ff8f7a]/10 border-[#ff8f7a]/30 text-[#ff8f7a]'
                                    : 'bg-[#0b1a22] border-[#24414b] text-[#ece6d6]'
                                }`}
                              >
                                {chNum}ch: {count.toLocaleString()} / {capVal.toLocaleString()}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td className="num font-bold text-[#f2b84b] text-sm">
                        {totalCount.toLocaleString()} / {totalCap.toLocaleString()}
                      </td>
                      {capEditMode && (
                        <td>
                          <button
                            type="button"
                            onClick={() => handleAddChannel(sIdx)}
                            className="btn-ghost text-xs py-1 px-2 text-[#f2b84b] border-[#f2b84b]/30"
                          >
                            + 채널 추가
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Add Server Form in Edit Mode */}
          {capEditMode && (
            <form onSubmit={handleAddServer} className="bg-[#0b1a22] border border-dashed border-[#24414b] p-4 rounded-xl grid gap-3">
              <h4 className="text-sm font-bold text-[#ece6d6] flex items-center gap-1.5">
                <Plus className="w-4 h-4 text-[#f2b84b]" />
                신규 서버 추가하기
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5">
                <input
                  type="text"
                  placeholder="서버 이름 (예: 은빛여울)"
                  value={newSrvName}
                  onChange={(e) => setNewSrvName(e.target.value)}
                  className="bg-[#11262f] border border-[#24414b] rounded-lg px-3 py-1.5 text-xs text-[#ece6d6]"
                  required
                />
                <input
                  type="text"
                  placeholder="서버 설명 (예: 신규 이벤트 서버)"
                  value={newSrvDesc}
                  onChange={(e) => setNewSrvDesc(e.target.value)}
                  className="bg-[#11262f] border border-[#24414b] rounded-lg px-3 py-1.5 text-xs text-[#ece6d6]"
                />
                <select
                  value={newSrvTag}
                  onChange={(e) => setNewSrvTag(e.target.value as any)}
                  className="bg-[#11262f] border border-[#24414b] rounded-lg px-3 py-1.5 text-xs text-[#ece6d6]"
                >
                  <option value="new">신규</option>
                  <option value="ok">원활</option>
                  <option value="busy">혼잡</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={newSrvChannels}
                  onChange={(e) => setNewSrvChannels(Number(e.target.value) || 1)}
                  placeholder="채널 수"
                  className="bg-[#11262f] border border-[#24414b] rounded-lg px-3 py-1.5 text-xs text-[#ece6d6]"
                />
                <button type="submit" className="btn-primary text-xs py-1.5">
                  서버 등록
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Delete Single Confirmation Modal */}
        {deleteConfirmTarget && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-[#11262f] border border-[#ff8f7a] rounded-2xl p-6 max-w-sm w-full grid gap-4 shadow-2xl">
              <div className="flex items-center gap-3 text-[#ff8f7a]">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h4 className="text-base font-bold text-[#ece6d6]">신청자 데이터 삭제</h4>
              </div>
              <p className="text-xs text-[#9db0ad] leading-relaxed">
                <span className="text-[#ece6d6] font-semibold">{deleteConfirmTarget.name}</span> 님의
                사전예약 데이터를 Firestore에서 완전히 삭제하시겠습니까? 삭제 후에는 복구할 수 없습니다.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTarget(null)}
                  className="btn-ghost text-xs"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteApplicant(deleteConfirmTarget.id)}
                  disabled={actionLoading}
                  className="btn-primary bg-[#ff8f7a] text-[#2a1a00] hover:bg-[#ff8f7a]/90 text-xs font-bold"
                >
                  삭제 확인
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Clear All Confirmation Modal */}
        {clearAllConfirm && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <div className="bg-[#11262f] border border-[#ff8f7a] rounded-2xl p-6 max-w-md w-full grid gap-4 shadow-2xl">
              <div className="flex items-center gap-3 text-[#ff8f7a]">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h4 className="text-base font-bold text-[#ece6d6]">전체 명단 일괄 삭제</h4>
              </div>
              <p className="text-xs text-[#9db0ad] leading-relaxed">
                현재 등록된 <b className="text-[#f2b84b]">{registrations.length}명</b>의 사전예약 명단을
                모두 영구 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClearAllConfirm(false)}
                  className="btn-ghost text-xs"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={actionLoading}
                  className="btn-primary bg-[#ff8f7a] text-[#2a1a00] hover:bg-[#ff8f7a]/90 text-xs font-bold"
                >
                  전체 삭제 진행
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
