/**
 * app.js — точка входа, инициализация приложения
 * Регистрирует экраны, запускает роутер, рисует таб-бар.
 */

const App = (() => {

  // ─── Инициализация ─────────────────────────────────────────────────────────
  async function init() {
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

    // 4. Авторизация через бэкенд (получаем JWT, загружаем данные мастера)
    const authOk = await API.init();

    if (authOk) {
      // Загружаем реальные данные из БД
      const data = await API.loadMasterData();
      if (data) {
        // Перезаписываем глобальные переменные реальными данными
        _applyMasterData(data.master, data.services);
      }
    }
    // Если authOk = false — работаем со статичными данными из data.js (demo)

    // 5. Показываем стартовый экран
    switchTab('catalog');

    // 6. Онбординг при первом открытии, потом оффер
    if (Onboarding.shouldShow()) {
      Onboarding.show(() => {
        setTimeout(() => Offer.show(), 400);
      });
    } else {
      setTimeout(() => Offer.show(), 600);
    }
  }

  // ─── Применяем данные из API к глобальным переменным ──────────────────────
  // MASTER и SERVICES объявлены в data.js и используются экранами.
  // Здесь мы перезаписываем их реальными данными из БД.
  function _applyMasterData(masterFromApi, servicesFromApi) {
    if (!masterFromApi) return;

    // Обновляем объект MASTER (он объявлен в data.js как const — копируем свойства)
    Object.assign(MASTER, {
      name:        masterFromApi.name        || MASTER.name,
      specialty:   masterFromApi.specialty   || MASTER.specialty,
      city:        masterFromApi.city        || MASTER.city,
      bio:         masterFromApi.bio         || MASTER.bio,
      address:     masterFromApi.address     || MASTER.address,
      metro:       masterFromApi.metro       || MASTER.metro,
      hours:       masterFromApi.hours       || MASTER.hours,
      phone:       masterFromApi.phone       || MASTER.phone,
      rating:      masterFromApi.rating      || MASTER.rating,
      reviewsCount: masterFromApi.reviews_count || MASTER.reviewsCount,
      avatar_url:  masterFromApi.avatar_url  || null,
    });

    // Обновляем массив SERVICES
    if (Array.isArray(servicesFromApi) && servicesFromApi.length > 0) {
      // Очищаем и наполняем реальными услугами
      SERVICES.length = 0;
      servicesFromApi.forEach(s => {
        SERVICES.push({
          id:           s.id,
          category:     s.category,
          name:         s.name,
          shortDesc:    s.short_desc || '',
          description:  s.description || '',
          duration:     s.duration,
          price:        s.price,
          rating:       s.rating || 0,
          reviewsCount: s.reviews_count || 0,
          gradient:     s.gradient || 'linear-gradient(135deg, #A78BFA 0%, #EC4899 100%)',
          emoji:        s.emoji || '💅',
          photos:       [], // фото загружаются отдельно по необходимости
          includes:     [],
        });
      });
    }

    console.log(`[App] Loaded master: ${MASTER.name}, services: ${SERVICES.length}`);
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
