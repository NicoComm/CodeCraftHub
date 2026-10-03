import express from 'express';
import cors from 'cors';

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

let courses = [];
let nextId = 1;

const VALID_STATUSES = ['Not Started', 'In Progress', 'Completed'];

function validateCourse(body, partial = false) {
  const errors = [];
  if (!partial || body.name !== undefined) {
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      errors.push('name is required');
    }
  }
  if (!partial || body.description !== undefined) {
    if (!body.description || typeof body.description !== 'string' || !body.description.trim()) {
      errors.push('description is required');
    }
  }
  if (!partial || body.target_date !== undefined) {
    if (!body.target_date || !/^\d{4}-\d{2}-\d{2}$/.test(body.target_date)) {
      errors.push('target_date is required and must be in YYYY-MM-DD format');
    }
  }
  if (!partial || body.status !== undefined) {
    if (!body.status || !VALID_STATUSES.includes(body.status)) {
      errors.push(`status is required and must be one of: ${VALID_STATUSES.join(', ')}`);
    }
  }
  return errors;
}

// GET /api/courses - fetch all courses
app.get('/api/courses', (req, res) => {
  res.json(courses);
});

// POST /api/courses - create new course
app.post('/api/courses', (req, res) => {
  const errors = validateCourse(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  const course = {
    id: nextId++,
    name: req.body.name.trim(),
    description: req.body.description.trim(),
    target_date: req.body.target_date,
    status: req.body.status,
    created_at: new Date().toISOString(),
  };

  courses.push(course);
  res.status(201).json(course);
});

// PUT /api/courses/:id - update course
app.put('/api/courses/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const idx = courses.findIndex(c => c.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Course not found' });
  }

  const errors = validateCourse(req.body, true);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }

  const updated = {
    ...courses[idx],
    ...Object.fromEntries(
      Object.entries(req.body).filter(([k]) => ['name', 'description', 'target_date', 'status'].includes(k))
    ),
  };

  if (updated.name) updated.name = updated.name.trim();
  if (updated.description) updated.description = updated.description.trim();

  courses[idx] = updated;
  res.json(updated);
});

// DELETE /api/courses/:id - delete course
app.delete('/api/courses/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const idx = courses.findIndex(c => c.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Course not found' });
  }

  courses.splice(idx, 1);
  res.status(204).send();
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
