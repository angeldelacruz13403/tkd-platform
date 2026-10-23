"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  title: string;
  message?: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({ title, message, type = "info", duration = 4000 }: Omit<Toast, "id">) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, title, message, type, duration }]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback((title: string, message?: string) => addToast({ title, message, type: "success" }), [addToast]);
  const error = useCallback((title: string, message?: string) => addToast({ title, message, type: "error" }), [addToast]);
  const warning = useCallback((title: string, message?: string) => addToast({ title, message, type: "warning" }), [addToast]);
  const info = useCallback((title: string, message?: string) => addToast({ title, message, type: "info" }), [addToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, warning, info }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => {
          const icons = {
            success: <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />,
            error: <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />,
            warning: <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />,
            info: <Info className="w-5 h-5 text-sky-400 flex-shrink-0" />,
          };

          const borders = {
            success: "border-emerald-500/30 bg-[#061810]/95 text-emerald-100",
            error: "border-rose-500/30 bg-[#1f090d]/95 text-rose-100",
            warning: "border-amber-500/30 bg-[#1c1508]/95 text-amber-100",
            info: "border-sky-500/30 bg-[#081524]/95 text-sky-100",
          };

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto p-4 rounded-xl border shadow-2xl backdrop-blur-md flex items-start justify-between gap-3 animate-in slide-in-from-right-5 fade-in duration-200 ${borders[toast.type]}`}
            >
              <div className="flex items-start gap-3 min-w-0">
                {icons[toast.type]}
                <div className="text-xs">
                  <p className="font-semibold text-white">{toast.title}</p>
                  {toast.message && <p className="text-slate-300 mt-0.5 leading-relaxed">{toast.message}</p>}
                </div>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-white p-1 rounded transition-colors flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
