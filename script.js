/* ============================================================
   TaskFlow — script.js
   Vanilla JS To-Do App with localStorage persistence
   ============================================================ */

'use strict';

/* ── CONSTANTS ─────────────────────────────────────────────── */
const STORAGE_KEY = 'taskflow_tasks_v1';
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

/* ── STATE ─────────────────────────────────────────────────── */
let tasks          = [];
let activeFilter   = 'all';       // all | active | completed | overdue
let activeCategory = 'all';       // all | work | personal | shopping | health | other
let activeSort     = 'created-desc';
let searchQuery    = '';
let pendingDeleteId = null;

/* ── DOM REFS ──────────────────────────────────────────────── */
const taskList        = document.getElementById('taskList');
const emptyState      = document.getElementById('emptyState');
const emptyMessage    = document.getElementById('emptyMessage');
const taskModal       = document.getElementById('taskModal');
const deleteModal     = document.getElementById('deleteModal');
const taskForm        = document.getElementById('taskForm');
const modalTitle      = document.getElementById('modalTitle');
const submitBtn       = document.getElementById('submitBtn');
const editTaskId      = document.getElementById('editTaskId');
const taskTitle       = document.getElementById('taskTitle');
const taskNote        = document.getElementById('taskNote');
const taskCategory    = document.getElementById('taskCategory');
const taskPriority    = document.getElementById('taskPriority');
const taskDue         = document.getElementById('taskDue');
const titleError      = document.getElementById('titleError');
const statActive      = document.getElementById('statActive');
const statDone        = document.getElementById('statDone');
const toastContainer  = document.getElementById('toastContainer');
const searchInput     = document.getElementById('searchInput');
const sortSelect      = document.getElementById('sortSelect');
const clockEl         = document.getElementById('clock');
const clearCompleted  = document.getElementById('clearCompletedBtn');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn  = document.getElementById('cancelDeleteBtn');
const fabBtn           = document.getElementById('fabBtn');
const modalCloseBtn    = document.getElementById('modalCloseBtn');
const cancelBtn        = document.getElementById('cancelBtn');

/* ── UTILITIES ─────────────────────────────────────────────── */

/** Generate a unique ID */
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** Save tasks to localStorage */
const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));

/** Load tasks from localStorage */
const load = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    tasks = raw ? JSON.parse(raw) : [];
  } catch {
    tasks = [];
  }
};

/** Check if a task is overdue */
const isOverdue = (task) =>
  !task.completed && task.dueDate && new Date(task.dueDate) < new Date();

