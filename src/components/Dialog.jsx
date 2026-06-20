import { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";

/**
 * Promise-based, in-app replacement for window.confirm / prompt / alert.
 *
 *   const { confirm, prompt, alert } = useDialog();
 *   if (await confirm({ title, message, danger: true })) { ... }
 *   const value = await prompt({ title, message, inputType: "password" }); // null if cancelled
 */
const DialogCtx = createContext(null);
export const useDialog = () => useContext(DialogCtx);

export function DialogProvider({ children }) {
  const [state, setState] = useState(null);   // null = closed
  const [value, setValue] = useState("");
  const resolver = useRef(null);

  const open = useCallback((kind, opts) => {
    const o = typeof opts === "string" ? { message: opts } : (opts || {});
    setValue(o.defaultValue || "");
    setState({ kind, confirmText: "OK", cancelText: "Cancel", ...o });
    return new Promise((resolve) => { resolver.current = resolve; });
  }, []);

  const confirm = useCallback((o) => open("confirm", o), [open]);
  const prompt = useCallback((o) => open("prompt", o), [open]);
  const alert = useCallback((o) => open("alert", o), [open]);

  const close = useCallback((result) => {
    const r = resolver.current;
    resolver.current = null;
    setState(null);
    if (r) r(result);
  }, []);

  const onConfirm = () => close(state.kind === "prompt" ? value : true);
  const onCancel = () => close(state.kind === "prompt" ? null : false);

  useEffect(() => {
    if (!state) return;
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
      else if (e.key === "Enter" && state.kind !== "prompt") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DialogCtx.Provider value={{ confirm, prompt, alert }}>
      {children}
      {state && (
        <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
          <div className="modal" role="dialog" aria-modal="true">
            {state.title && <h3>{state.title}</h3>}
            {state.message && <p>{state.message}</p>}
            {state.kind === "prompt" && (
              <input autoFocus type={state.inputType || "text"} value={value}
                placeholder={state.placeholder || ""}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onConfirm()} />
            )}
            <div className="modal-actions">
              {state.kind !== "alert" && (
                <button className="btn btn-ghost" onClick={onCancel}>{state.cancelText}</button>
              )}
              <button className={`btn ${state.danger ? "btn-danger-solid" : "btn-primary"}`}
                onClick={onConfirm} autoFocus={state.kind !== "prompt"}>
                {state.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogCtx.Provider>
  );
}
