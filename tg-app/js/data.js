/**
 * data.js — все данные приложения
 * Чтобы изменить мастера, услуги или отзывы — редактируй этот файл
 */

// ─── Данные мастера ───────────────────────────────────────────────────────────
const MASTER = {
  name: 'Алина Петрова',
  specialty: 'Мастер маникюра и педикюра',
  city: 'Москва',
  rating: 4.9,
  reviewsCount: 127,
  experience: 5,
  bio: 'Делаю маникюр, который держится 3–4 недели. Работаю только с материалами X-Gen и Kodi Professional. Стерильные инструменты, уютная атмосфера.',
  address: 'ул. Ленина, 45, кв. 12',
  metro: 'м. Чистые пруды, 7 мин',
  hours: 'Пн–Сб: 10:00–21:00',
  telegram: 'alina_nails_msk',
  initials: 'АП',
  // Градиент аватара
  gradient: 'linear-gradient(135deg, #A78BFA 0%, #EC4899 100%)',
};

// ─── Категории услуг ──────────────────────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',        label: 'Все' },
  { id: 'manicure',  label: 'Маникюр' },
  { id: 'pedicure',  label: 'Педикюр' },
  { id: 'nailart',   label: 'Дизайн' },
  { id: 'extensions',label: 'Наращивание' },
  { id: 'brows',     label: 'Брови' },
];

