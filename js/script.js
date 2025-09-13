document.addEventListener('DOMContentLoaded', async () => {
  const state = {data: null, query: '', activeCat: 'alle'};
  const input = document.getElementById('menu-search');
  const clearBtn = document.getElementById('menu-search-clear');
  const catsEl = document.getElementById('menu-cats');
  const countEl = document.getElementById('menu-result-count');
  const sentinel = document.getElementById('cats-sentinel');


  // Keyboard focus shortcut for search
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      input?.focus();
    }
    if (e.key === 'Escape' && document.activeElement === input) {
      input.value = '';
      state.query = '';
      renderMenu(state);
      input.blur();
    }
  });

  // Sticky shadow for category tabs
  if (sentinel && catsEl) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        catsEl.classList.toggle('stuck', entry.intersectionRatio === 0);
      });
    }, {rootMargin: '-64px 0px 0px 0px', threshold: [0, 1]});
    io.observe(sentinel);
  }


  try {
    state.data = await fetchMenu();
    renderCategoryTabs(state, catsEl);
    renderMenu(state);
  } catch (err) {
    console.error('Fehler beim Laden der Speisekarte:', err);
    const target = document.getElementById('menu');
    if (target) target.innerHTML = '<p>Die Speisekarte konnte nicht geladen werden. Bitte später erneut versuchen.</p>';
  }

  const onInput = debounce(() => {
    state.query = (input.value || '').trim().toLowerCase();
    renderMenu(state);
  }, 120);


  input?.addEventListener('input', onInput);

  clearBtn?.addEventListener('click', () => {
    if (!input) return;
    input.value = '';
    state.query = '';
    renderMenu(state);
    input.focus();
  });


});

async function fetchMenu() {
  const res = await fetch('data/menu.json', {cache: 'no-store'});
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function renderCategoryTabs(state, el) {
  if (!el || !state.data) return;
  el.innerHTML = '';
  const frag = document.createDocumentFragment();
  const allBtn = makeCatButton('Alle', 'alle', state);
  frag.appendChild(allBtn);
  state.data.categories.forEach(c => frag.appendChild(makeCatButton(c.name, c.name, state)));
  el.appendChild(frag);
  setActiveCatButton(el, state.activeCat);
}

function makeCatButton(label, value, state) {
  const a = document.createElement('a');
  a.href = '#speisekarte';
  a.textContent = label;
  a.setAttribute('role', 'tab');
  a.setAttribute('aria-selected', 'false');
  a.setAttribute('tabindex', '-1');
  a.addEventListener('click', (e) => {
    state.activeCat = value;
    const el = document.getElementById('menu-cats');
    setActiveCatButton(el, state.activeCat);
    renderMenu(state);
  });
  return a;
}

function setActiveCatButton(el, value) {
  [...(el?.children || [])].forEach(ch => {
    const isActive = ch.textContent?.toLowerCase() === value.toLowerCase() || (value === 'alle' && ch.textContent === 'Alle');
    ch.classList.toggle('active', isActive);
    ch.setAttribute('aria-selected', String(isActive));
    ch.setAttribute('tabindex', isActive ? '0' : '-1');
  });
}

function renderMenu(state) {
  const target = document.getElementById('menu');
  if (!target || !state.data) return;

  const q = state.query;
  const hasQuery = !!q;
  const active = state.activeCat;

  const frag = document.createDocumentFragment();
  let totalShown = 0;

  state.data.categories.forEach(cat => {
    const catNameNorm = normalize(cat.name);
    const catMatchesQuery = hasQuery && catNameNorm.includes(q);

    // Wenn keine Suche aktiv ist, greift weiterhin der Kategorie-Tab-Filter
    if (!hasQuery && active !== 'alle' && cat.name !== active) return;

    const list = document.createElement('div');
    list.className = 'menu-items';

    const itemsToShow = cat.items.filter(item => {
      if (!hasQuery) return true; // ohne Suche: alle Items der aktiven Kategorie(n)
      if (catMatchesQuery) return true; // Kategorie passt: zeige alle Items der Kategorie
      const nameMatch = normalize(item.name).includes(q);
      const descMatch = normalize(item.desc || '').includes(q);
      return nameMatch || descMatch;
    });

    if (itemsToShow.length === 0) return; // Abschnitt überspringen, wenn nichts passt

    const section = document.createElement('section');
    section.className = 'menu-category';

    const h = document.createElement('h3');
    h.textContent = cat.name;
    section.appendChild(h);

    if (cat.note) {
      const note = document.createElement('p');
      note.className = 'section-lead';
      note.style.marginTop = '0';
      note.textContent = cat.note;
      section.appendChild(note);
    }

    itemsToShow.forEach(item => {
      const row = document.createElement('div');
      row.className = 'menu-item';

      const left = document.createElement('div');
      const title = document.createElement('h4');
      title.textContent = item.name;
      left.appendChild(title);

      if (item.desc) {
        const d = document.createElement('p');
        d.textContent = item.desc;
        left.appendChild(d);
      }

      if (Array.isArray(item.badges) && item.badges.length) {
        const badges = document.createElement('div');
        badges.className = 'badges';
        item.badges.forEach(b => {
          badges.appendChild(renderBadge(b));
        });
        left.appendChild(badges);
      }


      const right = document.createElement('div');
      const price = document.createElement('div');
      price.className = 'price';
      price.textContent = formatPrice(item.price);
      right.appendChild(price);

      row.appendChild(left);
      row.appendChild(right);
      list.appendChild(row);
      totalShown += 1;
    });

    section.appendChild(list);
    frag.appendChild(section);
  });

  target.innerHTML = '';
  if (totalShown === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<strong>Keine Treffer.</strong><br>Bitte anderen Suchbegriff versuchen oder Filter zurücksetzen.';
    target.appendChild(empty);
  } else {
    target.appendChild(frag);
  }
}

function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

function normalize(s) {
  return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}+/gu, '');
}

