// Главная: сводка и ближайшие даты — с сегодня до конца следующей календарной недели.
// Просроченные (дата раньше сегодня) — отдельным блоком. Всё остальное — во вкладке «Дедлайны».
import { CalendarClock } from "lucide-react";
import { useAppData, datedEntries, totals } from "@/lib/store";
import { daysUntil, relLabel, formatLong, todayISO, plural, addDays } from "@/lib/dates";
import { classesForDate, mondayOf } from "@/lib/schedule";
import { DateBadge, SubjectDot } from "@/components/Bits";
import { Backup } from "@/components/Backup";

export function Home({ onOpenSubject }: { onOpenSubject: (id: string) => void }) {
  const d = useAppData();
  const t = totals(d);

  // Пары сегодня, а если их нет — ближайший день с парами
  const todayClasses = classesForDate(d, todayISO());
  let classesDay: { label: string; date: string; list: typeof todayClasses } | null = null;
  if (todayClasses.length > 0) {
    classesDay = { label: "Пары сегодня", date: todayISO(), list: todayClasses };
  } else {
    for (let i = 1; i <= 6; i++) {
      const iso = addDays(todayISO(), i);
      const list = classesForDate(d, iso);
      if (list.length > 0) {
        classesDay = { label: i === 1 ? "Пары завтра" : `Ближайшие пары — ${relLabel(iso)}`, date: iso, list };
        break;
      }
    }
  }

  // Конец следующей календарной недели (воскресенье): понедельник этой недели + 13 дней
  const today = todayISO();
  const endOfNextWeek = addDays(mondayOf(today), 13);

  // Дела периода: невыполненные, дата от сегодня до конца следующей календарной недели
  // (просроченные сюда не входят — они отдельным блоком ниже)
  const period = datedEntries(d).filter(
    (e) => !e.item.done && e.item.date! >= today && e.item.date! <= endOfNextWeek
  );

  // Ближайшие невыполненные даты периода (с сегодня по конец следующей недели)
  const upcoming = period;

  // Просроченные: дата раньше сегодняшнего дня, не сделано (любые старые, без ограничения)
  const overdue = datedEntries(d).filter((e) => !e.item.done && e.item.date! < today);

  return (
    <div className="screen-enter">
      {/* Приветствие */}
      <header className="px-5 pt-6 pb-2" style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top))" }}>
        <p className="text-[15px] font-medium tnum" style={{ color: "var(--ink-3)" }}>
          {formatLong(todayISO())}
        </p>
        <h1 className="mt-1 text-[32px] font-bold leading-tight tracking-tight" style={{ color: "var(--ink)" }}>
          {period.length === 0 && overdue.length === 0 ? "Ближайших дат нет" : (
            <>
              Ближайшие две недели: <span className="tnum">{period.length}</span>{" "}
              {plural(period.length, "дело", "дела", "дел")}
            </>
          )}
        </h1>
        {overdue.length > 0 ? (
          <p className="mt-1 text-[15px] tnum" style={{ color: "var(--danger)" }}>
            просрочено: {overdue.length}
          </p>
        ) : period.length === 0 && t.left > 0 ? (
          <p className="mt-1 text-[15px]" style={{ color: "var(--ink-3)" }}>
            но есть дела без дат — загляните в Дедлайны
          </p>
        ) : null}
      </header>

      <div className="px-4 flex flex-col gap-6 mt-4">
        {/* Пары сегодня / ближайшие */}
        {classesDay && (
          <section aria-label={classesDay.label}>
            <h2 className="px-1 mb-2 text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--ink-3)" }}>
              {classesDay.label}
            </h2>
            <div className="card">
              {classesDay.list.map((c) => (
                <div key={c.key} className="hairline-b flex items-center gap-3 px-4 py-3 min-h-[52px]">
                  <span className="tnum text-[13px] font-semibold w-[72px] shrink-0" style={{ color: "var(--ink-2)" }}>
                    {c.start}–{c.end}
                  </span>
                  <SubjectDot name={c.subject} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[15.5px] font-medium leading-snug" style={{ color: "var(--ink)" }}>
                      {c.subject}
                    </span>
                    <span className="block text-[12.5px] truncate" style={{ color: "var(--ink-3)" }}>
                      {[c.kind, c.room].filter(Boolean).join(" · ")}
                      {c.movedFrom && " · перенесена"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Просрочено */}
        {overdue.length > 0 && (
          <section aria-label="Просроченное">
            <h2 className="px-1 mb-2 text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--danger)" }}>
              Просрочено
            </h2>
            <div className="card divide-y-0">
              {overdue.map((e) => (
                <button
                  key={e.item.id}
                  type="button"
                  onClick={() => onOpenSubject(e.subjectId)}
                  className="hairline-b flex w-full items-center gap-3 px-4 py-3.5 text-left cursor-pointer min-h-[56px]"
                >
                  <SubjectDot name={e.subjectName} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-[16px] leading-snug" style={{ color: "var(--ink)" }}>
                      {e.item.title}
                    </span>
                    <span className="block text-[13px]" style={{ color: "var(--ink-3)" }}>
                      {e.subjectName}
                    </span>
                  </span>
                  <DateBadge label={relLabel(e.item.date!)} urgent="over" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Ближайшие даты */}
        <section aria-label="Ближайшие даты">
          <h2 className="px-1 mb-2 text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--ink-3)" }}>
            Ближайшие даты
          </h2>
          {upcoming.length === 0 ? (
            <div className="card px-5 py-6 flex items-center gap-3">
              <CalendarClock size={22} style={{ color: "var(--ink-3)" }} />
              <p className="text-[15px]" style={{ color: "var(--ink-3)" }}>
                На ближайшие две недели ничего нет — даты подальше смотрите во вкладке «Дедлайны»
              </p>
            </div>
          ) : (
            <div className="card">
              {upcoming.map((e) => {
                const n = daysUntil(e.item.date!);
                return (
                  <button
                    key={e.item.id}
                    type="button"
                    onClick={() => onOpenSubject(e.subjectId)}
                    className="hairline-b flex w-full items-center gap-3 px-4 py-3.5 text-left cursor-pointer min-h-[56px]"
                  >
                    <SubjectDot name={e.subjectName} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[16px] leading-snug" style={{ color: "var(--ink)" }}>
                        {e.item.title}
                      </span>
                      <span className="block text-[13px]" style={{ color: "var(--ink-3)" }}>
                        {e.subjectName}
                      </span>
                    </span>
                    <DateBadge label={relLabel(e.item.date!)} urgent={n <= 2 ? "soon" : "ok"} />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <Backup />
      </div>
    </div>
  );
}