// ─── Услуги ───────────────────────────────────────────────────────────────────
// Чтобы добавить услугу — добавь объект в этот массив
const SERVICES = [
  {
    id: 1,
    category: 'manicure',
    name: 'Маникюр классический',
    shortDesc: 'Уход за ногтями и кутикулой',
    description: 'Обработка кутикулы, придание формы ногтям, покрытие на выбор. Идеально для поддержания ухоженного вида. Держится 2–3 недели.',
    duration: 60,
    price: 1800,
    rating: 4.9,
    reviewsCount: 42,
    includes: [
      'Снятие старого покрытия',
      'Уход за кутикулой',
      'Придание формы ногтям',
      'Покрытие на выбор (лак / база)',
    ],
    gradient: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)',
    emoji: '💅',
    photos: ['#A78BFA', '#8B5CF6', '#7C3AED', '#6D28D9'],
  },
  {
    id: 2,
    category: 'manicure',
    name: 'Маникюр + гель-лак',
    shortDesc: 'Держится 3–4 недели без сколов',
    description: 'Классический маникюр с покрытием гель-лаком. 200+ оттенков. Держится 3–4 недели без сколов и потери блеска.',
    duration: 90,
    price: 2500,
    rating: 5.0,
    reviewsCount: 63,
    includes: [
      'Снятие гель-лака аппаратом',
      'Уход за кутикулой',
      'Придание формы',
      'Гель-лак (200+ оттенков)',
      'Финишное покрытие и укрепление',
    ],
    gradient: 'linear-gradient(135deg, #EC4899 0%, #F43F5E 100%)',
    emoji: '✨',
    photos: ['#EC4899', '#F43F5E', '#E11D48', '#BE185D'],
  },
  {
    id: 3,
    category: 'pedicure',
    name: 'Педикюр классический',
    shortDesc: 'Полный уход за стопами',
    description: 'Комплексный уход: обработка стоп и ногтей, удаление огрубевшей кожи, расслабляющая ванночка. Результат — мягкие ухоженные ноги.',
    duration: 90,
    price: 2200,
    rating: 4.8,
    reviewsCount: 31,
    includes: [
      'Расслабляющая ванночка',
      'Обработка кутикулы',
      'Удаление огрубевшей кожи',
      'Придание формы ногтям',
      'Увлажняющий крем для стоп',
    ],
    gradient: 'linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)',
    emoji: '🦶',
    photos: ['#06B6D4', '#3B82F6', '#2563EB', '#1D4ED8'],
  },
  {
    id: 4,
    category: 'pedicure',
    name: 'Педикюр + гель-лак',
    shortDesc: 'Педикюр с долгосрочным покрытием',
    description: 'Полный уход за стопами с покрытием гель-лаком. Держится 3–4 недели. Отличный вариант перед морем или важным событием.',
    duration: 120,
    price: 3000,
    rating: 4.9,
    reviewsCount: 28,
    includes: [
      'Расслабляющая ванночка',
      'Обработка кутикулы и стоп',
      'Удаление огрубевшей кожи',
      'Гель-лак (200+ оттенков)',
      'Финишное покрытие',
    ],
    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)',
    emoji: '🌊',
    photos: ['#0EA5E9', '#6366F1', '#4F46E5', '#4338CA'],
  },
  {
    id: 5,
    category: 'manicure',
    name: 'Маникюр + педикюр',
    shortDesc: 'Комплекс со скидкой',
    description: 'Полный комплекс маникюра и педикюра с гель-лаком. Выгоднее, чем по отдельности — экономия 700₽.',
    duration: 180,
    price: 4200,
    rating: 4.9,
    reviewsCount: 19,
    includes: [
      'Маникюр с гель-лаком',
      'Педикюр с гель-лаком',
      'Один цвет или разные',
      'Укрепление ногтей в подарок',
    ],
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #EC4899 50%, #F43F5E 100%)',
    emoji: '💝',
    photos: ['#8B5CF6', '#EC4899', '#F43F5E', '#A78BFA'],
  },
  {
    id: 6,
    category: 'nailart',
    name: 'Дизайн ногтей',
    shortDesc: 'Рисунки, стразы, фольга',
    description: 'Дополнение к маникюру: рисунки, стразы, фольга, градиент омбре. Создадим уникальный дизайн под ваш образ.',
    duration: 30,
    price: 500,
    rating: 5.0,
    reviewsCount: 44,
    includes: [
      'Любые рисунки от руки',
      'Стразы и пигменты',
      'Фольга и кошачий глаз',
      'Омбре и градиент',
    ],
    gradient: 'linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)',
    emoji: '🎨',
    photos: ['#F59E0B', '#EF4444', '#DC2626', '#D97706'],
  },
  {
    id: 7,
    category: 'extensions',
    name: 'Наращивание ногтей',
    shortDesc: 'Длинные крепкие ногти',
    description: 'Наращивание гелем или акрилом. Придадим форму и нужную длину. Результат выглядит натурально и держится 3–4 недели.',
    duration: 180,
    price: 3500,
    rating: 4.7,
    reviewsCount: 22,
    includes: [
      'Подготовка натурального ногтя',
      'Наращивание гелем или акрилом',
      'Придание формы',
      'Покрытие гель-лаком',
      'Дизайн по желанию',
    ],
    gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    emoji: '💎',
    photos: ['#10B981', '#059669', '#047857', '#065F46'],
  },
  {
    id: 8,
    category: 'brows',
    name: 'Брови: коррекция',
    shortDesc: 'Идеальная форма бровей',
    description: 'Коррекция формы бровей пинцетом и нитью. Учту особенности вашего лица и пожелания. Результат держится 3–4 недели.',
    duration: 45,
    price: 1200,
    rating: 4.9,
    reviewsCount: 17,
    includes: [
      'Определение идеальной формы',
      'Коррекция пинцетом',
      'Удаление пушка нитью',
      'Финальная укладка',
    ],
    gradient: 'linear-gradient(135deg, #92400E 0%, #78350F 100%)',
    emoji: '🌿',
    photos: ['#92400E', '#78350F', '#6B3A10', '#854D0E'],
  },
  {
    id: 9,
    category: 'brows',
    name: 'Брови: окрашивание + коррекция',
    shortDesc: 'Форма и насыщенный цвет',
    description: 'Комплекс: коррекция формы и окрашивание хной или краской. Брови выглядят выразительно и ухоженно 3–5 недель.',
    duration: 60,
    price: 1800,
    rating: 4.8,
    reviewsCount: 14,
    includes: [
      'Коррекция формы',
      'Окрашивание хной или краской',
      '15+ оттенков',
      'Стойкость 3–5 недель',
    ],
    gradient: 'linear-gradient(135deg, #B45309 0%, #92400E 100%)',
    emoji: '🎭',
    photos: ['#B45309', '#92400E', '#78350F', '#A16207'],
  },
];

