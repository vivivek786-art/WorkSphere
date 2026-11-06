const API_BASE_URL = "/common/api/v1";
const PROJECT_STORAGE_KEY = "tracking-selected-project";
const WORKSPACE_STORAGE_KEY = "tracking-selected-workspace";
const STARRED_PROJECTS_KEY = "tracking-starred-projects";
const RECENT_ISSUES_KEY = "tracking-recent-issues";
const TOUR_COMPLETED_KEY = "worksphere-tour-completed";

const form = document.querySelector("#issue-form");
const dialog = document.querySelector("#issue-dialog");
const issueIdInput = document.querySelector("#issue-id");
const summaryInput = document.querySelector("#issue-summary");
const descriptionInput = document.querySelector("#issue-description");
const typeInput = document.querySelector("#issue-type");
const statusInput = document.querySelector("#issue-status");
const priorityInput = document.querySelector("#issue-priority");
const assigneeInput = document.querySelector("#issue-assignee");
const startDateInput = document.querySelector("#issue-start-date");
const dueDateInput = document.querySelector("#issue-due-date");
const deleteButton = document.querySelector("#delete-issue");
const searchInput = document.querySelector("#search-input");
const typeFilter = document.querySelector("#type-filter");
const priorityFilter = document.querySelector("#priority-filter");
const board = document.querySelector("#board");
const projectDialog = document.querySelector("#project-dialog");
const memberDialog = document.querySelector("#member-dialog");
const boardSettingsDialog = document.querySelector("#board-settings-dialog");
const shareProjectDialog = document.querySelector("#share-project-dialog");
const BOARD_SETTINGS_KEY = "tracking-board-settings";
const DEFAULT_BOARD_SETTINGS = { showDescriptions: true, showDueDates: true, compactCards: false };

let metadata = { types: [], statuses: [], priorities: [] };
let projects = [];
let workspaces = [];
let adminWorkspaces = [];
let members = [];
let authenticatedUser = null;
let issues = [];
let issueSaveInProgress = false;
let selectedProjectId = null;
let selectedWorkspaceId = null;
let draggedIssueId = null;
let selectedView = "board";
let timelineMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let issueSort = "key";
let boardSettings = loadBoardSettings();
let celebrationTimeout;
let toastTimeout;
let globalPage = null;
let globalPageRequest = 0;
let tourStepIndex = 0;

const productTourSteps = [
  {
    selector: ".primary-nav",
    title: "Your workspace",
    description: "Use Home, Your work, Recent, and Starred to move around your workspace."
  },
  {
    selector: ".sidebar-section",
    title: "Your projects",
    description: "Open projects here, add new ones, or star favorites for quick access."
  },
  {
    selector: ".tabs",
    title: "Choose a project view",
    description: "Switch between Board, List, Backlog, and Timeline while keeping your project data."
  },
  {
    selector: ".board-toolbar",
    title: "Find and organize issues",
    description: "Filter by type or priority, adjust board display settings, refresh, sort, or export issues."
  },
  {
    selector: "#board",
    title: "Track work on the board",
    description: "Drag an issue between columns to change its status. Open an issue card to edit its details."
  },
  {
    selector: "#create-issue",
    title: "Create an issue",
    description: "Add work with a summary, priority, assignee, start date, and due date."
  },
  {
    selector: "#share-project",
    title: "Share your project",
    description: "Copy a direct project link for teammates who can access this app and its API."
  }
];

function loadBoardSettings() {
  try {
    const saved = localStorage.getItem(BOARD_SETTINGS_KEY);
    if (!saved) return { ...DEFAULT_BOARD_SETTINGS };
    const parsed = JSON.parse(saved);
    return {
      showDescriptions: parsed.showDescriptions !== false,
      showDueDates: parsed.showDueDates !== false,
      compactCards: parsed.compactCards === true
    };
  } catch (error) {
    console.error("Could not load board settings:", error);
    return { ...DEFAULT_BOARD_SETTINGS };
  }
}

async function api(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = { ...options.headers };
  if (selectedWorkspaceId) headers["X-Workspace-Id"] = String(selectedWorkspaceId);
  if (options.body) headers["Content-Type"] = "application/json";
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const csrfResponse = await fetch(`${API_BASE_URL}/auth/csrf`, { credentials: "same-origin" });
    if (!csrfResponse.ok) throw new Error(`Could not get a security token (${csrfResponse.status}).`);
    const csrf = await csrfResponse.json();
    headers["X-XSRF-TOKEN"] = csrf.token;
  }
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "same-origin",
    headers
  });
  if (!response.ok) {
    const message = await response.text();
    const error = new Error(message || `Request failed (${response.status})`);
    error.status = response.status;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function showMessage(message, isError = false) {
  const element = document.querySelector("#board-message");
  element.textContent = message;
  element.classList.toggle("error", isError);
  element.hidden = !message;
}

function showToast(message) {
  const toast = document.querySelector("#toast-notice");
  document.querySelector("#toast-notice-text").textContent = message;
  toast.hidden = false;
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => {
    toast.hidden = true;
  }, 3500);
}

function updateProductTourStep() {
  const tour = document.querySelector("#product-tour");
  const step = productTourSteps[tourStepIndex];
  if (!step) return;

  const target = document.querySelector(step.selector);
  const spotlight = tour.querySelector(".tour-spotlight");
  const card = tour.querySelector(".tour-card");
  const rect = target?.getBoundingClientRect();
  const targetVisible = rect && rect.width && rect.height
    && rect.bottom > 0 && rect.top < window.innerHeight
    && rect.right > 0 && rect.left < window.innerWidth;

  document.querySelector("#tour-step-label").textContent = step.title;
  document.querySelector("#tour-title").textContent = step.title;
  document.querySelector("#tour-description").textContent = step.description;
  document.querySelector("#tour-progress").textContent = `${tourStepIndex + 1} of ${productTourSteps.length}`;
  document.querySelector("#tour-back").disabled = tourStepIndex === 0;
  document.querySelector("#tour-next").textContent = tourStepIndex === productTourSteps.length - 1 ? "Finish" : "Next";

  if (targetVisible) {
    const padding = 7;
    spotlight.hidden = false;
    spotlight.style.left = `${Math.max(4, rect.left - padding)}px`;
    spotlight.style.top = `${Math.max(4, rect.top - padding)}px`;
    spotlight.style.width = `${Math.min(window.innerWidth - 8, rect.width + padding * 2)}px`;
    spotlight.style.height = `${Math.min(window.innerHeight - 8, rect.height + padding * 2)}px`;
    const cardWidth = Math.min(360, window.innerWidth - 32);
    const cardLeft = Math.min(window.innerWidth - cardWidth - 16, Math.max(16, rect.left + rect.width / 2 - cardWidth / 2));
    const placeBelow = window.innerHeight - rect.bottom > 275 || rect.top < 275;
    card.style.left = `${cardLeft}px`;
    card.style.top = placeBelow
      ? `${Math.min(window.innerHeight - 220, Math.max(16, rect.bottom + 18))}px`
      : `${Math.max(16, rect.top - 230)}px`;
  } else {
    spotlight.hidden = true;
    card.style.left = `${Math.max(16, (window.innerWidth - 360) / 2)}px`;
    card.style.top = `${Math.max(16, (window.innerHeight - 210) / 2)}px`;
  }
}

function closeProductTour(completed = true) {
  const tour = document.querySelector("#product-tour");
  tour.hidden = true;
  tour.setAttribute("aria-hidden", "true");
  document.body.classList.remove("tour-active");
  if (completed) {
    try {
      localStorage.setItem(TOUR_COMPLETED_KEY, "true");
    } catch (error) {
      console.error("Could not save product tour completion:", error);
    }
  }
}

function startProductTour() {
  if (dialog.open || projectDialog.open || memberDialog.open || boardSettingsDialog.open || shareProjectDialog.open) {
    showMessage("Close the open dialog before starting the product tour.", true);
    return;
  }
  globalPage = null;
  selectedView = "board";
  renderView();
  renderProjects();
  tourStepIndex = 0;
  const tour = document.querySelector("#product-tour");
  tour.hidden = false;
  tour.setAttribute("aria-hidden", "false");
  document.body.classList.add("tour-active");
  updateProductTourStep();
  document.querySelector("#tour-next").focus();
}

function advanceProductTour(direction) {
  const nextIndex = tourStepIndex + direction;
  if (nextIndex < 0) return;
  if (nextIndex >= productTourSteps.length) {
    closeProductTour();
    return;
  }
  tourStepIndex = nextIndex;
  updateProductTourStep();
}

function isDoneStatus(status) {
  return String(status || "").toLowerCase() === "done";
}

function celebrateCompletion(type) {
  document.querySelector(".completion-celebration")?.remove();
  window.clearTimeout(celebrationTimeout);

  const celebration = document.createElement("div");
  celebration.className = "completion-celebration";
  celebration.setAttribute("role", "status");
  celebration.setAttribute("aria-live", "polite");

  const banner = document.createElement("div");
  banner.className = "completion-banner";
  banner.textContent = `🎉 ${type} complete! Great work!`;
  celebration.appendChild(banner);

  const colors = ["#6654d9", "#f0a33a", "#35a889", "#e36c83", "#5193cf"];
  for (let index = 0; index < 36; index += 1) {
    const piece = document.createElement("span");
    piece.className = "completion-confetti";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.setProperty("--drift", `${Math.round(Math.random() * 240 - 120)}px`);
    piece.style.setProperty("--rotation", `${Math.round(Math.random() * 900 - 450)}deg`);
    piece.style.setProperty("--delay", `${Math.random() * 0.45}s`);
    piece.style.backgroundColor = colors[index % colors.length];
    celebration.appendChild(piece);
  }

  document.body.appendChild(celebration);
  celebrationTimeout = window.setTimeout(() => celebration.remove(), 2600);
}

