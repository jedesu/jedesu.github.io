// ---------------------------------------------------------------------------
// Julianne's site.
//
// The top half is plain readable text. The bottom half is a stack of cork
// boards you flip between with the arrows — projects, trips, currently, and one
// visitors can pin to.
//
// Everything on a board is an "item": a polaroid or a sticky note. Julianne's
// items are declared in BOARDS below. Visitors can drag anything and add to the
// guestbook board; what they add lives in their own browser until a Firebase
// project is filled into firebase-config.js.
// ---------------------------------------------------------------------------

const board = document.getElementById('board');
const STORE_KEY = 'je_board_v2';
const MAX_PHOTOS = 18; // localStorage fills up fast once photos are base64
const DESIGN_WIDTH = 850; // items are drawn for this width, then scaled to the real board

// Under this width the cork is too small to arrange anything on, so items just
// stack down it and there's nothing to drag.
const narrow = window.matchMedia('(max-width: 860px)');
const isStacked = () => narrow.matches;

// ---- the links that stay in the readable half -----------------------------
const LINKS = [
  {
    label: 'linkedin',
    desc: '@julianneedes',
    url: 'https://www.linkedin.com/in/julianneedes/',
    tooltip: 'best way to reach me',
  },
  {
    label: 'resume',
    desc: 'view pdf',
    url: 'assets/julianne-edes-resume.pdf',
  },
];

// ---- the boards ------------------------------------------------------------
//
// To pin a photo, drop the file in assets/ and add an item like this:
//
//   { kind: 'polaroid', src: 'assets/trips/tokyo.jpg', caption: 'tokyo, march',
//     x: 20, y: 30, rot: -3, tape: true }
//
// x and y are percentages of the board measured from its top-left corner, rot
// is the tilt in degrees, and tape: true swaps the pushpin for a strip of tape.
const BOARDS = [
  {
    id: 'projects',
    name: '// projects',
    note: "things i'm building",
    items: [
      {
        id: 'p-adhd',
        kind: 'sticky',
        text: 'an adhd productivity app',
        color: '#bfdbfe',
        x: 8,
        y: 14,
        rot: -3,
        pin: '#2f6fb0',
      },
      {
        id: 'p-site',
        kind: 'sticky',
        text: 'this website',
        color: '#bbf7d0',
        x: 38,
        y: 40,
        rot: 2.5,
        pin: '#5f7f3f',
      },
      {
        id: 'p-ai',
        kind: 'sticky',
        text: 'an AI support platform',
        sig: 'previously',
        color: '#fed7aa',
        x: 68,
        y: 12,
        rot: -1.5,
        pin: '#d2601a',
      },
    ],
  },
  {
    id: 'trips',
    name: '// trips',
    note: "places i've been and places i'm going",
    items: [
      {
        id: 't-japan',
        kind: 'sticky',
        text: 'japan',
        sig: 'next one',
        color: '#fbcfe8',
        x: 14,
        y: 26,
        rot: -2,
        pin: '#b03a3a',
      },
    ],
  },
  {
    id: 'currently',
    name: '// currently',
    note: "what i'm in the middle of",
    items: [
      {
        id: 'c-reading',
        kind: 'sticky',
        text: 'the haunting of hill house',
        sig: 'reading',
        color: '#fde68a',
        x: 11,
        y: 18,
        rot: -2.5,
        pin: '#8c6f3f',
      },
      {
        id: 'c-watching',
        kind: 'sticky',
        text: 'severance',
        sig: 'watching',
        color: '#bfdbfe',
        x: 48,
        y: 32,
        rot: 3,
        pin: '#2f6fb0',
      },
    ],
  },
  {
    id: 'guestbook',
    name: '// the guestbook',
    note: 'pin a note or a photo — this one is yours',
    open: true, // the only board that takes what visitors add
    empty: 'nothing pinned yet —\nbe the first',
    items: [],
  },
];

const NOTE_COLORS = ['#fde68a', '#fbcfe8', '#bfdbfe', '#bbf7d0', '#fed7aa'];

