// ---------- State ----------
let TOKEN = localStorage.getItem("token") || null;
let ROLE = localStorage.getItem("role") || null;

// ---------- Helpers ----------
function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}
// Tiny, safe markdown for AI replies: **bold**, headings, and "* " / "- " bullets.
function md(text) {
  return esc(text).split("\n").map(function (line) {
    line = line.replace(/^#{1,4}\s*(.+)$/, "<strong>$1</strong>").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    var m = line.match(/^\s*[*-]\s+(.*)$/);
    return m ? '<span class="li">- ' + m[1] + "</span>" : line + "\n";
  }).join("");
}
async function api(path, { method = "GET", body = null, form = false } = {}) {
  const headers = {};
  if (TOKEN) headers["Authorization"] = `Bearer ${TOKEN}`;
  let payload = body;

  if (form) {
    payload = new URLSearchParams(body);
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  } else if (body) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload });
  if (!res.ok) {
    let detail = "Request failed";
    try { detail = (await res.json()).detail || detail; } catch (_) {}
    throw new Error(detail);
  }
  if (res.status === 204) return null;
  return res.json();
}

function show(viewId) {
  document.querySelectorAll(".view").forEach(v => v.classList.add("hidden"));
  document.getElementById(viewId).classList.remove("hidden");
}

function renderNav() {
  const nav = document.getElementById("nav-actions");
  if (!TOKEN) { nav.innerHTML = ""; return; }
  nav.innerHTML = `
    <span class="role-pill">${ROLE === "idea_owner" ? "Idea Owner" : "Collaborator"}</span>
    <button id="logout-btn">Log out</button>
  `;
  document.getElementById("logout-btn").onclick = logout;
}

function logout() {
  TOKEN = null; ROLE = null;
  localStorage.removeItem("token"); localStorage.removeItem("role");
  renderNav();
  show("view-auth");
}

function routeToDashboard() {
  renderNav();
  if (!TOKEN) { show("view-auth"); return; }
  if (ROLE === "idea_owner") { show("view-owner"); loadOwnerDashboard(); }
  else { show("view-collaborator"); loadCollaboratorDashboard(); }
}

// ---------- Auth tabs ----------
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.getElementById("form-login").classList.toggle("hidden", tab !== "login");
    document.getElementById("form-signup").classList.toggle("hidden", tab !== "signup");
  };
});

document.getElementById("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("login-msg");
  msg.textContent = ""; msg.classList.remove("error");
  try {
    const data = await api("/auth/login", {
      method: "POST",
      form: true,
      body: {
        username: document.getElementById("login-email").value,
        password: document.getElementById("login-password").value,
      },
    });
    TOKEN = data.access_token; ROLE = data.role;
    localStorage.setItem("token", TOKEN); localStorage.setItem("role", ROLE);
    routeToDashboard();
  } catch (err) {
    msg.textContent = err.message; msg.classList.add("error");
  }
});

document.getElementById("form-signup").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("signup-msg");
  msg.textContent = ""; msg.classList.remove("error");
  try {
    await api("/auth/signup", {
      method: "POST",
      body: {
        name: document.getElementById("signup-name").value,
        email: document.getElementById("signup-email").value,
        password: document.getElementById("signup-password").value,
        role: document.getElementById("signup-role").value,
      },
    });
    const data = await api("/auth/login", {
      method: "POST",
      form: true,
      body: {
        username: document.getElementById("signup-email").value,
        password: document.getElementById("signup-password").value,
      },
    });
    TOKEN = data.access_token; ROLE = data.role;
    localStorage.setItem("token", TOKEN); localStorage.setItem("role", ROLE);
    routeToDashboard();
  } catch (err) {
    msg.textContent = err.message; msg.classList.add("error");
  }
});

// =========================================================
// OWNER DASHBOARD
// =========================================================
async function loadOwnerDashboard() {
  await loadMyIdea();
  await loadAgentHistory();
  await loadPatentHistory();
  await loadApplications();
}

let currentIdeaExists = false;

async function loadMyIdea() {
  try {
    const idea = await api("/owner/idea");
    currentIdeaExists = true;
    document.getElementById("idea-title").value = idea.title;
    document.getElementById("idea-problem").value = idea.problem_statement;
    document.getElementById("idea-category").value = idea.category;
    document.getElementById("idea-industry").value = idea.industry;
    document.getElementById("idea-brief").value = idea.brief_detail || "";
    document.getElementById("idea-full").value = idea.full_description || "";
    document.getElementById("idea-visibility").value = idea.visibility;
    document.getElementById("idea-save-btn").textContent = "Update idea";
  } catch (err) {
    currentIdeaExists = false;
    document.getElementById("idea-save-btn").textContent = "Save idea";
  }
}

