import { useState } from "react";
import JobForm from "./components/JobForm";
import JobsList from "./components/JobsList";
import Executions from "./components/Executions";
import Observability from "./components/Observability";

export default function App() {
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [refreshJobs, setRefreshJobs] = useState(0);

  return (
    <div className="container">
      <h1>Job Scheduler Dashboard</h1>

      <JobForm
        jobId={selectedJobId}
        onSaved={() => setRefreshJobs(r => r + 1)}
        clearSelection={() => setSelectedJobId(null)}
      />

      <JobsList
        refreshKey={refreshJobs}
        onSelect={setSelectedJobId}
      />

      <Executions />
      <Observability />
    </div>
  );
}