// ---- the readable half -----------------------------------------------------
(function renderLinks() {
  const list = document.getElementById('links');
  LINKS.forEach((link) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    if (link.tooltip) btn.title = link.tooltip;

    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '→';

    const label = document.createElement('span');
    label.textContent = link.label;

    const desc = document.createElement('span');
    desc.className = 'desc';
    desc.textContent = link.desc;

    btn.append(arrow, label, desc);
    btn.addEventListener('click', () => window.open(link.url, '_blank', 'noopener'));
    li.appendChild(btn);
    list.appendChild(li);
  });
})();

// ---- saved state -----------------------------------------------------------
// Two things persist: where a visitor dragged each item, and whatever they
// pinned to the guestbook themselves.
function loadStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return {
      positions: parsed.positions || {},
      guests: Array.isArray(parsed.guests) ? parsed.guests : [],
      top: parsed.top || 10,
    };
  } catch (e) {
    return { positions: {}, guests: [], top: 10 };
  }
}

const store = loadStore();

function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
    return true;
  } catch (e) {
    return false; // quota — almost always a photo that pushed it over
  }
}

// ---- sizing ----------------------------------------------------------------
// Items are sized in pixels but positioned in percentages, so they have to
// scale with the board or they'd swallow it whole on a small screen.
function fit() {
  const w = board.clientWidth;
  if (!w) return;
  const scale = isStacked() ? Math.min(1, w / 300) : w / DESIGN_WIDTH;
  document.documentElement.style.setProperty('--scale', scale.toFixed(4));
}

// ---- building items --------------------------------------------------------
const items = new Map(); // id -> { data, el }, only for the board on screen
let zoomedId = null;

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function buildPolaroid(data) {
  const node = el('div', 'polaroid');
  const shot = el('div', 'polaroid-shot');

  if (data.src) {
    const img = el('img');
    img.src = data.src;
    img.alt = data.caption || 'a pinned photo';
    img.draggable = false;
    shot.appendChild(img);
    if (data.fresh) shot.classList.add('developing');
  }

  node.appendChild(shot);
  node.appendChild(el('p', 'polaroid-caption', data.caption || ''));
  return node;
}

function buildSticky(data) {
  const node = el('div', 'sticky');
  node.style.setProperty('--note', data.color || NOTE_COLORS[0]);
  node.appendChild(el('span', '', data.text || ''));
  if (data.sig) node.appendChild(el('span', 'sticky-sig', data.sig));
  return node;
}

function render(data) {
  const wrap = el('div', 'item');
  wrap.dataset.id = data.id;
  wrap.style.setProperty('--rot', (data.rot || 0) + 'deg');
  wrap.tabIndex = 0;
  wrap.setAttribute('role', 'button');

  // a visitor may have dragged this somewhere last time they were here
  const saved = store.positions[data.id];
  const x = saved ? saved.x : data.x;
  const y = saved ? saved.y : data.y;
  const z = saved && saved.z ? saved.z : 10;

  wrap.style.left = x + '%';
  wrap.style.top = y + '%';
  wrap.style.zIndex = z;

  const live = Object.assign({}, data, { x: x, y: y, z: z });

  wrap.appendChild(data.kind === 'polaroid' ? buildPolaroid(data) : buildSticky(data));

  const fastener = el('div', data.tape ? 'tape' : 'pin');
  if (!data.tape) fastener.style.setProperty('--pin', data.pin || '#d2601a');
  wrap.appendChild(fastener);

  if (data.fresh) {
    wrap.classList.add('landing');
    wrap.addEventListener('animationend', () => wrap.classList.remove('landing'), { once: true });
  }

  board.appendChild(wrap);
  items.set(data.id, { data: live, el: wrap });
  attach(wrap, live);
  return wrap;
}

// ---- flipping between boards ----------------------------------------------
const boardName = document.getElementById('board-name');
const boardNote = document.getElementById('board-note');
const boardEmpty = document.getElementById('board-empty');
const boardDots = document.getElementById('board-dots');
const toolbar = document.getElementById('toolbar');
let current = 0;

