// Хранилище: все данные живут на устройстве (localStorage).
import { useSyncExternalStore } from "react";
import type { AppData, ScheduleEntry, Subject, SubjectItem } from "@/types";
import { seedData, seedSchedule, ANATOMY_TOPICS, SCHED_VERSION } from "./seed";
import { withNewStart } from "./schedule";

const KEY = "study-helper-v2";

let data: AppData = load();
const listeners = new Set<() => void>();

function load(): AppData {
  let parsed: AppData | null = null;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p.subjects)) parsed = p as AppData;
    }
  } catch {
    // повреждённые данные — загружаем начальные
  }
  if (!parsed) {
    const fresh = seedData();
    localStorage.setItem(KEY, JSON.stringify(fresh));
    return fresh;
  }
  return migrate(parsed);
}

// Догружаем новые поля и контент в уже существующие данные пользователя.
function migrate(d: AppData): AppData {
  let changed = false;
  if (!Array.isArray(d.schedule)) {
    d.schedule = seedSchedule();
    changed = true;
  }
  if (!Array.isArray(d.cancels)) {
    d.cancels = [];
    changed = true;
  }
  if (!Array.isArray(d.extras)) {
    d.extras = [];
    changed = true;
  }
  if (!d.settings) {
    d.settings = { parityFlip: false };
    changed = true;
  }
  // Сетка расписания: обновляем до актуальной версии.
  // Совпадающие слоты (день+время+предмет) сохраняют старый id — переносы и отмены не слетают;
  // записи, добавленные пользователем вручную (длинные случайные id), не трогаем.
  if (d.schedVersion !== SCHED_VERSION) {
    const old = Array.isArray(d.schedule) ? d.schedule : [];
    const fresh = seedSchedule();
    const slotKey = (e: ScheduleEntry) => `${e.day}|${e.start}|${e.subject}`;
    const oldBySlot = new Map(old.map((e) => [slotKey(e), e]));
    const usedOld = new Set<string>();
    const merged = fresh.map((e) => {
      const o = oldBySlot.get(slotKey(e));
      if (o && !usedOld.has(o.id)) {
        usedOld.add(o.id);
        return { ...e, id: o.id };
      }
      return e;
    });
    const isSeedId = (id: string) => /^sc[0-9a-z]{1,2}$/.test(id);
    const userEntries = old.filter((e) => !isSeedId(e.id));
    d.schedule = [...merged, ...userEntries];
    const keptIds = new Set(d.schedule.map((e) => e.id));
    d.cancels = (Array.isArray(d.cancels) ? d.cancels : []).filter((c) => keptIds.has(c.entryId));
    d.schedVersion = SCHED_VERSION;
    changed = true;
  }
  // Темы по анатомии — добавляем тем, у кого предмет уже был создан раньше
  const anatomy = d.subjects.find((s) => s.name.toLowerCase().includes("анатом"));
  if (anatomy && !anatomy.items.some((i) => i.title.includes("Нейроглия"))) {
    ANATOMY_TOPICS.forEach((t) => {
      anatomy.items.push({ id: uid(), title: t.title, details: t.details, done: t.done });
    });
    if (!anatomy.notes) anatomy.notes = "Экзамен 16 января — готовить все темы из программы ниже.";
    changed = true;
  }
  // Новые предметы из заготовки — добавляем тем, у кого их ещё нет.
  // Существующие предметы не трогаем: там могут быть отметки и свои пункты.
  const seed = seedData();
  for (const s of seed.subjects) {
    if (!d.subjects.some((x) => x.name === s.name)) {
      d.subjects.push(s);
      changed = true;
    }
  }
  if (changed) localStorage.setItem(KEY, JSON.stringify(d));
  return d;
}

function save() {
  localStorage.setItem(KEY, JSON.stringify(data));
}

function emit() {
  save();
  listeners.forEach((l) => l());
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

export function useAppData(): AppData {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => data,
    () => data
  );
}

// --- Предметы ---

export function addSubject(s: Omit<Subject, "id" | "items">): string {
  const newId = uid();
  data = { ...data, subjects: [...data.subjects, { ...s, id: newId, items: [] }] };
  emit();
  return newId;
}

export function updateSubject(id: string, patch: Partial<Omit<Subject, "id" | "items">>) {
  data = {
    ...data,
    subjects: data.subjects.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  };
  emit();
}

export function deleteSubject(id: string) {
  data = { ...data, subjects: data.subjects.filter((s) => s.id !== id) };
  emit();
}

// --- Пункты внутри предмета ---

export function addItem(subjectId: string, item: Omit<SubjectItem, "id" | "done">) {
  data = {
    ...data,
    subjects: data.subjects.map((s) =>
      s.id === subjectId ? { ...s, items: [...s.items, { ...item, id: uid(), done: false }] } : s
    ),
  };
  emit();
}

