import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  push,
  remove,
  get,
  onValue
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMhniu1SEmiIWoXzwJy6zVSOZkHELhfLc",
  authDomain: "family-sales.firebaseapp.com",
  databaseURL: "https://family-sales-default-rtdb.firebaseio.com",
  projectId: "family-sales",
  storageBucket: "family-sales.firebasestorage.app",
  messagingSenderId: "590845027956",
  appId: "1:590845027956:web:676df074fe6150e8d39321"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const HOTDOG_TOPPINGS = [
  "Mayo",
  "Mustard",
  "Ketchup",
  "Grilled Onions",
  "Pico de Gallo",
  "Hot Cheetos"
];

const FRY_TOPPINGS = [
  "Cheese",
  "Pico de Gallo",
  "Sour Cream",
  "Salsa Verde"
];

const ITEM_DEFS = {
  hotdog: { name: "Hotdog", price: 5, type: "hotdog" },
  combo: { name: "Ducky Combo", price: 8, type: "combo" },
  fries: { name: "Tray of Fries", price: 6, type: "plainFries" },
  asadaSmall: { name: "Asada Fries Small", price: 7, type: "asada" },
  asadaTray: { name: "Asada Fries Tray", price: 10, type: "asada" },
  cheetoFries: { name: "Cheeto Fries", price: 13, type: "cheetoAsada" }
};

const SCREENS = ["home", "build", "open", "handed", "stats"];

const state = {
  currentDate: "",
  allDays: {},
  openOrders: {},
  completedOrders: {},
  editingOrderId: null,
  draft: {
    customer: "",
    payment: "cash",
    items: []
  }
};

let openTimerInterval = null;
let handedTimerInterval = null;
let currentItemBuild = null;

// ---------- helpers ----------
function money(v) {
  return `$${Number(v || 0).toFixed(2)}`;
}

function todayLocalValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60000);
  return local.toISOString().split("T")[0];
}

function formatDateForDisplay(dateString) {
  if (!dateString) return "";
  const [year, month, day] = dateString.split("-");
  return `${month}/${day}/${year}`;
}

function formatSeconds(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function getDraftTotal() {
  return state.draft.items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);
}

function getCurrentDayNode() {
  return state.allDays[state.currentDate] || { openOrders: {}, completedOrders: {} };
}

function getOpenOrdersArray() {
  return Object.entries(getCurrentDayNode().openOrders || {}).map(([id, order]) => ({ id, ...order }));
}

function getCompletedOrdersArray() {
  return Object.entries(getCurrentDayNode().completedOrders || {}).map(([id, order]) => ({ id, ...order }));
}

