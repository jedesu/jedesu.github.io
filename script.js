// ---------------------------------------------------------------------------
// Julianne's site, in two views you switch between at the top:
//
//   bulletin — a stack of cork boards you flip through with the arrows
//   classic  — the plain column: about, links, and a written guestbook
//
// Both views share one pile of visitor entries, so a note pinned to the board
// also shows up in the classic guestbook list. That pile lives in the visitor's
// own browser until a Firebase project is filled into firebase-config.js.
// ---------------------------------------------------------------------------

const board = document.getElementById('board');
const STORE_KEY = 'je_board_v2';
const VIEW_KEY = 'je_view';
const MAX_PHOTOS = 18; // localStorage fills up fast once photos are base64
const DESIGN_WIDTH = 850; // items are drawn for this width, then scaled to the real board

// Under this width the cork is too small to arrange anything on, so items just
// stack down it and there's nothing to drag.
const narrow = window.matchMedia('(max-width: 860px)');
const isStacked = () => narrow.matches;

// ---- links -----------------------------------------------------------------
// The classic view has no boards, so projects and currently come back as rows.
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
  {
    label: 'projects',
    desc: 'coming soon',
    message: 'no projects listed yet — check back soon.',
    classicOnly: true,
  },
  {
    label: 'currently',
    desc: "what i'm up to",
    toggle: 'now-panel',
    classicOnly: true,
  },
];

// ---- trips -----------------------------------------------------------------
// Each one is a landmark on the dome. `icon` is any emoji — swap it for
// whatever suits the place. Drop photos into assets/trips/ and list them here;
// tapping the landmark pins that trip's photos up beside the globe. A trip with
// no photos yet shows empty frames with its name on them.
const TRIPS = [
  // japan, the next one — four stops close enough together that the globe
  // leans in when you tap one, so they come apart
  { id: 'tokyo', icon: '🗼', place: 'tokyo', region: 'japan', when: 'the next one', lat: 35.68, lon: 139.69, upcoming: true, photos: [] },
  { id: 'kyoto', icon: '⛩️', place: 'kyoto', region: 'japan', when: 'the next one', lat: 35.01, lon: 135.77, upcoming: true, photos: [] },
  { id: 'hokkaido', icon: '❄️', place: 'hokkaido', region: 'japan', when: 'the next one', lat: 43.06, lon: 141.35, upcoming: true, photos: [] },
  { id: 'okinawa', icon: '🐠', place: 'okinawa', region: 'japan', when: 'been', lat: 26.21, lon: 127.68, photos: [] },

  { id: 'bangkok', icon: '🛕', place: 'bangkok', region: 'thailand', when: 'been', lat: 13.76, lon: 100.5, photos: [] },
  { id: 'chiangmai', icon: '🐘', place: 'chiang mai', region: 'thailand', when: 'been', lat: 18.79, lon: 98.98, photos: [] },
  { id: 'whistler', icon: '🎿', place: 'whistler', region: 'canada', when: 'been', lat: 50.12, lon: -122.95, photos: [] },
  { id: 'oahu', icon: '🌺', place: 'oahu', region: 'hawaii', when: 'been', lat: 21.31, lon: -157.86, photos: [] },
  { id: 'nyc', icon: '🗽', place: 'new york', region: 'usa', when: 'been', lat: 40.71, lon: -74.01, photos: [] },
  { id: 'santiago', icon: '🏔️', place: 'santiago', region: 'chile', when: 'been', lat: -33.45, lon: -70.67, photos: [] },

  // These three were given as whole countries, so they're labelled as such and
  // pinned at the capital. Give me the city and I'll put the pin on it.
  { id: 'korea', icon: '🏯', place: 'south korea', when: 'been', lat: 37.57, lon: 126.98, photos: [] },
  { id: 'nz', icon: '🥝', place: 'new zealand', when: 'been', lat: -41.29, lon: 174.78, photos: [] },
  { id: 'argentina', icon: '💃', place: 'argentina', when: 'been', lat: -34.6, lon: -58.38, photos: [] },
];

// "tokyo, japan" on the globe; the polaroids stay on the short name so the
// handwriting doesn't run off the frame
function tripName(trip) {
  return trip.region ? trip.place + ', ' + trip.region : trip.place;
}

let pickedTrip = 0;

// The globe sits on the left; whichever trip is picked hangs to the right of it.
function tripItems() {
  const trip = TRIPS[pickedTrip] || TRIPS[0];
  const items = [
    {
      id: 'trip-globe',
      kind: 'globe',
      fixed: true, // it's a fixture on this board, not something to drag about
      x: 3,
      y: 9,
      rot: 0,
    },
  ];

  // three small frames fit the cork beside the globe; a fourth photo wouldn't,
  // so only the first three are pinned up
  const SPOTS = [
    { x: 46, y: 4, rot: -3 },
    { x: 69, y: 4, rot: 2.5 },
    { x: 57, y: 52, rot: -1.5 },
  ];

  const shots = trip.photos.length ? trip.photos : [null, null];
  shots.slice(0, SPOTS.length).forEach((src, i) => {
    items.push({
      id: 'tp-' + trip.id + '-' + i,
      kind: 'polaroid',
      small: true,
      src: src,
      caption: src ? trip.place : trip.place + ' ?',
      empty: !src,
      x: SPOTS[i].x,
      y: SPOTS[i].y,
      rot: SPOTS[i].rot,
      tape: i % 2 === 0,
      pin: '#b03a3a',
      fresh: true,
    });
  });

  return items;
}

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
    id: 'about',
    name: '// hi',
    note: "who i am, the short version",
    items: [
      {
        id: 'a-me',
        kind: 'card',
        lead: true,
        name: "hi ! i'm julianne :)",
        role: 'product & project manager',
        lines: [
          'i turn ideas into things people actually use — features, workflows, and the small details that make a product feel good.',
          'previously: an AI support platform. offline: trips, horror movies, books.',
        ],
        links: [
          { label: 'linkedin', url: 'https://www.linkedin.com/in/julianneedes/' },
          { label: 'resume (pdf)', url: 'assets/julianne-edes-resume.pdf' },
        ],
        x: 4,
        y: 13,
        rot: -1.5,
        pin: '#d2601a',
      },
      {
        id: 'a-linkedin',
        kind: 'card',
        label: 'linkedin',
        name: '@julianneedes',
        lines: ['best way to reach me'],
        links: [
          { label: 'open linkedin', url: 'https://www.linkedin.com/in/julianneedes/' },
        ],
        x: 62,
        y: 12,
        rot: 2,
        pin: '#2f6fb0',
      },
      {
        id: 'a-resume',
        kind: 'card',
        label: 'resume',
        name: 'resume.pdf',
        lines: ['the whole history, properly formatted'],
        links: [{ label: 'open the pdf', url: 'assets/julianne-edes-resume.pdf' }],
        x: 62,
        y: 55,
        rot: -2.5,
        pin: '#b03a3a',
      },
    ],
  },
  {
    id: 'trips',
    name: '// trips',
    note: 'spin the globe, tap a place',
    dynamic: tripItems,
    items: [],
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
    note: 'pin a note or a photo — photos come out as doodles',
    open: true, // the only board that takes what visitors add
    empty: 'nothing pinned yet —\nbe the first',
    items: [],
  },
];

const NOTE_COLORS = ['#fde68a', '#fbcfe8', '#bfdbfe', '#bbf7d0', '#fed7aa'];

