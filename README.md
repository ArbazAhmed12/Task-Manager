# Team Task Manager

A full-stack team task management web app with authentication, project/team management, task assignment, dashboard metrics, SQL persistence, and role-based access control.

## Features

- Signup and login with JWT authentication
- Admin and Member roles
- Admins can create projects, assign project members, create tasks, and assign users
- Members can view accessible projects/tasks and update task status
- Dashboard with total tasks, completed tasks, assigned tasks, and overdue work
- REST API with validation and relational SQLite tables
- Railway-ready single-service deployment

## Tech Stack

- React + Vite
- Express
- SQLite via `better-sqlite3`
- JWT + bcrypt
- Zod validation

## Local Setup

```bash
npm install
npm run seed
npm run dev
```

Open the Vite URL shown in the terminal. The API runs on `http://localhost:8080`.

Demo accounts after seeding:

- Admin: `admin@example.com` / `password123`
- Member: `member@example.com` / `password123`

## Production Build

```bash
npm run build
npm start
```

## Railway Deployment

1. Push this repository to GitHub.
2. Create a new Railway project from the GitHub repository.
3. Add environment variables:
   - `JWT_SECRET`: a long random secret
   - `DATA_DIR`: `/data` if using a Railway volume, or omit for default local `data`
4. Add a Railway volume mounted at `/data` for persistent SQLite storage.
5. Deploy. Railway uses `railway.json` to run `npm run build` and `npm run start`.
6. Run the seed command once from Railway shell if demo data is needed:

```bash
npm run seed
```

## REST API

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/users`
- `GET /api/projects`
- `POST /api/projects` admin only
- `PUT /api/projects/:id` admin only
- `DELETE /api/projects/:id` admin only
- `GET /api/tasks`
- `POST /api/tasks` admin only
- `PUT /api/tasks/:id/status`
- `DELETE /api/tasks/:id` admin only
- `GET /api/dashboard`

## Submission

- Live URL: add your Railway app URL here
- GitHub repo: add your repository URL here
