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
  initChecklistV2();
  updateGhStatusText();
  // 설정된 경우 백그라운드 동기화
  openDocDB().then(() => {
    preloadVouchers();
    syncFromGitHub(false);
  });
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
  let total = 0, done = 0;
  const d = getClData();

  Object.entries(SECTIONS).forEach(([sk, section]) => {
    let sT = 0, sD = 0;
    section.ids.forEach(id => {
      if (d.deleted.includes(id)) return;
      const cb = document.getElementById(id);
      if (cb) { sT++; total++; if (cb.checked) { sD++; done++; } }
    });
    // 해당 섹션에 추가된 커스텀 항목
    (d.extra[sk] || []).forEach(i => { sT++; total++; if (i.done) { sD++; done++; } });
    const el = document.getElementById(section.countEl);
    if (el) el.textContent = `${sD}/${sT}`;
  });

  // 커스텀 카테고리
  (d.cats || []).forEach(cat => {
    (cat.items || []).forEach(i => { total++; if (i.done) done++; });
  });

  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const bar = document.getElementById('progress-bar');
  const txt = document.getElementById('progress-text');
  if (bar) bar.style.width = pct + '%';
  if (txt) txt.textContent = `${done} / ${total}`;
}

function toggleSection(headerEl) {
  headerEl.classList.toggle('collapsed');
}

// ===== 커스텀 체크리스트 V2 =====
const CL_KEY = 'honeymoon-cl-v2';
// { deleted:[], extra:{pre:[],pack:[],sg:[],mv:[]}, cats:[{id,name,icon,items:[]}] }

function getClData() {
  try {
    const d = JSON.parse(localStorage.getItem(CL_KEY));
    return d || { deleted: [], extra: {}, cats: [] };
  } catch { return { deleted: [], extra: {}, cats: [] }; }
}
function saveClData(d) { localStorage.setItem(CL_KEY, JSON.stringify(d)); }

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// --- 스와이프 삭제 ---
let _swiped = null;

function applySwipe(itemEl, onDelete) {
  const wrap = document.createElement('div');
  wrap.className = 'swipe-wrap';
  itemEl.parentNode.insertBefore(wrap, itemEl);
  wrap.appendChild(itemEl);

  const btn = document.createElement('button');
  btn.className = 'swipe-del-btn';
  btn.textContent = '삭제';
  btn.onclick = e => { e.stopPropagation(); onDelete(); };
  wrap.appendChild(btn);

  let sx, sy, moved;

  const reset = () => {
    itemEl.style.transition = 'transform 0.22s ease';
    itemEl.style.transform = '';
    wrap.classList.remove('open');
    if (_swiped === itemEl) _swiped = null;
  };

  const closeOthers = () => {
    if (_swiped && _swiped !== itemEl) {
      _swiped.style.transition = 'transform 0.22s ease';
      _swiped.style.transform = '';
      _swiped.closest('.swipe-wrap')?.classList.remove('open');
      _swiped = null;
    }
  };

  // 오른쪽 스와이프 → 체크 토글
  const doCheck = () => {
    // 커스텀 항목은 _toggle 콜백 사용
    if (itemEl._toggle) {
      itemEl._toggle();
    } else {
      // 하드코딩 항목: 체크박스 직접 토글
      const cb = itemEl.querySelector('input[type="checkbox"]');
      if (cb) {
        cb.checked = !cb.checked;
        handleCbClick(cb);
      }
    }
    // 체크 애니메이션: 오른쪽으로 살짝 튕김
    itemEl.style.transition = 'transform 0.12s ease';
    itemEl.style.transform = 'translateX(18px)';
    setTimeout(() => {
      itemEl.style.transition = 'transform 0.18s ease';
      itemEl.style.transform = '';
    }, 130);
  };

  itemEl.addEventListener('touchstart', e => {
    sx = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    moved = false;
    itemEl.style.transition = 'none';
    closeOthers();
  }, { passive: true });

  itemEl.addEventListener('touchmove', e => {
    const dx = e.touches[0].clientX - sx;
    const dy = e.touches[0].clientY - sy;
    if (!moved && Math.abs(dy) > Math.abs(dx)) return; // 세로 스크롤
    moved = true;
    if (dx < 0) {
      // 왼쪽 스와이프 → 삭제 버튼 노출
      itemEl.style.transform = `translateX(${Math.max(dx, -72)}px)`;
    } else if (wrap.classList.contains('open')) {
      // 이미 열린 상태에서 오른쪽 → 닫기
      itemEl.style.transform = `translateX(${Math.min(0, -72 + dx)}px)`;
    }
    // 오른쪽 스와이프는 실시간 이동 안 함 (체크는 손 뗄 때)
  }, { passive: true });

  itemEl.addEventListener('touchend', e => {
    if (!moved) return;
    const dx = e.changedTouches[0].clientX - sx;
    itemEl.style.transition = 'transform 0.22s ease';

    if (dx < -40) {
      // 왼쪽 충분히 → 삭제 버튼 고정
      itemEl.style.transform = 'translateX(-72px)';
      wrap.classList.add('open');
      _swiped = itemEl;
    } else if (dx > 40 && !wrap.classList.contains('open')) {
      // 오른쪽 충분히 → 체크 토글
      itemEl.style.transform = '';
      doCheck();
    } else {
      reset();
    }
  });

  // 열린 상태에서 다른 곳 탭 → 닫기
  itemEl.addEventListener('click', e => {
    if (wrap.classList.contains('open') && e.target !== btn) {
      e.stopPropagation();
      reset();
    }
  });
}