// ---- saved state -----------------------------------------------------------
function loadStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    return {
      positions: parsed.positions || {},
      guests: Array.isArray(parsed.guests) ? parsed.guests : [],
      stickers: Array.isArray(parsed.stickers) ? parsed.stickers : [],
      stuck: Array.isArray(parsed.stuck) ? parsed.stuck : [],
      top: parsed.top || 10,
    };
  } catch (e) {
    return { positions: {}, guests: [], stickers: [], stuck: [], top: 10 };
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

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

// ---- which view are we in --------------------------------------------------
let view = 'board';
try {
  const saved = localStorage.getItem(VIEW_KEY);
  if (saved === 'classic' || saved === 'board') view = saved;
} catch (e) {}

const viewSwitch = document.getElementById('view-switch');

function setView(next, remember) {
  view = next;
  document.body.className = 'view-' + next;

  Array.prototype.forEach.call(viewSwitch.children, (b) =>
    b.setAttribute('aria-pressed', b.dataset.view === next ? 'true' : 'false')
  );

  if (zoomedId) zoomOut();
  renderLinks();
  renderGuestList();

  // the cork has no width while it's hidden, so re-measure on the way back
  if (next === 'board') {
    fit();
    paint();
  }

  if (remember) {
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch (e) {}
  }
}

Array.prototype.forEach.call(viewSwitch.children, (btn) => {
  btn.addEventListener('click', () => setView(btn.dataset.view, true));
});

// ---- links -----------------------------------------------------------------
const linkList = document.getElementById('links');
const noteEl = document.getElementById('note');
const nowPanel = document.getElementById('now-panel');

function renderLinks() {
  linkList.innerHTML = '';
  noteEl.hidden = true;
  nowPanel.hidden = true;

  LINKS.filter((l) => view === 'classic' || !l.classicOnly).forEach((link) => {
    const li = el('li');
    const btn = el('button');
    btn.type = 'button';
    if (link.tooltip) btn.title = link.tooltip;

    const arrow = el('span', 'arrow', '→');
    const label = el('span', '', link.label);
    const desc = el('span', 'desc', link.desc);

    btn.append(arrow, label, desc);
    btn.addEventListener('click', () => {
      if (link.toggle) {
        const panel = document.getElementById(link.toggle);
        const opening = panel.hidden;
        panel.hidden = !opening;
        btn.classList.toggle('open', opening);
        noteEl.hidden = true;
      } else if (link.url) {
        window.open(link.url, '_blank', 'noopener');
        noteEl.hidden = true;
      } else {
        noteEl.textContent = link.message;
        noteEl.hidden = false;
      }
    });

    li.appendChild(btn);
    linkList.appendChild(li);
  });
}

// ---- the written guestbook (classic view) ----------------------------------
const guestList = document.getElementById('guest-list');
const guestEmpty = document.getElementById('guest-empty');

function renderGuestList() {
  if (view !== 'classic') return;

  guestList.innerHTML = '';
  guestList.appendChild(guestEmpty);
  guestEmpty.hidden = store.guests.length > 0;

  store.guests
    .slice()
    .reverse()
    .forEach((entry) => {
      const li = el('li', 'guest-item');

      if (entry.kind === 'polaroid') {
        const thumb = el('img', 'guest-thumb');
        thumb.src = entry.src;
        thumb.alt = entry.caption || 'a pinned photo';
        li.appendChild(thumb);
        li.appendChild(el('span', 'guest-text', entry.caption || 'a photo'));
      } else {
        const swatch = el('span', 'guest-swatch');
        swatch.style.background = entry.color || NOTE_COLORS[0];
        li.appendChild(swatch);
        li.appendChild(el('span', 'guest-text', entry.text || ''));
      }

      guestList.appendChild(li);
    });
}

// ---- sizing ----------------------------------------------------------------
// Items are sized in pixels but positioned in percentages, so they have to
// scale with the board or they'd swallow it whole on a small screen.
const WIDEST_ITEM = 330; // the lead card, and so what has to fit when stacked
const STACK_GUTTER = 28; // the cork's own side padding in that layout

function fit() {
  const w = board.clientWidth;
  if (!w) return;
  if (dome) dome.resize();
  const scale = isStacked()
    ? Math.min(1, (w - STACK_GUTTER) / WIDEST_ITEM)
    : w / DESIGN_WIDTH;
  document.documentElement.style.setProperty('--scale', scale.toFixed(4));
}

// ---- building items --------------------------------------------------------
const items = new Map(); // id -> { data, el }, only for the board on screen
let zoomedId = null;

function buildPolaroid(data) {
  const node = el('div', 'polaroid' + (data.small ? ' is-small' : ''));
  const shot = el('div', 'polaroid-shot');

  if (data.src) {
    const img = el('img');
    img.alt = data.caption || 'a pinned photo';
    img.draggable = false;
    shot.appendChild(img);
    if (DOODLE_PHOTOS && !data.doodled) {
      // drawn as it's shown: paper sits in the frame until the drawing lands
      shot.classList.add('is-drawing');
      img.addEventListener('load', () => shot.classList.add('drawn'), { once: true });
      doodleSrc(data.src).then((url) => {
        img.src = url;
      });
    } else {
      img.src = data.src;
      if (data.fresh) shot.classList.add('developing');
    }
  } else if (data.empty) {
    shot.classList.add('is-empty');
    shot.appendChild(el('span', 'shot-hint', 'no photo yet'));
  }

  node.appendChild(shot);
  node.appendChild(el('p', 'polaroid-caption', data.caption || ''));
  return node;
}

function buildCard(data) {
  const node = el('div', 'card' + (data.lead ? ' is-lead' : ''));

  if (data.label) node.appendChild(el('p', 'card-label', data.label));
  if (data.name) node.appendChild(el('h3', 'card-name', data.name));
  if (data.role) node.appendChild(el('p', 'card-role', data.role));
  (data.lines || []).forEach((line) => node.appendChild(el('p', 'card-line', line)));

  if (data.links && data.links.length) {
    const box = el('div', 'card-links');
    data.links.forEach((link) => {
      const a = el('a', 'card-link');
      a.href = link.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.appendChild(el('span', '', link.label));
      a.appendChild(el('span', 'card-link-arrow', '→'));
      box.appendChild(a);
    });
    node.appendChild(box);
    node.appendChild(el('p', 'card-open', 'open me'));
  }

  return node;
}

// ---- the dome on the trips board -------------------------------------------
// A globe under glass, pinned to the cork. Drag it to spin, tap a marker to
// pull up that trip. It owns its own pointer handling, which is why the item
// is marked fixed and never gets the drag-and-zoom treatment.
let dome = null;

function disposeDome() {
  if (!dome) return;
  dome.stop();
  dome = null;
}

function createDome(canvas) {
  if (!window.THREE) return null;

  const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.z = 14.5;

  const R = 5;
  const group = new THREE.Group();
  scene.add(group);

  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(R, 48, 48),
    new THREE.MeshLambertMaterial({ map: new THREE.TextureLoader().load('assets/earth-cartoon.png') })
  );
  group.add(earth);

  scene.add(new THREE.AmbientLight(0xffffff, 0.86));
  const sun = new THREE.DirectionalLight(0xffffff, 0.46);
  sun.position.set(3, 2, 4);
  scene.add(sun);

  function toVec(lat, lon, radius) {
    const phi = (lat * Math.PI) / 180;
    const theta = ((lon - 180) * Math.PI) / 180;
    return new THREE.Vector3(
      -radius * Math.cos(phi) * Math.cos(theta),
      radius * Math.sin(phi),
      radius * Math.cos(phi) * Math.sin(theta)
    );
  }

  // ---- landmarks ----------------------------------------------------------
  // Each place gets a badge with its own icon, floating just off the surface on
  // a short leader line down to the exact spot. Places that sit on top of each
  // other — tokyo and kyoto are 3 degrees apart — are fanned out around their
  // shared middle so every badge stays its own target. That's what lets the
  // camera stay put: nothing has to be zoomed into to be picked apart.
  const spots = TRIPS.map((t) => toVec(t.lat, t.lon, R));
  const CLUSTER = 1.1; // closer than this and they get fanned
  const LIFT = 0.62; // how far a badge floats off the surface
  const FAN = 0.62; // how far out from the middle of a cluster they spread

  // single-linkage grouping: anything within CLUSTER of anything already in a
  // group joins that group
  const groupOf = spots.map(() => -1);
  let groupCount = 0;
  spots.forEach((a, i) => {
    if (groupOf[i] >= 0) return;
    groupOf[i] = groupCount++;
    let grew = true;
    while (grew) {
      grew = false;
      spots.forEach((b, j) => {
        if (groupOf[j] >= 0) return;
        const near = spots.some((c, k) => groupOf[k] === groupOf[i] && b.distanceTo(c) < CLUSTER);
        if (near) {
          groupOf[j] = groupOf[i];
          grew = true;
        }
      });
    }
  });

  // where each badge hangs, fanned around the middle of its group
  const perches = spots.map((at, i) => {
    const mates = groupOf.map((g, j) => (g === groupOf[i] ? j : -1)).filter((j) => j >= 0);
    const out = at.clone().normalize();
    if (mates.length === 1) return out.clone().multiplyScalar(R + LIFT);

    // the middle of the group, and a pair of axes lying flat against the globe
    const mid = new THREE.Vector3();
    mates.forEach((j) => mid.add(spots[j]));
    mid.normalize();
    const side = new THREE.Vector3(0, 1, 0).cross(mid);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    const up = mid.clone().cross(side).normalize();

    const turn = (mates.indexOf(i) / mates.length) * Math.PI * 2 - Math.PI / 2;
    return mid
      .clone()
      .multiplyScalar(R + LIFT)
      .addScaledVector(side, Math.cos(turn) * FAN)
      .addScaledVector(up, Math.sin(turn) * FAN);
  });

  // the icon, drawn onto a little paper badge
  function badge(trip) {
    const px = 128;
    const c = document.createElement('canvas');
    c.width = px;
    c.height = px;
    const g = c.getContext('2d');

    g.beginPath();
    g.arc(px / 2, px / 2, px / 2 - 6, 0, Math.PI * 2);
    g.fillStyle = '#fdfbf4';
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = trip.upcoming ? '#d2601a' : '#b03a3a';
    g.stroke();

    g.font = '62px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(trip.icon || '•', px / 2, px / 2 + 4);

    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    sprite.scale.set(0.66, 0.66, 1);
    return sprite;
  }

  const leaderMat = new THREE.MeshBasicMaterial({ color: 0x4a3a2c, transparent: true, opacity: 0.55 });
  const footGeo = new THREE.SphereGeometry(0.07, 10, 10);
  const UP = new THREE.Vector3(0, 1, 0);

  const markers = TRIPS.map((trip, i) => {
    const at = spots[i];
    const perch = perches[i];
    const colour = trip.upcoming ? 0xd2601a : 0xb03a3a;

    // a dot on the exact spot
    const foot = new THREE.Mesh(footGeo, new THREE.MeshBasicMaterial({ color: colour }));
    foot.position.copy(at);
    group.add(foot);

    // a thin post from the spot up to the badge
    const span = perch.clone().sub(at);
    const leader = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, span.length(), 6), leaderMat);
    leader.position.copy(at).addScaledVector(span, 0.5);
    leader.quaternion.setFromUnitVectors(UP, span.clone().normalize());
    group.add(leader);

    const icon = badge(trip);
    icon.position.copy(perch);
    group.add(icon);

    // the badge is what you aim at
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.38, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.copy(perch);
    hit.userData.index = i;
    group.add(hit);

    return { icon: icon, foot: foot, hit: hit, at: at, perch: perch };
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const TILT = 1.35; // ~77°, short of the pole so the globe can't roll over
  const spin = { x: 0.2, y: 0 };
  const target = { x: 0.2, y: 0 };
  // a timed flight to a place, so picking one is a deliberate move rather than
  // the lazy drift-towards-it that easing alone gives
  let flight = null;
  let drift = true;
  let dragging = false;
  let last = { x: 0, y: 0 };
  let travelled = 0;
  let pointerId = null;

  function markerAt(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    const globeHit = raycaster.intersectObject(earth, false)[0];
    const hits = raycaster.intersectObjects(markers.map((m) => m.hit), false);
    for (const h of hits) {
      // skip anything round the back of the planet
      if (!globeHit || h.distance <= globeHit.distance + 0.1) return h.object.userData.index;
    }
    return -1;
  }

  function down(e) {
    pointerId = e.pointerId;
    try {
      canvas.setPointerCapture(pointerId);
    } catch (err) {}
    dragging = true;
    drift = false;
    flight = null; // your hand wins over any move in progress
    travelled = 0;
    last = { x: e.clientX, y: e.clientY };
  }

  // outside the glass, which is a circle with overflow hidden and would crop it
  const tip = document.createElement('div');
  tip.className = 'dome-tip';
  tip.hidden = true;
  const domeEl = canvas.closest('.dome');
  domeEl.appendChild(tip);

  function nameUnder(e) {
    const i = markerAt(e.clientX, e.clientY);
    if (i < 0) {
      tip.hidden = true;
      return -1;
    }
    const box = domeEl.getBoundingClientRect();
    tip.textContent = tripName(TRIPS[i]);
    tip.style.left = e.clientX - box.left + 'px';
    tip.style.top = e.clientY - box.top + 'px';
    tip.hidden = false;
    return i;
  }

  canvas.addEventListener('pointerleave', () => {
    tip.hidden = true;
  });

  function move(e) {
    if (e.pointerId !== pointerId) {
      canvas.style.cursor = nameUnder(e) >= 0 ? 'pointer' : 'grab';
      return;
    }
    tip.hidden = true; // nothing to label while it's being spun
    if (!dragging) return;
    travelled += Math.abs(e.clientX - last.x) + Math.abs(e.clientY - last.y);
    target.y += (e.clientX - last.x) * 0.006;
    target.x += (e.clientY - last.y) * 0.006;
    target.x = Math.max(-TILT, Math.min(TILT, target.x));
    last = { x: e.clientX, y: e.clientY };
  }

  function up(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    dragging = false;
    if (travelled < 6) {
      const i = markerAt(e.clientX, e.clientY);
      if (i >= 0) goToTrip(i);
    }
    setTimeout(() => {
      drift = true;
    }, 5000);
  }

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);

  let running = true;

  function size() {
    const w = canvas.clientWidth;
    if (!w) return;
    renderer.setSize(w, w, false);
  }

  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const now = performance.now();
    if (flight) {
      const t = Math.min(1, (now - flight.start) / flight.span);
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      spin.x = flight.fromX + (flight.toX - flight.fromX) * e;
      spin.y = flight.fromY + (flight.toY - flight.fromY) * e;
      if (t >= 1) flight = null;
    } else {
      if (drift) target.y += 0.0016;
      spin.x += (target.x - spin.x) * 0.13;
      spin.y += (target.y - spin.y) * 0.13;
    }
    group.rotation.x = spin.x;
    group.rotation.y = spin.y;

    markers.forEach((m, i) => {
      const on = i === pickedTrip;
      const size = 0.66 * (on ? 1.34 : 1) * (on ? 1 + 0.035 * Math.sin(now / 340) : 1);
      m.icon.scale.set(size, size, 1);
      m.icon.material.opacity = on ? 1 : 0.9;
    });

    renderer.render(scene, camera);
  }

  size();
  frame();

  // spin the chosen place round to the front
  function face(lat, lon) {
    const at = toVec(lat, lon, 1);
    // where it sits now, and where it needs to be to point at the camera
    // rotating the group by `a` moves a point from angle p to p - a, so to land
    // this one on +z (facing the camera) we turn by its angle minus a quarter
    const here = Math.atan2(at.z, at.x);
    let turn = here - Math.PI / 2;
    // take the short way round from wherever the globe currently is
    while (turn - target.y > Math.PI) turn -= Math.PI * 2;
    while (turn - target.y < -Math.PI) turn += Math.PI * 2;
    target.y = turn;
    target.x = Math.max(-TILT, Math.min(TILT, (lat * Math.PI) / 180));

    // whatever the cursor was over is about to move out from under it
    tip.hidden = true;

    // ease in and out over a fixed span, rather than creeping towards it
    flight = { fromX: spin.x, fromY: spin.y, toX: target.x, toY: target.y,
               start: performance.now(), span: 760 };
    drift = false;
    setTimeout(() => {
      drift = true;
    }, 5000);
  }

  return {
    resize: size,
    face: face,
    stop: function () {
      running = false;
      renderer.dispose();
    },

    // For checking marker placement from the console, e.g. after editing TRIPS:
    //   dome.debug.face(t.lat, t.lon); dome.debug.settle(); dome.debug.screenOf(i)
    // should put that marker in the middle of the canvas.
    debug: {
      probe: markerAt, // which marker is under a screen point, or -1
      screenOf: function (i) {
        const m = markers[i];
        if (!m) return null;
        group.updateMatrixWorld(true);
        // the badge, since that's the thing you actually click
        const v = m.perch.clone().applyMatrix4(group.matrixWorld).project(camera);
        const w = canvas.clientWidth;
        return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * w, front: v.z < 1 };
      },
      face: face,
      settle: function () {
        spin.x = target.x;
        spin.y = target.y;
        flight = null;
        drift = false;
        group.rotation.x = spin.x; // through now, not on the next frame
        group.rotation.y = spin.y;
        group.updateMatrixWorld(true);
      },
      flying: function () {
        return flight !== null;
      },
    },
  };
}

