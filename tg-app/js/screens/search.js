/**
 * search.js — экран поиска (Экран 6)
 */

const SearchScreen = (() => {

  const POPULAR_TAGS = ['Маникюр', 'Педикюр', 'Брови', 'Дизайн', 'Наращивание'];

  function render({ query = '' } = {}) {
    const results = query ? _search(query) : [];

    return `
      <div class="screen screen-search">
        <div class="search-header">
          <div class="search-input-wrap">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="search"
              id="search-input"
              class="search-input"
              placeholder="Поиск услуг..."
              value="${_esc(query)}"
              autocomplete="off"
              enterkeyhint="search"
            />
            ${query ? `<button class="search-clear" id="search-clear">✕</button>` : ''}
          </div>
        </div>

        ${!query ? `
          <div class="search-tags">
            ${POPULAR_TAGS.map(t => `
              <button class="search-tag" data-tag="${_esc(t)}">${_esc(t)}</button>
            `).join('')}
          </div>
        ` : ''}

        ${query ? `
          <div class="search-results-count">
            ${results.length > 0
              ? `Результаты: ${results.length}`
              : 'Ничего не найдено'
            }
          </div>
        ` : `
          <div class="search-hint">Введите название услуги</div>
        `}

        <div class="services-grid" id="search-grid">
          ${results.map(s => _renderCard(s)).join('')}
        </div>

        ${query && results.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">🔍</div>
            <div class="empty-title">Ничего не найдено</div>
            <div class="empty-sub">Попробуйте другой запрос</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  function _renderCard(s) {
    return `
      <div class="service-card" data-id="${s.id}" role="button" tabindex="0">
        <div class="service-card__photo" style="background:${s.gradient}">
          <span class="service-card__emoji">${s.emoji}</span>
        </div>
        <div class="service-card__body">
          <div class="service-card__name">${_esc(s.name)}</div>
          <div class="service-card__meta">
            <span class="service-card__duration">${s.duration} мин</span>
          </div>
          <div class="service-card__footer">
            <span class="service-card__price">${_fmtPrice(s.price)}</span>
            <span class="service-card__rating">★ ${s.rating.toFixed(1)}</span>
          </div>
        </div>
      </div>
    `;
  }

  function onEnter({ query = '' } = {}) {
    TG.MainButton.hide();

    // Автофокус
    setTimeout(() => {
      const input = document.getElementById('search-input');
      if (input) input.focus();
    }, 150);

    const root = document.getElementById('app-root');
    root.addEventListener('input', _handleInput);
    root.addEventListener('click', _handleClick);
  }

  function onLeave() {
    const root = document.getElementById('app-root');
    root.removeEventListener('input', _handleInput);
    root.removeEventListener('click', _handleClick);
  }

  let _debounceTimer = null;

  function _handleInput(e) {
    if (e.target.id !== 'search-input') return;
    const q = e.target.value.trim();
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      _updateResults(q);
    }, 200);
  }

  function _handleClick(e) {
    // Очистить поиск
    if (e.target.closest('#search-clear')) {
      const input = document.getElementById('search-input');
      if (input) {
        input.value = '';
        input.focus();
        _updateResults('');
      }
      return;
    }

    // Тег
    const tag = e.target.closest('.search-tag');
    if (tag) {
      const q = tag.dataset.tag;
      const input = document.getElementById('search-input');
      if (input) input.value = q;
      _updateResults(q);
      TG.Haptic.selection();
      return;
    }

    // Карточка
    const card = e.target.closest('.service-card');
    if (card) {
      const id = parseInt(card.dataset.id, 10);
      const service = SERVICES.find(s => s.id === id);
      if (service) {
        State.setSelectedService(service);
        Router.go('service', { service }, true);
        TG.Haptic.impact('light');
      }
    }
  }

  function _updateResults(q) {
    const grid = document.getElementById('search-grid');
    const results = q ? _search(q) : [];

    // Обновляем кнопку очистки
    const clearBtn = document.querySelector('.search-clear');
    const inputWrap = document.querySelector('.search-input-wrap');
    if (q && !clearBtn && inputWrap) {
      const btn = document.createElement('button');
      btn.className = 'search-clear';
      btn.id = 'search-clear';
      btn.textContent = '✕';
      inputWrap.appendChild(btn);
    } else if (!q && clearBtn) {
      clearBtn.remove();
    }

    // Обновляем счётчик
    let countEl = document.querySelector('.search-results-count');
    let hintEl = document.querySelector('.search-hint');
    let tagsEl = document.querySelector('.search-tags');

    if (q) {
      if (tagsEl) tagsEl.style.display = 'none';
      if (hintEl) hintEl.style.display = 'none';
      if (!countEl) {
        countEl = document.createElement('div');
        countEl.className = 'search-results-count';
        grid.parentNode.insertBefore(countEl, grid);
      }
      countEl.textContent = results.length > 0 ? `Результаты: ${results.length}` : 'Ничего не найдено';
    } else {
      if (tagsEl) tagsEl.style.display = '';
      if (hintEl) hintEl.style.display = '';
      if (countEl) countEl.remove();
    }

    if (grid) {
      grid.innerHTML = results.map(s => _renderCard(s)).join('');
    }
  }

  function _search(q) {
    const lower = q.toLowerCase();
    return SERVICES.filter(s =>
      s.name.toLowerCase().includes(lower) ||
      s.shortDesc.toLowerCase().includes(lower) ||
      s.description.toLowerCase().includes(lower)
    );
  }

  function _fmtPrice(p) {
    return p.toLocaleString('ru-RU') + '\u00a0₽';
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { render, onEnter, onLeave };
})();
