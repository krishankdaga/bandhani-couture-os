"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/client";
import { EmptyState, ErrorState, LoadingState } from "@/components/async-state";

type Log = { id: string; action: string; entity: string; entityId: string; createdAt: string; user: { name: string; role: string } | null };
export default function AuditLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  function load() { setLoading(true); setError(""); api<{ logs: Log[] }>("/api/audit-logs").then(r => setLogs(r.logs)).catch(e => setError(e.message)).finally(() => setLoading(false)); }
  useEffect(() => { load(); }, []);
  return <><PageHeader title="Audit Logs" description="Immutable record of important business changes." />{loading ? <LoadingState label="Loading audit logs..." /> : error ? <ErrorState message={error} retry={load} /> : !logs.length ? <EmptyState message="No audit events recorded yet." /> : <div className="table-wrap"><table><thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>Entity</th><th>Record ID</th></tr></thead><tbody>{logs.map(log => <tr key={log.id}><td>{new Date(log.createdAt).toLocaleString("en-IN")}</td><td>{log.user?.name ?? "System"}<p className="text-xs text-stone-400">{log.user?.role?.replaceAll("_", " ") ?? ""}</p></td><td><strong>{log.action}</strong></td><td>{log.entity}</td><td className="font-mono text-xs text-stone-500">{log.entityId}</td></tr>)}</tbody></table></div>}</>;
}
