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

let lastUpdated = localStorage.getItem("lastUpdated") || "Not yet";

const baconCountEl = document.getElementById("baconCount");
const quackCountEl = document.getElementById("quackCount");
const friesCountEl = document.getElementById("friesCount");

const baconTotalEl = document.getElementById("baconTotal");
const quackTotalEl = document.getElementById("quackTotal");
const friesTotalEl = document.getElementById("friesTotal");

const grandTotalEl = document.getElementById("grandTotal");
const totalItemsEl = document.getElementById("totalItems");
const lastUpdatedEl = document.getElementById("lastUpdated");

const baconPriceInput = document.getElementById("baconPrice");
const quackPriceInput = document.getElementById("quackPrice");
const friesPriceInput = document.getElementById("friesPrice");

baconPriceInput.value = data.bacon.price;
quackPriceInput.value = data.quack.price;
friesPriceInput.value = data.fries.price;

function formatMoney(amount) {
    return `$${amount.toFixed(2)}`;
}

function updateTime() {
    lastUpdated = new Date().toLocaleString();
}

function saveData() {
    localStorage.setItem("baconCount", data.bacon.count);
    localStorage.setItem("baconPrice", data.bacon.price);

    localStorage.setItem("quackCount", data.quack.count);
    localStorage.setItem("quackPrice", data.quack.price);

    localStorage.setItem("friesCount", data.fries.count);
    localStorage.setItem("friesPrice", data.fries.price);

    localStorage.setItem("lastUpdated", lastUpdated);
}

function updateScreen() {
    baconCountEl.textContent = data.bacon.count;
    quackCountEl.textContent = data.quack.count;
    friesCountEl.textContent = data.fries.count;

    baconTotalEl.textContent = formatMoney(data.bacon.count * data.bacon.price);
    quackTotalEl.textContent = formatMoney(data.quack.count * data.quack.price);
    friesTotalEl.textContent = formatMoney(data.fries.count * data.fries.price);

    const grandTotal =
        (data.bacon.count * data.bacon.price) +
        (data.quack.count * data.quack.price) +
        (data.fries.count * data.fries.price);

    const totalItems =
        data.bacon.count +
        data.quack.count +
        data.fries.count;

    grandTotalEl.textContent = formatMoney(grandTotal);
    totalItemsEl.textContent = totalItems;
    lastUpdatedEl.textContent = lastUpdated;
}

function changeCount(item, amount) {
    data[item].count += amount;

    if (data[item].count < 0) {
        data[item].count = 0;
    }

    updateTime();
    saveData();
    updateScreen();
}

function resetDay() {
    const confirmReset = confirm("Are you sure you want to reset the whole day?");
    if (!confirmReset) return;

    data.bacon.count = 0;
    data.quack.count = 0;
    data.fries.count = 0;

    updateTime();
    saveData();
    updateScreen();
}

baconPriceInput.addEventListener("input", () => {
    data.bacon.price = Number(baconPriceInput.value) || 0;
    updateTime();
    saveData();
    updateScreen();
});

quackPriceInput.addEventListener("input", () => {
    data.quack.price = Number(quackPriceInput.value) || 0;
    updateTime();
    saveData();
    updateScreen();
});

friesPriceInput.addEventListener("input", () => {
    data.fries.price = Number(friesPriceInput.value) || 0;
    updateTime();
    saveData();
    updateScreen();
});

updateScreen();