function startOfWeek(dateString) {
  const d = new Date(`${dateString}T12:00:00`);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

function sameWeek(dateStringA, dateStringB) {
  const a = startOfWeek(dateStringA);
  const b = startOfWeek(dateStringB);
  return a.toDateString() === b.toDateString();
}

function buildItemCounts(orders) {
  const counts = {};
  orders.forEach(order => {
    (order.items || []).forEach(item => {
      counts[item.name] = (counts[item.name] || 0) + 1;
    });
  });
  return counts;
}

function topItemFromCounts(counts) {
  const entries = Object.entries(counts);
  if (!entries.length) return "—";
  entries.sort((a, b) => b[1] - a[1]);
  return `${entries[0][0]} (${entries[0][1]})`;
}

function avgTimeFromOrders(orders) {
  const finished = orders.filter(o => typeof o.serviceSeconds === "number");
  if (!finished.length) return "0:00";
  const total = finished.reduce((sum, o) => sum + o.serviceSeconds, 0);
  return formatSeconds(Math.round(total / finished.length));
}

function setActiveScreen(name) {
  SCREENS.forEach(screen => {
    document.getElementById(`screen-${screen}`).classList.toggle("active", screen === name);
  });
  if (name === "open") renderOpenOrders();
  if (name === "handed") renderHandedOut();
  if (name === "stats") renderStatsAndHistory();
}

async function ensureDayNode(date) {
  const dayRef = ref(db, `duckysTracker/days/${date}`);
  const snap = await get(dayRef);
  if (!snap.exists()) {
    await set(dayRef, {
      date,
      openOrders: {},
      completedOrders: {},
      orderCounter: 0
    });
  }
}

async function nextOrderNumber(date) {
  const dayNode = state.allDays[date] || {};
  const current = Number(dayNode.orderCounter || 0) + 1;
  await set(ref(db, `duckysTracker/days/${date}/orderCounter`), current);
  return current;
}

// ---------- rendering ----------
function renderDraft() {
  document.getElementById("orderCustomer").value = state.draft.customer;
  document.querySelectorAll(".pay-pill").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.payment === state.draft.payment);
  });

  const wrap = document.getElementById("draftItems");
  if (!state.draft.items.length) {
    wrap.className = "draft-items empty-state";
    wrap.textContent = "Add items to start the order.";
  } else {
    wrap.className = "draft-items";
    wrap.innerHTML = "";
    state.draft.items.forEach((item, index) => {
      const box = document.createElement("div");
      box.className = "draft-item";
      box.innerHTML = `
        <div class="draft-item-top">
          <span>${item.name}</span>
          <span>${money(item.lineTotal)}</span>
        </div>
        ${item.selected?.length ? `<div class="draft-item-sub">Toppings: ${item.selected.join(", ")}</div>` : ""}
        ${item.addons?.length ? `<div class="draft-item-sub">Add-ons: ${item.addons.join(", ")}</div>` : ""}
        ${item.note ? `<div class="draft-item-sub">Note: ${item.note}</div>` : ""}
        <div class="draft-item-actions">
          <button class="small-btn" data-edit-index="${index}" type="button">Edit</button>
          <button class="small-btn danger-btn" data-remove-index="${index}" type="button">Remove</button>
        </div>
      `;
      wrap.appendChild(box);
    });

    wrap.querySelectorAll("[data-remove-index]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.draft.items.splice(Number(btn.dataset.removeIndex), 1);
        renderDraft();
      });
    });

    wrap.querySelectorAll("[data-edit-index]").forEach(btn => {
      btn.addEventListener("click", () => {
        openItemBuilderFromExisting(Number(btn.dataset.editIndex));
      });
    });
  }

  document.getElementById("draftTotal").textContent = money(getDraftTotal());
}

function renderOpenOrders() {
  const wrap = document.getElementById("openOrdersList");
  const orders = getOpenOrdersArray().sort((a, b) => a.startedAt - b.startedAt);

  wrap.innerHTML = "";
  if (!orders.length) {
    wrap.innerHTML = `<div class="glass-card notice-card">No open orders right now.</div>`;
    return;
  }

  orders.forEach(order => {
    const box = document.createElement("div");
    box.className = "order-card";
    box.innerHTML = `
      <div class="order-card-head">
        <div>
          <div><strong>Order #${order.orderNumber}</strong></div>
          <div>${order.customer || "No customer name"}</div>
        </div>
        <div class="order-timer" data-started="${order.startedAt}">0:00</div>
      </div>

      <div class="order-meta">
        <div>Payment: <strong>${order.payment}</strong></div>
        <div>Total: <strong>${money(order.total)}</strong></div>
      </div>

      <div class="order-items">${renderItemsHtml(order.items)}</div>

      <div class="order-actions">
        <button class="order-action edit-btn" data-edit-order="${order.id}" type="button">Edit</button>
        <button class="order-action done-btn" data-done-order="${order.id}" type="button">Handed Out</button>
        <button class="order-action remove-btn" data-remove-order="${order.id}" type="button">Remove</button>
      </div>
    `;
    wrap.appendChild(box);
  });

  wrap.querySelectorAll("[data-edit-order]").forEach(btn => {
    btn.addEventListener("click", () => editOpenOrder(btn.dataset.editOrder));
  });

  wrap.querySelectorAll("[data-done-order]").forEach(btn => {
    btn.addEventListener("click", () => markOrderHandedOut(btn.dataset.doneOrder));
  });

  wrap.querySelectorAll("[data-remove-order]").forEach(btn => {
    btn.addEventListener("click", () => removeOpenOrder(btn.dataset.removeOrder));
  });

  refreshOpenOrderTimers();
}