/** Format a datetime string to a readable label */
const formatDue = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = d - now;
  const diffDays = Math.ceil(diff / 86400000);

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const date = d.toLocaleDateString([], { month: 'short', day: 'numeric' });

  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Tomorrow, ${time}`;
  if (diffDays === -1) return `Yesterday, ${time}`;
  if (diffDays < 0) return `${date}, ${time} (overdue)`;
  if (diffDays <= 7) return `${d.toLocaleDateString([], { weekday: 'short' })}, ${time}`;
  return `${date}, ${time}`;
};

/** Capitalize first letter */
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* ── TOAST ─────────────────────────────────────────────────── */
const showToast = (msg, type = 'info', icon = '') => {
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.setAttribute('role', 'status');
  t.innerHTML = `<span>${icon || (type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️')}</span> ${msg}`;
  toastContainer.appendChild(t);
  setTimeout(() => t.remove(), 3000);
};

/* ── CLOCK ─────────────────────────────────────────────────── */
const updateClock = () => {
  clockEl.textContent = new Date().toLocaleTimeString([], {
    weekday: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
};
updateClock();
setInterval(updateClock, 1000);

/* ── FILTER & SORT LOGIC ───────────────────────────────────── */
const getFilteredTasks = () => {
  let result = [...tasks];

  // Category filter
  if (activeCategory !== 'all') {
    result = result.filter(t => t.category === activeCategory);
  }

  // Status / tab filter
  switch (activeFilter) {
    case 'active':    result = result.filter(t => !t.completed); break;
    case 'completed': result = result.filter(t => t.completed);  break;
    case 'overdue':   result = result.filter(t => isOverdue(t)); break;
  }

  // Search
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    result = result.filter(t =>
      t.title.toLowerCase().includes(q) ||
      (t.note && t.note.toLowerCase().includes(q))
    );
  }

  // Sort
  switch (activeSort) {
    case 'created-desc': result.sort((a,b) => b.createdAt - a.createdAt); break;
    case 'created-asc':  result.sort((a,b) => a.createdAt - b.createdAt); break;
    case 'due-asc':
      result.sort((a,b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate) - new Date(b.dueDate);
      });
      break;
    case 'due-desc':
      result.sort((a,b) => {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(b.dueDate) - new Date(a.dueDate);
      });
      break;
    case 'priority':
      result.sort((a,b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
      break;
    case 'alpha':
      result.sort((a,b) => a.title.localeCompare(b.title));
      break;
  }

  return result;
};

/* ── RENDER ────────────────────────────────────────────────── */
const render = () => {
  const filtered = getFilteredTasks();

  // Update stats
  const activeCount    = tasks.filter(t => !t.completed).length;
  const completedCount = tasks.filter(t => t.completed).length;
  statActive.textContent = `${activeCount} active`;
  statDone.textContent   = `${completedCount} done`;

  // Update category counts
  const cats = ['all', 'work', 'personal', 'shopping', 'health', 'other'];
  cats.forEach(cat => {
    const el = document.getElementById(`catCount-${cat}`);
    if (el) {
      el.textContent = cat === 'all'
        ? tasks.length
        : tasks.filter(t => t.category === cat).length;
    }
  });

  // Empty state
  if (filtered.length === 0) {
    taskList.innerHTML = '';
    emptyState.hidden = false;
    emptyState.removeAttribute('aria-hidden');

    // Contextual empty messages
    const msgs = {
      all:       'Add your first task to get started.',
      active:    'No active tasks. Great job! 🎉',
      completed: 'No completed tasks yet. Keep going!',
      overdue:   'No overdue tasks. You\'re on top of things! 🙌',
    };

    if (searchQuery.trim()) {
      emptyMessage.textContent = `No tasks found for "${searchQuery}".`;
    } else {
      emptyMessage.textContent = msgs[activeFilter] || msgs.all;
    }
    return;
  }

  emptyState.hidden = true;
  emptyState.setAttribute('aria-hidden', 'true');

  // Render task cards using DocumentFragment for performance
  const frag = document.createDocumentFragment();
  filtered.forEach(task => {
    const li = buildTaskCard(task);
    frag.appendChild(li);
  });

  taskList.innerHTML = '';
  taskList.appendChild(frag);
};

/* ── BUILD TASK CARD ───────────────────────────────────────── */
const buildTaskCard = (task) => {
  const overdue = isOverdue(task);
  const li = document.createElement('li');
  li.className = [
    'task-card',
    task.completed ? 'task-card--done'    : '',
    overdue        ? 'task-card--overdue' : '',
  ].filter(Boolean).join(' ');
  li.dataset.id       = task.id;
  li.dataset.category = task.category;
  li.dataset.priority = task.priority;

  const dueLabel = task.dueDate ? formatDue(task.dueDate) : '';

  li.innerHTML = `
    <button
      class="task-check"
      aria-label="${task.completed ? 'Mark as incomplete' : 'Mark as complete'}"
      data-action="toggle"
      title="${task.completed ? 'Mark incomplete' : 'Mark complete'}"
    >${task.completed ? '✓' : ''}</button>

    <div class="task-body">
      <p class="task-title">${escapeHtml(task.title)}</p>
      ${task.note ? `<p class="task-note">${escapeHtml(task.note)}</p>` : ''}
      <div class="task-meta">
        <span class="tag-category">${cap(task.category)}</span>
        <span class="tag-priority priority-${task.priority}">${cap(task.priority)}</span>
        ${dueLabel ? `<span class="task-due">${escapeHtml(dueLabel)}</span>` : ''}
      </div>
    </div>

    <div class="task-actions" role="group" aria-label="Task actions">
      <button class="task-action-btn" data-action="edit" aria-label="Edit task" title="Edit">✏️</button>
      <button class="task-action-btn task-action-btn--delete" data-action="delete" aria-label="Delete task" title="Delete">🗑️</button>
    </div>
  `;

  return li;
};

/** Escape HTML to prevent XSS */
const escapeHtml = (str) =>
  str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
     .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

/* ── EVENT DELEGATION — TASK LIST ──────────────────────────── */
taskList.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const card = btn.closest('.task-card');
  if (!card) return;

  const id     = card.dataset.id;
  const action = btn.dataset.action;

  if (action === 'toggle') toggleTask(id);
  if (action === 'edit')   openEditModal(id);
  if (action === 'delete') openDeleteModal(id);
});

/* ── TASK ACTIONS ──────────────────────────────────────────── */
const addTask = (data) => {
  const task = {
    id:        genId(),
    title:     data.title.trim(),
    note:      data.note.trim(),
    category:  data.category,
    priority:  data.priority,
    dueDate:   data.dueDate || null,
    completed: false,
    createdAt: Date.now(),
  };
  tasks.unshift(task);
  save();
  render();
  showToast('Task added!', 'success');
};

const editTask = (id, data) => {
  const idx = tasks.findIndex(t => t.id === id);
  if (idx === -1) return;
  tasks[idx] = {
    ...tasks[idx],
    title:    data.title.trim(),
    note:     data.note.trim(),
    category: data.category,
    priority: data.priority,
    dueDate:  data.dueDate || null,
  };
  save();
  render();
  showToast('Task updated!', 'success');
};

const deleteTask = (id) => {
  tasks = tasks.filter(t => t.id !== id);
  save();
  render();
  showToast('Task deleted.', 'error');
};

const toggleTask = (id) => {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  save();
  render();
  showToast(
    task.completed ? 'Task completed! 🎉' : 'Task marked active.',
    task.completed ? 'success' : 'info'
  );
};

/* ── MODAL: ADD ────────────────────────────────────────────── */
const openAddModal = () => {
  modalTitle.textContent = 'Add New Task';
  submitBtn.textContent  = 'Add Task';
  editTaskId.value       = '';
  taskForm.reset();
  titleError.textContent = '';
  taskTitle.classList.remove('invalid');
  taskModal.showModal();
  requestAnimationFrame(() => taskTitle.focus());
};

/* ── MODAL: EDIT ───────────────────────────────────────────── */
const openEditModal = (id) => {
  const task = tasks.find(t => t.id === id);
  if (!task) return;

  modalTitle.textContent = 'Edit Task';
  submitBtn.textContent  = 'Save Changes';
  editTaskId.value       = id;
  titleError.textContent = '';
  taskTitle.classList.remove('invalid');

  taskTitle.value    = task.title;
  taskNote.value     = task.note || '';
  taskCategory.value = task.category;
  taskPriority.value = task.priority;
  taskDue.value      = task.dueDate
    ? new Date(task.dueDate).toISOString().slice(0, 16)
    : '';

  taskModal.showModal();
  requestAnimationFrame(() => taskTitle.focus());
};

/* ── MODAL: DELETE ─────────────────────────────────────────── */
const openDeleteModal = (id) => {
  pendingDeleteId = id;
  deleteModal.showModal();
};

/* ── FORM SUBMIT ───────────────────────────────────────────── */
taskForm.addEventListener('submit', (e) => {
  e.preventDefault();

  const title = taskTitle.value.trim();
  if (!title) {
    titleError.textContent = 'Task title is required.';
    taskTitle.classList.add('invalid');
    taskTitle.focus();
    return;
  }

  titleError.textContent = '';
  taskTitle.classList.remove('invalid');

  const data = {
    title,
    note:     taskNote.value,
    category: taskCategory.value,
    priority: taskPriority.value,
    dueDate:  taskDue.value ? new Date(taskDue.value).toISOString() : null,
  };

  if (editTaskId.value) {
    editTask(editTaskId.value, data);
  } else {
    addTask(data);
  }

  taskModal.close();
});

/* ── DIALOG CLOSE BUTTONS ──────────────────────────────────── */
modalCloseBtn.addEventListener('click', () => taskModal.close());
cancelBtn.addEventListener('click',     () => taskModal.close());

confirmDeleteBtn.addEventListener('click', () => {
  if (pendingDeleteId) {
    deleteTask(pendingDeleteId);
    pendingDeleteId = null;
  }
  deleteModal.close();
});

cancelDeleteBtn.addEventListener('click', () => {
  pendingDeleteId = null;
  deleteModal.close();
});

/* Close modals on backdrop click */
[taskModal, deleteModal].forEach(dialog => {
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
});

/* ── FAB ───────────────────────────────────────────────────── */
fabBtn.addEventListener('click', openAddModal);

/* ── CLEAR COMPLETED ───────────────────────────────────────── */
clearCompleted.addEventListener('click', () => {
  const count = tasks.filter(t => t.completed).length;
  if (count === 0) {
    showToast('No completed tasks to clear.', 'info');
    return;
  }
  tasks = tasks.filter(t => !t.completed);
  save();
  render();
  showToast(`Cleared ${count} completed task${count > 1 ? 's' : ''}.`, 'success');
});

/* ── FILTER TABS ───────────────────────────────────────────── */
document.querySelectorAll('.filter-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    activeFilter = btn.dataset.filter;
    document.querySelectorAll('.filter-tab').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    render();
  });
});