function buildGlobe() {
  const node = el('div', 'dome');
  const glass = el('div', 'dome-glass');
  const canvas = el('canvas', 'dome-canvas');
  glass.appendChild(canvas);
  node.appendChild(glass);
  node.appendChild(el('p', 'dome-caption', ''));
  return node;
}

function pickTrip(i) {
  if (i === pickedTrip) return;
  pickedTrip = i;
  refreshTrip();
}

// picking from anywhere turns the globe to match
function goToTrip(i) {
  pickTrip(i);
  const trip = TRIPS[i];
  if (dome && trip) dome.face(trip.lat, trip.lon);
}

// swap only the photos, so the globe keeps spinning where it was
function refreshTrip() {
  const trip = TRIPS[pickedTrip];
  const caption = document.querySelector('.dome-caption');
  if (caption) caption.textContent = tripName(trip) + ' · ' + trip.when;

  items.forEach((entry, id) => {
    if (id.indexOf('tp-') === 0) {
      entry.el.remove();
      items.delete(id);
    }
  });

  tripItems()
    .filter((d) => d.kind === 'polaroid')
    .forEach((d) => render(d));
}

function buildSticker(data) {
  const node = el('div', 'sticker-art');
  const img = el('img');
  img.src = data.src;
  img.alt = 'a sticker someone stuck on the board';
  img.draggable = false;
  node.appendChild(img);

  // peel it back off; it lives on the art, not the item, so it sits in the
  // right place whether the board is laid out or stacked
  const x = el('button', 'peel', '\u00d7');
  x.type = 'button';
  x.setAttribute('aria-label', 'remove this sticker');
  x.addEventListener('click', (e) => {
    e.stopPropagation();
    peel(data.id);
  });
  node.appendChild(x);
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

  // on the wrapper, so the card's top edge can pick up the same colour
  if (data.pin) wrap.style.setProperty('--pin', data.pin);

  const build =
    data.kind === 'globe'
      ? buildGlobe
      : data.kind === 'polaroid'
      ? buildPolaroid
      : data.kind === 'card'
      ? buildCard
      : data.kind === 'sticker'
      ? buildSticker
      : buildSticky;
  wrap.appendChild(build(data));

  // a globe is a fixture and a sticker sticks by itself; the rest need holding up
  if (data.kind !== 'globe' && data.kind !== 'sticker') {
    wrap.appendChild(el('div', data.tape ? 'tape' : 'pin'));
  }

  if (data.fresh) {
    wrap.classList.add('landing');
    wrap.addEventListener('animationend', () => wrap.classList.remove('landing'), { once: true });
  }

  board.appendChild(wrap);
  items.set(data.id, { data: live, el: wrap });

  if (data.kind === 'globe') {
    // the dome answers its own pointers: spin and marker picking, no dragging
    wrap.classList.add('is-fixed');
    wrap.removeAttribute('tabindex');
    wrap.removeAttribute('role');
    disposeDome();
    dome = createDome(wrap.querySelector('.dome-canvas'));
    const trip = TRIPS[pickedTrip];
    wrap.querySelector('.dome-caption').textContent = tripName(trip) + ' · ' + trip.when;
    if (dome) dome.face(trip.lat, trip.lon);
    else wrap.querySelector('.dome-glass').classList.add('no-webgl');
  } else {
    attach(wrap, live);
  }

  return wrap;
}

