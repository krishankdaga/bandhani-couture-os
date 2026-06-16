import { redirect } from "next/navigation";
import { getRequestUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getRequestUser();
  if (!user) redirect("/login");
  return <AppShell user={user}>{children}</AppShell>;
}