function renderHandedOut() {
  const wrap = document.getElementById("handedOutList");
  const now = Date.now();
  const orders = getCompletedOrdersArray()
    .filter(order => now - (order.completedAt || 0) < 60000)
    .sort((a, b) => b.completedAt - a.completedAt);

  wrap.innerHTML = "";
  if (!orders.length) {
    wrap.innerHTML = `<div class="glass-card notice-card">No recently handed out orders.</div>`;
    return;
  }

  orders.forEach(order => {
    const box = document.createElement("div");
    box.className = "order-card";
    box.innerHTML = `
      <div class="order-card-head">
        <div>
          <div><strong>Order #${order.orderNumber}</strong></div>
          <div>${order.customer || "No customer name"}</div>
        </div>
        <div class="order-timer">${formatSeconds(order.serviceSeconds || 0)}</div>
      </div>
      <div class="order-meta">
        <div>Finished: <strong>${money(order.total)}</strong></div>
        <div>Payment: <strong>${order.payment}</strong></div>
      </div>
      <div class="order-items">${renderItemsHtml(order.items)}</div>
    `;
    wrap.appendChild(box);
  });
}

function renderItemsHtml(items = []) {
  let html = "<ul>";
  items.forEach(item => {
    html += `<li><strong>${item.name}</strong> — ${money(item.lineTotal)}`;
    if (item.selected?.length) html += `<br><small>Toppings: ${item.selected.join(", ")}</small>`;
    if (item.addons?.length) html += `<br><small>Add-ons: ${item.addons.join(", ")}</small>`;
    if (item.note) html += `<br><small>Note: ${item.note}</small>`;
    html += `</li>`;
  });
  html += "</ul>";
  return html;
}

function renderHomeSummary() {
  const completed = getCompletedOrdersArray();
  document.getElementById("homeOpenCount").textContent = String(getOpenOrdersArray().length);
  document.getElementById("homeCompletedCount").textContent = String(completed.length);
  document.getElementById("homeTodaySales").textContent = money(completed.reduce((s, o) => s + Number(o.total || 0), 0));
  document.getElementById("homeAvgTime").textContent = avgTimeFromOrders(completed);
}

function renderStatsAndHistory() {
  const currentDayOrders = getCompletedOrdersArray().sort((a, b) => b.completedAt - a.completedAt);
  const allDays = Object.values(state.allDays || {});
  const weeklyDays = allDays.filter(day => day.date && sameWeek(day.date, state.currentDate));

  const weeklyOrders = weeklyDays.flatMap(day =>
    Object.values(day.completedOrders || {})
  );

  const dailyCounts = buildItemCounts(currentDayOrders);
  const weeklyCounts = buildItemCounts(weeklyOrders);

  document.getElementById("dailySales").textContent = money(currentDayOrders.reduce((s, o) => s + Number(o.total || 0), 0));
  document.getElementById("dailyOrders").textContent = String(currentDayOrders.length);
  document.getElementById("dailyAvgTime").textContent = avgTimeFromOrders(currentDayOrders);
  document.getElementById("dailyTopItem").textContent = topItemFromCounts(dailyCounts);

  document.getElementById("weeklySales").textContent = money(weeklyOrders.reduce((s, o) => s + Number(o.total || 0), 0));
  document.getElementById("weeklyOrders").textContent = String(weeklyOrders.length);
  document.getElementById("weeklyAvgTime").textContent = avgTimeFromOrders(weeklyOrders);
  document.getElementById("weeklyTopItem").textContent = topItemFromCounts(weeklyCounts);

  renderCountsList("dailyItemCounts", dailyCounts);
  renderCountsList("weeklyItemCounts", weeklyCounts);
  renderDaysList();
}

function renderCountsList(id, counts) {
  const wrap = document.getElementById(id);
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (!entries.length) {
    wrap.innerHTML = `<div class="stats-list-row"><span>No data yet.</span><strong>0</strong></div>`;
    return;
  }
  wrap.innerHTML = "";
  entries.forEach(([name, count]) => {
    const row = document.createElement("div");
    row.className = "stats-list-row";
    row.innerHTML = `<span>${name}</span><strong>${count}</strong>`;
    wrap.appendChild(row);
  });
}

function renderDaysList() {
  const wrap = document.getElementById("daysList");
  const days = Object.values(state.allDays || {}).sort((a, b) => (a.date < b.date ? 1 : -1));

  if (!days.length) {
    wrap.innerHTML = `<div class="day-row"><span>No saved days yet.</span></div>`;
    return;
  }

  wrap.innerHTML = "";
  days.forEach(day => {
    const completed = Object.values(day.completedOrders || {});
    const row = document.createElement("div");
    row.className = "day-row";
    row.innerHTML = `
      <span>${formatDateForDisplay(day.date)}</span>
      <span>${money(completed.reduce((s, o) => s + Number(o.total || 0), 0))}</span>
    `;
    row.addEventListener("click", () => openDayDetails(day));
    wrap.appendChild(row);
  });
}