// ---- flipping between boards ----------------------------------------------
const boardName = document.getElementById('board-name');
const boardNote = document.getElementById('board-note');
const boardEmpty = document.getElementById('board-empty');
const boardDots = document.getElementById('board-dots');
const toolbar = document.getElementById('toolbar');
let current = 0;

function itemsFor(b) {
  const own = b.dynamic ? b.dynamic() : b.open ? b.items.concat(store.guests) : b.items;
  // plus any stickers stuck to this particular board
  return own.concat(store.stuck.filter((s) => s.board === b.id));
}

function paint() {
  const b = BOARDS[current];

  disposeDome();
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
  if (view !== 'board' || zoomedId) return;
  if (!document.getElementById('compose-layer').hidden) return;
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
    // ...and a link inside the open card belongs to the link, not to us
    if (zoomedId === live.id && e.target.closest('a')) return;
    // the × on a sticker is its own button, not a handle
    if (e.target.closest('.peel')) return;
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
    if (e.target !== node) return; // a button inside the item handles its own keys
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
  board.classList.add('has-zoom');
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
    setTimeout(() => {
      node.classList.remove('returning');
      // only re-clip once it's all the way home
      if (!zoomedId) board.classList.remove('has-zoom');
    }, 460);
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

function keep(data, spot, z) {
  store.guests.push(Object.assign({}, data, { x: spot.x, y: spot.y }));
  store.positions[data.id] = { x: spot.x, y: spot.y, z: z };
  // over quota: shed the oldest photo and try once more
  if (!save() && dropOldestPhoto()) save();
  renderGuestList();
}

function addGuestItem(data) {
  // In the classic view the cork isn't on screen, so there's nothing to measure
  // and nothing to animate: park it somewhere sensible for when they flip over.
  if (view !== 'board') {
    store.top = (store.top || 10) + 1;
    keep(data, { x: 4 + Math.random() * 68, y: 6 + Math.random() * 62 }, store.top);
    return;
  }

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

  keep(data, spot, live.z);
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

// ---- the add buttons, which appear in both views ---------------------------
const fileInput = document.getElementById('file-input');

document.querySelectorAll('[data-add]').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.dataset.add === 'photo') {
      fileInput.click();
      return;
    }
    composeText.value = '';
    composeLeft.textContent = '180';
    composePin.disabled = true;
    composeLayer.hidden = false;
    composeText.focus();
  });
});

