// Полноэкранная карточка предмета: выезжает справа, как в мобильных приложениях.
import { useEffect, useState, type ReactNode } from "react";
import { ChevronLeft, Pencil, Plus, ClipboardList, StickyNote } from "lucide-react";
import { ItemRow } from "./ItemRow";
import { ItemSheet } from "./ItemSheet";
import { SubjectSheet } from "./SubjectSheet";
import { ProgressBar, Empty } from "./Bits";
import { useAppData } from "@/lib/store";
import { daysUntil } from "@/lib/dates";
import type { SubjectItem } from "@/types";

const SOON_DAYS = 14; // «ближайшие» = дата в ближайшие две недели или просрочено

export function SubjectDetail({
  subjectId,
  onClose,
}: {
  subjectId: string;
  onClose: () => void;
}) {
  const d = useAppData();
  const subject = d.subjects.find((s) => s.id === subjectId);

  const [itemSheetOpen, setItemSheetOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SubjectItem | null>(null);
  const [editSubjectOpen, setEditSubjectOpen] = useState(false);

  // Esc закрывает карточку
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !itemSheetOpen && !editSubjectOpen) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, itemSheetOpen, editSubjectOpen]);

  if (!subject) return null;

  const doneCount = subject.items.filter((i) => i.done).length;
  const progress = subject.items.length ? doneCount / subject.items.length : 0;

  // Три секции: ближайшие (срочные по дате), не срочные, выполненные
  const byDate = (a: SubjectItem, b: SubjectItem) => {
    if (a.date && b.date) return a.date < b.date ? -1 : 1;
    if (a.date) return -1;
    if (b.date) return 1;
    return 0;
  };
  const open = subject.items.filter((i) => !i.done);
  const soon = open.filter((i) => i.date && daysUntil(i.date) <= SOON_DAYS).sort(byDate);
  const later = open.filter((i) => !soon.includes(i)).sort(byDate);
  const doneItems = subject.items.filter((i) => i.done);

  const sections = (
    [
      { label: "Ближайшие", tone: "danger", items: soon },
      { label: "Не срочные", tone: "muted", items: later },
      { label: "Выполнено", tone: "ok", items: doneItems },
    ] as { label: string; tone: "danger" | "muted" | "ok"; items: SubjectItem[] }[]
  ).filter((s) => s.items.length > 0);

  const toneColor = { danger: "var(--danger)", muted: "var(--ink-3)", ok: "var(--ok)" } as const;

  const renderItems = (items: SubjectItem[]): ReactNode =>
    items.map((it) => (
      <ItemRow
        key={it.id}
        subjectId={subject.id}
        item={it}
        onEdit={() => {
          setEditingItem(it);
          setItemSheetOpen(true);
        }}
      />
    ));

  return (
    <div
      className="detail-slide fixed inset-0 z-40"
      role="dialog"
      aria-modal="true"
      aria-label={subject.name}
      style={{ background: "var(--bg)" }}
    >
      <div className="mx-auto flex h-full w-full max-w-md flex-col">
        {/* Шапка */}
        <div
          className="px-4 pt-4 pb-4"
          style={{ paddingTop: "calc(1rem + env(safe-area-inset-top))" }}
        >
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onClose}
              aria-label="Назад к предметам"
              className="flex h-11 w-11 items-center justify-center rounded-full cursor-pointer -ml-2"
              style={{ color: "var(--accent)" }}
            >
              <ChevronLeft size={26} />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-[22px] font-bold leading-tight truncate" style={{ color: "var(--ink)" }}>
                {subject.name}
              </h1>
              {(subject.teacher || subject.note) && (
                <p className="text-[13.5px] leading-snug truncate" style={{ color: "var(--ink-3)" }}>
                  {[subject.teacher, subject.note].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setEditSubjectOpen(true)}
              aria-label="Изменить предмет"
              className="flex h-11 w-11 items-center justify-center rounded-full cursor-pointer"
              style={{ color: "var(--ink-3)" }}
            >
              <Pencil size={19} />
            </button>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1">
              <ProgressBar value={progress} />
            </div>
            <span className="tnum text-[13.5px] font-semibold whitespace-nowrap" style={{ color: "var(--ink-2)" }}>
              {doneCount} из {subject.items.length}
            </span>
          </div>
        </div>

        {/* Пометки + чек-лист */}
        <div className="flex-1 overflow-y-auto px-4 pb-40">
          {subject.notes && (
            <div className="card px-4 py-3.5 mb-5 flex gap-3 items-start">
              <StickyNote size={19} className="shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
              <div className="min-w-0">
                <p className="text-[12px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: "var(--ink-3)" }}>
                  Пометки
                </p>
                <p className="text-[15px] leading-relaxed whitespace-pre-line" style={{ color: "var(--ink-2)" }}>
                  {subject.notes}
                </p>
              </div>
            </div>
          )}

          {sections.length === 0 ? (
            <Empty
              icon={<ClipboardList size={44} strokeWidth={1.5} />}
              title="Пока пусто"
              hint="Добавьте первое требование или задание по этому предмету"
            />
          ) : (
            sections.map((sec) => (
              <section key={sec.label} aria-label={sec.label} className="mb-5">
                <h2
                  className="px-1 mb-2 text-[13px] font-bold uppercase tracking-[0.08em]"
                  style={{ color: toneColor[sec.tone] }}
                >
                  {sec.label}
                </h2>
                <div className="card px-4">{renderItems(sec.items)}</div>
              </section>
            ))
          )}
        </div>

        {/* Кнопка добавления */}
        <div
          className="fixed bottom-0 left-0 right-0 z-10 px-4 pb-6"
          style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto max-w-md">
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => {
                setEditingItem(null);
                setItemSheetOpen(true);
              }}
            >
              <Plus size={20} />
              Добавить пункт
            </button>
          </div>
        </div>
      </div>

      <ItemSheet
        open={itemSheetOpen}
        onClose={() => setItemSheetOpen(false)}
        subjectId={subject.id}
        editing={editingItem}
        editingSubjectId={editingItem ? subject.id : null}
      />
      <SubjectSheet
        open={editSubjectOpen}
        onClose={() => setEditSubjectOpen(false)}
        editing={subject}
      />
    </div>
  );
}