export function updateItem(subjectId: string, itemId: string, patch: Partial<SubjectItem>) {
  data = {
    ...data,
    subjects: data.subjects.map((s) =>
      s.id === subjectId
        ? { ...s, items: s.items.map((it) => (it.id === itemId ? { ...it, ...patch } : it)) }
        : s
    ),
  };
  emit();
}

export function deleteItem(subjectId: string, itemId: string) {
  data = {
    ...data,
    subjects: data.subjects.map((s) =>
      s.id === subjectId ? { ...s, items: s.items.filter((it) => it.id !== itemId) } : s
    ),
  };
  emit();
}

// --- Расписание ---

export function addScheduleEntry(e: Omit<ScheduleEntry, "id">) {
  data = { ...data, schedule: [...data.schedule, { ...e, id: uid() }] };
  emit();
}

export function updateScheduleEntry(id: string, patch: Partial<Omit<ScheduleEntry, "id">>) {
  data = {
    ...data,
    schedule: data.schedule.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  };
  emit();
}

export function deleteScheduleEntry(id: string) {
  data = {
    ...data,
    schedule: data.schedule.filter((e) => e.id !== id),
    cancels: data.cancels.filter((c) => c.entryId !== id),
  };
  emit();
}

/** Отменить регулярную пару в конкретную дату. */
export function cancelOccurrence(entryId: string, date: string) {
  if (data.cancels.some((c) => c.entryId === entryId && c.date === date)) return;
  data = { ...data, cancels: [...data.cancels, { entryId, date }] };
  emit();
}

/** Перенести пару с даты на дату (отмена + разовая пара). newStart — если заодно меняется время. */
export function moveOccurrence(entryId: string, fromDate: string, toDate: string, newStart?: string) {
  const entry = data.schedule.find((e) => e.id === entryId);
  if (!entry) return;
  const span = newStart ? withNewStart(entry.start, entry.end, newStart) : { start: entry.start, end: entry.end };
  const cancels = data.cancels.some((c) => c.entryId === entryId && c.date === fromDate)
    ? data.cancels
    : [...data.cancels, { entryId, date: fromDate }];
  data = {
    ...data,
    cancels,
    extras: [
      ...data.extras,
      {
        id: uid(),
        date: toDate,
        start: span.start,
        end: span.end,
        subject: entry.subject,
        kind: entry.kind,
        teacher: entry.teacher,
        room: entry.room,
        movedFrom: fromDate,
      },
    ],
  };
  emit();
}

/** Перенести пару по времени только в конкретную дату (отмена + разовая в тот же день). */
export function retimeOccurrence(entryId: string, date: string, newStart: string) {
  const entry = data.schedule.find((e) => e.id === entryId);
  if (!entry) return;
  const span = withNewStart(entry.start, entry.end, newStart);
  const cancels = data.cancels.some((c) => c.entryId === entryId && c.date === date)
    ? data.cancels
    : [...data.cancels, { entryId, date }];
  data = {
    ...data,
    cancels,
    extras: [
      ...data.extras,
      {
        id: uid(),
        date,
        start: span.start,
        end: span.end,
        subject: entry.subject,
        kind: entry.kind,
        teacher: entry.teacher,
        room: entry.room,
        movedFrom: date,
      },
    ],
  };
  emit();
}

export function setParityFlip(flip: boolean) {
  data = { ...data, settings: { ...data.settings, parityFlip: flip } };
  emit();
}

// --- Выборки ---

export interface DatedEntry {
  subjectId: string;
  subjectName: string;
  item: SubjectItem;
}

/** Все пункты с датами, по хронологии. */
export function datedEntries(d: AppData): DatedEntry[] {
  const out: DatedEntry[] = [];
  d.subjects.forEach((s) =>
    s.items.forEach((it) => {
      if (it.date) out.push({ subjectId: s.id, subjectName: s.name, item: it });
    })
  );
  return out.sort((a, b) => (a.item.date! < b.item.date! ? -1 : 1));
}

export function totals(d: AppData) {
  let done = 0;
  let all = 0;
  d.subjects.forEach((s) => {
    all += s.items.length;
    done += s.items.filter((i) => i.done).length;
  });
  return { done, all, left: all - done };
}

// --- Резервная копия ---

export function exportJSON(): string {
  return JSON.stringify({ app: "study-helper", version: 3, data }, null, 2);
}

/** Проверяет и применяет данные из файла. Возвращает число предметов или null при ошибке. */
export function importJSON(json: string): number | null {
  try {
    const parsed = JSON.parse(json);
    const subjects = parsed?.data?.subjects;
    if (!Array.isArray(subjects)) return null;
    const valid = subjects.every(
      (s: unknown) =>
        typeof s === "object" &&
        s !== null &&
        typeof (s as Subject).name === "string" &&
        Array.isArray((s as Subject).items)
    );
    if (!valid) return null;
    data = migrate({
      subjects,
      schedule: parsed.data.schedule,
      cancels: parsed.data.cancels,
      extras: parsed.data.extras,
      settings: parsed.data.settings,
    });
    emit();
    return subjects.length;
  } catch {
    return null;
  }
}
