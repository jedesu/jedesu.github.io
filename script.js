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
// Each one is a marker on the dome. Drop photos into assets/trips/ and list
// them here; clicking the marker pins that trip's photos up beside the globe.
// A trip with no photos yet shows empty frames with its name on them.
//
// The three marked "example" are placeholders to show the thing working —
// swap in real places and delete the rest.
const TRIPS = [
  // japan, the next one — four stops close enough together that the globe
  // leans in when you tap one, so they come apart
  { id: 'tokyo', place: 'tokyo', region: 'japan', when: 'the next one', lat: 35.68, lon: 139.69, upcoming: true, photos: [] },
  { id: 'kyoto', place: 'kyoto', region: 'japan', when: 'the next one', lat: 35.01, lon: 135.77, upcoming: true, photos: [] },
  { id: 'hokkaido', place: 'hokkaido', region: 'japan', when: 'the next one', lat: 43.06, lon: 141.35, upcoming: true, photos: [] },
  { id: 'okinawa', place: 'okinawa', region: 'japan', when: 'been', lat: 26.21, lon: 127.68, photos: [] },

  { id: 'bangkok', place: 'bangkok', region: 'thailand', when: 'been', lat: 13.76, lon: 100.5, photos: [] },
  { id: 'chiangmai', place: 'chiang mai', region: 'thailand', when: 'been', lat: 18.79, lon: 98.98, photos: [] },
  { id: 'whistler', place: 'whistler', region: 'canada', when: 'been', lat: 50.12, lon: -122.95, photos: [] },
  { id: 'oahu', place: 'oahu', region: 'hawaii', when: 'been', lat: 21.31, lon: -157.86, photos: [] },
  { id: 'nyc', place: 'new york', region: 'usa', when: 'been', lat: 40.71, lon: -74.01, photos: [] },
  { id: 'santiago', place: 'santiago', region: 'chile', when: 'been', lat: -33.45, lon: -70.67, photos: [] },

  // These three were given as whole countries, so they're labelled as such and
  // pinned at the capital. Give me the city and I'll put the pin on it.
  { id: 'korea', place: 'south korea', when: 'been', lat: 37.57, lon: 126.98, photos: [] },
  { id: 'nz', place: 'new zealand', when: 'been', lat: -41.29, lon: 174.78, photos: [] },
  { id: 'argentina', place: 'argentina', when: 'been', lat: -34.6, lon: -58.38, photos: [] },
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
    note: 'pin a note or a photo — this one is yours',
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
    img.src = data.src;
    img.alt = data.caption || 'a pinned photo';
    img.draggable = false;
    shot.appendChild(img);
    if (data.fresh) shot.classList.add('developing');
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

  // how far each trip sits from its closest neighbour, so a cluster of places
  // a few degrees apart doesn't end up as one unpickable blob
  const spots = TRIPS.map((t) => toVec(t.lat, t.lon, R * 1.015));
  const elbowRoom = spots.map((a, i) => {
    let nearest = Infinity;
    spots.forEach((b, j) => {
      if (i !== j) nearest = Math.min(nearest, a.distanceTo(b));
    });
    return nearest;
  });

  // Shared between every pin, so ten of them cost one geometry each. The
  // cylinder and sphere both stand along Y; the group gets turned so that Y
  // points straight out of the globe, which is what makes them look stuck in.
  const stemGeo = new THREE.CylinderGeometry(0.024, 0.052, 0.4, 8);
  stemGeo.translate(0, 0.2, 0);
  const headGeo = new THREE.SphereGeometry(0.128, 16, 14);
  headGeo.scale(1, 0.84, 1);
  headGeo.translate(0, 0.46, 0);
  const collarGeo = new THREE.TorusGeometry(0.092, 0.024, 8, 18);
  collarGeo.rotateX(-Math.PI / 2);
  collarGeo.translate(0, 0.02, 0);

  const stemMat = new THREE.MeshLambertMaterial({ color: 0x7a6552 });
  const UP = new THREE.Vector3(0, 1, 0);

  // one pushpin per trip, plus an invisible target around its head
  const markers = TRIPS.map((trip, i) => {
    const at = spots[i];
    const out = at.clone().normalize();
    const colour = trip.upcoming ? 0xd2601a : 0xb03a3a;
    // never reach more than half way to the neighbour, so two pins that are
    // close together can't steal each other's taps
    const reach = Math.max(0.13, Math.min(0.55, elbowRoom[i] * 0.45));
    const scale = Math.max(0.55, Math.min(1.15, reach / 0.4));

    const pin = new THREE.Group();
    pin.position.copy(at);
    pin.quaternion.setFromUnitVectors(UP, out);
    pin.scale.setScalar(scale);
    group.add(pin);

    pin.add(new THREE.Mesh(stemGeo, stemMat));

    // phong rather than basic, so the pin head catches a highlight and reads
    // as a rounded object instead of a flat dot
    const head = new THREE.Mesh(
      headGeo,
      new THREE.MeshPhongMaterial({
        color: colour,
        shininess: 80,
        specular: 0x9a9a9a,
        emissive: 0x000000,
      })
    );
    pin.add(head);

    const collar = new THREE.Mesh(
      collarGeo,
      new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.38 })
    );
    pin.add(collar);

    // the head is what you aim at, so the target sits around it, not the base
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(Math.max(reach, 0.2 * scale), 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.copy(out).multiplyScalar(at.length() + 0.46 * scale);
    hit.userData.index = i;
    group.add(hit);

    return { pin: pin, head: head, collar: collar, hit: hit, at: at, scale: scale,
             crowded: elbowRoom[i] < 1.2 };
  });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const TILT = 1.35; // ~77°, short of the pole so the globe can't roll over
  const FAR = 14.5; // the resting camera distance
  const NEAR = 9; // close enough that places a few degrees apart come apart
  const spin = { x: 0.2, y: 0 };
  const target = { x: 0.2, y: 0 };
  let dolly = FAR;
  let targetDolly = FAR;
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
      if (i >= 0) {
        // lean in for a place with neighbours on top of it, so the next tap
        // can tell them apart; tapping bare globe pulls back out again
        targetDolly = markers[i].crowded ? NEAR : FAR;
        pickTrip(i);
      } else {
        targetDolly = FAR;
      }
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
    if (drift) target.y += 0.0016;
    spin.x += (target.x - spin.x) * 0.09;
    spin.y += (target.y - spin.y) * 0.09;
    group.rotation.x = spin.x;
    group.rotation.y = spin.y;

    dolly += (targetDolly - dolly) * 0.08;
    camera.position.z = dolly;

    const now = performance.now();
    markers.forEach((m, i) => {
      const on = i === pickedTrip;
      const bob = on ? 1 + 0.05 * Math.sin(now / 320) : 1;
      m.pin.scale.setScalar(m.scale * (on ? 1.4 : 1) * bob);
      m.collar.material.opacity = on ? 0.62 : 0.3;
      m.head.material.emissive.setHex(on ? 0x3a1400 : 0x000000);
    });

    renderer.render(scene, camera);
  }

  size();
  frame();

  // spin the chosen place round to the front
  // `close` leans the camera in when the place has neighbours on top of it
  function face(lat, lon, close) {
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
    if (close) {
      const i = TRIPS.findIndex((t) => t.lat === lat && t.lon === lon);
      targetDolly = i >= 0 && markers[i].crowded ? NEAR : FAR;
    }
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
        const v = m.at.clone().applyMatrix4(group.matrixWorld).project(camera);
        const w = canvas.clientWidth;
        return { x: (v.x * 0.5 + 0.5) * w, y: (-v.y * 0.5 + 0.5) * w, front: v.z < 1 };
      },
      face: face,
      settle: function () {
        spin.x = target.x;
        spin.y = target.y;
        dolly = targetDolly;
        drift = false;
        group.rotation.x = spin.x; // through now, not on the next frame
        group.rotation.y = spin.y;
        camera.position.z = dolly;
        camera.updateMatrixWorld(true);
      },
      dolly: function () {
        return { now: dolly, target: targetDolly };
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
  if (dome && trip) dome.face(trip.lat, trip.lon, true);
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
      : buildSticky;
  wrap.appendChild(build(data));

  if (data.kind !== 'globe') wrap.appendChild(el('div', data.tape ? 'tape' : 'pin'));

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
  if (b.dynamic) return b.dynamic();
  // the guestbook also carries whatever this visitor pinned
  return b.open ? b.items.concat(store.guests) : b.items;
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
window.addEventListener('resize', fit);
if (narrow.addEventListener) narrow.addEventListener('change', fit);
setView(view, false);