function memberColor(memberId) {
  const id = Number(memberId) || 0;
  return `member-color-${id % 6}`;
}

function renderMember(member) {
  return `<span class="avatar ${memberColor(member.id)}" title="${escapeHtml(member.name)}">${escapeHtml(member.initials)}</span>`;
}

function renderMembers() {
  const stack = document.querySelector("#member-stack");
  stack.innerHTML = members.slice(0, 5).map(renderMember).join("");
  if (members.length > 5) {
    stack.insertAdjacentHTML("beforeend", `<span class="avatar avatar-more" title="${members.length - 5} more members">+${members.length - 5}</span>`);
  }

  const currentMember = members[0];
  const currentName = authenticatedUser ? authenticatedUser.name : currentMember ? currentMember.name : "No members";
  const currentInitials = authenticatedUser
    ? currentName.split(/\s+/).slice(0, 2).map((part) => part[0] || "").join("").toUpperCase()
    : currentMember ? currentMember.initials : "?";
  const profileAvatar = document.querySelector("#profile-avatar");
  const topAvatar = document.querySelector("#top-avatar");
  profileAvatar.textContent = currentInitials;
  profileAvatar.className = authenticatedUser ? "avatar avatar-me"
    : currentMember ? `avatar ${memberColor(currentMember.id)}` : "avatar avatar-me";
  if (authenticatedUser && !currentMember) profileAvatar.className = "avatar avatar-me";
  profileAvatar.title = currentName;
  document.querySelector("#profile-menu-name").textContent = currentName;
  const signedIn = authenticatedUser?.authenticated === "true";
  document.querySelector("#profile-menu-email").textContent = signedIn
    ? authenticatedUser.email
    : "Sign-in required";
  document.querySelector("#profile-mode").textContent = signedIn
    ? authenticatedUser.role === "SUPERADMIN" ? "Superadmin" : authenticatedUser.role === "ADMIN" ? "Admin" : "Workspace user"
    : "Signed out";
  document.querySelector('[data-profile-action="sign-out"]').hidden = !signedIn;
  const canManageUsers = signedIn && ["ADMIN", "SUPERADMIN"].includes(authenticatedUser.role);
  document.querySelector("#admin-nav").hidden = !canManageUsers;
  document.querySelector('[data-profile-action="admin"]').hidden = !canManageUsers;
  document.querySelector("#profile-name").textContent = currentName;
  topAvatar.textContent = currentInitials;
  topAvatar.className = authenticatedUser ? "avatar avatar-me top-avatar"
    : currentMember ? `avatar top-avatar ${memberColor(currentMember.id)}` : "avatar avatar-me top-avatar";
  topAvatar.setAttribute("aria-label", currentName);
  setProfileAvatarImage(profileAvatar, authenticatedUser?.picture, currentInitials);
  setProfileAvatarImage(topAvatar, authenticatedUser?.picture, currentInitials);
  document.querySelector('[data-profile-action="profile-photo"]').hidden =
    !signedIn || !["ADMIN", "SUPERADMIN"].includes(authenticatedUser.role);

  const assigneeOptions = ['<option value="">Unassigned</option>']
    .concat(members.map((member) => `<option value="${member.id}">${escapeHtml(member.name)}</option>`));
  assigneeInput.innerHTML = assigneeOptions.join("");
}

function setProfileAvatarImage(avatar, picture, initials) {
  if (!picture) return;
  const image = document.createElement("img");
  image.src = picture;
  image.alt = "";
  image.onerror = () => {
    image.remove();
    avatar.textContent = initials;
  };
  avatar.replaceChildren(image);
}

function renderProjects() {
  const starredIds = loadStoredIdList(STARRED_PROJECTS_KEY);
  document.querySelector("#project-list").innerHTML = projects.map((project) => {
    const selected = Number(project.id) === Number(selectedProjectId);
    const starred = starredIds.includes(Number(project.id));
    return `<div class="project-entry">
      <button type="button" class="project-link${selected ? " selected" : ""}" data-project-id="${project.id}">
        <span class="project-glyph project-purple">${escapeHtml(project.key.slice(0, 1))}</span>
        <span>${escapeHtml(project.name)}</span>
      </button>
      <button type="button" class="project-star${starred ? " starred" : ""}" data-star-project="${project.id}" aria-label="${starred ? "Remove" : "Add"} ${escapeHtml(project.name)} ${starred ? "from" : "to"} Starred" title="${starred ? "Remove from" : "Add to"} Starred">${starred ? "★" : "☆"}</button>
    </div>`;
  }).join("");

  const project = projects.find((item) => Number(item.id) === Number(selectedProjectId));
  document.querySelector("#project-name").textContent = project ? project.name : "No project selected";
  document.querySelector("#breadcrumb-name").textContent = project ? project.name : "No project selected";
  document.querySelector("#project-glyph").textContent = project ? project.key.slice(0, 1) : "—";
  document.querySelector("#breadcrumb-glyph").textContent = project ? project.key.slice(0, 1) : "—";
  document.querySelector("#create-issue").disabled = !project;
  const projectStarButton = document.querySelector("#toggle-project-star");
  const projectIsStarred = project && starredIds.includes(Number(project.id));
  projectStarButton.disabled = !project;
  projectStarButton.setAttribute("aria-pressed", String(Boolean(projectIsStarred)));
  projectStarButton.textContent = projectIsStarred ? "★ Starred" : "☆ Star project";
  document.querySelectorAll("[data-page]").forEach((link) => {
    const active = link.dataset.page === globalPage;
    link.classList.toggle("selected", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.querySelector(".page-content").classList.toggle("global-page", Boolean(globalPage));
  document.querySelector("#board").setAttribute(
    "aria-label",
    project ? `${project.name} kanban board` : "Project kanban board"
  );
}

function renderWorkspaceMenu() {
  const activeWorkspace = workspaces.find((workspace) => Number(workspace.id) === Number(selectedWorkspaceId));
  document.querySelector("#active-workspace-name").textContent = activeWorkspace ? activeWorkspace.name : "No workspace";
  document.querySelector("#active-workspace-count").textContent =
    `${workspaces.length} ${workspaces.length === 1 ? "workspace" : "workspaces"}`;
  const isAdmin = authenticatedUser && ["ADMIN", "SUPERADMIN"].includes(authenticatedUser.role);
  const menu = document.querySelector("#workspace-menu");
  menu.innerHTML = `${workspaces.map((workspace) => {
    const active = Number(workspace.id) === Number(selectedWorkspaceId);
    return `<button type="button" class="workspace-option" data-workspace-id="${workspace.id}" aria-current="${active}">
      <span>${escapeHtml(workspace.name)}</span>${active ? "<small>Current</small>" : ""}
    </button>`;
  }).join("")}${isAdmin ? '<button type="button" class="workspace-menu-action" data-manage-workspaces>Manage workspaces</button>' : ""}`;
}

function loadStoredIdList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.map(Number).filter(Number.isFinite) : [];
  } catch (error) {
    console.error(`Could not read ${key}:`, error);
    return [];
  }
}

function saveStoredValue(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Could not save ${key}:`, error);
    showMessage("Could not save this preference in the browser.", true);
    return false;
  }
}

function loadRecentIssues() {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_ISSUES_KEY) || "[]");
    return Array.isArray(value) ? value : [];
  } catch (error) {
    console.error("Could not read recent issues:", error);
    return [];
  }
}

function rememberRecentIssue(issue) {
  const project = projects.find((item) => Number(item.id) === Number(selectedProjectId));
  if (!project) return;
  const recent = loadRecentIssues().filter((item) =>
    Number(item.projectId) !== Number(project.id) || Number(item.id) !== Number(issue.id)
  );
  recent.unshift({ ...issue, projectId: project.id, projectName: project.name, projectKey: project.key });
  saveStoredValue(RECENT_ISSUES_KEY, recent.slice(0, 20));
}

function toggleStarredProject(id) {
  const projectId = Number(id);
  const starred = loadStoredIdList(STARRED_PROJECTS_KEY);
  const updated = starred.includes(projectId)
    ? starred.filter((item) => item !== projectId)
    : [...starred, projectId];
  if (saveStoredValue(STARRED_PROJECTS_KEY, updated)) {
    renderProjects();
    if (globalPage === "starred") renderGlobalPage();
  }
}

function populateSelect(select, values, placeholder) {
  const previous = select.value;
  select.innerHTML = values.map((value) =>
    `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`
  ).join("");
  if (values.includes(previous)) select.value = previous;
  else if (values.length) select.value = values[0];
  if (placeholder && values.length === 0) {
    select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>`;
  }
}

function renderMetadata() {
  populateSelect(typeInput, metadata.types, "No issue types available");
  populateSelect(statusInput, metadata.statuses, "No statuses available");
  populateSelect(priorityInput, metadata.priorities, "No priorities available");
  typeFilter.innerHTML = '<option value="all">All issue types</option>'
    + metadata.types.map((type) => {
      const label = type === "Story" ? "Stories" : `${type}s`;
      return `<option value="${escapeHtml(type)}">${escapeHtml(label)}</option>`;
    }).join("");
  priorityFilter.innerHTML = '<option value="all">All priorities</option>'
    + metadata.priorities.map((priority) => `<option value="${escapeHtml(priority)}">${escapeHtml(priority)}</option>`).join("");
}

function iconForType(type) {
  const icons = { story: "◇", bug: "⌁", task: "✓" };
  return icons[slug(type)] || "•";
}