document.getElementById("form-idea").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("idea-msg");
  msg.textContent = ""; msg.classList.remove("error");
  const payload = {
    title: document.getElementById("idea-title").value,
    problem_statement: document.getElementById("idea-problem").value,
    category: document.getElementById("idea-category").value,
    industry: document.getElementById("idea-industry").value,
    brief_detail: document.getElementById("idea-brief").value,
    full_description: document.getElementById("idea-full").value,
    visibility: document.getElementById("idea-visibility").value,
  };
  try {
    if (currentIdeaExists) {
      await api("/owner/idea", { method: "PATCH", body: payload });
      msg.textContent = "Idea updated.";
    } else {
      await api("/owner/idea", { method: "POST", body: payload });
      currentIdeaExists = true;
      document.getElementById("idea-save-btn").textContent = "Update idea";
      msg.textContent = "Idea created. Your AI agent and patent guidance are now active below.";
    }
  } catch (err) {
    msg.textContent = err.message; msg.classList.add("error");
  }
});

// ---- AI agent chat ----
function appendMsg(threadId, sender, content, pending) {
  const thread = document.getElementById(threadId);
  const div = document.createElement("div");
  div.className = `msg ${sender}${pending ? " pending" : ""}`;
  if (sender === "agent" && !pending) div.innerHTML = md(content); else div.textContent = content;
  thread.appendChild(div);
  thread.scrollTop = thread.scrollHeight;
  return div;
}

async function loadAgentHistory() {
  try {
    const history = await api("/owner/agent/history");
    const thread = document.getElementById("agent-thread");
    thread.innerHTML = "";
    history.forEach(m => appendMsg("agent-thread", m.sender === "user" ? "user" : "agent", m.content));
  } catch (_) {}
}

document.getElementById("form-agent-chat").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("agent-input");
  const btn = e.target.querySelector("button");
  const text = input.value.trim();
  if (!text) return;
  appendMsg("agent-thread", "user", text);
  input.value = "";
  btn.disabled = true;
  const wait = appendMsg("agent-thread", "agent", "Thinking...", true);
  try {
    const reply = await api("/owner/agent/chat", { method: "POST", body: { message: text } });
    wait.remove();
    appendMsg("agent-thread", "agent", reply.content);
  } catch (err) {
    wait.remove();
    appendMsg("agent-thread", "agent", `Could not reach the server: ${err.message}. Check that the backend is running.`);
  } finally { btn.disabled = false; }
});

// ---- Patent guidance ----
async function loadPatentHistory() {
  try {
    const history = await api("/owner/patent/history");
    const thread = document.getElementById("patent-thread");
    thread.innerHTML = "";
    history.forEach(q => {
      appendMsg("patent-thread", "user", q.query_text);
      appendMsg("patent-thread", "agent", q.response_text);
    });
  } catch (_) {}
}

document.getElementById("form-patent").addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("patent-input");
  const btn = e.target.querySelector("button");
  const text = input.value.trim();
  appendMsg("patent-thread", "user", text || "(general first-pass analysis)");
  input.value = "";
  btn.disabled = true;
  const wait = appendMsg("patent-thread", "agent", "Analysing your idea...", true);
  try {
    const result = await api("/owner/patent/ask", { method: "POST", body: { question: text || null } });
    wait.remove();
    appendMsg("patent-thread", "agent", result.response_text);
  } catch (err) {
    wait.remove();
    appendMsg("patent-thread", "agent", `Could not reach the server: ${err.message}. Check that the backend is running.`);
  } finally { btn.disabled = false; }
});

