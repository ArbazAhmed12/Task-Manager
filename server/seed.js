import bcrypt from "bcryptjs";
import { db } from "./db.js";

const users = [
  ["Aarav Admin", "admin@example.com", "password123", "admin"],
  ["Maya Member", "member@example.com", "password123", "member"],
  ["Sam Member", "sam@example.com", "password123", "member"]
];

for (const [name, email, password, role] of users) {
  db.prepare(
    `INSERT OR IGNORE INTO users (name, email, password_hash, role)
     VALUES (?, ?, ?, ?)`
  ).run(name, email, bcrypt.hashSync(password, 10), role);
}

const admin = db.prepare("SELECT * FROM users WHERE email = ?").get("admin@example.com");
const maya = db.prepare("SELECT * FROM users WHERE email = ?").get("member@example.com");
const sam = db.prepare("SELECT * FROM users WHERE email = ?").get("sam@example.com");

let project = db.prepare("SELECT * FROM projects WHERE name = ?").get("Website Relaunch");
if (!project) {
  const info = db
    .prepare("INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)")
    .run("Website Relaunch", "Public marketing site refresh with launch checklist.", admin.id);
  project = { id: info.lastInsertRowid };
}

for (const user of [admin, maya, sam]) {
  db.prepare("INSERT OR IGNORE INTO project_members (project_id, user_id) VALUES (?, ?)").run(project.id, user.id);
}

const count = db.prepare("SELECT COUNT(*) AS count FROM tasks").get().count;
if (!count) {
  const insert = db.prepare(
    `INSERT INTO tasks (project_id, title, description, assignee_id, status, priority, due_date, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  insert.run(project.id, "Prepare wireframes", "Create homepage and dashboard wireframes.", maya.id, "in_progress", "high", "2026-05-20", admin.id);
  insert.run(project.id, "QA login flow", "Verify signup, login, and session persistence.", sam.id, "todo", "medium", "2026-05-18", admin.id);
  insert.run(project.id, "Publish launch notes", "Summarize release scope for stakeholders.", maya.id, "done", "low", "2026-05-12", admin.id);
}

console.log("Seed complete");
console.log("Admin: admin@example.com / password123");
console.log("Member: member@example.com / password123");
