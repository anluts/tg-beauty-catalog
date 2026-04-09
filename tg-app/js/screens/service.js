/**
 * service.js — детальная страница услуги (Экран 2)
 */

const ServiceScreen = (() => {

  let _service = null;
  let _currentPhoto = 0;
  let _touchStartX = 0;

  function render({ service }) {
    _service = service;
    _currentPhoto = 0;

    const reviews = REVIEWS.filter(r => r.serviceId === service.id);
    const photos = service.photos || [];

    return `
      <div class="screen screen-service">

        <!-- Галерея фото -->
        <div class="gallery" id="service-gallery">
          <div class="gallery__track" id="gallery-track">
            ${photos.map((color, i) => `
              <div class="gallery__slide" style="background:${color}">
                <span class="gallery__emoji">${service.emoji}</span>
              </div>
            `).join('')}
          </div>
          ${photos.length > 1 ? `
            <div class="gallery__dots">
              ${photos.map((_, i) => `<span class="gallery__dot ${i === 0 ? 'active' : ''}" data-idx="${i}"></span>`).join('')}
            </div>
            <div class="gallery__counter">${1} / ${photos.length}</div>
          ` : ''}
        </div>

        <!-- Контент -->
        <div class="service-detail">

          <h1 class="service-detail__name">${_esc(service.name)}</h1>

          <div class="service-detail__meta">
            <span class="meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
              ${service.duration} мин
            </span>
            <span class="meta-sep">·</span>
            <span class="meta-item meta-price">${_fmtPrice(service.price)}</span>
            ${service.rating ? `
              <span class="meta-sep">·</span>
              <span class="meta-item">★ ${service.rating.toFixed(1)}&nbsp;·&nbsp;${service.reviewsCount} отз.</span>
            ` : ''}
          </div>

          <p class="service-detail__desc">${_esc(service.description)}</p>

          <!-- Что входит -->
          ${service.includes?.length ? `
            <div class="service-detail__section">
              <div class="section-title">Что входит</div>
              <ul class="includes-list">
                ${service.includes.map(item => `
                  <li class="includes-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M20 6L9 17l-5-5"/>
                    </svg>
                    ${_esc(item)}
                  </li>
                `).join('')}
              </ul>
            </div>
          ` : ''}

          <!-- Отзывы -->
          ${reviews.length ? `
            <div class="service-detail__section">
              <div class="section-title">Отзывы</div>
              <div class="reviews-scroll">
                ${reviews.map(r => _renderReview(r)).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Нижний отступ для MainButton -->
          <div style="height: 24px"></div>
        </div>
      </div>
    `;
  }

  function _renderReview(r) {
    const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
    return `
      <div class="review-card">
        <div class="review-card__header">
          <div class="review-card__avatar" style="background:${r.authorGradient}">${r.authorInitials}</div>
          <div class="review-card__info">
            <div class="review-card__name">${_esc(r.authorName)}</div>
            <div class="review-card__stars">${stars}</div>
          </div>
          <div class="review-card__date">${r.date}</div>
        </div>
        <p class="review-card__text">${_esc(r.text)}</p>
        ${r.hasPhoto ? `
          <div class="review-card__photo" style="background:${r.photoGradient}"></div>
        ` : ''}
      </div>
    `;
  }

  function onEnter({ service }) {
    _service = service;

    // MainButton
    TG.MainButton.show(
      `Записаться · ${_fmtPrice(service.price)}`,
      () => {
        State.startWizard(service.id);
        Router.go('wizard', { step: 1 }, true);
      }
    );

    // Свайп галереи
    _initGallery();
  }

  function onLeave() {
    // Снимаем обработчики галереи
    const gallery = document.getElementById('service-gallery');
    if (gallery) {
      gallery.removeEventListener('touchstart', _onTouchStart);
      gallery.removeEventListener('touchend', _onTouchEnd);
      gallery.removeEventListener('click', _onGalleryClick);
    }
  }

  function _initGallery() {
    const gallery = document.getElementById('service-gallery');
    if (!gallery) return;

    gallery.addEventListener('touchstart', _onTouchStart, { passive: true });
    gallery.addEventListener('touchend', _onTouchEnd);
    gallery.addEventListener('click', _onGalleryClick);
  }

  function _onTouchStart(e) {
    _touchStartX = e.touches[0].clientX;
  }

  function _onTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - _touchStartX;
    const photos = _service?.photos || [];
    if (Math.abs(dx) < 30) return;
    if (dx < 0 && _currentPhoto < photos.length - 1) {
      _goPhoto(_currentPhoto + 1);
    } else if (dx > 0 && _currentPhoto > 0) {
      _goPhoto(_currentPhoto - 1);
    }
  }

  function _onGalleryClick(e) {
    // Тап по точке
    const dot = e.target.closest('.gallery__dot');
    if (dot) {
      _goPhoto(parseInt(dot.dataset.idx, 10));
    }
  }

  function _goPhoto(idx) {
    const photos = _service?.photos || [];
    if (idx < 0 || idx >= photos.length) return;
    _currentPhoto = idx;

    const track = document.getElementById('gallery-track');
    if (track) track.style.transform = `translateX(-${idx * 100}%)`;

    // Счётчик
    const counter = document.querySelector('.gallery__counter');
    if (counter) counter.textContent = `${idx + 1} / ${photos.length}`;

    // Точки
    document.querySelectorAll('.gallery__dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === idx);
    });
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