function currentBoard() {
  return BOARDS[current];
}

function itemsFor(b) {
  // the guestbook also carries whatever this visitor pinned
  return b.open ? b.items.concat(store.guests) : b.items;
}

function paint() {
  const b = currentBoard();

  items.forEach((entry) => entry.el.remove());
  items.clear();

  boardName.textContent = b.name;
  boardNote.textContent = b.note;
  toolbar.hidden = !b.open;

  const list = itemsFor(b);
  list.forEach((data) => render(Object.assign({}, data, { fresh: false })));

  boardEmpty.textContent = b.empty || 'nothing here yet';
  boardEmpty.hidden = list.length > 0;

  Array.prototype.forEach.call(boardDots.children, (dot, i) => {
    dot.setAttribute('aria-selected', i === current ? 'true' : 'false');
    dot.tabIndex = i === current ? 0 : -1;
  });
}

function go(index, direction) {
  const next = (index + BOARDS.length) % BOARDS.length;
  if (next === current) return;
  if (zoomedId) zoomOut();

  const out = direction < 0 ? 'slide-out-right' : 'slide-out-left';
  const back = direction < 0 ? 'slide-in-left' : 'slide-in-right';

  board.classList.add(out);
  setTimeout(() => {
    current = next;
    paint();
    board.classList.remove(out);
    board.classList.add(back);
    setTimeout(() => board.classList.remove(back), 260);
  }, 170);
}

BOARDS.forEach((b, i) => {
  const dot = el('button', 'board-dot');
  dot.type = 'button';
  dot.setAttribute('role', 'tab');
  dot.setAttribute('aria-label', b.name.replace('// ', ''));
  dot.addEventListener('click', () => go(i, i > current ? 1 : -1));
  boardDots.appendChild(dot);
});

document.getElementById('board-prev').addEventListener('click', () => go(current - 1, -1));
document.getElementById('board-next').addEventListener('click', () => go(current + 1, 1));

window.addEventListener('keydown', (e) => {
  if (zoomedId || !document.getElementById('compose-layer').hidden) return;
  if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (e.key === 'ArrowLeft') go(current - 1, -1);
  if (e.key === 'ArrowRight') go(current + 1, 1);
});

// ---- dragging --------------------------------------------------------------
function bringToFront(live, node) {
  store.top = (store.top || 10) + 1;
  live.z = store.top;
  node.style.zIndex = live.z;
}

function attach(node, live) {
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;
  let pointerId = null;
  let moved = false;

  node.addEventListener('pointerdown', (e) => {
    // while something is zoomed, only that item still answers
    if (zoomedId && zoomedId !== live.id) return;
    if (e.button && e.button !== 0) return;
    pointerId = e.pointerId;
    // capture can refuse a pointer that's already gone; the drag still works
    try {
      node.setPointerCapture(pointerId);
    } catch (err) {}
    startX = e.clientX;
    startY = e.clientY;
    originX = live.x;
    originY = live.y;
    moved = false;
    if (!zoomedId) {
      bringToFront(live, node);
      node.classList.add('dragging');
    }
  });

  node.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    // stacked items aren't positioned, and a zoomed one shouldn't slide about
    if (isStacked() || zoomedId) return;
    const rect = board.getBoundingClientRect();
    if (Math.abs(e.clientX - startX) > 4 || Math.abs(e.clientY - startY) > 4) moved = true;
    if (!moved) return;

    // how much of the item we let hang over the edge of the cork
    const w = (node.offsetWidth / rect.width) * 100;
    const h = (node.offsetHeight / rect.height) * 100;
    const nx = originX + ((e.clientX - startX) / rect.width) * 100;
    const ny = originY + ((e.clientY - startY) / rect.height) * 100;

    live.x = Math.max(-w * 0.2, Math.min(100 - w * 0.8, nx));
    live.y = Math.max(-h * 0.15, Math.min(100 - h * 0.85, ny));
    node.style.left = live.x + '%';
    node.style.top = live.y + '%';
  });

  function release(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    node.classList.remove('dragging');

    if (moved) {
      store.positions[live.id] = { x: live.x, y: live.y, z: live.z };
      save();
    } else if (zoomedId === live.id) {
      zoomOut();
    } else {
      zoomIn(live.id);
    }
  }

  node.addEventListener('pointerup', release);
  node.addEventListener('pointercancel', release);

  node.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (zoomedId === live.id) zoomOut();
      else zoomIn(live.id);
    }
  });
}

