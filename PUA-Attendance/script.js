
const STORAGE_KEY = 'attendance_history_v1';
const WEEK_TARGET = 35.0; // hours

function loadHistory(){
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}
function saveHistory(arr){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

function isoDate(dt){ return dt.toISOString(); }
function dateOnly(dt){ return dt.toISOString().slice(0,10); }
function fmtTime(dt){
  if(!dt) return '-';
  const d = new Date(dt);
  return d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
}
function fmtDate(dt){
  return new Date(dt).toLocaleDateString();
}
function roundUpQuarter(d){
  const t = new Date(d);
  const m = t.getMinutes();
  const rem = m % 15;
  if(rem === 0 && t.getSeconds()===0 && t.getMilliseconds()===0) return new Date(t.getFullYear(),t.getMonth(),t.getDate(),t.getHours(),t.getMinutes());
  let add = (15 - rem);
  t.setMinutes(t.getMinutes() + add);
  t.setSeconds(0); t.setMilliseconds(0);
  return t;
}
function durationHours(inIso, outIso){
  if(!inIso || !outIso) return 0;
  const a = new Date(inIso), b = new Date(outIso);
  const diff = (b - a) / (1000*60*60);
  return Math.max(0, diff);
}

function rebuildUI(){
  const arr = loadHistory();
  arr.sort((a,b)=> new Date(b.date) - new Date(a.date));
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';
  let todayHours = 0;
  const todayKey = dateOnly(new Date());
  arr.forEach((e, idx)=>{
    const durH = e.checkIn && e.checkOut ? durationHours(e.checkIn, e.checkOut) : 0;
    if(e.date === todayKey) todayHours += durH;
    const tr = document.createElement('tr');
    const dateTd = document.createElement('td'); dateTd.textContent = e.date;
    const inTd = document.createElement('td'); inTd.textContent = e.checkIn ? fmtTime(e.checkIn) : '-';
    const outTd = document.createElement('td'); outTd.textContent = e.checkOut ? fmtTime(e.checkOut) : '-';
    const durTd = document.createElement('td'); durTd.textContent = durH ? durH.toFixed(2)+' h' : '-';
    const editTd = document.createElement('td');
    const editBtn = document.createElement('button');
    editBtn.className='btn ghost';
    editBtn.innerHTML = '<span class="material-icons">edit</span>';
    editBtn.onclick = ()=> openEditModal(e.date);
    editTd.appendChild(editBtn);
    tr.appendChild(dateTd);
    tr.appendChild(inTd);
    tr.appendChild(outTd);
    tr.appendChild(durTd);
    tr.appendChild(editTd);
    tbody.appendChild(tr);
  });

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - (now.getDay() % 7));
  startOfWeek.setHours(0,0,0,0);
  let weekTotal = 0;
  arr.forEach(e=>{
    const ed = new Date(e.date + 'T00:00:00');
    if(ed >= startOfWeek){
      if(e.checkIn && e.checkOut) weekTotal += durationHours(e.checkIn, e.checkOut);
    }
  });
  const percent = Math.min(1, weekTotal / WEEK_TARGET);
  document.getElementById('barInner').style.width = (percent*100)+'%';
  document.getElementById('percentLabel').textContent = Math.round(percent*100)+'%';
  document.getElementById('hoursLabel').textContent = weekTotal.toFixed(2)+'h';
  document.getElementById('weekLabel').textContent = `Week: ${weekTotal.toFixed(2)} / ${WEEK_TARGET.toFixed(2)} h`;
  document.getElementById('todayWorked').textContent = todayHours.toFixed(2);

  if(arr.length){
    const last = arr[arr.length-1];
    let la = '—';
    if(last.checkOut) la = 'Check Out at ' + fmtTime(last.checkOut);
    else if(last.checkIn) la = 'Check In at ' + fmtTime(last.checkIn);
    document.getElementById('lastAction').textContent = la;
  } else {
    document.getElementById('lastAction').textContent = '—';
  }
}

