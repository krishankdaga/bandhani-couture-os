import type { ReactNode } from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

export function Spinner({ className = "" }: { className?: string }) {
  return <span className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-wine ${className}`} />;
}

export function LoadingState({ label = "Loading...", rows = 0 }: { label?: string; rows?: number }) {
  if (rows > 0) {
    return (
      <div className="card divide-y divide-stone-100 overflow-hidden" role="status" aria-label={label}>
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 p-4">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="card grid place-items-center gap-3 p-10 text-center text-sm text-stone-500" role="status">
      <Spinner />
      {label}
    </div>
  );
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="card border-red-200 bg-red-50/70 p-6 text-sm text-red-700" role="alert">
      <p className="font-medium">{message}</p>
      {retry && (
        <button type="button" className="btn-secondary btn-sm mt-4" onClick={retry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  message,
  title,
  icon,
  action,
}: {
  message: string;
  title?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="card grid place-items-center gap-3 p-10 text-center">
      {icon && <span className="grid h-12 w-12 place-items-center rounded-2xl bg-stone-100 text-stone-400">{icon}</span>}
      {title && <p className="text-base font-semibold text-ink">{title}</p>}
      <p className="max-w-md text-sm leading-relaxed text-stone-500">{message}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function InlineMessage({ message, tone = "error" }: { message: string; tone?: "error" | "success" }) {
  const colors = tone === "error" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700";
  return (
    <p className={`rounded-lg p-3 text-sm ${colors}`} role={tone === "error" ? "alert" : "status"}>
      {message}
    </p>
  );
}
