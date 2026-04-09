/**
 * onboarding.js — экран приветствия при первом открытии
 * Показывается один раз, запоминается в localStorage.
 */

const Onboarding = (() => {
  const STORAGE_KEY = 'onboarding_done_v1';

  function _wasDone() {
    return localStorage.getItem(STORAGE_KEY) === '1';
  }

  function _markDone() {
    localStorage.setItem(STORAGE_KEY, '1');
  }

  // Возвращает true если онбординг нужно показать
  function shouldShow() {
    return !_wasDone();
  }

  function show(onDone) {
    const user = TG.getUser();
    const name = user.firstName || 'друг';

    const overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.className = 'onboarding-overlay';
    overlay.innerHTML = `
      <div class="onboarding-card">
        <div class="onboarding-avatar">💅</div>
        <div class="onboarding-title">Привет, ${_esc(name)}!</div>
        <div class="onboarding-subtitle">Здесь можно:</div>
        <ul class="onboarding-list">
          <li>
            <span class="onboarding-list__icon">🗂</span>
            <span>Смотреть услуги с ценами и примерами работ</span>
          </li>
          <li>
            <span class="onboarding-list__icon">📅</span>
            <span>Записаться онлайн в несколько касаний</span>
          </li>
          <li>
            <span class="onboarding-list__icon">🔔</span>
            <span>Получать напоминания о записи</span>
          </li>
        </ul>
        <button class="onboarding-btn" id="onboarding-start-btn">Начать</button>
      </div>
    `;

    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.add('onboarding-overlay--visible');
      });
    });

    document.getElementById('onboarding-start-btn').addEventListener('click', () => {
      TG.Haptic.notification('success');
      _close(overlay, onDone);
    });

    _markDone();
  }

  function _close(overlay, onDone) {
    overlay.classList.remove('onboarding-overlay--visible');
    overlay.classList.add('onboarding-overlay--hiding');
    setTimeout(() => {
      overlay.remove();
      if (typeof onDone === 'function') onDone();
    }, 350);
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { shouldShow, show };
})();
