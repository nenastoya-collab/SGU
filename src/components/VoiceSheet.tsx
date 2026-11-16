// Лист быстрой команды: пишем или диктуем микрофоном на клавиатуре → разбор → подтверждение → запись.
// Отдельной кнопки записи нет: встроенное распознавание в Safari на iPhone
// стабильно работает только один раз за загрузку страницы (дефект iOS),
// а системная диктовка на клавиатуре работает всегда.
import { useMemo, useState } from "react";
import { Mic, Check, Pencil } from "lucide-react";
import { Sheet, SubjectDot } from "./Bits";
import {
  useAppData,
  addItem,
  addSubject,
  moveOccurrence,
  cancelOccurrence,
  retimeOccurrence,
  updateScheduleEntry,
} from "@/lib/store";
import { parseVoice, VOICE_EXAMPLES, type VoiceResult } from "@/lib/voice";
import { parseRuDate, formatShort, todayISO, plural } from "@/lib/dates";
import { classesForDate, findNextClass, shiftTime, withNewStart, type ClassOnDate } from "@/lib/schedule";

type Phase =
  | { step: "input" }
  | { step: "preview"; raw: string; result: VoiceResult }
  | { step: "done"; message: string };

interface MovePlan {
  entryId: string;
  subject: string;
  fromDate: string;
  start: string;
}

