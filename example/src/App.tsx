import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";

type Notice = {
  kind: "error" | "success";
  text: string;
};

export default function App() {
  const teams = useQuery(api.teams.list);
  const status = useQuery(api.syncState.status);
  const runSync = useAction(api.sync.runNow);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [running, setRunning] = useState(false);

  const sync = async () => {
    setRunning(true);
    setNotice(null);
    try {
      const result = await runSync({});
      setNotice({
        kind: "success",
        text:
          result.status === "continuing"
            ? `Read ${result.rowsRead.toLocaleString()} rows; remaining pages are continuing in the background.`
            : result.status === "already_running"
              ? "A sync is already running."
              : `Sync complete. Read ${result.rowsRead.toLocaleString()} rows.`,
      });
    } catch (error) {
      setNotice({ kind: "error", text: describeSyncError(error) });
    } finally {
      setRunning(false);
    }
  };

  const errorMessage =
    notice?.kind === "error"
      ? notice.text
      : status?.lastError
        ? describeSyncError(status.lastError)
        : null;

  return (
    <main className="min-h-screen bg-[#f5f1e9] px-5 py-12 text-[#25211d] antialiased sm:py-18">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-10 flex flex-col items-stretch gap-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.16em] text-[#6f6a62] uppercase">
              Convex Component Example
            </p>
            <h1 className="mt-2 text-[clamp(2.5rem,7vw,5.25rem)] leading-[0.95] font-bold tracking-[-0.065em]">
              Databricks → Convex
            </h1>
            <p className="mt-5 max-w-2xl text-[1.05rem] text-[#5f5a54]">
              Incremental, resumable sync of the Databricks teams table.
            </p>
          </div>
          <button
            className="cursor-pointer rounded-full border-0 bg-[#e44d2e] px-[22px] py-[13px] font-bold whitespace-nowrap text-white shadow-[0_8px_24px_rgb(228_77_46_/_24%)] transition hover:bg-[#cd4025] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e44d2e] disabled:cursor-wait disabled:opacity-55"
            disabled={running || status?.isRunning}
            onClick={sync}
          >
            {running || status?.isRunning ? "Syncing…" : "Sync now"}
          </button>
        </header>

        <section
          className="grid overflow-hidden rounded-[18px] border border-[#d9d4cb] bg-white md:grid-cols-[0.8fr_0.8fr_1.6fr]"
          aria-label="Sync status"
        >
          <article className="min-w-0 px-6 py-[22px]">
            <span className="block text-[0.78rem] text-[#777169]">Status</span>
            <strong className="mt-2 block text-[1.1rem]">
              {status?.isRunning ? "Running" : "Idle"}
            </strong>
          </article>
          <article className="min-w-0 border-t border-[#e8e4dc] px-6 py-[22px] md:border-t-0 md:border-l">
            <span className="block text-[0.78rem] text-[#777169]">
              Rows processed
            </span>
            <strong className="mt-2 block text-[1.1rem]">
              {status?.rowsProcessed.toLocaleString() ?? "0"}
            </strong>
          </article>
          <article className="min-w-0 border-t border-[#e8e4dc] px-6 py-[22px] md:border-t-0 md:border-l">
            <span className="block text-[0.78rem] text-[#777169]">
              Checkpoint
            </span>
            <strong className="mt-2 block overflow-hidden font-mono text-[0.82rem] text-ellipsis whitespace-nowrap">
              {status?.cursor ?? "Not started"}
            </strong>
          </article>
        </section>

        {notice?.kind === "success" && (
          <p
            className="mt-[18px] rounded-xl bg-[#eaf2e7] px-4 py-3 text-[#31512d]"
            aria-live="polite"
          >
            {notice.text}
          </p>
        )}
        {errorMessage && (
          <p
            className="mt-[18px] rounded-xl bg-[#fde9e4] px-4 py-3 text-[#812b1a]"
            role="alert"
          >
            {errorMessage}
          </p>
        )}

        <section className="mt-6 overflow-hidden rounded-[18px] border border-[#d9d4cb] bg-white">
          <div className="flex items-center justify-between border-b border-[#e8e4dc] p-6">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-[#6f6a62] uppercase">
                Synced data
              </p>
              <h2 className="mt-1 text-[1.75rem] font-bold">Teams</h2>
            </div>
            <span className="block text-[0.78rem] text-[#777169]">
              {teams?.length ?? 0} shown
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr>
                  <th className="border-b border-[#efebe5] px-6 py-[15px] text-[0.74rem] tracking-[0.08em] text-[#777169] uppercase">
                    ID
                  </th>
                  <th className="border-b border-[#efebe5] px-6 py-[15px] text-[0.74rem] tracking-[0.08em] text-[#777169] uppercase">
                    Name
                  </th>
                  <th className="border-b border-[#efebe5] px-6 py-[15px] text-[0.74rem] tracking-[0.08em] text-[#777169] uppercase">
                    Slug
                  </th>
                  <th className="border-b border-[#efebe5] px-6 py-[15px] text-[0.74rem] tracking-[0.08em] text-[#777169] uppercase">
                    Region
                  </th>
                  <th className="border-b border-[#efebe5] px-6 py-[15px] text-[0.74rem] tracking-[0.08em] text-[#777169] uppercase">
                    Suspended
                  </th>
                </tr>
              </thead>
              <tbody>
                {teams?.map((team) => (
                  <tr key={team._id} className="last:[&>td]:border-b-0">
                    <td className="border-b border-[#efebe5] px-6 py-[15px] font-mono text-[0.8rem]">
                      {team.externalId}
                    </td>
                    <td className="border-b border-[#efebe5] px-6 py-[15px] text-sm">
                      {team.name ?? "—"}
                    </td>
                    <td className="border-b border-[#efebe5] px-6 py-[15px] text-sm">
                      {team.slug ?? "—"}
                    </td>
                    <td className="border-b border-[#efebe5] px-6 py-[15px] text-sm">
                      {team.defaultRegion ?? "—"}
                    </td>
                    <td className="border-b border-[#efebe5] px-6 py-[15px] text-sm">
                      {team.suspended === null
                        ? "—"
                        : team.suspended
                          ? "Yes"
                          : "No"}
                    </td>
                  </tr>
                ))}
                {teams?.length === 0 && (
                  <tr>
                    <td
                      className="px-6 py-[52px] text-center text-sm text-[#777169]"
                      colSpan={5}
                    >
                      Run the first sync to populate this table.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}

function describeSyncError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("bad HTTP status code: 403")) {
    return "Databricks authorization failed (403). Update DATABRICKS_TOKEN and confirm it can use the configured SQL warehouse.";
  }
  return message;
}