fileInput.addEventListener('change', async () => {
  const file = fileInput.files && fileInput.files[0];
  fileInput.value = '';
  if (!file || file.type.indexOf('image/') !== 0) return;

  const photos = store.guests.filter((g) => g.kind === 'polaroid').length;
  if (photos >= MAX_PHOTOS) dropOldestPhoto();

  // drawn once here and stored drawn, so it never has to be redone on display;
  // jpeg because the paper grain makes png several times the size
  let src;
  try {
    src = (await doodleFile(file)).toDataURL('image/jpeg', 0.86);
  } catch (e) {
    return;
  }

  addGuestItem({
    id: newId(),
    kind: 'polaroid',
    src: src,
    doodled: true,
    caption: (file.name || '').replace(/\.[^.]+$/, '').slice(0, 28),
    rot: (Math.random() - 0.5) * 10,
    tape: Math.random() < 0.45,
    pin: '#2f6fb0',
  });
});

// ---------------------------------------------------------------------------
// Doodles
//
// Every photo on the boards is redrawn as an illustration: simplified into a
// handful of bold, flat marker colours, outlined in ink where one thing meets
// another, hatched in the shadows, with the photo's own fine lines — eyes,
// hair, a paddle — drawn back in so it stays recognisably the same picture.
// No model and nothing downloaded: it's plain image processing, so it's free,
// it works on a phone, and the photo never leaves the device.
//
//   1. simplify  — shrink, bilateral-smooth, and cut into ~10 colours, one of
//                  them kept for the brightest accent; specks are swallowed
//   2. colour    — each colour pushed to marker saturation and contrast
//   3. shapes    — brought back up as soft masks with a hand wobble, so edges
//                  are smooth curves rather than pixel steps
//   4. ink       — outlines only between clearly different colours (objects,
//                  not every step of shading), plus the photo's strongest
//                  detail lines, plus hatching where it's dark
//
// doodleCore has to stay self-contained: it's stringified into a worker, so it
// can't reach anything outside itself.
// ---------------------------------------------------------------------------

const DOODLE_PHOTOS = true; // set false to show photos as they are
const DOODLE_PX = 560; // photos are drawn at this size on their long side

