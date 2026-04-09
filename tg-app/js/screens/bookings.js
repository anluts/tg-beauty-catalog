/**
 * bookings.js — мои записи (вкладка «Записи», Экран 4)
 */

const BookingsScreen = (() => {

  let _activeTab = 'upcoming';

  function render() {
    _activeTab = 'upcoming';
    return _buildHTML();
  }

  function _buildHTML() {
    const upcoming = State.getUpcomingBookings();
    const past = State.getPastBookings();

    return `
      <div class="screen screen-bookings">
        <div class="bookings-header">
          <h1 class="page-title">Мои записи</h1>
          <div class="bookings-tabs">
            <button class="bookings-tab ${_activeTab === 'upcoming' ? 'active' : ''}" data-tab="upcoming">
              Предстоящие ${upcoming.length ? `<span class="tab-badge">${upcoming.length}</span>` : ''}
            </button>
            <button class="bookings-tab ${_activeTab === 'past' ? 'active' : ''}" data-tab="past">
              Прошедшие
            </button>
          </div>
        </div>

        <div class="bookings-content" id="bookings-content">
          ${_activeTab === 'upcoming'
            ? _renderUpcoming(upcoming)
            : _renderPast(past)
          }
        </div>

        <div style="height: 24px"></div>
      </div>
    `;
  }

  function _renderUpcoming(bookings) {
    if (bookings.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">🗓️</div>
          <div class="empty-title">У вас пока нет записей</div>
          <div class="empty-sub">Выберите услугу и запишитесь за 2 минуты</div>
          <button class="btn-primary" id="btn-to-catalog">Перейти в каталог</button>
        </div>
      `;
    }

    return bookings.map(b => {
      const statusClass = { confirmed: 'green', pending: 'yellow', cancelled: 'red' }[b.status] || 'yellow';
      const statusLabel = { confirmed: '🟢 Подтверждено', pending: '🟡 Ожидает', cancelled: '🔴 Отменено' }[b.status] || '🟡 Ожидает';
      return `
        <div class="booking-card" data-id="${b.id}">
          <div class="booking-card__status status-${statusClass}">${statusLabel}</div>
          <div class="booking-card__name">${_esc(b.serviceName)}</div>
          <div class="booking-card__datetime">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            ${_esc(b.dateLabel)} · ${_esc(b.time)}
          </div>
          <div class="booking-card__master">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
            </svg>
            ${_esc(MASTER.name)} · ${_esc(MASTER.address)}
          </div>
          <div class="booking-card__actions">
            <button class="btn-small btn-outline" data-action="reschedule" data-id="${b.id}">Перенести</button>
            <button class="btn-small btn-danger-outline" data-action="cancel" data-id="${b.id}">Отменить</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function _renderPast(bookings) {
    if (bookings.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <div class="empty-title">Нет прошедших записей</div>
          <div class="empty-sub">Они появятся после первого визита</div>
        </div>
      `;
    }

    return bookings.map(b => {
      const hasReview = State.hasReview(b.id);
      return `
        <div class="booking-card booking-card--past" data-id="${b.id}">
          <div class="booking-card__name">${_esc(b.serviceName)}</div>
          <div class="booking-card__datetime">${_esc(b.dateLabel)} · ${_esc(b.time)}</div>
          <div class="booking-card__actions">
            ${!hasReview && b.status !== 'cancelled' ? `
              <button class="btn-small btn-primary" data-action="review" data-id="${b.id}">★ Оставить отзыв</button>
            ` : ''}
            <button class="btn-small btn-outline" data-action="rebook" data-id="${b.id}">↩ Записаться снова</button>
          </div>
        </div>
      `;
    }).join('');
  }

  function onEnter() {
    TG.MainButton.show('Новая запись', () => {
      Router.go('catalog', {}, false);
      App.switchTab('catalog');
    });

    const root = document.getElementById('app-root');
    root.addEventListener('click', _handleClick);
  }

  function onLeave() {
    const root = document.getElementById('app-root');
    root.removeEventListener('click', _handleClick);
  }

  function _handleClick(e) {
    // Переключение вкладок
    const tab = e.target.closest('.bookings-tab');
    if (tab) {
      _activeTab = tab.dataset.tab;
      document.querySelectorAll('.bookings-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === _activeTab);
      });
      const content = document.getElementById('bookings-content');
      if (content) {
        const upcoming = State.getUpcomingBookings();
        const past = State.getPastBookings();
        content.innerHTML = _activeTab === 'upcoming'
          ? _renderUpcoming(upcoming)
          : _renderPast(past);
      }
      TG.Haptic.selection();
      return;
    }

    // Перейти в каталог
    if (e.target.closest('#btn-to-catalog')) {
      App.switchTab('catalog');
      return;
    }

    // Действия с записями
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === 'cancel') {
      TG.showConfirm('Отменить запись?', confirmed => {
        if (confirmed) {
          State.cancelBooking(id);
          _refreshContent();
          TG.Haptic.notification('success');
        }
      });
    } else if (action === 'reschedule') {
      const booking = State.getBookings().find(b => b.id === id);
      if (booking) {
        State.startWizard(booking.serviceId);
        Router.go('wizard', { step: 1 }, true);
      }
    } else if (action === 'rebook') {
      const booking = State.getBookings().find(b => b.id === id);
      if (booking) {
        const service = SERVICES.find(s => s.id === booking.serviceId);
        if (service) {
          State.setSelectedService(service);
          State.startWizard(service.id);
          Router.go('wizard', { step: 1 }, true);
        }
      }
    } else if (action === 'review') {
      const booking = State.getBookings().find(b => b.id === id);
      if (booking) {
        State.markReviewed(id);
        TG.showAlert('Спасибо за отзыв! 💖');
        _refreshContent();
      }
    }
  }

  function _refreshContent() {
    const content = document.getElementById('bookings-content');
    if (!content) return;
    const upcoming = State.getUpcomingBookings();
    const past = State.getPastBookings();
    content.innerHTML = _activeTab === 'upcoming'
      ? _renderUpcoming(upcoming)
      : _renderPast(past);
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return { render, onEnter, onLeave };
})();
