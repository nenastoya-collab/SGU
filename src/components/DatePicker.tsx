// Мини-календарь на месяц для выбора даты: видно дни недели,
// месяц и год подставляются текущие, листать можно стрелками.
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fromISO, toISO, todayISO } from "@/lib/dates";

const MONTHS_NOM = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];
const WD_HEADER = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

export function DatePicker({ onPick }: { onPick: (iso: string) => void }) {
  const now = useMemo(() => fromISO(todayISO()), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const today = todayISO();

  // Сетка дней: недели с понедельника, пустые клетки по краям
  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // 0 = пн
    const out: (string | null)[] = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let day = 1; day <= daysInMonth; day++) out.push(toISO(new Date(year, month, day)));
    return out;
  }, [year, month]);

  const shift = (n: number) => {
    const d = new Date(year, month + n, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  return (
    <div className="card px-3 py-3 select-none">
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          aria-label="Предыдущий месяц"
          className="flex h-10 w-10 items-center justify-center rounded-full cursor-pointer"
          style={{ color: "var(--accent)" }}
          onClick={() => shift(-1)}
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-[15px] font-semibold capitalize" style={{ color: "var(--ink)" }}>
          {MONTHS_NOM[month]} {year}
        </span>
        <button
          type="button"
          aria-label="Следующий месяц"
          className="flex h-10 w-10 items-center justify-center rounded-full cursor-pointer"
          style={{ color: "var(--accent)" }}
          onClick={() => shift(1)}
        >
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WD_HEADER.map((w) => (
          <span key={w} className="text-[11.5px] font-semibold uppercase tracking-wide pb-1" style={{ color: "var(--ink-3)" }}>
            {w}
          </span>
        ))}
        {cells.map((iso, i) =>
          iso === null ? (
            <span key={`e${i}`} />
          ) : (
            <button
              key={iso}
              type="button"
              onClick={() => onPick(iso)}
              className="tnum mx-auto flex h-9 w-9 items-center justify-center rounded-full text-[14.5px] cursor-pointer transition-colors"
              style={{
                color: iso === today ? "var(--on-accent)" : "var(--ink)",
                background: iso === today ? "var(--accent)" : "transparent",
                fontWeight: iso === today ? 700 : 400,
              }}
            >
              {fromISO(iso).getDate()}
            </button>
          )
        )}
      </div>
    </div>
  );
}
