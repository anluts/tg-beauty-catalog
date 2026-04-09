/**
 * wizard.js — wizard записи (3 шага, Экран 5)
 */

const WizardScreen = (() => {

  // Данные шага 2 (контакты)
  let _contactData = { name: '', phone: '', comment: '' };

  function render({ step = 1 } = {}) {
    const wizard = State.getWizard();
    const service = wizard.serviceId ? SERVICES.find(s => s.id === wizard.serviceId) : null;
    State.setWizardStep(step);

    if (step === 1) return _renderStep1(service, wizard);
    if (step === 2) return _renderStep2(service, wizard);
    if (step === 3) return _renderStep3(service, wizard);
    return '';
  }

  // ─── Шаг 1: Выбор даты и времени ──────────────────────────────────────────
  function _renderStep1(service, wizard) {
    const dates = generateDates();
    const selectedDateIdx = wizard.date
      ? dates.findIndex(d => d.dateStr === wizard.date.dateStr)
      : 0;
    const activeDate = dates[selectedDateIdx] || dates[0];
    const slots = generateSlots(activeDate.dateStr);

    return `
      <div class="screen screen-wizard">
        ${_renderHeader(service, wizard, 1)}

        <!-- Даты -->
        <div class="wizard-section">
          <div class="dates-scroll" id="dates-scroll">
            ${dates.map((d, i) => `
              <button
                class="date-chip ${i === selectedDateIdx ? 'active' : ''} ${d.hasSlots ? '' : 'disabled'}"
                data-idx="${i}"
                data-datestr="${d.dateStr}"
                ${!d.hasSlots ? 'disabled' : ''}
              >
                <span class="date-chip__day">${d.dayLabel}</span>
                <span class="date-chip__num">${d.num}</span>
                ${d.hasSlots ? '<span class="date-chip__dot"></span>' : ''}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- Слоты -->
        <div class="wizard-section" id="slots-container">
          ${_renderSlots(slots, wizard.timeSlot)}
        </div>

        <div style="height: 24px"></div>
      </div>
    `;
  }

  function _renderSlots(slots, selectedSlot) {
    const groups = [
      { id: 'morning', label: 'Утро', slots: slots.filter(s => s.period === 'morning') },
      { id: 'afternoon', label: 'День', slots: slots.filter(s => s.period === 'afternoon') },
      { id: 'evening', label: 'Вечер', slots: slots.filter(s => s.period === 'evening') },
    ].filter(g => g.slots.length > 0);

    return groups.map(g => `
      <div class="slot-group">
        <div class="slot-group__label">${g.label}</div>
        <div class="slots-grid">
          ${g.slots.map(slot => `
            <button
              class="slot ${slot.available ? '' : 'slot--busy'} ${selectedSlot?.time === slot.time ? 'slot--active' : ''}"
              data-time="${slot.time}"
              data-period="${slot.period}"
              ${!slot.available ? 'disabled' : ''}
            >${slot.time}</button>
          `).join('')}
        </div>
      </div>
    `).join('') || '<div class="empty-state"><div class="empty-icon">📅</div><div class="empty-title">Нет доступных слотов</div></div>';
  }

  // ─── Шаг 2: Контактные данные ──────────────────────────────────────────────
  function _renderStep2(service, wizard) {
    const user = TG.getUser();
    const name = _contactData.name || user.firstName + (user.lastName ? ' ' + user.lastName : '');
    const phone = _contactData.phone || '';

    return `
      <div class="screen screen-wizard">
        ${_renderHeader(service, wizard, 2)}

        <div class="wizard-section">
          <div class="form-group">
            <label class="form-label">Ваше имя</label>
            <input
              type="text"
              id="contact-name"
              class="form-input"
              value="${_esc(name)}"
              placeholder="Ваше имя"
              autocomplete="name"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Телефон</label>
            <input
              type="tel"
              id="contact-phone"
              class="form-input"
              value="${_esc(phone)}"
              placeholder="+7 999 000-00-00"
              autocomplete="tel"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Комментарий <span class="form-optional">(необязательно)</span></label>
            <textarea
              id="contact-comment"
              class="form-input form-textarea"
              placeholder="Пожелания для мастера..."
              rows="3"
            >${_esc(_contactData.comment)}</textarea>
          </div>
        </div>

        <div style="height: 24px"></div>
      </div>
    `;
  }

  // ─── Шаг 3: Подтверждение ─────────────────────────────────────────────────
  function _renderStep3(service, wizard) {
    return `
      <div class="screen screen-wizard">
        ${_renderHeader(service, wizard, 3)}

        <div class="wizard-section">
          <div class="confirm-card">
            <div class="confirm-row">
              <span class="confirm-icon">💅</span>
              <div>
                <div class="confirm-label">Услуга</div>
                <div class="confirm-value">${service ? _esc(service.name) : '—'}</div>
              </div>
            </div>
            ${service ? `
              <div class="confirm-row">
                <span class="confirm-icon">⏱</span>
                <div>
                  <div class="confirm-label">Длительность и стоимость</div>
                  <div class="confirm-value">${service.duration} мин · ${_fmtPrice(service.price)}</div>
                </div>
              </div>
            ` : ''}
            <div class="confirm-row">
              <span class="confirm-icon">📅</span>
              <div>
                <div class="confirm-label">Дата</div>
                <div class="confirm-value">${wizard.date?.label || '—'}</div>
              </div>
            </div>
            <div class="confirm-row">
              <span class="confirm-icon">🕐</span>
              <div>
                <div class="confirm-label">Время</div>
                <div class="confirm-value">${wizard.timeSlot?.time || '—'}</div>
              </div>
            </div>
            <div class="confirm-row">
              <span class="confirm-icon">👤</span>
              <div>
                <div class="confirm-label">Имя</div>
                <div class="confirm-value">${_esc(_contactData.name)}</div>
              </div>
            </div>
            ${_contactData.phone ? `
              <div class="confirm-row">
                <span class="confirm-icon">📱</span>
                <div>
                  <div class="confirm-label">Телефон</div>
                  <div class="confirm-value">${_esc(_contactData.phone)}</div>
                </div>
              </div>
            ` : ''}
            <div class="confirm-row">
              <span class="confirm-icon">📍</span>
              <div>
                <div class="confirm-label">Адрес</div>
                <div class="confirm-value">${_esc(MASTER.address)}</div>
              </div>
            </div>
            ${_contactData.comment ? `
              <div class="confirm-row">
                <span class="confirm-icon">💬</span>
                <div>
                  <div class="confirm-label">Комментарий</div>
                  <div class="confirm-value">${_esc(_contactData.comment)}</div>
                </div>
              </div>
            ` : ''}
          </div>
          <div class="cancel-policy">Бесплатная отмена за 24 часа до визита</div>
        </div>

        <div style="height: 24px"></div>
      </div>
    `;
  }

  // ─── Заголовок с прогресс-баром ────────────────────────────────────────────
  function _renderHeader(service, wizard, step) {
    const titles = ['', 'Выберите дату и время', 'Контактные данные', 'Проверьте запись'];
    const subtitle = step === 1
      ? (service ? `${_esc(service.name)} · ${_fmtPrice(service.price)}` : 'Выберите услугу')
      : step === 2
      ? (wizard.date ? `${_esc(wizard.date.label)} · ${wizard.timeSlot?.time || ''}` : '')
      : '';

    return `
      <div class="wizard-header">
        <div class="wizard-title">${titles[step]}</div>
        ${subtitle ? `<div class="wizard-subtitle">${subtitle}</div>` : ''}
        <div class="progress-bar">
          <div class="progress-bar__fill" style="width:${(step / 3) * 100}%"></div>
        </div>
        <div class="progress-label">${step} из 3</div>
      </div>
    `;
  }

  // ─── onEnter ───────────────────────────────────────────────────────────────
  function onEnter({ step = 1 } = {}) {
    const wizard = State.getWizard();

    if (step === 1) {
      _enterStep1(wizard);
    } else if (step === 2) {
      _enterStep2(wizard);
    } else if (step === 3) {
      _enterStep3(wizard);
    }

    const root = document.getElementById('app-root');
    root.addEventListener('click', _handleClick);
    root.addEventListener('change', _handleChange);
  }

  function onLeave() {
    const root = document.getElementById('app-root');
    root.removeEventListener('click', _handleClick);
    root.removeEventListener('change', _handleChange);
  }

  function _enterStep1(wizard) {
    // MainButton неактивна пока не выбран слот
    if (wizard.timeSlot) {
      TG.MainButton.show('Выбрать время', _goToStep2);
    } else {
      TG.MainButton.show('Выбрать время', _goToStep2, { disabled: true });
    }
    // Скроллим к активной дате
    setTimeout(() => {
      const active = document.querySelector('.date-chip.active');
      if (active) active.scrollIntoView({ inline: 'center', behavior: 'smooth' });
    }, 100);
  }

  function _enterStep2(wizard) {
    TG.MainButton.show('Далее', _goToStep3);
    // Фокус на первое поле
    setTimeout(() => {
      const nameInput = document.getElementById('contact-name');
      if (nameInput) nameInput.focus();
    }, 200);
  }

  function _enterStep3(wizard) {
    TG.MainButton.show('Подтвердить запись', _confirmBooking);
    TG.MainButton.showProgress && TG.MainButton.showProgress();
  }

  // ─── Обработчики ──────────────────────────────────────────────────────────
  function _handleClick(e) {
    const wizard = State.getWizard();

    // Выбор даты
    const dateChip = e.target.closest('.date-chip:not([disabled])');
    if (dateChip) {
      const idx = parseInt(dateChip.dataset.idx, 10);
      const dates = generateDates();
      const d = dates[idx];
      if (!d) return;

      State.setWizardDate({
        dateStr: d.dateStr,
        label: d.label,
        dayLabel: d.dayLabel,
      });

      // Обновляем чипы
      document.querySelectorAll('.date-chip').forEach((c, i) => {
        c.classList.toggle('active', i === idx);
      });

      // Обновляем слоты
      const slots = generateSlots(d.dateStr);
      const container = document.getElementById('slots-container');
      if (container) {
        container.innerHTML = _renderSlots(slots, null);
      }
      TG.Haptic.selection();
      TG.MainButton.disable();
      return;
    }

    // Выбор слота
    const slotBtn = e.target.closest('.slot:not(.slot--busy)');
    if (slotBtn) {
      const time = slotBtn.dataset.time;
      const period = slotBtn.dataset.period;
      State.setWizardSlot({ time, period });

      document.querySelectorAll('.slot').forEach(s => {
        s.classList.toggle('slot--active', s.dataset.time === time);
      });
      TG.MainButton.enable();
      TG.Haptic.impact('light');
    }
  }

  function _handleChange(e) {
    // Сохраняем данные шага 2 при вводе
    if (e.target.id === 'contact-name') _contactData.name = e.target.value;
    if (e.target.id === 'contact-phone') _contactData.phone = e.target.value;
    if (e.target.id === 'contact-comment') _contactData.comment = e.target.value;
  }

  // ─── Переходы между шагами ─────────────────────────────────────────────────
  function _goToStep2() {
    // Сохраняем input'ы перед уходом
    _saveContactInputs();
    const user = TG.getUser();
    if (!_contactData.name) _contactData.name = user.firstName + (user.lastName ? ' ' + user.lastName : '');
    onLeave();
    State.setWizardStep(2);
    const wizard = State.getWizard();
    const service = wizard.serviceId ? SERVICES.find(s => s.id === wizard.serviceId) : null;
    document.getElementById('app-root').innerHTML = _renderStep2(service, wizard);
    _enterStep2(wizard);
    const root = document.getElementById('app-root');
    root.addEventListener('click', _handleClick);
    root.addEventListener('change', _handleChange);
  }

  function _goToStep3() {
    _saveContactInputs();
    if (!_contactData.name.trim()) {
      TG.showAlert('Пожалуйста, введите ваше имя');
      return;
    }
    onLeave();
    State.setWizardStep(3);
    const wizard = State.getWizard();
    const service = wizard.serviceId ? SERVICES.find(s => s.id === wizard.serviceId) : null;
    document.getElementById('app-root').innerHTML = _renderStep3(service, wizard);
    _enterStep3(wizard);
    const root = document.getElementById('app-root');
    root.addEventListener('click', _handleClick);
    root.addEventListener('change', _handleChange);
  }

  function _confirmBooking() {
    TG.MainButton.showProgress();
    TG.MainButton.disable();

    const wizard = State.getWizard();
    const service = wizard.serviceId ? SERVICES.find(s => s.id === wizard.serviceId) : null;

    // В MVP сохраняем локально
    const booking = {
      id: Date.now().toString(),
      serviceId: service?.id || null,
      serviceName: service?.name || 'Услуга',
      price: service?.price || 0,
      dateIso: wizard.date?.dateStr || new Date().toISOString(),
      dateLabel: wizard.date?.label || '',
      time: wizard.timeSlot?.time || '',
      status: 'confirmed',
    };

    // Имитируем задержку сервера
    setTimeout(() => {
      State.addBooking(booking);
      TG.MainButton.hideProgress();
      TG.Haptic.notification('success');
      Router.go('success', { booking, service }, false);
    }, 800);
  }

  function _saveContactInputs() {
    const nameEl = document.getElementById('contact-name');
    const phoneEl = document.getElementById('contact-phone');
    const commentEl = document.getElementById('contact-comment');
    if (nameEl) _contactData.name = nameEl.value;
    if (phoneEl) _contactData.phone = phoneEl.value;
    if (commentEl) _contactData.comment = commentEl.value;
  }

  function _fmtPrice(p) {
    return p.toLocaleString('ru-RU') + '\u00a0₽';
  }

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { render, onEnter, onLeave };
})();
