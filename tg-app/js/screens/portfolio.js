/**
 * portfolio.js — портфолио мастера (Экран 8)
 */

const PortfolioScreen = (() => {

  function render() {
    const works = SERVICES.map((s, i) => ({
      gradient: s.gradient,
      emoji: s.emoji,
      label: s.name,
      category: s.category,
    }));

    return `
      <div class="screen screen-portfolio">
        <h1 class="page-title">Мои работы</h1>

        <div class="portfolio-grid">
          ${works.map((w, i) => `
            <div class="portfolio-cell" style="background:${w.gradient}" data-idx="${i}">
              <span class="portfolio-cell__emoji">${w.emoji}</span>
              <div class="portfolio-cell__label">${_esc(w.label)}</div>
            </div>
          `).join('')}
        </div>

        <div style="height: 24px"></div>
      </div>
    `;
  }

  function onEnter() {
    TG.MainButton.show('Записаться', () => {
      State.startWizard(null);
      Router.go('wizard', { step: 1 }, true);
    });
  }

  function onLeave() {}

  function _esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  return { render, onEnter, onLeave };
})();
