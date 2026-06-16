type Tone = "success" | "warning" | "danger" | "info" | "neutral" | "accent";

const toneClasses: Record<Tone, string> = {
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-red-100 text-red-700",
  info: "bg-blue-100 text-blue-700",
  neutral: "bg-stone-100 text-stone-600",
  accent: "bg-violet-100 text-violet-700",
};

const toneDot: Record<Tone, string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  info: "bg-blue-500",
  neutral: "bg-stone-400",
  accent: "bg-violet-500",
};

// Maps every known status/enum value across the app to a semantic tone.
const statusTone: Record<string, Tone> = {
  // Delay states
  GREEN: "success", YELLOW: "warning", RED: "danger",
  // Lead status
  NEW: "info", CONTACTED: "info", FOLLOW_UP: "warning", QUALIFIED: "accent", CONVERTED: "success", LOST: "neutral",
  // Order status
  DRAFT: "neutral", CONFIRMED: "info", IN_PRODUCTION: "info", READY: "success", DELIVERED: "success", CANCELLED: "neutral",
  // Production stage status
  NOT_STARTED: "neutral", IN_PROGRESS: "info", BLOCKED: "danger", COMPLETED: "success",
  // Purchase status
  REQUESTED: "warning", ORDERED: "info", RECEIVED: "success",
  // Incentive / pardon status
  PENDING: "warning", APPROVED: "info", PAID: "success", REJECTED: "danger",
  // Company status & roles
  OWNER: "accent", MANAGER: "info", EMPLOYEE: "neutral", PARTNER: "accent",
  // Account state
  ACTIVE: "success", INACTIVE: "danger",
};

export function StatusBadge({ value, dot = true }: { value: string; dot?: boolean }) {
  const tone = statusTone[value] ?? "neutral";
  return (
    <span className={`badge ${toneClasses[tone]}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${toneDot[tone]}`} />}
      {value.replaceAll("_", " ")}
    </span>
  );
}
