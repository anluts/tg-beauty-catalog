/**
 * catalog.js — экран каталога (вкладка «Каталог»)
 */

const CatalogScreen = (() => {

  function render() {
    const user = TG.getUser();
    const filter = State.getCatalogFilter();
    const services = _getFiltered(filter);

    return `
      <div class="screen screen-catalog">
        <div class="catalog-header">
          <div class="greeting">Привет, ${_esc(user.firstName)}!</div>
          <button class="search-bar" id="search-bar-btn" aria-label="Поиск услуг">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <span>Поиск услуг...</span>
          </button>
        </div>

        <div class="categories-scroll" id="categories-scroll">
          <div class="categories-inner">
            ${CATEGORIES.map(cat => `
              <button
                class="category-chip ${cat.id === filter ? 'active' : ''}"
                data-cat="${cat.id}"
              >${cat.label}</button>
            `).join('')}
          </div>
        </div>

        <div class="services-grid" id="services-grid">
          ${services.length > 0
            ? services.map(s => _renderCard(s)).join('')
            : `<div class="empty-state">
                <div class="empty-icon">🔍</div>
                <div class="empty-title">Ничего не найдено</div>
                <div class="empty-sub">Попробуйте выбрать другую категорию</div>
               </div>`
          }
        </div>
      </div>
    `;
  }

  function _renderCard(s) {
    const stars = _renderStars(s.rating);
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
            <span class="service-card__rating">${stars} ${s.rating.toFixed(1)}</span>
          </div>
        </div>
      </div>
    `;
  }

  function onEnter() {
    TG.MainButton.hide();

    // Делегируем события через event delegation на app-root
    const root = document.getElementById('app-root');

    root.addEventListener('click', _handleClick);
    root.addEventListener('keydown', _handleKeydown);
  }

  function onLeave() {
    const root = document.getElementById('app-root');
    root.removeEventListener('click', _handleClick);
    root.removeEventListener('keydown', _handleKeydown);
  }

  function _handleClick(e) {
    // Поиск
    if (e.target.closest('#search-bar-btn')) {
      Router.go('search', {}, true);
      return;
    }
    // Фильтр
    const chip = e.target.closest('.category-chip');
    if (chip) {
      const cat = chip.dataset.cat;
      State.setCatalogFilter(cat);
      // Перерисовываем только грид и чипы
      _refreshGrid();
      _refreshChips(cat);
      TG.Haptic.selection();
      return;
    }
    // Карточка услуги
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

  function _handleKeydown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      const card = e.target.closest('.service-card');
      if (card) card.click();
    }
  }

  function _refreshGrid() {
    const grid = document.getElementById('services-grid');
    if (!grid) return;
    const services = _getFiltered(State.getCatalogFilter());
    if (services.length > 0) {
      grid.innerHTML = services.map(s => _renderCard(s)).join('');
    } else {
      grid.innerHTML = `<div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">Ничего не найдено</div>
        <div class="empty-sub">Попробуйте выбрать другую категорию</div>
      </div>`;
    }
  }

  function _refreshChips(activeId) {
    document.querySelectorAll('.category-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.cat === activeId);
    });
  }

  function _getFiltered(filter) {
    if (filter === 'all') return SERVICES;
    return SERVICES.filter(s => s.category === filter);
  }

  function _fmtPrice(p) {
    return p.toLocaleString('ru-RU') + '\u00a0₽';
  }

  function _renderStars(rating) {
    return '★';
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