// --- 하드코딩된 항목에 스와이프 적용 ---
function initHardcodedSwipe() {
  const d = getClData();
  document.querySelectorAll('#page-checklist .check-item').forEach(el => {
    const cb = el.querySelector('input[type="checkbox"]');
    if (!cb?.id) return;
    if (d.deleted.includes(cb.id)) { el.style.display = 'none'; return; }
    applySwipe(el, () => {
      const d2 = getClData();
      if (!d2.deleted.includes(cb.id)) d2.deleted.push(cb.id);
      saveClData(d2);
      el.closest('.swipe-wrap')?.remove();
      updateProgress();
    });
  });
}

// --- 커스텀 항목 엘리먼트 생성 ---
function makeClItemEl(item, onToggle, onDelete) {
  const div = document.createElement('div');
  div.className = 'check-item' + (item.done ? ' done' : '');

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = !!item.done;
  Object.assign(cb.style, {
    width:'20px', height:'20px', borderRadius:'6px',
    border: item.done ? '2px solid var(--teal)' : '2px solid var(--gray-200)',
    appearance:'none', WebkitAppearance:'none',
    flexShrink:'0', marginTop:'1px', cursor:'pointer',
    position:'relative', transition:'all .15s',
    background: item.done ? 'var(--teal)' : 'white',
  });

  const lbl = document.createElement('span');
  lbl.className = 'check-label';
  lbl.textContent = item.text;

  const doToggle = () => {
    const nowDone = !item.done;
    item.done = nowDone;
    div.classList.toggle('done', nowDone);
    cb.checked = nowDone;
    cb.style.background = nowDone ? 'var(--teal)' : 'white';
    cb.style.borderColor = nowDone ? 'var(--teal)' : 'var(--gray-200)';
    onToggle(nowDone);
  };

  cb.addEventListener('click', e => { e.stopPropagation(); doToggle(); });
  div.addEventListener('click', e => {
    if (!div.closest('.swipe-wrap')?.classList.contains('open')) doToggle();
  });

  div.appendChild(cb);
  div.appendChild(lbl);
  div._toggle = doToggle; // 오른쪽 스와이프 체크용
  applySwipe(div, onDelete);
  return div;
}

// --- 기존 섹션에 추가된 항목 렌더링 ---
function renderExtraItems(sectionId) {
  const body = document.querySelector(`.checklist-section[data-section="${sectionId}"] .checklist-body`);
  if (!body) return;
  body.querySelectorAll('.cl-extra-item').forEach(e => e.remove());

  const d = getClData();
  (d.extra[sectionId] || []).forEach((item, idx) => {
    const el = makeClItemEl(item,
      done => {
        const d2 = getClData();
        if (d2.extra[sectionId]?.[idx]) d2.extra[sectionId][idx].done = done;
        saveClData(d2); updateProgress();
      },
      () => {
        const d2 = getClData();
        d2.extra[sectionId]?.splice(idx, 1);
        saveClData(d2); renderExtraItems(sectionId); updateProgress();
      }
    );
    el.classList.add('cl-extra-item');
    body.appendChild(el);
  });
}

