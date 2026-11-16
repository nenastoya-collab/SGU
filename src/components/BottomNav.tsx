// Нижняя панель навигации — как в нативных приложениях.
import { House, BookOpen, CalendarDays, CalendarRange } from "lucide-react";

export type Tab = "home" | "schedule" | "subjects" | "deadlines";

const TABS: { id: Tab; label: string; Icon: typeof House }[] = [
  { id: "home", label: "Главная", Icon: House },
  { id: "schedule", label: "Расписание", Icon: CalendarRange },
  { id: "subjects", label: "Предметы", Icon: BookOpen },
  { id: "deadlines", label: "Дедлайны", Icon: CalendarDays },
];

export function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav
      aria-label="Основная навигация"
      className="fixed bottom-0 left-0 right-0 z-30"
      style={{
        background: "color-mix(in oklch, var(--surface) 88%, transparent)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderTop: "1px solid var(--line)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <div className="mx-auto flex max-w-md">
        {TABS.map(({ id, label, Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              aria-current={active ? "page" : undefined}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] cursor-pointer transition-colors"
              style={{ color: active ? "var(--accent)" : "var(--ink-3)" }}
            >
              <Icon size={23} strokeWidth={active ? 2.4 : 1.8} />
              <span className="text-[10.5px] font-semibold">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