function doodleCore(src, W, H, opts) {
  opts = opts || {};
  const K = opts.colours || 10;
  const N = W * H;
  const PAPER = [248, 243, 231];
  const INK = [34, 29, 27];

  function hash(x, y) {
    let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }

  // smooth value noise, used to make lines and hatching wobble like a hand
  const cell = 34;
  function noise(x, y, seed) {
    const gx = x / cell;
    const gy = y / cell;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = gx - x0;
    const ty = gy - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const v = (a, c) => hash(a + seed * 101, c + seed * 57);
    const top = v(x0, y0) * (1 - sx) + v(x0 + 1, y0) * sx;
    const bottom = v(x0, y0 + 1) * (1 - sx) + v(x0 + 1, y0 + 1) * sx;
    return top * (1 - sy) + bottom * sy - 0.5;
  }

  function blur(a, sigma, w, h) {
    const r = Math.ceil(sigma * 3);
    const k = new Float32Array(r * 2 + 1);
    let total = 0;
    for (let i = -r; i <= r; i++) {
      k[i + r] = Math.exp(-(i * i) / (2 * sigma * sigma));
      total += k[i + r];
    }
    for (let i = 0; i < k.length; i++) k[i] /= total;
    const tmp = new Float32Array(w * h);
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let i = -r; i <= r; i++) {
          const xx = x + i < 0 ? 0 : x + i > w - 1 ? w - 1 : x + i;
          s += a[y * w + xx] * k[i + r];
        }
        tmp[y * w + x] = s;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let i = -r; i <= r; i++) {
          const yy = y + i < 0 ? 0 : y + i > h - 1 ? h - 1 : y + i;
          s += tmp[yy * w + x] * k[i + r];
        }
        out[y * w + x] = s;
      }
    }
    return out;
  }

  // ---- 1. look at the photo small, so the shapes it's cut into stay simple -
  const f = Math.max(1, Math.round(Math.max(W, H) / (opts.detail || 230)));
  const w = Math.ceil(W / f);
  const h = Math.ceil(H / f);
  const n = w * h;
  let r = new Float32Array(n);
  let g = new Float32Array(n);
  let b = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let c = 0;
      for (let dy = 0; dy < f; dy++) {
        for (let dx = 0; dx < f; dx++) {
          const yy = y * f + dy;
          const xx = x * f + dx;
          if (yy >= H || xx >= W) continue;
          const p = (yy * W + xx) * 4;
          const a = src[p + 3] / 255; // transparency lands on paper
          sr += src[p] * a + PAPER[0] * (1 - a);
          sg += src[p + 1] * a + PAPER[1] * (1 - a);
          sb += src[p + 2] * a + PAPER[2] * (1 - a);
          c++;
        }
      }
      const j = y * w + x;
      r[j] = sr / c;
      g[j] = sg / c;
      b[j] = sb / c;
    }
  }

  // ---- 2. bilateral smoothing flattens texture inside each shape ----------
  const rad = 3;
  const sS = 2;
  const sR = 24;
  for (let pass = 0; pass < 3; pass++) {
    const nr = new Float32Array(n);
    const ng = new Float32Array(n);
    const nb = new Float32Array(n);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const j = y * w + x;
        let a = 0;
        let br = 0;
        let bg = 0;
        let bb = 0;
        for (let dy = -rad; dy <= rad; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -rad; dx <= rad; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            const q = yy * w + xx;
            const er = r[q] - r[j];
            const eg = g[q] - g[j];
            const eb = b[q] - b[j];
            const wt = Math.exp(-(dx * dx + dy * dy) / (2 * sS * sS) - (er * er + eg * eg + eb * eb) / (2 * sR * sR));
            a += wt;
            br += r[q] * wt;
            bg += g[q] * wt;
            bb += b[q] * wt;
          }
        }
        nr[j] = br / a;
        ng[j] = bg / a;
        nb[j] = bb / a;
      }
    }
    r = nr;
    g = ng;
    b = nb;
  }

  // ---- 3. cut it into a few flat colours -----------------------------------
  const idx = [];
  const every = Math.max(1, Math.floor(n / 4000));
  for (let i = 0; i < n; i += every) idx.push(i);
  const lum = (i) => 0.299 * r[i] + 0.587 * g[i] + 0.114 * b[i];
  idx.sort((a, c) => lum(a) - lum(c));
  const C = new Float32Array(K * 3);
  // all but one colour seeded evenly through the brightness range...
  for (let k = 0; k < K - 1; k++) {
    const s = idx[Math.floor(((k + 0.5) / (K - 1)) * idx.length)];
    C[k * 3] = r[s];
    C[k * 3 + 1] = g[s];
    C[k * 3 + 2] = b[s];
  }
  // ...and the last on the most saturated thing in the picture, so a small
  // bright accent — red lips, a red jacket — keeps a colour of its own
  let vivid = idx[0];
  let vividC = -1;
  for (const i of idx) {
    const c = Math.max(r[i], g[i], b[i]) - Math.min(r[i], g[i], b[i]);
    if (c > vividC) {
      vividC = c;
      vivid = i;
    }
  }
  C[(K - 1) * 3] = r[vivid];
  C[(K - 1) * 3 + 1] = g[vivid];
  C[(K - 1) * 3 + 2] = b[vivid];

  function nearest(rr, gg, bb) {
    let best = 0;
    let bd = Infinity;
    for (let k = 0; k < K; k++) {
      const d1 = rr - C[k * 3];
      const d2 = gg - C[k * 3 + 1];
      const d3 = bb - C[k * 3 + 2];
      const d = 2 * d1 * d1 + 4 * d2 * d2 + 3 * d3 * d3;
      if (d < bd) {
        bd = d;
        best = k;
      }
    }
    return best;
  }
  for (let it = 0; it < 12; it++) {
    const s = new Float64Array(K * 4);
    for (const i of idx) {
      const k = nearest(r[i], g[i], b[i]);
      s[k * 4] += r[i];
      s[k * 4 + 1] += g[i];
      s[k * 4 + 2] += b[i];
      s[k * 4 + 3]++;
    }
    for (let k = 0; k < K; k++) {
      if (!s[k * 4 + 3]) continue;
      C[k * 3] = s[k * 4] / s[k * 4 + 3];
      C[k * 3 + 1] = s[k * 4 + 1] / s[k * 4 + 3];
      C[k * 3 + 2] = s[k * 4 + 2] / s[k * 4 + 3];
    }
  }
  let lab = new Uint8Array(n);
  for (let j = 0; j < n; j++) lab[j] = nearest(r[j], g[j], b[j]);

  // two rounds of 3x3 majority vote clean the edges of each shape
  for (let pass = 0; pass < 2; pass++) {
    const out = new Uint8Array(n);
    const t = new Uint16Array(K);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        t.fill(0);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const yy = y + dy;
            const xx = x + dx;
            if (yy >= 0 && yy < h && xx >= 0 && xx < w) t[lab[yy * w + xx]]++;
          }
        }
        let p = lab[y * w + x];
        for (let k = 0; k < K; k++) if (t[k] > t[p]) p = k;
        out[y * w + x] = p;
      }
    }
    lab = out;
  }

  // any patch smaller than a speck joins its most common neighbour
  const minArea = Math.max(6, Math.round(n * (opts.speck || 0.0012)));
  const seen = new Uint8Array(n);
  const around = (j) => {
    const x = j % w;
    const y = (j / w) | 0;
    const out = [];
    if (x + 1 < w) out.push(j + 1);
    if (x > 0) out.push(j - 1);
    if (y + 1 < h) out.push(j + w);
    if (y > 0) out.push(j - w);
    return out;
  };
  for (let s0 = 0; s0 < n; s0++) {
    if (seen[s0]) continue;
    const stack = [s0];
    const cells = [];
    seen[s0] = 1;
    while (stack.length) {
      const j = stack.pop();
      cells.push(j);
      for (const q of around(j)) {
        if (!seen[q] && lab[q] === lab[j]) {
          seen[q] = 1;
          stack.push(q);
        }
      }
    }
    if (cells.length >= minArea) continue;
    const t = new Uint32Array(K);
    for (const j of cells) for (const q of around(j)) if (lab[q] !== lab[j]) t[lab[q]]++;
    let best = lab[s0];
    let bc = 0;
    for (let k = 0; k < K; k++) {
      if (t[k] > bc) {
        bc = t[k];
        best = k;
      }
    }
    for (const j of cells) lab[j] = best;
  }

  // ---- 4. stronger colours: push saturation and contrast like marker ink ---
  const F = new Float32Array(K * 3);
  const light = new Float32Array(K);
  for (let k = 0; k < K; k++) {
    const R = C[k * 3] / 255;
    const G = C[k * 3 + 1] / 255;
    const B = C[k * 3 + 2] / 255;
    const mx = Math.max(R, G, B);
    const mn = Math.min(R, G, B);
    let L = (mx + mn) / 2;
    let S = 0;
    let hue = 0;
    if (mx !== mn) {
      const d = mx - mn;
      S = L > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      hue = mx === R ? (G - B) / d + (G < B ? 6 : 0) : mx === G ? (B - R) / d + 2 : (R - G) / d + 4;
      hue /= 6;
    }
    S = Math.min(1, S * (opts.saturation || 1.55) + 0.06);
    L = Math.min(0.92, Math.max(0.16, 0.5 + (L - 0.5) * (opts.contrast || 1.15) + 0.03));
    light[k] = L;
    const q = L < 0.5 ? L * (1 + S) : L + S - L * S;
    const p = 2 * L - q;
    const ch = (t) => {
      t = (t + 1) % 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    F[k * 3] = ch(hue + 1 / 3) * 255;
    F[k * 3 + 1] = ch(hue) * 255;
    F[k * 3 + 2] = ch(hue - 1 / 3) * 255;
  }

  // ---- 5. bring the shapes back up to full size with smooth, hand-wobbled
  //         edges: each colour is a soft mask, and the biggest one wins -------
  const masks = [];
  const kern = [0.25, 0.5, 0.25];
  for (let k = 0; k < K; k++) {
    const m = new Float32Array(n);
    for (let j = 0; j < n; j++) m[j] = lab[j] === k ? 1 : 0;
    const tmp = new Float32Array(n);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let i = -1; i <= 1; i++) s += m[y * w + Math.min(w - 1, Math.max(0, x + i))] * kern[i + 1];
        tmp[y * w + x] = s;
      }
    }
    const soft = new Float32Array(n);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let i = -1; i <= 1; i++) s += tmp[Math.min(h - 1, Math.max(0, y + i)) * w + x] * kern[i + 1];
        soft[y * w + x] = s;
      }
    }
    masks.push(soft);
  }
  const wobble = opts.wobble === undefined ? 3 : opts.wobble;
  const L = new Uint8Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const ux = x + noise(x, y, 1) * wobble;
      const uy = y + noise(x, y, 2) * wobble;
      const fx = Math.min(w - 1, Math.max(0, (ux + 0.5) / f - 0.5));
      const fy = Math.min(h - 1, Math.max(0, (uy + 0.5) / f - 0.5));
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const x1 = Math.min(w - 1, x0 + 1);
      const y1 = Math.min(h - 1, y0 + 1);
      const tx = fx - x0;
      const ty = fy - y0;
      let best = 0;
      let bv = -1;
      for (let k = 0; k < K; k++) {
        const m = masks[k];
        const v =
          (m[y0 * w + x0] * (1 - tx) + m[y0 * w + x1] * tx) * (1 - ty) +
          (m[y1 * w + x0] * (1 - tx) + m[y1 * w + x1] * tx) * ty;
        if (v > bv) {
          bv = v;
          best = k;
        }
      }
      L[y * W + x] = best;
    }
  }

  // ---- 6. outlines, but only between clearly different colours: artists
  //         outline objects, not every step of shading on a cheek -----------
  const edgeT = (opts.edge || 85) * (opts.edge || 85);
  const apart = (a, c) => {
    const d1 = F[a * 3] - F[c * 3];
    const d2 = F[a * 3 + 1] - F[c * 3 + 1];
    const d3 = F[a * 3 + 2] - F[c * 3 + 2];
    return d1 * d1 + d2 * d2 + d3 * d3 > edgeT;
  };
  const edge = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const l = L[i];
      if ((x + 1 < W && L[i + 1] !== l && apart(l, L[i + 1])) || (y + 1 < H && L[i + W] !== l && apart(l, L[i + W]))) {
        edge[i] = 1;
      }
    }
  }
  const pen = blur(edge, opts.pen || 1.3, W, H);
  const outline = new Float32Array(N);
  for (let i = 0; i < N; i++) outline[i] = Math.min(1, Math.max(0, (pen[i] - 0.12) * 4.2));

  // ---- 7. detail lines from the photo itself — eyes, lips, hair, a paddle —
  //         so it stays recognisably the same picture -----------------------
  const grey = new Float32Array(N);
  for (let i = 0, p = 0; i < N; i++, p += 4) grey[i] = 0.299 * src[p] + 0.587 * src[p + 1] + 0.114 * src[p + 2];
  const s1 = opts.line || 1.2;
  const near = blur(grey, s1, W, H);
  const far = blur(grey, s1 * 1.6, W, H);
  const eps = opts.eps === undefined ? -0.006 : opts.eps;
  const detail = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const d = (near[i] - 0.985 * far[i]) / 255;
    const e = d >= eps ? 1 : 1 + Math.tanh(110 * (d - eps));
    detail[i] = Math.min(1, (1 - Math.max(0, e)) * 0.9);
  }

  // ---- 8. put it together: flat marker fill, hatching in the shadows, ink --
  const out = new Uint8ClampedArray(N * 4);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const k = L[i];
      // faint diagonal streaks inside each fill, the way a marker drags
      const streak = 1 - 0.06 * (0.5 + 0.5 * Math.sin((x * 0.9 + y * 0.35) * 0.55 + noise(x, y, 3) * 6));
      let cr = F[k * 3] * streak;
      let cg = F[k * 3 + 1] * streak;
      let cb = F[k * 3 + 2] * streak;

      const lv = light[k];
      if (lv < 0.3) {
        const wx = x + noise(x, y, 4) * 3;
        const wy = y + noise(x, y, 5) * 3;
        let hatch = Math.abs((((wx + wy) % 7) + 7) % 7 - 3.5) > 3 ? 0.35 : 0;
        if (lv < 0.2 && Math.abs((((wx - wy) % 8) + 8) % 8 - 4) > 3.4) hatch = 0.35;
        cr = cr * (1 - hatch) + INK[0] * hatch;
        cg = cg * (1 - hatch) + INK[1] * hatch;
        cb = cb * (1 - hatch) + INK[2] * hatch;
      }

      const e = Math.max(outline[i], detail[i]);
      cr = cr * (1 - e) + INK[0] * e;
      cg = cg * (1 - e) + INK[1] * e;
      cb = cb * (1 - e) + INK[2] * e;

      const grain = (hash(x, y) - 0.5) * 10;
      const p = i * 4;
      out[p] = cr + grain;
      out[p + 1] = cg + grain;
      out[p + 2] = cb + grain;
      out[p + 3] = 255;
    }
  }
  return out;
}

