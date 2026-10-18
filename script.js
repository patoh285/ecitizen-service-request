
/* 
   1. CONFIG
   Fixed settings used across the app.
 */

// Service categories (name -> icon)
const CATEGORIES = {
  "Broken Streetlight": "💡",
  "Water Supply / Pipe Leak": "🚰",
  "Garbage Collection": "🗑️",
  "Road / Infrastructure Damage": "🛣️",
  "Public Health & Sanitation": "🏥"
};

// Sub-counties
const SUB_COUNTIES = [
  "Kiharu", "Kigumo", "Kangema", "Mathioya",
  "Kahuro", "Murang’a South", "Gatanga", "Kandara"
];

// requests
const STATUSES = ["Pending", "In Progress", "Resolved"];


/* 
   2. CORE
  
   */

/*  Short DOM helper  */
function $(id) {
  return document.getElementById(id);
}

/*  Storage (browser localStorage) */

// Read a value from localStorage. 
function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch (error) {
    return fallback;
  }
}

// Write a value to localStorage. 
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    toast("Storage is full or blocked. Try a smaller photo.");
    return false;
  }
}

/*  Application state  */
let users       = load("ecitizen.users", []);     
let requests    = load("ecitizen.requests", []);   
let currentUser = load("ecitizen.session", null); 

let authMode = "login";                            
let filters  = { search: "", status: "" };        

/*  Security helpers  */