// ---- zooming ---------------------------------------------------------------
const backdrop = document.getElementById('zoom-backdrop');
const closeBtn = document.getElementById('zoom-close');

function zoomIn(id) {
  const entry = items.get(id);
  if (!entry || zoomedId) return;

  const node = entry.el;
  const rect = node.getBoundingClientRect();
  const margin = 0.86;
  const scale = Math.min(
    (window.innerWidth * margin) / rect.width,
    (window.innerHeight * margin) / rect.height,
    3.4
  );
  const dx = window.innerWidth / 2 - (rect.left + rect.width / 2);
  const dy = window.innerHeight / 2 - (rect.top + rect.height / 2);

  zoomedId = id;
  node.classList.remove('returning');
  node.classList.add('zoomed');
  node.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(' + scale + ') rotate(0deg)';

  backdrop.hidden = false;
  closeBtn.hidden = false;
  requestAnimationFrame(() => {
    backdrop.classList.add('on');
    closeBtn.classList.add('on');
  });
}

function zoomOut() {
  if (!zoomedId) return;
  const entry = items.get(zoomedId);
  zoomedId = null;
  if (entry) {
    const node = entry.el;
    node.classList.remove('zoomed');
    node.classList.add('returning');
    node.style.transform = '';
    setTimeout(() => node.classList.remove('returning'), 460);
  }

  backdrop.classList.remove('on');
  closeBtn.classList.remove('on');
  setTimeout(() => {
    if (zoomedId) return;
    backdrop.hidden = true;
    closeBtn.hidden = true;
  }, 320);
}

backdrop.addEventListener('click', zoomOut);
closeBtn.addEventListener('click', zoomOut);
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') zoomOut();
});

// ---- finding somewhere to put a new item -----------------------------------
function overlapArea(a, b) {
  const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return ox > 0 && oy > 0 ? ox * oy : 0;
}

function findSpot(w, h) {
  const rect = board.getBoundingClientRect();
  const boxes = [];
  items.forEach((entry) => {
    boxes.push({
      x: entry.data.x,
      y: entry.data.y,
      w: (entry.el.offsetWidth / rect.width) * 100,
      h: (entry.el.offsetHeight / rect.height) * 100,
    });
  });

  let best = null;
  let bestScore = Infinity;

  // try a bunch of spots, keep whichever covers the least of what's already up
  for (let i = 0; i < 90; i++) {
    const spot = {
      x: 2 + Math.random() * Math.max(1, 96 - w),
      y: 3 + Math.random() * Math.max(1, 92 - h),
      w: w,
      h: h,
    };
    let score = 0;
    for (let k = 0; k < boxes.length; k++) score += overlapArea(spot, boxes[k]);
    if (score === 0) return spot;
    if (score < bestScore) {
      bestScore = score;
      best = spot;
    }
  }
  return best;
}

function dropOldestPhoto() {
  const oldest = store.guests.findIndex((g) => g.kind === 'polaroid');
  if (oldest < 0) return false;
  const dead = store.guests.splice(oldest, 1)[0];
  const entry = items.get(dead.id);
  if (entry) {
    entry.el.remove();
    items.delete(dead.id);
  }
  delete store.positions[dead.id];
  return true;
}

