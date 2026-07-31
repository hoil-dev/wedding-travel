'use strict';

// ===== 비밀번호 잠금 =====
// 비밀번호 변경하려면: node -e "console.log(require('crypto').createHash('sha256').update('새비밀번호').digest('hex'))"
const PW_HASH = 'a445b92ef7ba817efc27de361e28375a841dca08f5858e10838c52683b23ed9d'; // 기본: 0803
const PW_KEY  = 'honeymoon-auth';

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function checkPassword() {
  const input = document.getElementById('lock-input');
  const error = document.getElementById('lock-error');
  const hash  = await sha256(input.value.trim());

  if (hash === PW_HASH) {
    localStorage.setItem(PW_KEY, hash);
    document.getElementById('lock-screen').classList.add('hidden');
    input.value = '';
    error.textContent = '';
  } else {
    error.textContent = '비밀번호가 틀렸어요 🔒';
    input.value = '';
    input.focus();
  }
}

function initAuth() {
  const saved = localStorage.getItem(PW_KEY);
  if (saved === PW_HASH) {
    document.getElementById('lock-screen').classList.add('hidden');
  } else {
    // 앱 콘텐츠는 인증 전 숨김
    document.getElementById('lock-screen').classList.remove('hidden');
    setTimeout(() => document.getElementById('lock-input').focus(), 300);
  }
}

// ===== Navigation =====
function navigate(page, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));

  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');
  if (el) el.classList.add('active');
}

// Hash-based routing on load
function handleHash() {
  const hash = (location.hash || '#home').replace('#', '');
  const tabEl = document.querySelector(`.tab-item[href="#${hash}"]`);
  navigate(hash, tabEl);
}

window.addEventListener('hashchange', handleHash);
window.addEventListener('DOMContentLoaded', () => {
  initAuth();
  handleHash();
  initCountdown();
  initChecklist();
});

// ===== Countdown =====
function initCountdown() {
  function update() {
    const departure = new Date('2026-08-03T00:00:00+09:00');
    const now = new Date();
    const diff = departure - now;

    const numEl = document.getElementById('countdown-num');
    const unitEl = document.getElementById('countdown-unit');
    if (!numEl) return;

    if (diff <= 0) {
      numEl.textContent = '✈️';
      unitEl.textContent = '여행 중!';
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      numEl.textContent = days;
      unitEl.textContent = '일 남았어요 💕';
    } else {
      numEl.textContent = `${hours}:${String(mins).padStart(2, '0')}`;
      unitEl.textContent = '오늘 출발! 🎉';
    }
  }

  update();
  setInterval(update, 60000);
}

// ===== Checklist =====
const STORAGE_KEY = 'honeymoon-checklist';

// Section ID → checkbox ID ranges
const SECTIONS = {
  pre:  { ids: [...range(1, 9),  ...range(57, 59)], countEl: 'count-pre'  },
  pack: { ids: [...range(10, 20), ...range(34, 52)], countEl: 'count-pack' },
  sg:   { ids: range(21, 25), countEl: 'count-sg'   },
  mv:   { ids: range(26, 33), countEl: 'count-mv'   },
};

function range(a, b) {
  const arr = [];
  for (let i = a; i <= b; i++) arr.push('c' + i);
  return arr;
}

function initChecklist() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');

  // Restore saved state
  Object.keys(saved).forEach(id => {
    const cb = document.getElementById(id);
    if (cb && saved[id]) {
      cb.checked = true;
      cb.closest('.check-item').classList.add('done');
    }
  });

  updateProgress();
}

// 체크박스 자체 클릭: stopPropagation으로 부모 div onclick 차단, 이 함수만 실행
function handleCbClick(cb) {
  const itemEl = cb.closest('.check-item');
  itemEl.classList.toggle('done', cb.checked);
  saveCheck(cb.id, cb.checked);
  updateProgress();
}

