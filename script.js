const $ = (id) => document.getElementById(id);
const STORAGE_KEY = "greenpastures_farm_v1";
const animalEmoji = { Cow: "🐄", Buffalo: "🐃", Goat: "🐐", Sheep: "🐑", Chicken: "🐔", Pig: "🐖", Horse: "🐎", Duck: "🦆", Other: "🐾" };

let state = loadState();
const firedAlarms = new Set();
let bannerTimeout;

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { animals: [], feedings: [], done: {} };
  } catch {
    return { animals: [], feedings: [], done: {} };
  }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[char]));
}
function formatTime(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function render() {
  $("todayLabel").textContent = new Date().toLocaleDateString([], {
    weekday: "long", month: "short", day: "numeric", year: "numeric"
  });

  $("totalAnimals").textContent = state.animals.reduce((sum, animal) => sum + Number(animal.qty), 0);
  $("animalTypes").textContent = new Set(state.animals.map((animal) => animal.type)).size;
  $("feedingCount").textContent = state.feedings.length;
  $("completedCount").textContent = (state.done[todayKey()] || []).length;

  const selectedAnimal = $("feedAnimal").value;
  $("feedAnimal").innerHTML = state.animals.length
    ? state.animals.map((animal) => `<option value="${animal.id}">${escapeHTML(animal.name)} (${escapeHTML(animal.type)})</option>`).join("")
    : '<option value="">Add an animal first</option>';
  if (state.animals.some((animal) => animal.id === selectedAnimal)) $("feedAnimal").value = selectedAnimal;

  renderAnimals();
  renderFeedings();
}

function renderAnimals() {
  const query = $("animalSearch").value.trim().toLowerCase();
  const animals = state.animals.filter((animal) =>
    `${animal.name} ${animal.type} ${animal.notes || ""}`.toLowerCase().includes(query)
  );

  if (!animals.length) {
    $("animalTableWrap").innerHTML = `<div class="empty"><span>🐄</span><strong>${query ? "No matching animals" : "Your farm is ready for its first animal"}</strong><p>${query ? "Try a different search." : "Add your first animal using the form."}</p></div>`;
    return;
  }

  $("animalTableWrap").innerHTML = `
    <table><thead><tr><th>Animal / group</th><th>Type</th><th>Qty</th><th>Notes</th><th>Action</th></tr></thead>
    <tbody>${animals.map((animal) => `
      <tr>
        <td><div class="animal-name"><span class="animal-emoji">${animalEmoji[animal.type] || "🐾"}</span>${escapeHTML(animal.name)}</div></td>
        <td>${escapeHTML(animal.type)}</td><td><strong>${Number(animal.qty)}</strong></td>
        <td>${escapeHTML(animal.notes || "—")}</td>
        <td><button class="remove-button" type="button" data-remove-animal="${animal.id}">Remove</button></td>
      </tr>`).join("")}
    </tbody></table>`;
}

function renderFeedings() {
  const feedings = [...state.feedings].sort((a, b) => a.time.localeCompare(b.time));
  if (!feedings.length) {
    $("feedingList").innerHTML = '<div class="empty"><span>🌾</span><strong>No feeding reminders yet</strong><p>Add a daily reminder to build your plan.</p></div>';
    return;
  }

  const completed = state.done[todayKey()] || [];
  $("feedingList").innerHTML = feedings.map((feeding) => {
    const animal = state.animals.find((item) => item.id === feeding.animalId);
    const isDone = completed.includes(feeding.id);
    return `<div class="feed-item ${isDone ? "done" : ""}">
      <div class="feed-time">${formatTime(feeding.time)}</div>
      <div class="feed-info"><strong>${escapeHTML(feeding.label)}</strong><small>${escapeHTML(animal?.name || "Removed animal")} · ${escapeHTML(animal?.type || "")}</small></div>
      <div class="feed-actions">
        <button class="button button-light button-small" type="button" data-toggle-feed="${feeding.id}">${isDone ? "Undo" : "✓ Fed"}</button>
        <button class="remove-button" type="button" data-remove-feed="${feeding.id}" aria-label="Delete reminder">×</button>
      </div>
    </div>`;
  }).join("");
}

$("animalForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("animalName").value.trim();
  const qty = Number($("animalQty").value);
  if (!name || !Number.isInteger(qty) || qty < 1) return;

  state.animals.push({
    id: makeId(), name, type: $("animalType").value,
    qty, notes: $("animalNotes").value.trim()
  });
  saveState();
  event.target.reset();
  $("animalQty").value = "1";
  render();
});

