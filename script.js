// ---- content config ---------------------------------------------------
const LINKS = [
  {
    label: 'linkedin',
    desc: '@julianneedes',
    url: 'https://www.linkedin.com/in/julianneedes/',
  },
  {
    label: 'resume',
    desc: 'coming soon',
    url: null,
    message: 'resume not uploaded yet — check back soon.',
  },
  {
    label: 'projects',
    desc: 'coming soon',
    url: null,
    message: 'no projects listed yet — check back soon.',
  },
  {
    label: 'currently',
    desc: "what i'm up to",
    toggle: 'now-panel',
  },
];

(function renderLinks() {
  const list = document.getElementById('links');
  const note = document.getElementById('note');

  LINKS.forEach((link) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';

    const arrow = document.createElement('span');
    arrow.className = 'arrow';
    arrow.textContent = '→';

    const label = document.createElement('span');
    label.textContent = link.label;

    const desc = document.createElement('span');
    desc.className = 'desc';
    desc.textContent = link.desc;

    btn.append(arrow, label, desc);
    btn.addEventListener('click', () => {
      if (link.toggle) {
        const panel = document.getElementById(link.toggle);
        const opening = panel.hidden;
        panel.hidden = !opening;
        btn.classList.toggle('open', opening);
        note.hidden = true;
      } else if (link.url) {
        window.open(link.url, '_blank', 'noopener');
        note.hidden = true;
      } else {
        note.textContent = link.message;
        note.hidden = false;
      }
    });

    li.appendChild(btn);
    list.appendChild(li);
  });
})();

