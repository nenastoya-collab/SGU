// Расписание: чётность недель и выборки пар по датам.
import type { AppData, ScheduleEntry, WeekParity } from "@/types";
import { formatLong, fromISO, toISO } from "./dates";

// Неделя, содержащая 1 сентября 2026 (пн 31.08 — вс 06.09), — 1-я, числитель.
import { PARITY_ANCHOR } from "./config";

// Чётность недели считается от понедельника-якоря из config.ts.
const ANCHOR = PARITY_ANCHOR;

export function weekNumber(iso: string): number {
  const diff = fromISO(iso).getTime() - fromISO(ANCHOR).getTime();
  return Math.floor(diff / (7 * 86400000)) + 1;
}

export function parityOf(iso: string, flip: boolean): WeekParity {
  let p: WeekParity = weekNumber(iso) % 2 === 1 ? "numerator" : "denominator";
  if (flip) p = p === "numerator" ? "denominator" : "numerator";
  return p;
}

export function parityLabel(p: WeekParity): string {
  return p === "numerator" ? "числитель" : "знаменатель";
}

/** Понедельник недели, в которую попадает дата. */
export function mondayOf(iso: string): string {
  const d = fromISO(iso);
  const wd = d.getDay() === 0 ? 7 : d.getDay(); // вс → 7
  d.setDate(d.getDate() - (wd - 1));
  return toISO(d);
}