// ---- running it off the main thread ----------------------------------------
// Drawing a photo takes a few hundred milliseconds of solid arithmetic. Done on
// the page it would stall the globe and the board transitions, so it runs in a
// worker built from doodleCore's own source — and on the page as a fallback if
// a worker can't start.
let doodler = null; // the worker; false once we know it can't run
let doodleSeq = 0;
const doodleJobs = new Map();

function doodleWorker() {
  if (doodler !== null) return doodler;
  try {
    const source =
      'var doodleCore = ' + doodleCore.toString() + ';\n' +
      'self.onmessage = function (e) {\n' +
      '  var d = e.data;\n' +
      '  var out = doodleCore(d.pixels, d.w, d.h, d.opts);\n' +
      '  self.postMessage({ id: d.id, out: out }, [out.buffer]);\n' +
      '};\n';
    doodler = new Worker(URL.createObjectURL(new Blob([source], { type: 'text/javascript' })));
    doodler.onmessage = (e) => {
      const job = doodleJobs.get(e.data.id);
      if (!job) return;
      doodleJobs.delete(e.data.id);
      job.resolve(e.data.out);
    };
    doodler.onerror = () => {
      // the worker died: finish whatever was waiting on it here instead
      doodler = false;
      doodleJobs.forEach((job) => job.resolve(doodleCore(job.pixels, job.w, job.h, job.opts)));
      doodleJobs.clear();
    };
  } catch (err) {
    doodler = false;
  }
  return doodler;
}

function runDoodle(pixels, w, h, opts) {
  const worker = doodleWorker();
  if (!worker) return Promise.resolve(doodleCore(pixels, w, h, opts));
  return new Promise((resolve) => {
    const id = ++doodleSeq;
    // the original stays here in case the worker falls over; it gets a copy
    doodleJobs.set(id, { resolve: resolve, pixels: pixels, w: w, h: h, opts: opts });
    const copy = new Uint8ClampedArray(pixels);
    worker.postMessage({ id: id, pixels: copy, w: w, h: h, opts: opts }, [copy.buffer]);
  });
}