function iconForPriority(priority) {
  const icons = { highest: "⬆", high: "↑", medium: "↔", low: "↓" };
  return icons[slug(priority)] || "•";
}

function getDueDateState(issue) {
  if (!issue.dueDate) return null;
  const [year, month, day] = issue.dueDate.slice(0, 10).split("-").map(Number);
  const dueDay = Date.UTC(year, month - 1, day) / 86400000;
  const now = new Date();
  const todayDay = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
  const daysUntil = dueDay - todayDay;
  const isDone = issue.status.toLowerCase() === "done";
  const formattedDueDate = formatDateTime(issue.dueDate);
  const isPastDue = issue.dueDate < getCurrentDateTimeString();

  if (isDone) return { className: "due-date-complete", label: formattedDueDate, title: `Due ${formattedDueDate}` };
  if (isPastDue) {
    const daysOverdue = Math.abs(daysUntil);
    return {
      className: "due-date-overdue",
      label: `Overdue${daysOverdue > 1 ? ` · ${daysOverdue}d` : ""} · ${formattedDueDate}`,
      title: `Due ${formattedDueDate} · ${daysOverdue ? `${daysOverdue} ${daysOverdue === 1 ? "day" : "days"} ` : ""}overdue`
    };
  }
  if (daysUntil === 0) return { className: "due-date-today", label: `Due today · ${formatTime(issue.dueDate)}`, title: `Due ${formattedDueDate}` };
  if (daysUntil <= 3) {
    return {
      className: "due-date-soon",
      label: `Due in ${daysUntil}d · ${formattedDueDate}`,
      title: `Due ${formattedDueDate}`
    };
  }
  return { className: "due-date-upcoming", label: formattedDueDate, title: `Due ${formattedDueDate}` };
}

function renderDueDate(issue, compact = false) {
  const dueDate = getDueDateState(issue);
  if (!dueDate) return "—";
  return `<span class="due-date ${dueDate.className}${compact ? " due-date-compact" : ""}" title="${escapeHtml(dueDate.title)}">
    <span class="due-date-icon" aria-hidden="true">◷</span>${escapeHtml(dueDate.label)}
  </span>`;
}

function setStartDateMinimum() {
  startDateInput.min = `${getTodayDateString()}T00:00`;
}

function getTodayDateString() {
  const today = new Date();
  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")
  ].join("-");
}

