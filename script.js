// Firebase live-sync personal savings dashboard
// IMPORTANT:
// 1. Go to Firebase Console.
// 2. Create or open your project.
// 3. Add a Web App.
// 4. Copy your Firebase config and paste it below.
// 5. Make sure Realtime Database is created in Firebase.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getDatabase,
  ref,
  onValue,
  set
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";

// PASTE YOUR FIREBASE CONFIG HERE
const firebaseConfig = {
  apiKey: "AIzaSyDMhniu1SEmiIWoXzwJy6zVSOZkHELhfLc",
  authDomain: "family-sales.firebaseapp.com",
  databaseURL: "https://family-sales-default-rtdb.firebaseio.com",
  projectId: "family-sales",
  storageBucket: "family-sales.firebasestorage.app",
  messagingSenderId: "590845027956",
  appId: "1:590845027956:web:676df074fe6150e8d39321"
};
// You can rename this path if you want separate dashboards.
const DATABASE_PATH = "personalSavingsDashboard/main";

const defaultData = {
  totals: {
    car: 0,
    savings: 0,
    restock: 0,
    emergency: 0
  },
  carGoal: 8000,
  history: [],
  spending: []
};

let data = structuredClone(defaultData);
let databaseReady = false;
let dbRef = null;

const $ = (id) => document.getElementById(id);
const money = (num) => `$${Number(num || 0).toFixed(2)}`;

function getInputNumber(id) {
  return Number($(id).value) || 0;
}

function setStatus(text, good = true) {
  $("syncStatus").textContent = text;
  $("syncStatus").style.background = good
    ? "rgba(34, 197, 94, 0.18)"
    : "rgba(239, 68, 68, 0.22)";
}

function mergeWithDefaults(incoming) {
  return {
    ...structuredClone(defaultData),
    ...(incoming || {}),
    totals: {
      ...defaultData.totals,
      ...((incoming && incoming.totals) || {})
    },
    history: Array.isArray(incoming?.history) ? incoming.history : [],
    spending: Array.isArray(incoming?.spending) ? incoming.spending : []
  };
}

async function saveToFirebase() {
  if (!databaseReady || !dbRef) return;

  try {
    await set(dbRef, data);
    setStatus("Live Synced", true);
  } catch (error) {
    console.error(error);
    setStatus("Sync Error", false);
    alert("Firebase save failed. Check your Firebase config and database rules.");
  }
}

function startFirebase() {
  try {
    const app = initializeApp(firebaseConfig);
    const database = getDatabase(app);
    dbRef = ref(database, DATABASE_PATH);
    databaseReady = true;

    onValue(dbRef, (snapshot) => {
      const incoming = snapshot.val();

      if (!incoming) {
        saveToFirebase();
        return;
      }

      data = mergeWithDefaults(incoming);
      updateDashboard();
      setStatus("Live Synced", true);
    }, (error) => {
      console.error(error);
      setStatus("Sync Blocked", false);
      alert("Firebase read failed. Check your Realtime Database rules.");
    });
  } catch (error) {
    console.error(error);
    setStatus("Firebase Config Needed", false);
  }
}

function updateRemaining() {
  const made = getInputNumber("dailyMade");

  const assigned =
    getInputNumber("carInput") +
    getInputNumber("savingsInput") +
    getInputNumber("restockInput") +
    getInputNumber("emergencyInput") +
    getInputNumber("spendingInput");

  const remaining = made - assigned;
  $("remainingAmount").textContent = money(remaining);
  $("remainingAmount").style.color = remaining < 0 ? "#fb7185" : "#fff7f7";
}

function clearDailyForm() {
  [
    "dailyMade",
    "carInput",
    "savingsInput",
    "restockInput",
    "emergencyInput",
    "spendingInput"
  ].forEach((id) => {
    $(id).value = "";
  });

  updateRemaining();
}

function saveToday() {
  const made = getInputNumber("dailyMade");

  const split = {
    car: getInputNumber("carInput"),
    savings: getInputNumber("savingsInput"),
    restock: getInputNumber("restockInput"),
    emergency: getInputNumber("emergencyInput"),
    spending: getInputNumber("spendingInput")
  };

  const assigned =
    split.car +
    split.savings +
    split.restock +
    split.emergency +
    split.spending;

  if (made <= 0) {
    alert("Enter how much money you made today first.");
    return;
  }

  if (Math.abs(made - assigned) > 0.001) {
    alert("Your split must equal today’s money. Check the remaining amount.");
    return;
  }

  data.totals.car += split.car;
  data.totals.savings += split.savings;
  data.totals.restock += split.restock;
  data.totals.emergency += split.emergency;

  data.history.push({
    date: new Date().toISOString(),
    made,
    ...split,
    carTotalAfter: data.totals.car
  });

  clearDailyForm();
  updateDashboard();
  saveToFirebase();
}

function addSpending() {
  const name = $("spendingName").value.trim();
  const amount = getInputNumber("spendingAmount");

  if (!name || amount <= 0) {
    alert("Enter what you bought and how much it cost.");
    return;
  }

  data.spending.push({
    date: new Date().toISOString(),
    name,
    amount
  });

  $("spendingName").value = "";
  $("spendingAmount").value = "";

  updateDashboard();
  saveToFirebase();
}

function updateCarGoal() {
  data.carGoal = getInputNumber("carGoalAmount");
  updateDashboard();
  saveToFirebase();
}

