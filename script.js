const STORAGE_KEY = "adrian_builder_tracker_v1";

let state = loadState();

let builder = {
  category: null,
  data: {}
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        orderItems: [],
        cashTotal: 0,
        digitalTotal: 0,
        paidOrders: [],
        savedDays: [],
        nextOrderNumber: 1,
        itemsSoldTotal: 0
      };
    }

    const parsed = JSON.parse(raw);
    return {
      orderItems: parsed.orderItems || [],
      cashTotal: parsed.cashTotal || 0,
      digitalTotal: parsed.digitalTotal || 0,
      paidOrders: parsed.paidOrders || [],
      savedDays: parsed.savedDays || [],
      nextOrderNumber: parsed.nextOrderNumber || 1,
      itemsSoldTotal: parsed.itemsSoldTotal || 0
    };
  } catch {
    return {
      orderItems: [],
      cashTotal: 0,
      digitalTotal: 0,
      paidOrders: [],
      savedDays: [],
      nextOrderNumber: 1,
      itemsSoldTotal: 0
    };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatMoney(n) {
  return `$${Number(n).toFixed(2)}`;
}

function playTap() {
  try {
    const audio = new Audio("sounds/tap.mp3");
    audio.play().catch(() => {});
  } catch {}
}

function escapeForSingleQuote(str) {
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'");
}

function startBuilder(category) {
  builder = { category, data: {} };
  renderBuilder();
  renderReview();
  playTap();
}

function clearBuilder() {
  builder = { category: null, data: {} };
  renderBuilder();
  renderReview();
}

function setBuilderValue(key, value) {
  builder.data[key] = value;
  renderBuilder();
  renderReview();
  playTap();
}

function toggleBuilderArrayValue(key, value) {
  if (!builder.data[key]) builder.data[key] = [];
  const arr = builder.data[key];
  const idx = arr.indexOf(value);

  if (idx >= 0) {
    arr.splice(idx, 1);
  } else {
    arr.push(value);
  }

  renderBuilder();
  renderReview();
  playTap();
}

function isSelected(key, value) {
  return builder.data[key] === value;
}

function isSelectedInArray(key, value) {
  return Array.isArray(builder.data[key]) && builder.data[key].includes(value);
}

function renderChoiceButtons(items, key, isArray = false) {
  return `
    <div class="choice-grid">
      ${items.map(item => {
        const safeItem = escapeForSingleQuote(item);
        const selectedClass = isArray
          ? (isSelectedInArray(key, item) ? "selected" : "")
          : (isSelected(key, item) ? "selected" : "");

        const clickCode = isArray
          ? `toggleBuilderArrayValue('${key}', '${safeItem}')`
          : `setBuilderValue('${key}', '${safeItem}')`;

        return `
          <button
            type="button"
            class="choice-btn ${selectedClass}"
            onclick="${clickCode}"
          >
            ${item}
          </button>
        `;
      }).join("")}
    </div>
  `;
}

function renderBuilder() {
  const stage = document.getElementById("builderStage");
  if (!stage) return;

  if (!builder.category) {
    stage.innerHTML = "<p>Pick an item to begin.</p>";
    return;
  }

  if (builder.category === "hotdog" || builder.category === "quack") {
    const title = builder.category === "hotdog" ? "$5 Hotdog" : "$6 Quack Attack";

    stage.innerHTML = `
      <h3>${title}</h3>
      <h4>1. Choose quantity</h4>
      ${renderChoiceButtons(["1", "2", "3", "4", "5"], "quantity")}
      ${builder.data.quantity ? `
        <h4>2. Choose toppings</h4>
        ${renderChoiceButtons([
          "Ketchup",
          "Mustard",
          "Mayo",
          "Grilled Onions",
          "Hot Cheetos"
        ], "toppings", true)}
        <p class="helper">Pick all they want.</p>
      ` : ""}
    `;
    return;
  }

  if (builder.category === "fries" || builder.category === "cheetoFries") {
    const title = builder.category === "fries" ? "$10 Asada Fries" : "$13 Cheeto Asada Fries";

    stage.innerHTML = `
      <h3>${title}</h3>
      <h4>1. Choose quantity</h4>
      ${renderChoiceButtons(["1", "2", "3", "4", "5"], "quantity")}
      ${builder.data.quantity ? `
        <h4>2. Choose toppings</h4>
        ${renderChoiceButtons([
          "Sour Cream",
          "Salsa",
          "Pico de Gallo",
          "Cheese"
        ], "toppings", true)}

        <h4>3. Meat option</h4>
        ${renderChoiceButtons([
          "Regular Meat",
          "Extra Meat +$3",
          "Double Meat +$5"
        ], "meatOption")}
      ` : ""}
    `;
    return;
  }
}

function buildReviewObject() {
  if (!builder.category) return null;

  const quantity = Number(builder.data.quantity || 0);
  if (!quantity) return null;

  let unitPrice = 0;
  let name = "";
  let details = [];
  let price = 0;

  if (builder.category === "hotdog") {
    unitPrice = 5;
    name = "$5 Hotdog";
    details = ["Hotdog"];
    if (builder.data.toppings?.length) details.push(...builder.data.toppings);
    price = unitPrice * quantity;
  }

  if (builder.category === "quack") {
    unitPrice = 6;
    name = "$6 Quack Attack";
    details = ["Quack Attack"];
    if (builder.data.toppings?.length) details.push(...builder.data.toppings);
    price = unitPrice * quantity;
  }

  if (builder.category === "fries") {
    unitPrice = 10;
    name = "$10 Asada Fries";
    details = ["Asada Fries"];
    if (builder.data.toppings?.length) details.push(...builder.data.toppings);

    let meatUpcharge = 0;
    if (builder.data.meatOption === "Extra Meat +$3") meatUpcharge = 3;
    if (builder.data.meatOption === "Double Meat +$5") meatUpcharge = 5;
    if (builder.data.meatOption) details.push(builder.data.meatOption);

    price = (unitPrice + meatUpcharge) * quantity;
  }

  if (builder.category === "cheetoFries") {
    unitPrice = 13;
    name = "$13 Cheeto Asada Fries";
    details = ["Cheeto Asada Fries"];
    if (builder.data.toppings?.length) details.push(...builder.data.toppings);

    let meatUpcharge = 0;
    if (builder.data.meatOption === "Extra Meat +$3") meatUpcharge = 3;
    if (builder.data.meatOption === "Double Meat +$5") meatUpcharge = 5;
    if (builder.data.meatOption) details.push(builder.data.meatOption);

    price = (unitPrice + meatUpcharge) * quantity;
  }

  if (!name) return null;

  return {
    name,
    quantity,
    unitPrice,
    price,
    details,
    itemCount: quantity
  };
}

function renderReview() {
  const card = document.getElementById("reviewCard");
  if (!card) return;

  const review = buildReviewObject();
  if (!review) {
    card.innerHTML = "<p>No item being built yet.</p>";
    return;
  }

  card.innerHTML = `
    <p><strong>${review.name}</strong></p>
    <p>Quantity: ${review.quantity}</p>
    ${review.details.map(d => `<p>${d}</p>`).join("")}
    <p><strong>Total:</strong> ${formatMoney(review.price)}</p>
  `;
}

function addBuiltItemToOrder() {
  const review = buildReviewObject();
  if (!review) {
    alert("Finish building the item first.");
    return;
  }

  state.orderItems.push(review);
  saveState();
  clearBuilder();
  updateUI();
  playTap();
}

function getOrderTotal() {
  return state.orderItems.reduce((sum, item) => sum + item.price, 0);
}

function getOrderItemCount() {
  return state.orderItems.reduce((sum, item) => sum + (item.itemCount || 0), 0);
}

function removeOrderItem(index) {
  state.orderItems.splice(index, 1);
  saveState();
  updateUI();
}

function editOrderItem(index) {
  const item = state.orderItems[index];
  if (!item) return;

  const newPriceInput = prompt(`Edit price for "${item.name}"`, item.price);
  if (newPriceInput === null) return;

  const newPrice = Number(newPriceInput);
  if (Number.isNaN(newPrice) || newPrice <= 0) {
    alert("Invalid price.");
    return;
  }

  item.price = Number(newPrice.toFixed(2));
  saveState();
  updateUI();
}

function clearOrder() {
  if (!state.orderItems.length) return;
  if (!confirm("Clear the whole order?")) return;
  state.orderItems = [];
  saveState();
  updateUI();
}

function renderOrderList() {
  const list = document.getElementById("orderList");
  if (!list) return;

  if (!state.orderItems.length) {
    list.innerHTML = "<p>No items in order yet.</p>";
    return;
  }

  list.innerHTML = state.orderItems.map((item, index) => `
    <div class="order-item">
      <div>
        <p><strong>${item.name}</strong></p>
        <p>Quantity: ${item.quantity}</p>
        ${item.details.map(d => `<p>${d}</p>`).join("")}
        <p>${formatMoney(item.price)}</p>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button type="button" class="small-btn" onclick="editOrderItem(${index})">Edit</button>
        <button type="button" class="small-btn" onclick="removeOrderItem(${index})">Remove</button>
      </div>
    </div>
  `).join("");
}

function savePaidOrder(paymentLabel, cash, digital, total) {
  state.paidOrders.push({
    number: state.nextOrderNumber,
    time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    payment: paymentLabel,
    cash,
    digital,
    total,
    items: state.orderItems.map(item => ({ ...item }))
  });
  state.nextOrderNumber += 1;
}

function renderPaidOrders() {
  const todayOrders = document.getElementById("todayOrders");
  const lastOrderCard = document.getElementById("lastOrderCard");
  const ordersTodayCount = document.getElementById("ordersTodayCount");
  const orderNumber = document.getElementById("orderNumber");

  if (ordersTodayCount) ordersTodayCount.textContent = state.paidOrders.length;
  if (orderNumber) orderNumber.textContent = state.nextOrderNumber;

  if (!state.paidOrders.length) {
    if (todayOrders) todayOrders.innerHTML = "<p>No paid orders yet.</p>";
    if (lastOrderCard) lastOrderCard.innerHTML = "<p>No paid orders yet.</p>";
    return;
  }

  const newestFirst = [...state.paidOrders].reverse();

  if (todayOrders) {
    todayOrders.innerHTML = newestFirst.map(order => `
      <div class="paid-order">
        <h4>Order #${order.number} • ${order.time}</h4>
        ${order.items.map(item => `<p>${item.name} x${item.quantity} (${formatMoney(item.price)})</p>`).join("")}
        <p><strong>Payment:</strong> ${order.payment}</p>
        <p><strong>Total:</strong> ${formatMoney(order.total)}</p>
      </div>
    `).join("");
  }

  const last = state.paidOrders[state.paidOrders.length - 1];
  if (lastOrderCard) {
    lastOrderCard.innerHTML = `
      <h4>Order #${last.number} • ${last.time}</h4>
      ${last.items.map(item => `<p>${item.name} x${item.quantity} (${formatMoney(item.price)})</p>`).join("")}
      <p><strong>Payment:</strong> ${last.payment}</p>
      <p><strong>Total:</strong> ${formatMoney(last.total)}</p>
    `;
  }
}

function repeatLastOrder() {
  if (!state.paidOrders.length) {
    alert("No previous orders to repeat.");
    return;
  }

  const lastOrder = state.paidOrders[state.paidOrders.length - 1];

  state.orderItems = lastOrder.items.map(item => ({
    ...item,
    details: Array.isArray(item.details) ? [...item.details] : []
  }));

  saveState();
  updateUI();
  playTap();
}

function finalizeCheckout(cash, digital, paymentLabel) {
  const total = getOrderTotal();
  if (total === 0) {
    alert("No items in order.");
    return;
  }

  if (Math.abs((cash + digital) - total) > 0.009) {
    alert("Payments do not match order total.");
    return;
  }

  savePaidOrder(paymentLabel, cash, digital, total);

  state.cashTotal += cash;
  state.digitalTotal += digital;
  state.itemsSoldTotal += getOrderItemCount();

  state.orderItems = [];
  saveState();
  updateUI();
  playTap();
}

function checkoutOrder(method) {
  const total = getOrderTotal();
  if (total === 0) {
    alert("No items in order.");
    return;
  }

  if (method === "cash") {
    finalizeCheckout(total, 0, "Cash");
  } else {
    finalizeCheckout(0, total, "Digital");
  }
}

function checkoutSplitHalf() {
  const total = getOrderTotal();
  if (total === 0) {
    alert("No items in order.");
    return;
  }

  const cash = Number((total / 2).toFixed(2));
  const digital = Number((total - cash).toFixed(2));
  finalizeCheckout(cash, digital, "Split 50/50");
}

function checkoutSplitCustom() {
  const total = getOrderTotal();
  if (total === 0) {
    alert("No items in order.");
    return;
  }

  const input = prompt(`Order total is ${formatMoney(total)}. Enter CASH amount:`);
  if (input === null) return;

  const cash = Number(input);
  if (Number.isNaN(cash) || cash < 0 || cash > total) {
    alert("Invalid cash amount.");
    return;
  }

  const digital = Number((total - cash).toFixed(2));
  finalizeCheckout(Number(cash.toFixed(2)), digital, "Split Custom");
}

function saveDay() {
  const totalToday = state.cashTotal + state.digitalTotal;

  if (totalToday === 0 && state.paidOrders.length === 0) {
    alert("Nothing to save yet.");
    return;
  }

  state.savedDays.push({
    date: new Date().toLocaleDateString(),
    cash: state.cashTotal,
    digital: state.digitalTotal,
    total: totalToday,
    ordersCount: state.paidOrders.length,
    itemsSold: state.itemsSoldTotal
  });

  state.orderItems = [];
  state.cashTotal = 0;
  state.digitalTotal = 0;
  state.paidOrders = [];
  state.nextOrderNumber = 1;
  state.itemsSoldTotal = 0;

  saveState();
  updateUI();
  alert("Day saved.");
}

function resetDay() {
  const hasAnything =
    state.orderItems.length > 0 ||
    state.paidOrders.length > 0 ||
    state.cashTotal > 0 ||
    state.digitalTotal > 0 ||
    state.itemsSoldTotal > 0;

  if (!hasAnything) {
    alert("Nothing to reset.");
    return;
  }

  if (!confirm("Reset today without saving?")) return;

  state.orderItems = [];
  state.cashTotal = 0;
  state.digitalTotal = 0;
  state.paidOrders = [];
  state.nextOrderNumber = 1;
  state.itemsSoldTotal = 0;

  saveState();
  updateUI();
  alert("Day reset.");
}

function renderSavedDays() {
  const box = document.getElementById("previousDays");
  if (!box) return;

  if (!state.savedDays.length) {
    box.innerHTML = "<p>No saved days yet.</p>";
    return;
  }

  box.innerHTML = [...state.savedDays].reverse().map(day => `
    <div class="paid-order">
      <h4>${day.date}</h4>
      <p><strong>Cash:</strong> ${formatMoney(day.cash)}</p>
      <p><strong>Digital:</strong> ${formatMoney(day.digital)}</p>
      <p><strong>Total:</strong> ${formatMoney(day.total)}</p>
      <p><strong>Orders:</strong> ${day.ordersCount}</p>
      <p><strong>Items Sold:</strong> ${day.itemsSold}</p>
    </div>
  `).join("");
}

function updateUI() {
  renderOrderList();
  renderPaidOrders();
  renderSavedDays();

  document.getElementById("orderTotal").textContent = formatMoney(getOrderTotal());
  document.getElementById("cashTotal").textContent = formatMoney(state.cashTotal);
  document.getElementById("digitalTotal").textContent = formatMoney(state.digitalTotal);
  document.getElementById("dayTotal").textContent = formatMoney(state.cashTotal + state.digitalTotal);
  document.getElementById("itemsSoldTotal").textContent = state.itemsSoldTotal;
}

renderBuilder();
renderReview();
updateUI();