function getCurrentDateTimeString() {
  const now = new Date();
  return `${getTodayDateString()}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function renderIssue(issue) {
  const member = members.find((item) => Number(item.id) === Number(issue.assigneeId));
  const assignee = member
    ? `<span class="card-assignee ${memberColor(member.id)}" title="${escapeHtml(member.name)}">${escapeHtml(member.initials)}</span>`
    : '<span class="card-assignee assignee-empty" title="Unassigned">·</span>';
  const description = boardSettings.showDescriptions && issue.description
    ? `<div class="card-description">${renderIssueDescription(issue.description)}</div>`
    : "";
  const dueDate = boardSettings.showDueDates && issue.dueDate
    ? `<div class="card-due-date">${renderDueDate(issue, true)}</div>`
    : "";
  const priorityClass = `priority-${slug(issue.priority)}`;
  const urgentCardClass = slug(issue.priority) === "highest" ? " issue-card-urgent" : "";
  return `<article class="issue-card${urgentCardClass}" draggable="true" data-issue-id="${issue.id}" tabindex="0" role="button" aria-label="${escapeHtml(issue.key)}: ${escapeHtml(issue.summary)} · ${escapeHtml(issue.priority)} priority">
    <p class="card-summary">${escapeHtml(issue.summary)}</p>
    ${description}
    ${dueDate}
    <div class="card-meta">
      <div class="card-meta-left">
        <span class="issue-key">${escapeHtml(issue.key)}</span>
        <span class="issue-type type-${slug(issue.type)}" title="${escapeHtml(issue.type)}">${iconForType(issue.type)}</span>
        <span class="priority ${priorityClass}" title="${escapeHtml(issue.priority)} priority">${iconForPriority(issue.priority)}</span>
      </div>
      ${assignee}
    </div>
  </article>`;
}

function renderIssueDescription(description) {
  const lines = description.split(/\r\n?|\n/).filter((line) => line.trim());
  const numberedLines = lines.map((line) => line.trim().match(/^(\d+)[.)]\s*(.*)$/));
  if (lines.length && numberedLines.every(Boolean)) {
    return `<ol class="card-description-list">${numberedLines.map((match) =>
      `<li value="${Number(match[1])}">${escapeHtml(match[2])}</li>`
    ).join("")}</ol>`;
  }
  return description.split(/\r\n?|\n/).map(escapeHtml).join("<br>");
}

function getFilteredIssues(source = issues) {
  const query = searchInput.value.trim().toLowerCase();
  const selectedType = typeFilter.value;
  const selectedPriority = priorityFilter.value;
  const filtered = source.filter((issue) => {
    const searchable = `${issue.key} ${issue.summary} ${issue.description || ""}`.toLowerCase();
    return (selectedType === "all" || issue.type === selectedType)
      && (selectedPriority === "all" || issue.priority === selectedPriority)
      && (!query || searchable.includes(query));
  });
  return filtered.sort((left, right) => compareIssues(left, right, issueSort));
}

function compareIssues(left, right, sortBy) {
  if (sortBy === "priority") {
    const leftRank = metadata.priorities.indexOf(left.priority);
    const rightRank = metadata.priorities.indexOf(right.priority);
    return (leftRank < 0 ? Number.MAX_SAFE_INTEGER : leftRank)
      - (rightRank < 0 ? Number.MAX_SAFE_INTEGER : rightRank)
      || left.key.localeCompare(right.key, undefined, { numeric: true });
  }
  if (sortBy === "dueDate") {
    const leftDate = left.dueDate || "9999-12-31";
    const rightDate = right.dueDate || "9999-12-31";
    return leftDate.localeCompare(rightDate)
      || left.key.localeCompare(right.key, undefined, { numeric: true });
  }
  return left.key.localeCompare(right.key, undefined, { numeric: true });
}

function renderBoardView() {
  const existingStatuses = new Set(metadata.statuses);
  board.className = `board${boardSettings.compactCards ? " compact-cards" : ""}`;
  board.innerHTML = metadata.statuses.map((status, index) => {
    const visibleIssues = getFilteredIssues().filter((issue) => issue.status === status);
    const count = issues.filter((issue) => issue.status === status).length;
    const columnClass = /in[\s-]*progress/i.test(status) ? "board-column in-progress-column" : "board-column";
    return `<div class="${columnClass}" data-status="${escapeHtml(status)}">
      <div class="column-heading">
        <div><span class="status-dot status-dot-${index % 3}"></span><h2>${escapeHtml(status)}</h2><span class="task-count">${count}</span></div>
        <button class="icon-button subtle add-column-issue" type="button" data-status="${escapeHtml(status)}" aria-label="Add issue to ${escapeHtml(status)}">＋</button>
      </div>
      <div class="card-list" data-dropzone="${escapeHtml(status)}">${visibleIssues.map(renderIssue).join("")}</div>
      <button class="add-card-button" type="button" data-status="${escapeHtml(status)}">＋ <span>Create issue</span></button>
    </div>`;
  }).join("");
  if (!existingStatuses.size) {
    board.innerHTML = '<p class="empty-state">No issue statuses are configured by the API.</p>';
  } else if (!issues.length) {
    board.insertAdjacentHTML("beforeend", '<p class="empty-state board-empty">This project has no issues yet. Create one to get started.</p>');
  }
}

function assigneeName(issue) {
  const member = members.find((item) => Number(item.id) === Number(issue.assigneeId));
  return member ? member.name : "Unassigned";
}

function renderIssueTable(rows, options = {}) {
  if (!rows.length) {
    return `<p class="empty-state table-empty">${escapeHtml(options.emptyMessage || "No issues match the current filters.")}</p>`;
  }
  const includeStatus = options.includeStatus !== false;
  return `<div class="issue-table-wrap"><table class="issue-table">
    <thead><tr>
      ${options.showProject ? "<th>Project</th>" : ""}<th>Key</th><th>Summary</th><th>Type</th>${includeStatus ? "<th>Status</th>" : ""}
      <th>Priority</th><th>Assignee</th><th>Due date</th>
    </tr></thead>
    <tbody>${rows.map((issue) => `<tr data-project-id="${issue.projectId || selectedProjectId}">
      ${options.showProject ? `<td>${escapeHtml(issue.projectName || "")}</td>` : ""}
      <td class="table-key">${escapeHtml(issue.key)}</td>
      <td><button class="table-issue-link" type="button" data-edit-issue="${issue.id}" data-project-id="${issue.projectId || selectedProjectId}">${escapeHtml(issue.summary)}</button></td>
      <td><span class="issue-type type-${slug(issue.type)}">${iconForType(issue.type)}</span> ${escapeHtml(issue.type)}</td>
      ${includeStatus ? `<td><span class="status-pill">${escapeHtml(issue.status)}</span></td>` : ""}
      <td><span class="priority-badge priority-${slug(issue.priority)}"><span class="priority">${iconForPriority(issue.priority)}</span> ${escapeHtml(issue.priority)}</span></td>
      <td>${escapeHtml(assigneeName(issue))}</td>
      <td>${renderDueDate(issue)}</td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

function renderListView() {
  board.className = "view-panel list-view";
  const rows = getFilteredIssues();
  board.innerHTML = `<div class="view-panel-heading"><div><h2>All issues</h2><p>${rows.length} of ${issues.length} issues</p></div></div>
    ${renderIssueTable(rows, { emptyMessage: "No issues match the current filters." })}`;
}

async function loadIssuesAcrossProjects() {
  const projectIssues = await Promise.all(projects.map(async (project) => {
    const items = await api(`/projects/${project.id}/issues`);
    return items.map((issue) => ({
      ...issue,
      projectId: project.id,
      projectName: project.name,
      projectKey: project.key
    }));
  }));
  return projectIssues.flat();
}

function renderHomePage(allIssues) {
  const inProgressCount = allIssues.filter((issue) => issue.status.toLowerCase() === "in progress").length;
  const overdueCount = allIssues.filter((issue) =>
    issue.dueDate && issue.dueDate < getCurrentDateTimeString() && !isDoneStatus(issue.status)
  ).length;
  board.className = "view-panel home-dashboard";
  board.innerHTML = `<div class="global-page-heading"><p class="eyebrow">WORKSPACE</p><h1>Home</h1><p>Your project activity at a glance.</p></div>
    <div class="dashboard-stats">
      <article><span>Projects</span><strong>${projects.length}</strong></article>
      <article><span>All issues</span><strong>${allIssues.length}</strong></article>
      <article><span>In progress</span><strong>${inProgressCount}</strong></article>
      <article><span>Overdue</span><strong>${overdueCount}</strong></article>
    </div>
    <div class="global-section-heading"><div><h2>Your projects</h2><p>Open a project to continue working.</p></div>
      <button class="button button-primary" type="button" id="home-create-project">＋ Add project</button>
    </div>
    <div class="global-project-grid">${projects.map((project) => {
      const count = allIssues.filter((issue) => Number(issue.projectId) === Number(project.id)).length;
      return `<button type="button" class="global-project-card" data-open-project="${project.id}">
        <span class="project-glyph project-purple">${escapeHtml(project.key.slice(0, 1))}</span>
        <span><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(project.key)} · ${count} ${count === 1 ? "issue" : "issues"}</small></span>
        <span class="global-project-arrow">›</span>
      </button>`;
    }).join("") || '<p class="empty-state">No projects yet. Create a project to get started.</p>'}</div>
    <div class="global-section-heading"><div><h2>Recent issues</h2><p>Issues you opened recently.</p></div>
      <button class="text-button" type="button" data-page-link="recent">View recent</button>
    </div>
    ${renderIssueTable(loadRecentIssues().slice(0, 5), { showProject: true, emptyMessage: "Open an issue and it will appear here." })}`;
}

function renderYourWorkPage(allIssues) {
  const currentMember = members[0];
  const assignedIssues = currentMember
    ? allIssues.filter((issue) => Number(issue.assigneeId) === Number(currentMember.id))
    : [];
  board.className = "view-panel global-list-view";
  board.innerHTML = `<div class="global-page-heading"><p class="eyebrow">WORKSPACE</p><h1>Your work</h1>
    <p>${currentMember ? `Issues assigned to ${escapeHtml(currentMember.name)} across all projects.` : "Add a workspace member to see assigned issues."}</p></div>
    ${renderIssueTable(assignedIssues, { showProject: true, emptyMessage: currentMember ? "No issues are assigned to you yet." : "No workspace member is available." })}`;
}

function renderRecentPage() {
  const recent = loadRecentIssues();
  board.className = "view-panel global-list-view";
  board.innerHTML = `<div class="global-page-heading"><p class="eyebrow">WORKSPACE</p><h1>Recent</h1><p>Issues you opened most recently.</p></div>
    ${renderIssueTable(recent, { showProject: true, emptyMessage: "Open an issue and it will appear here." })}`;
}

function renderStarredPage() {
  const starredIds = loadStoredIdList(STARRED_PROJECTS_KEY);
  const starredProjects = projects.filter((project) => starredIds.includes(Number(project.id)));
  board.className = "view-panel global-list-view";
  board.innerHTML = `<div class="global-page-heading"><p class="eyebrow">WORKSPACE</p><h1>Starred</h1><p>Your favorite projects, saved in this browser.</p></div>
    <div class="global-project-grid">${starredProjects.map((project) => `<div class="global-project-card-wrap">
      <button type="button" class="global-project-card" data-open-project="${project.id}">
        <span class="project-glyph project-purple">${escapeHtml(project.key.slice(0, 1))}</span>
        <span><strong>${escapeHtml(project.name)}</strong><small>${escapeHtml(project.key)}</small></span>
        <span class="global-project-arrow">›</span>
      </button>
      <button type="button" class="global-unstar-button" data-star-project="${project.id}" aria-label="Remove ${escapeHtml(project.name)} from Starred" title="Remove from Starred">★</button>
    </div>`).join("") || '<p class="empty-state">No starred projects yet. Use the ☆ beside a project name to add one.</p>'}</div>`;
}

function renderAccountsPage(accounts) {
  const isSuperadmin = authenticatedUser.role === "SUPERADMIN";
  board.className = "view-panel global-list-view";
  board.innerHTML = `<div class="global-page-heading"><p class="eyebrow">ACCESS CONTROL</p><h1>User management</h1>
    <p>Create, update, disable, and remove WorkSphere accounts. Admins cannot view or modify superadmin accounts.</p></div>
    <div class="global-section-heading account-section-heading"><div><h2>Accounts</h2><p>${accounts.length} ${accounts.length === 1 ? "account" : "accounts"}</p></div>
      <button class="button button-primary" type="button" id="create-account">＋ Create account</button></div>
    <div class="issue-table-wrap account-table-wrap"><table class="issue-table">
      <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Access</th><th>Actions</th></tr></thead>
      <tbody>${accounts.map((account) => {
        const isCurrentAccount = account.username.toLowerCase() === authenticatedUser.email.toLowerCase();
        const canEditAccount = isSuperadmin || account.role === "USER";
        return `<tr>
          <td>${escapeHtml(account.fullName)}</td>
          <td>${escapeHtml(account.username)}</td>
          <td><span class="account-role-badge role-${escapeHtml(account.role.toLowerCase())}">${escapeHtml(account.role)}</span></td>
          <td><span class="account-state${account.enabled ? " enabled" : ""}">${account.enabled ? "Enabled" : "Disabled"}</span></td>
          <td class="account-actions">
            <button type="button" class="button button-secondary" data-edit-account="${account.id}" ${canEditAccount ? "" : 'disabled title="Only a superadmin can modify administrator accounts."'}>Edit</button>
            <button type="button" class="button account-delete-button" data-delete-account="${account.id}" ${isCurrentAccount ? 'disabled title="You cannot remove your current account."' : (!isSuperadmin && account.role !== "USER") ? 'disabled title="You cannot remove this account."' : ""}>Delete</button>
          </td>
        </tr>`;
      }).join("") || '<tr><td colspan="5" class="table-empty">No accounts have been created.</td></tr>'}</tbody>
    </table></div>`;
}

function openAccountDialog(account) {
  const form = document.querySelector("#account-form");
  const passwordInput = document.querySelector("#account-password");
  const isEditing = Boolean(account);
  const isSuperadmin = authenticatedUser.role === "SUPERADMIN";
  const isCurrentAccount = isEditing && account.username.toLowerCase() === authenticatedUser.email.toLowerCase();
  form.reset();
  form.dataset.accountId = isEditing ? String(account.id) : "";
  document.querySelector("#account-dialog-title").textContent = isEditing ? "Edit account" : "Create account";
  document.querySelector("#account-save").textContent = isEditing ? "Save changes" : "Create account";
  document.querySelector("#account-full-name").value = account?.fullName || "";
  document.querySelector("#account-username").value = account?.username || "";
  passwordInput.required = !isEditing;
  passwordInput.value = "";
  passwordInput.placeholder = isEditing ? "Leave blank to keep current password" : "At least 12 characters";
  document.querySelector("#account-password-required").hidden = isEditing;
  document.querySelector("#account-password-hint").hidden = !isEditing;
  document.querySelector("#account-role-field").hidden = !isSuperadmin || isCurrentAccount;
  document.querySelector("#account-role").value = isSuperadmin ? account?.role || "USER" : "USER";
  document.querySelector("#account-enabled").checked = account ? account.enabled : true;
  document.querySelector("#account-enabled").disabled = isCurrentAccount;
  document.querySelector("#account-form-message").textContent = "";
  document.querySelector("#account-dialog").showModal();
  document.querySelector("#account-full-name").focus();
}

function renderWorkspaceManager() {
  const list = document.querySelector("#workspace-manager-list");
  const activeWorkspaceId = Number(selectedWorkspaceId);
  document.querySelector("#workspace-manager-count").textContent =
    `${adminWorkspaces.length} ${adminWorkspaces.length === 1 ? "workspace" : "workspaces"}`;
  list.innerHTML = adminWorkspaces.map((workspace) => {
    const accountCount = workspace.accountIds.length;
    const isCurrent = Number(workspace.id) === activeWorkspaceId;
    return `<article class="workspace-manager-item" role="listitem">
      <span class="workspace-manager-item-mark" aria-hidden="true">${escapeHtml(workspace.name.slice(0, 1).toUpperCase())}</span>
      <span class="workspace-manager-item-copy">
        <strong class="workspace-manager-item-name">${escapeHtml(workspace.name)}</strong>
        <span class="workspace-manager-item-meta">
          <span>${accountCount} ${accountCount === 1 ? "account" : "accounts"}</span>
          ${isCurrent ? '<span class="workspace-current-badge">Current workspace</span>' : ""}
        </span>
      </span>
      <button class="button button-secondary" type="button" data-edit-workspace="${workspace.id}" aria-label="Manage accounts in ${escapeHtml(workspace.name)}">Manage access</button>
    </article>`;
  }).join("") || `<div class="workspace-manager-empty">
    <strong>No workspaces yet</strong>
    <span>Create a workspace to keep projects and members organized.</span>
  </div>`;
}

function updateWorkspaceSelectedCount() {
  const selectedCount = document.querySelectorAll('#workspace-account-options input[name="accountIds"]:checked').length;
  document.querySelector("#workspace-selected-count").textContent =
    `${selectedCount} ${selectedCount === 1 ? "account selected" : "accounts selected"}`;
}

async function openWorkspaceManager() {
  try {
    adminWorkspaces = await api("/admin/workspaces");
    renderWorkspaceManager();
    document.querySelector("#workspace-switcher").open = false;
    document.querySelector("#workspace-manager-dialog").showModal();
  } catch (error) {
    console.error("Could not load workspaces:", error);
    showMessage(`Could not load workspaces: ${error.message}`, true);
  }
}

async function openWorkspaceEditor(workspaceId = null) {
  try {
    const accounts = await api("/admin/accounts");
    const workspace = workspaceId == null
      ? null
      : adminWorkspaces.find((item) => Number(item.id) === Number(workspaceId));
    if (workspaceId != null && !workspace) {
      throw new Error("The selected workspace could not be found.");
    }
    const selectedIds = new Set(workspace ? workspace.accountIds.map(Number) : []);
    const currentAccount = accounts.find((account) =>
      account.username.toLowerCase() === authenticatedUser.email.toLowerCase());
    if (currentAccount) selectedIds.add(Number(currentAccount.id));

    const form = document.querySelector("#workspace-form");
    form.reset();
    form.dataset.workspaceId = workspace ? String(workspace.id) : "";
    document.querySelector("#workspace-dialog-title").textContent = workspace ? "Manage workspace" : "Create workspace";
    document.querySelector("#workspace-name-input").value = workspace ? workspace.name : "";
    document.querySelector("#workspace-save").textContent = workspace ? "Save changes" : "Create workspace";
    document.querySelector("#workspace-form-message").textContent = "";
    document.querySelector("#workspace-account-options").innerHTML = accounts.map((account) => {
      const isCurrentAccount = currentAccount && Number(account.id) === Number(currentAccount.id);
      return `<label class="workspace-account-option">
        <input type="checkbox" name="accountIds" value="${account.id}" ${selectedIds.has(Number(account.id)) ? "checked" : ""} ${isCurrentAccount ? "disabled" : ""} />
        <span>${escapeHtml(account.fullName)} <small>· ${escapeHtml(account.username)}${isCurrentAccount ? " · You" : ""}</small></span>
      </label>`;
    }).join("");
    updateWorkspaceSelectedCount();
    document.querySelector("#workspace-manager-dialog").close();
    document.querySelector("#workspace-dialog").showModal();
    document.querySelector("#workspace-name-input").focus();
  } catch (error) {
    console.error("Could not open workspace editor:", error);
    showMessage(`Could not open workspace settings: ${error.message}`, true);
  }
}

async function reloadWorkspaces(preferredId = selectedWorkspaceId) {
  workspaces = await api("/workspaces");
  if (!workspaces.length) {
    throw new Error("You do not have access to any workspace. Ask an administrator to assign you to one.");
  }
  const preferredExists = workspaces.some((workspace) => Number(workspace.id) === Number(preferredId));
  selectedWorkspaceId = preferredExists ? Number(preferredId) : Number(workspaces[0].id);
  sessionStorage.setItem(WORKSPACE_STORAGE_KEY, String(selectedWorkspaceId));
  renderWorkspaceMenu();
}

async function switchWorkspace(workspaceId) {
  const nextId = Number(workspaceId);
  document.querySelector("#workspace-switcher").open = false;
  if (nextId === Number(selectedWorkspaceId)) return;

  selectedWorkspaceId = nextId;
  sessionStorage.setItem(WORKSPACE_STORAGE_KEY, String(selectedWorkspaceId));
  sessionStorage.removeItem(PROJECT_STORAGE_KEY);
  globalPage = null;
  globalPageRequest += 1;
  selectedView = "board";
  selectedProjectId = null;
  const url = new URL(window.location.href);
  url.searchParams.delete("project");
  window.history.replaceState(null, "", url);
  renderWorkspaceMenu();
  renderProjects();
  showMessage("Loading workspace...");

  try {
    await refreshProjects();
    members = await api("/members");
    renderMembers();
    await loadIssues();
    showMessage("");
  } catch (error) {
    console.error("Could not switch workspace:", error);
    showMessage(`Could not load this workspace: ${error.message}`, true);
  }
}

async function renderGlobalPage() {
  const page = globalPage;
  const requestId = ++globalPageRequest;
  const headings = { home: "Home", "your-work": "Your work", recent: "Recent", starred: "Starred", admin: "User management" };
  document.querySelector("#active-view-label").textContent = headings[page] || "Home";
  document.querySelector("#board-hint").hidden = true;
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.remove("active");
    tab.setAttribute("aria-pressed", "false");
  });
  document.querySelector(".page-content").classList.add("global-page");
  if (page === "recent") {
    showMessage("");
    renderRecentPage();
    return;
  }
  if (page === "starred") {
    showMessage("");
    renderStarredPage();
    return;
  }
  if (page === "admin") {
    showMessage("Loading accounts...");
    try {
      const accounts = await api("/admin/accounts");
      if (requestId !== globalPageRequest || globalPage !== page) return;
      showMessage("");
      renderAccountsPage(accounts);
    } catch (error) {
      if (requestId !== globalPageRequest) return;
      console.error("Could not load user accounts:", error);
      showMessage(`Could not load user accounts: ${error.message}`, true);
      board.innerHTML = "";
    }
    return;
  }
  showMessage("Loading workspace issues...");
  try {
    const allIssues = await loadIssuesAcrossProjects();
    if (requestId !== globalPageRequest || globalPage !== page) return;
    showMessage("");
    if (page === "your-work") renderYourWorkPage(allIssues);
    else renderHomePage(allIssues);
  } catch (error) {
    if (requestId !== globalPageRequest) return;
    console.error(`Could not load ${page} page:`, error);
    showMessage(`Could not load workspace issues: ${error.message}`, true);
    board.className = "view-panel";
    board.innerHTML = '<p class="empty-state">Workspace data could not be loaded.</p>';
  }
}

function renderBacklogView() {
  board.className = "view-panel backlog-view";
  const backlogStatus = metadata.statuses.find((status) => /to do|backlog/i.test(status)) || metadata.statuses[0];
  if (!backlogStatus) {
    board.innerHTML = '<p class="empty-state">No issue statuses are configured by the API.</p>';
    return;
  }
  const visibleIssues = getFilteredIssues();
  const backlog = visibleIssues.filter((issue) => issue.status === backlogStatus);
  const remaining = visibleIssues.filter((issue) => issue.status !== backlogStatus);
  board.innerHTML = `<div class="backlog-section">
      <div class="view-panel-heading"><div><h2>Backlog</h2><p>${backlog.length} issues in ${escapeHtml(backlogStatus)}</p></div>
        <button class="button button-secondary" type="button" data-create-status="${escapeHtml(backlogStatus)}">＋ Add issue</button>
      </div>
      ${renderIssueTable(backlog, { includeStatus: false, emptyMessage: `No issues in ${backlogStatus}.` })}
    </div>
    <details class="backlog-other">
      <summary>Other workflow statuses <span class="task-count">${remaining.length}</span></summary>
      ${renderIssueTable(remaining, { emptyMessage: "No other issues." })}
    </details>`;
}

function formatDate(value, options = { month: "short", day: "numeric" }) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return new Intl.DateTimeFormat(undefined, options).format(date);
}

function formatDateTime(value, dateOptions = { month: "short", day: "numeric" }) {
  if (!value) return "—";
  const date = formatDate(value, dateOptions);
  const time = formatTime(value);
  return time ? `${date} · ${time}` : date;
}

function formatTime(value) {
  if (!value || !value.includes("T")) return "";
  const time = value.slice(11, 16);
  const [hours, minutes] = time.split(":").map(Number);
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(2000, 0, 1, hours, minutes));
}

function renderTimelineView() {
  board.className = "view-panel timeline-view";
  const year = timelineMonth.getFullYear();
  const month = timelineMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(timelineMonth);
  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEnd = new Date(Date.UTC(year, month, daysInMonth));
  const filtered = getFilteredIssues();
  const scheduled = [];
  const unscheduled = [];
  filtered.forEach((issue) => {
    if (!issue.startDate && !issue.dueDate) {
      unscheduled.push(issue);
      return;
    }
    const start = new Date(`${(issue.startDate || issue.dueDate).slice(0, 10)}T00:00:00Z`);
    const end = new Date(`${(issue.dueDate || issue.startDate).slice(0, 10)}T00:00:00Z`);
    if (end < monthStart || start > monthEnd) return;
    const firstDay = start < monthStart ? 1 : start.getUTCDate();
    const lastDay = end > monthEnd ? daysInMonth : end.getUTCDate();
    scheduled.push({ issue, firstDay, lastDay });
  });

  const dayHeaders = Array.from({ length: daysInMonth }, (_, index) => {
    const date = new Date(Date.UTC(year, month, index + 1));
    const weekday = new Intl.DateTimeFormat(undefined, { weekday: "narrow", timeZone: "UTC" }).format(date);
    return `<span class="timeline-day"><small>${weekday}</small><strong>${index + 1}</strong></span>`;
  }).join("");
  const rows = scheduled.map(({ issue, firstDay, lastDay }) => {
    const endColumn = Math.min(daysInMonth + 1, lastDay + 1);
    return `<div class="timeline-row">
      <button class="timeline-issue" type="button" data-edit-issue="${issue.id}">
        <span class="issue-key">${escapeHtml(issue.key)}</span><span>${escapeHtml(issue.summary)}</span>
      </button>
      <div class="timeline-track" style="--days:${daysInMonth}">
        ${Array.from({ length: daysInMonth }, () => '<span class="timeline-cell"></span>').join("")}
        <button class="timeline-bar priority-border-${slug(issue.priority)}" type="button" data-edit-issue="${issue.id}" style="grid-column:${firstDay} / ${endColumn}" title="${escapeHtml(issue.key)} · ${escapeHtml(issue.summary)} · ${escapeHtml(formatDateTime(issue.startDate || issue.dueDate))} – ${escapeHtml(formatDateTime(issue.dueDate || issue.startDate))}">
          ${escapeHtml(issue.key)} · ${escapeHtml(issue.summary)}
        </button>
      </div>
    </div>`;
  }).join("");

  board.innerHTML = `<div class="timeline-toolbar">
      <div class="timeline-month-nav">
        <button class="button button-secondary" type="button" data-month-shift="-1" aria-label="Previous month">‹</button>
        <h2>${escapeHtml(monthLabel)}</h2>
        <button class="button button-secondary" type="button" data-month-shift="1" aria-label="Next month">›</button>
        <button class="button button-secondary" type="button" data-month-today>Today</button>
      </div>
      <span class="timeline-caption">${scheduled.length} scheduled · ${unscheduled.length} without dates</span>
    </div>
    <div class="timeline-scroll">
      <div class="timeline-grid" style="--days:${daysInMonth}">
        <div class="timeline-header"><strong>Issue</strong><div class="timeline-day-track" style="--days:${daysInMonth}">${dayHeaders}</div></div>
        ${rows || '<p class="empty-state timeline-empty">No issues scheduled this month.</p>'}
      </div>
    </div>
    <div class="unscheduled-section">
      <div class="view-panel-heading"><div><h2>Unscheduled</h2><p>Add dates to place an issue on the timeline.</p></div></div>
      ${renderIssueTable(unscheduled, { emptyMessage: "All matching issues have dates." })}
    </div>`;
}

function renderView() {
  if (globalPage) {
    renderGlobalPage();
    return;
  }
  document.querySelector(".page-content").classList.remove("global-page");
  const views = {
    board: ["Board", renderBoardView, "Tip: drag an issue between columns to update its status."],
    list: ["List", renderListView, "Select an issue to edit its details."],
    backlog: ["Backlog", renderBacklogView, "Issues in the first workflow status appear in the backlog."],
    timeline: ["Timeline", renderTimelineView, "Add start and due dates to an issue to schedule it."]
  };
  const [label, render, hint] = views[selectedView] || views.board;
  document.querySelector("#active-view-label").textContent = label;
  document.querySelector("#board-hint").textContent = hint;
  document.querySelector("#board-hint").hidden = selectedView === "timeline";
  document.querySelectorAll(".tab").forEach((tab) => {
    const active = tab.dataset.view === selectedView;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-pressed", String(active));
  });
  document.querySelectorAll("[data-sort]").forEach((button) => {
    button.querySelector(".sort-check").textContent = button.dataset.sort === issueSort ? "✓" : "";
    button.setAttribute("aria-checked", String(button.dataset.sort === issueSort));
  });
  if (!projects.length) {
    board.className = "view-panel";
    board.innerHTML = '<p class="empty-state">Create a project to start tracking issues.</p>';
    return;
  }
  render();
}

function updateBoardSettings() {
  boardSettings = {
    showDescriptions: document.querySelector("#setting-descriptions").checked,
    showDueDates: document.querySelector("#setting-due-dates").checked,
    compactCards: document.querySelector("#setting-compact-cards").checked
  };
  renderView();
  try {
    localStorage.setItem(BOARD_SETTINGS_KEY, JSON.stringify(boardSettings));
    showMessage("");
  } catch (error) {
    console.error("Could not save board settings:", error);
    showMessage("Board settings could not be saved in this browser.", true);
  }
}

function csvCell(value) {
  let text = String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function exportFilteredIssues() {
  if (!selectedProjectId) {
    showMessage("Select a project before exporting issues.", true);
    return;
  }
  const rows = getFilteredIssues();
  const columns = [
    ["Issue key", (issue) => issue.key],
    ["Summary", (issue) => issue.summary],
    ["Description", (issue) => issue.description],
    ["Type", (issue) => issue.type],
    ["Status", (issue) => issue.status],
    ["Priority", (issue) => issue.priority],
    ["Assignee", assigneeName],
    ["Start date", (issue) => issue.startDate],
    ["Due date", (issue) => issue.dueDate]
  ];
  const csv = [
    columns.map(([label]) => csvCell(label)).join(","),
    ...rows.map((issue) => columns.map(([, getValue]) => csvCell(getValue(issue))).join(","))
  ].join("\r\n");
  const project = projects.find((item) => Number(item.id) === Number(selectedProjectId));
  const url = URL.createObjectURL(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${project ? project.key : "issues"}-issues.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  showMessage(`Exported ${rows.length} filtered ${rows.length === 1 ? "issue" : "issues"}.`);
}

async function loadIssues() {
  if (!selectedProjectId) {
    issues = [];
    renderView();
    return;
  }
  issues = await api(`/projects/${selectedProjectId}/issues`);
  renderView();
}

async function selectProject(id) {
  selectedProjectId = Number(id);
  sessionStorage.setItem(PROJECT_STORAGE_KEY, String(selectedProjectId));
  const projectUrl = new URL(window.location.href);
  projectUrl.searchParams.set("project", String(selectedProjectId));
  window.history.replaceState(null, "", projectUrl);
  renderProjects();
  showMessage("Loading issues...");
  try {
    await loadIssues();
    showMessage("");
  } catch (error) {
    showMessage(`Could not load issues: ${error.message}`, true);
  }
}

function openCreateDialog(status = metadata.statuses[0]) {
  if (!selectedProjectId) {
    showMessage("Create or select a project before adding issues.", true);
    return;
  }
  setStartDateMinimum();
  form.reset();
  issueIdInput.value = "";
  if (metadata.types.length) typeInput.value = metadata.types[0];
  if (metadata.priorities.length) priorityInput.value = metadata.priorities[0];
  if (metadata.statuses.includes(status)) statusInput.value = status;
  document.querySelector("#dialog-eyebrow").textContent = "NEW ISSUE";
  document.querySelector("#dialog-title").textContent = "Create an issue";
  document.querySelector("#save-issue").textContent = "Create";
  deleteButton.hidden = true;
  dialog.showModal();
  summaryInput.focus();
}

function openEditDialog(id) {
  const issue = issues.find((item) => Number(item.id) === Number(id));
  if (!issue) return;
  rememberRecentIssue(issue);
  setStartDateMinimum();
  issueIdInput.value = issue.id;
  summaryInput.value = issue.summary;
  descriptionInput.value = issue.description || "";
  typeInput.value = issue.type;
  statusInput.value = issue.status;
  priorityInput.value = issue.priority;
  assigneeInput.value = issue.assigneeId == null ? "" : String(issue.assigneeId);
  startDateInput.value = issue.startDate || "";
  dueDateInput.value = issue.dueDate || "";
  document.querySelector("#dialog-eyebrow").textContent = issue.key;
  document.querySelector("#dialog-title").textContent = "Edit issue";
  document.querySelector("#save-issue").textContent = "Save changes";
  deleteButton.hidden = false;
  dialog.showModal();
  summaryInput.focus();
}

async function refreshProjects(preferredId) {
  projects = await api("/projects");
  const urlProjectId = Number(new URLSearchParams(window.location.search).get("project"));
  const storedId = Number(sessionStorage.getItem(PROJECT_STORAGE_KEY));
  const urlProjectExists = projects.some((project) => Number(project.id) === urlProjectId);
  const preferredExists = projects.some((project) => Number(project.id) === Number(preferredId));
  const storedExists = projects.some((project) => Number(project.id) === storedId);
  selectedProjectId = preferredExists ? Number(preferredId)
    : urlProjectExists ? urlProjectId
      : storedExists ? storedId
        : projects.length ? Number(projects[0].id) : null;
  renderProjects();
}

async function initialize() {
  if (window.location.protocol === "file:") {
    const appUrl = new URL("http://localhost:8083/");
    appUrl.search = window.location.search;
    appUrl.hash = window.location.hash;
    window.location.replace(appUrl.href);
    return;
  }
  showMessage("Connecting to the API...");
  try {
    authenticatedUser = await api("/auth/me");
    workspaces = await api("/workspaces");
    if (!workspaces.length) {
      throw new Error("You do not have access to any workspace. Ask an administrator to assign you to one.");
    }
    const storedWorkspaceId = Number(sessionStorage.getItem(WORKSPACE_STORAGE_KEY));
    selectedWorkspaceId = workspaces.some((workspace) => Number(workspace.id) === storedWorkspaceId)
      ? storedWorkspaceId
      : Number(workspaces[0].id);
    sessionStorage.setItem(WORKSPACE_STORAGE_KEY, String(selectedWorkspaceId));
    renderWorkspaceMenu();
    [metadata, projects, members] = await Promise.all([
      api("/metadata"),
      api("/projects"),
      api("/members")
    ]);
    renderMetadata();
    renderMembers();
    await refreshProjects();
    renderProjects();
    await loadIssues();
    showMessage("");
    window.setTimeout(() => {
      try {
        if (localStorage.getItem(TOUR_COMPLETED_KEY) !== "true") startProductTour();
      } catch (error) {
        if (error.status === 401) {
          window.location.assign("/login.html");
          return;
        }
        console.error("Could not check product tour status:", error);
      }
    }, 500);
  } catch (error) {
    console.error("Could not initialize the board:", error);
    if (error.status === 401) {
      window.location.assign("/login.html");
      return;
    }
    showMessage(`Could not connect to ${API_BASE_URL}: ${error.message}. Start the Java API and reload.`, true);
    board.innerHTML = "";
  }
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    globalPage = null;
    selectedView = tab.dataset.view;
    renderView();
  });
});
document.querySelectorAll(".primary-nav [data-page]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    globalPage = link.dataset.page;
    renderProjects();
    renderGlobalPage();
  });
});
document.querySelector("#workspace-menu").addEventListener("click", (event) => {
  const workspaceButton = event.target.closest("[data-workspace-id]");
  if (workspaceButton) {
    switchWorkspace(workspaceButton.dataset.workspaceId);
    return;
  }
  if (event.target.closest("[data-manage-workspaces]")) openWorkspaceManager();
});
document.querySelector("#create-workspace").addEventListener("click", () => openWorkspaceEditor());
document.querySelector("#workspace-manager-list").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit-workspace]");
  if (editButton) openWorkspaceEditor(editButton.dataset.editWorkspace);
});
document.querySelector("#workspace-account-options").addEventListener("change", updateWorkspaceSelectedCount);
document.querySelector("#workspace-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const workspaceId = form.dataset.workspaceId;
  const request = {
    name: document.querySelector("#workspace-name-input").value.trim(),
    accountIds: Array.from(document.querySelectorAll('#workspace-account-options input[name="accountIds"]:checked'))
      .map((input) => Number(input.value))
  };
  const submitButton = document.querySelector("#workspace-save");
  submitButton.disabled = true;
  try {
    await api(workspaceId ? `/admin/workspaces/${workspaceId}/accounts` : "/admin/workspaces", {
      method: workspaceId ? "PUT" : "POST",
      body: JSON.stringify(request)
    });
    document.querySelector("#workspace-dialog").close();
    await reloadWorkspaces();
    await openWorkspaceManager();
  } catch (error) {
    console.error("Could not save workspace:", error);
    document.querySelector("#workspace-form-message").textContent = `Could not save workspace: ${error.message}`;
  } finally {
    submitButton.disabled = false;
  }
});
document.querySelector("[data-tour-start]").addEventListener("click", startProductTour);
document.querySelectorAll("[data-tour-close]").forEach((button) => {
  button.addEventListener("click", () => closeProductTour());
});
document.querySelector("#tour-back").addEventListener("click", () => advanceProductTour(-1));
document.querySelector("#tour-next").addEventListener("click", () => advanceProductTour(1));
window.addEventListener("resize", () => {
  if (!document.querySelector("#product-tour").hidden) updateProductTourStep();
});
window.addEventListener("scroll", () => {
  if (!document.querySelector("#product-tour").hidden) updateProductTourStep();
}, true);
document.querySelector("#board-settings-button").addEventListener("click", () => {
  document.querySelector("#setting-descriptions").checked = boardSettings.showDescriptions;
  document.querySelector("#setting-due-dates").checked = boardSettings.showDueDates;
  document.querySelector("#setting-compact-cards").checked = boardSettings.compactCards;
  boardSettingsDialog.showModal();
});
document.querySelector("#board-settings-dialog form").addEventListener("submit", () => {
  updateBoardSettings();
});
document.querySelectorAll("[data-sort]").forEach((button) => {
  button.addEventListener("click", () => {
    issueSort = button.dataset.sort;
    document.querySelector(".board-options").open = false;
    renderView();
  });
});
document.querySelector("#refresh-issues").addEventListener("click", async () => {
  document.querySelector(".board-options").open = false;
  if (!selectedProjectId) {
    showMessage("Select a project before refreshing issues.", true);
    return;
  }
  showMessage("Refreshing issues...");
  try {
    await loadIssues();
    showMessage("Issues refreshed.");
  } catch (error) {
    showMessage(`Could not refresh issues: ${error.message}`, true);
  }
});
document.querySelector("#export-issues").addEventListener("click", () => {
  document.querySelector(".board-options").open = false;
  exportFilteredIssues();
});
document.querySelector("#create-issue").addEventListener("click", () => openCreateDialog());
document.querySelector("#toggle-project-star").addEventListener("click", () => {
  if (selectedProjectId) toggleStarredProject(selectedProjectId);
});
document.querySelector("#share-project").addEventListener("click", () => {
  const project = projects.find((item) => Number(item.id) === Number(selectedProjectId));
  if (!project) {
    showMessage("Select a project before sharing it.", true);
    return;
  }
  const projectUrl = new URL(window.location.href);
  projectUrl.searchParams.set("project", String(project.id));
  document.querySelector("#share-project-link").value = projectUrl.href;
  document.querySelector("#share-project-message").textContent = "";
  document.querySelector("#native-share-project").hidden = typeof navigator.share !== "function";
  shareProjectDialog.showModal();
});
document.querySelector("#copy-project-link").addEventListener("click", async () => {
  const linkInput = document.querySelector("#share-project-link");
  const message = document.querySelector("#share-project-message");
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(linkInput.value);
    } else {
      linkInput.focus();
      linkInput.select();
      if (!document.execCommand("copy")) throw new Error("Clipboard access is unavailable.");
    }
    message.textContent = "Project link copied.";
  } catch (error) {
    console.error("Could not copy project link:", error);
    message.textContent = "Could not copy automatically. Select the link and copy it.";
    linkInput.focus();
    linkInput.select();
  }
});
document.querySelector("#native-share-project").addEventListener("click", async () => {
  const project = projects.find((item) => Number(item.id) === Number(selectedProjectId));
  if (!project || typeof navigator.share !== "function") return;
  try {
    await navigator.share({
      title: `${project.name} · WorkSphere`,
      text: `Join me on the ${project.name} project board.`,
      url: document.querySelector("#share-project-link").value
    });
  } catch (error) {
    if (error.name !== "AbortError") {
      console.error("Could not share project:", error);
      document.querySelector("#share-project-message").textContent = "Project sharing was unavailable. Copy the link instead.";
    }
  }
});
document.querySelectorAll(".add-project-button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector("#project-form").reset();
    projectDialog.showModal();
    document.querySelector("#project-name-input").focus();
  });
});
document.querySelector("#add-member").addEventListener("click", () => {
  document.querySelector("#member-form").reset();
  memberDialog.showModal();
  document.querySelector("#member-name-input").focus();
});
document.querySelector(".profile-menu-popover").addEventListener("click", async (event) => {
  const action = event.target.closest("[data-profile-action]");
  if (!action) return;
  document.querySelector(".profile-menu").open = false;
  if (action.dataset.profileAction === "your-work") {
    globalPage = "your-work";
    renderProjects();
    renderGlobalPage();
    return;
  }
  if (action.dataset.profileAction === "add-member") {
    document.querySelector("#member-form").reset();
    memberDialog.showModal();
    document.querySelector("#member-name-input").focus();
    return;
  }
  if (action.dataset.profileAction === "admin") {
    globalPage = "admin";
    renderProjects();
    renderGlobalPage();
    return;
  }
  if (action.dataset.profileAction === "profile-photo") {
    document.querySelector("#profile-photo-input").click();
    return;
  }
  if (action.dataset.profileAction === "sign-out") {
    try {
      const csrf = await api("/auth/csrf");
      const logoutForm = document.createElement("form");
      logoutForm.method = "post";
      logoutForm.action = "/logout";
      const tokenInput = document.createElement("input");
      tokenInput.type = "hidden";
      tokenInput.name = "_csrf";
      tokenInput.value = csrf.token;
      logoutForm.appendChild(tokenInput);
      document.body.appendChild(logoutForm);
      logoutForm.submit();
    } catch (error) {
      console.error("Could not sign out:", error);
      showMessage(`Could not sign out: ${error.message}`, true);
    }
  }
});
document.querySelector("#profile-photo-input").addEventListener("change", async (event) => {
  const input = event.currentTarget;
  const photo = input.files[0];
  if (!photo) return;
  input.value = "";
  if (!["image/png", "image/jpeg"].includes(photo.type) || photo.size > 2 * 1024 * 1024) {
    showMessage("Choose a PNG or JPEG image up to 2 MB.", true);
    return;
  }

  const formData = new FormData();
  formData.append("photo", photo);
  try {
    const csrf = await api("/auth/csrf");
    const response = await fetch(`${API_BASE_URL}/auth/me/photo`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-XSRF-TOKEN": csrf.token },
      body: formData
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Upload failed (${response.status}).`);
    }
    authenticatedUser.picture = `${API_BASE_URL}/auth/me/photo?updated=${Date.now()}`;
    renderMembers();
    showMessage("");
    showToast("Profile photo updated.");
  } catch (error) {
    console.error("Could not update profile photo:", error);
    showMessage(`Could not update profile photo: ${error.message}`, true);
  }
});
document.querySelectorAll(".dialog-close, .dialog-cancel").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});
document.querySelector("#account-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const accountId = form.dataset.accountId;
  const request = {
    fullName: document.querySelector("#account-full-name").value.trim(),
    username: document.querySelector("#account-username").value.trim(),
    password: document.querySelector("#account-password").value,
    role: document.querySelector("#account-role").value,
    enabled: document.querySelector("#account-enabled").checked
  };
  const submitButton = document.querySelector("#account-save");
  submitButton.disabled = true;
  try {
    await api(accountId ? `/admin/accounts/${accountId}` : "/admin/accounts", {
      method: accountId ? "PUT" : "POST",
      body: JSON.stringify(request)
    });
    document.querySelector("#account-dialog").close();
    showMessage("");
    await renderGlobalPage();
  } catch (error) {
    document.querySelector("#account-form-message").textContent = `Could not save account: ${error.message}`;
  } finally {
    submitButton.disabled = false;
  }
});
document.querySelectorAll("dialog").forEach((element) => {
  element.addEventListener("click", (event) => {
    if (event.target === element) element.close();
  });
});

