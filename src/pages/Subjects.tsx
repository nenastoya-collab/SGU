// Предметы: список всех дисциплин с прогрессом.
import { useState } from "react";
import { BookOpen, ChevronRight, Plus } from "lucide-react";
import { useAppData } from "@/lib/store";
import { ProgressBar, SubjectDot, Empty } from "@/components/Bits";
import { SubjectSheet } from "@/components/SubjectSheet";
import { plural } from "@/lib/dates";

export function Subjects({ onOpenSubject }: { onOpenSubject: (id: string) => void }) {
  const d = useAppData();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="screen-enter">
      <header
        className="px-5 pt-6 pb-2 flex items-end justify-between"
        style={{ paddingTop: "calc(1.5rem + env(safe-area-inset-top))" }}
      >
        <div>
          <h1 className="text-[32px] font-bold leading-tight tracking-tight" style={{ color: "var(--ink)" }}>
            Предметы
          </h1>
          <p className="mt-1 text-[15px] tnum" style={{ color: "var(--ink-3)" }}>
            {d.subjects.length} {plural(d.subjects.length, "дисциплина", "дисциплины", "дисциплин")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          aria-label="Добавить предмет"
          className="flex h-11 w-11 items-center justify-center rounded-full cursor-pointer transition-transform active:scale-95"
          style={{ background: "var(--accent)", color: "var(--on-accent)" }}
        >
          <Plus size={22} />
        </button>
      </header>

      <div className="px-4 mt-4">
        {d.subjects.length === 0 ? (
          <Empty
            icon={<BookOpen size={44} strokeWidth={1.5} />}
            title="Предметов пока нет"
            hint="Добавьте первую дисциплину кнопкой «+» выше"
          />
        ) : (
          <div className="card">
            {d.subjects.map((s) => {
              const done = s.items.filter((i) => i.done).length;
              const all = s.items.length;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => onOpenSubject(s.id)}
                  className="hairline-b w-full px-4 py-4 text-left cursor-pointer min-h-[64px]"
                >
                  <span className="flex items-center gap-3">
                    <SubjectDot name={s.name} />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[17px] font-semibold leading-snug" style={{ color: "var(--ink)" }}>
                        {s.name}
                      </span>
                      {s.teacher && (
                        <span className="block text-[13px] truncate" style={{ color: "var(--ink-3)" }}>
                          {s.teacher}
                        </span>
                      )}
                    </span>
                    <span className="tnum text-[13px] font-semibold whitespace-nowrap" style={{ color: "var(--ink-3)" }}>
                      {done}/{all}
                    </span>
                    <ChevronRight size={18} style={{ color: "var(--ink-3)" }} />
                  </span>
                  <span className="block mt-2.5">
                    <ProgressBar value={all ? done / all : 0} />
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <SubjectSheet open={addOpen} onClose={() => setAddOpen(false)} editing={null} />
    </div>
  );
}