// ---- realistic globe -----------------------------------------------------
const Globe = (function initGlobe() {
  const canvas = document.getElementById('globe');
  const stage = canvas.parentElement;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1000);
  camera.position.z = 15.5;

  const R = 5;
  const ACCENT = 0xd2601a;

  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  const loader = new THREE.TextureLoader();

  const earthMat = new THREE.MeshPhongMaterial({
    map: loader.load('assets/earth-map.jpg'),
    normalMap: loader.load('assets/earth-bump.jpg'),
    normalScale: new THREE.Vector2(0.55, 0.55),
    specularMap: loader.load('assets/earth-spec.jpg'),
    specular: new THREE.Color(0x2b2b2b),
    shininess: 14,
  });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 64, 64), earthMat);
  globeGroup.add(earth);

  const cloudMat = new THREE.MeshPhongMaterial({
    map: loader.load('assets/earth-clouds.png'),
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
  });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(R * 1.012, 48, 48), cloudMat);
  globeGroup.add(clouds);

  // soft atmosphere rim
  const atmoMat = new THREE.MeshBasicMaterial({
    color: 0x9dc4e8,
    transparent: true,
    opacity: 0.14,
    side: THREE.BackSide,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(R * 1.05, 48, 48), atmoMat));

  scene.add(new THREE.AmbientLight(0xffffff, 0.62));
  const sun = new THREE.DirectionalLight(0xffffff, 1.05);
  sun.position.set(3, 1.4, 4);
  scene.add(sun);

  // ---- pins ----
  const pinMat = new THREE.MeshBasicMaterial({ color: ACCENT });
  const glowMat = new THREE.MeshBasicMaterial({
    color: ACCENT,
    transparent: true,
    opacity: 0.28,
  });
  const pins = [];

  function latLonToVec(lat, lon, radius) {
    const phi = (lat * Math.PI) / 180;
    const theta = ((lon - 180) * Math.PI) / 180;
    return new THREE.Vector3(
      -radius * Math.cos(phi) * Math.cos(theta),
      radius * Math.sin(phi),
      radius * Math.cos(phi) * Math.sin(theta)
    );
  }

  function addPin(lat, lon, label) {
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) return;
    const pos = latLonToVec(lat, lon, R * 1.01);

    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 12), pinMat);
    dot.position.copy(pos);
    globeGroup.add(dot);

    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 12), glowMat);
    glow.position.copy(pos);
    globeGroup.add(glow);

    // a slightly larger invisible hit area so pins are easy to hover
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.copy(pos);
    hit.userData.label = label || '';
    globeGroup.add(hit);

    pins.push({ dot, glow, hit, born: performance.now() });
    updatePinCount();
  }

  function clearPins() {
    pins.forEach((p) => {
      globeGroup.remove(p.dot);
      globeGroup.remove(p.glow);
      globeGroup.remove(p.hit);
    });
    pins.length = 0;
    updatePinCount();
  }

  function updatePinCount() {
    const el = document.getElementById('pin-count');
    if (el) el.textContent = pins.length;
  }

  // ---- interaction ----
  const rotation = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  let dragging = false;
  let last = { x: 0, y: 0 };
  let autoRotate = true;

  // zoom: camera distance from the globe centre
  const MIN_Z = 6.4;   // close enough to skim the surface, never inside it
  const MAX_Z = 24;
  let zoom = 15.5;
  let targetZoom = zoom;
  let pinchStart = 0;
  let pinchStartZoom = 0;

  function setZoom(z) {
    targetZoom = Math.max(MIN_Z, Math.min(MAX_Z, z));
  }

  function touchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  function down(e) {
    if (e.touches && e.touches.length === 2) {
      dragging = false;
      pinchStart = touchDistance(e.touches);
      pinchStartZoom = targetZoom;
      return;
    }
    dragging = true;
    autoRotate = false;
    const p = e.touches ? e.touches[0] : e;
    last = { x: p.clientX, y: p.clientY };
  }

  function move(e) {
    if (e.touches && e.touches.length === 2) {
      if (pinchStart) {
        e.preventDefault();
        const ratio = touchDistance(e.touches) / pinchStart;
        setZoom(pinchStartZoom / ratio);
      }
      return;
    }
    if (!dragging) return;
    const p = e.touches ? e.touches[0] : e;
    // slower rotation when zoomed in, so close-ups stay controllable
    const speed = 0.005 * (zoom / 15.5);
    target.y += (p.clientX - last.x) * speed;
    target.x += (p.clientY - last.y) * speed;
    target.x = Math.max(-1.1, Math.min(1.1, target.x));
    last = { x: p.clientX, y: p.clientY };
  }

  function up() {
    dragging = false;
    pinchStart = 0;
  }

  canvas.addEventListener('mousedown', down);
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
  canvas.addEventListener('touchstart', down, { passive: true });
  canvas.addEventListener('touchmove', move, { passive: false });
  window.addEventListener('touchend', up);

  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      autoRotate = false;
      // normalise: trackpads report small deltas, mice report ~100
      const step = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 50) * 0.02;
      setZoom(targetZoom + step);
    },
    { passive: false }
  );

  canvas.addEventListener('dblclick', () => setZoom(15.5));

  // ---- pin hover tooltip ----
  const tip = document.createElement('div');
  tip.className = 'globe-tip';
  tip.hidden = true;
  stage.appendChild(tip);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoverPointer = null;

  function onHoverMove(e) {
    const rect = canvas.getBoundingClientRect();
    hoverPointer = {
      nx: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      ny: -((e.clientY - rect.top) / rect.height) * 2 + 1,
      lx: e.clientX - rect.left,
      ly: e.clientY - rect.top,
    };
  }

  function onHoverLeave() {
    hoverPointer = null;
    tip.hidden = true;
  }

  canvas.addEventListener('mousemove', onHoverMove);
  canvas.addEventListener('mouseleave', onHoverLeave);

  function updateTooltip() {
    if (!hoverPointer || dragging) {
      tip.hidden = true;
      canvas.style.cursor = '';
      return;
    }
    pointer.set(hoverPointer.nx, hoverPointer.ny);
    raycaster.setFromCamera(pointer, camera);

    // globe first, so we can tell if a pin is hidden behind the planet
    const globeHit = raycaster.intersectObject(earth, false)[0];
    const hitMeshes = pins.map((p) => p.hit);
    const pinHits = raycaster.intersectObjects(hitMeshes, false);

    let found = null;
    for (const h of pinHits) {
      if (!globeHit || h.distance <= globeHit.distance + 0.05) {
        found = h.object.userData.label;
        break;
      }
    }

    if (found) {
      tip.textContent = found;
      tip.style.left = hoverPointer.lx + 'px';
      tip.style.top = hoverPointer.ly + 'px';
      tip.hidden = false;
      canvas.style.cursor = 'pointer';
    } else {
      tip.hidden = true;
      canvas.style.cursor = '';
    }
  }

  function resize() {
    const size = stage.clientWidth;
    if (!size) return;
    renderer.setSize(size, size, false);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  let spin = 0;

  function step() {
    if (autoRotate) spin += 0.0012;

    zoom += (targetZoom - zoom) * 0.1;
    camera.position.z = zoom;

    rotation.x += (target.x - rotation.x) * 0.08;
    rotation.y += (target.y - rotation.y) * 0.08;

    globeGroup.rotation.x = rotation.x;
    globeGroup.rotation.y = rotation.y + spin;
    clouds.rotation.y += 0.0002;

    // keep pins a roughly constant on-screen size as you zoom
    const now = performance.now();
    const pinScale = Math.max(0.4, zoom / 15.5);
    pins.forEach((p) => {
      p.dot.scale.setScalar(pinScale);
      p.glow.scale.setScalar(pinScale * (1 + 0.28 * Math.sin((now - p.born) / 420)));
    });

    updateTooltip();

    renderer.render(scene, camera);
  }

  function animate() {
    requestAnimationFrame(animate);
    step();
  }
  animate();

  return {
    addPin,
    clearPins,
    _debug: {
      step,
      getZoom: () => ({ zoom, targetZoom, cameraZ: camera.position.z, MIN_Z, MAX_Z }),
      setZoom,
      setRotation(x, y) {
        autoRotate = false;
        spin = 0;
        target.x = rotation.x = x;
        target.y = rotation.y = y;
        globeGroup.rotation.set(x, y, 0);
        globeGroup.updateMatrixWorld(true);
      },
      project(lat, lon) {
        const v = latLonToVec(lat, lon, R * 1.01).clone();
        globeGroup.updateMatrixWorld(true);
        v.applyMatrix4(globeGroup.matrixWorld).project(camera);
        const size = stage.clientWidth;
        return {
          x: (v.x * 0.5 + 0.5) * size,
          y: (-v.y * 0.5 + 0.5) * size,
          front: v.z < 1,
        };
      },
    },
  };
})();

