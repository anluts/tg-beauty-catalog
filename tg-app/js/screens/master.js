/**
 * master.js — профиль мастера (вкладка «Мастер», Экран 3)
 */

const MasterScreen = (() => {

  function render() {
    const m = MASTER;
    // Портфолио: берём первые цвета из услуг
    const portfolioColors = SERVICES.slice(0, 6).map(s => s.gradient);

    return `
      <div class="screen screen-master">

        <!-- Шапка мастера -->
        <div class="master-hero">
          <div class="master-avatar" style="background:${m.gradient}">${m.initials}</div>
          <h1 class="master-name">${_esc(m.name)}</h1>
          <div class="master-specialty">${_esc(m.specialty)} · ${_esc(m.city)}</div>
          <div class="master-stats">
            <span>★ ${m.rating.toFixed(1)}</span>
            <span class="stat-sep">·</span>
            <span>${m.reviewsCount} отзывов</span>
            <span class="stat-sep">·</span>
            <span>${m.experience} лет опыта</span>
          </div>
        </div>

        <!-- Bio -->
        <div class="master-section">
          <p class="master-bio">${_esc(m.bio)}</p>
        </div>

        <!-- Мои работы -->
        <div class="master-section">
          <div class="section-title">Мои работы</div>
          <div class="portfolio-scroll">
            ${portfolioColors.map((grad, i) => `
              <div class="portfolio-thumb" style="background:${grad}" data-idx="${i}">
                <span class="portfolio-thumb__emoji">${SERVICES[i]?.emoji || '💅'}</span>
              </div>
            `).join('')}
          </div>
          <button class="btn-link" id="btn-all-works">Смотреть все работы →</button>
        </div>

        <!-- Адрес и часы -->
        <div class="master-section">
          <div class="master-info-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            <span>${_esc(m.address)}</span>
          </div>
          ${m.metro ? `
            <div class="master-info-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 20h16M6 4l6 12 6-12M4 4h16"/>
              </svg>
              <span>${_esc(m.metro)}</span>
            </div>
          ` : ''}
          <div class="master-info-row">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
            </svg>
            <span>${_esc(m.hours)}</span>
          </div>
        </div>

        <!-- Кнопка написать -->
        <div class="master-section">
          <button class="btn-outline btn-full" id="btn-message-master">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
            Написать мастеру
          </button>
        </div>

        <!-- Кнопка поделиться -->
        <button class="share-btn" id="btn-share">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          Поделиться с другом
        </button>

        <!-- Отступ для MainButton -->
        <div style="height: 24px"></div>
      </div>
    `;
  }

  function onEnter() {
    TG.MainButton.show('Записаться', () => {
      State.startWizard(null);
      Router.go('wizard', { step: 1 }, true);
    });

    const root = document.getElementById('app-root');
    root.addEventListener('click', _handleClick);
  }

  function onLeave() {
    const root = document.getElementById('app-root');
    root.removeEventListener('click', _handleClick);
  }

  function _handleClick(e) {
    if (e.target.closest('#btn-message-master')) {
      TG.openTelegramLink(`https://t.me/${MASTER.telegram}`);
      return;
    }
    if (e.target.closest('#btn-all-works')) {
      Router.go('portfolio', {}, true);
      return;
    }
    if (e.target.closest('#btn-share')) {
      TG.Haptic.selection();
      if (window.Telegram?.WebApp?.switchInlineQuery !== undefined) {
        window.Telegram.WebApp.switchInlineQuery('', ['users', 'groups', 'channels']);
      } else {
        // Fallback: открываем бота чтобы поделиться ссылкой
        TG.openTelegramLink('https://t.me/share/url?url=https://t.me/oz_beauty_bot/app&text=Записывайся к мастеру красоты онлайн 💅');
      }
      return;
    }
    // Тап по миниатюре портфолио → lightbox (упрощённо: открываем portfolio)
    if (e.target.closest('.portfolio-thumb')) {
      Router.go('portfolio', {}, true);
    }
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return { render, onEnter, onLeave };
})();
