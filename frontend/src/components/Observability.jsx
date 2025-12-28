import { useState } from "react";
import { getHealth, getStats, getFailures } from "../api";

export default function Observability() {
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [failures, setFailures] = useState([]);

  async function toggleHealth() {
    if (health) return setHealth(null);
    setHealth(await getHealth());
  }

  async function toggleStats() {
    if (stats) return setStats(null);
    setStats(await getStats());
  }

  async function toggleFailures() {
    if (failures.length) return setFailures([]);
    const res = await getFailures(10);
    setFailures(res.data || []);
  }

  return (
    <div className="card">
      <h2>Observability</h2>

      <button onClick={toggleHealth}>Health</button>
      <button onClick={toggleStats}>Stats</button>
      <button onClick={toggleFailures}>Failures</button>

      {health && (
        <div className="small">
          Status: {health.status}<br />
          Scheduler running: {String(health.scheduler?.isRunning)}
        </div>
      )}

      {stats && (
        <div className="small">
          Total: {stats.data.executions.total}<br />
          Success: {stats.data.executions.successful}<br />
          Failed: {stats.data.executions.failed}
        </div>
      )}

      {failures.map(f => (
        <div key={f._id} className="small">
          Job: {f.jobId} | {f.errorMessage || "Error"}
        </div>
      ))}
    </div>
  );
}
