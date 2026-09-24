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

function shine(e) {
  const r = glow.getBoundingClientRect();
  glow.style.setProperty('--mx', e.clientX - r.left + 'px');
  glow.style.setProperty('--my', e.clientY - r.top + 'px');
}
card.addEventListener('pointermove', shine);
card.addEventListener('pointerdown', shine);
card.addEventListener('pointerleave', () => {
  glow.style.setProperty('--mx', '-300px');
  glow.style.setProperty('--my', '-300px');
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