document.querySelector("#project-list").addEventListener("click", async (event) => {
  const starButton = event.target.closest("[data-star-project]");
  if (starButton) {
    toggleStarredProject(starButton.dataset.starProject);
    return;
  }
  const projectButton = event.target.closest("[data-project-id]");
  if (projectButton) {
    globalPage = null;
    selectedView = "board";
    await selectProject(projectButton.dataset.projectId);
  }
});

document.querySelector("#project-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = document.querySelector("#project-name-input").value.trim();
  try {
    const project = await api("/projects", { method: "POST", body: JSON.stringify({ name }) });
    await refreshProjects(project.id);
    renderProjects();
    await loadIssues();
    projectDialog.close();
    showMessage("");
  } catch (error) {
    showMessage(`Could not create project: ${error.message}`, true);
  }
});

document.querySelector("#member-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = document.querySelector("#member-name-input").value.trim();
  try {
    await api("/members", { method: "POST", body: JSON.stringify({ name }) });
    members = await api("/members");
    renderMembers();
    memberDialog.close();
    showMessage("");
  } catch (error) {
    showMessage(`Could not add member: ${error.message}`, true);
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (issueSaveInProgress) return;
  const id = issueIdInput.value;
  const previousIssue = issues.find((item) => Number(item.id) === Number(id));
  const assigneeId = assigneeInput.value ? Number(assigneeInput.value) : null;
  const issue = {
    summary: summaryInput.value.trim(),
    description: descriptionInput.value.trim(),
    type: typeInput.value,
    status: statusInput.value,
    priority: priorityInput.value,
    assigneeId,
    startDate: startDateInput.value || null,
    dueDate: dueDateInput.value || null
  };
  if (!issue.summary) {
    summaryInput.focus();
    return;
  }
  if (issue.startDate && issue.dueDate && issue.startDate > issue.dueDate) {
    showMessage("Start date must be on or before due date.", true);
    dueDateInput.focus();
    return;
  }
  issueSaveInProgress = true;
  const saveButton = document.querySelector("#save-issue");
  saveButton.disabled = true;
  try {
    const path = `/projects/${selectedProjectId}/issues${id ? `/${id}` : ""}`;
    await api(path, { method: id ? "PUT" : "POST", body: JSON.stringify(issue) });
    await loadIssues();
    dialog.close();
    showMessage("");
    if (isDoneStatus(issue.status) && !isDoneStatus(previousIssue?.status)) celebrateCompletion(issue.type);
  } catch (error) {
    showMessage(`Could not save issue: ${error.message}`, true);
  } finally {
    issueSaveInProgress = false;
    saveButton.disabled = false;
  }
});

