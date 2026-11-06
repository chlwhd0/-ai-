/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  getDocFromServer,
  writeBatch
} from 'firebase/firestore';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

// Error Handling conforming to SKILL.md
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Connection check
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Types
export interface ApplicantEntry {
  id: string;
  phone: string;
  os: 'Android' | 'iOS';
  server: string;
  ch: number;
  mkt: boolean;
  coupon: string;
  createdAt: string;
  at: string;
  updatedAt?: string;
  no?: number;
}

interface ServerItem {
  id: string;
  name: string;
  desc: string;
  tag: [string, string];
  base: number[];
  cap: number[];
  ch: number[];
  orig?: number;
  isNew?: boolean;
}

// Main Application Logic
const LAUNCH = new Date('2026-12-17T00:00:00+09:00').getTime();
const pad = (n: number) => String(n).padStart(2, '0');
const $ = (id: string) => document.getElementById(id) as HTMLElement;

// Admin authentication constants
const ADMIN_HASH = '43f263bb6ddceba7241be540c23213b36e332d65a39f5a9f0860a010cc43a423';
const AUTH_KEY = 'lantern-admin-auth', MAX_TRY = 5, LOCK_SEC = 30;
let memAuth = false, fails = 0, lockUntil = 0;
let lockTimer: ReturnType<typeof setTimeout> | undefined;

let storageOK = true;
let entries: ApplicantEntry[] = [];

// Countdown Timer
function tick() {
  let s = Math.max(0, Math.floor((LAUNCH - Date.now()) / 1000));
  const cdD = $('cd-d');
  const cdH = $('cd-h');
  const cdM = $('cd-m');
  const cdS = $('cd-s');
  if (cdD) cdD.textContent = pad(Math.floor(s / 86400));
  s %= 86400;
  if (cdH) cdH.textContent = pad(Math.floor(s / 3600));
  s %= 3600;
  if (cdM) cdM.textContent = pad(Math.floor(s / 60));
  if (cdS) cdS.textContent = pad(s % 60);
}
tick();
setInterval(tick, 1000);

// Milestones
const STOPS = [
  { g: 100000, r: '골드 30,000 · 등불 기름 5통' },
  { g: 300000, r: '5성 선원 선택권 1장' },
  { g: 500000, r: '한정 선박 외형 「호박빛 범선」' },
  { g: 1000000, r: '전설 등불 「첫 번째 불씨」' }
];
const BASE_TOTAL = 742318;
let total = BASE_TOTAL + entries.length;
const fmt = (n: number) => n.toLocaleString('ko-KR');

function renderMilestones() {
  const totalEl = $('total');
  const barFill = $('bar-fill');
  const bar = $('bar');
  const stops = $('stops');
  if (totalEl) totalEl.textContent = fmt(total);
  if (barFill) barFill.style.width = Math.min(100, total / 10000) + '%';
  if (bar) bar.setAttribute('aria-valuenow', String(total));
  if (stops) {
    stops.innerHTML = STOPS.map(s => {
      const hit = total >= s.g;
      return `<li class="${hit ? 'hit' : ''}"><span class="dot"></span><div><div class="goal">${fmt(s.g)}명</div><div class="rw">${s.r}</div></div><span class="st">${hit ? '달성' : '남은 ' + fmt(s.g - total) + '명'}</span></li>`;
    }).join('');
  }
}
renderMilestones();

// Form elements
const phone = $('phone') as HTMLInputElement;
const hint = $('phone-hint');
const submit = $('submit') as HTMLButtonElement;
const reqs = Array.from(document.querySelectorAll<HTMLInputElement>('.req-ag'));
const all = $('ag-all') as HTMLInputElement;
const ags = Array.from(document.querySelectorAll<HTMLInputElement>('.ag'));

// Servers & channels
const DEFAULT_CAP = 5000;
const MAX_CH = 10, MAX_SRV = 8;
const TAGS: Record<string, string> = { new: '신규', ok: '원활', busy: '혼잡' };
const DEFAULT_SERVERS: ServerItem[] = [
  { id: 'north', name: '북등대', desc: '신규 서버 · 첫 출항 보너스', tag: ['new', '신규'], base: [812, 1340, 2205, 640], cap: [5000, 5000, 5000, 5000], ch: [812, 1340, 2205, 640] },
  { id: 'coral', name: '산호만', desc: '초보 선장 추천', tag: ['ok', '원활'], base: [3120, 2876, 3540, 2410], cap: [5000, 5000, 5000, 5000], ch: [3120, 2876, 3540, 2410] },
  { id: 'fog', name: '안개곶', desc: '길드 경쟁 중심', tag: ['busy', '혼잡'], base: [5000, 4980, 5000, 4630], cap: [5000, 5000, 5000, 5000], ch: [5000, 4980, 5000, 4630] }
];
const SERVERS: ServerItem[] = DEFAULT_SERVERS.map(s => ({ ...s, tag: [...s.tag], base: [...s.base], cap: [...s.cap], ch: [...s.base] }));

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));

function recount() {
  SERVERS.forEach(s => s.ch = [...s.base]);
  entries.forEach(e => {
    const s = SERVERS.find(x => x.id === e.server);
    if (s && s.ch[e.ch - 1] != null) s.ch[e.ch - 1] += 1;
  });
  total = BASE_TOTAL + entries.length;
}

const srvName = (id: string) => (SERVERS.find(s => s.id === id) || { name: id }).name;
const srvBox = $('servers');
const chBox = $('channels');

function renderServers() {
  if (!srvBox) return;
  const cur = (document.querySelector('input[name=srv]:checked') as HTMLInputElement)?.value;
  const keep = SERVERS.some(s => s.id === cur) ? cur : SERVERS[0]?.id || 'north';
  srvBox.innerHTML = SERVERS.map(s => `<input type="radio" name="srv" id="srv-${esc(s.id)}" value="${esc(s.id)}"${s.id === keep ? ' checked' : ''}><label for="srv-${esc(s.id)}"><span class="pill ${s.tag[0]}">${s.tag[1]}</span><b>${esc(s.name)}</b><small>${esc(s.desc)}</small></label>`).join('');
}
renderServers();