// --- 커스텀 카테고리 렌더링 ---
function renderCustomCats() {
  const container = document.getElementById('cl-custom-cats');
  if (!container) return;
  container.innerHTML = '';

  const d = getClData();
  (d.cats || []).forEach(cat => {
    const sec = document.createElement('div');
    sec.className = 'checklist-section';
    sec.innerHTML = `
      <div class="checklist-header" onclick="toggleSection(this)">
        <div class="ch-left">
          <span class="ch-icon">${cat.icon || '📝'}</span>
          <span class="ch-title">${escHtml(cat.name)}</span>
          <span class="ch-count" id="cnt-${cat.id}"></span>
        </div>
        <span class="ch-arrow">▾</span>
      </div>
      <div class="checklist-body" id="body-${cat.id}"></div>
    `;
    container.appendChild(sec);

    const body = sec.querySelector(`#body-${cat.id}`);
    (cat.items || []).forEach((item, idx) => {
      const el = makeClItemEl(item,
        done => {
          const d2 = getClData();
          const c2 = d2.cats.find(c => c.id === cat.id);
          if (c2?.items[idx]) c2.items[idx].done = done;
          saveClData(d2); updateProgress();
        },
        () => {
          const d2 = getClData();
          const c2 = d2.cats.find(c => c.id === cat.id);
          if (c2) c2.items.splice(idx, 1);
          saveClData(d2); renderCustomCats(); updateProgress();
        }
      );
      body.appendChild(el);
    });

    const doneN = (cat.items || []).filter(i => i.done).length;
    const cntEl = sec.querySelector(`#cnt-${cat.id}`);
    if (cntEl) cntEl.textContent = `${doneN}/${(cat.items||[]).length}`;
  });

  refreshCatSelect();
}

// 카테고리 셀렉트 옵션 갱신
function refreshCatSelect() {
  const sel = document.getElementById('cl-cat-select');
  if (!sel) return;
  sel.querySelectorAll('[data-custom]').forEach(o => o.remove());
  const newOpt = sel.querySelector('[value="__new__"]');
  const d = getClData();
  (d.cats || []).forEach(cat => {
    const o = document.createElement('option');
    o.value = cat.id;
    o.textContent = `${cat.icon || '📝'} ${cat.name}`;
    o.dataset.custom = '1';
    sel.insertBefore(o, newOpt);
  });
}

function handleClCatChange() {
  const sel = document.getElementById('cl-cat-select');
  const row = document.getElementById('cl-newcat-row');
  const show = sel.value === '__new__';
  row.style.display = show ? 'block' : 'none';
  if (show) document.getElementById('cl-newcat-input')?.focus();
}

function addClItem() {
  const sel   = document.getElementById('cl-cat-select');
  const txt   = document.getElementById('cl-text-input');
  const ncIn  = document.getElementById('cl-newcat-input');
  const text  = txt?.value.trim();
  if (!text) { txt?.focus(); return; }

  const d = getClData();
  let sid = sel.value;

  if (sid === '__new__') {
    const name = ncIn?.value.trim();
    if (!name) { ncIn?.focus(); return; }
    const catId = 'cat-' + Date.now();
    d.cats.push({ id: catId, name, icon: '📝', items: [] });
    sid = catId;
    if (ncIn) ncIn.value = '';
    document.getElementById('cl-newcat-row').style.display = 'none';
    sel.value = 'pre';
  }

  const item = { id: sid + '-' + Date.now(), text, done: false };

  if (['pre','pack','sg','mv'].includes(sid)) {
    if (!d.extra[sid]) d.extra[sid] = [];
    d.extra[sid].push(item);
    saveClData(d);
    renderExtraItems(sid);
  } else {
    const cat = d.cats.find(c => c.id === sid);
    if (cat) { if (!cat.items) cat.items = []; cat.items.push(item); }
    saveClData(d);
    renderCustomCats();
  }

  txt.value = '';
  updateProgress();
}

