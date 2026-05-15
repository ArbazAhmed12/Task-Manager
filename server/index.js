import "dotenv/config";
import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requireAdmin, requireAuth, signToken } from "./auth.js";
import { canAccessProject, db, isProjectMember, userPublicColumns } from "./db.js";
import { loginSchema, projectSchema, signupSchema, statusSchema, taskSchema, validate } from "./validation.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

function serializeTask(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    title: row.title,
    description: row.description,
    assigneeId: row.assignee_id,
    assigneeName: row.assignee_name,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function syncMembers(projectId, ownerId, memberIds) {
  const uniqueIds = [...new Set([ownerId, ...memberIds])];
  const insert = db.prepare("INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)");
  for (const userId of uniqueIds) insert.run(projectId, userId);
}

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.post("/api/auth/signup", validate(signupSchema), (req, res) => {
  const { name, email, password, role } = req.body;
  const passwordHash = bcrypt.hashSync(password, 10);
  const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;
  const assignedRole = userCount === 0 ? role : "member";
  try {
    const info = db
      .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)")
      .run(name, email.toLowerCase(), passwordHash, assignedRole);
    const user = db.prepare(`SELECT ${userPublicColumns()} FROM users u WHERE u.id = ?`).get(info.lastInsertRowid);
    res.status(201).json({ user, token: signToken(user) });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") return res.status(409).json({ error: "Email is already registered" });
    res.status(500).json({ error: "Could not create account" });
  }
});

app.post("/api/auth/login", validate(loginSchema), (req, res) => {
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(req.body.email.toLowerCase());
  if (!user || !bcrypt.compareSync(req.body.password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const publicUser = db.prepare(`SELECT ${userPublicColumns()} FROM users u WHERE u.id = ?`).get(user.id);
  res.json({ user: publicUser, token: signToken(publicUser) });
});

app.get("/api/me", requireAuth, (req, res) => res.json({ user: req.user }));

app.get("/api/users", requireAuth, (req, res) => {
  const users = db.prepare(`SELECT ${userPublicColumns()} FROM users u ORDER BY name`).all();
  res.json({ users });
});

app.get("/api/projects", requireAuth, (req, res) => {
  const rows =
    req.user.role === "admin"
      ? db
          .prepare(
            `SELECT p.*, u.name AS owner_name,
             COUNT(DISTINCT pm.user_id) AS member_count,
             COUNT(DISTINCT t.id) AS task_count
             FROM projects p
             JOIN users u ON u.id = p.owner_id
             LEFT JOIN project_members pm ON pm.project_id = p.id
             LEFT JOIN tasks t ON t.project_id = p.id
             GROUP BY p.id
             ORDER BY p.created_at DESC`
          )
          .all()
      : db
          .prepare(
            `SELECT p.*, u.name AS owner_name,
             COUNT(DISTINCT pm2.user_id) AS member_count,
             COUNT(DISTINCT t.id) AS task_count
             FROM projects p
             JOIN users u ON u.id = p.owner_id
             JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
             LEFT JOIN project_members pm2 ON pm2.project_id = p.id
             LEFT JOIN tasks t ON t.project_id = p.id
             GROUP BY p.id
             ORDER BY p.created_at DESC`
          )
          .all(req.user.id);
  res.json({ projects: rows });
});

app.post("/api/projects", requireAuth, requireAdmin, validate(projectSchema), (req, res) => {
  const info = db
    .prepare("INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)")
    .run(req.body.name, req.body.description, req.user.id);
  syncMembers(info.lastInsertRowid, req.user.id, req.body.memberIds);
  res.status(201).json({ id: info.lastInsertRowid });
});

app.put("/api/projects/:id", requireAuth, requireAdmin, validate(projectSchema), (req, res) => {
  const id = Number(req.params.id);
  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
  if (!project) return res.status(404).json({ error: "Project not found" });
  db.prepare("UPDATE projects SET name = ?, description = ? WHERE id = ?").run(req.body.name, req.body.description, id);
  db.prepare("DELETE FROM project_members WHERE project_id = ?").run(id);
  syncMembers(id, project.owner_id, req.body.memberIds);
  res.json({ ok: true });
});

app.delete("/api/projects/:id", requireAuth, requireAdmin, (req, res) => {
  db.prepare("DELETE FROM projects WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

app.get("/api/tasks", requireAuth, (req, res) => {
  const rows =
    req.user.role === "admin"
      ? db
          .prepare(
            `SELECT t.*, p.name AS project_name, a.name AS assignee_name
             FROM tasks t
             JOIN projects p ON p.id = t.project_id
             LEFT JOIN users a ON a.id = t.assignee_id
             ORDER BY COALESCE(t.due_date, '9999-12-31'), t.created_at DESC`
          )
          .all()
      : db
          .prepare(
            `SELECT t.*, p.name AS project_name, a.name AS assignee_name
             FROM tasks t
             JOIN projects p ON p.id = t.project_id
             JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
             LEFT JOIN users a ON a.id = t.assignee_id
             ORDER BY COALESCE(t.due_date, '9999-12-31'), t.created_at DESC`
          )
          .all(req.user.id);
  res.json({ tasks: rows.map(serializeTask) });
});

app.post("/api/tasks", requireAuth, validate(taskSchema), (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Only admins can create tasks" });
  if (!canAccessProject(req.user, req.body.projectId)) return res.status(403).json({ error: "Project access denied" });
  if (req.body.assigneeId && !isProjectMember(req.body.projectId, req.body.assigneeId)) {
    return res.status(400).json({ error: "Assignee must be a project member" });
  }
  const info = db
    .prepare(
      `INSERT INTO tasks (project_id, title, description, assignee_id, status, priority, due_date, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      req.body.projectId,
      req.body.title,
      req.body.description,
      req.body.assigneeId || null,
      req.body.status,
      req.body.priority,
      req.body.dueDate || null,
      req.user.id
    );
  res.status(201).json({ id: info.lastInsertRowid });
});

app.put("/api/tasks/:id/status", requireAuth, validate(statusSchema), (req, res) => {
  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(Number(req.params.id));
  if (!task) return res.status(404).json({ error: "Task not found" });
  const allowed = req.user.role === "admin" || task.assignee_id === req.user.id || isProjectMember(task.project_id, req.user.id);
  if (!allowed) return res.status(403).json({ error: "Task access denied" });
  db.prepare("UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(req.body.status, task.id);
  res.json({ ok: true });
});

app.delete("/api/tasks/:id", requireAuth, requireAdmin, (req, res) => {
  db.prepare("DELETE FROM tasks WHERE id = ?").run(Number(req.params.id));
  res.json({ ok: true });
});

app.get("/api/dashboard", requireAuth, (req, res) => {
  const tasks =
    req.user.role === "admin"
      ? db.prepare("SELECT * FROM tasks").all()
      : db
          .prepare(
            `SELECT t.* FROM tasks t
             JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ?`
          )
          .all(req.user.id);
  const today = new Date().toISOString().slice(0, 10);
  const byStatus = { todo: 0, in_progress: 0, done: 0 };
  for (const task of tasks) byStatus[task.status] += 1;
  res.json({
    total: tasks.length,
    byStatus,
    overdue: tasks.filter((task) => task.due_date && task.due_date < today && task.status !== "done").length,
    assignedToMe: tasks.filter((task) => task.assignee_id === req.user.id && task.status !== "done").length
  });
});

const dist = path.join(__dirname, "..", "dist");
app.use(express.static(dist));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(dist, "index.html"));
});

app.listen(port, () => {
  console.log(`Team Task Manager running on port ${port}`);
});