function openDayDetails(day) {
  document.getElementById("dayModalTitle").textContent = `Day Details - ${formatDateForDisplay(day.date)}`;
  const completed = Object.values(day.completedOrders || {}).sort((a, b) => b.completedAt - a.completedAt);

  const counts = buildItemCounts(completed);
  document.getElementById("dayModalSummary").innerHTML = `
    <div class="stats-list-row"><span>Sales</span><strong>${money(completed.reduce((s, o) => s + Number(o.total || 0), 0))}</strong></div>
    <div class="stats-list-row"><span>Orders</span><strong>${completed.length}</strong></div>
    <div class="stats-list-row"><span>Avg Time</span><strong>${avgTimeFromOrders(completed)}</strong></div>
    <div class="stats-list-row"><span>Top Item</span><strong>${topItemFromCounts(counts)}</strong></div>
  `;

  const wrap = document.getElementById("dayModalOrders");
  if (!completed.length) {
    wrap.innerHTML = `<div class="day-order-card">No completed orders on this day.</div>`;
  } else {
    wrap.innerHTML = "";
    completed.forEach(order => {
      const card = document.createElement("div");
      card.className = "day-order-card";
      card.innerHTML = `
        <div class="day-order-head">
          <div><strong>Order #${order.orderNumber}</strong> ${order.customer ? `— ${order.customer}` : ""}</div>
          <div><strong>${money(order.total)}</strong></div>
        </div>
        <div class="draft-item-sub">Payment: ${order.payment}</div>
        <div class="draft-item-sub">Service Time: ${formatSeconds(order.serviceSeconds || 0)}</div>
        <div class="day-order-items">${renderItemsHtml(order.items)}</div>
      `;
      wrap.appendChild(card);
    });
  }

  document.getElementById("dayModal").classList.remove("hidden");
}

function refreshOpenOrderTimers() {
  const timers = document.querySelectorAll("[data-started]");
  const now = Date.now();
  timers.forEach(el => {
    const started = Number(el.dataset.started || 0);
    const seconds = Math.max(0, Math.floor((now - started) / 1000));
    el.textContent = formatSeconds(seconds);
  });
}

// ---------- item builder ----------
function openItemBuilder(itemKey) {
  const def = ITEM_DEFS[itemKey];
  if (!def) return;

  currentItemBuild = {
    editIndex: null,
    key: itemKey,
    name: def.name,
    basePrice: def.price,
    type: def.type,
    selected: [],
    addons: [],
    note: ""
  };

  renderItemBuilder();
}

function openItemBuilderFromExisting(index) {
  const item = state.draft.items[index];
  currentItemBuild = {
    editIndex: index,
    key: null,
    name: item.name,
    basePrice: item.basePrice,
    type: item.type,
    selected: [...(item.selected || [])],
    addons: [...(item.addons || [])],
    note: item.note || ""
  };
  renderItemBuilder();
}

function itemBuildTotal(build) {
  let total = Number(build.basePrice || 0);
  if (build.addons.includes("Extra Meat")) total += 3;
  if (build.addons.includes("Double Meat")) total += 5;
  return total;
}

