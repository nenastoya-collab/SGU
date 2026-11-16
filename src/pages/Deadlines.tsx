// Дедлайны: все НЕСДЕЛАННЫЕ пункты с датами по хронологии,
// а ниже — раздел «Без даты»: пункты, которым дату ещё не назначили.
// Сделанные здесь не показываем — они остаются видны внутри предмета.
import { CalendarDays } from "lucide-react";
import { useAppData, datedEntries } from "@/lib/store";
import { daysUntil, relLabel, formatShort } from "@/lib/dates";
import { DateBadge, SubjectDot, Empty } from "@/components/Bits";

export function Deadlines({ onOpenSubject }: { onOpenSubject: (id: string) => void }) {
  const d = useAppData();
  const all = datedEntries(d).filter((e) => !e.item.done);

  // Группируем по дате
  const groups: { date: string; entries: typeof all }[] = [];
  all.forEach((e) => {
    const g = groups.find((g) => g.date === e.item.date);
    if (g) g.entries.push(e);
    else groups.push({ date: e.item.date!, entries: [e] });
  });

  // Пункты без даты: не теряются. Дату ставим внутри пункта (карандашик), как обычно.
  const undated = d.subjects.flatMap((s) =>
    s.items
      .filter((it) => !it.done && !it.date)
      .map((it) => ({ subjectId: s.id, subjectName: s.name, item: it }))
  );

  return (
    <div className="screen-enter">
      <header className="px-5 pt-6 pb-2" style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top))" }}>
        <h1 className="text-[32px] font-bold leading-tight tracking-tight" style={{ color: "var(--ink)" }}>
          Дедлайны
        </h1>
        <p className="mt-1 text-[15px]" style={{ color: "var(--ink-3)" }}>
          все даты по всем предметам
        </p>
      </header>

      <div className="px-4 mt-4 flex flex-col gap-5">
        {groups.length === 0 && undated.length === 0 ? (
          <Empty
            icon={<CalendarDays size={44} strokeWidth={1.5} />}
            title="Дат пока нет"
            hint="Добавьте дату к любому пункту — и она появится здесь"
          />
        ) : (
          <>
            {groups.map((g) => {
              const n = daysUntil(g.date);
              const urgent = n < 0 ? "over" : n <= 7 ? "soon" : "ok";
              return (
                <section key={g.date} aria-label={formatShort(g.date)}>
                  <div className="px-1 mb-2 flex items-center gap-2.5">
                    <h2 className="text-[15px] font-bold tnum" style={{ color: "var(--ink)" }}>
                      {formatShort(g.date)}
                    </h2>
                    <DateBadge label={relLabel(g.date)} urgent={urgent} />
                  </div>
                  <div className="card">
                    {g.entries.map((e) => (
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
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}

            {undated.length > 0 && (
              <section aria-label="Без даты">
                <div className="px-1 mb-2 flex items-center gap-2.5">
                  <h2 className="text-[15px] font-bold" style={{ color: "var(--ink)" }}>
                    Без даты
                  </h2>
                </div>
                <div className="card">
                  {undated.map((e) => (
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
                    </button>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
