// Мелкие переиспользуемые элементы: нижний лист, прогресс-бар, пустые состояния.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { attachBackspaceRepeat } from "@/lib/keyrepeat";

/** Нижний лист (bottom sheet). Закрывается: крестик, тап по фону, Esc. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // На сколько клавиатура подняла низ экрана (0 — клавиатуры нет).
  const [kbOffset, setKbOffset] = useState(0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Долгое нажатие бэкспейса для ВСЕХ полей листа (iOS-приложение с экрана
  // «Домой» не повторяет клавишу). Наблюдатель подхватывает и поля,
  // которые появляются позже (например, экран подтверждения голосовой команды).
  useEffect(() => {
    if (!open) return;
    const root = ref.current;
    if (!root) return;
    const attached = new WeakSet<Element>();
    const cleanups: (() => void)[] = [];
    const scan = () => {
      root
        .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input.field, textarea.field")
        .forEach((el) => {
          if (attached.has(el)) return;
          attached.add(el);
          cleanups.push(attachBackspaceRepeat(el));
        });
    };
    scan();
    const obs = new MutationObserver(scan);
    obs.observe(root, { childList: true, subtree: true });
    return () => {
      obs.disconnect();
      cleanups.forEach((fn) => fn());
    };
  }, [open]);

  // Когда открывается экранная клавиатура (iOS/Android), визуальная область
  // уменьшается: поднимаем лист над клавиатурой и ограничиваем его высоту,
  // чтобы заголовок и все поля оставались видимыми.
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      setKbOffset(Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      setKbOffset(0);
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 fade-enter"
        style={{ background: "oklch(0.24 0.03 212 / 0.35)" }}
        onClick={onClose}
      />
      <div
        ref={ref}
        className="sheet-enter relative w-full max-w-md rounded-t-[24px] px-5 pt-3 pb-8 overflow-y-auto"
        style={{
          background: "var(--surface)",
          paddingBottom:
            kbOffset > 0 ? "1.25rem" : "calc(2rem + env(safe-area-inset-bottom))",
          transform: kbOffset > 0 ? `translateY(-${kbOffset}px)` : undefined,
          maxHeight:
            kbOffset > 0 ? `calc(100dvh - ${kbOffset}px - 8px)` : "88dvh",
          transition: "transform 0.18s ease-out, max-height 0.18s ease-out",
        }}
      >
        <div
          className="mx-auto mb-3 h-1.5 w-10 rounded-full"
          style={{ background: "var(--line)" }}
        />
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold" style={{ color: "var(--ink)" }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Закрыть"
            className="flex h-11 w-11 items-center justify-center rounded-full cursor-pointer transition-colors"
            style={{ color: "var(--ink-2)" }}
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Полоса прогресса (темы экзамена). */
export function ProgressBar({ value }: { value: number }) {
  return (
    <div
      className="h-2 w-full rounded-full overflow-hidden"
      style={{ background: "var(--surface-2)" }}
      role="progressbar"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${Math.round(value * 100)}%`,
          background: "var(--accent)",
          transition: "width 0.25s ease-out",
        }}
      />
    </div>
  );
}

/** Пустое состояние раздела. */
export function Empty({
  icon,
  title,
  hint,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-8">
      <div style={{ color: "var(--ink-3)" }}>{icon}</div>
      <p className="mt-4 text-lg font-semibold" style={{ color: "var(--ink)" }}>
        {title}
      </p>
      <p className="mt-1 text-[15px]" style={{ color: "var(--ink-3)" }}>
        {hint}
      </p>
    </div>
  );
}

/** Метка даты с цветом по срочности. */
export function DateBadge({ label, urgent }: { label: string; urgent: "over" | "soon" | "ok" }) {
  const colors = {
    over: { bg: "var(--danger-soft)", fg: "var(--danger)" },
    soon: { bg: "oklch(0.93 0.045 75)", fg: "oklch(0.42 0.1 60)" },
    ok: { bg: "var(--surface-2)", fg: "var(--ink-2)" },
  }[urgent];
  return (
    <span
      className="tnum inline-flex items-center rounded-full px-2.5 py-1 text-[13px] font-semibold whitespace-nowrap"
      style={{ background: colors.bg, color: colors.fg }}
    >
      {label}
    </span>
  );
}

/** Цветная точка предмета — детерминированный цвет из названия. */
const DOT_COLORS = [
  "oklch(0.55 0.1 205)",
  "oklch(0.58 0.12 150)",
  "oklch(0.6 0.13 60)",
  "oklch(0.58 0.14 330)",
  "oklch(0.56 0.12 270)",
  "oklch(0.62 0.12 110)",
  "oklch(0.58 0.13 20)",
];

export function subjectColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return DOT_COLORS[h % DOT_COLORS.length];
}

export function SubjectDot({ name }: { name: string }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
      style={{ background: subjectColor(name) }}
      aria-hidden
    />
  );
}