/* ── CATEGORY — SIDEBAR BUTTONS ────────────────────────────── */
document.querySelectorAll('.category-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeCategory = btn.dataset.category;
    document.querySelectorAll('.category-btn').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    // Sync mobile chips
    document.querySelectorAll('.chip').forEach(c => {
      c.classList.toggle('active', c.dataset.category === activeCategory);
    });
    render();
  });
});

/* ── CATEGORY — MOBILE CHIPS ───────────────────────────────── */
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    activeCategory = chip.dataset.category;
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    // Sync sidebar
    document.querySelectorAll('.category-btn').forEach(b => {
      const isActive = b.dataset.category === activeCategory;
      b.classList.toggle('active', isActive);
      b.setAttribute('aria-pressed', String(isActive));
    });
    render();
  });
});

/* ── SEARCH ────────────────────────────────────────────────── */
let searchTimer;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchQuery = searchInput.value;
    render();
  }, 250);
});

/* ── SORT ──────────────────────────────────────────────────── */
sortSelect.addEventListener('change', () => {
  activeSort = sortSelect.value;
  render();
});

/* ── KEYBOARD SHORTCUTS ────────────────────────────────────── */
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + K → focus search
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    searchInput.focus();
  }
  // N → open add modal (when not in input)
  if (e.key === 'n' && !['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) {
    e.preventDefault();
    openAddModal();
  }
  // Escape closes modals (native dialog handles this)
});