function formatPrice(value) {
  if (typeof value === 'number') return value.toFixed(2).replace('.', ',') + ' €';
  if (typeof value === 'string') return value; // erlaubt z.B. "ab 7,90 €" oder Varianten
  return '';
}

/* ===== Icon-Badges ===== */
function renderBadge(raw) {
  const text = String(raw || '').trim();
  const key = normalize(text);
  const span = document.createElement('span');
  span.className = 'badge';
  span.setAttribute('title', text);
  span.setAttribute('aria-label', text);

  const type = classifyBadge(key);
  if (!type) {
    // Fallback: unbekannte Badges als Text anzeigen
    span.textContent = text;
    return span;
  }

  span.classList.add('has-icon', `badge--${type}`);
  span.innerHTML = `${getBadgeIcon(type)}<span class="badge-label">${escapeHTML(text)}</span>`;
  return span;
}

function classifyBadge(key) {
  // beliebt
  if (key === 'beliebt' || key.includes('empfohlen') || key.includes('top')) return 'popular';
  // scharf
  if (key.includes('scharf') || key.includes('hot') || key.includes('spicy') || key.includes('leicht scharf')) return 'hot';
  // vegetarisch/vegan
  if (key.includes('vegan')) return 'veg';
  if (key.includes('vegetar')) return 'veg';
  return null;
}

function getBadgeIcon(type) {
  switch (type) {
    case 'popular': // Stern
      return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>`;
    case 'hot': // Chili
      return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M13 3c0 2-1 3-3 4 2 0 4-1 5-3 3 2 6 9 1 14-4 4-10 3-12-1-2-3-1-7 2-9-1 2-1 4 0 5 1 1 3 1 4 0 2-1 3-4 3-6z"/></svg>`;
    case 'veg': // Blatt
      return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor"><path d="M5 21c7 0 14-5 14-14V5h-2C8 5 3 12 3 19v2h2zm0-2c0-5.52 4.48-10 10-10 0 5.52-4.48 10-10 10z"/></svg>`;
    default:
      return '';
  }
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));


}


// Simple image lightbox for modal/media images
function showPopup(src) {
  const popup = document.getElementById('imagePopup');
  if (!popup) return;
  const img = popup.querySelector('img');
  if (img) img.src = src;
  popup.style.display = 'flex';
}

function hidePopup() {
  const popup = document.getElementById('imagePopup');
  if (!popup) return;
  popup.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', async () => {
  const state = { data: null, query: '', activeCat: 'alle' };
  const input = document.getElementById('menu-search');
  const clearBtn = document.getElementById('menu-search-clear');
  const catsEl = document.getElementById('menu-cats');
  const sentinel = document.getElementById('cats-sentinel');

  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      input?.focus();
    }
    if (e.key === 'Escape' && document.activeElement === input) {
      input.value = '';
      state.query = '';
      renderMenu(state);
      input.blur();
    }
  });

  if (sentinel && catsEl) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        catsEl.classList.toggle('stuck', entry.intersectionRatio === 0);
      });
    }, { rootMargin: '-64px 0px 0px 0px', threshold: [0, 1] });
    io.observe(sentinel);
  }

  try {
    state.data = await fetchMenu();
    renderCategoryTabs(state, catsEl);
    renderMenu(state);
  } catch (err) {
    console.error('Fehler beim Laden der Speisekarte:', err);
    const target = document.getElementById('menu');
    if (target) target.innerHTML = '<p>Die Speisekarte konnte nicht geladen werden. Bitte später erneut versuchen.</p>';
  }

  const onInput = debounce(() => {
    state.query = (input.value || '').trim().toLowerCase();
    renderMenu(state);
  }, 120);
  input?.addEventListener('input', onInput);

  clearBtn?.addEventListener('click', () => {
    if (!input) return;
    input.value = '';
    state.query = '';
    renderMenu(state);
    input.focus();
  });

  // Overlay- und Bild-Klick schließt Popup
  const popupEl = document.getElementById('imagePopup');
  if (popupEl) {
    popupEl.addEventListener('click', (e) => {
      if (e.target === popupEl || e.target.tagName === 'IMG') {
        hidePopup();
      }
    });
  }
});

// Escape schließt Popup
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hidePopup();
});

// Delegation für Bilder/Links
document.addEventListener('click', (e) => {
  const anchor = e.target.closest('.mm-figure a, .mm-feature a');
  if (anchor) {
    e.preventDefault();
    let src = anchor.getAttribute('href');
    if (!src) {
      const imgChild = anchor.querySelector('img');
      if (imgChild) src = imgChild.getAttribute('src');
    }
    if (src) showPopup(src);
    return;
  }
  const img = e.target.closest('.mm-figure img, .mm-feature img, .gallery img');
  if (img) {
    e.preventDefault();
    const srcImg = img.getAttribute('src');
    if (srcImg) showPopup(srcImg);
  }
});