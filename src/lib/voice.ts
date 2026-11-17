// Разбор голосовых команд: текст → действие (задача / перенос / отмена).
// Работает офлайн, по правилам — без нейросети.
import type { AppData } from "@/types";
import { parseRuDate, todayISO, formatShort, addDays, fromISO, toISO } from "./dates";
import { mondayOf, addDaysISO, classOnWeek, findNextClass } from "./schedule";

export type VoiceResult =
  | { type: "task"; title: string; subjectId?: string; subjectName?: string; date?: string; dateNote?: string }
  | { type: "move"; subjectName?: string; fromDate?: string; toDate: string; dayScope: boolean; toTime?: string }
  | { type: "retime"; target: RetimeTarget; toTime?: string; shiftMin?: number; date?: string }
  | { type: "cancel"; subjectName?: string; date: string }
  | { type: "unknown"; reason: string };

/** Пара, у которой меняют время начала. */
export interface RetimeTarget {
  id: string;
  day: number; // 1=пн … 6=сб
  start: string;
  end: string;
  subject: string;
  teacher?: string;
}

const DAY_FULL = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

const WEEKDAY_WORDS: [RegExp, number][] = [
  [/понедельник/, 1],
  [/вторник/, 2],
  [/сред[ауы]/, 3],
  [/четверг/, 4],
  [/пятниц[ауы]/, 5],
  [/суббот[ауы]/, 6],
  [/воскресень[ея]/, 0],
];

// Слова-паразиты, которые убираем из названия задачи
const FILLER = [
  "внеси", "впиши", "добавь", "запиши", "поставь", "создай", "отметь",
  "нужно", "надо", "мне", "у меня", "будет", "это", "пожалуйста", "скажи",
  "новая задача", "новое задание", "задание", "задача",
];

interface SubjectHit {
  id?: string; // id предмета из списка (для задач)
  name: string;
  score: number;
  span: string; // какая фраза совпала
}

/** Ищет предмет по тексту: среди ваших предметов и предметов расписания. */
function findSubject(text: string, d: AppData): SubjectHit | null {
  const candidates: { id?: string; name: string; keys: string[] }[] = [];
  d.subjects.forEach((s) => candidates.push({ id: s.id, name: s.name, keys: stemsOf(s.name) }));
  d.schedule.forEach((e) => {
    if (!candidates.some((c) => c.name === e.subject))
      candidates.push({ name: e.subject, keys: stemsOf(e.subject) });
  });

  let best: SubjectHit | null = null;
  for (const c of candidates) {
    let score = 0;
    let span = "";
    for (const k of c.keys) {
      const idx = text.indexOf(k);
      if (idx >= 0) {
        // находим целое слово по основе, чтобы красиво вырезать из названия
        const re = new RegExp(`[а-яё]*${k}[а-яё]*`, "i");
        const m = text.slice(Math.max(0, idx - 6), idx + k.length + 6).match(re);
        const word = m ? m[0] : k;
        score += k.length;
        if (word.length > span.length) span = word;
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { id: c.id, name: c.name, score, span };
    }
  }
  return best;
}

/** Основы значимых слов названия (≥4 букв): «анатомии» ловится по «анатом». */
function stemsOf(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^а-яё]+/)
    .filter((w) => w.length >= 4)
    .map((w) => w.slice(0, Math.max(4, w.length - 3))); // «истории»→«истор», «россии»→«росс»
}

/** Дата «следующая пятница» = пятница следующей календарной недели. */
function nextWeekWeekday(wd: number): string {
  const mon = mondayOf(todayISO());
  return addDaysISO(mon, 7 + (wd === 0 ? 6 : wd - 1));
}

/** Дата «эта пятница» = пятница этой недели (если прошла — ближайшая будущая). */
function thisWeekday(wd: number): string {
  const mon = mondayOf(todayISO());
  const iso = addDaysISO(mon, wd === 0 ? 6 : wd - 1);
  return iso < todayISO() ? parseRuDate(weekdayNameForParse(wd))! : iso;
}

