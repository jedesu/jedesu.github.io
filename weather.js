// ---- weather effects -------------------------------------------------
// modes: clear, sunny, rain, windy, hurricane
(function weatherSystem() {
  const canvas = document.getElementById('weather-canvas');
  const ctx = canvas.getContext('2d');
  const flashEl = document.getElementById('weather-flash');
  const widget = document.getElementById('weather-widget');
  const buttons = widget.querySelectorAll('.weather-btn');

  let mode = 'clear';
  let hurricaneEngaged = false; // once true, only reload can fully reset the page
  let rafId = null;
  let timers = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function clearTimers() {
    timers.forEach((t) => clearInterval(t));
    timers = [];
  }

  function stopLoop() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
  }

  function setActiveButton() {
    buttons.forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  }

  // ---- audio: a short synthesized thunder crack, no asset needed ----
  let audioCtx = null;
  function thunderCrack() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const duration = 0.9;
      const bufferSize = audioCtx.sampleRate * duration;
      const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2.2);
      }
      const noise = audioCtx.createBufferSource();
      noise.buffer = buffer;
      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(900, audioCtx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(90, audioCtx.currentTime + duration);
      const gain = audioCtx.createGain();
      gain.gain.setValueAtTime(0.35, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      noise.connect(filter).connect(gain).connect(audioCtx.destination);
      noise.start();
    } catch (e) {
      /* audio not available — visual flash still happens */
    }
  }

  function lightningFlash() {
    flashEl.style.transition = 'none';
    flashEl.style.opacity = '0.85';
    requestAnimationFrame(() => {
      flashEl.style.transition = 'opacity 0.5s ease';
      flashEl.style.opacity = '0';
    });
    thunderCrack();
  }

  // ---- rain ----
  function startRain() {
    canvas.style.display = 'block';
    const drops = [];
    const COUNT = 180;
    for (let i = 0; i < COUNT; i++) {
      drops.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        len: 12 + Math.random() * 16,
        speed: 7 + Math.random() * 6,
      });
    }

    function drawCloud() {
      ctx.save();
      ctx.fillStyle = 'rgba(60, 64, 70, 0.5)';
      const cx = canvas.width / 2;
      const y = 26;
      [-90, -40, 0, 45, 95].forEach((dx, i) => {
        ctx.beginPath();
        ctx.ellipse(cx + dx, y + (i % 2 ? 6 : 0), 65, 30, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    }

    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawCloud();
      ctx.strokeStyle = 'rgba(120, 150, 190, 0.55)';
      ctx.lineWidth = 1.4;
      drops.forEach((d) => {
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x - 2, d.y + d.len);
        ctx.stroke();
        d.y += d.speed;
        d.x -= 0.6;
        if (d.y > canvas.height) {
          d.y = -20;
          d.x = Math.random() * canvas.width;
        }
      });
      rafId = requestAnimationFrame(frame);
    }
    frame();

    timers.push(
      setInterval(() => {
        if (Math.random() < 0.55) lightningFlash();
      }, 3200)
    );
  }

  // ---- windy ----
  function startWindy() {
    document.body.classList.add('weather-windy');
    canvas.style.display = 'block';
    const streaks = [];
    const COUNT = 40;
    for (let i = 0; i < COUNT; i++) {
      streaks.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        len: 30 + Math.random() * 70,
        speed: 6 + Math.random() * 10,
      });
    }
    function frame() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = 'rgba(150, 150, 160, 0.35)';
      ctx.lineWidth = 1;
      streaks.forEach((s) => {
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(s.x + s.len, s.y + 4);
        ctx.stroke();
        s.x += s.speed;
        if (s.x > canvas.width + s.len) {
          s.x = -s.len;
          s.y = Math.random() * canvas.height;
        }
      });
      rafId = requestAnimationFrame(frame);
    }
    frame();
  }

  // ---- sunny ----
  function startSunny() {
    document.body.classList.add('weather-sunny');
  }

  // ---- hurricane ----
  // rips the visible text on the page into individual characters, spins them
  // into a vortex that speeds up over time, then lets them fall and pile at
  // the bottom of the screen. only a reload (or the clear button) resets it.
  function shatterText(root) {
    const skip = new Set(['SCRIPT', 'STYLE', 'CANVAS']);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        if (skip.has(node.parentNode.tagName)) return NodeFilter.FILTER_REJECT;
        if (node.parentNode.closest('#weather-widget')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    });

    const textNodes = [];
    let n;
    while ((n = walker.nextNode())) textNodes.push(n);

    const spans = [];
    textNodes.forEach((node) => {
      const frag = document.createDocumentFragment();
      node.nodeValue.split('').forEach((ch) => {
        const span = document.createElement('span');
        span.className = 'hx-char-inline';
        span.style.display = 'inline-block';
        span.textContent = ch === ' ' ? ' ' : ch;
        frag.appendChild(span);
        spans.push(span);
      });
      node.parentNode.replaceChild(frag, node);
    });

    // measure first (layout still intact), then detach into fixed position
    const rects = spans.map((s) => s.getBoundingClientRect());
    const chars = [];
    spans.forEach((span, i) => {
      const r = rects[i];
      if (r.width === 0 && r.height === 0) return;
      span.className = 'hx-char';
      span.style.left = '0';
      span.style.top = '0';
      document.body.appendChild(span);
      chars.push({
        el: span,
        width: r.width,
        height: r.height,
        x: r.left,
        y: r.top,
        angle: Math.random() * Math.PI * 2,
        radius: 60 + Math.random() * Math.max(window.innerWidth, window.innerHeight) * 0.6,
        delay: Math.random() * 1400,
        phase: 'vortex',
        vx: 0,
        vy: 0,
        rot: 0,
        rotSpeed: (Math.random() - 0.5) * 12,
        born: null,
      });
    });
    return chars;
  }

  function startHurricane() {
    hurricaneEngaged = true;
    startWindy(); // reuse wind streaks as the build-up

    setTimeout(() => {
      const chars = shatterText(document.querySelector('.wrap'));
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight * 0.42;
      const floorY = window.innerHeight - 4;
      const bucketCount = 48;
      const bucketWidth = window.innerWidth / bucketCount;
      const pileHeight = new Array(bucketCount).fill(floorY);
      const start = performance.now();
      const VORTEX_DURATION = 5200; // slow -> fast ramp

      function frame(now) {
        let anyActive = false;
        chars.forEach((c) => {
          const t = now - start - c.delay;
          if (t < 0) {
            anyActive = true;
            return;
          }
          if (c.born === null) c.born = now;

          if (c.phase === 'vortex') {
            anyActive = true;
            const elapsed = now - c.born;
            const progress = Math.min(1, elapsed / VORTEX_DURATION);
            // angular speed ramps from slow to fast
            const angularSpeed = 0.015 + progress * progress * 0.34;
            c.angle += angularSpeed;
            c.radius *= 0.986 - progress * 0.01;
            c.x = cx + Math.cos(c.angle) * c.radius;
            c.y = cy + Math.sin(c.angle) * c.radius * 0.7;
            c.rot += c.rotSpeed * (0.3 + progress);

            if (progress >= 1 || c.radius < 22) {
              c.phase = 'falling';
              c.vx = (Math.random() - 0.5) * 6;
              c.vy = Math.random() * 2;
            }
          } else if (c.phase === 'falling') {
            anyActive = true;
            c.vy += 0.55; // gravity
            c.x += c.vx;
            c.y += c.vy;
            c.rot += c.rotSpeed;

            const bucket = Math.min(
              bucketCount - 1,
              Math.max(0, Math.floor(c.x / bucketWidth))
            );
            const floor = pileHeight[bucket] - c.height;
            if (c.y >= floor) {
              c.y = floor;
              c.phase = 'settled';
              pileHeight[bucket] -= c.height;
            }
          }

          c.el.style.transform =
            'translate(' + (c.x - c.width / 2) + 'px,' + c.y + 'px) rotate(' + c.rot + 'deg)';
        });

        if (anyActive && mode === 'hurricane') {
          rafId = requestAnimationFrame(frame);
        }
      }
      rafId = requestAnimationFrame(frame);
    }, 1800);
  }

  function stopEffects() {
    stopLoop();
    clearTimers();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.display = 'none';
    document.body.classList.remove('weather-windy', 'weather-sunny');
    flashEl.style.opacity = '0';
  }

  function setMode(next) {
    if (hurricaneEngaged) {
      // the page has been torn apart — only a reload can honestly reset it
      window.location.reload();
      return;
    }
    stopEffects();
    mode = next;
    setActiveButton();
    if (mode === 'sunny') startSunny();
    else if (mode === 'rain') startRain();
    else if (mode === 'windy') startWindy();
    else if (mode === 'hurricane') startHurricane();
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
  });
})();
