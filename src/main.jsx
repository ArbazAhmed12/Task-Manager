import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  FolderKanban,
  LogOut,
  Plus,
  ShieldCheck,
  Users
} from "lucide-react";
import "./styles.css";

const API = "";
const statuses = {
  todo: "To do",
  in_progress: "In progress",
  done: "Done"
};

function App() {
  const [session, setSession] = useState(() => {
    const saved = localStorage.getItem("ttm_session");
    return saved ? JSON.parse(saved) : null;
  });
  const [view, setView] = useState("dashboard");
  const [data, setData] = useState({ dashboard: null, projects: [], tasks: [], users: [] });
  const [message, setMessage] = useState("");

  const isAdmin = session?.user.role === "admin";

  async function api(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        ...options.headers
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || "Request failed");
    return payload;
  }

  async function refresh() {
    if (!session) return;
    const [dashboard, projects, tasks, users] = await Promise.all([
      api("/api/dashboard"),
      api("/api/projects"),
      api("/api/tasks"),
      api("/api/users")
    ]);
    setData({ dashboard, projects: projects.projects, tasks: tasks.tasks, users: users.users });
  }

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, [session]);

  function saveSession(nextSession) {
    setSession(nextSession);
    localStorage.setItem("ttm_session", JSON.stringify(nextSession));
  }

  function logout() {
    localStorage.removeItem("ttm_session");
    setSession(null);
  }

  if (!session) return <AuthScreen onAuth={saveSession} />;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <FolderKanban size={28} />
          <div>
            <strong>TaskFlow</strong>
            <span>{session.user.role}</span>
          </div>
        </div>
        <nav>
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>
            <BarChart3 size={18} /> Dashboard
          </button>
          <button className={view === "projects" ? "active" : ""} onClick={() => setView("projects")}>
            <Users size={18} /> Projects
          </button>
          <button className={view === "tasks" ? "active" : ""} onClick={() => setView("tasks")}>
            <ClipboardList size={18} /> Tasks
          </button>
        </nav>
        <button className="ghost" onClick={logout}>
          <LogOut size={18} /> Logout
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p>Welcome back,</p>
            <h1>{session.user.name}</h1>
          </div>
          <span className="role-chip">
            <ShieldCheck size={16} /> {isAdmin ? "Admin controls enabled" : "Member workspace"}
          </span>
        </header>
        {message && <div className="notice">{message}</div>}
        {view === "dashboard" && <Dashboard dashboard={data.dashboard} tasks={data.tasks} />}
        {view === "projects" && <Projects isAdmin={isAdmin} api={api} refresh={refresh} projects={data.projects} users={data.users} />}
        {view === "tasks" && (
          <Tasks
            isAdmin={isAdmin}
            api={api}
            refresh={refresh}
            tasks={data.tasks}
            projects={data.projects}
            users={data.users}
            currentUser={session.user}
          />
        )}
      </section>
    </main>
  );
}

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "admin@example.com", password: "password123", role: "member" });
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      const path = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const body = mode === "login" ? { email: form.email, password: form.password } : form;
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error);
      onAuth(payload);
    } catch (err) {
      setError(err.message || "Authentication failed");
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="auth-copy">
          <FolderKanban size={38} />
          <h1>Team Task Manager</h1>
          <p>Create projects, assign work, and keep delivery visible with admin/member access control.</p>
        </div>
        <form onSubmit={submit} className="auth-form">
          <div className="segmented">
            <button type="button" className={mode === "login" ? "selected" : ""} onClick={() => setMode("login")}>
              Login
            </button>
            <button type="button" className={mode === "signup" ? "selected" : ""} onClick={() => setMode("signup")}>
              Signup
            </button>
          </div>
          {mode === "signup" && (
            <label>
              Name
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            </label>
          )}
          <label>
            Email
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required />
          </label>
          <label>
            Password
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              minLength={6}
              required
            />
          </label>
          {mode === "signup" && (
            <label>
              Role
              <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          )}
          {error && <p className="error">{error}</p>}
          <button className="primary" type="submit">
            {mode === "login" ? "Login" : "Create account"}
          </button>
          <p className="hint">Demo admin: admin@example.com / password123</p>
        </form>
      </section>
    </main>
  );
}

