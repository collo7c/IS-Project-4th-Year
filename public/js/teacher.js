const user = requireSession("teacher");
document.getElementById("teacherName").textContent = user ? user.name : "";

let learners = [];
let indicators = [];
let subStrands = [];

async function init() {
  await Promise.all([loadLearners(), loadIndicators(), loadResources()]);
  updateNetBadge();
  updatePendingBadge();
  await loadRecords();
}

async function loadLearners() {
  learners = await API.get("/learners");
  const opts = learners.map((l) => `<option value="${l.LearnerID}">${l.Name} — ${l.GradeLevel}</option>`).join("");
  document.getElementById("fLearner").innerHTML = opts;
  document.getElementById("reportLearner").innerHTML = opts;
}

async function loadIndicators() {
  indicators = await API.get("/curriculum/indicators");
  document.getElementById("fIndicator").innerHTML = indicators
    .map((i) => `<option value="${i.IndicatorID}">${i.StrandName} \u203a ${i.SubStrandName}: ${i.Description}</option>`)
    .join("");

  const tree = await API.get("/curriculum/strands");
  subStrands = tree.flatMap((s) => s.subStrands.map((ss) => ({ ...ss, StrandName: s.Name })));
  document.getElementById("resSubStrand").innerHTML = subStrands
    .map((ss) => `<option value="${ss.SubStrandID}">${ss.StrandName} \u203a ${ss.Name}</option>`)
    .join("");
}

async function loadRecords() {
  const tbody = document.querySelector("#recordsTable tbody");
  let rows = [];
  try {
    const serverRecords = await API.get("/records");
    rows = serverRecords.map((r) => ({
      learner: r.LearnerName,
      indicator: r.IndicatorDescription,
      rubric: r.RubricLevel,
      notes: r.ObservationNotes,
      status: "synced",
    }));
  } catch (e) { /* offline: server list unavailable, fall through to pending-only view */ }

  const pending = OfflineQueue.all().map((r) => ({
    learner: (learners.find((l) => l.LearnerID === Number(r.learnerId)) || {}).Name || "—",
    indicator: (indicators.find((i) => i.IndicatorID === Number(r.indicatorId)) || {}).Description || "—",
    rubric: r.rubricLevel,
    notes: r.observationNotes,
    status: "pending",
  }));

  rows = [...pending, ...rows];
  tbody.innerHTML = rows
    .map(
      (r) => `<tr>
        <td>${r.learner}</td><td>${r.indicator}</td><td>${r.rubric}</td><td>${r.notes || ""}</td>
        <td><span class="tag ${r.status}">${r.status}</span></td>
      </tr>`
    )
    .join("") || `<tr><td colspan="5" class="hint">No records yet.</td></tr>`;
}

async function loadResources() {
  const tbody = document.querySelector("#resourceTable tbody");
  try {
    const resources = await API.get("/resources");
    localStorage.setItem("cbc_cached_resources", JSON.stringify(resources));
    render(resources);
  } catch (e) {
    // offline: fall back to the last cached list — use case "Access resource offline"
    const cached = JSON.parse(localStorage.getItem("cbc_cached_resources") || "[]");
    render(cached);
  }
  function render(resources) {
    tbody.innerHTML = resources
      .map((r) => `<tr><td>${r.Title}</td><td>${r.SubStrandName || ""}</td><td><a href="${r.FilePath}" target="_blank">open</a></td></tr>`)
      .join("") || `<tr><td colspan="3" class="hint">No resources yet.</td></tr>`;
  }
}

document.getElementById("recordForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const record = {
    learnerId: Number(document.getElementById("fLearner").value),
    indicatorId: Number(document.getElementById("fIndicator").value),
    rubricLevel: document.getElementById("fRubric").value,
    observationNotes: document.getElementById("fNotes").value,
  };
  const successEl = document.getElementById("recordSuccess");

  if (isOnline()) {
    try {
      await API.post("/records", record);
      successEl.textContent = "Saved and synced.";
    } catch (err) {
      // Server unreachable even though navigator says online — queue it anyway.
      OfflineQueue.add(record);
      successEl.textContent = "Server unreachable — saved offline, will sync later.";
    }
  } else {
    OfflineQueue.add(record);
    successEl.textContent = "You're offline — saved locally, will sync automatically later.";
  }

  successEl.classList.remove("hidden");
  e.target.reset();
  updatePendingBadge();
  await loadRecords();
  setTimeout(() => successEl.classList.add("hidden"), 4000);
});

document.getElementById("genReportBtn").addEventListener("click", async () => {
  const learnerId = document.getElementById("reportLearner").value;
  const out = document.getElementById("reportOutput");
  out.innerHTML = "Generating…";
  try {
    const report = await API.post(`/reports/generate/${learnerId}`);
    out.innerHTML = `<div class="success">${report.AttainmentSummary}</div>`;
  } catch (err) {
    out.innerHTML = `<div class="error">${err.message}</div>`;
  }
});

document.getElementById("uploadForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData();
  fd.append("title", document.getElementById("resTitle").value);
  fd.append("subStrandId", document.getElementById("resSubStrand").value);
  fd.append("file", document.getElementById("resFile").files[0]);
  try {
    await API.postForm("/resources", fd);
    e.target.reset();
    await loadResources();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById("syncBtn").addEventListener("click", async () => {
  const btn = document.getElementById("syncBtn");
  btn.disabled = true;
  btn.textContent = "Syncing…";
  try {
    const result = await syncPendingRecords();
    btn.textContent = result.synced > 0 ? `Synced ${result.synced}` : "Nothing to sync";
  } catch (err) {
    btn.textContent = "Sync failed";
  }
  updatePendingBadge();
  await loadRecords();
  setTimeout(() => { btn.textContent = "Sync now"; btn.disabled = false; }, 2000);
});

function updateNetBadge() {
  const badge = document.getElementById("netBadge");
  const online = isOnline();
  badge.textContent = online ? "Online" : "Offline";
  badge.className = "badge " + (online ? "online" : "offline");
}
function updatePendingBadge() {
  const badge = document.getElementById("pendingBadge");
  const count = OfflineQueue.count();
  badge.textContent = `${count} pending`;
  badge.classList.toggle("hidden", count === 0);
}
window.addEventListener("online", () => { updateNetBadge(); syncPendingRecords().then(() => { updatePendingBadge(); loadRecords(); }); });
window.addEventListener("offline", updateNetBadge);

init();