function addGuestItem(data) {
  // the guestbook is the only board that takes these
  const guestbook = BOARDS.findIndex((b) => b.open);
  if (current !== guestbook) {
    go(guestbook, guestbook > current ? 1 : -1);
    setTimeout(() => addGuestItem(data), 460);
    return;
  }

  // render it first so we can measure the real thing, then place it
  const node = render(Object.assign({}, data, { x: 50, y: 50, fresh: true }));
  const rect = board.getBoundingClientRect();
  const live = items.get(data.id).data;
  const spot = findSpot(
    (node.offsetWidth / rect.width) * 100,
    (node.offsetHeight / rect.height) * 100
  );

  live.x = spot.x;
  live.y = spot.y;
  node.style.left = spot.x + '%';
  node.style.top = spot.y + '%';
  bringToFront(live, node);
  boardEmpty.hidden = true;

  store.guests.push(Object.assign({}, data, { x: spot.x, y: spot.y }));
  store.positions[data.id] = { x: spot.x, y: spot.y, z: live.z };

  // over quota: shed the oldest photo and try once more
  if (!save() && dropOldestPhoto()) save();
}

function newId() {
  return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ---- the note composer -----------------------------------------------------
const composeLayer = document.getElementById('compose-layer');
const composeText = document.getElementById('compose-text');
const composeLeft = document.getElementById('compose-left');
const composePin = document.getElementById('compose-pin');
const swatches = document.getElementById('swatches');
let noteColor = NOTE_COLORS[0];

NOTE_COLORS.forEach((color) => {
  const b = el('button', 'swatch');
  b.type = 'button';
  b.style.background = color;
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-label', 'note colour ' + color);
  b.setAttribute('aria-checked', color === noteColor ? 'true' : 'false');
  b.addEventListener('click', () => {
    noteColor = color;
    composeText.style.setProperty('--note-preview', color);
    Array.prototype.forEach.call(swatches.children, (s) =>
      s.setAttribute('aria-checked', s === b ? 'true' : 'false')
    );
  });
  swatches.appendChild(b);
});

function closeCompose() {
  composeLayer.hidden = true;
}

composeText.addEventListener('input', () => {
  composeLeft.textContent = 180 - composeText.value.length;
  composePin.disabled = composeText.value.trim().length === 0;
});

composePin.addEventListener('click', () => {
  const text = composeText.value.trim();
  if (!text) return;
  closeCompose();
  addGuestItem({
    id: newId(),
    kind: 'sticky',
    text: text,
    color: noteColor,
    rot: (Math.random() - 0.5) * 9,
    pin: '#b03a3a',
  });
});

document.getElementById('compose-cancel').addEventListener('click', closeCompose);
composeLayer.addEventListener('click', (e) => {
  if (e.target === composeLayer) closeCompose();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !composeLayer.hidden) closeCompose();
});

document.getElementById('add-note').addEventListener('click', () => {
  composeText.value = '';
  composeLeft.textContent = '180';
  composePin.disabled = true;
  composeLayer.hidden = false;
  composeText.focus();
});

// ---- photos ----------------------------------------------------------------
const fileInput = document.getElementById('file-input');
document.getElementById('add-photo').addEventListener('click', () => fileInput.click());

// Shrink before storing: a phone photo is several MB, and localStorage gives
// us about 5MB total for everything on the board.
function downscale(file, max) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const ratio = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files && fileInput.files[0];
  fileInput.value = '';
  if (!file || file.type.indexOf('image/') !== 0) return;

  const photos = store.guests.filter((g) => g.kind === 'polaroid').length;
  if (photos >= MAX_PHOTOS) dropOldestPhoto();

  let src;
  try {
    src = await downscale(file, 760);
  } catch (e) {
    return;
  }

  addGuestItem({
    id: newId(),
    kind: 'polaroid',
    src: src,
    caption: (file.name || '').replace(/\.[^.]+$/, '').slice(0, 28),
    rot: (Math.random() - 0.5) * 10,
    tape: Math.random() < 0.45,
    pin: '#2f6fb0',
  });
});

// ---- go --------------------------------------------------------------------
fit();
window.addEventListener('resize', fit);
if (narrow.addEventListener) narrow.addEventListener('change', fit);
paint();