export function VoiceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const d = useAppData();
  const [phase, setPhase] = useState<Phase>({ step: "input" });
  const [typed, setTyped] = useState("");

  // Редактируемые поля предпросмотра задачи
  const [pTitle, setPTitle] = useState("");
  const [pSubjectId, setPSubjectId] = useState<string | null>(null);
  const [pNewSubject, setPNewSubject] = useState<string | null>(null);
  const [pDateText, setPDateText] = useState("");

  // при каждом открытии — чистый лист
  useMemo(() => {
    if (open) {
      setPhase({ step: "input" });
      setTyped("");
    }
  }, [open]);

  const analyze = (text: string) => {
    const result = parseVoice(text, d);
    if (result.type === "task") {
      setPTitle(result.title);
      setPSubjectId(result.subjectId ?? null);
      setPNewSubject(result.subjectId ? null : result.subjectName ?? null);
      setPDateText(result.date ? formatShort(result.date) : "");
    }
    setPhase({ step: "preview", raw: text, result });
  };

  // --- План переноса/отмены (что конкретно поменяется) ---
  const movePlan: MovePlan[] = useMemo(() => {
    if (phase.step !== "preview" || phase.result.type !== "move") return [];
    const r = phase.result;
    const affected: { entryId: string; date: string; cls: ClassOnDate }[] = [];
    if (r.subjectName) {
      if (r.fromDate) {
        classesForDate(d, r.fromDate)
          .filter((c) => c.entryId && c.subject === r.subjectName)
          .forEach((c) => affected.push({ entryId: c.entryId!, date: r.fromDate!, cls: c }));
      } else {
        const hit = findNextClass(d, r.subjectName, todayISO());
        if (hit && hit.cls.entryId) affected.push({ entryId: hit.cls.entryId, date: hit.date, cls: hit.cls });
      }
    } else if (r.dayScope && r.fromDate) {
      classesForDate(d, r.fromDate)
        .filter((c) => c.entryId)
        .forEach((c) => affected.push({ entryId: c.entryId!, date: r.fromDate!, cls: c }));
    }
    return affected.map((a) => ({
      entryId: a.entryId,
      subject: a.cls.subject,
      fromDate: a.date,
      start: a.cls.start,
    }));
  }, [phase, d]);

  const cancelPlan: MovePlan[] = useMemo(() => {
    if (phase.step !== "preview" || phase.result.type !== "cancel") return [];
    const r = phase.result;
    return classesForDate(d, r.date)
      .filter((c) => c.entryId && (!r.subjectName || c.subject === r.subjectName))
      .map((c) => ({ entryId: c.entryId!, subject: c.subject, fromDate: r.date, start: c.start }));
  }, [phase, d]);

  const pParsedDate = useMemo(() => {
    const t = pDateText.trim();
    if (!t) return undefined;
    const direct = parseRuDate(t);
    if (direct) return direct;
    const m = t.toLowerCase().match(/^[а-я]{2},\s*(.+)$/u);
    return m ? parseRuDate(m[1]) ?? null : null;
  }, [pDateText]);

  // Чип «к ближайшей паре»: ближайшая будущая пара выбранного предмета
  const pvSubjectName =
    d.subjects.find((s) => s.id === pSubjectId)?.name ?? pNewSubject ?? null;
  const pvNearest = useMemo(
    () => (pvSubjectName ? findNextClass(d, pvSubjectName, todayISO()) : null),
    [d, pvSubjectName]
  );

  const confirmTask = () => {
    let sid = pSubjectId;
    if (!sid && pNewSubject) {
      sid = addSubject({ name: pNewSubject });
    }
    if (!sid) return;
    addItem(sid, {
      title: pTitle.trim(),
      date: pParsedDate || undefined,
    });
    setPhase({
      step: "done",
      message: `Добавлено: ${pTitle.trim()}${pParsedDate ? ` — ${formatShort(pParsedDate)}` : ""}`,
    });
  };

  const confirmMove = () => {
    if (phase.step !== "preview" || phase.result.type !== "move") return;
    const r = phase.result;
    movePlan.forEach((m) => moveOccurrence(m.entryId, m.fromDate, r.toDate, r.toTime));
    setPhase({
      step: "done",
      message: `Перенесено: ${movePlan.length} ${plural(movePlan.length, "пара", "пары", "пар")} на ${formatShort(r.toDate)}${r.toTime ? `, ${r.toTime}` : ""}`,
    });
  };

  const confirmRetime = () => {
    if (phase.step !== "preview" || phase.result.type !== "retime") return;
    const r = phase.result;
    const newStart = r.toTime ?? shiftTime(r.target.start, r.shiftMin ?? 0);
    if (r.date) {
      retimeOccurrence(r.target.id, r.date, newStart);
      setPhase({
        step: "done",
        message: `${r.target.subject}: ${formatShort(r.date)} пара теперь в ${newStart} (только этот день)`,
      });
    } else {
      const span = withNewStart(r.target.start, r.target.end, newStart);
      updateScheduleEntry(r.target.id, { start: span.start, end: span.end });
      setPhase({
        step: "done",
        message: `${r.target.subject}: время пары изменено на ${span.start} (постоянно)`,
      });
    }
  };

  const confirmCancel = () => {
    if (phase.step !== "preview" || phase.result.type !== "cancel") return;
    const r = phase.result;
    cancelPlan.forEach((c) => cancelOccurrence(c.entryId, r.date));
    setPhase({
      step: "done",
      message: `Отменено: ${cancelPlan.length} ${plural(cancelPlan.length, "пара", "пары", "пар")} — ${formatShort(r.date)}`,
    });
  };

  return (
    <Sheet open={open} onClose={onClose} title="Голосовая команда">
      {phase.step === "input" && (
        <div className="flex flex-col gap-4">
          <div
            className="rounded-2xl px-4 py-3 text-[14px] leading-snug"
            style={{ background: "var(--surface-2)", color: "var(--ink-2)" }}
          >
            <p className="font-semibold mb-1.5" style={{ color: "var(--ink)" }}>
              Как продиктовать команду голосом:
            </p>
            <p>1. Нажмите на поле ниже — откроется клавиатура.</p>
            <p>2. Нажмите значок микрофона на клавиатуре.</p>
            <p>3. Скажите команду — текст появится сам.</p>
            <p>4. Нажмите «Разобрать».</p>
          </div>

          <p className="text-[15px] leading-snug" style={{ color: "var(--ink-3)" }}>
            Можно так, например:
          </p>
          <div className="flex flex-col gap-2">
            {VOICE_EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                className="chip !min-h-[36px] text-left justify-start whitespace-normal"
                onClick={() => analyze(ex)}
              >
                «{ex}»
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="voice-typed" className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
              Ваша команда
            </label>
            <div className="relative">
              <input
                id="voice-typed"
                className="field !pr-12"
                placeholder="Доклад по анатомии на следующей неделе…"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && typed.trim()) analyze(typed.trim());
                }}
              />
              <span
                className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--ink-3)" }}
                aria-hidden
              >
                <Mic size={18} />
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn-primary w-full"
            disabled={!typed.trim()}
            onClick={() => analyze(typed.trim())}
          >
            <Check size={18} />
            Разобрать
          </button>
        </div>
      )}

      {phase.step === "preview" && phase.result.type === "unknown" && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl px-4 py-3" style={{ background: "var(--danger-soft)" }}>
            <p className="text-[15px] font-medium" style={{ color: "var(--danger)" }}>
              {(phase.result as { reason: string }).reason}
            </p>
          </div>
          <p className="text-[14px]" style={{ color: "var(--ink-3)" }}>
            Вы сказали: «{phase.raw}»
          </p>
          <button type="button" className="btn-secondary w-full" onClick={() => setPhase({ step: "input" })}>
            <Pencil size={18} />
            Попробовать ещё раз
          </button>
        </div>
      )}

      {phase.step === "preview" && phase.result.type === "task" && (
        <div className="flex flex-col gap-4">
          <p className="text-[14px]" style={{ color: "var(--ink-3)" }}>
            Вы сказали: «{phase.raw}»
          </p>
          <div>
            <label htmlFor="pv-title" className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
              Что добавляем
            </label>
            <input
              id="pv-title"
              className="field"
              value={pTitle}
              onChange={(e) => setPTitle(e.target.value)}
            />
          </div>
          <div>
            <span className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
              Предмет
            </span>
            <div className="flex flex-wrap gap-2">
              {d.subjects.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className="chip"
                  data-active={pSubjectId === s.id}
                  onClick={() => {
                    setPSubjectId(s.id);
                    setPNewSubject(null);
                  }}
                >
                  {s.name}
                </button>
              ))}
              {pNewSubject && (
                <button type="button" className="chip" data-active="true">
                  новый: {pNewSubject}
                </button>
              )}
            </div>
          </div>
          <div>
            <label htmlFor="pv-date" className="block mb-1.5 text-[15px] font-semibold" style={{ color: "var(--ink-2)" }}>
              Дата
            </label>
            <input
              id="pv-date"
              className="field tnum"
              value={pDateText}
              onChange={(e) => setPDateText(e.target.value)}
              placeholder="завтра, пятница, 20.11…"
            />
            <div className="flex flex-wrap gap-2 mt-2.5">
              {["завтра", "послезавтра", "суббота"].map((w) => (
                <button key={w} type="button" className="chip tnum" onClick={() => setPDateText(w)}>
                  {w}
                </button>
              ))}
              {pvNearest && (
                <button
                  type="button"
                  className="chip tnum"
                  onClick={() => setPDateText(formatShort(pvNearest.date))}
                >
                  к ближайшей паре
                </button>
              )}
              {pDateText.trim() && (
                <button type="button" className="chip" onClick={() => setPDateText("")}>
                  убрать дату
                </button>
              )}
            </div>
            {phase.result.dateNote && (
              <p className="mt-1.5 text-[14px]" style={{ color: "var(--accent)" }}>
                {phase.result.dateNote}
              </p>
            )}
            {pDateText.trim() && (
              <p className="mt-1.5 text-[14px] tnum" style={{ color: pParsedDate ? "var(--accent)" : "var(--danger)" }}>
                {pParsedDate ? `→ ${formatShort(pParsedDate)}` : "не понимаю дату"}
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" className="btn-ghost" onClick={() => setPhase({ step: "input" })}>
              <Pencil size={17} />
              Заново
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={!pTitle.trim() || (!pSubjectId && !pNewSubject) || pParsedDate === null}
              onClick={confirmTask}
            >
              <Check size={19} />
              Подтвердить
            </button>
          </div>
        </div>
      )}

      {phase.step === "preview" && phase.result.type === "move" && (
        <div className="flex flex-col gap-4">
          <p className="text-[14px]" style={{ color: "var(--ink-3)" }}>
            Вы сказали: «{phase.raw}»
          </p>
          {movePlan.length === 0 ? (
            <div className="rounded-2xl px-4 py-3" style={{ background: "var(--danger-soft)" }}>
              <p className="text-[15px] font-medium" style={{ color: "var(--danger)" }}>
                Не нашла такую пару в расписании — проверьте предмет или день
              </p>
            </div>
          ) : (
            <div className="card px-4 py-1">
              {movePlan.map((m) => (
                <div key={m.entryId + m.fromDate} className="hairline-b flex items-center gap-3 py-3">
                  <SubjectDot name={m.subject} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[16px] font-medium leading-snug" style={{ color: "var(--ink)" }}>
                      {m.subject}
                    </p>
                    <p className="text-[13.5px] tnum" style={{ color: "var(--ink-3)" }}>
                      было: {formatShort(m.fromDate)}, {m.start}
                    </p>
                    <p className="text-[13.5px] tnum font-semibold" style={{ color: "var(--accent)" }}>
                      станет: {formatShort(phase.result.type === "move" ? phase.result.toDate : "")},{" "}
                      {phase.result.type === "move" && phase.result.toTime ? phase.result.toTime : m.start}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" className="btn-ghost" onClick={() => setPhase({ step: "input" })}>
              Заново
            </button>
            <button type="button" className="btn-primary flex-1" disabled={movePlan.length === 0} onClick={confirmMove}>
              <Check size={19} />
              Перенести
            </button>
          </div>
        </div>
      )}

      {phase.step === "preview" && phase.result.type === "retime" && (() => {
        const r = phase.result;
        const newStart = r.toTime ?? shiftTime(r.target.start, r.shiftMin ?? 0);
        const span = withNewStart(r.target.start, r.target.end, newStart);
        return (
          <div className="flex flex-col gap-4">
            <p className="text-[14px]" style={{ color: "var(--ink-3)" }}>
              Вы сказали: «{phase.raw}»
            </p>
            <div className="card px-4 py-1">
              <div className="flex items-center gap-3 py-3">
                <SubjectDot name={r.target.subject} />
                <div className="flex-1 min-w-0">
                  <p className="text-[16px] font-medium leading-snug" style={{ color: "var(--ink)" }}>
                    {r.target.subject}
                    {r.target.teacher ? ` — ${r.target.teacher}` : ""}
                  </p>
                  <p className="text-[13.5px] tnum" style={{ color: "var(--ink-3)" }}>
                    было: {r.target.start}–{r.target.end}
                  </p>
                  <p className="text-[13.5px] tnum font-semibold" style={{ color: "var(--accent)" }}>
                    станет: {span.start}–{span.end}
                  </p>
                  <p className="text-[13px] mt-0.5" style={{ color: "var(--ink-3)" }}>
                    {r.date ? `только ${formatShort(r.date)}` : "постоянно, для всех занятий этой пары"}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" className="btn-ghost" onClick={() => setPhase({ step: "input" })}>
                Заново
              </button>
              <button type="button" className="btn-primary flex-1" onClick={confirmRetime}>
                <Check size={19} />
                Изменить время
              </button>
            </div>
          </div>
        );
      })()}

      {phase.step === "preview" && phase.result.type === "cancel" && (
        <div className="flex flex-col gap-4">
          <p className="text-[14px]" style={{ color: "var(--ink-3)" }}>
            Вы сказали: «{phase.raw}»
          </p>
          {cancelPlan.length === 0 ? (
            <div className="rounded-2xl px-4 py-3" style={{ background: "var(--danger-soft)" }}>
              <p className="text-[15px] font-medium" style={{ color: "var(--danger)" }}>
                На этот день таких пар нет в расписании
              </p>
            </div>
          ) : (
            <div className="card px-4 py-1">
              {cancelPlan.map((c) => (
                <div key={c.entryId} className="hairline-b flex items-center gap-3 py-3">
                  <SubjectDot name={c.subject} />
                  <div className="flex-1">
                    <p className="text-[16px] font-medium" style={{ color: "var(--ink)" }}>
                      {c.subject}
                    </p>
                    <p className="text-[13.5px] tnum" style={{ color: "var(--danger)" }}>
                      отменить: {formatShort(c.fromDate)}, {c.start}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <button type="button" className="btn-ghost" onClick={() => setPhase({ step: "input" })}>
              Заново
            </button>
            <button type="button" className="btn-primary flex-1" disabled={cancelPlan.length === 0} onClick={confirmCancel}>
              <Check size={19} />
              Отменить {cancelPlan.length > 0 && `(${cancelPlan.length})`}
            </button>
          </div>
        </div>
      )}

      {phase.step === "done" && (
        <div className="flex flex-col items-center gap-4 py-6">
          <div
            className="flex h-16 w-16 items-center justify-center rounded-full"
            style={{ background: "var(--ok)", color: "var(--on-accent)" }}
          >
            <Check size={30} strokeWidth={2.5} />
          </div>
          <p className="text-center text-[16px] font-semibold px-4" style={{ color: "var(--ink)" }}>
            {phase.message}
          </p>
          <button type="button" className="btn-primary w-full" onClick={onClose}>
            Готово
          </button>
        </div>
      )}
    </Sheet>
  );
}
