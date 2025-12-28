import { useState } from "react";
import { getExecutions } from "../api";

export default function Executions() {
  const [jobId, setJobId] = useState("");
  const [executions, setExecutions] = useState([]);
  const [message, setMessage] = useState("");

  async function check() {
    if (!jobId.trim()) {
      setMessage("Enter Job ID");
      setExecutions([]);
      return;
    }

    const res = await getExecutions(jobId);

    if (!res.success || res.data.length === 0) {
      setMessage("Job has not executed yet");
      setExecutions([]);
    } else {
      setMessage("Last 5 executions");
      setExecutions(res.data);
    }
  }

  return (
    <div className="card">
      <h2>Execution Status</h2>

      <input
        placeholder="Enter Job ID"
        value={jobId}
        onChange={e => setJobId(e.target.value)}
      />

      <button onClick={check}>Check</button>
      <p className="small">{message}</p>

      {executions.map(e => (
        <div key={e._id} className="small">
          {e.status} | {e.responseCode || "-"} | {e.duration}ms
        </div>
      ))}
    </div>
  );
}
