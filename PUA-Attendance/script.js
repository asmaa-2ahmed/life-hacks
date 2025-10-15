const STORAGE_KEY = 'attendance_history_v1';
const WORK_DAYS_KEY = 'work_days_v1';
const HOURS_PER_DAY = 7; // ساعات العمل في اليوم الواحد
document.getElementById('app').setAttribute('data-theme', 'dark');

function loadHistory() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}
function saveHistory(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}
function loadWorkDays() {
  const val = localStorage.getItem(WORK_DAYS_KEY);
  return val ? parseInt(val) : null;
}
function saveWorkDays(num) {
  localStorage.setItem(WORK_DAYS_KEY, num);
}

function isoDate(dt) { return dt.toISOString(); }
function dateOnly(dt) { return dt.toISOString().slice(0, 10); }
function fmtTime(dt) {
  if (!dt) return '-';
  const d = new Date(dt);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDate(dt) {
  return new Date(dt).toLocaleDateString();
}
function roundUpQuarter(d) {
  const t = new Date(d);
  const m = t.getMinutes();
  const rem = m % 15;
  if (rem === 0 && t.getSeconds() === 0 && t.getMilliseconds() === 0)
    return new Date(t.getFullYear(), t.getMonth(), t.getDate(), t.getHours(), t.getMinutes());
  let add = 15 - rem;
  t.setMinutes(t.getMinutes() + add);
  t.setSeconds(0); t.setMilliseconds(0);
  return t;
}
function durationHours(inIso, outIso) {
  if (!inIso || !outIso) return 0;
  const a = new Date(inIso), b = new Date(outIso);
  const diff = (b - a) / (1000 * 60 * 60);
  return Math.max(0, diff);
}

function rebuildUI() {
  const arr = loadHistory();
  arr.sort((a, b) => new Date(b.date) - new Date(a.date));
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';

  let todayHours = 0;
  const todayKey = dateOnly(new Date());
  arr.forEach((e) => {
    const durH = e.checkIn && e.checkOut ? durationHours(e.checkIn, e.checkOut) : 0;
    if (e.date === todayKey) todayHours += durH;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${e.date}</td>
      <td>${e.checkIn ? fmtTime(e.checkIn) : '-'}</td>
      <td>${e.checkOut ? fmtTime(e.checkOut) : '-'}</td>
      <td>${durH ? durH.toFixed(2) + ' h' : '-'}</td>
      <td><button class="btn ghost" onclick="openEditModal('${e.date}')"><span class="material-icons">edit</span></button></td>
    `;
    tbody.appendChild(tr);
  });

  const workDays = loadWorkDays();
  const totalWorked = arr.reduce((sum, e) => {
    return sum + (e.checkIn && e.checkOut ? durationHours(e.checkIn, e.checkOut) : 0);
  }, 0);

  const workedDaysCount = arr.filter(e => e.checkIn && e.checkOut).length;
  const expectedHours = workedDaysCount * HOURS_PER_DAY;
  const diff = totalWorked - expectedHours;
  const totalRequired = workDays ? workDays * HOURS_PER_DAY : null;
  const percent = totalRequired ? Math.min(1, totalWorked / totalRequired) : 0;

  // Update UI
  document.getElementById('barInner').style.width = (percent * 100) + '%';
  document.getElementById('percentLabel').textContent = totalRequired ? Math.round(percent * 100) + '%' : '—';
  document.getElementById('hoursLabel').textContent = totalWorked.toFixed(2) + 'h';
  document.getElementById('monthLabel').textContent = totalRequired
    ? `Month: ${totalWorked.toFixed(2)} / ${totalRequired.toFixed(2)} h`
    : 'Month: —';

  // Update today worked hours
  document.getElementById('todayWorked').textContent = todayHours.toFixed(2);

  // Extra / remaining cumulative
  let extraText = '';
  if (workedDaysCount === 0) {
    extraText = 'No records yet';
  } else if (diff > 0) {
    extraText = `✅ Extra ${diff.toFixed(2)} h `;
  } else if (diff < 0) {
    extraText = `⏳ Missing ${Math.abs(diff).toFixed(2)} h `;
  } else {
    extraText = `🕒 On track`;
  }

  // Show extraText inside progress container (instead of chip)
  document.getElementById('extraLabel').textContent = extraText;

  // Last action (use latest date)
  if (arr.length) {
    const last = arr[0]; // latest after sorting desc
    let la = '—';
    if (last.checkOut) la = 'Check Out at ' + fmtTime(last.checkOut);
    else if (last.checkIn) la = 'Check In at ' + fmtTime(last.checkIn);
    document.getElementById('lastAction').textContent = la;
  } else {
    document.getElementById('lastAction').textContent = '—';
  }
}

function punchNow() {
  const now = new Date();
  const rounded = roundUpQuarter(now);
  const dateKey = dateOnly(now);
  const arr = loadHistory();
  let today = arr.find(x => x.date === dateKey);
  const limitEntry = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 11, 0, 0);
  if (now < limitEntry) {
    if (!today) {
      today = { date: dateKey, checkIn: isoDate(rounded), checkOut: null };
      arr.push(today);
      saveHistory(arr);
      alert(`Recorded check-in at ${fmtTime(today.checkIn)}`);
    } else if (!today.checkIn) {
      today.checkIn = isoDate(rounded);
      saveHistory(arr);
      alert(`Edited check-in to ${fmtTime(today.checkIn)}`);
    } else {
      alert('You already have a check-in today.');
    }
  } else {
    if (!today) {
      today = { date: dateKey, checkIn: null, checkOut: isoDate(rounded) };
      arr.push(today);
      saveHistory(arr);
      alert(`Recorded check-out at ${fmtTime(today.checkOut)}`);
    } else if (!today.checkOut) {
      today.checkOut = isoDate(rounded);
      saveHistory(arr);
      alert(`Recorded check-out at ${fmtTime(today.checkOut)}`);
    } else {
      alert('You already have a check-out today.');
    }
  }
  rebuildUI();
}

// ⚙️ Settings icon = set working days
document.getElementById('setDaysBtn').addEventListener('click', () => {
  const cur = loadWorkDays();
  const val = prompt('Enter number of working days this month:', cur || '');
  if (val && !isNaN(val) && val > 0) {
    saveWorkDays(parseInt(val));
    if (confirm('Do you want to reset all history?')) {
      localStorage.removeItem(STORAGE_KEY);
    }
    rebuildUI();
  }
});

// // 🖐️ fingerprint button
// document.getElementById('fingerBtn').addEventListener('click', punchNow);

// document.getElementById('fingerBtn').addEventListener('touchstart', (e) => {
//   e.preventDefault(); // prevent double trigger
//   punchNow();
// });


// 🖐️ Fingerprint button
const fingerBtn = document.getElementById("fingerBtn");

// عند الضغط بالماوس أو اللمس على الموبايل
fingerBtn.addEventListener("click", () => {
  punchNow();
});

fingerBtn.addEventListener("touchstart", (e) => {
  e.preventDefault(); // يمنع التكرار المزدوج
  punchNow();
});


// 🖐️ For touch devices - prevent double trigger
fingerBtn.addEventListener("touchstart", (e) => {
  e.preventDefault();
});



// 🌙 theme toggle + save preference
const appRoot = document.getElementById('app');


const modal = document.getElementById('modal');
const inpIn = document.getElementById('inpIn');
const inpOut = document.getElementById('inpOut');
let currentEditDate = null;

function openEditModal(dateStr) {
  currentEditDate = dateStr;
  const arr = loadHistory();
  const e = arr.find(x => x.date === dateStr);
  document.getElementById('editDate').textContent = dateStr;
  inpIn.value = e && e.checkIn ? new Date(e.checkIn).toTimeString().slice(0, 5) : '';
  inpOut.value = e && e.checkOut ? new Date(e.checkOut).toTimeString().slice(0, 5) : '';
  modal.classList.add('show');
}
document.getElementById('cancelEdit').addEventListener('click', () => { modal.classList.remove('show'); });
document.getElementById('saveEdit').addEventListener('click', () => {
  const arr = loadHistory();
  const e = arr.find(x => x.date === currentEditDate);
  if (!e) { alert('Entry not found'); modal.classList.remove('show'); return; }
  if (inpIn.value) {
    const [hh, mm] = inpIn.value.split(':').map(Number);
    const dt = new Date(e.date + 'T00:00:00');
    dt.setHours(hh, mm, 0, 0);
    e.checkIn = isoDate(roundUpQuarter(dt));
  } else e.checkIn = null;
  if (inpOut.value) {
    const [hh2, mm2] = inpOut.value.split(':').map(Number);
    const dt2 = new Date(e.date + 'T00:00:00');
    dt2.setHours(hh2, mm2, 0, 0);
    e.checkOut = isoDate(roundUpQuarter(dt2));
  } else e.checkOut = null;
  saveHistory(arr);
  modal.classList.remove('show');
  rebuildUI();
});

rebuildUI();

// Offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/TA-attendance-check/sw.js')
      .then(() => console.log('Service Worker registered'))
      .catch(err => console.error('SW registration failed:', err));
  });
}