const curSrv = () => SERVERS.find(s => s.id === (document.querySelector('input[name=srv]:checked') as HTMLInputElement)?.value) || SERVERS[0];

function renderCh() {
  const s = curSrv();
  if (!s || !chBox) return;
  const chServerEl = $('ch-server');
  if (chServerEl) chServerEl.textContent = `· ${s.name}`;
  const firstOpen = s.ch.findIndex((n, i) => n < s.cap[i]);
  chBox.innerHTML = s.ch.map((n, i) => {
    const full = n >= s.cap[i];
    return `<input type="radio" name="ch" id="ch-${i + 1}" value="${i + 1}"${full ? ' disabled' : ''}${i === firstOpen ? ' checked' : ''}><label for="ch-${i + 1}">${i + 1}채널<small>${full ? '마감' : fmt(n) + '명'}</small><span class="meter"><i style="width:${Math.min(100, n / s.cap[i] * 100)}%"></i></span></label>`;
  }).join('');
}
renderCh();

srvBox?.addEventListener('change', () => { renderCh(); update(); });
chBox?.addEventListener('change', () => update());
const curCh = () => document.querySelector('input[name=ch]:checked') as HTMLInputElement | null;

const digits = () => phone ? phone.value.replace(/\D/g, '') : '';
const validPhone = () => /^01[016789]\d{7,8}$/.test(digits());

function update() {
  if (submit) {
    submit.disabled = !(validPhone() && curCh() && reqs.every(c => c.checked));
  }
  if (all) {
    all.checked = ags.every(c => c.checked);
  }
}

if (phone) {
  phone.addEventListener('input', () => {
    const d = digits().slice(0, 11);
    phone.value = d.length < 4 ? d : d.length < 8 ? `${d.slice(0, 3)}-${d.slice(3)}` : `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}`;
    phone.removeAttribute('aria-invalid');
    if (hint) {
      hint.classList.remove('err');
      hint.textContent = '본인 명의 번호 1개당 1회 참여할 수 있습니다.';
    }
    update();
  });

  phone.addEventListener('blur', () => {
    if (phone.value && !validPhone()) {
      phone.setAttribute('aria-invalid', 'true');
      if (hint) {
        hint.classList.add('err');
        hint.textContent = '010으로 시작하는 10~11자리 번호를 입력해 주세요.';
      }
    }
  });
}

all?.addEventListener('change', () => {
  ags.forEach(c => c.checked = all.checked);
  update();
});
ags.forEach(c => c.addEventListener('change', update));

// Pre-registration Submit -> Firestore Write
$('form')?.addEventListener('submit', async e => {
  e.preventDefault();
  if (!submit || submit.disabled) return;
  const phoneDigits = digits();
  if (entries.some(x => x.phone === phoneDigits)) {
    showToast('이미 사전예약한 번호입니다');
    return;
  }
  const osEl = document.querySelector('input[name=os]:checked') as HTMLInputElement;
  const os = osEl ? osEl.value as 'Android' | 'iOS' : 'Android';
  const srv = curSrv();
  const chRadio = curCh();
  const chNo = chRadio ? Number(chRadio.value) : 1;

  if (srv.ch[chNo - 1] >= srv.cap[chNo - 1]) {
    showToast('방금 마감된 채널입니다. 다른 채널을 선택해 주세요');
    renderCh();
    update();
    return;
  }

  const r = () => Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, 'X');
  const coupon = `LNTN-${r()}-${r()}`;
  const nowIso = new Date().toISOString();
  const newId = 'reg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const newDocData: ApplicantEntry = {
    id: newId,
    phone: phoneDigits,
    os,
    server: srv.id,
    ch: chNo,
    mkt: ($('ag-mkt') as HTMLInputElement)?.checked || false,
    coupon,
    createdAt: nowIso,
    at: nowIso
  };

  submit.disabled = true;
  try {
    // Write directly to Firestore
    await setDoc(doc(db, 'registrations', newId), newDocData);
    const before = total;
    const crossed = STOPS.find(s => before < s.g && (total + 1) >= s.g);
    const masked = phone.value.replace(/-(\d{3,4})-/, '-****-');
    const doneMsg = $('done-msg');
    if (doneMsg) {
      doneMsg.textContent = `${masked} (${os}) 번호로 출시 당일 쿠폰을 보내드립니다. 시작 위치는 ${srv.name} 서버 ${chNo}채널입니다.` +
        (newDocData.mkt ? ' 이벤트 소식도 함께 받습니다.' : '');
    }
    const couponEl = $('coupon');
    if (couponEl) couponEl.textContent = coupon;
    $('form').hidden = true;
    $('done').hidden = false;
    showToast(crossed ? `${fmt(crossed.g)}명 보상 달성!` : '사전예약 완료');
  } catch (err) {
    submit.disabled = false;
    handleFirestoreError(err, OperationType.CREATE, `registrations/${newId}`);
  }
});

$('again')?.addEventListener('click', () => {
  ($('form') as HTMLFormElement)?.reset();
  renderCh();
  $('form').hidden = false;
  $('done').hidden = true;
  update();
  phone?.focus();
});

// Real-time Firestore Listeners
// 1. Registrations Collection Real-time Sync
onSnapshot(collection(db, 'registrations'), snapshot => {
  entries = snapshot.docs.map(docSnap => {
    const d = docSnap.data();
    return {
      id: docSnap.id,
      phone: d.phone,
      os: d.os,
      server: d.server,
      ch: d.ch,
      mkt: d.mkt,
      coupon: d.coupon,
      createdAt: d.createdAt || d.at || new Date().toISOString(),
      at: d.at || d.createdAt || new Date().toISOString(),
      updatedAt: d.updatedAt
    } as ApplicantEntry;
  });

  // Sort chronologically
  entries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  recount();
  renderMilestones();
  renderCh();
  update();
  renderRoster();
  renderStats();
}, error => {
  handleFirestoreError(error, OperationType.LIST, 'registrations');
});