deleteButton.addEventListener("click", async () => {
  const id = issueIdInput.value;
  const issue = issues.find((item) => Number(item.id) === Number(id));
  if (!id || !window.confirm(`Delete ${issue ? issue.key : "this issue"}? This cannot be undone.`)) return;
  try {
    await api(`/projects/${selectedProjectId}/issues/${id}`, { method: "DELETE" });
    await loadIssues();
    dialog.close();
    showMessage("");
  } catch (error) {
    showMessage(`Could not delete issue: ${error.message}`, true);
  }
});

searchInput.addEventListener("input", renderView);
typeFilter.addEventListener("change", renderView);
priorityFilter.addEventListener("change", renderView);
document.querySelector("#clear-filters").addEventListener("click", () => {
  searchInput.value = "";
  typeFilter.value = "all";
  priorityFilter.value = "all";
  renderView();
});

board.addEventListener("click", (event) => {
  const createAccountButton = event.target.closest("#create-account");
  if (createAccountButton) {
    openAccountDialog();
    return;
  }
  const editAccountButton = event.target.closest("[data-edit-account]");
  if (editAccountButton) {
    api("/admin/accounts").then((accounts) => {
      const account = accounts.find((item) => Number(item.id) === Number(editAccountButton.dataset.editAccount));
      if (account) openAccountDialog(account);
    }).catch((error) => showMessage(`Could not load account: ${error.message}`, true));
    return;
  }
  const deleteAccountButton = event.target.closest("[data-delete-account]");
  if (deleteAccountButton) {
    const accountId = deleteAccountButton.dataset.deleteAccount;
    if (!window.confirm("Delete this account? This cannot be undone.")) return;
    api(`/admin/accounts/${accountId}`, { method: "DELETE" })
      .then(() => renderGlobalPage())
      .catch((error) => showMessage(`Could not delete account: ${error.message}`, true));
    return;
  }
  const pageLink = event.target.closest("[data-page-link]");
  if (pageLink) {
    globalPage = pageLink.dataset.pageLink;
    renderProjects();
    renderGlobalPage();
    return;
  }
  const openProjectButton = event.target.closest("[data-open-project]");
  if (openProjectButton) {
    globalPage = null;
    selectedView = "board";
    selectProject(openProjectButton.dataset.openProject);
    return;
  }
  const globalStarButton = event.target.closest("[data-star-project]");
  if (globalStarButton) {
    toggleStarredProject(globalStarButton.dataset.starProject);
    return;
  }
  if (event.target.closest("#home-create-project")) {
    document.querySelector("#project-form").reset();
    projectDialog.showModal();
    document.querySelector("#project-name-input").focus();
    return;
  }
  const monthButton = event.target.closest("[data-month-shift], [data-month-today]");
  if (monthButton) {
    if (monthButton.hasAttribute("data-month-today")) {
      const now = new Date();
      timelineMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      timelineMonth.setMonth(timelineMonth.getMonth() + Number(monthButton.dataset.monthShift));
    }
    renderView();
    return;
  }
  const editButton = event.target.closest("[data-edit-issue]");
  if (editButton) {
    const projectId = Number(editButton.dataset.projectId || selectedProjectId);
    if (projectId !== Number(selectedProjectId)) {
      globalPage = null;
      selectProject(projectId).then(() => openEditDialog(editButton.dataset.editIssue));
    } else {
      openEditDialog(editButton.dataset.editIssue);
    }
    return;
  }
  const backlogCreateButton = event.target.closest("[data-create-status]");
  if (backlogCreateButton) {
    openCreateDialog(backlogCreateButton.dataset.createStatus);
    return;
  }
  const createButton = event.target.closest(".add-card-button, .add-column-issue");
  if (createButton) {
    openCreateDialog(createButton.dataset.status);
    return;
  }
  const card = event.target.closest(".issue-card");
  if (card) openEditDialog(card.dataset.issueId);
});
board.addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches(".issue-card")) {
    event.preventDefault();
    openEditDialog(event.target.dataset.issueId);
  }
});
board.addEventListener("dragstart", (event) => {
  const card = event.target.closest(".issue-card");
  if (!card) return;
  draggedIssueId = card.dataset.issueId;
  card.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", draggedIssueId);
});
board.addEventListener("dragend", (event) => {
  const card = event.target.closest(".issue-card");
  if (card) card.classList.remove("dragging");
  board.querySelectorAll(".board-column").forEach((column) => column.classList.remove("drag-over"));
  draggedIssueId = null;
});
board.addEventListener("dragover", (event) => {
  const column = event.target.closest(".board-column");
  if (!column) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
  column.classList.add("drag-over");
});
board.addEventListener("dragleave", (event) => {
  const column = event.target.closest(".board-column");
  if (column && !column.contains(event.relatedTarget)) column.classList.remove("drag-over");
});
board.addEventListener("drop", async (event) => {
  const column = event.target.closest(".board-column");
  if (!column) return;
  event.preventDefault();
  const issueId = event.dataTransfer.getData("text/plain") || draggedIssueId;
  const issue = issues.find((item) => Number(item.id) === Number(issueId));
  const status = column.dataset.status;
  if (issue && metadata.statuses.includes(status) && issue.status !== status) {
    const wasDone = isDoneStatus(issue.status);
    try {
      await api(`/projects/${selectedProjectId}/issues/${issue.id}`, {
        method: "PUT",
        body: JSON.stringify({
          summary: issue.summary,
          description: issue.description || "",
          type: issue.type,
          status,
          priority: issue.priority,
          assigneeId: issue.assigneeId,
          startDate: issue.startDate || null,
          dueDate: issue.dueDate || null
        })
      });
      await loadIssues();
      showMessage("");
      if (isDoneStatus(status) && !wasDone) celebrateCompletion(issue.type);
    } catch (error) {
      showMessage(`Could not move issue: ${error.message}`, true);
    }
  }
  column.classList.remove("drag-over");
});

searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    searchInput.value = "";
    renderView();
    searchInput.blur();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !document.querySelector("#product-tour").hidden) {
    closeProductTour();
    return;
  }
  if (event.key === "Escape") document.querySelector(".board-options").open = false;
  if (event.key === "Escape") document.querySelector(".profile-menu").open = false;
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
});
document.addEventListener("click", (event) => {
  const options = document.querySelector(".board-options");
  if (options.open && !options.contains(event.target)) options.open = false;
  const profileMenu = document.querySelector(".profile-menu");
  if (profileMenu.open && !profileMenu.contains(event.target)) profileMenu.open = false;
});

initialize();