$("feedingForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!state.animals.length) {
    alert("Please add an animal first.");
    return;
  }
  state.feedings.push({
    id: makeId(), animalId: $("feedAnimal").value,
    time: $("feedTime").value, label: $("feedLabel").value
  });
  saveState();
  render();
});

$("animalSearch").addEventListener("input", renderAnimals);

document.addEventListener("click", (event) => {
  const removeAnimalButton = event.target.closest("[data-remove-animal]");
  if (removeAnimalButton) {
    const animal = state.animals.find((item) => item.id === removeAnimalButton.dataset.removeAnimal);
    if (!animal) return;
    if (confirm(`Remove "${animal.name}" from your farm? Its feeding reminders will also be removed.`)) {
      state.animals = state.animals.filter((item) => item.id !== animal.id);
      state.feedings = state.feedings.filter((item) => item.animalId !== animal.id);
      saveState();
      render();
    }
    return;
  }

  const removeFeedButton = event.target.closest("[data-remove-feed]");
  if (removeFeedButton) {
    state.feedings = state.feedings.filter((item) => item.id !== removeFeedButton.dataset.removeFeed);
    saveState();
    render();
    return;
  }

  const toggleButton = event.target.closest("[data-toggle-feed]");
  if (toggleButton) {
    const day = todayKey();
    state.done[day] ||= [];
    const id = toggleButton.dataset.toggleFeed;
    state.done[day] = state.done[day].includes(id)
      ? state.done[day].filter((item) => item !== id)
      : [...state.done[day], id];
    saveState();
    render();
  }
});

function playAlarmSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    [0, 0.28, 0.56].forEach((delay, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = index === 1 ? 880 : 660;
      oscillator.connect(gain);
      gain.connect(context.destination);
      gain.gain.setValueAtTime(0.0001, context.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.22, context.currentTime + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + delay + 0.2);
      oscillator.start(context.currentTime + delay);
      oscillator.stop(context.currentTime + delay + 0.22);
    });
    setTimeout(() => context.close(), 1200);
  } catch (error) {
    console.warn("Alarm sound could not play.", error);
  }
}

function triggerAlarm(feeding) {
  const animal = state.animals.find((item) => item.id === feeding.animalId);
  const message = `${feeding.label} for ${animal?.name || "your animals"} (${animal?.type || "animal group"}).`;
  $("alarmText").textContent = message;
  $("alarmBanner").classList.add("active");
  playAlarmSound();

  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification("GreenPastures: Feeding time", { body: message, tag: feeding.id });
    } catch (error) {
      console.warn("Notification could not be displayed.", error);
    }
  }
  clearTimeout(bannerTimeout);
  bannerTimeout = setTimeout(() => $("alarmBanner").classList.remove("active"), 60000);
}

function checkFeedingTimes() {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const stampPrefix = `${todayKey()}-${currentTime}`;
  const completed = state.done[todayKey()] || [];

  state.feedings.forEach((feeding) => {
    const alarmId = `${stampPrefix}-${feeding.id}`;
    if (feeding.time === currentTime && !firedAlarms.has(alarmId) && !completed.includes(feeding.id)) {
      firedAlarms.add(alarmId);
      triggerAlarm(feeding);
    }
  });
  if (firedAlarms.size > 1000) firedAlarms.clear();
}

$("enableNotifications").addEventListener("click", async () => {
  if (!("Notification" in window)) {
    alert("This browser does not support desktop notifications. The on-page alarm can still work while this page is open.");
    return;
  }
  try {
    const permission = await Notification.requestPermission();
    alert(permission === "granted"
      ? "Notifications enabled. Keep this page open for reminders."
      : "Notifications were not enabled. The on-page alarm can still work while this page is open.");
  } catch {
    alert("Could not request notification permission in this browser.");
  }
});

$("dismissAlarm").addEventListener("click", () => $("alarmBanner").classList.remove("active"));
$("testAlarm").addEventListener("click", () => {
  triggerAlarm({ id: "test-alarm", animalId: state.animals[0]?.id, label: "Test alarm" });
});

render();
checkFeedingTimes();
setInterval(checkFeedingTimes, 1000);
