const API_URL = 'http://localhost:5000/api/courses';
const HEADERS = {
  'Content-Type': 'application/json',
};

const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Completed'];

let courses = [];
let isLoading = false;
let editingCourse = null;

const app = document.querySelector('#app');

function render() {
  app.innerHTML = `
    <header class="app-header">
      <h1>CodeCraftHub: Your Learning Management Platform</h1>
      <p>Plan, track, and complete your learning journey</p>
    </header>
    <div class="container">
      <div id="alert-container"></div>

      <div class="card">
        <div class="card-title">Add New Course</div>
        <form id="course-form" novalidate>
          <div class="form-grid">
            <div class="form-group full-width">
              <label for="name">Course Name <span class="required">*</span></label>
              <input type="text" id="name" name="name" placeholder="e.g. Advanced JavaScript" />
            </div>
            <div class="form-group full-width">
              <label for="description">Description <span class="required">*</span></label>
              <textarea id="description" name="description" placeholder="What will you learn in this course?"></textarea>
            </div>
            <div class="form-group">
              <label for="target_date">Target Date <span class="required">*</span></label>
              <input type="date" id="target_date" name="target_date" />
            </div>
            <div class="form-group">
              <label for="status">Status <span class="required">*</span></label>
              <select id="status" name="status">
                ${STATUS_OPTIONS.map(s => `<option value="${s}">${s}</option>`).join('')}
              </select>
            </div>
            <div class="form-actions">
              <button type="submit" class="btn btn-primary" id="submit-btn">Add Course</button>
              <button type="button" class="btn btn-secondary" id="reset-btn">Reset</button>
            </div>
          </div>
        </form>
      </div>

      <div id="stats-section"></div>

      <div class="card">
        <div class="card-title">Your Courses</div>
        <div id="course-list"></div>
      </div>
    </div>

    <div id="modal-container"></div>
  `;

  document.getElementById('course-form').addEventListener('submit', handleFormSubmit);
  document.getElementById('reset-btn').addEventListener('click', resetForm);

  renderCourseList();
  renderStats();
}

function renderCourseList() {
  const container = document.getElementById('course-list');

  if (isLoading) {
    container.innerHTML = `
      <div class="spinner-overlay">
        <div class="spinner"></div>
        <p>Loading courses...</p>
      </div>
    `;
    return;
  }

  if (courses.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📚</div>
        <p>No courses yet. Add your first course above to get started!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Course</th>
            <th>Target Date</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${courses.map(course => `
            <tr>
              <td>
                <div class="course-name">${escapeHtml(course.name)}</div>
                <div class="course-description">${escapeHtml(course.description)}</div>
              </td>
              <td>${formatDate(course.target_date)}</td>
              <td>${statusBadge(course.status)}</td>
              <td>${formatDate(course.created_at)}</td>
              <td>
                <div class="action-buttons">
                  <button class="btn btn-secondary btn-sm" onclick="window.__editCourse('${course.id}')">Edit</button>
                  <button class="btn btn-danger btn-sm" onclick="window.__deleteCourse('${course.id}')">Remove</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderStats() {
  const container = document.getElementById('stats-section');
  if (courses.length === 0) {
    container.innerHTML = '';
    return;
  }

  const total = courses.length;
  const completed = courses.filter(c => c.status === 'Completed').length;
  const inProgress = courses.filter(c => c.status === 'In Progress').length;
  const notStarted = courses.filter(c => c.status === 'Not Started').length;

  container.innerHTML = `
    <div class="stats-bar">
      <div class="stat-card">
        <div class="stat-value">${total}</div>
        <div class="stat-label">Total Courses</div>
      </div>
      <div class="stat-card completed">
        <div class="stat-value">${completed}</div>
        <div class="stat-label">Completed</div>
      </div>
      <div class="stat-card in-progress">
        <div class="stat-value">${inProgress}</div>
        <div class="stat-label">In Progress</div>
      </div>
      <div class="stat-card not-started">
        <div class="stat-value">${notStarted}</div>
        <div class="stat-label">Not Started</div>
      </div>
    </div>
  `;
}

// ===== API Functions =====

async function fetchCourses() {
  isLoading = true;
  renderCourseList();
  try {
    const res = await fetch(API_URL);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Failed to load courses (${res.status})`);
    }
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Unexpected response format from server');
    courses = data;
  } catch (err) {
    showAlert(`Error loading courses: ${err.message}`, 'error');
    courses = [];
  } finally {
    isLoading = false;
    renderCourseList();
    renderStats();
  }
}

async function handleFormSubmit(e) {
  e.preventDefault();
  clearFieldErrors();

  const form = e.target;
  const name = form.name.value.trim();
  const description = form.description.value.trim();
  const target_date = form.target_date.value;
  const status = form.status.value;

  const validation = validateFields({ name, description, target_date });
  if (!validation.valid) {
    Object.entries(validation.errors).forEach(([field, msg]) => {
      const el = form.querySelector(`[name="${field}"]`);
      if (el) el.classList.add('error');
    });
    showAlert(validation.message, 'error');
    return;
  }

  const btn = document.getElementById('submit-btn');
  btn.disabled = true;
  btn.textContent = 'Adding...';

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ name, description, target_date, status }),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Failed to create course (${res.status})`);
    }
    const data = await res.json();
    if (!data || !data.id) throw new Error('Server did not return the created course');
    courses.unshift(data);
    renderCourseList();
    renderStats();
    resetForm();
    showAlert(`Course "${name}" added successfully!`, 'success');
  } catch (err) {
    showAlert(`Error adding course: ${err.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Add Course';
  }
}