// 2. Global Server Configuration Real-time Sync
onSnapshot(doc(db, 'config', 'servers'), docSnap => {
  if (docSnap.exists()) {
    try {
      const data = docSnap.data();
      if (data && typeof data.servers === 'string') {
        const parsed = JSON.parse(data.servers);
        if (Array.isArray(parsed) && parsed.length) {
          SERVERS.splice(0, SERVERS.length, ...parsed.map((x: any) => ({
            id: x.id,
            name: x.name,
            desc: x.desc || '',
            tag: [x.tag[0], TAGS[x.tag[0]] || x.tag[1]] as [string, string],
            base: [...x.base],
            cap: [...x.cap],
            ch: [...x.base]
          })));
          renderServers();
          renderSrvFilter();
          refreshAll();
        }
      }
    } catch (e) {
      console.warn('Failed to parse server config', e);
    }
  }
}, error => {
  console.log('Server config sync notice:', error.message);
});

// Roster (신청자 명단)
const maskPhone = (d: string) => d.length >= 7 ? `${d.slice(0, 3)}-****-${d.slice(-4)}` : d;
const fmtDate = (iso: string) => {
  const t = new Date(iso), p = (n: number) => String(n).padStart(2, '0');
  if (isNaN(t.getTime())) return iso;
  return `${t.getFullYear()}.${p(t.getMonth() + 1)}.${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}:${p(t.getSeconds())}`;
};

function renderSrvFilter() {
  const sel = $('roster-srv') as HTMLSelectElement | null;
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">전체 서버</option>' + SERVERS.map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
  sel.value = SERVERS.some(s => s.id === cur) ? cur : '';
}
renderSrvFilter();

const PAGE = 5;
let chPage = 1, rosterPage = 1;
let editingId: string | null = null;
let capEdit = false, draft: ServerItem[] = [];

