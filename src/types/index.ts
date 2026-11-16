export interface SubjectItem {
  id: string;
  title: string;
  details?: string; // требования, почта, пометки
  date?: string; // ISO yyyy-mm-dd, если есть дедлайн
  done: boolean;
}

export interface Subject {
  id: string;
  name: string;
  teacher?: string;
  note?: string; // направление / кафедра
  notes?: string; // пометки: что нужно для зачёта и т.п.
  items: SubjectItem[];
}

export type WeekParity = "numerator" | "denominator"; // числитель / знаменатель

/** Регулярная пара: день недели + время + фильтр по чётности недели + диапазон дат. */
export interface ScheduleEntry {
  id: string;
  day: number; // 1=пн … 6=сб
  start: string; // "17:20"
  end: string; // "18:40"
  subject: string;
  kind: "лекция" | "практика";
  teacher?: string;
  room?: string;
  weekType: "both" | WeekParity; // каждую неделю / только числитель / только знаменатель
  from?: string; // ISO — первая дата, с которой идёт пара (пусто = всегда)
  to?: string; // ISO — последняя дата (пусто = без конца)
}

/** Отмена конкретного занятия в конкретную дату. */
export interface ScheduleCancel {
  entryId: string;
  date: string; // ISO
}

/** Разовая (перенесённая или добавленная) пара на конкретную дату. */
export interface ExtraClass {
  id: string;
  date: string; // ISO
  start: string;
  end: string;
  subject: string;
  kind: "лекция" | "практика";
  teacher?: string;
  room?: string;
  movedFrom?: string; // ISO даты, откуда перенесли
}

export interface AppData {
  subjects: Subject[];
  schedule: ScheduleEntry[];
  cancels: ScheduleCancel[];
  extras: ExtraClass[];
  settings: {
    parityFlip: boolean; // ручное переключение чётности, если график сдвинут
  };
  schedVersion?: number; // версия сетки расписания — для миграции при обновлениях
}
