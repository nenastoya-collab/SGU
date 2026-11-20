// Работа с датами: парсинг русских выражений, форматирование, отсчёты.

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Разница в днях: сколько дней от сегодня до даты (0 = сегодня, -1 = вчера). */
export function daysUntil(iso: string): number {
  const a = fromISO(todayISO());
  const b = fromISO(iso);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

const WEEKDAYS_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];
const MONTHS_SHORT = [
  "янв.", "февр.", "мар.", "апр.", "мая", "июня",
  "июля", "авг.", "сент.", "окт.", "нояб.", "дек.",
];

export function formatShort(iso: string): string {
  const d = fromISO(iso);
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** То же, что formatShort, но с годом: «пн, 2 нояб. 2026» — для точных прошедших дат из календаря. */
export function formatShortYear(iso: string): string {
  return `${formatShort(iso)} ${fromISO(iso).getFullYear()}`;
}

export function formatLong(iso: string): string {
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}`;
}

export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

/** Человеческая подпись: «сегодня», «завтра», «через 3 дня», «вчера», «2 дня назад». */
export function relLabel(iso: string): string {
  const n = daysUntil(iso);
  if (n === 0) return "сегодня";
  if (n === 1) return "завтра";
  if (n === 2) return "послезавтра";
  if (n === -1) return "вчера";
  if (n < -1) return `${-n} ${plural(-n, "день", "дня", "дней")} назад`;
  return `через ${n} ${plural(n, "день", "дня", "дней")}`;
}

const WEEKDAY_MAP: Record<string, number> = {
  "понедельник": 1, "пн": 1,
  "вторник": 2, "вт": 2,
  "среда": 3, "среду": 3, "среды": 3, "ср": 3,
  "четверг": 4, "чт": 4,
  "пятница": 5, "пятницу": 5, "пятницы": 5, "пт": 5,
  "суббота": 6, "субботу": 6, "сб": 6,
  "воскресенье": 0, "вс": 0,
};

const MONTH_MAP: Record<string, number> = {
  "января": 0, "янв": 0,
  "февраля": 1, "фев": 1,
  "марта": 2, "мар": 2,
  "апреля": 3, "апр": 3,
  "мая": 4,
  "июня": 5, "июн": 5,
  "июля": 6, "июл": 6,
  "августа": 7, "авг": 7,
  "сентября": 8, "сен": 8, "сент": 8,
  "октября": 9, "окт": 9,
  "ноября": 10, "ноя": 10, "нояб": 10,
  "декабря": 11, "дек": 11,
};

/**
 * Понимает: «сегодня», «завтра», «послезавтра», «пятница», «в пятницу»,
 * «20.11», «20/11/2026», «20 ноября». Возвращает ISO или null.
 */
export function parseRuDate(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^(во?|на|к|ко)\s+/, ""); // «в пятницу», «к пятнице»
  s = s.replace(/[.,]+$/, "");

  const now = new Date();
  const today = toISO(now);

  if (s === "сегодня") return today;
  if (s === "завтра") return addDays(today, 1);
  if (s === "послезавтра") return addDays(today, 2);

  // День недели → ближайший такой день (если он сегодня — берём следующую неделю)
  if (s in WEEKDAY_MAP) {
    const target = WEEKDAY_MAP[s];
    let diff = (target - now.getDay() + 7) % 7;
    if (diff === 0) diff = 7;
    return addDays(today, diff);
  }

  // Голое число «25» → ближайшее 25-е (этого или следующего месяца)
  const bare = s.match(/^(\d{1,2})$/);
  if (bare) {
    const day = Number(bare[1]);
    if (day < 1 || day > 31) return null;
    let d = new Date(now.getFullYear(), now.getMonth(), day);
    if (d.getMonth() !== now.getMonth()) return null; // нет такого дня в этом месяце
    if (d.getTime() < fromISO(today).getTime()) {
      d = new Date(now.getFullYear(), now.getMonth() + 1, day);
      if (d.getDate() !== day) return null;
    }
    return toISO(d);
  }

  // 20.11 / 20.11.2026 / 20/11
  const numeric = s.match(/^(\d{1,2})[./\s](\d{1,2})(?:[./\s](\d{2,4}))?$/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]) - 1;
    let year = numeric[3] ? Number(numeric[3]) : now.getFullYear();
    if (year < 100) year += 2000;
    if (month < 0 || month > 11 || day < 1 || day > 31) return null;
    let d = new Date(year, month, day);
    if (d.getMonth() !== month) return null; // 31.02 и т.п.
    if (!numeric[3] && d.getTime() < fromISO(today).getTime()) {
      d = new Date(year + 1, month, day); // без года → ближайшая в будущем
    }
    return toISO(d);
  }

  // 20 ноября / 20 ноя / 20 нояб. 2026
  const textual = s.match(/^(\d{1,2})\s+([а-яё]+)\.?(?:\s+(\d{4}))?$/u);
  if (textual && textual[2] in MONTH_MAP) {
    const day = Number(textual[1]);
    const month = MONTH_MAP[textual[2]];
    let year = textual[3] ? Number(textual[3]) : now.getFullYear();
    let d = new Date(year, month, day);
    if (d.getMonth() !== month) return null;
    if (!textual[3] && d.getTime() < fromISO(today).getTime()) {
      d = new Date(year + 1, month, day);
    }
    return toISO(d);
  }

  return null;
}