function initChecklistV2() {
  initHardcodedSwipe();
  ['pre','pack','sg','mv'].forEach(renderExtraItems);
  renderCustomCats();
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
      { id: 'imuga-qr-h',   icon: '📋', label: 'IMUGA QR (신랑)',    sub: 'LEE HOIL · 몰디브 입국신고서' },
      { id: 'imuga-qr-s',   icon: '📋', label: 'IMUGA QR (신부)',    sub: 'WON SOYEON · 몰디브 입국신고서' },
      { id: 'insurance-h',  icon: '🛡️', label: '여행자 보험 (신랑)',  sub: 'LEE HOIL' },
      { id: 'insurance-s',  icon: '🛡️', label: '여행자 보험 (신부)',  sub: 'WON SOYEON' },
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
    const tx  = db.transaction(DOC_STORE, 'readwrite');
    const req = tx.objectStore(DOC_STORE).put({ id, dataUrl, type, name, v, savedAt: Date.now() });
    req.onerror = () => reject(req.error);   // put 실패
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);     // 트랜잭션 실패
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

    // GitHub 동기화 상태 배지
    const synced = isGhSynced(slot.id);
    const ghSettings = getGhSettings();
    const syncBadge = ghSettings
      ? (synced
          ? `<span class="sync-badge ok">☁ GitHub</span>`
          : `<span class="sync-badge local">📱 로컬만</span>`)
      : '';  // GitHub 설정 없으면 배지 없음

    wrap.innerHTML = `
      <div class="doc-slot-filled" onclick="openViewer('${slot.id}', '${slot.label}')">
        ${thumbHtml}
        <div class="doc-slot-meta">
          <div class="doc-slot-filled-label">${slot.label} ${syncBadge}</div>
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

  // 파일 크기 제한 (20MB)
  const MAX_MB = 20;
  if (file.size > MAX_MB * 1024 * 1024) {
    showToast(`파일이 너무 큽니다 (최대 ${MAX_MB}MB)`);
    input.value = '';
    return;
  }

  showToast('저장 중...');

  // 저장 + 슬롯 재렌더 + GitHub 업로드
  const afterSave = async (dataUrl, type) => {
    try {
      await saveDocData(id, dataUrl, type, file.name);
    } catch (err) {
      console.error('IndexedDB 저장 실패:', err);
      showToast('저장 실패 — 저장 공간 부족일 수 있어요');
      input.value = '';
      return;
    }

    // GitHub 업로드
    if (getGhSettings()?.token) {
      showToast('GitHub에 업로드 중...');
      const ok = await ghUploadFile(id, dataUrl, type).catch(() => false);
      showToast(ok ? 'GitHub 저장됨 ✓' : '로컬 저장됨 ✓');
    } else {
      showToast('저장됨! ✓');
    }

    // 슬롯 재렌더
    const slot = DOC_SLOTS.flatMap(g => g.items).find(s => s.id === id);
    if (slot) {
      const oldEl = document.getElementById('slot-' + id);
      if (oldEl) oldEl.replaceWith(await renderSlot(slot));
    }
    input.value = '';
  };

  if (file.type.startsWith('image/') && file.size > 800 * 1024) {
    // 이미지 압축: 1920px 이하로 줄이고 JPEG 85% 품질로 저장
    const objUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      const MAX_W = 1920;
      let w = img.naturalWidth, h = img.naturalHeight;
      if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const compressed = canvas.toDataURL('image/jpeg', 0.85);
      const origMB  = (file.size / 1024 / 1024).toFixed(1);
      const compKB  = Math.round(compressed.length * 0.75 / 1024);
      console.log(`압축: ${origMB}MB → ${compKB}KB`);
      afterSave(compressed, 'image/jpeg');
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      // 압축 실패 시 원본으로 fallback
      readAndSave();
    };
    img.src = objUrl;
  } else {
    readAndSave();
  }

  function readAndSave() {
    const reader = new FileReader();
    reader.onload  = e => afterSave(e.target.result, file.type || 'application/octet-stream');
    reader.onerror = () => {
      showToast('파일을 읽을 수 없어요 — 다시 시도해주세요');
      input.value = '';
    };
    reader.readAsDataURL(file);
  }
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

// ===== GitHub 동기화 =====
const GH_KEY = 'gh-settings';

function getGhSettings() {
  try { return JSON.parse(localStorage.getItem(GH_KEY)) || null; }
  catch { return null; }
}

function updateGhStatusText() {
  const s = getGhSettings();
  const el = document.getElementById('gh-status-text');
  if (!el) return;
  if (s?.user && s?.repo && s?.token) {
    el.textContent = `✅ ${s.user}/${s.repo} 연결됨`;
  } else {
    el.textContent = '설정 후 어떤 기기에서든 파일 공유';
  }
}

function toggleGhCard() {
  const body  = document.getElementById('gh-card-body');
  const arrow = document.getElementById('gh-arrow');
  const open  = body.classList.toggle('open');
  arrow.classList.toggle('open', open);

  if (open) {
    const s = getGhSettings();
    if (s) {
      document.getElementById('gh-user').value  = s.user  || '';
      document.getElementById('gh-repo').value  = s.repo  || '';
      document.getElementById('gh-token').value = s.token || '';
    }
  }
}

function saveGhSettingsUI() {
  const user  = document.getElementById('gh-user').value.trim();
  const repo  = document.getElementById('gh-repo').value.trim();
  const token = document.getElementById('gh-token').value.trim();
  if (!user || !repo || !token) { showToast('모든 항목을 입력해주세요'); return; }
  localStorage.setItem(GH_KEY, JSON.stringify({ user, repo, token }));
  updateGhStatusText();
  // 설정 후 바로 동기화
  document.getElementById('gh-card-body').classList.remove('open');
  document.getElementById('gh-arrow').classList.remove('open');
  showToast('저장됨! 동기화 중...');
  syncFromGitHub(true);
}

// MIME → 확장자
function mimeToExt(type) {
  const map = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/heic': 'heic',
    'application/pdf': 'pdf', 'text/html': 'html',
  };
  return map[type] || type.split('/')[1] || 'bin';
}

// GitHub API: 파일 업로드 (생성/덮어쓰기)
// ===== GitHub 동기화 상태 추적 =====
const GH_SYNCED_KEY = 'gh-synced';

function getGhSynced() {
  try { return JSON.parse(localStorage.getItem(GH_SYNCED_KEY)) || {}; }
  catch { return {}; }
}
function markGhSynced(id, ok = true) {
  const s = getGhSynced();
  if (ok) s[id] = true; else delete s[id];
  localStorage.setItem(GH_SYNCED_KEY, JSON.stringify(s));
}
function isGhSynced(id) {
  // 미리 만들어둔 바우처 이미지는 항상 GitHub에 있음
  if (PRELOAD_DOCS.some(p => p.id === id)) return true;
  return !!getGhSynced()[id];
}

async function ghUploadFile(id, dataUrl, type) {
  const s = getGhSettings();
  if (!s?.token) return false;

  const ext     = mimeToExt(type);
  const path    = `uploads/${id}.${ext}`;
  const content = dataUrl.split(',')[1];
  const url     = `https://api.github.com/repos/${s.user}/${s.repo}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${s.token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };

  let sha;
  try {
    const r = await fetch(url, { headers });
    if (r.ok) sha = (await r.json()).sha;
  } catch {}

  const body = { message: `upload: ${id}`, content };
  if (sha) body.sha = sha;

  const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
  if (res.ok) markGhSynced(id, true);  // 성공 시 동기화 상태 기록
  return res.ok;
}

