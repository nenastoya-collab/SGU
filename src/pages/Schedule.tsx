// Расписание: неделя по дням с учётом числителя/знаменателя, редактирование пар.
import { useMemo, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useAppData, addScheduleEntry, updateScheduleEntry, deleteScheduleEntry, setParityFlip } from "@/lib/store";
import { classesForWeek, mondayOf, addDaysISO, parityOf, parityLabel, rangeLabel } from "@/lib/schedule";
import { formatShort, formatLong, todayISO, parseRuDate, fromISO } from "@/lib/dates";
import { Sheet, SubjectDot, Empty } from "@/components/Bits";
import type { ScheduleEntry } from "@/types";

const DAY_NAMES = ["", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
export const DAY_SHORT = ["", "пн", "вт", "ср", "чт", "пт", "сб"];

export function Schedule() {
  const d = useAppData();
  const [weekOffset, setWeekOffset] = useState(0);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleEntry | null>(null);
  const [presetDay, setPresetDay] = useState<number>(1);

  const monday = addDaysISO(mondayOf(todayISO()), weekOffset * 7);
  const week = useMemo(() => classesForWeek(d, monday), [d, monday]);
  const parity = parityOf(monday, d.settings.parityFlip);

  const openAdd = (day: number) => {
    setEditing(null);
    setPresetDay(day);
    setEditorOpen(true);
  };

  return (
    <div className="screen-enter">
      <header
        className="px-5 pt-6 pb-2"
        style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top))" }}
      >
        <h1 className="text-[32px] font-bold leading-tight tracking-tight" style={{ color: "var(--ink)" }}>
          Расписание
        </h1>
        <div className="mt-1 flex items-center gap-2">
          <p className="text-[15px] tnum" style={{ color: "var(--ink-3)" }}>
            {formatLong(monday)} — {formatLong(addDaysISO(monday, 5))} ·{" "}
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>{parityLabel(parity)}</span>
          </p>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            aria-label="Предыдущая неделя"
            className="flex h-11 w-11 items-center justify-center rounded-full cursor-pointer"
            style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
            onClick={() => setWeekOffset((w) => w - 1)}
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            className="chip flex-1 justify-center"
            data-active={weekOffset === 0}
            onClick={() => setWeekOffset(0)}
          >
            текущая неделя
          </button>
          <button
            type="button"
            aria-label="Следующая неделя"
            className="flex h-11 w-11 items-center justify-center rounded-full cursor-pointer"
            style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
            onClick={() => setWeekOffset((w) => w + 1)}
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <button
          type="button"
          className="mt-2 flex items-center gap-1.5 text-[13px] cursor-pointer min-h-[32px]"
          style={{ color: "var(--ink-3)" }}
          onClick={() => setParityFlip(!d.settings.parityFlip)}
        >
          <RefreshCw size={13} />
          Чётность не совпадает? Нажмите, чтобы переключить
        </button>
      </header>

      <div className="px-4 mt-2 flex flex-col gap-5">
        {week.every((day) => day.classes.length === 0) && (
          <Empty
            icon={<CalendarRange size={44} strokeWidth={1.5} />}
            title="На этой неделе пар нет"
            hint="Добавьте пару кнопкой «+» у нужного дня"
          />
        )}
        {week.map((day) => (
          <section key={day.date} aria-label={`${day.dayLabel}, ${formatShort(day.date)}`}>
            <div className="px-1 mb-2 flex items-center justify-between">
              <h2 className="text-[15px] font-bold" style={{ color: day.date === todayISO() ? "var(--accent)" : "var(--ink)" }}>
                <span className="tnum">{day.dayLabel}, {formatShort(day.date).slice(4)}</span>
                {day.date === todayISO() && (
                  <span className="ml-2 text-[12px] font-semibold uppercase tracking-wide">сегодня</span>
                )}
              </h2>
              <button
                type="button"
                aria-label={`Добавить пару: ${DAY_NAMES[week.indexOf(day) + 1]}`}
                className="flex h-9 w-9 items-center justify-center rounded-full cursor-pointer"
                style={{ background: "var(--surface-2)", color: "var(--accent)" }}
                onClick={() => openAdd(week.indexOf(day) + 1)}
              >
                <Plus size={18} />
              </button>
            </div>
            {day.classes.length > 0 && (
              <div className="card px-4">
                {day.classes.map((c) => {
                  const entry = c.entryId ? d.schedule.find((e) => e.id === c.entryId) : undefined;
                  return (
                    <div key={c.key} className="hairline-b flex items-center gap-3 py-3 min-h-[56px]">
                      <span className="tnum text-[13.5px] font-semibold w-[76px] shrink-0" style={{ color: "var(--ink-2)" }}>
                        {c.start}–{c.end}
                      </span>
                      <SubjectDot name={c.subject} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-[15.5px] font-medium leading-snug" style={{ color: "var(--ink)" }}>
                          {c.subject}
                        </span>
                        <span className="block text-[12.5px] truncate" style={{ color: "var(--ink-3)" }}>
                          {[c.kind, c.room, c.teacher].filter(Boolean).join(" · ")}
                          {c.movedFrom && " · перенесена"}
                          {entry && rangeLabel(entry) && (
                            <span className="tnum"> · {rangeLabel(entry)}</span>
                          )}
                        </span>
                      </span>
                      {entry && (
                        <button
                          type="button"
                          aria-label={`Изменить пару: ${c.subject}`}
                          className="flex w-[44px] h-[44px] items-center justify-center cursor-pointer"
                          style={{ color: "var(--ink-3)" }}
                          onClick={() => {
                            setEditing(entry);
                            setEditorOpen(true);
                          }}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>

      <EntryEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        editing={editing}
        presetDay={presetDay}
      />
    </div>
  );
}

// --- Лист редактирования пары ---

export function EntryEditor({
  open,
  onClose,
  editing,
  presetDay,
  presetSubject,
}: {
  open: boolean;
  onClose: () => void;
  editing: ScheduleEntry | null;
  presetDay: number;
  /** Предмет по умолчанию (например, при добавлении пары из окна предмета). */
  presetSubject?: string;
}) {
  const d = useAppData();
  const [day, setDay] = useState(presetDay);
  const [start, setStart] = useState("17:20");
  const [end, setEnd] = useState("18:40");
  const [subject, setSubject] = useState("");
  const [kind, setKind] = useState<"лекция" | "практика">("лекция");
  const [teacher, setTeacher] = useState("");
  const [room, setRoom] = useState("");
  const [weekType, setWeekType] = useState<ScheduleEntry["weekType"]>("both");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [tried, setTried] = useState(false);

  const toDisplay = (iso?: string) => {
    if (!iso) return "";
    const d = fromISO(iso);
    return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
  };

  useMemo(() => {
    if (open) {
      setDay(editing?.day ?? presetDay);
      setStart(editing?.start ?? "17:20");
      setEnd(editing?.end ?? "18:40");
      setSubject(editing?.subject ?? presetSubject ?? "");
      setKind(editing?.kind ?? "лекция");
      setTeacher(editing?.teacher ?? "");
      setRoom(editing?.room ?? "");
      setWeekType(editing?.weekType ?? "both");
      setFromDate(toDisplay(editing?.from));
      setToDate(toDisplay(editing?.to));
      setTried(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  // «01.09» без года parseRuDate переносит в будущее — для начала курса это
  // ломает диапазон «с 01.09 по 20.12». Если начало оказалось позже конца,
  // пробуем понять начало в текущем году.
  const toParsed = toDate.trim() ? parseRuDate(toDate) : null;
  let fromParsed = fromDate.trim() ? parseRuDate(fromDate) : null;
  if (fromParsed && toParsed && fromParsed > toParsed) {
    const thisYear = parseRuDate(`${fromDate.trim()} ${new Date().getFullYear()}`);
    if (thisYear && thisYear <= toParsed) fromParsed = thisYear;
  }
  const rangeBad =
    Boolean(fromDate.trim() && !fromParsed) ||
    Boolean(toDate.trim() && !toParsed) ||
    Boolean(fromParsed && toParsed && fromParsed > toParsed);

  const ok =
    subject.trim().length > 0 &&
    /^\d{1,2}:\d{2}$/.test(start) &&
    /^\d{1,2}:\d{2}$/.test(end) &&
    !rangeBad;

  const save = () => {
    setTried(true);
    if (!ok) return;
    const payload = {
      day,
      start,
      end,
      subject: subject.trim(),
      kind,
      teacher: teacher.trim(),
      room: room.trim(),
      weekType,
      from: fromParsed ?? undefined,
      to: toParsed ?? undefined,
    };
    if (editing) updateScheduleEntry(editing.id, payload);
    else addScheduleEntry(payload);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={editing ? "Изменить пару" : "Новая пара"}>
      <div className="flex flex-col gap-4">
        <div>
          <span className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
            День недели
          </span>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6].map((wd) => (
              <button key={wd} type="button" className="chip" data-active={day === wd} onClick={() => setDay(wd)}>
                {DAY_SHORT[wd]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="se-start" className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
              Начало
            </label>
            <input id="se-start" className="field tnum" inputMode="numeric" value={start} onChange={(e) => setStart(e.target.value)} placeholder="17:20" />
          </div>
          <div className="flex-1">
            <label htmlFor="se-end" className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
              Конец
            </label>
            <input id="se-end" className="field tnum" inputMode="numeric" value={end} onChange={(e) => setEnd(e.target.value)} placeholder="18:40" />
          </div>
        </div>

        <div>
          <label htmlFor="se-subject" className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
            Предмет
          </label>
          {d.subjects.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {d.subjects.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="chip"
                  data-active={subject === s.name}
                  onClick={() => setSubject(s.name)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
          <input id="se-subject" className="field" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Анатомия" />
          {tried && !subject.trim() && (
            <p className="mt-1 text-sm" style={{ color: "var(--danger)" }}>Укажите предмет</p>
          )}
        </div>

        <div>
          <span className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
            Тип
          </span>
          <div className="flex gap-2">
            {(["лекция", "практика"] as const).map((k) => (
              <button key={k} type="button" className="chip" data-active={kind === k} onClick={() => setKind(k)}>
                {k}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="se-teacher" className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
            Преподаватель <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>(необязательно)</span>
          </label>
          <input id="se-teacher" className="field" value={teacher} onChange={(e) => setTeacher(e.target.value)} />
        </div>

        <div>
          <label htmlFor="se-room" className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
            Кабинет <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>(необязательно)</span>
          </label>
          <input id="se-room" className="field" value={room} onChange={(e) => setRoom(e.target.value)} placeholder="5 корпус, 61" />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="se-from" className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
              Первая дата <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>(необяз.)</span>
            </label>
            <input id="se-from" className="field tnum" inputMode="numeric" value={fromDate} onChange={(e) => setFromDate(e.target.value)} placeholder="27.11" />
          </div>
          <div className="flex-1">
            <label htmlFor="se-to" className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
              Последняя дата <span style={{ color: "var(--ink-3)", fontWeight: 400 }}>(необяз.)</span>
            </label>
            <input id="se-to" className="field tnum" inputMode="numeric" value={toDate} onChange={(e) => setToDate(e.target.value)} placeholder="18.12" />
          </div>
        </div>
        <p className="-mt-2 text-[12.5px]" style={{ color: tried && rangeBad ? "var(--danger)" : "var(--ink-3)" }}>
          {tried && rangeBad
            ? "Проверьте даты: формат «27.11» или «27 ноября», начало раньше конца"
            : "Курс идёт не весь семестр — укажите границы; пусто = пара идёт всегда"}
        </p>
        <p className="-mt-2 text-[12.5px]" style={{ color: "var(--ink-3)" }}>
          Ходите на английский к другому преподавателю? Нажмите на пару карандашиком → поменяйте преподавателя и время.
        </p>

        <div>
          <span className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
            Какие недели
          </span>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["both", "каждую"],
                ["numerator", "числитель"],
                ["denominator", "знаменатель"],
              ] as const
            ).map(([v, label]) => (
              <button key={v} type="button" className="chip" data-active={weekType === v} onClick={() => setWeekType(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mt-2">
          {editing && (
            <button
              type="button"
              aria-label="Удалить пару"
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl cursor-pointer transition-transform active:scale-95"
              style={{ background: "var(--danger-soft)", color: "var(--danger)" }}
              onClick={() => {
                deleteScheduleEntry(editing.id);
                onClose();
              }}
            >
              <Trash2 size={20} />
            </button>
          )}
          <button type="button" className="btn-primary flex-1" onClick={save}>
            {editing ? "Сохранить" : "Добавить"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