// Escape text before inserting it into HTML so users cannot inject scripts.
function esc(value) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value ?? "").replace(/[&<>"']/g, (char) => map[char]);
}

// Turn a password into a SHA-256 hash so the plain password is never stored.
async function hashPassword(password) {
  const text = "ecitizen:" + password;

  try {
    if (crypto && crypto.subtle) {
      const bytes  = new TextEncoder().encode(text);
      const buffer = await crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(buffer)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch (error) {
   
  }

  let hash = 5381;
  for (const char of text) {
    hash = (hash * 33) ^ char.charCodeAt(0);
  }
  return "f" + (hash >>> 0).toString(16);
}

/*  UI helpers  */

// Show a short message at the bottom of the screen for a few seconds.
function toast(message) {
  const box = $("toast");
  box.textContent = message;
  box.style.display = "block";

  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { box.style.display = "none"; }, 3200);
}

// Current date and time
function now() {
  return new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

// "In Progress" -> "InProgress" 
function statusClass(status) {
  return status.replace(" ", "");
}


/* 
   3. AUTH
   Registration, sign-in and sign-out for citizens and admins.

   */

/*  Screen: login / register / admin  */
function authHTML() {
  const isRegister = authMode === "register";
  const isAdmin    = authMode === "admin";
  const isFirstAdminSetup = isAdmin && !users.some((user) => user.role === "admin");
  const needsName = isRegister || isFirstAdminSetup;   // sign-up forms ask for a name

  const title =
    isRegister          ? "Create citizen account" :
    isFirstAdminSetup   ? "Create your admin account" :
    isAdmin             ? "Administrator sign in" :
                          "Citizen sign in";

  const buttonText =
    isRegister        ? "Register" :
    isFirstAdminSetup ? "Create admin account" :
                        "Sign in";

  const tabs = [["login", "Sign in"], ["register", "Register"], ["admin", "Admin"]]
    .map(([mode, label]) => `
      <button class="${authMode === mode ? "on" : ""}"
              onclick="authMode='${mode}'; render()">${label}</button>`)
    .join("");

  return `
    <div class="card auth">
      <h2>${title}</h2>
      <p class="mu">Report county issues and track them until they are resolved.</p>

      <div class="tabs">${tabs}</div>

      <form onsubmit="handleAuth(event)">
        ${isFirstAdminSetup ? `
          <p class="mu">No administrator exists yet. The first account you create here becomes the administrator.</p>` : ""}

        ${needsName ? `
          <label>Full name</label>
          <input id="authName" required minlength="3" autocomplete="name">` : ""}

        <label>${isAdmin ? "Admin username or email" : "National ID or email"}</label>
        <input id="authId" required autocomplete="username">

        <label>Password</label>
        <input id="authPassword" type="password" required
               minlength="${needsName ? 8 : 1}"
               autocomplete="${needsName ? "new-password" : "current-password"}">
        ${needsName ? `<p class="mu">At least 8 characters.</p>` : ""}

        <button class="pri full">${buttonText}</button>
      </form>
    </div>`;
}

/*  Form handler  */
async function handleAuth(event) {
  event.preventDefault();

  const id           = $("authId").value.trim().toLowerCase();
  const passwordHash = await hashPassword($("authPassword").value);
  const adminExists  = users.some((user) => user.role === "admin");

  // Sign-up happens on the Register tab, or on the Admin tab when no admin exists yet
  const isSignUp = authMode === "register" || (authMode === "admin" && !adminExists);

  if (isSignUp) {
    if (users.some((user) => user.id === id)) {
      return toast("That ID or email is already registered.");
    }

    const newUser = {
      id: id,
      name: $("authName").value.trim(),
      role: authMode === "admin" ? "admin" : "citizen",
      passwordHash: passwordHash
    };

    users.push(newUser);
    save("ecitizen.users", users);
    toast("Account created. Welcome!");
    startSession(newUser);
    return;
  }

  // Otherwise this is a sign-in: the role must match the tab (admin vs citizen)
  const wantsAdmin = authMode === "admin";
  const account = users.find((user) =>
    user.id === id &&
    user.passwordHash === passwordHash &&
    (user.role === "admin") === wantsAdmin
  );

  if (!account) {
    return toast("Wrong credentials" + (wantsAdmin ? " or not an admin account." : "."));
  }

  startSession(account);
}

/*  Session  */
function startSession(user) {
  currentUser = { id: user.id, name: user.name, role: user.role };
  save("ecitizen.session", currentUser);
  render();
}

function logout() {
  currentUser = null;
  localStorage.removeItem("ecitizen.session");
  authMode = "login";
  render();
}


/* 
   4. CITIZEN
    */

/*  Screen: citizen dashboard */
function citizenHTML() {
  const myRequests = requests.filter((request) => request.userId === currentUser.id);

  const categoryOptions = Object.entries(CATEGORIES)
    .map(([name, icon]) => `<option>${icon} ${name}</option>`)
    .join("");

  const subCountyOptions = SUB_COUNTIES
    .map((name) => `<option>${name}</option>`)
    .join("");

  const requestList = myRequests.length
    ? myRequests.map((request) => requestCardHTML(request)).join("")
    : `<div class="empty">No requests yet. Use the form to report your first issue.</div>`;

  return `
    <div class="grid">

      <!-- Left: new request form -->
      <form class="card" style="align-self:start" onsubmit="handleSubmitRequest(event)">
        <h3>Submit a service request</h3>

        <label>Category</label>
        <select id="reqCategory" required>
          <option value="">Select category</option>
          ${categoryOptions}
        </select>

        <label>Sub-county</label>
        <select id="reqSubCounty" required>
          <option value="">Select sub-county</option>
          ${subCountyOptions}
        </select>

        <label>Exact location / landmark</label>
        <input id="reqLocation" required placeholder="e.g. Near Kangari market stage">

        <label>Priority</label>
        <select id="reqPriority">
          <option>Normal</option>
          <option>Urgent</option>
        </select>

        <label>Description</label>
        <textarea id="reqDescription" rows="3" required minlength="10" maxlength="500"
                  placeholder="Describe the issue"></textarea>

        <label>Photo (optional)</label>
        <input id="reqPhoto" type="file" accept="image/*">

        <button class="pri full">Submit request</button>
      </form>

      <!-- Right: this citizen's requests -->
      <div class="card">
        <h3>My requests <span class="pill Resolved">${myRequests.length}</span></h3>
        ${requestList}
      </div>

    </div>`;
}

/*  Component: one request card (used by citizen AND admin)  */
function requestCardHTML(request, isAdminView = false) {
  const urgentBadge = request.priority === "Urgent"
    ? `<span class="pill urg">Urgent</span>`
    : "";

  const photo = request.image
    ? `<img src="${request.image}" alt="Evidence photo">`
    : "";

  // Status history: one line per status change
  const timeline = request.history.map((entry) => `
    <div>● ${esc(entry.at)} · <b>${esc(entry.status)}</b>${entry.note ? " — " + esc(entry.note) : ""}</div>`
  ).join("");

  // Admin-only controls: change status, write a response, delete
  const adminControls = isAdminView ? `
    <div class="row" style="margin-top:10px">
      <select id="status-${request.id}">
        ${STATUSES.map((status) =>
          `<option ${status === request.status ? "selected" : ""}>${status}</option>`).join("")}
      </select>
      <input id="note-${request.id}" maxlength="200" placeholder="Response to citizen (optional)">
      <button class="pri" onclick="updateRequestStatus('${request.id}')">Save</button>
      <button class="gh"  onclick="deleteRequest('${request.id}')">Delete</button>
    </div>` : "";

  return `
    <div class="req">
      <header>
        <b>${esc(request.category)}</b>
        <span>
          <span class="pill ${statusClass(request.status)}">${request.status}</span>
          ${urgentBadge}
        </span>
      </header>

      <div class="mu">
        ${esc(request.id)} · ${esc(request.subCounty)} · ${esc(request.location)}
        ${isAdminView ? " · by " + esc(request.userName) : ""}
      </div>

      <p style="margin:8px 0 0">${esc(request.description)}</p>
      ${photo}

      <div class="tl">${timeline}</div>
      ${adminControls}
    </div>`;
}

/*  Photo compression  */

function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const scale  = Math.min(1, 800 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width  = image.width * scale;
        canvas.height = image.height * scale;
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };

      image.onerror = () => resolve(null);
      image.src = reader.result;
    };

    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/*  Form handler: submit a new request  */
async function handleSubmitRequest(event) {
  event.preventDefault();

  const photoFile = $("reqPhoto").files[0];
  const image = photoFile ? await compressImage(photoFile) : null;

  const newRequest = {
    id: "REQ-" + Date.now().toString(36).toUpperCase().slice(-6),  // e.g. REQ-1A2B3C
    category: $("reqCategory").value,
    subCounty: $("reqSubCounty").value,
    location: $("reqLocation").value.trim(),
    priority: $("reqPriority").value,
    description: $("reqDescription").value.trim(),
    image: image,
    status: "Pending",
    userId: currentUser.id,
    userName: currentUser.name,
    history: [{ status: "Pending", at: now(), note: "Request received" }]
  };

  requests.unshift(newRequest);   // newest first

  if (!save("ecitizen.requests", requests)) {
    requests.shift();             // undo if storage failed
    return;
  }

  toast("Submitted. Your reference is " + newRequest.id);
  render();
}


/* 
   5. ADMIN
    */

/* Analytics */
function countByStatus(status) {
  return requests.filter((request) => request.status === status).length;
}

// Four summary cards: total, pending, in progress, resolved
function statsHTML() {
  const cards = [
    { label: "Total",       value: requests.length,                color: "" },
    { label: "Pending",     value: countByStatus("Pending"),       color: "var(--pend)" },
    { label: "In Progress", value: countByStatus("In Progress"),   color: "var(--prog)" },
    { label: "Resolved",    value: countByStatus("Resolved"),      color: "var(--done)" }
  ];

  return `<div class="stats">` + cards.map((card) => `
    <div class="card stat">
      <span class="mu">${card.label}</span>
      <b style="color:${card.color}">${card.value}</b>
    </div>`).join("") + `</div>`;
}

// Bar chart of cases per category, plus open vs resolved summary
function categoryChartHTML() {
  const countsByCategory = {};
  requests.forEach((request) => {
    countsByCategory[request.category] = (countsByCategory[request.category] || 0) + 1;
  });

  const biggest = Math.max(1, ...Object.values(countsByCategory));

  const bars = Object.keys(countsByCategory).length
    ? Object.entries(countsByCategory).map(([name, count]) => `
        <div>
          <span>${esc(name)}</span>
          <i style="width:${(count / biggest) * 60}%"></i>
          ${count}
        </div>`).join("")
    : `<span class="mu">No data yet.</span>`;

  const resolved = countByStatus("Resolved");
  const open     = requests.length - resolved;
  const rate     = requests.length ? Math.round((resolved / requests.length) * 100) : 0;

  const summary = requests.length
    ? `<p class="mu" style="margin:12px 0 0">
         Open cases: <b>${open}</b> · Resolved: <b>${resolved}</b> · Resolution rate: <b>${rate}%</b>
       </p>`
    : "";

  return `
    <div class="card" style="margin-bottom:20px">
      <h3>Cases by category</h3>
      <div class="bars">${bars}</div>
      ${summary}
    </div>`;
}

/*  Administrator management  */
function adminPanelHTML() {
  const admins = users.filter((user) => user.role === "admin");
  const adminNames = admins.map((admin) => `${esc(admin.name)} (${esc(admin.id)})`).join(" · ");

  return `
    <details class="card" style="margin-bottom:20px">
      <summary style="cursor:pointer; font-weight:700">Administrators (${admins.length})</summary>
      <p class="mu">${adminNames}</p>

      <form onsubmit="handleAddAdmin(event)">
        <div class="row">
          <input id="newAdminName" required minlength="3" placeholder="Full name">
          <input id="newAdminId" required placeholder="Username or email">
          <input id="newAdminPassword" type="password" required minlength="8"
                 placeholder="Password (8+ characters)">
          <button class="pri">Add admin</button>
        </div>
      </form>
    </details>`;
}

async function handleAddAdmin(event) {
  event.preventDefault();

  const id = $("newAdminId").value.trim().toLowerCase();

  if (users.some((user) => user.id === id)) {
    return toast("That username is already taken.");
  }

  users.push({
    id: id,
    name: $("newAdminName").value.trim(),
    role: "admin",
    passwordHash: await hashPassword($("newAdminPassword").value)
  });

  save("ecitizen.users", users);
  toast("Administrator added");
  render();
}

/*  Request list (filter, search, sort)  */

function filteredRequests() {
  const search = filters.search.toLowerCase();

  return requests
    .filter((request) => {
      const matchesStatus = !filters.status || request.status === filters.status;
      const text = (request.category + request.subCounty + request.location +
                    request.id + request.userName).toLowerCase();
      return matchesStatus && (!search || text.includes(search));
    })
    .sort((a, b) => (b.priority === "Urgent") - (a.priority === "Urgent"));
}

function requestListHTML() {
  const list = filteredRequests();

  const statusOptions = STATUSES
    .map((status) => `<option ${filters.status === status ? "selected" : ""}>${status}</option>`)
    .join("");

  const cards = list.length
    ? list.map((request) => requestCardHTML(request, true)).join("")
    : `<div class="empty">No matching requests.</div>`;

  return `
    <div class="card">
      <div class="row" style="margin-bottom:14px">
        <input id="searchInput" value="${esc(filters.search)}"
               placeholder="Search ref, category, location, citizen"
               oninput="filters.search = this.value; rerenderKeepingFocus('searchInput')">

        <select onchange="filters.status = this.value; render()">
          <option value="">All statuses</option>
          ${statusOptions}
        </select>

        <button class="gh" onclick="exportCSV()">Export CSV</button>
      </div>
      ${cards}
    </div>`;
}
function rerenderKeepingFocus(inputId) {
  const cursor = $(inputId).selectionStart;
  render();
  const input = $(inputId);
  input.focus();
  input.setSelectionRange(cursor, cursor);
}

/*  Screen: admin dashboard */
function adminHTML() {
  return statsHTML() + categoryChartHTML() + adminPanelHTML() + requestListHTML();
}

/*  Actions on a request */
function updateRequestStatus(id) {
  const request   = requests.find((item) => item.id === id);
  const newStatus = $("status-" + id).value;
  const note      = $("note-" + id).value.trim();

  if (!request) return;

  if (newStatus === request.status && !note) {
    return toast("Change the status or add a response first.");
  }

  request.status = newStatus;
  request.history.push({ status: newStatus, at: now(), note: note });

  save("ecitizen.requests", requests);
  toast(id + " updated");
  render();
}

function deleteRequest(id) {
  if (!confirm("Delete " + id + " permanently?")) return;

  requests = requests.filter((request) => request.id !== id);
  save("ecitizen.requests", requests);
  render();
}

/*  Export  */

function exportCSV() {
  const quote = (value) => '"' + String(value).replace(/"/g, '""') + '"';

  const rows = [
    ["Ref", "Category", "Sub-county", "Location", "Priority", "Status", "Citizen", "Description"],
    ...requests.map((r) => [r.id, r.category, r.subCounty, r.location,
                            r.priority, r.status, r.userName, r.description])
  ];

  const csv  = rows.map((row) => row.map(quote).join(",")).join("\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  link.download = "service-requests.csv";
  link.click();
}


/*
   6. APP
   */

function render() {
  // Header: show the user's name and the sign-out button when signed in
  $("who").textContent = currentUser ? `${currentUser.name} · ${currentUser.role}` : "";
  $("out").classList.toggle("hide", !currentUser);

  if (!currentUser) {
    $("app").innerHTML = authHTML();
  } else if (currentUser.role === "admin") {
    $("app").innerHTML = adminHTML();
  } else {
    $("app").innerHTML = citizenHTML();
  }
}
function init() {
  
  if (currentUser && !users.some((user) => user.id === currentUser.id)) {
    currentUser = null;
    localStorage.removeItem("ecitizen.session");
  }
  render();
}

init();