// GitHub에서 uploads/ 목록 가져와 로컬에 없는 파일 내려받기
async function syncFromGitHub(showFeedback = false) {
  const s = getGhSettings();
  if (!s?.user || !s?.repo) return;

  if (showFeedback) showToast('GitHub 동기화 중...');

  try {
    const headers = s.token ? { Authorization: `Bearer ${s.token}`, Accept: 'application/vnd.github+json' } : {};
    const res = await fetch(`https://api.github.com/repos/${s.user}/${s.repo}/contents/uploads`, { headers });
    if (!res.ok) {
      if (showFeedback) showToast(res.status === 404 ? '아직 업로드된 파일 없음' : '동기화 실패');
      return;
    }
    const files = await res.json();
    if (!Array.isArray(files)) return;

    let newCount = 0;
    for (const file of files) {
      const id       = file.name.replace(/\.[^.]+$/, '');
      const existing = await getDocData(id).catch(() => null);
      if (existing) continue;

      // raw URL로 직접 다운로드 (API content보다 빠름)
      const dlRes = await fetch(file.download_url);
      if (!dlRes.ok) continue;

      const blob   = await dlRes.blob();
      const dataUrl = await new Promise(r => {
        const fr = new FileReader();
        fr.onload = () => r(fr.result);
        fr.readAsDataURL(blob);
      });

      await saveDocData(id, dataUrl, blob.type, file.name);
      markGhSynced(id, true);  // GitHub에서 받은 파일 → synced
      newCount++;
    }

    if (showFeedback) showToast(newCount > 0 ? `${newCount}개 파일 동기화됨 ✓` : '이미 최신 상태');

    // docs 페이지가 열려있으면 새로고침
    if (document.getElementById('page-docs').classList.contains('active')) {
      initDocs();
    }
  } catch (e) {
    if (showFeedback) showToast('동기화 오류: 설정 확인 필요');
  }
}

// ===== 바우처 자동 사전 로드 =====
// version 올리면 해당 id 강제 재로드
const PRELOAD_DOCS = [
  { id: 'mbs-confirm',  src: 'docs/mbs-confirm.png',      type: 'image/png', v: 1 },
  { id: 'pullman',      src: 'docs/pullman-confirm.png',   type: 'image/png', v: 1 },
  { id: 'flight-out',   src: 'docs/flight-out.png',        type: 'image/png', v: 1 },
  { id: 'flight-ret',   src: 'docs/flight-ret.png',        type: 'image/png', v: 3 },
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
