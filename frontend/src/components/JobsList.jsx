import { useEffect, useState } from "react";
import { getJobs, deleteJob } from "../api";

export default function JobsList({ onSelect, refreshKey }) {
  const [jobs, setJobs] = useState([]);

  async function load() {
    const res = await getJobs();
    setJobs(res.data || []);
  }

  async function remove(id) {
    await deleteJob(id);
    load();
  }

  useEffect(() => {
    load();
  }, [refreshKey]);

  return (
    <div className="card">
      <h2>Jobs</h2>

      {jobs.map(j => (
        <div key={j._id} className="small">
          <b>{j._id}</b><br />
          {j.schedule}<br />
          {j.endpoint}<br />

          <button onClick={() => onSelect(j._id)}>Edit</button>
          <button className="danger" onClick={() => remove(j._id)}>Delete</button>
          <hr />
        </div>
      ))}
    </div>
  );
}