function resetAllData() {
  const yes = confirm("Are you sure you want to reset the whole dashboard?");
  if (!yes) return;

  data = structuredClone(defaultData);
  updateDashboard();
  saveToFirebase();
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString();
}

function updateSpendingList() {
  const list = $("spendingList");
  list.innerHTML = "";

  if (data.spending.length === 0) {
    list.innerHTML = `<li class="empty">No spending added yet.</li>`;
  } else {
    [...data.spending].reverse().slice(0, 8).forEach((item) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span>${formatDate(item.date)} — <strong>${item.name}</strong></span>
        <strong>${money(item.amount)}</strong>
      `;
      list.appendChild(li);
    });
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const weeklyTotal = data.spending.reduce((sum, item) => {
    const itemDate = new Date(item.date);
    return itemDate >= sevenDaysAgo ? sum + Number(item.amount || 0) : sum;
  }, 0);

  $("weeklySpending").textContent = money(weeklyTotal);
}

function updateHistoryList() {
  const list = $("historyList");
  list.innerHTML = "";

  if (data.history.length === 0) {
    list.innerHTML = `<li class="empty">No saved days yet.</li>`;
    return;
  }

  [...data.history].reverse().slice(0, 8).forEach((day) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${formatDate(day.date)} — Made <strong>${money(day.made)}</strong></span>
      <strong>Car +${money(day.car)}</strong>
    `;
    list.appendChild(li);
  });
}

function updatePrediction() {
  const carDays = data.history.filter((day) => Number(day.car) > 0);

  if (carDays.length < 2) {
    $("predictionText").textContent =
      "Save at least two days toward your car goal to see a prediction.";
    return;
  }

  const totalCarAdded = carDays.reduce((sum, day) => sum + Number(day.car || 0), 0);
  const averagePerSaveDay = totalCarAdded / carDays.length;
  const amountLeft = Number(data.carGoal || 0) - Number(data.totals.car || 0);

  if (amountLeft <= 0) {
    $("predictionText").textContent = "Goal reached. You did it.";
    return;
  }

  const daysLeft = Math.ceil(amountLeft / averagePerSaveDay);
  const reachDate = new Date();
  reachDate.setDate(reachDate.getDate() + daysLeft);

  $("predictionText").textContent =
    `At your current pace, you could reach your car goal by ${reachDate.toLocaleDateString()}.`;
}

function drawCarChart() {
  const canvas = $("carChart");
  const ctx = canvas.getContext("2d");
  const width = canvas.width = canvas.offsetWidth;
  const height = canvas.height = 180;

  ctx.clearRect(0, 0, width, height);

  const points = data.history.map((day) => Number(day.carTotalAfter || 0));

  if (points.length === 0) {
    ctx.fillStyle = "#f5b4b4";
    ctx.font = "14px Arial";
    ctx.fillText("Your car savings graph will show here.", 20, 92);
    return;
  }

  const max = Math.max(...points, Number(data.carGoal || 0), 1);
  const padding = 26;

  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padding, height - padding);
  ctx.lineTo(width - padding, height - padding);
  ctx.stroke();

  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 4;
  ctx.beginPath();

  points.forEach((point, index) => {
    const x =
      padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);

    const y =
      height - padding - (point / max) * (height - padding * 2);

    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();

  points.forEach((point, index) => {
    const x =
      padding + (index / Math.max(points.length - 1, 1)) * (width - padding * 2);

    const y =
      height - padding - (point / max) * (height - padding * 2);

    ctx.fillStyle = "#ef4444";
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function updateDashboard() {
  const car = Number(data.totals.car || 0);
  const savings = Number(data.totals.savings || 0);
  const restock = Number(data.totals.restock || 0);
  const emergency = Number(data.totals.emergency || 0);
  const totalSaved = car + savings + restock + emergency;

  $("totalSaved").textContent = money(totalSaved);
  $("carTotal").textContent = money(car);
  $("savingsTotal").textContent = money(savings);
  $("restockTotal").textContent = money(restock);
  $("emergencyTotal").textContent = money(emergency);

  $("carGoalAmount").value = Number(data.carGoal || 0);
  $("carSavedText").textContent = money(car);

  const amountLeft = Math.max(Number(data.carGoal || 0) - car, 0);
  const percent =
    Number(data.carGoal || 0) > 0
      ? Math.min((car / Number(data.carGoal || 0)) * 100, 100)
      : 0;

  $("carLeftText").textContent = money(amountLeft);
  $("carPercentText").textContent = `${percent.toFixed(1)}%`;
  $("carProgressBar").style.width = `${percent}%`;

  updatePrediction();
  updateSpendingList();
  updateHistoryList();
  drawCarChart();
}

[
  "dailyMade",
  "carInput",
  "savingsInput",
  "restockInput",
  "emergencyInput",
  "spendingInput"
].forEach((id) => {
  $(id).addEventListener("input", updateRemaining);
});

$("saveTodayBtn").addEventListener("click", saveToday);
$("addSpendingBtn").addEventListener("click", addSpending);
$("resetDailyBtn").addEventListener("click", clearDailyForm);
$("resetAllBtn").addEventListener("click", resetAllData);
$("carGoalAmount").addEventListener("change", updateCarGoal);

window.addEventListener("resize", drawCarChart);

updateDashboard();
updateRemaining();
startFirebase();