function punchNow(){
  const now = new Date();
  const rounded = roundUpQuarter(now);
  const dateKey = dateOnly(now);
  const arr = loadHistory();
  let today = arr.find(x=>x.date === dateKey);
  const limitEntry = new Date(now.getFullYear(),now.getMonth(),now.getDate(),11,0,0);
  if(now < limitEntry){
    if(!today){
      today = {date: dateKey, checkIn: isoDate(rounded), checkOut: null};
      arr.push(today);
      saveHistory(arr);
      alert(`Recorded check-in at ${fmtTime(today.checkIn)}`);
    } else if(!today.checkIn){
      today.checkIn = isoDate(rounded);
      saveHistory(arr);
      alert(`Edited check-in to ${fmtTime(today.checkIn)}`);
    } else {
      alert('You already have a check-in today.');
    }
  } else {
    if(!today){
      today = {date: dateKey, checkIn: null, checkOut: isoDate(rounded)};
      arr.push(today);
      saveHistory(arr);
      alert(`Recorded check-out at ${fmtTime(today.checkOut)}`);
    } else if(!today.checkOut){
      today.checkOut = isoDate(rounded);
      saveHistory(arr);
      alert(`Recorded check-out at ${fmtTime(today.checkOut)}`);
    } else {
      alert('You already have a check-out today.');
    }
  }
  rebuildUI();
}

document.getElementById('clearAll').addEventListener('click', ()=>{
  if(confirm('Are you sure you want to clear all history?')) {
    localStorage.removeItem(STORAGE_KEY);
    rebuildUI();
  }
});
document.getElementById('fingerBtn').addEventListener('click', punchNow);


const appRoot = document.getElementById('app');
document.getElementById('themeBtn').addEventListener('click', ()=>{
  const cur = appRoot.getAttribute('data-theme');
  appRoot.setAttribute('data-theme', cur==='light'?'dark':'light');
});

const modal = document.getElementById('modal');
const inpIn = document.getElementById('inpIn');
const inpOut = document.getElementById('inpOut');
let currentEditDate = null;

function openEditModal(dateStr){
  currentEditDate = dateStr;
  const arr = loadHistory();
  const e = arr.find(x=>x.date===dateStr);
  document.getElementById('editDate').textContent = dateStr;
  if(e && e.checkIn) {
    const d = new Date(e.checkIn);
    inpIn.value = d.toTimeString().slice(0,5);
  } else inpIn.value = '';
  if(e && e.checkOut) {
    const d2 = new Date(e.checkOut);
    inpOut.value = d2.toTimeString().slice(0,5);
  } else inpOut.value = '';
  modal.classList.add('show');
}
document.getElementById('cancelEdit').addEventListener('click', ()=>{ modal.classList.remove('show'); });
document.getElementById('saveEdit').addEventListener('click', ()=>{
  const arr = loadHistory();
  const e = arr.find(x=>x.date===currentEditDate);
  if(!e) { alert('Entry not found'); modal.classList.remove('show'); return; }
  if(inpIn.value){
    const [hh,mm] = inpIn.value.split(':').map(Number);
    const dt = new Date(e.date + 'T00:00:00');
    dt.setHours(hh,mm,0,0);
    e.checkIn = isoDate(roundUpQuarter(dt));
  } else e.checkIn = null;
  if(inpOut.value){
    const [hh2,mm2] = inpOut.value.split(':').map(Number);
    const dt2 = new Date(e.date + 'T00:00:00');
    dt2.setHours(hh2,mm2,0,0);
    e.checkOut = isoDate(roundUpQuarter(dt2));
  } else e.checkOut = null;
  saveHistory(arr);
  modal.classList.remove('show');
  rebuildUI();
});

rebuildUI();

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/TA-attendance-check/sw.js')
      .then(() => console.log('Service Worker registered'))
      .catch(err => console.error('SW registration failed:', err));
  });
}
