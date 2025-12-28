const API = "http://localhost:3000/api";

/* Jobs */
export const createJob = (data) =>
  fetch(`${API}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(r => r.json());

export const getJobs = () =>
  fetch(`${API}/jobs`).then(r => r.json());

export const getJob = (id) =>
  fetch(`${API}/jobs/${id}`).then(r => r.json());

export const updateJob = (id, data) =>
  fetch(`${API}/jobs/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  }).then(r => r.json());

export const deleteJob = (id) =>
  fetch(`${API}/jobs/${id}`, { method: "DELETE" }).then(r => r.json());

/* Executions */
export const getExecutions = (id) =>
  fetch(`${API}/jobs/${id}/executions`).then(r => r.json());

/* Observability */
export const getHealth = () =>
  fetch(`${API}/observability/health`).then(r => r.json());

export const getStats = () =>
  fetch(`${API}/observability/stats`).then(r => r.json());

export const getFailures = (limit = 10) =>
  fetch(`${API}/observability/failures?limit=${limit}`)
    .then(r => r.json());
