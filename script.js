// ---------------------------------------------------------------------------
// Julianne's site: one clean page, with a little motion.
//
//   - the ascii portrait decodes itself when the page loads, and a blue copy
//     of it shows through in a circle around the cursor
//   - the name's letters rise in one after another
//   - each section fades up as it scrolls into view
//
// Anyone who has asked their device for reduced motion gets the page still.
// ---------------------------------------------------------------------------

const quiet = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---- the portrait ----------------------------------------------------------
const card = document.getElementById('portrait-card');
const portrait = document.getElementById('portrait');
const glow = document.getElementById('portrait-glow');
const NOISE = '.:-=+*#%@';
let art = '';
let cols = 0;

// size both copies so the widest line exactly fills the card
const ruler = document.createElement('canvas').getContext('2d');
function fit() {
  if (!cols) return;
  ruler.font = '100px "JetBrains Mono"';
  const perChar = ruler.measureText('M').width / 100;
  const size = (portrait.clientWidth / (cols * perChar)) * 0.995 + 'px';
  portrait.style.fontSize = size;
  glow.style.fontSize = size;
}

// random characters settle into the picture, top rows first
function decode() {
  if (quiet) {
    portrait.textContent = art;
    return;
  }
  const rows = art.split('\n');
  const due = rows.map((row, y) => Array.from(row, () => (y / rows.length) * 0.6 + Math.random() * 0.4));
  const start = performance.now();
  const frame = (now) => {
    const p = Math.min(1, (now - start) / 1400);
    if (p >= 1) {
      portrait.textContent = art;
      return;
    }
    portrait.textContent = rows
      .map((row, y) => {
        let s = '';
        for (let x = 0; x < row.length; x++) {
          const ch = row[x];
          s += ch === ' ' || due[y][x] < p ? ch : NOISE[(Math.random() * NOISE.length) | 0];
        }
        return s;
      })
      .join('\n');
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

fetch('assets/portrait.txt')
  .then((r) => (r.ok ? r.text() : Promise.reject()))
  .then((t) => {
    art = t.replace(/\s+$/, '');
    cols = Math.max(...art.split('\n').map((line) => line.length));
    glow.textContent = art;
    fit();
    decode();
  })
  .catch(() => card.remove());

document.fonts.ready.then(fit);
window.addEventListener('resize', fit);

let dimming = null;
function shine(e) {
  clearTimeout(dimming);
  glow.style.opacity = '1';
  const r = glow.getBoundingClientRect();
  glow.style.setProperty('--mx', e.clientX - r.left + 'px');
  glow.style.setProperty('--my', e.clientY - r.top + 'px');
}
card.addEventListener('pointermove', shine);
card.addEventListener('pointerdown', shine);
card.addEventListener('pointerleave', (e) => {
  if (e.pointerType === 'mouse') {
    glow.style.setProperty('--mx', '-300px');
    glow.style.setProperty('--my', '-300px');
    return;
  }
  // a finger lifted: let the light linger a moment, then fade it out
  dimming = setTimeout(() => {
    glow.style.opacity = '0';
  }, 900);
});

// ---- the name, letter by letter ------------------------------------------
const name = document.getElementById('name');
name.setAttribute('aria-label', name.textContent);
name.innerHTML = Array.from(name.textContent, (c, i) =>
  c === ' ' ? ' ' : '<span aria-hidden="true" style="--i:' + i + '">' + c + '</span>'
).join('');
document.body.classList.add('play');

// ---- sections fade up as they come into view ------------------------------
const sections = document.querySelectorAll('.sec');
if ('IntersectionObserver' in window) {
  const reveal = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        reveal.unobserve(entry.target);
      });
    },
    { threshold: 0.15 }
  );
  sections.forEach((s) => reveal.observe(s));
} else {
  sections.forEach((s) => s.classList.add('in'));
}

// ---- the cursor: a black dot, and a smooth line that trails after it ------
// The line is a chain of points: the first chases the mouse, and each of the
// rest chases the one before it, so the tail curves after the dot and
// shrinks back into it when the mouse stops. Only with a real mouse; on a
// phone or tablet nothing changes.
if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const dot = document.getElementById('cursor-dot');
  const trail = document.getElementById('cursor-trail');
  const pen = trail.getContext('2d');
  const at = { x: -100, y: -100 };
  const LINKS = 22;
  let chain = [];
  let started = false;
  let dpr = 1;

  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    trail.width = innerWidth * dpr;
    trail.height = innerHeight * dpr;
  }
  size();
  window.addEventListener('resize', size);

  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    at.x = e.clientX;
    at.y = e.clientY;
    if (!started) {
      started = true;
      chain = Array.from({ length: LINKS }, () => ({ x: at.x, y: at.y }));
      document.body.classList.add('has-cursor');
      requestAnimationFrame(draw);
    }
    document.body.classList.remove('cursor-away');
    dot.style.transform = 'translate(' + at.x + 'px,' + at.y + 'px)';
    dot.classList.toggle('on-link', !!e.target.closest('a'));
  });
  document.addEventListener('mouseleave', () => document.body.classList.add('cursor-away'));

  function draw() {
    // each point closes part of the gap to the one ahead of it
    let lead = at;
    for (const p of chain) {
      p.x += (lead.x - p.x) * (quiet ? 1 : 0.42);
      p.y += (lead.y - p.y) * (quiet ? 1 : 0.42);
      lead = p;
    }
    pen.setTransform(dpr, 0, 0, dpr, 0, 0);
    pen.clearRect(0, 0, innerWidth, innerHeight);
    pen.lineCap = 'round';
    pen.lineJoin = 'round';
    const pts = [at].concat(chain);
    // join the dot to where the curve begins
    pen.beginPath();
    pen.moveTo(at.x, at.y);
    pen.lineTo((at.x + chain[0].x) / 2, (at.y + chain[0].y) / 2);
    pen.strokeStyle = 'rgb(17,17,20)';
    pen.lineWidth = 5.5;
    pen.stroke();
    // drawn in short pieces so it can taper and fade toward the tail
    for (let i = 1; i < pts.length - 1; i++) {
      const t = i / (pts.length - 1);
      const a = pts[i - 1], b = pts[i], c = pts[i + 1];
      pen.beginPath();
      pen.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2);
      pen.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
      const shade = Math.round(17 + t * t * 220); // solid greys, so overlaps don't bead
      pen.strokeStyle = 'rgb(' + shade + ',' + shade + ',' + (shade + 3) + ')';
      pen.lineWidth = 5 * (1 - t) + 0.5;
      pen.stroke();
    }
    requestAnimationFrame(draw);
  }
}