function renderItemBuilder() {
  const build = currentItemBuild;
  if (!build) return;

  document.getElementById("itemModalTitle").textContent = build.name;
  const body = document.getElementById("itemModalBody");

  let toppingOptions = [];
  let addonOptions = [];

  if (build.type === "hotdog" || build.type === "combo") {
    toppingOptions = HOTDOG_TOPPINGS;
  }
  if (build.type === "asada" || build.type === "cheetoAsada") {
    toppingOptions = [...FRY_TOPPINGS];
    addonOptions = ["Extra Meat", "Double Meat"];
  }

  body.innerHTML = `
    ${toppingOptions.length ? `
      <div class="field">
        <label>Toppings</label>
        <div class="option-grid" id="toppingsGrid"></div>
      </div>
    ` : ""}
    ${addonOptions.length ? `
      <div class="field">
        <label>Add-ons</label>
        <div class="option-grid" id="addonsGrid"></div>
      </div>
    ` : ""}
    <div class="field">
      <label>Notes</label>
      <textarea id="itemNote" rows="3" placeholder="Extra details for this item"></textarea>
    </div>
    <div class="inline-total">Item Total: <strong id="itemBuildTotal">${money(itemBuildTotal(build))}</strong></div>
  `;

  if (toppingOptions.length) {
    const grid = document.getElementById("toppingsGrid");
    toppingOptions.forEach(name => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "check-btn";
      btn.textContent = name;
      if (build.selected.includes(name)) btn.classList.add("active");
      btn.addEventListener("click", () => {
        const has = build.selected.includes(name);
        if (has) {
          build.selected = build.selected.filter(x => x !== name);
          btn.classList.remove("active");
        } else {
          build.selected.push(name);
          btn.classList.add("active");
        }
      });
      grid.appendChild(btn);
    });
  }

  if (addonOptions.length) {
    const grid = document.getElementById("addonsGrid");
    addonOptions.forEach(name => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "check-btn";
      btn.textContent = name + (name === "Extra Meat" ? " +$3" : " +$5");
      if (build.addons.includes(name)) btn.classList.add("active");
      btn.addEventListener("click", () => {
        const has = build.addons.includes(name);
        if (has) {
          build.addons = build.addons.filter(x => x !== name);
          btn.classList.remove("active");
        } else {
          build.addons.push(name);
          btn.classList.add("active");
        }
        document.getElementById("itemBuildTotal").textContent = money(itemBuildTotal(build));
      });
      grid.appendChild(btn);
    });
  }

  document.getElementById("itemNote").value = build.note || "";
  document.getElementById("itemModal").classList.remove("hidden");
}

function saveBuiltItemToDraft() {
  if (!currentItemBuild) return;
  currentItemBuild.note = document.getElementById("itemNote")?.value?.trim() || "";
  const builtItem = {
    key: currentItemBuild.key,
    name: currentItemBuild.name,
    type: currentItemBuild.type,
    basePrice: currentItemBuild.basePrice,
    selected: [...currentItemBuild.selected],
    addons: [...currentItemBuild.addons],
    note: currentItemBuild.note,
    lineTotal: itemBuildTotal(currentItemBuild)
  };

  if (currentItemBuild.editIndex === null) {
    state.draft.items.push(builtItem);
  } else {
    state.draft.items[currentItemBuild.editIndex] = builtItem;
  }

  currentItemBuild = null;
  document.getElementById("itemModal").classList.add("hidden");
  renderDraft();
}

// ---------- orders ----------
async function sendDraftToOpenOrders() {
  if (!state.draft.items.length) {
    alert("Add at least one item first.");
    return;
  }

  const date = state.currentDate;
  await ensureDayNode(date);

  const orderNumber = state.editingOrderId
    ? (getCurrentDayNode().openOrders?.[state.editingOrderId]?.orderNumber || await nextOrderNumber(date))
    : await nextOrderNumber(date);

  const payload = {
    orderNumber,
    customer: state.draft.customer.trim(),
    payment: state.draft.payment,
    items: state.draft.items,
    total: Number(getDraftTotal().toFixed(2)),
    startedAt: Date.now(),
    createdAt: Date.now()
  };

  if (state.editingOrderId) {
    await set(ref(db, `duckysTracker/days/${date}/openOrders/${state.editingOrderId}`), payload);
  } else {
    const newRef = push(ref(db, `duckysTracker/days/${date}/openOrders`));
    await set(newRef, payload);
  }

  resetDraft();
  setActiveScreen("open");
}

async function markOrderHandedOut(orderId) {
  const order = getCurrentDayNode().openOrders?.[orderId];
  if (!order) return;

  const completedAt = Date.now();
  const serviceSeconds = Math.max(0, Math.floor((completedAt - Number(order.startedAt || completedAt)) / 1000));

  await set(ref(db, `duckysTracker/days/${state.currentDate}/completedOrders/${orderId}`), {
    ...order,
    completedAt,
    serviceSeconds
  });

  await remove(ref(db, `duckysTracker/days/${state.currentDate}/openOrders/${orderId}`));
}

async function removeOpenOrder(orderId) {
  const yes = confirm("Remove this order?");
  if (!yes) return;
  await remove(ref(db, `duckysTracker/days/${state.currentDate}/openOrders/${orderId}`));
}

async function editOpenOrder(orderId) {
  const order = getCurrentDayNode().openOrders?.[orderId];
  if (!order) return;

  state.editingOrderId = orderId;
  state.draft.customer = order.customer || "";
  state.draft.payment = order.payment || "cash";
  state.draft.items = JSON.parse(JSON.stringify(order.items || []));

  await remove(ref(db, `duckysTracker/days/${state.currentDate}/openOrders/${orderId}`));

  renderDraft();
  setActiveScreen("build");
}

