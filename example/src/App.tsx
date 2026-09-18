import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../convex/_generated/api";
import "./App.css";

export default function App() {
  const teams = useQuery(api.teams.list);
  const status = useQuery(api.syncState.status);
  const runSync = useAction(api.sync.runNow);
  const [message, setMessage] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const sync = async () => {
    setRunning(true);
    setMessage(null);
    try {
      const result = await runSync({});
      setMessage(
        result.status === "continuing"
          ? `Read ${result.rowsRead.toLocaleString()} rows; remaining pages are continuing in the background.`
          : result.status === "already_running"
            ? "A sync is already running."
            : `Sync complete. Read ${result.rowsRead.toLocaleString()} rows.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    } finally {
      setRunning(false);
    }
  };

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">Convex Component Example</p>
          <h1>Databricks → Convex</h1>
          <p className="lede">
            Incremental, resumable sync of the Databricks teams table.
          </p>
        </div>
        <button disabled={running || status?.isRunning} onClick={sync}>
          {running || status?.isRunning ? "Syncing…" : "Sync now"}
        </button>
      </header>

      <section className="stats" aria-label="Sync status">
        <article>
          <span>Status</span>
          <strong>{status?.isRunning ? "Running" : "Idle"}</strong>
        </article>
        <article>
          <span>Rows processed</span>
          <strong>{status?.rowsProcessed.toLocaleString() ?? "0"}</strong>
        </article>
        <article>
          <span>Checkpoint</span>
          <strong className="checkpoint">
            {status?.cursor ?? "Not started"}
          </strong>
        </article>
      </section>

      {message && <p className="message">{message}</p>}
      {status?.lastError && <p className="error">{status.lastError}</p>}

      <section className="table-card">
        <div className="table-heading">
          <div>
            <p className="eyebrow">Synced data</p>
            <h2>Teams</h2>
          </div>
          <span>{teams?.length ?? 0} shown</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Slug</th>
                <th>Region</th>
                <th>Suspended</th>
              </tr>
            </thead>
            <tbody>
              {teams?.map((team) => (
                <tr key={team._id}>
                  <td className="mono">{team.externalId}</td>
                  <td>{team.name ?? "—"}</td>
                  <td>{team.slug ?? "—"}</td>
                  <td>{team.defaultRegion ?? "—"}</td>
                  <td>
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
                  <td className="empty" colSpan={5}>
                    Run the first sync to populate this table.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
