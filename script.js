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
