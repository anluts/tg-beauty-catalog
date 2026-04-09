/**
 * app.js — точка входа, инициализация приложения
 * Регистрирует экраны, запускает роутер, рисует таб-бар.
 */

const App = (() => {

  // ─── Инициализация ─────────────────────────────────────────────────────────
  function init() {
    // 1. Инициализируем Telegram WebApp
    TG.init();

    // 2. Регистрируем экраны
    Router.register('catalog',   CatalogScreen);
    Router.register('service',   ServiceScreen);
    Router.register('master',    MasterScreen);
    Router.register('bookings',  BookingsScreen);
    Router.register('wizard',    WizardScreen);
    Router.register('search',    SearchScreen);
    Router.register('success',   SuccessScreen);
    Router.register('portfolio', PortfolioScreen);

    // 3. Рисуем shell (таб-бар + fallback-кнопки)
    _renderShell();

    // 4. Показываем стартовый экран
    switchTab('catalog');

    // 5. Онбординг при первом открытии, потом оффер
    if (Onboarding.shouldShow()) {
      Onboarding.show(() => {
        setTimeout(() => Offer.show(), 400);
      });
    } else {
      setTimeout(() => Offer.show(), 600);
    }
  }

  // ─── Shell (постоянная часть UI) ───────────────────────────────────────────
  function _renderShell() {
    const shell = document.getElementById('app-shell');
    if (!shell) return;

    shell.innerHTML = `
      <!-- Fallback BackButton для браузера -->
      <div class="fallback-back" id="fallback-back-btn" style="display:none;">
        <button class="fallback-back__btn" onclick="Router.back()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
      </div>

      <!-- Основной контент -->
      <div id="app-root" class="app-root"></div>

      <!-- Bottom tab bar -->
      <nav class="tab-bar" id="tab-bar">
        <button class="tab-item active" data-tab="catalog">
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
          </svg>
          <span class="tab-label">Каталог</span>
        </button>
        <button class="tab-item" data-tab="master">
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          <span class="tab-label">Мастер</span>
        </button>
        <button class="tab-item" data-tab="bookings">
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span class="tab-label">Записи</span>
          <span class="tab-badge" id="bookings-badge" style="display:none"></span>
        </button>
      </nav>

      <!-- Fallback MainButton для браузера -->
      <button id="fallback-main-btn" class="fallback-main-btn" style="display:none;"></button>
    `;

    // Навешиваем обработчики таб-бара
    document.getElementById('tab-bar').addEventListener('click', e => {
      const item = e.target.closest('.tab-item');
      if (item) switchTab(item.dataset.tab);
    });

    // Обновляем бейдж записей при изменении
    State.on('bookingsUpdate', _updateBookingsBadge);
    _updateBookingsBadge();
  }

  // ─── Переключение табов ────────────────────────────────────────────────────
  // Вызывается как из таб-бара, так и из кода экранов
  function switchTab(tabName) {
    // Показываем таб-бар только на основных экранах
    const tabScreens = ['catalog', 'master', 'bookings'];
    const isTabScreen = tabScreens.includes(tabName);

    // Подсвечиваем активный таб
    document.querySelectorAll('.tab-item').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === tabName);
    });

    // Таб-бар виден только на табовых экранах
    const tabBar = document.getElementById('tab-bar');
    if (tabBar) tabBar.style.display = isTabScreen ? '' : 'none';

    State.setActiveTab(tabName);
    Router.go(tabName, {}, false); // false = без стека (таб сбрасывает историю)
    TG.Haptic.selection();
  }

  // ─── Бейдж на записях ─────────────────────────────────────────────────────
  function _updateBookingsBadge() {
    const count = State.getUpcomingBookings().length;
    const badge = document.getElementById('bookings-badge');
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }

  // ─── Публичный API ─────────────────────────────────────────────────────────
  return { init, switchTab };
})();

// ─── Запуск ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => App.init());