function weekdayNameForParse(wd: number): string {
  return ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"][wd];
}

/** Текущее время в минутах от полуночи (локальное время телефона). */
function nowMinutes(): number {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

interface DateHit {
  iso?: string;
  phrase: string; // что вырезать из текста
  note?: string;
  weekOffset?: 0 | 1; // «на этой/следующей неделе» без дня — дату возьмём из расписания
  classRef?: "nearest" | "skip" | "today"; // «ближайшая/следующая пара» / «через пару» / «сегодняшняя пара»
}

function extractDate(text: string): DateHit | null {
  // «на ближайшую пару по истории», «к следующей паре по анатомии», «конспект через пару по английскому».
  // «Ближайшая» и «следующая» — одно и то же (ближайшая будущая); «через пару» — через одну.
  // ВАЖНО: срабатывает только с предлогом («на/к пару…») или местоимением («ближайшую пару…») —
  // просто слово «пару» в «отмени пару Вороновой на субботу» датой НЕ является.
  // «на сегодняшнюю пару по истории» — именно сегодняшняя, даже если она идёт или прошла
  const todayClassM = text.match(/(?:на|к|ко)\s+сегодняшн(?:юю|ей|яя)\s+пар[аеуы](?=\s|$)/);
  if (todayClassM) return { classRef: "today", phrase: todayClassM[0] };
  // А «через пару дней/недель» — это про время, не про пары.
  // «след пару» = короткое «следующую пару».
  const classM = text.match(
    /(?:через\s+пар[аеуы](?!\s*(?:дней|дня|недел|месяц|год|лет))|(?:на|к|ко)\s+(?:ближайш(?:ая|ую|ей)|следующ(?:ая|ую|ей))\s+пар[аеуы]|(?:на|к|ко)\s+пар[аеуы]|ближайш(?:ая|ую|ей)\s+пар[аеуы]|следующ(?:ая|ую|ей)\s+пар[аеуы]|(?:на|к|ко)\s+след\.?\s*пар[аеуы]|след\.?\s*пар[аеуы])(?=\s|$)/
  );
  if (classM) {
    const kind = /^через/.test(classM[0]) ? "skip" : "nearest";
    return { classRef: kind, phrase: classM[0] };
  }
  // «через 3 дня» / «через неделю» / «через 2 недели»
  const inDays = text.match(/через\s+(\d+|день|два|три|четыре|пять|шесть|неделю)\s*(дней|дня|день|недел[юиь])?/);
  if (inDays) {
    const word = inDays[1];
    const isWeek = word === "неделю" || /недел/.test(inDays[2] ?? "");
    const n = word === "неделю" ? 1 : (NUM_WORDS[word] ?? parseInt(word, 10));
    if (!isNaN(n)) return { iso: addDays(todayISO(), isWeek ? n * 7 : n), phrase: inDays[0] };
  }
  // «в выходные» → ближайшая суббота
  const weekend = text.match(/(?:в|на)\s+выходны[ех]/);
  if (weekend) {
    const wd = fromISO(todayISO()).getDay();
    const diff = wd === 6 ? 7 : (6 - wd + 7) % 7 || 7;
    return { iso: addDays(todayISO(), diff), phrase: weekend[0] };
  }
  // «на следующей неделе» / «на этой неделе»
  const weekM = text.match(/на\s+(следующей|этой|текущей)\s+недел[еи]/);
  if (weekM) {
    // если ещё и день недели назван — «на следующей неделе в пятницу»
    const rest = text.replace(weekM[0], " ");
    const wdM = matchWeekday(rest);
    if (wdM) {
      const base = mondayOf(todayISO());
      const off = weekM[1] === "следующей" ? 7 : 0;
      return { iso: addDaysISO(base, off + (wdM.wd === 0 ? 6 : wdM.wd - 1)), phrase: weekM[0] + " " + wdM.phrase };
    }
    return { phrase: weekM[0], weekOffset: weekM[1] === "следующей" ? 1 : 0 };
  }
  // «в следующую пятницу» / «следующая среда»
  const nextWd = text.match(/(?:в|во|на)?\s*следующ(ую|ий|ая|ее)\s+([а-яё]+)/);
  if (nextWd) {
    const wd = weekdayIndex(nextWd[2]);
    if (wd !== null) return { iso: nextWeekWeekday(wd), phrase: nextWd[0] };
  }
  // «в эту пятницу» / «эта среда»
  const thisWd = text.match(/(?:в|во|на)\s+эт(у|от|а)\s+([а-яё]+)/);
  if (thisWd) {
    const wd = weekdayIndex(thisWd[2]);
    if (wd !== null) return { iso: thisWeekday(wd), phrase: thisWd[0] };
  }
  // просто день недели где-то в тексте
  const wdM = matchWeekday(text);
  if (wdM) return { iso: parseRuDate(weekdayNameForParse(wdM.wd))!, phrase: wdM.phrase };
  // «завтра», «послезавтра», «сегодня»
  const rel = text.match(/(послезавтра|завтра|сегодня)/);
  if (rel) return { iso: parseRuDate(rel[1])!, phrase: rel[1] };
  // числовая или текстовая дата: 20.11 / 20 ноября
  const num = text.match(/\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?/);
  if (num) {
    const iso = parseRuDate(num[0]);
    if (iso) return { iso, phrase: num[0] };
  }
  const tex = text.match(/\d{1,2}\s+[а-яё]{3,9}/u);
  if (tex) {
    const iso = parseRuDate(tex[0]);
    if (iso) return { iso, phrase: tex[0] };
  }
  return null;
}

function matchWeekday(text: string): { wd: number; phrase: string } | null {
  for (const [re, wd] of WEEKDAY_WORDS) {
    const m = text.match(new RegExp(`(?:в|во|на|к|ко|с|со)?\\s*${re.source}`));
    if (m) return { wd, phrase: m[0] };
  }
  return null;
}

function weekdayIndex(word: string): number | null {
  for (const [re, wd] of WEEKDAY_WORDS) if (re.test(word)) return wd;
  return null;
}

const NUM_WORDS: Record<string, number> = {
  один: 1, два: 2, три: 3, четыре: 4, пять: 5, шесть: 6,
  семь: 7, восемь: 8, девять: 9, десять: 10, одиннадцать: 11, двенадцать: 12,
  час: 1,
};

interface TimeHit {
  time?: string; // «14:00» — точное новое время
  shiftMin?: number; // «на 2 часа позже/раньше» — относительный сдвиг
  phrase: string; // что вырезать из текста
}

/** Время из текста: «на 2 часа дня» → 14:00, «на 14:00», «на час позже» → +60 мин. */
function extractTime(text: string): TimeHit | null {
  // относительный сдвиг: «на 2 часа позже», «на час раньше», «на полчаса вперёд»
  const rel = text.match(/на\s+(\d+|полтора|полчаса|час)\s*(?:часа?|часов)?\s*(позже|раньше|впер[её]д|назад)/);
  if (rel) {
    const n = rel[1] === "полтора" ? 1.5 : rel[1] === "полчаса" ? 0.5 : (NUM_WORDS[rel[1]] ?? parseInt(rel[1], 10));
    if (!isNaN(n)) {
      const sign = /раньше|назад/.test(rel[2]) ? -1 : 1;
      return { shiftMin: sign * Math.round(n * 60), phrase: rel[0] };
    }
  }
  // точное время с двоеточием: «на 14:00», «в 9:30»
  const colon = text.match(/(?:на|в)\s+(\d{1,2}):(\d{2})(?=\s|$)/);
  if (colon) {
    const h = parseInt(colon[1], 10);
    const m = parseInt(colon[2], 10);
    if (h <= 23 && m <= 59)
      return { time: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`, phrase: colon[0] };
  }
  // «на 2 часа дня» / «в девять утра» / «на 7 вечера»
  const word = text.match(
    /(?:на|в)\s+(\d{1,2}|один|два|три|четыре|пять|шесть|семь|восемь|девять|десять|одиннадцать|двенадцать)\s*(?:часа?|часов)?\s*(утра|дня|вечера|ночи)/
  );
  if (word) {
    let h = NUM_WORDS[word[1]] ?? parseInt(word[1], 10);
    const part = word[2];
    if (h >= 1 && h <= 12) {
      if ((part === "дня" || part === "вечера") && h < 12) h += 12;
      if (part === "ночи" && h === 12) h = 0;
      return { time: `${String(h).padStart(2, "0")}:00`, phrase: word[0] };
    }
  }
  // «на 15 часов» без части суток; «на 2 часа» считаем днём (14:00)
  const plain = text.match(/(?:на|в)\s+(\d{1,2})\s+час(?:а|ов)?(?=\s|$)/);
  if (plain) {
    let h = parseInt(plain[1], 10);
    if (h >= 1 && h <= 7) h += 12;
    if (h >= 8 && h <= 23) return { time: `${String(h).padStart(2, "0")}:00`, phrase: plain[0] };
  }
  return null;
}

/** Пары, к которым относится команда: по фамилии преподавателя или по предмету. */
function findRetimeTargets(text: string, d: AppData, subject: SubjectHit | null): ScheduleEntryLike[] {
  const byTeacher = teacherEntries(text, d);
  if (byTeacher.length) return byTeacher;
  // 2) название предмета
  if (subject) {
    const bySubject = d.schedule.filter((e) => e.subject === subject.name);
    if (bySubject.length) return bySubject;
  }
  return [];
}

/** Пары, у которых фамилия преподавателя совпала с текстом («пару Вороновой» → основа «ворон»). */
function teacherEntries(text: string, d: AppData): ScheduleEntryLike[] {
  return d.schedule.filter((e) => {
    if (!e.teacher) return false;
    const surname = e.teacher.trim().split(/\s+/)[0].toLowerCase();
    if (surname.length < 4) return false;
    const stem = surname.slice(0, Math.max(4, surname.length - 3));
    return new RegExp(`[а-яё]*${stem}[а-яё]*`, "i").test(text);
  });
}

type ScheduleEntryLike = AppData["schedule"][number];

/** Собирает название задачи: убираем действия-паразиты, предмет (все его слова) и дату. */
// NB: \b в JS не работает с кириллицей — границы слов задаём классами символов.
function buildTitle(text: string, subject: SubjectHit | null, datePhrase: string): string {
  let t = ` ${text} `;
  if (subject) {
    stemsOf(subject.name).forEach((k) => {
      t = t.replace(
        new RegExp(`([^а-яё]|^)((по|к|ко|для|с|со|от) )?[а-яё]*${k}[а-яё]*(?=[^а-яё]|$)`, "gi"),
        "$1 "
      );
    });
  }
  if (datePhrase) t = t.replace(datePhrase, " ");
  FILLER.forEach((f) => {
    t = t.replace(new RegExp(`([^а-яё]|^)${f}(?=[^а-яё]|$)`, "gi"), "$1 ");
  });
  t = t.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function parseVoice(raw: string, d: AppData): VoiceResult {
  const text0 = raw.toLowerCase().replace(/[.,!?…]+/g, " ").replace(/\s+/g, " ").trim();
  if (!text0) return { type: "unknown", reason: "Ничего не расслышала — попробуйте ещё раз" };
  // убираем вежливое вступление
  const text = text0.replace(/^(внеси|добавь|запиши|отметь|мне нужно|нужно|надо)\s+/, "");

  const isMove = /перенес|сдвин|передвин/.test(text);
  const isCancel = /отмен[аиюя]|не будет|отменили/.test(text) && !isMove;

  // Предмет по названию или по фамилии преподавателя («пару Вороновой» → Английский)
  let subject = findSubject(text, d);
  if (!subject) {
    const byTeacher = teacherEntries(text, d);
    if (byTeacher.length === 1) subject = { name: byTeacher[0].subject, score: 4, span: byTeacher[0].teacher! };
    else if (byTeacher.length > 1) {
      // несколько пар одного преподавателя одного предмета — тоже ок
      const subs = new Set(byTeacher.map((e) => e.subject));
      if (subs.size === 1) subject = { name: byTeacher[0].subject, score: 4, span: byTeacher[0].teacher! };
    }
  }
  const date = extractDate(text);
  const timeHit = extractTime(text);

  // --- Перенос ВРЕМЕНИ пары (день тот же): «перенеси пару Вороновой на 2 часа дня» ---
  if ((isMove || /поставь|переставь/.test(text)) && timeHit) {
    const rest = text.replace(timeHit.phrase, " ");
    let list = findRetimeTargets(text, d, subject);
    if (!list.length)
      return {
        type: "unknown",
        reason: "Не поняла, какую пару двигать по времени. Назовите предмет или преподавателя, например: «перенеси пару Вороновой на 2 часа дня»",
      };
    // уточнение по дню недели: «пару Шрамковой во вторник…»
    const wdM = matchWeekday(rest);
    if (wdM) {
      const nar = list.filter((e) => e.day === wdM.wd);
      if (nar.length) list = nar;
    }
    // уточнение по текущему началу: «…которая в 17:00…»
    if (list.length > 1) {
      const startM = rest.match(/(?:^|\s)(?:с|со|в)\s*(\d{1,2})[:.\s](\d{2})/);
      if (startM) {
        const st = `${startM[1].padStart(2, "0")}:${startM[2]}`;
        const nar = list.filter((e) => e.start === st);
        if (nar.length) list = nar;
      }
    }
    if (list.length > 1) {
      const opts = list.map((e) => `${DAY_FULL[e.day]} ${e.start}`).join(" и ");
      return {
        type: "unknown",
        reason: `Нашлось несколько пар (${opts}). Уточните, какую именно — скажите день или текущее время начала`,
      };
    }
    const e = list[0];
    const target: RetimeTarget = { id: e.id, day: e.day, start: e.start, end: e.end, subject: e.subject, teacher: e.teacher };
    // названа ли ещё и дата: «перенеси пару Вороновой 5 декабря на 14:00»
    const strongDate = /следующ|эт(у|от|а)\s|через\s+неделю|послезавтра|завтра|сегодня|\d/.test(rest)
      ? extractDate(rest)?.iso
      : undefined;
    if (strongDate) {
      const wdOfDate = fromISO(strongDate).getDay();
      if (wdOfDate === e.day) {
        // разовый перенос времени в этот день
        return { type: "retime", target, toTime: timeHit.time, shiftMin: timeHit.shiftMin, date: strongDate };
      }
      // день другой — это обычный перенос, но с новым временем
      return { type: "move", subjectName: e.subject, fromDate: undefined, toDate: strongDate, dayScope: false, toTime: timeHit.time };
    }
    // даты нет — меняем время пары постоянно
    return { type: "retime", target, toTime: timeHit.time, shiftMin: timeHit.shiftMin };
  }

  // --- Перенос ---
  if (isMove) {
    // «с пятницы» / «со среды» — откуда
    const fromM = text.match(/(?:^|\s)с[о]?\s+([а-яё]+|\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)/);
    let fromDate: string | undefined;
    if (fromM) {
      const wd = weekdayIndex(fromM[1]);
      fromDate = wd !== null ? parseRuDate(weekdayNameForParse(wd))! : parseRuDate(fromM[1]) ?? undefined;
    }
    // «на …» — куда
    const toM = text.match(/\sна\s+(.+)$/);
    let toDate: string | undefined;
    if (toM) {
      const dest = extractDate(toM[1].trim());
      toDate = dest?.iso;
      if (!toDate) {
        const wd = matchWeekday(toM[1]);
        if (wd) toDate = parseRuDate(weekdayNameForParse(wd.wd))!;
      }
    }
    if (!toDate && date?.iso) toDate = date.iso;
    if (!toDate)
      return { type: "unknown", reason: "Не расслышала, НА какой день перенести. Например: «перенеси пару по истории на следующую пятницу»" };
    return {
      type: "move",
      subjectName: subject?.name,
      fromDate,
      toDate,
      dayScope: !subject,
    };
  }

  // --- Отмена ---
  if (isCancel) {
    let iso: string | undefined = date?.iso;
    // «отмени ближайшую пару по истории» → ближайшая пара предмета
    // («отмени сегодняшнюю пару» — берём сегодняшнюю, даже если она идёт или прошла)
    if (!iso && date?.classRef && subject) {
      const nowMin = date.classRef === "today" ? undefined : nowMinutes();
      const first = findNextClass(d, subject.name, todayISO(), 21, nowMin);
      const hit = date.classRef === "skip" && first ? findNextClass(d, subject.name, addDaysISO(first.date, 1)) : first;
      if (hit) iso = hit.date;
    }
    if (!iso && date?.weekOffset !== undefined) iso = addDaysISO(mondayOf(todayISO()), date.weekOffset * 7);
    if (!iso)
      return { type: "unknown", reason: "Не расслышала, какой день отменить. Например: «отмени пары на завтра»" };
    return { type: "cancel", subjectName: subject?.name, date: iso };
  }

  // --- Новая задача ---
  let iso: string | undefined;
  let dateNote: string | undefined;
  if (date?.iso) {
    iso = date.iso;
  } else if (date?.classRef) {
    // «доклад на ближайшую пару по истории России» → дата пары из расписания.
    // Пара, которая сегодня уже идёт или закончилась, — не «следующая»: берём будущую.
    // «Сегодняшняя пара» — наоборот, именно сегодняшняя, в любом её состоянии.
    if (!subject)
      return { type: "unknown", reason: "Не поняла, к какой паре готовиться. Назовите предмет, например: «доклад на ближайшую пару по истории России»" };
    const nowMin = date.classRef === "today" ? undefined : nowMinutes();
    const first = findNextClass(d, subject.name, todayISO(), 21, nowMin);
    const hit = date.classRef === "skip" && first ? findNextClass(d, subject.name, addDaysISO(first.date, 1)) : first;
    if (hit) {
      iso = hit.date;
      dateNote =
        date.classRef === "skip"
          ? `через пару: ${formatShort(hit.date)}`
          : date.classRef === "today"
            ? `сегодняшняя пара: ${formatShort(hit.date)}`
            : `ближайшая пара: ${formatShort(hit.date)}`;
    } else {
      dateNote = "пары по этому предмету в ближайшие 3 недели не вижу — поставьте дату вручную";
    }
  } else if (date?.weekOffset !== undefined && subject) {
    // «на следующей неделе по анатомии» → день пары этого предмета из расписания
    const hit = classOnWeek(d, subject.name, todayISO(), date.weekOffset);
    if (hit) {
      iso = hit.date;
      dateNote = `день пары: ${formatShort(hit.date)}`;
    }
  }
  let title = buildTitle(text, subject, date?.phrase ?? "");
  if (!title && subject) title = `Задание — ${subject.name}`;
  if (!title) title = raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1);

  return {
    type: "task",
    title,
    subjectId: subject?.id,
    subjectName: subject?.name,
    date: iso,
    dateNote,
  };
}

/** Подсказки-примеры для листа голосового ввода. */
export const VOICE_EXAMPLES = [
  "Доклад на ближайшую пару по истории России",
  "Конспект на след пару по анатомии",
  "Перенеси пару Вороновой на 2 часа дня",
  "Перенеси пару по истории культуры на следующую пятницу",
  "Отмени пару Вороновой на субботу",
  "Реферат по этике в выходные",
  "Отмени пары на завтра",
];

export function describeDate(iso?: string): string {
  return iso ? formatShort(iso) : "без даты";
}

export { fromISO, toISO };
