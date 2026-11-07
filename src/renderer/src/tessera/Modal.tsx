import { useEffect } from "react";
import type { ReactNode } from "react";

// Scrim бандла — только вид: закрытие по клику мимо шторки и по Esc здесь.
export function Modal(props: { center?: boolean; onClose?: () => void; children: ReactNode }) {
  const T = window.Tessera;
  const { onClose } = props;
  useEffect(() => {
    if (onClose === undefined) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return (
    <div
      className="slate-modal"
      onClick={(event) => {
        if (event.target instanceof HTMLElement && event.target.classList.contains("ts-scrim")) {
          onClose?.();
        }
      }}
    >
      <T.Scrim center={props.center}>{props.children}</T.Scrim>
    </div>
  );
}
