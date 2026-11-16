// Блок «Резервная копия»: выгрузка и восстановление всех данных одним файлом.
import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { exportJSON, importJSON } from "@/lib/store";
import { todayISO } from "@/lib/dates";
import { APP_VERSION } from "@/lib/version";

type Status = { kind: "ok" | "err"; text: string } | null;

export function Backup() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(null);

  const doExport = async () => {
    const json = exportJSON();
    const name = `учёба-резерв-${todayISO()}.json`;
    const file = new File([json], name, { type: "application/json" });

    // На айфоне открываем системное меню «Поделиться» (Файлы, мессенджеры, почта)
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Резервная копия — Учебный помощник" });
        setStatus({ kind: "ok", text: "Копия выгружена — сохраните файл в надёжном месте" });
        return;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return; // пользователь сам закрыл меню
        // любая другая ошибка — переходим к обычному скачиванию
      }
    }

    // Запасной путь: обычное скачивание
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    setStatus({ kind: "ok", text: "Файл скачан — найдите его в «Файлах» → «Загрузки»" });
  };

  const doImport = async (f: File) => {
    const text = await f.text();
    const current = exportJSON();
    if (!window.confirm("Заменить все текущие записи данными из файла? Текущие изменения будут потеряны.")) {
      return;
    }
    const count = importJSON(text);
    if (count === null) {
      setStatus({ kind: "err", text: "Не удалось прочитать файл — проверьте, что это выгрузка из приложения" });
    } else {
      setStatus({ kind: "ok", text: `Восстановлено: ${count} предметов` });
    }
    // если что-то пошло не так в середине — хотя бы не потерять прежние данные в переменной
    void current;
  };

  return (
    <section aria-label="Резервная копия">
      <h2
        className="px-1 mb-2 text-[13px] font-bold uppercase tracking-[0.08em]"
        style={{ color: "var(--ink-3)" }}
      >
        Резервная копия
      </h2>
      <div className="card px-4 py-4">
        <p className="text-[14px] leading-snug" style={{ color: "var(--ink-3)" }}>
          Все записи — одним файлом. Храните его в «Файлах» или отправьте себе в мессенджер.
        </p>
        <div className="flex gap-3 mt-3">
          <button type="button" className="btn-secondary flex-1" onClick={doExport}>
            <Download size={18} />
            Выгрузить
          </button>
          <button type="button" className="btn-secondary flex-1" onClick={() => fileRef.current?.click()}>
            <Upload size={18} />
            Восстановить
          </button>
        </div>
        {status && (
          <p
            className="mt-3 text-[14px] font-medium"
            style={{ color: status.kind === "ok" ? "var(--ok)" : "var(--danger)" }}
            role="status"
          >
            {status.text}
          </p>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          aria-hidden
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void doImport(f);
            e.target.value = "";
          }}
        />
        <p className="mt-3 text-[12.5px] text-right" style={{ color: "var(--ink-3)", opacity: 0.75 }}>
          Версия: {APP_VERSION}
        </p>
      </div>
    </section>
  );
}