// ─── Отзывы ───────────────────────────────────────────────────────────────────
const REVIEWS = [
  {
    id: 1,
    serviceId: 2,
    authorName: 'Наталья К.',
    authorInitials: 'НК',
    authorGradient: 'linear-gradient(135deg, #F43F5E, #EC4899)',
    rating: 5,
    text: 'Алина — настоящий профессионал! Гель-лак держится уже 4 недели, ни одной трещинки. Обязательно вернусь!',
    date: '28 марта',
    hasPhoto: true,
    photoGradient: 'linear-gradient(135deg, #EC4899 0%, #A78BFA 100%)',
  },
  {
    id: 2,
    serviceId: 3,
    authorName: 'Анастасия М.',
    authorInitials: 'АМ',
    authorGradient: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
    rating: 5,
    text: 'Прихожу уже третий год подряд. Лучший мастер в городе! Педикюр держится долго, стопы после процедуры как шёлк.',
    date: '15 марта',
    hasPhoto: false,
  },
  {
    id: 3,
    serviceId: 7,
    authorName: 'Мария Л.',
    authorInitials: 'МЛ',
    authorGradient: 'linear-gradient(135deg, #10B981, #0EA5E9)',
    rating: 5,
    text: 'Наращивание выглядит абсолютно натурально. Результат превзошёл все ожидания. Спасибо, Алина!',
    date: '10 марта',
    hasPhoto: true,
    photoGradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
  },
  {
    id: 4,
    serviceId: 8,
    authorName: 'Елена В.',
    authorInitials: 'ЕВ',
    authorGradient: 'linear-gradient(135deg, #F59E0B, #92400E)',
    rating: 5,
    text: 'Идеальные брови с первого раза! Форма именно такая, о которой я мечтала. Очень довольна, всем рекомендую.',
    date: '5 марта',
    hasPhoto: false,
  },
  {
    id: 5,
    serviceId: 1,
    authorName: 'Светлана П.',
    authorInitials: 'СП',
    authorGradient: 'linear-gradient(135deg, #8B5CF6, #A78BFA)',
    rating: 5,
    text: 'Очень аккуратная работа! Приятная атмосфера, мастер внимательная и профессиональная. Уже записалась снова.',
    date: '1 марта',
    hasPhoto: true,
    photoGradient: 'linear-gradient(135deg, #A78BFA 0%, #8B5CF6 100%)',
  },
  {
    id: 6,
    serviceId: 2,
    authorName: 'Ирина Д.',
    authorInitials: 'ИД',
    authorGradient: 'linear-gradient(135deg, #EC4899, #F43F5E)',
    rating: 5,
    text: 'Хожу к Алине полгода. Никогда не было проблем — всё аккуратно, чисто, красиво. Лучший мастер!',
    date: '22 февраля',
    hasPhoto: false,
  },
];

// ─── Генерация слотов времени ─────────────────────────────────────────────────
// Возвращает массив из 14 дней начиная с сегодня
function generateDates() {
  const dates = [];
  const today = new Date();
  const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const monthNames = ['янв', 'фев', 'мар', 'апр', 'май', 'июн',
                      'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dayOfWeek = date.getDay();
    // Воскресенье — выходной
    const isOff = dayOfWeek === 0;
    dates.push({
      date,
      label: dayNames[dayOfWeek],
      day: date.getDate(),
      month: monthNames[date.getMonth()],
      fullDate: `${date.getDate()} ${monthNames[date.getMonth()]}`,
      longDate: `${dayNames[dayOfWeek]}, ${date.getDate()} ${monthNames[date.getMonth()]}`,
      isOff,
      // Суббота — укороченный день (до 16:00)
      isSaturday: dayOfWeek === 6,
    });
  }
  return dates;
}

