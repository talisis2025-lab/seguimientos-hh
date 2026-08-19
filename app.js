const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const appConfig = window.APP_CONFIG || {};
const APP_TIME_ZONE = appConfig.TIME_ZONE || "America/Mexico_City";
const state = {
  leads: [],
  apiUrl: appConfig.API_URL || localStorage.getItem("prospectos_multi_api_url") || "",
  token: sessionStorage.getItem("prospectos_multi_session") || "",
  user: null,
  loginEmail: ""
};

const fmtDay = new Intl.DateTimeFormat("es-MX", { timeZone: APP_TIME_ZONE, weekday: "long", day: "numeric", month: "long" });
const fmtShort = new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", day: "2-digit", month: "short", year: "numeric" });
const zoneDateParts = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
const dateKeyInAppZone = (date = new Date()) => {
  const parts = Object.fromEntries(zoneDateParts.formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const dateKeyOf = value => {
  const text = String(value || "").trim();
  const calendarDate = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (calendarDate) return calendarDate[1];
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? "" : dateKeyInAppZone(date);
};
const calendarDate = value => { const key = dateKeyOf(value); if (!key) return null; const [year, month, day] = key.split("-").map(Number); return new Date(Date.UTC(year, month - 1, day, 12)); };
const formatDate = value => { const date = calendarDate(value); return date ? fmtShort.format(date) : "Sin fecha"; };
const isSunday = value => { const date = calendarDate(value); return Boolean(date) && date.getUTCDay() === 0; };
const daysSince = value => {
  const start = calendarDate(value);
  const end = calendarDate(dateKeyInAppZone());
  if (!start || !end || start >= end) return 0;
  let days = 0;
  for (let cursor = start.getTime() + 86400000; cursor <= end.getTime(); cursor += 86400000) if (new Date(cursor).getUTCDay() !== 0) days++;
  return days;
};
const timeValueOf = value => { const match = String(value || "").match(/(?:T|^)(\d{1,2}):(\d{2})/); return match ? `${match[1].padStart(2, "0")}:${match[2]}` : ""; };
const formatTime = value => { const time = timeValueOf(value); return time ? `${time} h` : "Hora por definir"; };
const scheduleOf = lead => lead.nextContact ? `${formatDate(lead.nextContact)}${lead.nextContactTime ? ` · ${formatTime(lead.nextContactTime)}` : ""}${lead.contactMethod ? ` · ${lead.contactMethod}` : ""}` : "Sin programar";

function statusOf(lead) {
  const nextContact = String(lead.nextContact || "").slice(0, 10);
  const today = dateKeyInAppZone();
  if (nextContact === today) return { key: "today", label: "Contacto hoy" };
  if (nextContact && nextContact < today) {
    const overdue = daysSince(nextContact);
    return { key: "urgent", label: overdue === 1 ? "Cita vencida · 1 día" : `Cita vencida · ${overdue} días` };
  }
  const days = daysSince(lead.lastContact || lead.contactDate || lead.createdAt);
  if (days <= 2) return { key: "ontime", label: "ON time" };
  if (days === 3) return { key: "late", label: "3 días" };
  return { key: "urgent", label: `${days} días` };
}

function api(action, payload = {}, isPublic = false) {
  if (!state.apiUrl) return Promise.reject(new Error("Primero configura la conexión con Google Sheets."));
  const data = { ...payload };
  if (!isPublic) {
    if (!state.token) return Promise.reject(authError("Tu sesión terminó. Solicita un código nuevo."));
    data.sessionToken = state.token;
  }
  return new Promise((resolve, reject) => {
    const callback = `prospectosCallback_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const script = document.createElement("script");
    const timer = setTimeout(() => finish(new Error("Google Sheets tardó demasiado en responder.")), 20000);
    const finish = (error, response) => {
      clearTimeout(timer);
      delete window[callback];
      script.remove();
      if (error) return reject(error);
      if (!response?.ok) {
        const apiError = new Error(response?.error || "Ocurrió un error en Google Sheets.");
        apiError.code = response?.code || "";
        if (apiError.code === "AUTH_REQUIRED") endSession(false);
        return reject(apiError);
      }
      resolve(response);
    };
    window[callback] = response => finish(null, response);
    script.onerror = () => finish(new Error("No fue posible conectar con Apps Script. Revisa la implementación."));
    const separator = state.apiUrl.includes("?") ? "&" : "?";
    const params = new URLSearchParams({ action, callback, data: JSON.stringify(data), _: Date.now() });
    script.src = `${state.apiUrl}${separator}${params.toString()}`;
    document.head.appendChild(script);
  });
}

function authError(message) { const error = new Error(message); error.code = "AUTH_REQUIRED"; return error; }
function escapeHtml(value = "") { return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]); }
function showToast(message, error = false) { const toast = $("#toast"); toast.textContent = message; toast.className = `toast show${error ? " error" : ""}`; clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.className = "toast", 4000); }

function showAuth() {
  $("#appShell").hidden = true;
  $("#authView").hidden = false;
  $("#requestCodeForm").hidden = false;
  $("#verifyCodeForm").hidden = true;
  $("#loginEmail").value = localStorage.getItem("prospectos_multi_last_email") || state.loginEmail || "";
  $("#loginCode").value = "";
}

function showApp(user) {
  state.user = user;
  $("#authView").hidden = true;
  $("#appShell").hidden = false;
  $("#currentUserName").textContent = user.name;
  $("#currentUserEmail").textContent = `${user.email}${user.isAdmin ? " · Administrador" : ""}`;
  $("#formOwner").textContent = user.name;
  $("#adminNotice").hidden = !user.isAdmin;
  $("#followupSubtitle").textContent = user.isAdmin ? "Supervisa los seguimientos de todo el equipo." : "Solamente tú puedes ver estos prospectos.";
  loadLeads();
}

function endSession(showMessage = true) {
  state.token = "";
  state.user = null;
  state.leads = [];
  sessionStorage.removeItem("prospectos_multi_session");
  showAuth();
  if (showMessage) showToast("Sesión cerrada correctamente.");
}

async function bootstrap() {
  $("#contactDate").value = dateKeyInAppZone();
  $("#todayLabel").textContent = fmtDay.format(new Date());
  syncScheduleFields();
  if (!state.apiUrl || !state.token) { showAuth(); return; }
  try {
    const response = await api("me");
    showApp(response.user);
  } catch (error) {
    endSession(false);
    if (error.code !== "AUTH_REQUIRED") showToast(error.message, true);
  }
}

async function loadLeads() {
  if (!state.user) return;
  $("#leadList").innerHTML = '<div class="loading">Sincronizando tus prospectos…</div>';
  try {
    state.leads = (await api("list")).leads || [];
    render();
  } catch (error) {
    showToast(error.message, true);
    if (state.user) $("#leadList").innerHTML = '<div class="empty"><strong>No se pudo sincronizar</strong>Revisa la conexión e inténtalo nuevamente.</div>';
  }
}

function render() {
  const query = $("#searchInput").value.trim().toLowerCase();
  const filter = $("#statusFilter").value;
  const counts = { ontime: 0, today: 0, late: 0, urgent: 0 };
  state.leads.forEach(lead => counts[statusOf(lead).key]++);
  $("#statOnTime").textContent = counts.ontime;
  $("#statToday").textContent = counts.today;
  $("#statLate").textContent = counts.late;
  $("#statUrgent").textContent = counts.urgent;
  $("#pendingBadge").textContent = counts.late + counts.urgent + counts.today;
  const order = { urgent: 0, late: 1, today: 2, ontime: 3 };
  const list = state.leads.filter(lead => {
    const status = statusOf(lead).key;
    const haystack = `${lead.name} ${lead.phone} ${lead.email} ${lead.program} ${lead.contactMethod} ${lead.nextContact} ${lead.ownerName} ${lead.ownerEmail}`.toLowerCase();
    return (!query || haystack.includes(query)) && (filter === "all" || status === filter);
  }).sort((a, b) => order[statusOf(a).key] - order[statusOf(b).key]);
  $("#leadList").innerHTML = list.length ? list.map(leadCard).join("") : '<div class="empty"><strong>No hay prospectos aquí</strong>Registra uno nuevo o cambia los filtros.</div>';
}

function leadCard(lead) {
  const status = statusOf(lead);
  const last = formatDate(lead.lastContact || lead.contactDate || lead.createdAt);
  const owner = state.user?.isAdmin ? `<span class="owner-pill">${escapeHtml(lead.ownerName || lead.ownerEmail || "Sin propietario")}</span>` : "";
  return `<article class="lead-card"><span class="status-bar ${status.key}"></span><div class="lead-main"><strong>${escapeHtml(lead.name)}</strong><small>${escapeHtml(lead.phone)} · ${escapeHtml(lead.email)}</small><span class="program-pill">${escapeHtml(lead.program)}</span>${owner}</div><div class="lead-data"><small>ÚLTIMO CONTACTO</small><strong>${escapeHtml(last)}</strong></div><div class="lead-data"><small>ESTATUS · PRÓXIMO CONTACTO</small><span class="status-pill ${status.key}">${escapeHtml(status.label)}</span><span class="schedule-detail">${escapeHtml(scheduleOf(lead))}</span></div><div class="lead-actions"><button class="contact-btn" data-touch="${escapeHtml(lead.id)}">✓ Contacté hoy</button><button class="edit-btn" data-edit="${escapeHtml(lead.id)}" aria-label="Editar prospecto" title="Editar">✎</button><button class="delete-btn" data-delete="${escapeHtml(lead.id)}" aria-label="Eliminar prospecto" title="Eliminar">×</button></div></article>`;
}

function openSettings() {
  $("#apiUrlInput").value = state.apiUrl;
  $("#connectionStatus").textContent = state.apiUrl ? "Conexión guardada en este navegador." : "Aún no hay una URL configurada.";
  $("#settingsDialog").showModal();
}

function openEdit(lead) {
  const form = $("#editForm");
  form.elements.id.value = lead.id || "";
  form.elements.program.value = lead.program || "Presencial";
  form.elements.contactDate.value = String(lead.contactDate || lead.lastContact || "").slice(0, 10);
  form.elements.lastContact.value = String(lead.lastContact || lead.contactDate || "").slice(0, 10);
  form.elements.name.value = lead.name || "";
  form.elements.phone.value = lead.phone || "";
  form.elements.email.value = lead.email || "";
  form.elements.nextContact.value = String(lead.nextContact || "").slice(0, 10);
  form.elements.nextContactTime.value = timeValueOf(lead.nextContactTime);
  form.elements.contactMethod.value = lead.contactMethod || "";
  syncEditScheduleFields();
  $("#editDialog").showModal();
}

function syncScheduleFields() {
  const date = $("#nextContact").value;
  const sunday = date && isSunday(date);
  $("#nextContact").setCustomValidity(sunday ? "El domingo no cuenta como día de seguimiento." : "");
  const enabled = Boolean(date) && !sunday;
  $("#nextContactTime").disabled = !enabled;
  $("#contactMethod").disabled = !enabled;
  if (!date) { $("#nextContactTime").value = ""; $("#contactMethod").value = ""; }
}

function syncEditScheduleFields() {
  const date = $("#editNextContact").value;
  const sunday = date && isSunday(date);
  $("#editNextContact").setCustomValidity(sunday ? "El domingo no cuenta como día de seguimiento." : "");
  const enabled = Boolean(date) && !sunday;
  $("#editNextContactTime").disabled = !enabled;
  $("#editContactMethod").disabled = !enabled;
  if (!date) { $("#editNextContactTime").value = ""; $("#editContactMethod").value = ""; }
}

$("#requestCodeForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const response = await api("requestCode", data, true);
    state.loginEmail = data.email.trim().toLowerCase();
    $("#requestCodeForm").hidden = true;
    $("#verifyCodeForm").hidden = false;
    $("#codeHelp").textContent = `Enviamos un código a ${response.maskedEmail}. Expira en 10 minutos.`;
    $("#loginCode").focus();
  } catch (error) {
    showToast(error.message, true);
    if (!state.apiUrl) openSettings();
  } finally { button.disabled = false; }
});

$("#verifyCodeForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const response = await api("verifyCode", { email: state.loginEmail, code: $("#loginCode").value.trim() }, true);
    state.token = response.sessionToken;
    sessionStorage.setItem("prospectos_multi_session", state.token);
    localStorage.setItem("prospectos_multi_last_email", state.loginEmail);
    showApp(response.user);
    showToast(`Bienvenido, ${response.user.name}.`);
  } catch (error) { showToast(error.message, true); }
  finally { button.disabled = false; }
});

$("#changeEmailBtn").addEventListener("click", showAuth);
$("#authSettingsBtn").addEventListener("click", openSettings);
$("#settingsBtn").addEventListener("click", openSettings);
$("#settingsClose").addEventListener("click", () => $("#settingsDialog").close());
$("#logoutBtn").addEventListener("click", async () => { try { await api("logout"); } catch (_) {} endSession(); });

$$('.tab').forEach(button => button.addEventListener('click', () => {
  $$('.tab').forEach(tab => tab.classList.toggle('active', tab === button));
  $$('.view').forEach(view => view.classList.remove('active'));
  $(`#${button.dataset.view}View`).classList.add('active');
  if (button.dataset.view === 'followups') loadLeads();
}));

$("#leadForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  const formElement = event.currentTarget;
  const lead = Object.fromEntries(new FormData(formElement));
  lead.id = crypto.randomUUID();
  try {
    await api("create", { lead });
    formElement.reset();
    formElement.querySelector('[name="program"][value="Presencial"]').checked = true;
    $("#contactDate").value = dateKeyInAppZone();
    syncScheduleFields();
    showToast("Prospecto registrado en tu cuenta.");
    await loadLeads();
    $$('.tab')[1].click();
  } catch (error) { showToast(error.message, true); }
  finally { button.disabled = false; }
});

$("#leadList").addEventListener("click", async event => {
  const touch = event.target.closest("[data-touch]");
  const edit = event.target.closest("[data-edit]");
  const remove = event.target.closest("[data-delete]");
  if (edit) {
    const lead = state.leads.find(item => String(item.id) === String(edit.dataset.edit));
    if (lead) openEdit(lead);
    return;
  }
  if (touch) {
    touch.disabled = true;
    try { await api("touch", { id: touch.dataset.touch }); await loadLeads(); showToast("Contacto actualizado a hoy."); }
    catch (error) { showToast(error.message, true); }
    finally { touch.disabled = false; }
  }
  if (remove && confirm("¿Eliminar este prospecto definitivamente?")) {
    try { await api("delete", { id: remove.dataset.delete }); await loadLeads(); showToast("Prospecto eliminado."); }
    catch (error) { showToast(error.message, true); }
  }
});

$("#editForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  const lead = Object.fromEntries(new FormData(event.currentTarget));
  try { await api("update", { lead }); $("#editDialog").close(); await loadLeads(); showToast("Cambios guardados correctamente."); }
  catch (error) { showToast(error.message, true); }
  finally { button.disabled = false; }
});

$("#editClose").addEventListener("click", () => $("#editDialog").close());
$("#editCancel").addEventListener("click", () => $("#editDialog").close());
$("#nextContact").addEventListener("change", syncScheduleFields);
$("#editNextContact").addEventListener("change", syncEditScheduleFields);
$("#refreshBtn").addEventListener("click", loadLeads);
$("#searchInput").addEventListener("input", render);
$("#statusFilter").addEventListener("change", render);

$("#settingsForm").addEventListener("submit", async event => {
  event.preventDefault();
  const url = $("#apiUrlInput").value.trim();
  if (!/^https:\/\/script\.google\.com\//.test(url)) { $("#connectionStatus").textContent = "Pega una URL válida de script.google.com."; return; }
  state.apiUrl = url;
  localStorage.setItem("prospectos_multi_api_url", url);
  $("#settingsDialog").close();
  showToast("Google Sheets conectado.");
  if (state.token) await bootstrap();
});

setInterval(() => { $("#contactDate").value ||= dateKeyInAppZone(); $("#todayLabel").textContent = fmtDay.format(new Date()); }, 60000);
bootstrap();
