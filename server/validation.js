import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  password: z.string().min(6).max(100),
  role: z.enum(["admin", "member"]).default("member")
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

export const projectSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().trim().max(1000).optional().default(""),
  memberIds: z.array(z.number().int().positive()).optional().default([])
});

export const taskSchema = z.object({
  projectId: z.number().int().positive(),
  title: z.string().trim().min(2).max(140),
  description: z.string().trim().max(1200).optional().default(""),
  assigneeId: z.number().int().positive().nullable().optional(),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
});

export const statusSchema = z.object({
  status: z.enum(["todo", "in_progress", "done"])
});

export function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid input" });
    }
    req.body = parsed.data;
    next();
  };
}