/* ── VALIDATE TITLE LIVE ───────────────────────────────────── */
taskTitle.addEventListener('input', () => {
  if (taskTitle.value.trim()) {
    titleError.textContent = '';
    taskTitle.classList.remove('invalid');
  }
});

/* ── INIT ──────────────────────────────────────────────────── */
const init = () => {
  load();

  // Seed demo data if first visit
  if (tasks.length === 0) {
    const now = new Date();
    const future = (h) => new Date(now.getTime() + h * 3600000).toISOString();
    const past   = (h) => new Date(now.getTime() - h * 3600000).toISOString();

    tasks = [
      {
        id: genId(), title: 'Complete the internship project',
        note: 'Build TaskFlow To-Do app for SkillCraft Technology',
        category: 'work', priority: 'high',
        dueDate: future(48), completed: false, createdAt: Date.now() - 5000,
      },
      {
        id: genId(), title: 'Push project to GitHub',
        note: 'Add README, screenshots, and live demo link',
        category: 'work', priority: 'medium',
        dueDate: future(72), completed: false, createdAt: Date.now() - 4000,
      },
      {
        id: genId(), title: 'Morning workout',
        note: '30 min cardio + stretching',
        category: 'health', priority: 'medium',
        dueDate: future(12), completed: true, createdAt: Date.now() - 3000,
      },
      {
        id: genId(), title: 'Buy groceries',
        note: 'Milk, eggs, bread, fruits',
        category: 'shopping', priority: 'low',
        dueDate: past(2), completed: false, createdAt: Date.now() - 2000,
      },
      {
        id: genId(), title: 'Learn CSS animations',
        note: '@starting-style and View Transitions API',
        category: 'personal', priority: 'low',
        dueDate: future(120), completed: false, createdAt: Date.now() - 1000,
      },
    ];
    save();
  }

  render();
};

init();

