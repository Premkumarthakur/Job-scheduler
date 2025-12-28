import { useEffect, useState } from "react";
import { createJob, getJob, updateJob } from "../api";

export default function JobForm({ jobId, clearSelection, onSaved }) {
  const [schedule, setSchedule] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [msg, setMsg] = useState("");

  const isEditMode = Boolean(jobId);

  useEffect(() => {
    if (!jobId) return;
    getJob(jobId).then(res => {
      setSchedule(res.data.schedule);
      setEndpoint(res.data.endpoint);
    });
  }, [jobId]);

  async function submit() {
    const payload = { schedule, endpoint };

    const res = isEditMode
      ? await updateJob(jobId, payload)
      : await createJob(payload);

    if (res.success) {
      setMsg(isEditMode ? "Job updated" : "Job created");
      onSaved();
      clearForm();
    } else {
      setMsg(res.error);
    }
  }

  function clearForm() {
    setSchedule("");
    setEndpoint("");
    clearSelection();
  }

  return (
    <div className="card">
      <h2>{isEditMode ? "Edit Job" : "Create Job"}</h2>

      <input
        placeholder="Cron schedule (with seconds)"
        value={schedule}
        onChange={e => setSchedule(e.target.value)}
      />

      <input
        placeholder="API endpoint"
        value={endpoint}
        onChange={e => setEndpoint(e.target.value)}
      />

      <button className="primary" onClick={submit}>
        {isEditMode ? "Update Job" : "Create Job"}
      </button>

      {isEditMode && (
        <button onClick={clearForm}>Cancel Edit</button>
      )}

      <p className="small">{msg}</p>
    </div>
  );
}