function drawToCanvas(source, max) {
  const ratio = Math.min(1, max / Math.max(source.width, source.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(source.width * ratio));
  canvas.height = Math.max(1, Math.round(source.height * ratio));
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // lets a photo from another site be drawn when that site allows it; our
    // own files, uploads and data urls are unaffected
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function doodleCanvas(img, max) {
  const canvas = drawToCanvas(img, max || DOODLE_PX);
  const ctx = canvas.getContext('2d');
  const shot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const out = await runDoodle(shot.data, canvas.width, canvas.height, {});
  ctx.putImageData(new ImageData(out, canvas.width, canvas.height), 0, 0);
  return canvas;
}

async function doodleFile(file, max) {
  const url = URL.createObjectURL(file);
  try {
    return await doodleCanvas(await loadImage(url), max);
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Photos pinned up by path — the trip photos — are drawn as they're shown, and
// only once each per visit. If one can't be read (a photo from another site
// without CORS), the original shows instead.
const doodled = new Map();
function doodleSrc(src) {
  if (!doodled.has(src)) {
    doodled.set(
      src,
      loadImage(src)
        .then((img) => doodleCanvas(img))
        .then((canvas) => canvas.toDataURL('image/jpeg', 0.88))
        .catch(() => src)
    );
  }
  return doodled.get(src);
}

// ---- stickers --------------------------------------------------------------
// A photo goes in, comes out drawn and framed like a sticker, and waits in the
// drawer until someone drags it onto a board.
const STICKER_PX = 300; // what we keep, before the board scales it
const MAX_STICKERS = 8; // localStorage is about 5MB for everything

const tray = document.getElementById('tray');
const trayEmpty = document.getElementById('tray-empty');
const drawerNote = document.getElementById('drawer-note');
const stickerInput = document.getElementById('sticker-input');

function say(text, warn) {
  drawerNote.textContent = text || '';
  drawerNote.hidden = !text;
  drawerNote.classList.toggle('warn', !!warn);
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// a thick white border with soft corners, the drawing clipped inside it
function stickerFrame(art) {
  const pad = Math.round(Math.max(art.width, art.height) * 0.055);
  const out = document.createElement('canvas');
  out.width = art.width + pad * 2;
  out.height = art.height + pad * 2;
  const ctx = out.getContext('2d');
  roundedRect(ctx, 0, 0, out.width, out.height, pad * 1.7);
  ctx.fillStyle = '#fffdf8';
  ctx.fill();
  ctx.save();
  roundedRect(ctx, pad, pad, art.width, art.height, pad * 0.9);
  ctx.clip();
  ctx.drawImage(art, pad, pad);
  ctx.restore();
  return out;
}

async function makeSticker(file) {
  say('drawing it…');
  const framed = stickerFrame(await doodleFile(file, STICKER_PX));
  say('');
  // webp keeps the rounded corners and is far smaller than png; browsers that
  // can't write it hand back a png instead
  return framed.toDataURL('image/webp', 0.9);
}

// ---- the drawer -----------------------------------------------------------
function renderTray() {
  Array.prototype.slice.call(tray.querySelectorAll('.tray-sticker')).forEach((n) => n.remove());
  trayEmpty.hidden = store.stickers.length > 0;

  store.stickers.forEach((sticker) => {
    const btn = el('button', 'tray-sticker');
    btn.type = 'button';
    btn.title = 'drag me onto the board';
    const img = el('img');
    img.src = sticker.src;
    img.alt = 'a sticker';
    btn.appendChild(img);
    carry(btn, sticker);
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') throwAway(sticker.id);
    });
    tray.appendChild(btn);
  });
}

document.getElementById('make-sticker').addEventListener('click', () => stickerInput.click());

stickerInput.addEventListener('change', async () => {
  const file = stickerInput.files && stickerInput.files[0];
  stickerInput.value = '';
  if (!file || file.type.indexOf('image/') !== 0) return;

  try {
    const src = await makeSticker(file);
    store.stickers.push({ id: 's' + newId(), src: src });
    while (store.stickers.length > MAX_STICKERS) store.stickers.shift();
    if (!save()) {
      store.stickers.shift();
      save();
      say('the drawer is full, so the oldest sticker made way for this one', true);
    }
    renderTray();
  } catch (err) {
    say("that photo couldn't be turned into a sticker", true);
  }
});

// ---- throwing stickers away -----------------------------------------------
const bin = document.getElementById('bin');

function showBin(on) {
  if (on === !bin.hidden) return;
  bin.hidden = !on;
  if (!on) bin.classList.remove('hot');
}

function overBin(e) {
  const r = bin.getBoundingClientRect();
  const slack = 18; // generous: you're aiming with a sticker, not a cursor
  return (
    e.clientX >= r.left - slack && e.clientX <= r.right + slack &&
    e.clientY >= r.top - slack && e.clientY <= r.bottom + slack
  );
}

// out of the drawer for good; copies already stuck on a board stay put
function throwAway(id) {
  store.stickers = store.stickers.filter((s) => s.id !== id);
  save();
  renderTray();
  say('sticker thrown away');
  setTimeout(() => say(''), 1800);
}

// off a board: the stuck copy goes, the drawer keeps its own
function peel(id) {
  if (zoomedId === id) zoomOut();
  store.stuck = store.stuck.filter((s) => s.id !== id);
  delete store.positions[id];
  save();
  const entry = items.get(id);
  if (entry) {
    entry.el.remove();
    items.delete(id);
  }
  boardEmpty.hidden = items.size > 0;
}

// ---- carrying one to the board --------------------------------------------
function carry(btn, sticker) {
  let ghost = null;
  let pointerId = null;
  let holding = null;

  btn.addEventListener('pointerdown', (e) => {
    if (e.button && e.button !== 0) return;
    pointerId = e.pointerId;
    try {
      btn.setPointerCapture(pointerId);
    } catch (err) {}
    // the bin comes up once it's clear this is a hold, not a tap
    holding = setTimeout(() => showBin(true), 220);

    ghost = el('div', 'sticker-ghost');
    const img = el('img');
    img.src = sticker.src;
    ghost.appendChild(img);
    ghost.style.left = e.clientX + 'px';
    ghost.style.top = e.clientY + 'px';
    document.body.appendChild(ghost);
  });

  btn.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId || !ghost) return;
    ghost.style.left = e.clientX + 'px';
    ghost.style.top = e.clientY + 'px';
    showBin(true);
    const binning = overBin(e);
    bin.classList.toggle('hot', binning);
    ghost.classList.toggle('binning', binning);
    board.classList.toggle('taking-sticker', !binning && overBoard(e));
  });

  function overBoard(e) {
    const r = board.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  }

  function drop(e) {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    clearTimeout(holding);
    const binning = !bin.hidden && overBin(e);
    showBin(false);
    board.classList.remove('taking-sticker');
    if (ghost) {
      ghost.remove();
      ghost = null;
    }
    if (binning) {
      throwAway(sticker.id);
      return;
    }
    if (!overBoard(e)) return;

    const r = board.getBoundingClientRect();
    const placed = {
      id: 'st' + newId(),
      kind: 'sticker',
      src: sticker.src,
      board: BOARDS[current].id,
      x: 50,
      y: 50,
      rot: (Math.random() - 0.5) * 14,
    };

    // put it down first, then centre it on the pointer using its real size —
    // a sticker renders at 150px times the board's scale, not 150px
    const node = render(Object.assign({}, placed, { fresh: true }));
    const live = items.get(placed.id).data;
    placed.x = ((e.clientX - r.left) / r.width) * 100 - (node.offsetWidth / r.width) * 50;
    placed.y = ((e.clientY - r.top) / r.height) * 100 - (node.offsetHeight / r.height) * 50;
    live.x = placed.x;
    live.y = placed.y;
    node.style.left = placed.x + '%';
    node.style.top = placed.y + '%';

    store.stuck.push(placed);
    store.top = (store.top || 10) + 1;
    live.z = store.top;
    node.style.zIndex = store.top;
    store.positions[placed.id] = { x: placed.x, y: placed.y, z: store.top };
    save();
    boardEmpty.hidden = true;
  }

  btn.addEventListener('pointerup', drop);
  btn.addEventListener('pointercancel', drop);
}

renderTray();

// ---- go --------------------------------------------------------------------
window.addEventListener('resize', fit);
if (narrow.addEventListener) narrow.addEventListener('change', fit);
setView(view, false);