async function updateCourse(id, updates) {
  try {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Failed to update course (${res.status})`);
    }
    const data = await res.json();
    if (!data || !data.id) throw new Error('Server did not return the updated course');
    const idx = courses.findIndex(c => c.id === id);
    if (idx !== -1) {
      courses[idx] = data;
      renderCourseList();
      renderStats();
    }
    showAlert('Course updated successfully!', 'success');
    return true;
  } catch (err) {
    showAlert(`Error updating course: ${err.message}`, 'error');
    return false;
  }
}

async function deleteCourse(id) {
  const course = courses.find(c => c.id === id);
  if (!course) return;
  if (!confirm(`Are you sure you want to delete "${course.name}"? This cannot be undone.`)) return;

  try {
    const res = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
      headers: HEADERS,
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Failed to delete course (${res.status})`);
    }
    courses = courses.filter(c => c.id !== id);
    renderCourseList();
    renderStats();
    showAlert(`Course "${course.name}" deleted.`, 'success');
  } catch (err) {
    showAlert(`Error deleting course: ${err.message}`, 'error');
  }
}

// ===== Modal (Edit) =====

function openEditModal(id) {
  const course = courses.find(c => c.id === id);
  if (!course) return;
  editingCourse = course;

  const container = document.getElementById('modal-container');
  container.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal" onclick="event.stopPropagation()">
        <div class="modal-header">
          <h2>Edit Course</h2>
          <button class="modal-close" onclick="window.__closeModal()">&times;</button>
        </div>
        <div class="modal-body">
          <form id="edit-form" novalidate>
            <div class="form-grid">
              <div class="form-group full-width">
                <label for="edit-name">Course Name <span class="required">*</span></label>
                <input type="text" id="edit-name" name="name" value="${escapeAttr(course.name)}" />
              </div>
              <div class="form-group full-width">
                <label for="edit-description">Description <span class="required">*</span></label>
                <textarea id="edit-description" name="description">${escapeHtml(course.description)}</textarea>
              </div>
              <div class="form-group">
                <label for="edit-target_date">Target Date <span class="required">*</span></label>
                <input type="date" id="edit-target_date" name="target_date" value="${course.target_date}" />
              </div>
              <div class="form-group">
                <label for="edit-status">Status</label>
                <select id="edit-status" name="status">
                  ${STATUS_OPTIONS.map(s => `<option value="${s}" ${s === course.status ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="window.__closeModal()">Cancel</button>
          <button class="btn btn-primary" id="save-btn" onclick="window.__saveEdit()">Save Changes</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('modal-overlay').addEventListener('click', closeModal);
}

function closeModal() {
  document.getElementById('modal-container').innerHTML = '';
  editingCourse = null;
}

async function saveEdit() {
  if (!editingCourse) return;
  const form = document.getElementById('edit-form');

  form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));

  const name = form.name.value.trim();
  const description = form.description.value.trim();
  const target_date = form.target_date.value;
  const status = form.status.value;

  const validation = validateFields({ name, description, target_date });
  if (!validation.valid) {
    Object.entries(validation.errors).forEach(([field]) => {
      const el = form.querySelector(`[name="${field}"]`);
      if (el) el.classList.add('error');
    });
    showAlert(validation.message, 'error');
    return;
  }

  const btn = document.getElementById('save-btn');
  btn.disabled = true;
  btn.textContent = 'Saving...';

  const success = await updateCourse(editingCourse.id, { name, description, target_date, status });
  btn.disabled = false;
  btn.textContent = 'Save Changes';
  if (success) closeModal();
}

// ===== Helpers =====

function showAlert(message, type) {
  const container = document.getElementById('alert-container');
  if (!container) return;
  container.innerHTML = `<div class="alert alert-${type}">${escapeHtml(message)}</div>`;
  const timeout = type === 'success' ? 3000 : 5000;
  setTimeout(() => { container.innerHTML = ''; }, timeout);
}

function resetForm() {
  const form = document.getElementById('course-form');
  if (form) {
    form.reset();
    clearFieldErrors();
    form.querySelector('[name="status"]').value = 'Not Started';
  }
}

function clearFieldErrors() {
  document.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
}

function validateFields({ name, description, target_date }) {
  const errors = {};
  if (!name) errors.name = true;
  if (!description) errors.description = true;
  if (!target_date) errors.target_date = true;

  if (Object.keys(errors).length === 0) {
    return { valid: true, errors: {} };
  }

  const missing = [];
  if (errors.name) missing.push('Course Name');
  if (errors.description) missing.push('Description');
  if (errors.target_date) missing.push('Target Date');

  return {
    valid: false,
    errors,
    message: `Please fill in all required fields: ${missing.join(', ')}`,
  };
}

function statusBadge(status) {
  const cssClass = status.toLowerCase().replace(/\s+/g, '-');
  return `<span class="status-badge status-${cssClass}">${escapeHtml(status)}</span>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return escapeHtml(dateStr);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function escapeAttr(str) {
  if (str == null) return '';
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ===== Expose handlers for inline onclick =====
window.__editCourse = openEditModal;
window.__deleteCourse = deleteCourse;
window.__closeModal = closeModal;
window.__saveEdit = saveEdit;

// ===== Init =====
render();
fetchCourses();
