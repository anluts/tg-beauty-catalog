/**
 * offer.js — экран-оффер при первом открытии
 * Показывается один раз, запоминается в localStorage.
 */

const Offer = (() => {
  const STORAGE_KEY = 'offer_shown_v1';

  function _wasShown() {
    return localStorage.getItem(STORAGE_KEY) === '1';
  }

  function _markShown() {
    localStorage.setItem(STORAGE_KEY, '1');
  }

  function show() {
    if (_wasShown()) return;

    const overlay = document.createElement('div');
    overlay.id = 'offer-overlay';
    overlay.className = 'offer-overlay';
    overlay.innerHTML = `
      <div class="offer-card" id="offer-card">
        <div class="offer-emoji">🎁</div>
        <div class="offer-title">Скидка 15% на первую запись</div>
        <div class="offer-subtitle">Подпишитесь на бота —<br>получите промокод в личное сообщение</div>
        <ul class="offer-bullets">
          <li>Напомним о записи за день</li>
          <li>Первыми узнаёте о свободных окошках</li>
          <li>Эксклюзивные акции для подписчиков</li>
        </ul>
        <a class="offer-btn" href="https://t.me/oz_beauty_bot?start=from_app" target="_blank" id="offer-accept-btn">
          Получить скидку 15%
        </a>
        <button class="offer-skip" id="offer-skip-btn">Пропустить</button>
      </div>
    `;

    document.body.appendChild(overlay);

    // Анимация появления
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.add('offer-overlay--visible');
      });
    });

    // Закрыть при клике на кнопку
    document.getElementById('offer-accept-btn').addEventListener('click', () => {
      _close(overlay);
    });

    document.getElementById('offer-skip-btn').addEventListener('click', () => {
      TG.Haptic.selection();
      _close(overlay);
    });

    // Закрыть при клике на фон
    overlay.addEventListener('click', e => {
      if (e.target === overlay) _close(overlay);
    });

    _markShown();
  }

  function _close(overlay) {
    overlay.classList.remove('offer-overlay--visible');
    overlay.classList.add('offer-overlay--hiding');
    setTimeout(() => overlay.remove(), 300);
  }

  return { show };
})();
