import { ShieldX } from "lucide-react";

export function AccessDenied() {
  return <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-red-200 bg-white p-8 text-center shadow-card">
    <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-red-50 text-red-700"><ShieldX size={24} /></span>
    <h1 className="mt-4 text-2xl font-semibold">Access denied</h1>
    <p className="mt-2 text-sm leading-relaxed text-stone-500">Your account does not have permission to view this area. Ask the company owner to update your role or feature access.</p>
  </div>;
}
