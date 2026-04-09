let data = {
  bacon: {
    count: Number(localStorage.getItem("baconCount")) || 0,
    price: Number(localStorage.getItem("baconPrice")) || 5
  },
  quack: {
    count: Number(localStorage.getItem("quackCount")) || 0,
    price: Number(localStorage.getItem("quackPrice")) || 6
  },
  fries: {
    count: Number(localStorage.getItem("friesCount")) || 0,
    price: Number(localStorage.getItem("friesPrice")) || 10
  }
};

let history = JSON.parse(localStorage.getItem("salesHistory")) || [];

const baconCountEl = document.getElementById("baconCount");
const quackCountEl = document.getElementById("quackCount");
const friesCountEl = document.getElementById("friesCount");

const baconTotalEl = document.getElementById("baconTotal");
const quackTotalEl = document.getElementById("quackTotal");
const friesTotalEl = document.getElementById("friesTotal");

const grandTotalEl = document.getElementById("grandTotal");
const totalItemsEl = document.getElementById("totalItems");
const historyListEl = document.getElementById("historyList");
const todayDateEl = document.getElementById("todayDate");

const baconPriceInput = document.getElementById("baconPrice");
const quackPriceInput = document.getElementById("quackPrice");
const friesPriceInput = document.getElementById("friesPrice");

baconPriceInput.value = data.bacon.price;
quackPriceInput.value = data.quack.price;
friesPriceInput.value = data.fries.price;

function formatMoney(amount) {
  return `$${amount.toFixed(2)}`;
}

function getTodayLabel() {
  const today = new Date();
  return today.toLocaleDateString();
}

function saveCurrentData() {
  localStorage.setItem("baconCount", data.bacon.count);
  localStorage.setItem("baconPrice", data.bacon.price);

  localStorage.setItem("quackCount", data.quack.count);
  localStorage.setItem("quackPrice", data.quack.price);

  localStorage.setItem("friesCount", data.fries.count);
  localStorage.setItem("friesPrice", data.fries.price);

  localStorage.setItem("salesHistory", JSON.stringify(history));
}

function getGrandTotal() {
  return (
    data.bacon.count * data.bacon.price +
    data.quack.count * data.quack.price +
    data.fries.count * data.fries.price
  );
}

function getTotalItems() {
  return data.bacon.count + data.quack.count + data.fries.count;
}

function updateScreen() {
  baconCountEl.textContent = data.bacon.count;
  quackCountEl.textContent = data.quack.count;
  friesCountEl.textContent = data.fries.count;

  baconTotalEl.textContent = formatMoney(data.bacon.count * data.bacon.price);
  quackTotalEl.textContent = formatMoney(data.quack.count * data.quack.price);
  friesTotalEl.textContent = formatMoney(data.fries.count * data.fries.price);

  grandTotalEl.textContent = formatMoney(getGrandTotal());
  totalItemsEl.textContent = getTotalItems();
  todayDateEl.textContent = getTodayLabel();
}

function renderHistory() {
  if (history.length === 0) {
    historyListEl.innerHTML = "<p>No saved days yet.</p>";
    return;
  }

  historyListEl.innerHTML = "";

  const newestFirst = [...history].reverse();

  newestFirst.forEach((day) => {
    const entry = document.createElement("div");
    entry.className = "history-entry";

    entry.innerHTML = `
      <h3>${day.date}</h3>
      <p>Bacon Dog: ${day.baconCount} (${formatMoney(day.baconSales)})</p>
      <p>Quack Attack: ${day.quackCount} (${formatMoney(day.quackSales)})</p>
      <p>Asada Fries: ${day.friesCount} (${formatMoney(day.friesSales)})</p>
      <p><strong>Total Items:</strong> ${day.totalItems}</p>
      <p><strong>Total Sales:</strong> ${formatMoney(day.grandTotal)}</p>
    `;

    historyListEl.appendChild(entry);
  });
}

function changeCount(item, amount) {
  data[item].count += amount;

  if (data[item].count < 0) {
    data[item].count = 0;
  }

  saveCurrentData();
  updateScreen();
}

function resetDay() {
  const confirmReset = confirm("Are you sure you want to reset today's counts without saving?");
  if (!confirmReset) return;

  data.bacon.count = 0;
  data.quack.count = 0;
  data.fries.count = 0;

  saveCurrentData();
  updateScreen();
}

function saveDay() {
  const totalItems = getTotalItems();

  if (totalItems === 0) {
    alert("You have nothing to save yet for today.");
    return;
  }

  const today = getTodayLabel();

  const alreadySaved = history.find((entry) => entry.date === today);
  if (alreadySaved) {
    const overwrite = confirm("Today's numbers were already saved. Do you want to replace them?");
    if (!overwrite) return;

    history = history.filter((entry) => entry.date !== today);
  }

  const daySummary = {
    date: today,
    baconCount: data.bacon.count,
    baconSales: data.bacon.count * data.bacon.price,
    quackCount: data.quack.count,
    quackSales: data.quack.count * data.quack.price,
    friesCount: data.fries.count,
    friesSales: data.fries.count * data.fries.price,
    totalItems: totalItems,
    grandTotal: getGrandTotal()
  };

  history.push(daySummary);

  data.bacon.count = 0;
  data.quack.count = 0;
  data.fries.count = 0;

  saveCurrentData();
  updateScreen();
  renderHistory();

  alert("Day saved and reset for tomorrow.");
}

baconPriceInput.addEventListener("input", () => {
  data.bacon.price = Number(baconPriceInput.value) || 0;
  saveCurrentData();
  updateScreen();
});

quackPriceInput.addEventListener("input", () => {
  data.quack.price = Number(quackPriceInput.value) || 0;
  saveCurrentData();
  updateScreen();
});

friesPriceInput.addEventListener("input", () => {
  data.fries.price = Number(friesPriceInput.value) || 0;
  saveCurrentData();
  updateScreen();
});

updateScreen();
renderHistory();
