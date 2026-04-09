/**
 * router.js — навигация между экранами
 * SPA без перезагрузки. Экраны — это функции, которые рендерят HTML в #app-root.
 * Поддерживается стек для кнопки «Назад».
 */

const Router = (() => {

  // Реестр экранов: name → { render(params), onEnter?, onLeave? }
  const _screens = {};

  // Стек навигации для BackButton
  let _stack = [];
  let _current = null;

  // ─── Регистрация экрана ────────────────────────────────────────────────────
  function register(name, screenObj) {
    _screens[name] = screenObj;
  }

  // ─── Переход на экран ──────────────────────────────────────────────────────
  // pushToStack: true — добавляем в историю (можно вернуться)
  //              false — заменяем текущий (для табов)
  function go(name, params = {}, pushToStack = true) {
    const screen = _screens[name];
    if (!screen) {
      console.warn(`Router: unknown screen "${name}"`);
      return;
    }

    // onLeave предыдущего
    if (_current && _screens[_current]?.onLeave) {
      _screens[_current].onLeave();
    }

    if (pushToStack && _current) {
      _stack.push({ name: _current, params: _currentParams });
    } else if (!pushToStack) {
      _stack = [];
    }

    _current = name;
    _currentParams = params;

    // Рендерим
    const html = screen.render(params);
    document.getElementById('app-root').innerHTML = html;

    // onEnter нового
    if (screen.onEnter) screen.onEnter(params);

    // BackButton
    _updateBackButton();
  }

  let _currentParams = {};

  // Переход назад
  function back() {
    if (_stack.length === 0) return;
    const prev = _stack.pop();
    // onLeave текущего
    if (_current && _screens[_current]?.onLeave) {
      _screens[_current].onLeave();
    }
    _current = prev.name;
    _currentParams = prev.params;

    const screen = _screens[_current];
    const html = screen.render(_currentParams);
    document.getElementById('app-root').innerHTML = html;
    if (screen.onEnter) screen.onEnter(_currentParams);

    _updateBackButton();
  }

  function canGoBack() { return _stack.length > 0; }
  function getCurrent() { return _current; }

  // ─── BackButton ───────────────────────────────────────────────────────────
  function _updateBackButton() {
    if (canGoBack()) {
      TG.BackButton.show(() => back());
    } else {
      TG.BackButton.hide();
    }
  }

  // ─── Публичный API ─────────────────────────────────────────────────────────
  return { register, go, back, canGoBack, getCurrent };
})();
