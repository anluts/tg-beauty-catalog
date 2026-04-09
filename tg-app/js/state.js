/**
 * state.js — глобальное состояние приложения
 * Единственный источник правды. Все изменения через методы объекта State.
 */

const State = (() => {

  // ─── Внутреннее состояние ──────────────────────────────────────────────────
  let _state = {
    // Текущий активный таб (catalog | master | bookings)
    activeTab: 'catalog',

    // Фильтр каталога
    catalogFilter: 'all',

    // Текущая услуга (для экрана услуги)
    selectedService: null,

    // Записи пользователя (загружаются / сохраняются локально для MVP)
    bookings: _loadBookings(),

    // Wizard записи
    wizard: {
      serviceId: null,
      date: null,       // { dateStr, label, dayLabel }
      timeSlot: null,   // { time, period }
      step: 1,          // 1 | 2 | 3
    },

    // Поиск
    searchQuery: '',
  };

  // ─── Подписчики на изменения ───────────────────────────────────────────────
  const _listeners = {};

  function on(event, fn) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(fn);
  }

  function _emit(event, data) {
    (_listeners[event] || []).forEach(fn => fn(data));
  }

  // ─── Персистентность записей ───────────────────────────────────────────────
  function _loadBookings() {
    try {
      return JSON.parse(localStorage.getItem('beauty_bookings') || '[]');
    } catch {
      return [];
    }
  }

  function _saveBookings() {
    try {
      localStorage.setItem('beauty_bookings', JSON.stringify(_state.bookings));
    } catch { /* ignore */ }
  }

  // ─── Методы ───────────────────────────────────────────────────────────────

  function getActiveTab() { return _state.activeTab; }
  function setActiveTab(tab) {
    _state.activeTab = tab;
    _emit('tabChange', tab);
  }

  function getCatalogFilter() { return _state.catalogFilter; }
  function setCatalogFilter(id) {
    _state.catalogFilter = id;
    _emit('filterChange', id);
  }

  function getSelectedService() { return _state.selectedService; }
  function setSelectedService(service) {
    _state.selectedService = service;
  }

  function getSearchQuery() { return _state.searchQuery; }
  function setSearchQuery(q) {
    _state.searchQuery = q;
    _emit('searchChange', q);
  }

  // ─── Wizard ───────────────────────────────────────────────────────────────
  function getWizard() { return { ..._state.wizard }; }

  function startWizard(serviceId) {
    _state.wizard = {
      serviceId,
      date: null,
      timeSlot: null,
      step: 1,
    };
    _emit('wizardUpdate', getWizard());
  }

  function setWizardDate(date) {
    _state.wizard.date = date;
    _state.wizard.timeSlot = null; // сбрасываем слот при смене даты
    _emit('wizardUpdate', getWizard());
  }

  function setWizardSlot(slot) {
    _state.wizard.timeSlot = slot;
    _emit('wizardUpdate', getWizard());
  }

  function setWizardStep(step) {
    _state.wizard.step = step;
    _emit('wizardUpdate', getWizard());
  }

  // ─── Записи ───────────────────────────────────────────────────────────────
  function getBookings() { return [..._state.bookings]; }

  function getUpcomingBookings() {
    const now = new Date();
    return _state.bookings.filter(b => {
      if (b.status === 'cancelled') return false;
      return new Date(b.dateIso) >= now;
    }).sort((a, b) => new Date(a.dateIso) - new Date(b.dateIso));
  }

  function getPastBookings() {
    const now = new Date();
    return _state.bookings.filter(b => {
      return new Date(b.dateIso) < now || b.status === 'cancelled';
    }).sort((a, b) => new Date(b.dateIso) - new Date(a.dateIso));
  }

  function addBooking(booking) {
    // booking: { id, serviceId, serviceName, price, dateIso, dateLabel, time, status }
    _state.bookings.push(booking);
    _saveBookings();
    _emit('bookingsUpdate', getBookings());
  }

  function cancelBooking(id) {
    const b = _state.bookings.find(b => b.id === id);
    if (b) {
      b.status = 'cancelled';
      _saveBookings();
      _emit('bookingsUpdate', getBookings());
    }
  }

  function hasReview(bookingId) {
    return !!localStorage.getItem(`review_${bookingId}`);
  }

  function markReviewed(bookingId) {
    localStorage.setItem(`review_${bookingId}`, '1');
  }

  // ─── Публичный API ─────────────────────────────────────────────────────────
  return {
    on,
    getActiveTab, setActiveTab,
    getCatalogFilter, setCatalogFilter,
    getSelectedService, setSelectedService,
    getSearchQuery, setSearchQuery,
    getWizard, startWizard, setWizardDate, setWizardSlot, setWizardStep,
    getBookings, getUpcomingBookings, getPastBookings,
    addBooking, cancelBooking, hasReview, markReviewed,
  };
})();
