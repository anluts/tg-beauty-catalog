/**
 * success.js — экран успешной записи (Экран 7)
 */

const SuccessScreen = (() => {

  function render({ booking, service } = {}) {
    return `
      <div class="screen screen-success">
        <div class="success-content">

          <div class="success-icon-wrap">
            <div class="success-icon">✅</div>
          </div>

          <h1 class="success-title">Запись подтверждена!</h1>
          <p class="success-sub">Ждём вас в гости 💖</p>

          <div class="success-card">
            <div class="success-row">
              <span class="success-row__label">Услуга</span>
              <span class="success-row__value">${_esc(booking?.serviceName || service?.name || '—')}</span>
            </div>
            <div class="success-row">
              <span class="success-row__label">Дата</span>
              <span class="success-row__value">${_esc(booking?.dateLabel || '—')}</span>
            </div>
            <div class="success-row">
              <span class="success-row__label">Время</span>
              <span class="success-row__value">${_esc(booking?.time || '—')}</span>
            </div>
            <div class="success-row">
              <span class="success-row__label">Адрес</span>
              <span class="success-row__value">${_esc(MASTER.address)}</span>
            </div>
            ${service ? `
              <div class="success-row">
                <span class="success-row__label">Стоимость</span>
                <span class="success-row__value success-row__value--price">${_fmtPrice(service.price)}</span>
              </div>
            ` : ''}
          </div>

          <p class="success-note">Мастер свяжется с вами для подтверждения</p>

          <button class="btn-outline btn-full" id="btn-to-bookings">
            Мои записи
          </button>

        </div>
      </div>
    `;
  }

  function onEnter({ booking, service } = {}) {
    TG.MainButton.show('Вернуться в каталог', () => {
      App.switchTab('catalog');
    });

    TG.Haptic.notification('success');

    const root = document.getElementById('app-root');
    root.addEventListener('click', _handleClick);
  }

  function onLeave() {
    const root = document.getElementById('app-root');
    root.removeEventListener('click', _handleClick);
  }

  function _handleClick(e) {
    if (e.target.closest('#btn-to-bookings')) {
      App.switchTab('bookings');
    }
  }

  function _fmtPrice(p) {
    return p.toLocaleString('ru-RU') + '\u00a0₽';
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return { render, onEnter, onLeave };
})();