// ---- Applications inbox ----
async function loadApplications() {
  const list = document.getElementById("applications-list");
  list.innerHTML = "";
  try {
    const apps = await api("/owner/applications");
    if (apps.length === 0) { list.innerHTML = `<p class="panel-sub">No applications yet.</p>`; return; }
    apps.forEach(a => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-top">
          <span class="card-title">${esc(a.applicant_name)}</span>
          <span class="status-pill ${a.status}">${a.status}</span>
        </div>
        <div class="card-body">${esc(a.applicant_email)}${a.message ? "<br>" + esc(a.message) : ""}</div>
        ${a.status === "approved" ? `<div class="card-body"><strong>Contact:</strong> ${esc(a.contact_info) || "None given"}<br><strong>Resume:</strong> ${esc(a.resume_text) || "None given"}</div>` : ""}
        <div class="card-actions">
          ${a.status === "pending" ? `<button data-action="approve" data-id="${a.id}">Approve</button><button data-action="reject" data-id="${a.id}">Reject</button>` : ""}
        </div>
      `;
      list.appendChild(card);
    });
    list.querySelectorAll("button[data-action]").forEach(btn => {
      btn.onclick = async () => {
        const status = btn.dataset.action === "approve" ? "approved" : "rejected";
        await api(`/owner/applications/${btn.dataset.id}/decision`, { method: "POST", body: { status } });
        loadApplications();
      };
    });
  } catch (err) {
    list.innerHTML = `<p class="panel-sub">${err.message}</p>`;
  }
}

// =========================================================
// COLLABORATOR DASHBOARD
// =========================================================
async function loadCollaboratorDashboard() {
  await loadPublicIdeas();
  await loadMyApplications();
}

async function loadPublicIdeas() {
  const list = document.getElementById("ideas-list");
  list.innerHTML = "";
  const category = document.getElementById("filter-category").value.trim();
  const industry = document.getElementById("filter-industry").value.trim();
  const qs = new URLSearchParams();
  if (category) qs.set("category", category);
  if (industry) qs.set("industry", industry);

  try {
    const ideas = await api(`/browse/ideas${qs.toString() ? "?" + qs.toString() : ""}`);
    if (ideas.length === 0) { list.innerHTML = `<p class="panel-sub">No public ideas match yet.</p>`; return; }
    ideas.forEach(idea => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-top">
          <span class="card-title">${esc(idea.title)}</span>
          <span class="card-tags">${esc(idea.category)} / ${esc(idea.industry)}</span>
        </div>
        <div class="card-body">${esc(idea.problem_statement)}</div>
        ${idea.brief_detail ? `<div class="card-body">${esc(idea.brief_detail)}</div>` : ""}
        <div class="card-actions">
          <button data-apply="${idea.id}" data-title="${esc(idea.title)}">Apply to collaborate</button>
        </div>
      `;
      list.appendChild(card);
    });
    list.querySelectorAll("button[data-apply]").forEach(btn => {
      btn.onclick = () => openApplyModal(btn.dataset.apply, btn.dataset.title);
    });
  } catch (err) {
    list.innerHTML = `<p class="panel-sub">${err.message}</p>`;
  }
}

document.getElementById("filter-btn").onclick = loadPublicIdeas;

async function loadMyApplications() {
  const list = document.getElementById("my-applications-list");
  list.innerHTML = "";
  try {
    const apps = await api("/collaborator/applications");
    if (apps.length === 0) { list.innerHTML = `<p class="panel-sub">You haven't applied to anything yet.</p>`; return; }
    apps.forEach(a => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-top">
          <span class="card-title">Application</span>
          <span class="status-pill ${a.status}">${a.status}</span>
        </div>
        <div class="card-body">${esc(a.message) || "No message"}</div>
      `;
      list.appendChild(card);
    });
  } catch (err) {
    list.innerHTML = `<p class="panel-sub">${err.message}</p>`;
  }
}

// ---- Apply modal ----
const applyModal = document.getElementById("apply-modal");
function openApplyModal(ideaId, title) {
  document.getElementById("apply-idea-id").value = ideaId;
  document.getElementById("apply-modal-title").textContent = `Apply to: ${title}`;
  document.getElementById("apply-message").value = "";
  document.getElementById("apply-resume").value = "";
  document.getElementById("apply-contact").value = "";
  document.getElementById("apply-msg").textContent = "";
  applyModal.classList.remove("hidden");
}
document.getElementById("apply-cancel").onclick = () => applyModal.classList.add("hidden");

document.getElementById("form-apply").addEventListener("submit", async (e) => {
  e.preventDefault();
  const msg = document.getElementById("apply-msg");
  try {
    await api("/collaborator/apply", {
      method: "POST",
      body: {
        idea_id: document.getElementById("apply-idea-id").value,
        message: document.getElementById("apply-message").value,
        resume_text: document.getElementById("apply-resume").value,
        contact_info: document.getElementById("apply-contact").value,
      },
    });
    applyModal.classList.add("hidden");
    loadMyApplications();
  } catch (err) {
    msg.textContent = err.message; msg.classList.add("error");
  }
});

// ---------- Landing-page intent handoff ----------
function applyIntent() {
  if (TOKEN) return;
  const intent = new URLSearchParams(window.location.search).get("intent");
  if (!intent) return;

  const wantsSignup = intent === "owner" || intent === "collaborate" || intent === "signup";
  const tab = wantsSignup ? "signup" : "login";
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  document.getElementById("form-login").classList.toggle("hidden", tab !== "login");
  document.getElementById("form-signup").classList.toggle("hidden", tab !== "signup");

  if (intent === "owner") document.getElementById("signup-role").value = "idea_owner";
  if (intent === "collaborate") document.getElementById("signup-role").value = "collaborator";
}

// ---------- Boot ----------
routeToDashboard();
applyIntent();
