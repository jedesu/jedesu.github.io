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

// ---- desktop: draggable icons + draggable windows -------------------------
(function initDesktop() {
  const desktop = document.getElementById('desktop');
  const icons = Array.from(document.querySelectorAll('.desktop-icon'));
  const windows = {};
  document.querySelectorAll('.window').forEach((w) => {
    windows[w.dataset.window] = w;
  });

  let topZ = 10;

  function bringToFront(el) {
    topZ += 1;
    el.style.zIndex = topZ;
  }

  function openWindow(name) {
    const win = windows[name];
    if (!win) return;
    if (win.hidden) {
      win.hidden = false;
      if (!win.dataset.placed) {
        const openCount = document.querySelectorAll('.window:not([hidden])').length - 1;
        win.style.left = Math.min(desktop.clientWidth - 260, 110 + openCount * 24) + 'px';
        win.style.top = 30 + openCount * 24 + 'px';
        win.dataset.placed = '1';
      }
    }
    bringToFront(win);
  }

  function closeWindow(name) {
    const win = windows[name];
    if (win) win.hidden = true;
  }

  // ---- lay icons out in a grid on the left of the screen ----
  const ICON_ROWS = 3;
  icons.forEach((icon, i) => {
    const col = Math.floor(i / ICON_ROWS);
    const row = i % ICON_ROWS;
    icon.style.left = 16 + col * 96 + 'px';
    icon.style.top = 16 + row * 92 + 'px';
  });

  // ---- generic drag helper: distinguishes a click from a drag ----
  function makeDraggable(handle, target, { onClick, clamp } = {}) {
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let origLeft = 0;
    let origTop = 0;

    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = target.getBoundingClientRect();
      const parentRect = target.offsetParent.getBoundingClientRect();
      origLeft = rect.left - parentRect.left;
      origTop = rect.top - parentRect.top;
      handle.setPointerCapture(e.pointerId);
      target.classList.add('dragging');
    });

    handle.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
      let left = origLeft + dx;
      let top = origTop + dy;
      if (clamp) ({ left, top } = clamp(left, top));
      target.style.left = left + 'px';
      target.style.top = top + 'px';
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      target.classList.remove('dragging');
      if (!moved && onClick) onClick();
    }

    handle.addEventListener('pointerup', endDrag);
    handle.addEventListener('pointercancel', endDrag);
  }

  icons.forEach((icon) => {
    makeDraggable(icon, icon, {
      onClick: () => openWindow(icon.dataset.window),
      clamp: (left, top) => ({
        left: Math.max(0, Math.min(left, Math.max(0, desktop.clientWidth - icon.offsetWidth))),
        top: Math.max(0, Math.min(top, Math.max(0, desktop.clientHeight - icon.offsetHeight))),
      }),
    });
  });

  Object.values(windows).forEach((win) => {
    const titlebar = win.querySelector('.window-titlebar');
    const closeBtn = win.querySelector('.window-close');

    makeDraggable(titlebar, win, {
      clamp: (left, top) => ({
        left: Math.max(0, Math.min(left, desktop.clientWidth - 80)),
        top: Math.max(0, Math.min(top, desktop.clientHeight - 40)),
      }),
    });

    win.addEventListener('pointerdown', () => bringToFront(win));
    closeBtn.addEventListener('click', () => closeWindow(win.dataset.window));
  });
})();

// ---- guestbook + visitor counter -----------------------------------------
(function initGuestbook() {
  const countEl = document.getElementById('visit-count');
  const listEl = document.getElementById('guest-list');
  const emptyEl = document.getElementById('guest-empty');
  const formEl = document.getElementById('guest-form');
  const cityInput = document.getElementById('guest-city');
  const messageInput = document.getElementById('guest-message');

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
  }

  function buildEntry() {
    const city = cityInput.value.trim();
    const message = messageInput.value.trim();
    if (!city) return null;
    cityInput.value = '';
    messageInput.value = '';
    return { city, message };
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

    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const entry = buildEntry();
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

    formEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const entry = buildEntry();
      if (!entry) return;
      guestbookRef
        .add({
          city: entry.city.slice(0, 60),
          message: (entry.message || '').slice(0, 140),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        })
        .catch(() => {});
    });
  }

  if (hasFirebase) firebaseMode();
  else localMode();
})();