// ---- geocoding (OpenStreetMap Nominatim) --------------------------------
async function geocodeCity(city) {
  try {
    const res = await fetch(
      'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' +
        encodeURIComponent(city)
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data) && data[0]) {
      return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
    }
  } catch (e) {
    /* offline or blocked — sign without a pin */
  }
  return null;
}

// ---- guestbook + visitor counter + city pins ----------------------------
(function initGuestbook() {
  const countEl = document.getElementById('visit-count');
  const listEl = document.getElementById('guest-list');
  const emptyEl = document.getElementById('guest-empty');
  const formEl = document.getElementById('guest-form');
  const cityInput = document.getElementById('guest-city');
  const messageInput = document.getElementById('guest-message');
  const submitBtn = document.getElementById('guest-submit');

  const hasFirebase =
    window.FIREBASE_CONFIG && window.FIREBASE_CONFIG.apiKey && window.firebase;

  function renderEntry(entry) {
    emptyEl.hidden = true;
    const li = document.createElement('li');
    li.className = 'guest-item';

    const city = document.createElement('span');
    city.className = 'guest-city';
    city.textContent = (entry.city || 'somewhere').slice(0, 60);
    li.appendChild(city);

    if (entry.message) {
      const msg = document.createElement('span');
      msg.className = 'guest-msg';
      msg.textContent = entry.message.slice(0, 140);
      li.appendChild(msg);
    }

    listEl.prepend(li);

    if (typeof entry.lat === 'number' && typeof entry.lon === 'number') {
      const label = entry.message
        ? `${entry.city} — ${entry.message}`
        : entry.city;
      Globe.addPin(entry.lat, entry.lon, label);
    }
  }

  async function buildEntry() {
    const city = cityInput.value.trim();
    const message = messageInput.value.trim();
    if (!city) return null;

    submitBtn.textContent = '...';
    const entry = { city, message, lat: null, lon: null };
    const coords = await geocodeCity(city);
    if (coords) {
      entry.lat = coords.lat;
      entry.lon = coords.lon;
    }
    submitBtn.textContent = 'sign';
    cityInput.value = '';
    messageInput.value = '';
    return entry;
  }

  function localMode() {
    const ENTRIES_KEY = 'je_guestbook_entries';
    const COUNT_KEY = 'je_visit_count';
    const VISITED_KEY = 'je_visited_session';

    const entries = JSON.parse(localStorage.getItem(ENTRIES_KEY) || '[]');
    let count = parseInt(localStorage.getItem(COUNT_KEY) || '0', 10);

    if (!sessionStorage.getItem(VISITED_KEY)) {
      count += 1;
      localStorage.setItem(COUNT_KEY, String(count));
      sessionStorage.setItem(VISITED_KEY, '1');
    }
    countEl.textContent = count;

    entries.slice().reverse().forEach(renderEntry);

    formEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      const entry = await buildEntry();
      if (!entry) return;
      entries.push(entry);
      localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
      renderEntry(entry);
    });
  }

  function firebaseMode() {
    firebase.initializeApp(window.FIREBASE_CONFIG);
    const db = firebase.firestore();
    const visitsRef = db.collection('meta').doc('visits');
    const guestbookRef = db.collection('guestbook');

    const VISITED_KEY = 'je_visited_session';
    if (!sessionStorage.getItem(VISITED_KEY)) {
      visitsRef
        .set({ count: firebase.firestore.FieldValue.increment(1) }, { merge: true })
        .catch(() => {});
      sessionStorage.setItem(VISITED_KEY, '1');
    }

    visitsRef.onSnapshot(
      (doc) => {
        countEl.textContent = doc.exists ? doc.data().count || 0 : 0;
      },
      () => {
        countEl.textContent = '?';
      }
    );

    guestbookRef
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot(
        (snapshot) => {
          listEl.innerHTML = '';
          listEl.appendChild(emptyEl);
          Globe.clearPins();
          if (snapshot.empty) {
            emptyEl.hidden = false;
            return;
          }
          snapshot.docs.slice().reverse().forEach((doc) => renderEntry(doc.data()));
        },
        () => {
          emptyEl.hidden = false;
          emptyEl.textContent = "couldn't load the guestbook right now";
        }
      );

    formEl.addEventListener('submit', async (e) => {
      e.preventDefault();
      const entry = await buildEntry();
      if (!entry) return;
      guestbookRef
        .add({
          city: entry.city.slice(0, 60),
          message: (entry.message || '').slice(0, 140),
          lat: entry.lat,
          lon: entry.lon,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => {});
    });
  }

  if (hasFirebase) firebaseMode();
  else localMode();
})();