function resetDraft() {
  state.editingOrderId = null;
  state.draft = {
    customer: "",
    payment: "cash",
    items: []
  };
  renderDraft();
}

// ---------- firebase watch ----------
function bindDayWatcher() {
  onValue(ref(db, "duckysTracker/days"), snapshot => {
    state.allDays = snapshot.val() || {};
    state.openOrders = getCurrentDayNode().openOrders || {};
    state.completedOrders = getCurrentDayNode().completedOrders || {};
    renderHomeSummary();
    renderOpenOrders();
    renderHandedOut();
    renderStatsAndHistory();
  });
}

// ---------- events ----------
function bindEvents() {
  document.querySelectorAll("[data-go]").forEach(btn => {
    btn.addEventListener("click", () => setActiveScreen(btn.dataset.go));
  });

  document.getElementById("workDate").addEventListener("change", async (e) => {
    state.currentDate = e.target.value;
    await ensureDayNode(state.currentDate);
    renderHomeSummary();
    renderOpenOrders();
    renderHandedOut();
    renderStatsAndHistory();
  });

  document.querySelectorAll(".item-btn").forEach(btn => {
    btn.addEventListener("click", () => openItemBuilder(btn.dataset.item));
  });

  document.querySelectorAll(".pay-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      state.draft.payment = btn.dataset.payment;
      renderDraft();
    });
  });

  document.getElementById("orderCustomer").addEventListener("input", e => {
    state.draft.customer = e.target.value;
  });

  document.getElementById("clearDraftBtn").addEventListener("click", resetDraft);
  document.getElementById("sendOrderBtn").addEventListener("click", sendDraftToOpenOrders);

  document.getElementById("closeItemModalBtn").addEventListener("click", () => {
    currentItemBuild = null;
    document.getElementById("itemModal").classList.add("hidden");
  });
  document.getElementById("itemModalSaveBtn").addEventListener("click", saveBuiltItemToDraft);

  document.getElementById("closeDayModalBtn").addEventListener("click", () => {
    document.getElementById("dayModal").classList.add("hidden");
  });

  document.getElementById("saveDayBtn").addEventListener("click", async () => {
    await ensureDayNode(state.currentDate);
    alert(`Day ${formatDateForDisplay(state.currentDate)} is already being saved live. Use Stats / History to review it.`);
  });

  document.getElementById("viewDaysBtn").addEventListener("click", () => setActiveScreen("stats"));
  document.getElementById("refreshHistoryBtn").addEventListener("click", renderStatsAndHistory);

  document.getElementById("tipsInput").addEventListener("input", async e => {
    await ensureDayNode(state.currentDate);
    const tips = Number(e.target.value || 0);
    await set(ref(db, `duckysTracker/days/${state.currentDate}/tips`), tips);
  });

  document.getElementById("itemModal").addEventListener("click", e => {
    if (e.target.id === "itemModal") {
      currentItemBuild = null;
      document.getElementById("itemModal").classList.add("hidden");
    }
  });

  document.getElementById("dayModal").addEventListener("click", e => {
    if (e.target.id === "dayModal") {
      document.getElementById("dayModal").classList.add("hidden");
    }
  });
}

// ---------- live intervals ----------
function startLiveIntervals() {
  if (openTimerInterval) clearInterval(openTimerInterval);
  if (handedTimerInterval) clearInterval(handedTimerInterval);

  openTimerInterval = setInterval(() => {
    refreshOpenOrderTimers();
  }, 1000);

  handedTimerInterval = setInterval(() => {
    renderHandedOut();
  }, 1000);
}

// ---------- stats extras ----------
function syncTipsFromDay() {
  const tips = Number(state.allDays?.[state.currentDate]?.tips || 0);
  document.getElementById("tipsInput").value = tips ? String(tips) : "";
}

// ---------- init ----------
async function init() {
  state.currentDate = todayLocalValue();
  document.getElementById("workDate").value = state.currentDate;
  await ensureDayNode(state.currentDate);

  bindEvents();
  bindDayWatcher();
  renderDraft();
  startLiveIntervals();

  onValue(ref(db, `duckysTracker/days/${state.currentDate}/tips`), snapshot => {
    document.getElementById("tipsInput").value = snapshot.exists() ? String(snapshot.val()) : "";
  });
}

init();
