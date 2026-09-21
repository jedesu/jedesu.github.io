// ---- ascii-art portrait -------------------------------------------------
(function loadPortrait() {
  const el = document.getElementById('ascii-portrait');
  if (!el) return;
  fetch('assets/portrait.txt')
    .then((r) => (r.ok ? r.text() : Promise.reject()))
    .then((t) => {
      el.textContent = t.replace(/\s+$/, '');
    })
    .catch(() => {
      el.remove();
    });
})();

// ---- content config ---------------------------------------------------
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

// ---- voxel globe ---------------------------------------------------------
// One block per surface cell, coloured from a real satellite map and pushed
// outward by a real elevation map. Both are sampled once at build time.
const Globe = (function initGlobe() {
  const canvas = document.getElementById('globe');
  const stage = canvas.parentElement;

  // swap these for higher-res maps any time; the cartoon map is the fallback
  const TERRAIN = {
    color: 'assets/earth-color.jpg',
    height: 'assets/earth-height.jpg',
    fallback: 'assets/earth-cartoon.png',
  };

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 1000);
  camera.position.z = 15.5;

  const R = 5;
  const ACCENT = 0xd2601a;
  const ROWS = 96;                    // latitude bands of blocks
  const CUBE = (Math.PI * R) / ROWS;  // one block edge, sized to fit the grid
  const LEVELS = 7;                   // how many discrete height steps on land
  const STEP = CUBE * 0.42;           // how far one step lifts a block

  const globeGroup = new THREE.Group();
  scene.add(globeGroup);

  // an invisible smooth sphere at sea level: cheap raycast target, and the
  // occlusion test that says whether a pin is on the near side of the planet
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(R - CUBE, 32, 32),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  globeGroup.add(earth);

  // soft rim so the blocky silhouette doesn't cut too hard against the page
  scene.add(
    new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.13, 40, 40),
      new THREE.MeshBasicMaterial({
        color: 0xbfe0f2,
        transparent: true,
        opacity: 0.18,
        side: THREE.BackSide,
      })
    )
  );

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xffffff, 0.75);
  sun.position.set(3, 3.2, 4);
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xcfe3ff, 0.24);
  fill.position.set(-4, -2, -3);
  scene.add(fill);

  function latLonToVec(lat, lon, radius) {
    const phi = (lat * Math.PI) / 180;
    const theta = ((lon - 180) * Math.PI) / 180;
    return new THREE.Vector3(
      -radius * Math.cos(phi) * Math.cos(theta),
      radius * Math.sin(phi),
      radius * Math.cos(phi) * Math.sin(theta)
    );
  }

  // ---- palette -------------------------------------------------------------
  // satellite colour is muddy when you just copy it, so every block snaps to
  // the nearest of these. This is what makes it read as a game and not a photo.
  const LAND_PALETTE = [
    0x3f6b2b, // dark forest
    0x5a8f3a, // forest
    0x7faa4b, // grass
    0x9fb457, // steppe
    0xc2b177, // dry grass
    0xd9c489, // sand
    0xe8d9a8, // pale desert
    0x8d7f6d, // rock
    0x6e6358, // dark rock
    0xb8b0a4, // scree
    0xe9edf0, // snow
  ];
  const OCEAN_PALETTE = [
    0x0f2f6b, // abyss
    0x16418f, // deep
    0x1d5cbd, // ocean
    0x2f79d6, // shelf
    0x54a0e6, // shallow
  ];

  function nearest(palette, r, g, b) {
    let best = palette[0];
    let bestD = Infinity;
    for (let i = 0; i < palette.length; i++) {
      const c = palette[i];
      // weighted to match how the eye reads the difference
      const dr = ((c >> 16) & 255) - r;
      const dg = ((c >> 8) & 255) - g;
      const db = (c & 255) - b;
      const d = dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11;
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  // ---- voxel planet --------------------------------------------------------
  let voxels = null;
  let count = 0;
  let normals, radii, quats, delays;

  const _v = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();
  const _m = new THREE.Matrix4();
  const UP = new THREE.Vector3(0, 1, 0);

  function buildPlanet(sample) {
    const cells = [];

    for (let row = 0; row < ROWS; row++) {
      const theta = ((row + 0.5) / ROWS) * Math.PI; // 0 at the north pole
      const lat = 90 - (theta * 180) / Math.PI;
      const cols = Math.max(1, Math.round(2 * ROWS * Math.sin(theta)));

      for (let col = 0; col < cols; col++) {
        const lon = ((col + 0.5) / cols) * 360 - 180;
        cells.push(sample(lat, lon));
      }
    }

    count = cells.length;
    normals = new Float32Array(count * 3);
    radii = new Float32Array(count);
    quats = new Float32Array(count * 4);
    delays = new Float32Array(count);

    // a box deeper than it is wide, so a terrace shows a real side wall
    const geo = new THREE.BoxGeometry(CUBE, CUBE * 2.2, CUBE);
    geo.translate(0, -CUBE * 1.1, 0); // anchor the TOP face at the origin
    // three r128 only forwards instanceColor when the material has vertexColors
    // on, which in turn needs a colour attribute to exist: white, so the
    // per-instance colour passes through unchanged
    const verts = geo.attributes.position.count;
    geo.setAttribute(
      'color',
      new THREE.BufferAttribute(new Float32Array(verts * 3).fill(1), 3)
    );

    voxels = new THREE.InstancedMesh(
      geo,
      new THREE.MeshLambertMaterial({ vertexColors: true }),
      count
    );
    voxels.frustumCulled = false;
    globeGroup.add(voxels);

    const colour = new THREE.Color();

    cells.forEach((cell, i) => {
      const n = latLonToVec(cell.lat, cell.lon, 1);
      normals[i * 3] = n.x;
      normals[i * 3 + 1] = n.y;
      normals[i * 3 + 2] = n.z;
      radii[i] = R + cell.level * STEP;

      _q.setFromUnitVectors(UP, n);
      quats[i * 4] = _q.x;
      quats[i * 4 + 1] = _q.y;
      quats[i * 4 + 2] = _q.z;
      quats[i * 4 + 3] = _q.w;

      // build from the north pole downward, scattered so the leading edge of
      // the wave isn't a clean line
      delays[i] = (0.5 - n.y * 0.5) * 0.62 + Math.random() * 0.1;

      // slight per-block brightness variation keeps big flat regions alive
      colour.setHex(cell.color).multiplyScalar(0.92 + Math.random() * 0.16);
      voxels.setColorAt(i, colour);
    });

    voxels.instanceColor.needsUpdate = true;
    writeMatrices(0);
  }

  // ---- click ripples -------------------------------------------------------
  const ripples = [];
  const RIPPLE_LIFE = 1500; // ms

  function addRipple(localPoint) {
    ripples.push({ dir: localPoint.clone().normalize(), start: performance.now() });
    if (ripples.length > 4) ripples.shift();
  }

  // extra height a block gets from whatever ripples are currently running
  function rippleLift(nx, ny, nz, now) {
    let lift = 0;
    for (let k = 0; k < ripples.length; k++) {
      const rp = ripples[k];
      const age = (now - rp.start) / RIPPLE_LIFE;
      if (age >= 1) continue;
      const d = rp.dir;
      const dot = Math.max(-1, Math.min(1, nx * d.x + ny * d.y + nz * d.z));
      const ang = Math.acos(dot);
      // a ring travelling outward from the click, fading as it widens
      const band = (ang - age * 2.1) / 0.22;
      lift += Math.exp(-band * band) * (1 - age) * 0.9;
    }
    return lift;
  }

  let introStart = 0;
  const INTRO_LIFE = 1400;

  function easeBack(t) {
    const c = 1.70158;
    const p = t - 1;
    return 1 + (c + 1) * p * p * p + c * p * p;
  }

  // returns true once nothing is animating and we can stop rewriting matrices
  function writeMatrices(now) {
    if (!voxels) return false;
    const intro = introStart ? (now - introStart) / INTRO_LIFE : 0;
    const building = intro < 1.35;
    const rippling = ripples.length > 0;

    for (let i = 0; i < count; i++) {
      const nx = normals[i * 3];
      const ny = normals[i * 3 + 1];
      const nz = normals[i * 3 + 2];

      let grow = 1;
      if (building) {
        const t = Math.max(0, Math.min(1, (intro - delays[i]) / 0.45));
        grow = t <= 0 ? 0 : easeBack(t);
      }

      const lift = rippling ? rippleLift(nx, ny, nz, now) * STEP * 3 : 0;
      // blocks fly out from the middle of the planet as they pop in
      const r = (radii[i] + lift) * (0.34 + 0.66 * Math.min(1, grow));

      _v.set(nx * r, ny * r, nz * r);
      _q.set(quats[i * 4], quats[i * 4 + 1], quats[i * 4 + 2], quats[i * 4 + 3]);
      _s.setScalar(Math.max(0.001, Math.min(1, grow)));
      _m.compose(_v, _q, _s);
      voxels.setMatrixAt(i, _m);
    }

    voxels.instanceMatrix.needsUpdate = true;
    return !building && !rippling;
  }

  // ---- drifting voxel clouds ----------------------------------------------
  const cloudGroup = new THREE.Group();
  globeGroup.add(cloudGroup);

  (function buildClouds() {
    const blocks = [];
    for (let c = 0; c < 16; c++) {
      const lat = (Math.random() - 0.5) * 150;
      const lon = Math.random() * 360 - 180;
      const size = 2 + Math.floor(Math.random() * 4);
      for (let b = 0; b < size; b++) {
        blocks.push({
          lat: lat + (Math.random() - 0.5) * 7,
          lon: lon + (Math.random() - 0.5) * 13,
          scale: 0.8 + Math.random() * 0.9,
        });
      }
    }

    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(CUBE * 2.2, CUBE * 1.1, CUBE * 2.2),
      new THREE.MeshLambertMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
      }),
      blocks.length
    );
    mesh.frustumCulled = false;

    blocks.forEach((b, i) => {
      const n = latLonToVec(b.lat, b.lon, 1);
      _v.copy(n).multiplyScalar(R * 1.15);
      _q.setFromUnitVectors(UP, n);
      _s.set(b.scale, 1, b.scale);
      _m.compose(_v, _q, _s);
      mesh.setMatrixAt(i, _m);
    });

    cloudGroup.add(mesh);
  })();

  // ---- pins ----------------------------------------------------------------
  const postMat = new THREE.MeshLambertMaterial({ color: 0x4a3a2c });
  const headMat = new THREE.MeshLambertMaterial({ color: ACCENT });
  const glowMat = new THREE.MeshBasicMaterial({
    color: ACCENT,
    transparent: true,
    opacity: 0.22,
  });
  const postGeo = new THREE.BoxGeometry(CUBE * 0.34, CUBE * 3, CUBE * 0.34);
  const headGeo = new THREE.BoxGeometry(CUBE * 1.2, CUBE * 1.2, CUBE * 1.2);
  const glowGeo = new THREE.BoxGeometry(CUBE * 2.4, CUBE * 2.4, CUBE * 2.4);
  const pins = [];

  function addPin(lat, lon, label) {
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) return;

    const n = latLonToVec(lat, lon, 1);
    // sit the marker on top of whatever terrain height is under it
    const base = R + (heightAt ? heightAt(lat, lon) * STEP : 0) + CUBE * 0.4;

    const group = new THREE.Group();
    group.quaternion.setFromUnitVectors(UP, n);
    group.position.copy(n).multiplyScalar(base);
    globeGroup.add(group);

    const post = new THREE.Mesh(postGeo, postMat);
    post.position.y = CUBE * 1.5;
    group.add(post);

    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = CUBE * 3.5;
    group.add(head);

    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.y = CUBE * 3.5;
    group.add(glow);

    // a generous invisible target so pins stay easy to hover
    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(CUBE * 2.2, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.copy(n).multiplyScalar(base + CUBE * 3.5);
    hit.userData.label = label || '';
    globeGroup.add(hit);

    pins.push({ group, glow, hit, born: performance.now() });
    updatePinCount();
  }

  function clearPins() {
    pins.forEach((p) => {
      globeGroup.remove(p.group);
      globeGroup.remove(p.hit);
    });
    pins.length = 0;
    updatePinCount();
  }

  function updatePinCount() {
    const el = document.getElementById('pin-count');
    if (el) el.textContent = pins.length;
  }

  // ---- interaction ---------------------------------------------------------
  const rotation = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  let dragging = false;
  let last = { x: 0, y: 0 };
  let autoRotate = true;

  // zoom: camera distance from the globe centre
  const MIN_Z = 7;
  const MAX_Z = 24;
  let zoom = 15.5;
  let targetZoom = zoom;
  let pinchStart = 0;
  let pinchStartZoom = 0;
  let pressAt = 0;
  let pressPos = { x: 0, y: 0 };

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
    pressAt = performance.now();
    pressPos = { x: p.clientX, y: p.clientY };
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

  function up(e) {
    // a short press that didn't travel is a tap: poke the planet there
    if (dragging && performance.now() - pressAt < 350) {
      const p = e && e.changedTouches ? e.changedTouches[0] : e;
      if (p && Math.hypot(p.clientX - pressPos.x, p.clientY - pressPos.y) < 6) {
        poke(p.clientX, p.clientY);
      }
    }
    dragging = false;
    pinchStart = 0;
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  function poke(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(earth, false)[0];
    if (!hit) return;
    addRipple(globeGroup.worldToLocal(hit.point.clone()));
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

  // ---- pin hover tooltip ---------------------------------------------------
  const tip = document.createElement('div');
  tip.className = 'globe-tip';
  tip.hidden = true;
  stage.appendChild(tip);

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
  let settled = false;

  function step() {
    const now = performance.now();
    if (autoRotate) spin += 0.0012;

    zoom += (targetZoom - zoom) * 0.1;
    camera.position.z = zoom;

    rotation.x += (target.x - rotation.x) * 0.08;
    rotation.y += (target.y - rotation.y) * 0.08;

    globeGroup.rotation.x = rotation.x;
    globeGroup.rotation.y = rotation.y + spin;

    // clouds drift a little faster than the planet turns
    cloudGroup.rotation.y += 0.0007;

    while (ripples.length && now - ripples[0].start > RIPPLE_LIFE) ripples.shift();

    if (voxels && (!settled || ripples.length)) settled = writeMatrices(now);

    // pins pop in, then their glow breathes
    pins.forEach((p) => {
      const age = (now - p.born) / 420;
      p.group.scale.setScalar(age >= 1 ? 1 : easeBack(Math.max(0.001, age)));
      p.glow.scale.setScalar(1 + 0.24 * Math.sin((now - p.born) / 420));
    });

    updateTooltip();

    renderer.render(scene, camera);
  }

  (function animate() {
    requestAnimationFrame(animate);
    step();
  })();

  // ---- load the maps, then grow the planet out of them ---------------------
  let heightAt = null;

  function readPixels(img) {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    // throws if the page was opened over file:// instead of a server
    return { data: ctx.getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height };
  }

  function load(src) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          resolve(readPixels(img));
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  function makeSampler(map) {
    return (lat, lon) => {
      let u = ((lon - 180) / 360) % 1;
      if (u < 0) u += 1;
      const x = Math.min(map.w - 1, Math.floor(u * map.w));
      const y = Math.min(map.h - 1, Math.floor(((90 - lat) / 180) * map.h));
      const i = (y * map.w + x) * 4;
      return [map.data[i], map.data[i + 1], map.data[i + 2]];
    };
  }

  Promise.all([load(TERRAIN.color), load(TERRAIN.height)]).then(async ([colorMap, heightMap]) => {
    if (!colorMap) colorMap = await load(TERRAIN.fallback);
    if (!colorMap) return; // nothing to build from

    const colorAt = makeSampler(colorMap);
    const rawHeight = heightMap ? makeSampler(heightMap) : null;

    // land/ocean from colour: satellite oceans are strongly blue-dominant
    function isWater(r, g, b) {
      return b > r + 12 && b > g + 6;
    }

    heightAt = (lat, lon) => {
      const [r, g, b] = colorAt(lat, lon);
      const water = isWater(r, g, b);
      if (water) {
        // ocean floor: darker blue reads as deeper
        const lum = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
        return -1 - Math.round((1 - Math.min(1, lum * 2.4)) * 2);
      }
      if (rawHeight) {
        // grayscale 0..255 -> discrete land steps, curved so lowlands stay
        // flat and mountain ranges get the dramatic terracing
        const e = rawHeight(lat, lon)[0] / 255;
        return Math.max(0, Math.round(Math.pow(e, 0.7) * LEVELS));
      }
      // no elevation map: flat land one step above sea level
      return 1;
    };

    buildPlanet((lat, lon) => {
      const [r, g, b] = colorAt(lat, lon);
      const level = heightAt(lat, lon);
      const water = isWater(r, g, b);
      let color = nearest(water ? OCEAN_PALETTE : LAND_PALETTE, r, g, b);
      // anything high enough is snow regardless of what the photo says
      if (!water && level >= LEVELS - 1) color = 0xe9edf0;
      return { lat, lon, level, color };
    });

    introStart = performance.now();
    settled = false;
  });

  return {
    addPin,
    clearPins,
    _debug: {
      step,
      getZoom: () => ({ zoom, targetZoom, cameraZ: camera.position.z, MIN_Z, MAX_Z }),
      setZoom,
      getCount: () => count,
      voxels: () => voxels,
      heightAt: (lat, lon) => (heightAt ? heightAt(lat, lon) : null),
      poke: (lat, lon) => addRipple(latLonToVec(lat, lon, 1)),
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
