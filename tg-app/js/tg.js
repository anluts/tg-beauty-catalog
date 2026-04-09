/**
 * tg.js — обёртка над Telegram WebApp SDK
 * Если приложение открыто вне Telegram — работает с fallback-значениями
 * Это позволяет разрабатывать и тестировать в обычном браузере
 */

const TG = (() => {
  // Ссылка на нативный объект Telegram WebApp (если есть)
  const webApp = window.Telegram?.WebApp || null;

  // ─── Инициализация ─────────────────────────────────────────────────────────
  function init() {
    if (webApp) {
      webApp.ready();       // Сообщаем Telegram, что приложение готово
      webApp.expand();      // Раскрываем на весь экран
    }
    applyTheme();
  }

  // ─── Тема ──────────────────────────────────────────────────────────────────
  // Применяет цвета из themeParams к CSS-переменным
  function applyTheme() {
    const root = document.documentElement;

    if (webApp?.themeParams) {
      const t = webApp.themeParams;
      // Основные цвета (приходят от Telegram)
      if (t.bg_color)            root.style.setProperty('--tg-bg', t.bg_color);
      if (t.secondary_bg_color)  root.style.setProperty('--tg-secondary-bg', t.secondary_bg_color);
      if (t.text_color)          root.style.setProperty('--tg-text', t.text_color);
      if (t.hint_color)          root.style.setProperty('--tg-hint', t.hint_color);
      if (t.link_color)          root.style.setProperty('--tg-link', t.link_color);
      if (t.button_color)        root.style.setProperty('--tg-button', t.button_color);
      if (t.button_text_color)   root.style.setProperty('--tg-button-text', t.button_text_color);
      if (t.section_bg_color)    root.style.setProperty('--tg-card-bg', t.section_bg_color);
    }

    // Тёмная тема: добавляем класс body
    const isDark = webApp?.colorScheme === 'dark'
      || (!webApp && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.body.classList.toggle('theme-dark', isDark);

    // Слушаем смену темы
    if (webApp) {
      webApp.onEvent('themeChanged', applyTheme);
    }
  }

  // ─── Данные пользователя ───────────────────────────────────────────────────
  function getUser() {
    const u = webApp?.initDataUnsafe?.user;
    if (u) {
      return {
        id: u.id,
        firstName: u.first_name || '',
        lastName: u.last_name || '',
        username: u.username || '',
        photoUrl: u.photo_url || null,
      };
    }
    // Fallback для разработки вне Telegram
    return {
      id: 0,
      firstName: 'Александра',
      lastName: '',
      username: '',
      photoUrl: null,
    };
  }

  // ─── MainButton (нижняя кнопка Telegram) ───────────────────────────────────
  const MainButton = {
    _handler: null,

    show(text, onClick, options = {}) {
      if (webApp?.MainButton) {
        const mb = webApp.MainButton;
        mb.setText(text);
        mb.color = options.color || webApp.themeParams?.button_color || '#2AABEE';
        mb.textColor = options.textColor || webApp.themeParams?.button_text_color || '#FFFFFF';

        // Снимаем предыдущий обработчик перед добавлением нового
        if (this._handler) mb.offClick(this._handler);
        this._handler = onClick;
        mb.onClick(this._handler);

        options.disabled ? mb.disable() : mb.enable();
        mb.show();
      } else {
        // Fallback: обновляем кнопку-заглушку в DOM
        _updateFallbackBtn(text, onClick, options.disabled);
      }
    },

    hide() {
      if (webApp?.MainButton) {
        webApp.MainButton.hide();
        if (this._handler) {
          webApp.MainButton.offClick(this._handler);
          this._handler = null;
        }
      } else {
        const btn = document.getElementById('fallback-main-btn');
        if (btn) btn.style.display = 'none';
      }
    },

    disable() {
      if (webApp?.MainButton) webApp.MainButton.disable();
      else {
        const btn = document.getElementById('fallback-main-btn');
        if (btn) btn.disabled = true;
      }
    },

    enable() {
      if (webApp?.MainButton) webApp.MainButton.enable();
      else {
        const btn = document.getElementById('fallback-main-btn');
        if (btn) btn.disabled = false;
      }
    },

    showProgress() {
      if (webApp?.MainButton) webApp.MainButton.showProgress(false);
    },

    hideProgress() {
      if (webApp?.MainButton) webApp.MainButton.hideProgress();
    },
  };

  // ─── BackButton (кнопка назад в шапке Telegram) ────────────────────────────
  const BackButton = {
    _handler: null,

    show(onClick) {
      if (webApp?.BackButton) {
        if (this._handler) webApp.BackButton.offClick(this._handler);
        this._handler = onClick;
        webApp.BackButton.onClick(this._handler);
        webApp.BackButton.show();
      }
      // Fallback: показываем кнопку назад в DOM (в header)
      const btn = document.getElementById('fallback-back-btn');
      if (btn) {
        btn.style.display = 'flex';
        btn.onclick = onClick;
      }
    },

    hide() {
      if (webApp?.BackButton) {
        webApp.BackButton.hide();
        if (this._handler) {
          webApp.BackButton.offClick(this._handler);
          this._handler = null;
        }
      }
      const btn = document.getElementById('fallback-back-btn');
      if (btn) btn.style.display = 'none';
    },
  };

  // ─── HapticFeedback (тактильная обратная связь) ───────────────────────────
  const Haptic = {
    impact(style = 'light') {
      webApp?.HapticFeedback?.impactOccurred(style);
    },
    selection() {
      webApp?.HapticFeedback?.selectionChanged();
    },
    notification(type = 'success') {
      webApp?.HapticFeedback?.notificationOccurred(type);
    },
  };

  // ─── Диалоги ───────────────────────────────────────────────────────────────
  function showConfirm(message, callback) {
    if (webApp?.showConfirm) {
      webApp.showConfirm(message, callback);
    } else {
      // Fallback: нативный браузерный confirm
      const result = window.confirm(message);
      callback(result);
    }
  }

  function showAlert(message, callback) {
    if (webApp?.showAlert) {
      webApp.showAlert(message, callback);
    } else {
      window.alert(message);
      if (callback) callback();
    }
  }

  // ─── Ссылки ────────────────────────────────────────────────────────────────
  function openTelegramLink(url) {
    if (webApp?.openTelegramLink) {
      webApp.openTelegramLink(url);
    } else {
      window.open(url, '_blank');
    }
  }

  function openLink(url) {
    if (webApp?.openLink) {
      webApp.openLink(url);
    } else {
      window.open(url, '_blank');
    }
  }

  // ─── Fallback-кнопка (для работы вне Telegram) ────────────────────────────
  function _updateFallbackBtn(text, onClick, disabled = false) {
    let btn = document.getElementById('fallback-main-btn');
    if (!btn) return;
    btn.textContent = text;
    btn.disabled = disabled;
    btn.style.display = 'block';
    // Снимаем старый обработчик через замену узла
    const newBtn = btn.cloneNode(true);
    newBtn.textContent = text;
    newBtn.disabled = disabled;
    newBtn.addEventListener('click', onClick);
    btn.parentNode.replaceChild(newBtn, btn);
  }

  // ─── Публичный API ─────────────────────────────────────────────────────────
  return { init, getUser, MainButton, BackButton, Haptic, showConfirm, showAlert, openTelegramLink, openLink };
})();