function renderRoster() {
  const rosterBody = $('roster-body');
  const rosterStats = $('roster-stats');
  if (!rosterBody || !rosterStats) return;

  if (!isAuthed()) {
    rosterBody.innerHTML = '';
    rosterStats.innerHTML = '';
    renderStats();
    return;
  }

  const q = (($('roster-q') as HTMLInputElement)?.value || '').trim();
  const qd = q.replace(/\D/g, '');
  const sf = ($('roster-srv') as HTMLSelectElement)?.value || '';

  const rows = entries
    .map((e, i) => ({ ...e, no: i + 1 }))
    .reverse()
    .filter(e => (!sf || e.server === sf) && (!q || (qd && e.phone.slice(-4).includes(qd)) || srvName(e.server).includes(q)));

  const cnt = (f: (e: ApplicantEntry) => boolean) => entries.filter(f).length;
  rosterStats.innerHTML = `<span>전체 <b>${fmt(entries.length)}</b>건</span><span>Android <b>${cnt(e => e.os === 'Android')}</b></span><span>iOS <b>${cnt(e => e.os === 'iOS')}</b></span><span>마케팅 수신 동의 <b>${cnt(e => e.mkt)}</b></span>` +
    (rows.length !== entries.length ? `<span>검색 결과 <b>${rows.length}</b>건</span>` : '');

  const rPages = Math.max(1, Math.ceil(rows.length / PAGE));
  rosterPage = Math.min(Math.max(1, rosterPage), rPages);

  rosterBody.innerHTML = !entries.length
    ? `<tr><td class="empty" colspan="8">아직 신청 내역이 없습니다. 위 폼에서 사전예약하면 실시간으로 이곳에 동기화됩니다.</td></tr>`
    : !rows.length
    ? `<tr><td class="empty" colspan="8">검색 조건에 맞는 신청이 없습니다.</td></tr>`
    : rows.slice((rosterPage - 1) * PAGE, rosterPage * PAGE).map(e => e.id === editingId ? `<tr class="editing">
        <td class="num">${e.no}</td>
        <td class="num date">${fmtDate(e.at)}</td>
        <td class="num">${maskPhone(e.phone)}</td>
        <td><select class="ed-sel" id="ed-os" aria-label="변경할 플랫폼">${['Android', 'iOS'].map(o => `<option value="${o}"${o === e.os ? ' selected' : ''}>${o}</option>`).join('')}</select></td>
        <td><div class="ed-cell">
          <select class="ed-sel" id="ed-srv" aria-label="변경할 서버">${SERVERS.map(s => `<option value="${esc(s.id)}"${s.id === e.server ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
          <select class="ed-sel" id="ed-ch" aria-label="변경할 채널"></select>
        </div></td>
        <td class="${e.mkt ? 'yes' : ''}">${e.mkt ? '동의' : '미동의'}</td>
        <td class="num">${e.coupon}</td>
        <td><div class="row-acts"><button type="button" class="ed-save">저장</button><button type="button" class="ed-cancel">취소</button></div></td>
      </tr>` : `<tr>
        <td class="num">${e.no}</td>
        <td class="num date">${fmtDate(e.at)}</td>
        <td class="num">${maskPhone(e.phone)}</td>
        <td>${e.os}</td>
        <td>${esc(srvName(e.server))} · ${e.ch}채널${e.updatedAt ? '<span class="chg">변경됨</span>' : ''}</td>
        <td class="${e.mkt ? 'yes' : ''}">${e.mkt ? '동의' : '미동의'}</td>
        <td class="num">${e.coupon}</td>
        <td><div class="row-acts"><button type="button" class="row-edit" data-id="${e.id}" aria-label="${e.no}번 신청 서버·채널·플랫폼 변경">변경</button><button type="button" class="row-del" data-id="${e.id}" aria-label="${e.no}번 신청 삭제">삭제</button></div></td>
      </tr>`).join('');

  if (editingId && $('ed-ch')) fillEdCh(($('ed-srv') as HTMLSelectElement).value);
  const labels = Array.from(document.querySelectorAll('#roster thead th')).map(th => th.textContent?.trim() || '');
  rosterBody.querySelectorAll('tr').forEach(tr => Array.from(tr.children).forEach((td, i) => { (td as HTMLElement).dataset.label = labels[i] || ''; }));

  const rosterClear = $('roster-clear') as HTMLButtonElement | null;
  const rosterCsv = $('roster-csv') as HTMLButtonElement | null;
  if (rosterClear) rosterClear.disabled = !entries.length;
  if (rosterCsv) rosterCsv.disabled = !entries.length;

  renderPager('roster-pager', rows.length, rosterPage, '건');
  const storageWarn = $('storage-warn');
  if (storageWarn) storageWarn.hidden = true;
  renderStats();
}

function renderStats() {
  const kpis = $('kpis');
  if (!kpis) return;
  const n = entries.length;
  const cnt = (f: (e: ApplicantEntry) => boolean) => entries.filter(f).length;
  const and = cnt(e => e.os === 'Android'), ios = cnt(e => e.os === 'iOS'), mkt = cnt(e => e.mkt);
  kpis.innerHTML = `
    <div class="kpi"><span>누적 참여자</span><b>${fmt(total)}</b><small>Firestore 실시간 동기화</small></div>
    <div class="kpi"><span>Android / iOS</span><b>${and} / ${ios}</b><small>전체 실시간 신청 기준</small></div>
    <div class="kpi"><span>마케팅 수신 동의</span><b>${n ? Math.round(mkt / n * 100) : 0}%</b><small>${mkt}건 / ${n}건</small></div>`;
  if (!capEdit) renderChTable();
}

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const mineOf = (sid: string, no: number) => entries.filter(e => e.server === sid && e.ch === no).length;
const countOf = (s: ServerItem, i: number) => (s.base[i] || 0) + mineOf(s.id, i + 1);

function renderChTable() {
  const chHead = $('ch-head');
  const chBody = $('ch-body');
  if (!chHead || !chBody) return;
  const list = capEdit ? draft : SERVERS;
  const maxCh = Math.max(...list.map(s => s.base.length), 1);
  const cols = Array.from({ length: maxCh }, (_, i) => i);
  chHead.innerHTML = `<tr><th>서버</th>${cols.map(i => `<th>${i + 1}채널</th>`).join('')}<th>합계</th></tr>`;
  const chPages = Math.max(1, Math.ceil(list.length / PAGE));
  chPage = Math.min(Math.max(1, chPage), chPages);
  const chStart = (chPage - 1) * PAGE;

  chBody.innerHTML = list.slice(chStart, chStart + PAGE).map((s, k) => {
    const si = chStart + k;
    const counts = s.base.map((_, i) => countOf(s, i));
    const cells = cols.map(i => {
      if (i >= s.base.length) return '<td class="cap-of">—</td>';
      const v = counts[i], cap = s.cap[i], mine = mineOf(s.id, i + 1);
      if (capEdit) {
        const isNewCh = s.orig != null && i >= s.orig;
        return `<td><div class="cap-cell"><input type="number" class="cap-in" id="cap-${si}-${i + 1}" data-s="${si}" data-i="${i}" min="${Math.max(1, v)}" max="99999" step="1" value="${esc(cap)}" aria-label="${esc(s.name)} ${i + 1}채널 정원"><small>${isNewCh ? '<span class="chg" style="margin:0">새 채널</span>' : `현재 ${fmt(v)}명`}</small></div></td>`;
      }
      const full = v >= cap;
      return `<td class="num ${full ? 'cell-full' : ''}">${full ? '마감 · ' : ''}${fmt(v)}<span class="cap-of"> / ${fmt(cap)}</span>${mine ? ` <span class="mine">+${mine}</span>` : ''}</td>`;
    }).join('');
    const capSum = sum(s.cap.map(c => Number(c) || 0));
    const nameCell = capEdit
      ? `<div class="cap-cell"><span>${esc(s.name)}${s.isNew ? '<span class="chg">새 서버</span>' : ''}</span><button type="button" class="add-ch" data-s="${si}"${s.base.length >= MAX_CH ? ' disabled' : ''} aria-label="${esc(s.name)}에 채널 추가">+ 채널</button></div>`
      : esc(s.name);
    return `<tr><td>${nameCell}</td>${cells}<td class="num">${fmt(sum(counts))}<span class="cap-of"> / ${fmt(capSum)}</span></td></tr>`;
  }).join('');

  renderPager('ch-pager', list.length, chPage, '개 서버');
  if ($('cap-bar')) $('cap-bar').hidden = !capEdit;
  if ($('srv-add')) $('srv-add').hidden = !capEdit;
  if ($('cap-edit')) $('cap-edit').hidden = capEdit;
  const chNote = $('ch-note');
  if (chNote) {
    chNote.textContent = capEdit
      ? `채널마다 정원을 입력하고, "+ 채널"이나 서버 추가로 구성을 늘릴 수 있습니다. 서버마다 채널은 ${MAX_CH}개, 서버는 ${MAX_SRV}개까지 둘 수 있습니다. 정원은 현재 인원보다 적게 정할 수 없습니다. 저장해야 Firestore에 반영됩니다.`
      : '채널별 인원 / 정원입니다. 노란 숫자는 Firestore에 등록된 실시간 사전예약 건수입니다.';
  }
}

$('cap-edit')?.addEventListener('click', () => {
  draft = SERVERS.map(s => ({ id: s.id, name: s.name, desc: s.desc, tag: [...s.tag] as [string, string], base: [...s.base], cap: [...s.cap], ch: [...s.base], orig: s.base.length, isNew: false }));
  capEdit = true;
  $('cap-err').hidden = true;
  $('na-err').hidden = true;
  renderChTable();
  (document.querySelector('.cap-in') as HTMLInputElement)?.focus();
});

$('ch-body')?.addEventListener('input', ev => {
  const inp = (ev.target as HTMLElement)?.closest('.cap-in') as HTMLInputElement | null;
  if (!inp) return;
  const si = Number(inp.dataset.s);
  const di = Number(inp.dataset.i);
  if (draft[si] && draft[si].cap) draft[si].cap[di] = Number(inp.value);
});

$('ch-body')?.addEventListener('click', ev => {
  const b = (ev.target as HTMLElement)?.closest('.add-ch') as HTMLElement | null;
  if (!b) return;
  const si = Number(b.dataset.s), d = draft[si];
  if (d.base.length >= MAX_CH) return;
  d.base.push(0);
  d.cap.push(DEFAULT_CAP);
  renderChTable();
  ($(`cap-${si}-${d.base.length}`) as HTMLInputElement)?.focus();
});

$('cap-cancel')?.addEventListener('click', () => {
  capEdit = false;
  draft = [];
  $('cap-err').hidden = true;
  renderChTable();
});

$('cap-reset')?.addEventListener('click', () => {
  draft.forEach(d => d.cap = d.cap.map(() => DEFAULT_CAP));
  renderChTable();
});

$('srv-add')?.addEventListener('submit', ev => {
  ev.preventDefault();
  const name = (($('na-name') as HTMLInputElement)?.value || '').trim();
  const desc = (($('na-desc') as HTMLInputElement)?.value || '').trim();
  const chRaw = (($('na-ch') as HTMLInputElement)?.value || '').trim();
  const capRaw = (($('na-cap') as HTMLInputElement)?.value || '').trim();
  let msg = '';
  if (draft.length >= MAX_SRV) msg = `서버는 ${MAX_SRV}개까지 만들 수 있습니다.`;
  else if (!name) msg = '서버 이름을 입력해 주세요.';
  else if (draft.some(d => d.name === name)) msg = `"${name}" 서버가 이미 있습니다. 다른 이름을 입력해 주세요.`;
  else if (!/^\d+$/.test(chRaw) || +chRaw < 1 || +chRaw > MAX_CH) msg = `채널 수는 1~${MAX_CH} 사이로 입력해 주세요.`;
  else if (!/^\d+$/.test(capRaw) || +capRaw < 1 || +capRaw > 99999) msg = '채널 정원은 1~99,999 사이로 입력해 주세요.';
  const naErr = $('na-err');
  if (naErr) {
    naErr.textContent = msg;
    naErr.hidden = !msg;
  }
  if (msg) return;
  const tag = ($('na-tag') as HTMLSelectElement)?.value || 'new';
  draft.push({
    id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    name,
    desc,
    tag: [tag, TAGS[tag] || tag],
    base: Array(+chRaw).fill(0),
    cap: Array(+chRaw).fill(+capRaw),
    ch: Array(+chRaw).fill(0),
    orig: 0,
    isNew: true
  });
  ($('srv-add') as HTMLFormElement)?.reset();
  chPage = Math.ceil(draft.length / PAGE);
  renderChTable();
  showToast(`${name} 서버를 추가했습니다. 저장해야 반영됩니다`);
});

// Save Server Configuration -> Firestore
$('cap-save')?.addEventListener('click', async () => {
  const errs: string[] = [];
  const bad: [number, number][] = [];
  document.querySelectorAll<HTMLInputElement>('.cap-in').forEach(inp => inp.setAttribute('aria-invalid', 'false'));
  draft.forEach((d, si) => d.cap.forEach((raw, i) => {
    const t = String(raw).trim(), n = Number(t), v = countOf(d, i);
    let msg = '';
    if (!/^\d+$/.test(t)) msg = '숫자만 입력해 주세요';
    else if (n < 1 || n > 99999) msg = '1~99,999 사이로 입력해 주세요';
    else if (n < v) msg = `현재 인원 ${fmt(v)}명보다 적게 정할 수 없습니다`;
    if (msg) {
      errs.push(`${d.name} ${i + 1}채널: ${msg}`);
      bad.push([si, i]);
    }
  }));

  if (errs.length) {
    chPage = Math.floor(bad[0][0] / PAGE) + 1;
    renderChTable();
    bad.forEach(([si, i]) => $(`cap-${si}-${i + 1}`)?.setAttribute('aria-invalid', 'true'));
    const capErr = $('cap-err');
    if (capErr) {
      capErr.textContent = errs.join(' · ');
      capErr.hidden = false;
    }
    return;
  }

  const newSrv = draft.filter(d => d.isNew).length;
  const newCh = sum(draft.filter(d => !d.isNew).map(d => d.base.length - (d.orig || 0)));
  const capChanged = sum(draft.filter(d => !d.isNew).map(d => {
    const old = SERVERS.find(s => s.id === d.id);
    return old ? d.cap.slice(0, d.orig).filter((c, i) => Number(c) !== old.cap[i]).length : 0;
  }));

  SERVERS.splice(0, SERVERS.length, ...draft.map(d => ({
    id: d.id,
    name: d.name,
    desc: d.desc,
    tag: d.tag,
    base: [...d.base],
    cap: d.cap.map(Number),
    ch: [...d.base]
  })));

  try {
    // Write configuration to Firestore
    await setDoc(doc(db, 'config', 'servers'), {
      servers: JSON.stringify(SERVERS.map(({ id, name, desc, tag, base, cap }) => ({ id, name, desc, tag, base, cap }))),
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    console.warn('Config save warning:', err);
  }

  capEdit = false;
  draft = [];
  $('cap-err').hidden = true;
  renderServers();
  renderSrvFilter();
  refreshAll();
  const parts = [newSrv && `서버 ${newSrv}개 추가`, newCh && `채널 ${newCh}개 추가`, capChanged && `정원 ${capChanged}곳 변경`].filter(Boolean);
  showToast(parts.length ? `저장했습니다: ${parts.join(', ')}` : '바뀐 내용이 없습니다');
});

// Pagers
function renderPager(id: string, count: number, page: number, unit: string) {
  const container = $(id);
  if (!container) return;
  const pages = Math.max(1, Math.ceil(count / PAGE));
  const from = count ? (page - 1) * PAGE + 1 : 0, to = Math.min(count, page * PAGE);
  const nums: (number | string)[] = [];
  for (let n = 1; n <= pages; n++) {
    if (pages <= 7 || n === 1 || n === pages || Math.abs(n - page) <= 1) nums.push(n);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  container.innerHTML = `<span class="pg-info">${fmt(count)}${unit} 중 ${fmt(from)}–${fmt(to)}</span>
    <div class="pg-btns">
      <button type="button" data-page="${page - 1}"${page <= 1 ? ' disabled' : ''} aria-label="이전 페이지">‹</button>
      ${nums.map(n => n === '…' ? '<span class="pg-gap">…</span>' : `<button type="button" data-page="${n}"${n === page ? ' aria-current="page"' : ''} aria-label="${n}페이지">${n}</button>`).join('')}
      <button type="button" data-page="${page + 1}"${page >= pages ? ' disabled' : ''} aria-label="다음 페이지">›</button>
    </div>
    <div class="pg-jump">
      <input type="number" class="pg-in" id="${id}-in" min="1" max="${pages}" step="1" value="${page}" aria-label="이동할 페이지 번호">
      <span>/ ${pages}</span>
      <button type="button" class="pg-go">이동</button>
    </div>`;
}

const PAGERS: Record<string, (n: number) => void> = {
  'ch-pager': n => { chPage = n; renderChTable(); },
  'roster-pager': n => { rosterPage = n; renderRoster(); }
};

Object.entries(PAGERS).forEach(([id, go]) => {
  const box = $(id);
  if (!box) return;
  const jump = () => {
    const inp = $(`${id}-in`) as HTMLInputElement;
    if (!inp) return;
    const max = Number(inp.max), raw = inp.value.trim(), n = Number(raw);
    if (!/^\d+$/.test(raw) || n < 1 || n > max) {
      showToast(`1~${max} 사이의 페이지 번호를 입력해 주세요`);
      inp.focus();
      inp.select();
      return;
    }
    go(n);
    ($(`${id}-in`) as HTMLInputElement)?.focus();
  };
  box.addEventListener('click', ev => {
    const b = (ev.target as HTMLElement)?.closest('button[data-page]') as HTMLButtonElement | null;
    if (b && !b.disabled) {
      go(Number(b.dataset.page));
      (box.querySelector('[aria-current=page]') as HTMLElement)?.focus();
    } else if ((ev.target as HTMLElement)?.closest('.pg-go')) {
      jump();
    }
  });
  box.addEventListener('keydown', ev => {
    if (ev.key === 'Enter' && (ev.target as HTMLElement)?.classList.contains('pg-in')) {
      ev.preventDefault();
      jump();
    }
  });
});

// CSV Export
const csvCell = (v: unknown) => {
  let t = v == null ? '' : String(v);
  if (/^[=+\-@]/.test(t)) t = "'" + t;
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};
const stamp = () => {
  const d = new Date(), p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

async function downloadCsv(name: string, rows: (string | number)[][]) {
  const blob = new Blob(['\uFEFF' + rows.map(r => r.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const done = () => showToast(`${name} 파일을 저장했습니다 (${fmt(rows.length - 1)}줄)`);

  if ('showSaveFilePicker' in window && typeof (window as any).showSaveFilePicker === 'function') {
    try {
      const handle = await (window as any).showSaveFilePicker({ suggestedName: name, types: [{ description: 'CSV 파일', accept: { 'text/csv': ['.csv'] } }] });
      const w = await handle.createWritable();
      await w.write(blob);
      await w.close();
      return done();
    } catch (e: any) {
      if (e && e.name === 'AbortError') return;
    }
  }

  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  done();
}

$('ch-csv')?.addEventListener('click', () => {
  const rows: (string | number)[][] = [['서버', '상태', '설명', '채널', '인원', '정원', '남은 자리', '마감 여부', '실시간 등록']];
  SERVERS.forEach(s => s.ch.forEach((v, i) => rows.push([s.name, s.tag[1], s.desc, `${i + 1}채널`, v, s.cap[i], Math.max(0, s.cap[i] - v), v >= s.cap[i] ? '마감' : '모집 중', mineOf(s.id, i + 1)])));
  downloadCsv(`등불항로_서버채널현황_${stamp()}.csv`, rows);
});

$('roster-csv')?.addEventListener('click', () => {
  if (!entries.length) return;
  const rows: (string | number)[][] = [['No.', '신청 일시', '휴대폰 번호', '플랫폼', '서버', '채널', '마케팅 수신', '쿠폰 번호', '최종 변경 일시']];
  entries.forEach((e, i) => rows.push([i + 1, fmtDate(e.at), maskPhone(e.phone), e.os, srvName(e.server), `${e.ch}채널`, e.mkt ? '동의' : '미동의', e.coupon, e.updatedAt ? fmtDate(e.updatedAt) : '']));
  downloadCsv(`등불항로_신청자명단_${stamp()}.csv`, rows);
});

// Edit & Delete Applicants in Firestore
function fillEdCh(sid: string) {
  const e = entries.find(x => x.id === editingId);
  const s = SERVERS.find(x => x.id === sid);
  const sel = $('ed-ch') as HTMLSelectElement | null;
  if (!e || !s || !sel) return;
  sel.innerHTML = s.ch.map((v, i) => {
    const no = i + 1, cur = e.server === sid && e.ch === no, full = !cur && v >= s.cap[i];
    return `<option value="${no}"${full ? ' disabled' : ''}${cur ? ' selected' : ''}>${no}채널 ${cur ? '(현재)' : full ? '(마감)' : `(${fmt(v)}/${fmt(s.cap[i])})`}</option>`;
  }).join('');
  const pick = Array.from(sel.options).find(o => o.selected && !o.disabled) || Array.from(sel.options).find(o => !o.disabled);
  if (pick) pick.selected = true;
  else sel.innerHTML = '<option value="">빈 채널 없음</option>';
}

function refreshAll() {
  recount();
  renderMilestones();
  renderCh();
  update();
  renderRoster();
}

$('roster-q')?.addEventListener('input', () => { rosterPage = 1; renderRoster(); });
$('roster-srv')?.addEventListener('change', () => { rosterPage = 1; renderRoster(); });

$('roster-body')?.addEventListener('click', async ev => {
  const target = ev.target as HTMLElement;
  const del = target.closest('.row-del') as HTMLElement | null;
  const edit = target.closest('.row-edit') as HTMLElement | null;

  if (del) {
    const docId = del.dataset.id;
    if (!docId) return;
    try {
      // Real-time deletion in Firestore
      await deleteDoc(doc(db, 'registrations', docId));
      if (editingId === docId) editingId = null;
      showToast('신청 1건을 삭제했습니다');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `registrations/${docId}`);
    }
  } else if (edit) {
    editingId = edit.dataset.id || null;
    renderRoster();
    ($('ed-srv') as HTMLSelectElement)?.focus();
  } else if (target.closest('.ed-cancel')) {
    editingId = null;
    renderRoster();
  } else if (target.closest('.ed-save')) {
    const e = entries.find(x => x.id === editingId);
    if (!e) return;
    const sid = ($('ed-srv') as HTMLSelectElement)?.value || e.server;
    const ch = Number(($('ed-ch') as HTMLSelectElement)?.value || e.ch);
    const os = (($('ed-os') as HTMLSelectElement)?.value || e.os) as 'Android' | 'iOS';
    const s = SERVERS.find(x => x.id === sid);
    if (!s) return;

    const moved = sid !== e.server || ch !== e.ch;
    const osChanged = os !== e.os;
    if (!moved && !osChanged) {
      editingId = null;
      renderRoster();
      showToast('바뀐 내용이 없습니다');
      return;
    }
    if (moved) {
      if (!ch) { showToast('이 서버에는 옮길 수 있는 채널이 없습니다'); return; }
      if (s.ch[ch - 1] >= s.cap[ch - 1]) {
        showToast('방금 마감된 채널입니다. 다른 채널을 선택해 주세요');
        fillEdCh(sid);
        return;
      }
    }

    try {
      const nowIso = new Date().toISOString();
      await updateDoc(doc(db, 'registrations', e.id), {
        server: sid,
        ch,
        os,
        updatedAt: nowIso
      });
      editingId = null;
      showToast(moved && osChanged ? `${s.name} 서버 ${ch}채널, ${os}로 변경했습니다`
        : moved ? `${s.name} 서버 ${ch}채널로 변경했습니다` : `플랫폼을 ${os}로 변경했습니다`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `registrations/${e.id}`);
    }
  }
});

$('roster-body')?.addEventListener('change', ev => {
  if ((ev.target as HTMLElement)?.id === 'ed-srv') fillEdCh(((ev.target as HTMLSelectElement).value));
});

// Clear all applicants in Firestore
$('roster-clear')?.addEventListener('click', () => {
  const confirmMsg = $('roster-confirm-msg');
  if (confirmMsg) confirmMsg.textContent = `저장된 신청 ${fmt(entries.length)}건을 모두 삭제할까요? 되돌릴 수 없습니다.`;
  $('roster-confirm').hidden = false;
  $('roster-confirm-no')?.focus();
});

$('roster-confirm-no')?.addEventListener('click', () => {
  $('roster-confirm').hidden = true;
});

$('roster-confirm-yes')?.addEventListener('click', async () => {
  try {
    const batch = writeBatch(db);
    entries.forEach(e => {
      batch.delete(doc(db, 'registrations', e.id));
    });
    await batch.commit();
    $('roster-confirm').hidden = true;
    showToast('명단을 모두 삭제했습니다');
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, 'registrations');
  }
});

let toastTimeout: ReturnType<typeof setTimeout> | undefined;
function showToast(msg: string) {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => t.hidden = true, 2200);
}

// Lanterns floating background canvas
const cv = $('sky') as HTMLCanvasElement;
const ctx = cv?.getContext('2d');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let W = 0, H = 0, L: { x: number; y: number; r: number; v: number; p: number }[] = [];

function sizeCanvas() {
  if (!cv || !ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  W = cv.clientWidth;
  H = cv.clientHeight;
  cv.width = W * dpr;
  cv.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  L = Array.from({ length: Math.round(W / 40) }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    r: 1 + Math.random() * 2.5,
    v: 0.1 + Math.random() * 0.35,
    p: Math.random() * 6.28
  }));
}

function drawCanvas(t: number) {
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  for (const l of L) {
    const a = 0.35 + 0.35 * Math.sin(t / 900 + l.p);
    const g = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r * 8);
    g.addColorStop(0, `rgba(242,184,75,${a})`);
    g.addColorStop(1, 'rgba(242,184,75,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(l.x, l.y, l.r * 8, 0, 6.28);
    ctx.fill();
    if (!reduce) {
      l.y -= l.v;
      l.x += Math.sin(t / 2000 + l.p) * 0.15;
      if (l.y < -20) {
        l.y = H + 20;
        l.x = Math.random() * W;
      }
    }
  }
  if (!reduce) requestAnimationFrame(drawCanvas);
}

if (cv) {
  sizeCanvas();
  window.addEventListener('resize', () => { sizeCanvas(); if (reduce) drawCanvas(0); });
  reduce ? drawCanvas(0) : requestAnimationFrame(drawCanvas);
}

// Authentication handling
function isAuthed() {
  if (auth.currentUser) return true;
  try {
    return sessionStorage.getItem(AUTH_KEY) === ADMIN_HASH;
  } catch (e) {
    return memAuth;
  }
}

function setAuthed(on: boolean) {
  memAuth = on;
  try {
    if (on) sessionStorage.setItem(AUTH_KEY, ADMIN_HASH);
    else sessionStorage.removeItem(AUTH_KEY);
  } catch (e) {}
}

async function sha256(t: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const loginErr = (msg: string) => {
  const errEl = $('login-err');
  if (errEl) {
    errEl.textContent = msg;
    errEl.hidden = !msg;
  }
};

function lockTick() {
  const left = Math.ceil((lockUntil - Date.now()) / 1000);
  const loginBtn = $('login-btn') as HTMLButtonElement | null;
  if (left > 0) {
    if (loginBtn) loginBtn.disabled = true;
    loginErr(`로그인을 ${MAX_TRY}번 실패했습니다. ${left}초 뒤에 다시 시도해 주세요.`);
    lockTimer = setTimeout(lockTick, 1000);
  } else {
    if (loginBtn) loginBtn.disabled = false;
    fails = 0;
    loginErr('');
  }
}

try { lockUntil = Number(sessionStorage.getItem(AUTH_KEY + '-lock')) || 0; } catch (e) {}
if (Date.now() < lockUntil) lockTick();

$('pw-toggle')?.addEventListener('click', () => {
  const pwIn = $('admin-pw') as HTMLInputElement | null;
  const pwToggle = $('pw-toggle');
  if (!pwIn || !pwToggle) return;
  const show = pwIn.type === 'password';
  pwIn.type = show ? 'text' : 'password';
  pwToggle.textContent = show ? '숨기기' : '보기';
  pwToggle.setAttribute('aria-pressed', String(show));
});

['admin-id', 'admin-pw'].forEach(id => $(id)?.addEventListener('input', () => {
  $(id)?.removeAttribute('aria-invalid');
  if (Date.now() >= lockUntil) loginErr('');
}));

// Google Sign-in for Organizer
$('google-login-btn')?.addEventListener('click', async () => {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
    showToast('Google 관리자 계정으로 로그인했습니다');
  } catch (err: any) {
    console.error('Google Sign in error:', err);
    loginErr('Google 로그인 중 오류가 발생했습니다: ' + (err.message || ''));
  }
});

// Auth State Changed
onAuthStateChanged(auth, (user: User | null) => {
  const logoutBtn = $('logout');
  if (user) {
    setAuthed(true);
    loginErr('');
    if (logoutBtn) {
      logoutBtn.textContent = '로그아웃';
      logoutBtn.title = `${user.email || '관리자'} (로그아웃)`;
    }
    route();
    renderRoster();
  } else {
    if (logoutBtn) {
      logoutBtn.textContent = '로그아웃';
    }
  }
});

// Password Login
$('login-form')?.addEventListener('submit', async ev => {
  ev.preventDefault();
  if (Date.now() < lockUntil) return;
  const id = (($('admin-id') as HTMLInputElement)?.value || '').trim();
  const pw = ($('admin-pw') as HTMLInputElement)?.value || '';
  if (!id || !pw) {
    loginErr(!id ? '아이디를 입력해 주세요.' : '비밀번호를 입력해 주세요.');
    const targetId = !id ? 'admin-id' : 'admin-pw';
    $(targetId)?.setAttribute('aria-invalid', 'true');
    $(targetId)?.focus();
    return;
  }
  if (!window.crypto?.subtle) {
    loginErr('이 브라우저에서는 로그인을 확인할 수 없습니다.');
    return;
  }
  const loginBtn = $('login-btn') as HTMLButtonElement | null;
  if (loginBtn) loginBtn.disabled = true;
  const ok = (await sha256(`lantern-admin|${id}:${pw}`)) === ADMIN_HASH;
  if (loginBtn) loginBtn.disabled = false;
  if (ok) {
    fails = 0;
    setAuthed(true);
    ($('login-form') as HTMLFormElement)?.reset();
    loginErr('');
    if (window.location.pathname !== '/admin') {
      history.pushState(null, '', '/admin');
    }
    route();
    renderRoster();
    showToast('관리자로 로그인했습니다');
    return;
  }
  fails += 1;
  const adminPw = $('admin-pw') as HTMLInputElement | null;
  if (adminPw) {
    adminPw.value = '';
    adminPw.setAttribute('aria-invalid', 'true');
    adminPw.focus();
  }
  if (fails >= MAX_TRY) {
    lockUntil = Date.now() + LOCK_SEC * 1000;
    try { sessionStorage.setItem(AUTH_KEY + '-lock', String(lockUntil)); } catch (e) {}
    lockTick();
  } else {
    loginErr(`아이디 또는 비밀번호가 맞지 않습니다. (${fails}/${MAX_TRY})`);
  }
});

$('logout')?.addEventListener('click', async () => {
  await signOut(auth);
  setAuthed(false);
  editingId = null;
  capEdit = false;
  draft = [];
  renderRoster();
  renderChTable();
  route();
  showToast('로그아웃했습니다');
});

// Routing
function route() {
  const path = window.location.pathname;
  const hash = window.location.hash;
  const admin = path === '/admin' || path.startsWith('/admin') || hash === '#admin';
  const authed = isAuthed();
  if ($('view-home')) $('view-home').hidden = admin;
  if ($('view-admin')) $('view-admin').hidden = !(admin && authed);
  if ($('view-login')) $('view-login').hidden = !(admin && !authed);
  if ($('logout')) $('logout').hidden = !authed;
  if (admin && !authed) {
    setTimeout(() => $('admin-id')?.focus(), 0);
  }
  if ($('sticky')) $('sticky').hidden = admin;
  document.querySelectorAll<HTMLAnchorElement>('.tabs a').forEach(a => {
    if ((a.dataset.view === 'admin') === admin) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = admin ? (authed ? '등불항로 관리자' : '등불항로 관리자 로그인') : '등불항로 사전예약';
  if (!admin && !W) {
    sizeCanvas();
    if (reduce) drawCanvas(0);
  }
  const target = !admin && hash && hash !== '#home' && hash !== '#admin' ? document.querySelector(hash) : null;
  if (target) target.scrollIntoView();
  else window.scrollTo(0, 0);
}

document.addEventListener('click', (ev) => {
  const a = (ev.target as HTMLElement)?.closest('a') as HTMLAnchorElement | null;
  if (!a) return;
  const href = a.getAttribute('href');
  if (href === '/admin' || href === '#admin') {
    ev.preventDefault();
    if (window.location.pathname !== '/admin') {
      history.pushState(null, '', '/admin');
    }
    route();
  } else if (href === '/' || href === '#home') {
    ev.preventDefault();
    if (window.location.pathname !== '/') {
      history.pushState(null, '', '/');
    }
    route();
  }
});

window.addEventListener('popstate', route);
window.addEventListener('hashchange', route);
route();
