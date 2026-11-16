// Долгое нажатие Backspace в полях ввода.
// В iOS-приложениях с экрана «Домой» система не повторяет клавишу удаления —
// зажатый бэкспейс стирает один символ и останавливается (дефект iOS).
// Здесь догоняем сами: через 400 мс зажатия начинаем стирать по таймеру.
// Если система повторяет сама (Android, десктоп, починенный iOS) —
// видим e.repeat и сразу отступаем, двойного удаления нет.
export function attachBackspaceRepeat(el: HTMLInputElement | HTMLTextAreaElement): () => void {
  let delayTimer: number | null = null;
  let repeatTimer: number | null = null;

  const stop = () => {
    if (delayTimer) {
      clearTimeout(delayTimer);
      delayTimer = null;
    }
    if (repeatTimer) {
      clearInterval(repeatTimer);
      repeatTimer = null;
    }
  };

  const deleteChar = () => {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    if (start === 0 && end === 0) {
      stop();
      return;
    }
    const next = start === end ? start - 1 : start;
    const value = el.value.slice(0, next) + el.value.slice(end);
    // Ставим значение через родной сеттер + шлём input-событие, чтобы React увидел изменение
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(el, value);
    el.setSelectionRange(next, next);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const onKeyDown = (e: Event) => {
    const ke = e as KeyboardEvent;
    if (ke.key !== "Backspace") return;
    if (ke.repeat) {
      // система повторяет сама — не вмешиваемся
      stop();
      return;
    }
    stop();
    delayTimer = window.setTimeout(() => {
      delayTimer = null;
      repeatTimer = window.setInterval(deleteChar, 55);
    }, 400);
  };
  const onKeyUp = (e: Event) => {
    if ((e as KeyboardEvent).key === "Backspace") stop();
  };

  el.addEventListener("keydown", onKeyDown);
  el.addEventListener("keyup", onKeyUp);
  el.addEventListener("blur", stop);
  return () => {
    stop();
    el.removeEventListener("keydown", onKeyDown);
    el.removeEventListener("keyup", onKeyUp);
    el.removeEventListener("blur", stop);
  };
}