// 텍스트/여백 클릭: 수동 토글
function toggleCheck(itemEl, e) {
  const cb = itemEl.querySelector('input[type="checkbox"]');
  if (!cb) return;
  cb.checked = !cb.checked;
  itemEl.classList.toggle('done', cb.checked);
  saveCheck(cb.id, cb.checked);
  updateProgress();
}

function saveCheck(id, checked) {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  saved[id] = checked;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

function updateProgress() {
  let total = 0;
  let done = 0;

  Object.entries(SECTIONS).forEach(([sectionKey, section]) => {
    let sTotal = 0, sDone = 0;
    section.ids.forEach(id => {
      const cb = document.getElementById(id);
      if (cb) {
        sTotal++;
        total++;
        if (cb.checked) { sDone++; done++; }
      }
    });
    const countEl = document.getElementById(section.countEl);
    if (countEl) countEl.textContent = `${sDone}/${sTotal}`;
  });

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const bar = document.getElementById('progress-bar');
  const text = document.getElementById('progress-text');
  if (bar) bar.style.width = pct + '%';
  if (text) text.textContent = `${done} / ${total}`;
}

function toggleSection(headerEl) {
  headerEl.classList.toggle('collapsed');
}

// ===== Copy =====
function copyText(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('복사됨!'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('복사됨!');
  }
}

// ===== Toast =====
let toastTimer;
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// ===== Service Worker =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

// ===== DOCS (IndexedDB) =====
const DOC_DB = 'honeymoon-docs';
const DOC_STORE = 'docs';

const DOC_SLOTS = [
  {
    group: '✈️ 항공',
    items: [
      { id: 'flight-out',   icon: '✈️', label: '출국 항공 바우처',   sub: 'SQ607 · SQ432 · 예약번호 DOETZ6' },
      { id: 'flight-ret',   icon: '✈️', label: '귀국 항공 바우처',   sub: 'SQ437 · SQ600 · 예약번호 FI8DCN' },
      { id: 'eticket',      icon: '🎫', label: '전자항공권 (E-ticket)', sub: '와이페이모어 DV158P' },
    ],
  },
  {
    group: '🏨 숙소',
    items: [
      { id: 'mbs-confirm',  icon: '🏨', label: 'MBS 예약확인서',      sub: '확인코드 7518850 · 8/3 체크인' },
      { id: 'pullman',      icon: '🏨', label: '풀만 예약확인서',     sub: 'Agoda 1740188163 · 8/4 체크인' },
      { id: 'maldives-v',   icon: '🏝️', label: '몰디브 여행 바우처',  sub: '예약번호 590424891' },
    ],
  },
  {
    group: '📋 입국 서류',
    items: [
      { id: 'imuga-qr',     icon: '📋', label: 'IMUGA QR코드',       sub: '몰디브 입국신고서 · 8/1부터 발급' },
      { id: 'insurance',    icon: '🛡️', label: '여행자 보험 증서',    sub: '' },
    ],
  },
  {
    group: '🛂 여권',
    items: [
      { id: 'passport-h',   icon: '🛂', label: '여권 사진 (신랑)',    sub: 'LEE HOIL' },
      { id: 'passport-s',   icon: '🛂', label: '여권 사진 (신부)',    sub: 'WON SOYEON' },
    ],
  },
  {
    group: '기타',
    items: [
      { id: 'extra1',       icon: '📄', label: '기타 서류 1',         sub: '' },
      { id: 'extra2',       icon: '📄', label: '기타 서류 2',         sub: '' },
    ],
  },
  {
    group: '💡 여행 팁 (tripin.ko)',
    items: [
      { id: 'tip-001', icon: '📋', label: '준비물 체크리스트',     sub: '필수준비물 · 의류 · 전자제품 · 화장품' },
      { id: 'tip-002', icon: '🎒', label: '가방에 넣을 준비물',    sub: '기내 챙길 것 · 기내 필수 소지품' },
      { id: 'tip-003', icon: '🧳', label: '캐리어에 넣을 준비물', sub: '필수용품 · 유용한 물건' },
      { id: 'tip-004', icon: '🌏', label: '나라별 준비물 꿀팁',   sub: '동남아시아 · 유럽 · 일본 · 북미' },
      { id: 'tip-005', icon: '💡', label: '여행 짐 쌀때 꿀팁',    sub: '부피 줄이기 · 소분 · 포장 팁' },
      { id: 'tip-006', icon: '✈️', label: '장거리 비행 꿀팁',    sub: '수면 · 건조함 · 좌석 선택' },
    ],
  },
];

let docDB = null;
let viewerCurrentId = null;
let viewerPdfUrl = null;

function openDocDB() {
  return new Promise((resolve, reject) => {
    if (docDB) return resolve(docDB);
    const req = indexedDB.open(DOC_DB, 1);
    req.onupgradeneeded = e => e.target.result.createObjectStore(DOC_STORE, { keyPath: 'id' });
    req.onsuccess = e => { docDB = e.target.result; resolve(docDB); };
    req.onerror = () => reject(req.error);
  });
}

async function saveDocData(id, dataUrl, type, name, v = 1) {
  const db = await openDocDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOC_STORE, 'readwrite');
    tx.objectStore(DOC_STORE).put({ id, dataUrl, type, name, v, savedAt: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function getDocData(id) {
  const db = await openDocDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOC_STORE, 'readonly');
    const req = tx.objectStore(DOC_STORE).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function deleteDocData(id) {
  const db = await openDocDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOC_STORE, 'readwrite');
    tx.objectStore(DOC_STORE).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function initDocs() {
  if (_docsInitRunning) return;
  _docsInitRunning = true;
  const grid = document.getElementById('doc-grid');
  if (!grid) { _docsInitRunning = false; return; }
  grid.innerHTML = '';

  for (const group of DOC_SLOTS) {
    const groupEl = document.createElement('div');
    groupEl.className = 'doc-group';
    groupEl.innerHTML = `<div class="doc-group-title">${group.group}</div>`;

    for (const slot of group.items) {
      const slotEl = await renderSlot(slot);
      groupEl.appendChild(slotEl);
    }
    grid.appendChild(groupEl);
  }
  _docsInitRunning = false;
}

async function renderSlot(slot) {
  const wrap = document.createElement('div');
  wrap.className = 'doc-slot';
  wrap.id = 'slot-' + slot.id;

  const doc = await getDocData(slot.id).catch(() => null);

  if (doc) {
    const type = doc.type || '';
    const isPdf = type === 'application/pdf';
    const isHtml = type.includes('html');
    const thumbHtml = isPdf
      ? `<div class="doc-thumb-pdf">📄</div>`
      : isHtml
      ? `<div class="doc-thumb-pdf" style="background:#EFF6FF;border-color:#BFDBFE;font-size:1.4rem">🌐</div>`
      : `<img class="doc-thumb" src="${doc.dataUrl}" alt="">`;

    const date = new Date(doc.savedAt);
    const dateStr = `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2,'0')} 저장`;

    wrap.innerHTML = `
      <div class="doc-slot-filled" onclick="openViewer('${slot.id}', '${slot.label}')">
        ${thumbHtml}
        <div class="doc-slot-meta">
          <div class="doc-slot-filled-label">${slot.label}</div>
          <div class="doc-slot-saved">✓ ${dateStr}</div>
        </div>
        <div class="doc-slot-actions" onclick="event.stopPropagation()">
          <button class="doc-action-btn" onclick="triggerUpload('${slot.id}')">교체</button>
          <button class="doc-action-btn danger" onclick="confirmDelete('${slot.id}')">삭제</button>
        </div>
      </div>
      <input type="file" class="doc-file-input" id="fi-${slot.id}" accept="image/*,application/pdf,text/html,.html,.htm" onchange="handleFileSelect('${slot.id}', this)">
    `;
  } else {
    wrap.innerHTML = `
      <div class="doc-slot-empty" onclick="triggerUpload('${slot.id}')">
        <div class="doc-slot-icon">${slot.icon}</div>
        <div class="doc-slot-info">
          <div class="doc-slot-label">${slot.label}</div>
          ${slot.sub ? `<div class="doc-slot-sub">${slot.sub}</div>` : ''}
        </div>
        <button class="doc-upload-btn" onclick="event.stopPropagation(); triggerUpload('${slot.id}')">+</button>
      </div>
      <input type="file" class="doc-file-input" id="fi-${slot.id}" accept="image/*,application/pdf,text/html,.html,.htm" onchange="handleFileSelect('${slot.id}', this)">
    `;
  }
  return wrap;
}

function triggerUpload(id) {
  const input = document.getElementById('fi-' + id);
  if (input) input.click();
}

function handleFileSelect(id, input) {
  const file = input.files[0];
  if (!file) return;

  showToast('저장 중...');
  const reader = new FileReader();
  reader.onload = async e => {
    await saveDocData(id, e.target.result, file.type, file.name);
    // Re-render the slot
    const allSlots = DOC_SLOTS.flatMap(g => g.items);
    const slot = allSlots.find(s => s.id === id);
    if (slot) {
      const oldEl = document.getElementById('slot-' + id);
      if (oldEl) {
        const newEl = await renderSlot(slot);
        oldEl.replaceWith(newEl);
      }
    }
    showToast('저장됨! ✓');
    input.value = '';
  };
  reader.readAsDataURL(file);
}

// dataUrl → 원본 바이트 배열
function dataUrlToBytes(dataUrl) {
  const b64    = dataUrl.split(',')[1];
  const binary = atob(b64);
  const bytes  = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// dataUrl → Blob → ObjectURL
// HTML은 charset 지정 없이 Blob 생성 → 브라우저가 <meta charset> 읽어서 자동 처리
function dataUrlToObjectUrl(dataUrl, mimeType) {
  const bytes = dataUrlToBytes(dataUrl);
  const blob  = new Blob([bytes], { type: mimeType });
  return URL.createObjectURL(blob);
}

let _viewerBlobUrl = null;

async function openViewer(id, label) {
  const doc = await getDocData(id);
  if (!doc) return;

  // 이전 blob URL 해제
  if (_viewerBlobUrl) { URL.revokeObjectURL(_viewerBlobUrl); _viewerBlobUrl = null; }

  viewerCurrentId = id;
  const viewer      = document.getElementById('doc-viewer');
  const titleEl     = document.getElementById('viewer-title');
  const imgEl       = document.getElementById('viewer-img');
  const frameEl     = document.getElementById('viewer-frame');
  const openBtn     = document.getElementById('viewer-open-btn');

  titleEl.textContent = label;
  imgEl.style.display   = 'none';
  frameEl.style.display = 'none';
  frameEl.src           = 'about:blank';
  openBtn.style.display = 'none';

  const type = doc.type || '';

  if (type === 'application/pdf') {
    // data URL → Blob → Object URL → iframe (직접 data URL은 iOS에서 미지원)
    _viewerBlobUrl = dataUrlToObjectUrl(doc.dataUrl, 'application/pdf');
    frameEl.style.display = 'block';
    frameEl.src = _viewerBlobUrl;
    openBtn.style.display = 'inline-block'; // 새 탭에서도 열 수 있게
  } else if (type === 'text/html' || type.includes('html')) {
    // charset 없이 Blob 생성 → 브라우저가 HTML 내 <meta charset> 직접 읽음
    // (UTF-8, EUC-KR 모두 올바르게 렌더링)
    _viewerBlobUrl = dataUrlToObjectUrl(doc.dataUrl, 'text/html');
    frameEl.style.display = 'block';
    frameEl.src = _viewerBlobUrl;
    openBtn.style.display = 'inline-block';
  } else {
    imgEl.style.display = 'block';
    imgEl.src = doc.dataUrl;
  }

  viewer.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function openInNewTab() {
  if (_viewerBlobUrl) {
    window.open(_viewerBlobUrl, '_blank');
  }
}

function closeViewer() {
  const frameEl = document.getElementById('viewer-frame');
  frameEl.src    = 'about:blank';
  frameEl.srcdoc = '';
  if (_viewerBlobUrl) { URL.revokeObjectURL(_viewerBlobUrl); _viewerBlobUrl = null; }
  document.getElementById('doc-viewer').classList.remove('open');
  document.body.style.overflow = '';
  viewerCurrentId = null;
}

async function deleteCurrentDoc() {
  if (!viewerCurrentId) return;
  if (!confirm('이 서류를 삭제할까요?')) return;
  await deleteDocData(viewerCurrentId);
  const allSlots = DOC_SLOTS.flatMap(g => g.items);
  const slot = allSlots.find(s => s.id === viewerCurrentId);
  if (slot) {
    const oldEl = document.getElementById('slot-' + viewerCurrentId);
    if (oldEl) {
      const newEl = await renderSlot(slot);
      oldEl.replaceWith(newEl);
    }
  }
  closeViewer();
  showToast('삭제됨');
}

async function confirmDelete(id) {
  if (!confirm('이 서류를 삭제할까요?')) return;
  await deleteDocData(id);
  const allSlots = DOC_SLOTS.flatMap(g => g.items);
  const slot = allSlots.find(s => s.id === id);
  if (slot) {
    const oldEl = document.getElementById('slot-' + id);
    if (oldEl) {
      const newEl = await renderSlot(slot);
      oldEl.replaceWith(newEl);
    }
  }
  showToast('삭제됨');
}

// ===== 바우처 자동 사전 로드 =====
// version 올리면 해당 id 강제 재로드
const PRELOAD_DOCS = [
  { id: 'mbs-confirm',  src: 'docs/mbs-confirm.png',      type: 'image/png', v: 1 },
  { id: 'pullman',      src: 'docs/pullman-confirm.png',   type: 'image/png', v: 1 },
  { id: 'flight-out',   src: 'docs/flight-out.png',        type: 'image/png', v: 1 },
  { id: 'flight-ret',   src: 'docs/flight-ret.png',        type: 'image/png', v: 2 },
  { id: 'maldives-v',   src: 'docs/maldives-v.png',        type: 'image/png', v: 1 },
  { id: 'tip-001', src: 'docs/tips/tip-001.jpg', type: 'image/jpeg', v: 1 },
  { id: 'tip-002', src: 'docs/tips/tip-002.jpg', type: 'image/jpeg', v: 1 },
  { id: 'tip-003', src: 'docs/tips/tip-003.jpg', type: 'image/jpeg', v: 1 },
  { id: 'tip-004', src: 'docs/tips/tip-004.jpg', type: 'image/jpeg', v: 1 },
  { id: 'tip-005', src: 'docs/tips/tip-005.jpg', type: 'image/jpeg', v: 1 },
  { id: 'tip-006', src: 'docs/tips/tip-006.jpg', type: 'image/jpeg', v: 1 },
];

async function preloadVouchers() {
  for (const item of PRELOAD_DOCS) {
    const existing = await getDocData(item.id).catch(() => null);
    if (existing && (existing.v || 1) >= item.v) continue; // 같은 버전이면 스킵
    try {
      const res = await fetch(item.src);
      if (!res.ok) continue;
      const blob = await res.blob();
      const dataUrl = await new Promise(r => {
        const fr = new FileReader();
        fr.onload = () => r(fr.result);
        fr.readAsDataURL(blob);
      });
      await saveDocData(item.id, dataUrl, item.type, item.src.split('/').pop(), item.v);
    } catch { /* 오프라인이면 스킵 */ }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  openDocDB().then(preloadVouchers);
});

// 서류함 탭 진입 시 초기화
const _origNavigate = navigate;
let _docsInitRunning = false;
window.navigate = function(page, el) {
  _origNavigate(page, el);
  if (page === 'docs' && !_docsInitRunning) initDocs();
};
