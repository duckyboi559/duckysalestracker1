import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import {
  getDatabase,
  ref,
  push,
  set,
  remove,
  onValue,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "PASTE_YOURS",
  authDomain: "PASTE_YOURS",
  databaseURL: "PASTE_YOURS",
  projectId: "PASTE_YOURS",
  storageBucket: "PASTE_YOURS",
  messagingSenderId: "PASTE_YOURS",
  appId: "PASTE_YOURS"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const HOTDOG_CHOICES = ["Ketchup", "Mustard", "Mayo", "Grilled Onions", "Hot Cheetos"];
const FRIES_CHOICES = ["Sour Cream", "Salsa", "Pico de Gallo", "Duck Sauce", "Cheese"];
const FRIES_MEAT_CHOICES = ["Regular Meat", "Extra Meat +$3", "Double Meat +$5"];

let liveState = {
  meta: { nextOrderNumber: 1 },
  openOrders: {},
  paidOrders: {},
  handedOutOrders: {},
  days: {}
};

let draftItems = [];
let builder = { category: null, data: {} };
let editingDraftIndex = null;
let editingOpenOrderKey = null;
let selectedHistoryDay = null;

function formatMoney(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function escapeForSingleQuote(str) {
  return String(str).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function nowLabel() {
  return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayLabel() {
  return new Date().toLocaleDateString();
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function getCountsFromOrders(ordersObject) {
  const counts = {
    "Bacon Dog": 0,
    "Quack Attack": 0,
    "Asada Fries": 0,
    "Cheeto Fries": 0,
    "Small Fry Tray": 0,
    "Big Fry Tray": 0,
    "Bacon Dog + Fries Combo": 0
  };

  Object.values(ordersObject || {}).forEach(order => {
    (order.items || []).forEach(item => {
      if (item.kind === "baconDog") counts["Bacon Dog"] += item.quantity || 0;
      if (item.kind === "quackAttack") counts["Quack Attack"] += item.quantity || 0;
      if (item.kind === "asadaFries") counts["Asada Fries"] += item.quantity || 0;
      if (item.kind === "cheetoFries") counts["Cheeto Fries"] += item.quantity || 0;
      if (item.kind === "smallFryTray") counts["Small Fry Tray"] += item.quantity || 0;
      if (item.kind === "bigFryTray") counts["Big Fry Tray"] += item.quantity || 0;
      if (item.kind === "combo") counts["Bacon Dog + Fries Combo"] += item.quantity || 0;
    });
  });

  return counts;
}

function getTopSeller(counts) {
  let bestName = "—";
  let bestCount = 0;

  Object.entries(counts).forEach(([name, count]) => {
    if (count > bestCount) {
      bestName = `${name} (${count})`;
      bestCount = count;
    }
  });

  return bestCount === 0 ? "—" : bestName;
}

function totalsFromOrders(ordersObject) {
  const list = Object.values(ordersObject || {});
  let cash = 0;
  let cashApp = 0;
  let applePay = 0;
  let square = 0;

  list.forEach(order => {
    if (order.payment?.type === "cash") {
      cash += Number(order.payment.total || 0);
    }
    if (order.payment?.type === "digital") {
      if (order.payment.method === "Cash App") cashApp += Number(order.payment.total || 0);
      if (order.payment.method === "Apple Pay") applePay += Number(order.payment.total || 0);
      if (order.payment.method === "Square") square += Number(order.payment.total || 0);
    }
    if (order.payment?.type === "split") {
      cash += Number(order.payment.cashAmount || 0);
      if (order.payment.digitalMethod === "Cash App") cashApp += Number(order.payment.digitalAmount || 0);
      if (order.payment.digitalMethod === "Apple Pay") applePay += Number(order.payment.digitalAmount || 0);
      if (order.payment.digitalMethod === "Square") square += Number(order.payment.digitalAmount || 0);
    }
  });

  return {
    cash,
    cashApp,
    applePay,
    square,
    dayTotal: cash + cashApp + applePay + square
  };
}

function choiceButtons(items, key, isMulti = false) {
  return `
    <div class="choice-grid">
      ${items.map(item => {
        const selected = isMulti
          ? (Array.isArray(builder.data[key]) && builder.data[key].includes(item))
          : builder.data[key] === item;

        const safe = escapeForSingleQuote(item);
        const cls = selected
          ? `choice-btn selected ${isMulti ? "multi-selected" : ""}`
          : "choice-btn";

        const click = isMulti
          ? `toggleBuilderArray('${key}', '${safe}')`
          : `setBuilderValue('${key}', '${safe}')`;

        return `<button type="button" class="${cls}" onclick="${click}">${item}</button>`;
      }).join("")}
    </div>
  `;
}

function renderScreen() {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");

  document.getElementById("mainScreen").classList.toggle("hidden", view === "history");
  document.getElementById("historyScreen").classList.toggle("hidden", view !== "history");

  if (view === "history") {
    const day = params.get("day");
    selectedHistoryDay = day || null;
    renderHistoryScreen();
  } else {
    renderMainScreen();
  }
}

window.goHome = function () {
  history.pushState({}, "", window.location.pathname);
  renderScreen();
};

window.goHistory = function () {
  history.pushState({}, "", `${window.location.pathname}?view=history`);
  renderScreen();
};

window.selectHistoryDay = function (dayKey) {
  history.pushState({}, "", `${window.location.pathname}?view=history&day=${encodeURIComponent(dayKey)}`);
  renderScreen();
};

window.addEventListener("popstate", renderScreen);

window.startBuilder = function (category) {
  builder = { category, data: {} };
  editingDraftIndex = null;
  renderBuilder();
  renderReview();
};

window.clearBuilder = function () {
  builder = { category: null, data: {} };
  editingDraftIndex = null;
  renderBuilder();
  renderReview();
};

window.setBuilderValue = function (key, value) {
  builder.data[key] = value;
  renderBuilder();
  renderReview();
};

window.toggleBuilderArray = function (key, value) {
  if (!Array.isArray(builder.data[key])) builder.data[key] = [];
  const arr = builder.data[key];
  const idx = arr.indexOf(value);

  if (idx >= 0) arr.splice(idx, 1);
  else arr.push(value);

  renderBuilder();
  renderReview();
};

function renderBuilder() {
  const el = document.getElementById("builderStage");
  if (!el) return;

  if (!builder.category) {
    el.innerHTML = `<p>Pick a category to begin.</p>`;
    return;
  }

  if (builder.category === "menu") {
    let html = `
      <h3>Menu</h3>
      <h4>1. Choose item</h4>
      ${choiceButtons([
        "Bacon Dog",
        "Quack Attack",
        "Asada Fries",
        "Cheeto Fries",
        "Small Fry Tray",
        "Big Fry Tray"
      ], "itemType")}
    `;

    const itemType = builder.data.itemType;

    if (itemType) {
      html += `
        <h4>2. Quantity</h4>
        ${choiceButtons(["1", "2", "3", "4", "5"], "quantity")}
      `;
    }

    if (builder.data.quantity && (itemType === "Bacon Dog" || itemType === "Quack Attack")) {
      html += `
        <h4>3. Condiments / Extras</h4>
        ${choiceButtons(HOTDOG_CHOICES, "condiments", true)}
      `;
    }

    if (builder.data.quantity && (itemType === "Asada Fries" || itemType === "Cheeto Fries")) {
      html += `
        <h4>3. Toppings</h4>
        ${choiceButtons(FRIES_CHOICES, "friesToppings", true)}
        <h4>4. Meat Option</h4>
        ${choiceButtons(FRIES_MEAT_CHOICES, "meatOption")}
      `;
    }

    el.innerHTML = html;
    return;
  }

  if (builder.category === "combo") {
    let html = `
      <h3>Bacon Dog + Fries Combo</h3>
      <h4>1. Quantity</h4>
      ${choiceButtons(["1", "2", "3", "4", "5"], "quantity")}
    `;

    if (builder.data.quantity) {
      html += `
        <h4>2. Hotdog Condiments</h4>
        ${choiceButtons(HOTDOG_CHOICES, "comboDogCondiments", true)}
        <div class="review-card">
          <p><strong>Fries:</strong> Ketchup only</p>
        </div>
      `;
    }

    el.innerHTML = html;
  }
}

function buildPreviewItem() {
  const d = builder.data;
  const qty = Number(d.quantity || 0);
  if (!builder.category || !qty) return null;

  if (builder.category === "menu") {
    const type = d.itemType;
    if (!type) return null;

    if (type === "Bacon Dog" || type === "Quack Attack") {
      const unit = type === "Bacon Dog" ? 5 : 6;
      return {
        kind: type === "Bacon Dog" ? "baconDog" : "quackAttack",
        name: type,
        quantity: qty,
        unitPrice: unit,
        totalPrice: unit * qty,
        lines: [`Quantity: ${qty}`, ...(d.condiments || [])]
      };
    }

    if (type === "Asada Fries" || type === "Cheeto Fries") {
      const base = type === "Asada Fries" ? 10 : 13;
      let meatUp = 0;
      if (d.meatOption === "Extra Meat +$3") meatUp = 3;
      if (d.meatOption === "Double Meat +$5") meatUp = 5;
      const unit = base + meatUp;

      return {
        kind: type === "Asada Fries" ? "asadaFries" : "cheetoFries",
        name: type,
        quantity: qty,
        unitPrice: unit,
        totalPrice: unit * qty,
        lines: [`Quantity: ${qty}`, ...(d.friesToppings || []), d.meatOption || "Regular Meat"]
      };
    }

    if (type === "Small Fry Tray" || type === "Big Fry Tray") {
      const unit = type === "Small Fry Tray" ? 3 : 6;
      return {
        kind: type === "Small Fry Tray" ? "smallFryTray" : "bigFryTray",
        name: type,
        quantity: qty,
        unitPrice: unit,
        totalPrice: unit * qty,
        lines: [`Quantity: ${qty}`]
      };
    }
  }

  if (builder.category === "combo") {
    return {
      kind: "combo",
      name: "Bacon Dog + Fries Combo",
      quantity: qty,
      unitPrice: 8,
      totalPrice: 8 * qty,
      lines: [`Quantity: ${qty}`, "Includes: Bacon Dog", ...(d.comboDogCondiments || []), "Includes: Fries", "Fries: Ketchup only"]
    };
  }

  return null;
}

function renderReview() {
  const card = document.getElementById("reviewCard");
  const preview = buildPreviewItem();

  if (!preview) {
    card.innerHTML = `<p>No item being built yet.</p>`;
    return;
  }

  card.innerHTML = `
    <p><strong>${preview.name}</strong></p>
    ${preview.lines.map(line => `<p>${line}</p>`).join("")}
    <p><strong>Total:</strong> ${formatMoney(preview.totalPrice)}</p>
  `;
}

window.addBuiltItemToDraft = function () {
  const preview = buildPreviewItem();
  if (!preview) {
    alert("Finish building the item first.");
    return;
  }

  const itemToStore = {
    ...preview,
    builderCategory: builder.category,
    builderData: clone(builder.data)
  };

  if (editingDraftIndex !== null) {
    draftItems[editingDraftIndex] = itemToStore;
  } else {
    draftItems.push(itemToStore);
  }

  editingDraftIndex = null;
  builder = { category: null, data: {} };
  renderBuilder();
  renderReview();
  renderDraft();
};

window.editDraftItem = function (index) {
  const item = draftItems[index];
  if (!item) return;

  builder = {
    category: item.builderCategory,
    data: clone(item.builderData)
  };
  editingDraftIndex = index;
  renderBuilder();
  renderReview();
};

window.removeDraftItem = function (index) {
  draftItems.splice(index, 1);
  renderDraft();
};

window.clearDraft = function () {
  if (!draftItems.length && !editingOpenOrderKey) return;
  if (!confirm("Clear the current draft?")) return;

  draftItems = [];
  builder = { category: null, data: {} };
  editingDraftIndex = null;
  editingOpenOrderKey = null;
  renderBuilder();
  renderReview();
  renderDraft();
};

function renderDraft() {
  const list = document.getElementById("draftOrderList");
  const total = draftItems.reduce((sum, item) => sum + item.totalPrice, 0);

  document.getElementById("draftTotal").textContent = formatMoney(total);
  document.getElementById("editingNotice").classList.toggle("hidden", !editingOpenOrderKey);

  if (!draftItems.length) {
    list.innerHTML = `<p>No items in draft yet.</p>`;
    return;
  }

  list.innerHTML = draftItems.map((item, index) => `
    <div class="order-item">
      <div class="order-item-head">
        <div>
          <p><strong>${item.name}</strong></p>
          ${item.lines.map(line => `<p>${line}</p>`).join("")}
          <p><strong>${formatMoney(item.totalPrice)}</strong></p>
        </div>
      </div>
      <div class="order-actions">
        <button type="button" class="action-btn" onclick="editDraftItem(${index})">Edit Item</button>
        <button type="button" class="action-btn delete-btn" onclick="removeDraftItem(${index})">Remove</button>
      </div>
    </div>
  `).join("");
}

window.sendDraftToOpenOrders = async function () {
  if (!draftItems.length) {
    alert("Add at least one item first.");
    return;
  }

  const subtotal = draftItems.reduce((sum, item) => sum + item.totalPrice, 0);

  if (editingOpenOrderKey) {
    const current = liveState.openOrders[editingOpenOrderKey];
    if (!current) {
      alert("That open order no longer exists.");
      editingOpenOrderKey = null;
      return;
    }

    const updatedOrder = {
      ...current,
      items: clone(draftItems),
      subtotal,
      updatedAt: Date.now()
    };

    await set(ref(db, `hotdogLive/openOrders/${editingOpenOrderKey}`), updatedOrder);
    draftItems = [];
    builder = { category: null, data: {} };
    editingDraftIndex = null;
    editingOpenOrderKey = null;
    renderBuilder();
    renderReview();
    renderDraft();
    return;
  }

  const nextNumberRef = ref(db, "hotdogLive/meta/nextOrderNumber");
  const txn = await runTransaction(nextNumberRef, current => current === null ? 2 : current + 1);
  const orderNumber = txn.snapshot.val() - 1;

  const newRef = push(ref(db, "hotdogLive/openOrders"));
  const order = {
    orderNumber,
    createdAt: Date.now(),
    createdLabel: nowLabel(),
    status: "open",
    subtotal,
    items: clone(draftItems)
  };

  await set(newRef, order);

  draftItems = [];
  builder = { category: null, data: {} };
  editingDraftIndex = null;
  renderBuilder();
  renderReview();
  renderDraft();
};

window.loadOpenOrderForEdit = function (orderKey) {
  const order = liveState.openOrders[orderKey];
  if (!order) return;

  draftItems = clone(order.items || []);
  editingOpenOrderKey = orderKey;
  editingDraftIndex = null;
  builder = { category: null, data: {} };
  renderBuilder();
  renderReview();
  renderDraft();
  window.scrollTo({ top: 0, behavior: "smooth" });
};

window.removeOpenOrder = async function (orderKey) {
  if (!confirm("Delete this open order?")) return;
  await remove(ref(db, `hotdogLive/openOrders/${orderKey}`));

  if (editingOpenOrderKey === orderKey) {
    editingOpenOrderKey = null;
    draftItems = [];
    renderDraft();
  }
};

async function moveOpenToPaid(orderKey, payment) {
  const order = liveState.openOrders[orderKey];
  if (!order) return;

  const paidOrder = {
    ...order,
    status: "paid",
    payment,
    paidAt: Date.now(),
    paidLabel: nowLabel()
  };

  await set(ref(db, `hotdogLive/paidOrders/${orderKey}`), paidOrder);
  await remove(ref(db, `hotdogLive/openOrders/${orderKey}`));

  if (editingOpenOrderKey === orderKey) {
    editingOpenOrderKey = null;
    draftItems = [];
    renderDraft();
  }
}

window.payOpenOrderCash = async function (orderKey) {
  const order = liveState.openOrders[orderKey];
  if (!order) return;

  const amountGivenInput = prompt(`Order total is ${formatMoney(order.subtotal)}.\nEnter cash received:`);
  if (amountGivenInput === null) return;

  const amountGiven = Number(amountGivenInput);
  if (Number.isNaN(amountGiven)) {
    alert("Invalid number.");
    return;
  }
  if (amountGiven < order.subtotal) {
    alert(`Not enough cash. Need at least ${formatMoney(order.subtotal)}.`);
    return;
  }

  const changeDue = Number((amountGiven - order.subtotal).toFixed(2));
  alert(`Change due: ${formatMoney(changeDue)}`);

  await moveOpenToPaid(orderKey, {
    type: "cash",
    total: order.subtotal,
    cashReceived: amountGiven,
    changeDue
  });
};

window.payOpenOrderDigital = async function (orderKey) {
  const order = liveState.openOrders[orderKey];
  if (!order) return;

  const method = prompt("Enter digital method exactly:\nCash App\nApple Pay\nSquare");
  if (method === null) return;

  const cleaned = method.trim();
  if (!["Cash App", "Apple Pay", "Square"].includes(cleaned)) {
    alert("Enter Cash App, Apple Pay, or Square exactly.");
    return;
  }

  await moveOpenToPaid(orderKey, {
    type: "digital",
    method: cleaned,
    total: order.subtotal
  });
};

window.payOpenOrderSplit = async function (orderKey) {
  const order = liveState.openOrders[orderKey];
  if (!order) return;

  const cashInput = prompt(`Order total is ${formatMoney(order.subtotal)}.\nEnter CASH amount:`);
  if (cashInput === null) return;

  const cashAmount = Number(cashInput);
  if (Number.isNaN(cashAmount) || cashAmount < 0 || cashAmount > order.subtotal) {
    alert("Invalid cash amount.");
    return;
  }

  const digitalAmount = Number((order.subtotal - cashAmount).toFixed(2));
  const method = prompt(`Digital amount is ${formatMoney(digitalAmount)}.\nEnter digital method exactly:\nCash App\nApple Pay\nSquare`);
  if (method === null) return;

  const cleaned = method.trim();
  if (!["Cash App", "Apple Pay", "Square"].includes(cleaned)) {
    alert("Enter Cash App, Apple Pay, or Square exactly.");
    return;
  }

  let cashReceived = cashAmount;
  let changeDue = 0;

  if (cashAmount > 0) {
    const receivedInput = prompt(`Cash portion is ${formatMoney(cashAmount)}.\nEnter cash received:`);
    if (receivedInput === null) return;

    cashReceived = Number(receivedInput);
    if (Number.isNaN(cashReceived) || cashReceived < cashAmount) {
      alert("Cash received must cover the cash portion.");
      return;
    }

    changeDue = Number((cashReceived - cashAmount).toFixed(2));
    alert(`Cash change due: ${formatMoney(changeDue)}`);
  }

  await moveOpenToPaid(orderKey, {
    type: "split",
    total: order.subtotal,
    cashAmount,
    cashReceived,
    changeDue,
    digitalAmount,
    digitalMethod: cleaned
  });
};

window.markPaidAsHandedOut = async function (orderKey) {
  const order = liveState.paidOrders[orderKey];
  if (!order) return;

  const handed = {
    ...order,
    status: "handed_out",
    handedOutAt: Date.now(),
    handedOutLabel: nowLabel()
  };

  await set(ref(db, `hotdogLive/handedOutOrders/${orderKey}`), handed);
  await remove(ref(db, `hotdogLive/paidOrders/${orderKey}`));
};

window.removePaidOrder = async function (orderKey) {
  if (!confirm("Remove this paid order?")) return;
  await remove(ref(db, `hotdogLive/paidOrders/${orderKey}`));
};

window.removeHandedOrder = async function (orderKey) {
  if (!confirm("Remove this handed out order?")) return;
  await remove(ref(db, `hotdogLive/handedOutOrders/${orderKey}`));
};

function renderOrderCard(orderKey, order, type) {
  const statusClass =
    type === "open" ? "status-open" :
    type === "paid" ? "status-paid" :
    "status-handed";

  const statusText =
    type === "open" ? "Open" :
    type === "paid" ? "Paid" :
    "Handed Out";

  let actions = "";

  if (type === "open") {
    actions = `
      <div class="order-actions">
        <button type="button" class="action-btn" onclick="loadOpenOrderForEdit('${orderKey}')">Edit Order</button>
        <button type="button" class="action-btn delete-btn" onclick="removeOpenOrder('${orderKey}')">Remove</button>
        <button type="button" class="action-btn pay-cash" onclick="payOpenOrderCash('${orderKey}')">Pay Cash</button>
        <button type="button" class="action-btn pay-digital" onclick="payOpenOrderDigital('${orderKey}')">Pay Digital</button>
        <button type="button" class="action-btn pay-split" onclick="payOpenOrderSplit('${orderKey}')">Split</button>
      </div>
    `;
  }

  if (type === "paid") {
    actions = `
      <div class="order-actions">
        <button type="button" class="action-btn mark-handed" onclick="markPaidAsHandedOut('${orderKey}')">Handed Out</button>
        <button type="button" class="action-btn delete-btn" onclick="removePaidOrder('${orderKey}')">Remove</button>
      </div>
    `;
  }

  if (type === "handed") {
    actions = `
      <div class="order-actions">
        <button type="button" class="action-btn delete-btn" onclick="removeHandedOrder('${orderKey}')">Remove</button>
      </div>
    `;
  }

  let paymentLines = "";
  if (order.payment) {
    if (order.payment.type === "cash") {
      paymentLines = `
        <p><strong>Cash:</strong> ${formatMoney(order.payment.total)}</p>
        <p><strong>Given:</strong> ${formatMoney(order.payment.cashReceived)}</p>
        <p><strong>Change:</strong> ${formatMoney(order.payment.changeDue)}</p>
      `;
    }
    if (order.payment.type === "digital") {
      paymentLines = `
        <p><strong>Digital:</strong> ${order.payment.method}</p>
        <p><strong>Total:</strong> ${formatMoney(order.payment.total)}</p>
      `;
    }
    if (order.payment.type === "split") {
      paymentLines = `
        <p><strong>Cash:</strong> ${formatMoney(order.payment.cashAmount)}</p>
        <p><strong>Given:</strong> ${formatMoney(order.payment.cashReceived)}</p>
        <p><strong>Change:</strong> ${formatMoney(order.payment.changeDue)}</p>
        <p><strong>Digital:</strong> ${order.payment.digitalMethod}</p>
        <p><strong>Digital Amt:</strong> ${formatMoney(order.payment.digitalAmount)}</p>
      `;
    }
  }

  return `
    <div class="order-card compact-card">
      <span class="status-pill ${statusClass}">${statusText}</span>
      <p class="for-label"><strong>For Adrian</strong></p>

      <div class="order-card-head">
        <div>
          <p><strong>Order #${order.orderNumber}</strong></p>
          <p>${type === "open" ? order.createdLabel : (order.paidLabel || order.handedOutLabel || "")}</p>
        </div>
        <div><strong>${formatMoney(order.subtotal)}</strong></div>
      </div>

      ${order.items.map(item => `
        <div class="order-item compact-item">
          <div>
            <p><strong>${item.name}</strong></p>
            ${item.lines.map(line => `<p>${line}</p>`).join("")}
          </div>
        </div>
      `).join("")}

      ${paymentLines}
      ${actions}
    </div>
  `;
}

function renderLiveColumns() {
  const openList = document.getElementById("openOrdersList");
  const paidList = document.getElementById("paidOrdersList");
  const handedList = document.getElementById("handedOrdersList");

  const openEntries = Object.entries(liveState.openOrders || {}).sort((a, b) => (a[1].createdAt || 0) - (b[1].createdAt || 0));
  const paidEntries = Object.entries(liveState.paidOrders || {}).sort((a, b) => (a[1].paidAt || 0) - (b[1].paidAt || 0));
  const handedEntries = Object.entries(liveState.handedOutOrders || {})
    .filter(([, order]) => {
      const handedAt = Number(order.handedOutAt || 0);
      return Date.now() - handedAt < 60000;
    })
    .sort((a, b) => (a[1].handedOutAt || 0) - (b[1].handedOutAt || 0));

  openList.innerHTML = openEntries.length
    ? openEntries.map(([key, order]) => renderOrderCard(key, order, "open")).join("")
    : "<p>No open orders.</p>";

  paidList.innerHTML = paidEntries.length
    ? paidEntries.map(([key, order]) => renderOrderCard(key, order, "paid")).join("")
    : "<p>No paid orders.</p>";

  handedList.innerHTML = handedEntries.length
    ? handedEntries.map(([key, order]) => renderOrderCard(key, order, "handed")).join("")
    : "<p>No handed out orders.</p>";
}

function renderMainScreen() {
  renderBuilder();
  renderReview();
  renderDraft();
  renderLiveColumns();

  const combinedOrders = {
    ...liveState.paidOrders,
    ...liveState.handedOutOrders
  };
  const totals = totalsFromOrders(combinedOrders);
  const counts = getCountsFromOrders(combinedOrders);
  const itemsSold = Object.values(counts).reduce((sum, n) => sum + n, 0);

  document.getElementById("nextOrderNumber").textContent = liveState.meta.nextOrderNumber || 1;
  document.getElementById("openCount").textContent = Object.keys(liveState.openOrders || {}).length;
  document.getElementById("paidCount").textContent = Object.keys(liveState.paidOrders || {}).length;
  document.getElementById("handedCount").textContent = Object.keys(liveState.handedOutOrders || {}).length;

  document.getElementById("cashTotal").textContent = formatMoney(totals.cash);
  document.getElementById("cashAppTotal").textContent = formatMoney(totals.cashApp);
  document.getElementById("applePayTotal").textContent = formatMoney(totals.applePay);
  document.getElementById("squareTotal").textContent = formatMoney(totals.square);
  document.getElementById("dayTotal").textContent = formatMoney(totals.dayTotal);

  document.getElementById("topSeller").textContent = getTopSeller(counts);
  document.getElementById("itemsSoldCount").textContent = itemsSold;
  document.getElementById("comboSoldCount").textContent = counts["Bacon Dog + Fries Combo"] || 0;

  const itemCountsBox = document.getElementById("itemCountsBox");
  const entries = Object.entries(counts).filter(([, count]) => count > 0);
  itemCountsBox.innerHTML = entries.length
    ? entries.map(([name, count]) => `<p><strong>${name}:</strong> ${count}</p>`).join("")
    : "<p>No paid items yet.</p>";
}

function renderHistoryScreen() {
  const daysList = document.getElementById("historyDaysList");
  const detail = document.getElementById("historyDetail");
  const detailTitle = document.getElementById("historyDetailTitle");

  const dayEntries = Object.entries(liveState.days || {}).sort((a, b) => b[0].localeCompare(a[0]));

  if (!dayEntries.length) {
    daysList.innerHTML = "<p>No saved days yet.</p>";
    detail.innerHTML = "<p>Select a day.</p>";
    detailTitle.textContent = "Day Details";
    return;
  }

  daysList.innerHTML = dayEntries.map(([dayKey, day]) => `
    <div class="history-day-card">
      <p><strong>${day.label || dayKey}</strong></p>
      <p>Total: ${formatMoney(day.totals?.dayTotal || 0)}</p>
      <p>Orders: ${[
        ...Object.values(day.openOrders || {}),
        ...Object.values(day.paidOrders || {}),
        ...Object.values(day.handedOutOrders || {})
      ].length}</p>
      <div class="order-actions">
        <button type="button" class="action-btn" onclick="selectHistoryDay('${dayKey}')">View Day</button>
      </div>
    </div>
  `).join("");

  if (!selectedHistoryDay || !liveState.days[selectedHistoryDay]) {
    detail.innerHTML = "<p>Select a day.</p>";
    detailTitle.textContent = "Day Details";
    return;
  }

  const day = liveState.days[selectedHistoryDay];
  detailTitle.textContent = `Day Details — ${day.label || selectedHistoryDay}`;

  const allOrders = [
    ...Object.entries(day.openOrders || {}).map(([k, v]) => ({ key: k, status: "Open", ...v })),
    ...Object.entries(day.paidOrders || {}).map(([k, v]) => ({ key: k, status: "Paid", ...v })),
    ...Object.entries(day.handedOutOrders || {}).map(([k, v]) => ({ key: k, status: "Handed Out", ...v }))
  ].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

  detail.innerHTML = `
    <div class="totals-box">
      <div class="line"><span>Cash</span><strong>${formatMoney(day.totals?.cash || 0)}</strong></div>
      <div class="line"><span>Cash App</span><strong>${formatMoney(day.totals?.cashApp || 0)}</strong></div>
      <div class="line"><span>Apple Pay</span><strong>${formatMoney(day.totals?.applePay || 0)}</strong></div>
      <div class="line"><span>Square</span><strong>${formatMoney(day.totals?.square || 0)}</strong></div>
      <div class="line total-line"><span>Total</span><strong>${formatMoney(day.totals?.dayTotal || 0)}</strong></div>
    </div>
    ${allOrders.map(order => `
      <div class="history-order-card">
        <p><strong>Order #${order.orderNumber}</strong> — ${order.status}</p>
        <p>${order.createdLabel || ""}</p>
        ${order.items.map(item => `
          <div class="order-item">
            <div>
              <p><strong>${item.name}</strong></p>
              ${item.lines.map(line => `<p>${line}</p>`).join("")}
              <p>${formatMoney(item.totalPrice)}</p>
            </div>
          </div>
        `).join("")}
        <p><strong>Subtotal:</strong> ${formatMoney(order.subtotal)}</p>
        ${order.payment ? `
          <p><strong>Payment Type:</strong> ${order.payment.type}</p>
          ${order.payment.method ? `<p><strong>Digital Method:</strong> ${order.payment.method}</p>` : ""}
          ${order.payment.digitalMethod ? `<p><strong>Digital Method:</strong> ${order.payment.digitalMethod}</p>` : ""}
          ${order.payment.cashReceived !== undefined ? `<p><strong>Cash Received:</strong> ${formatMoney(order.payment.cashReceived)}</p>` : ""}
          ${order.payment.changeDue !== undefined ? `<p><strong>Change Due:</strong> ${formatMoney(order.payment.changeDue)}</p>` : ""}
        ` : ""}
      </div>
    `).join("")}
  `;
}

window.saveDay = async function () {
  const openCount = Object.keys(liveState.openOrders || {}).length;
  if (openCount > 0) {
    const proceed = confirm(`There are still ${openCount} open orders. Save day anyway and archive them too?`);
    if (!proceed) return;
  }

  const combinedOrders = {
    ...liveState.paidOrders,
    ...liveState.handedOutOrders
  };
  const totals = totalsFromOrders(combinedOrders);

  const payload = {
    label: todayLabel(),
    createdAt: Date.now(),
    openOrders: clone(liveState.openOrders || {}),
    paidOrders: clone(liveState.paidOrders || {}),
    handedOutOrders: clone(liveState.handedOutOrders || {}),
    totals
  };

  await set(ref(db, `hotdogDays/${todayKey()}`), payload);
  await set(ref(db, "hotdogLive/openOrders"), {});
  await set(ref(db, "hotdogLive/paidOrders"), {});
  await set(ref(db, "hotdogLive/handedOutOrders"), {});
  await set(ref(db, "hotdogLive/meta/nextOrderNumber"), 1);

  draftItems = [];
  builder = { category: null, data: {} };
  editingDraftIndex = null;
  editingOpenOrderKey = null;
  renderBuilder();
  renderReview();
  renderDraft();
  alert("Day saved.");
};

window.resetDay = async function () {
  const proceed = confirm("Reset today without saving?");
  if (!proceed) return;

  await set(ref(db, "hotdogLive/openOrders"), {});
  await set(ref(db, "hotdogLive/paidOrders"), {});
  await set(ref(db, "hotdogLive/handedOutOrders"), {});
  await set(ref(db, "hotdogLive/meta/nextOrderNumber"), 1);

  draftItems = [];
  builder = { category: null, data: {} };
  editingDraftIndex = null;
  editingOpenOrderKey = null;
  renderBuilder();
  renderReview();
  renderDraft();
  alert("Day reset.");
};

function attachLiveListeners() {
  onValue(ref(db, "hotdogLive/meta"), snap => {
    liveState.meta = snap.val() || { nextOrderNumber: 1 };
    renderScreen();
  });

  onValue(ref(db, "hotdogLive/openOrders"), snap => {
    liveState.openOrders = snap.val() || {};
    renderScreen();
  });

  onValue(ref(db, "hotdogLive/paidOrders"), snap => {
    liveState.paidOrders = snap.val() || {};
    renderScreen();
  });

  onValue(ref(db, "hotdogLive/handedOutOrders"), snap => {
    liveState.handedOutOrders = snap.val() || {};
    renderScreen();
  });

  onValue(ref(db, "hotdogDays"), snap => {
    liveState.days = snap.val() || {};
    renderScreen();
  });
}

attachLiveListeners();
renderScreen();
setInterval(() => {
  renderScreen();
}, 5000);