function Dashboard({ dashboard, tasks }) {
  const overdueTasks = tasks.filter((task) => task.dueDate && task.dueDate < today() && task.status !== "done");
  const cards = [
    ["Total tasks", dashboard?.total ?? 0, <ClipboardList size={22} />],
    ["Assigned to me", dashboard?.assignedToMe ?? 0, <Users size={22} />],
    ["Overdue", dashboard?.overdue ?? 0, <BarChart3 size={22} />],
    ["Completed", dashboard?.byStatus?.done ?? 0, <CheckCircle2 size={22} />]
  ];
  return (
    <div className="stack">
      <div className="metrics">
        {cards.map(([label, value, icon]) => (
          <article className="metric" key={label}>
            {icon}
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
      <section className="panel">
        <div className="panel-title">
          <h2>Status overview</h2>
        </div>
        <div className="bars">
          {Object.entries(statuses).map(([key, label]) => (
            <div className="bar-row" key={key}>
              <span>{label}</span>
              <div>
                <i style={{ width: `${Math.max(5, ((dashboard?.byStatus?.[key] ?? 0) / Math.max(1, dashboard?.total ?? 1)) * 100)}%` }} />
              </div>
              <b>{dashboard?.byStatus?.[key] ?? 0}</b>
            </div>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>Overdue tasks</h2>
        </div>
        <TaskRows tasks={overdueTasks} />
      </section>
    </div>
  );
}

function Projects({ isAdmin, api, refresh, projects, users }) {
  const [form, setForm] = useState({ name: "", description: "", memberIds: [] });

  async function createProject(event) {
    event.preventDefault();
    await api("/api/projects", { method: "POST", body: JSON.stringify(form) });
    setForm({ name: "", description: "", memberIds: [] });
    await refresh();
  }

  return (
    <div className="stack">
      {isAdmin && (
        <section className="panel">
          <div className="panel-title">
            <h2>New project</h2>
          </div>
          <form className="grid-form" onSubmit={createProject}>
            <input placeholder="Project name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
            <input
              placeholder="Description"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
            <select
              multiple
              value={form.memberIds.map(String)}
              onChange={(event) =>
                setForm({ ...form, memberIds: [...event.target.selectedOptions].map((option) => Number(option.value)) })
              }
            >
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <button className="primary">
              <Plus size={17} /> Create
            </button>
          </form>
        </section>
      )}
      <section className="project-grid">
        {projects.map((project) => (
          <article className="project-card" key={project.id}>
            <h3>{project.name}</h3>
            <p>{project.description || "No description yet."}</p>
            <div>
              <span>{project.member_count} members</span>
              <span>{project.task_count} tasks</span>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}

function Tasks({ isAdmin, api, refresh, tasks, projects, users }) {
  const [form, setForm] = useState({
    projectId: projects[0]?.id || "",
    title: "",
    description: "",
    assigneeId: "",
    status: "todo",
    priority: "medium",
    dueDate: ""
  });

  useEffect(() => {
    if (!form.projectId && projects[0]?.id) setForm((current) => ({ ...current, projectId: projects[0].id }));
  }, [projects]);

  const grouped = useMemo(() => {
    return Object.keys(statuses).reduce((acc, status) => ({ ...acc, [status]: tasks.filter((task) => task.status === status) }), {});
  }, [tasks]);

  async function createTask(event) {
    event.preventDefault();
    await api("/api/tasks", {
      method: "POST",
      body: JSON.stringify({
        ...form,
        projectId: Number(form.projectId),
        assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
        dueDate: form.dueDate || null
      })
    });
    setForm({ ...form, title: "", description: "", dueDate: "" });
    await refresh();
  }

  async function updateStatus(task, status) {
    await api(`/api/tasks/${task.id}/status`, { method: "PUT", body: JSON.stringify({ status }) });
    await refresh();
  }

  return (
    <div className="stack">
      {isAdmin && (
        <section className="panel">
          <div className="panel-title">
            <h2>New task</h2>
          </div>
          <form className="grid-form task-form" onSubmit={createTask}>
            <select value={form.projectId} onChange={(event) => setForm({ ...form, projectId: event.target.value })} required>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            <input placeholder="Task title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            <select value={form.assigneeId} onChange={(event) => setForm({ ...form, assigneeId: event.target.value })}>
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} />
            <button className="primary">
              <Plus size={17} /> Add task
            </button>
          </form>
        </section>
      )}
      <section className="task-board">
        {Object.entries(statuses).map(([status, label]) => (
          <div className="task-column" key={status}>
            <h2>{label}</h2>
            {grouped[status]?.map((task) => (
              <article className={`task-card ${task.priority}`} key={task.id}>
                <div>
                  <h3>{task.title}</h3>
                  <span>{task.projectName}</span>
                </div>
                <p>{task.description || "No description."}</p>
                <div className="task-meta">
                  <span>{task.assigneeName || "Unassigned"}</span>
                  <span>{task.dueDate || "No due date"}</span>
                </div>
                <select value={task.status} onChange={(event) => updateStatus(task, event.target.value)}>
                  {Object.entries(statuses).map(([key, name]) => (
                    <option value={key} key={key}>
                      {name}
                    </option>
                  ))}
                </select>
              </article>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}

function TaskRows({ tasks }) {
  if (!tasks.length) return <p className="empty">Nothing overdue.</p>;
  return (
    <div className="rows">
      {tasks.map((task) => (
        <div className="row" key={task.id}>
          <strong>{task.title}</strong>
          <span>{task.projectName}</span>
          <span>{task.assigneeName || "Unassigned"}</span>
          <span>{task.dueDate}</span>
        </div>
      ))}
    </div>
  );
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

createRoot(document.getElementById("root")).render(<App />);