// Все слоты дня
const ALL_SLOTS = ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30', '19:00'];
const SATURDAY_SLOTS = ['10:00', '11:30', '13:00', '14:30'];

// Детерминированная «случайность» — чтобы занятые слоты были стабильными
function isSlotTaken(dateStr, slot) {
  const hash = (dateStr + slot).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return hash % 4 === 0; // ~25% слотов заняты
}

// Возвращает слоты для конкретной даты (с учётом длительности услуги в минутах)
function getSlotsForDate(dateObj, durationMinutes = 60) {
  if (dateObj.isOff) return [];
  const slots = dateObj.isSaturday ? SATURDAY_SLOTS : ALL_SLOTS;
  const dateStr = dateObj.date.toDateString();
  return slots.map(time => {
    // Проверяем, что до конца рабочего дня хватает времени
    const [h, m] = time.split(':').map(Number);
    const endHour = 21;
    const enoughTime = (h * 60 + m + durationMinutes) <= endHour * 60;
    return {
      time,
      taken: !enoughTime || isSlotTaken(dateStr, time),
    };
  });
}

// ─── Адаптированные функции для wizard.js ─────────────────────────────────────

// generateDates() — возвращает 14 дней в формате, который ожидает wizard.js
// Переопределяем исходную функцию:
(function() {
  const _original = generateDates;
  // eslint-disable-next-line no-global-assign
  generateDates = function() {
    const raw = _original();
    return raw.map(d => {
      const dateStr = d.date.toISOString().split('T')[0]; // YYYY-MM-DD
      const slots = getSlotsForDate(d);
      const hasSlots = slots.some(s => !s.taken);
      return {
        dateStr,
        dayLabel: d.label,      // 'Пн', 'Вт', ...
        num: d.day,             // число месяца
        label: d.longDate,      // 'Пн, 8 апр'
        hasSlots,
        isOff: d.isOff,
        _raw: d,
      };
    });
  };
})();

// generateSlots(dateStr) — возвращает слоты с полями { time, available, period }
function generateSlots(dateStr) {
  const dates = (function() {
    // Получаем сырые даты, не через обёртку
    const today = new Date();
    const dayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const monthNames = ['янв', 'фев', 'мар', 'апр', 'май', 'июн',
                        'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    const result = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const dayOfWeek = date.getDay();
      const isOff = dayOfWeek === 0;
      result.push({
        date,
        dateStr: date.toISOString().split('T')[0],
        label: dayNames[dayOfWeek],
        day: date.getDate(),
        month: monthNames[date.getMonth()],
        fullDate: `${date.getDate()} ${monthNames[date.getMonth()]}`,
        longDate: `${dayNames[dayOfWeek]}, ${date.getDate()} ${monthNames[date.getMonth()]}`,
        isOff,
        isSaturday: dayOfWeek === 6,
      });
    }
    return result;
  })();

  const dayObj = dates.find(d => d.dateStr === dateStr);
  if (!dayObj) return [];

  const rawSlots = getSlotsForDate(dayObj);
  return rawSlots.map(s => {
    const hour = parseInt(s.time.split(':')[0], 10);
    let period = 'morning';
    if (hour >= 12 && hour < 17) period = 'afternoon';
    else if (hour >= 17) period = 'evening';
    return {
      time: s.time,
      available: !s.taken,
      period,
    };
  });
}

// ─── Пример предстоящей записи (для экрана «Мои записи») ─────────────────────
const SAMPLE_BOOKING = {
  id: 'bk-001',
  serviceId: 2,
  serviceName: 'Маникюр + гель-лак',
  date: 'Пт, 11 апр',
  time: '14:30',
  price: 2500,
  address: 'ул. Ленина, 45, кв. 12',
  status: 'confirmed', // confirmed | pending | cancelled
  clientName: 'Александра',
};