export function addDaysISO(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

const DAY_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

export interface ClassOnDate {
  key: string; // entryId или extraId
  entryId?: string; // есть, если это регулярная пара
  subject: string;
  kind: "лекция" | "практика";
  start: string;
  end: string;
  teacher?: string;
  room?: string;
  movedFrom?: string;
}

/** Пара действует на дату: попадает в диапазон from–to (пустые края = без ограничений). */
export function inRange(e: ScheduleEntry, iso: string): boolean {
  if (e.from && iso < e.from) return false;
  if (e.to && iso > e.to) return false;
  return true;
}

/** Компактная подпись диапазона: «27.11–18.12», «с 27 ноября», «до 18 декабря». */
export function rangeLabel(e: ScheduleEntry): string {
  const short = (iso: string) => {
    const d = fromISO(iso);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  };
  if (e.from && e.to) return `${short(e.from)}–${short(e.to)}`;
  if (e.from) return `с ${formatLong(e.from)}`;
  if (e.to) return `до ${formatLong(e.to)}`;
  return "";
}

/** Все пары на конкретную дату (регулярные с учётом чётности, диапазона дат и отмен + разовые). */
export function classesForDate(d: AppData, iso: string): ClassOnDate[] {
  const wd = fromISO(iso).getDay(); // 0=вс … 6=сб
  const out: ClassOnDate[] = [];
  if (wd !== 0) {
    const parity = parityOf(iso, d.settings.parityFlip);
    d.schedule
      .filter(
        (e) =>
          e.day === wd &&
          (e.weekType === "both" || e.weekType === parity) &&
          inRange(e, iso) &&
          !d.cancels.some((c) => c.entryId === e.id && c.date === iso)
      )
      .forEach((e) =>
        out.push({
          key: e.id,
          entryId: e.id,
          subject: e.subject,
          kind: e.kind,
          start: e.start,
          end: e.end,
          teacher: e.teacher,
          room: e.room,
        })
      );
  }
  d.extras
    .filter((x) => x.date === iso)
    .forEach((x) =>
      out.push({
        key: x.id,
        subject: x.subject,
        kind: x.kind,
        start: x.start,
        end: x.end,
        teacher: x.teacher,
        room: x.room,
        movedFrom: x.movedFrom,
      })
    );
  return out.sort((a, b) => (a.start < b.start ? -1 : 1));
}

/** Пары на неделю (пн–сб), начиная с понедельника mondayISO. */
export function classesForWeek(
  d: AppData,
  mondayISO: string
): { date: string; dayLabel: string; classes: ClassOnDate[] }[] {
  const res = [];
  for (let i = 0; i < 6; i++) {
    const iso = addDaysISO(mondayISO, i);
    const wd = fromISO(iso).getDay();
    res.push({
      date: iso,
      dayLabel: DAY_SHORT[wd],
      classes: classesForDate(d, iso),
    });
  }
  return res;
}

/** Ближайшая будущая пара по названию предмета (для голосовых команд). */
export function findNextClass(
  d: AppData,
  subjectQuery: string,
  fromISOdate: string,
  withinDays = 21,
  nowMinutes?: number // текущее время в минутах от полуночи — для «сегодня»
): { date: string; cls: ClassOnDate } | null {
  const q = subjectQuery.toLowerCase();
  for (let i = 0; i <= withinDays; i++) {
    const iso = addDaysISO(fromISOdate, i);
    const hit = classesForDate(d, iso).find((c) => {
      if (!(c.subject.toLowerCase().includes(q) || q.includes(c.subject.toLowerCase()))) return false;
      // Правило «ближайшей пары»: как только сегодня НАЧАЛАСЬ первая пара предмета,
      // все сегодняшние его пары перестают быть «ближайшими» — берём следующий день с парами.
      // (Сюда nowMinutes передают только для поиска «ближайшей/следующей» пары;
      //  «сегодняшнюю» ищут без него — тогда сегодняшние пары доступны весь день.)
      if (i === 0 && nowMinutes !== undefined) {
        const startMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
        const todays = classesForDate(d, iso).filter((x) => x.subject.toLowerCase().includes(q) || q.includes(x.subject.toLowerCase()));
        const firstStart = Math.min(...todays.map((x) => startMin(x.start)));
        if (firstStart <= nowMinutes) return false; // первая пара уже началась → сегодня ничего не берём
        // первая ещё не началась → берём самую первую сегодняшнюю
        return startMin(c.start) === firstStart;
      }
      return true;
    });
    if (hit) return { date: iso, cls: hit };
  }
  return null;
}

/** Ближайшая пара предмета на неделе со смещением weekOffset (0 = эта, 1 = следующая). */
export function classOnWeek(
  d: AppData,
  subjectQuery: string,
  fromISOdate: string,
  weekOffset: 0 | 1
): { date: string; cls: ClassOnDate } | null {
  const mon = addDaysISO(mondayOf(fromISOdate), weekOffset * 7);
  for (let i = 0; i < 6; i++) {
    const iso = addDaysISO(mon, i);
    if (weekOffset === 0 && iso < fromISOdate) continue;
    const q = subjectQuery.toLowerCase();
    const hit = classesForDate(d, iso).find((c) => c.subject.toLowerCase().includes(q) || q.includes(c.subject.toLowerCase()));
    if (hit) return { date: iso, cls: hit };
  }
  return null;
}

export function isCancelled(d: AppData, entryId: string, iso: string): boolean {
  return d.cancels.some((c) => c.entryId === entryId && c.date === iso);
}

/** Период предмета в семестре: дата последней пары из расписания («до 15 дек»).
 *  Ищем по всем записям расписания с этим названием предмета (с учётом диапазонов from/to). */
export function subjectEndDate(d: AppData, subjectName: string): string | null {
  const q = subjectName.toLowerCase();
  let last: string | null = null;
  for (const e of d.schedule) {
    if (!(e.subject.toLowerCase().includes(q) || q.includes(e.subject.toLowerCase()))) continue;
    // Конкретный конец диапазона важнее; если диапазона нет — предмет «бессрочный», его не учитываем
    const end = e.to ?? null;
    if (end && (last === null || end > last)) last = end;
  }
  return last;
}

/** Сдвигает «HH:MM» на mins минут (для относительных переносов «на час позже»). */
export function shiftTime(t: string, mins: number): string {
  const [h, m] = t.split(":").map(Number);
  const total = Math.min(Math.max(h * 60 + m + mins, 0), 23 * 60 + 59);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Новое начало пары с сохранением длительности: 15:35–17:10 на 14:00 → 14:00–15:35. */
export function withNewStart(start: string, end: string, newStart: string): { start: string; end: string } {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const dur = Math.max(toMin(end) - toMin(start), 30);
  return { start: newStart, end: shiftTime(newStart, dur) };
}
