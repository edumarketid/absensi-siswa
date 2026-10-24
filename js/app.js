function bukaHalamanLaporan() { window.open("./laporan.html", "_blank"); }
function bukaHalamanCetakQR() { window.open("./kartuqrcode.html", "_blank"); }

function renderMenuModalGrid() {
  const grid = document.getElementById("menu-grid-box");
  if (!grid) return;
  const isAdmin = (currentUserRole === "ADMIN");

  const items = [
    { label: "Ibadah Siswa", icon: "fa-mosque", color: "emerald", action: "window.open('https://mengaji.smknegeri1wakatobi.sch.id', '_blank')", adminOnly: false },
    { label: "Absensi Guru", icon: "fa-chalkboard-user", color: "blue", action: "window.open('https://s.id/AbsensiGuruSMKN1Wakatobi', '_blank')", adminOnly: false },
    { label: "Unggah Kolektif", icon: "fa-file-excel", color: "emerald", action: "toggleView('upload-batch')", adminOnly: true },
    { label: "Tambah Siswa", icon: "fa-user-plus", color: "teal", action: "toggleAddStudentModal()", adminOnly: true },
    { label: "Edit Data Siswa", icon: "fa-user-pen", color: "indigo", action: "toggleView('edit-students')", adminOnly: true },
    { label: "Atur Hari Libur", icon: "fa-calendar-day", color: "amber", action: "toggleView('hari-libur')", adminOnly: true },
    { label: "Tindak Lanjut", icon: "fa-user-shield", color: "rose", action: "toggleView('tindak-lanjut')", adminOnly: true },
    { label: "Pindah/Naik Kelas", icon: "fa-graduation-cap", color: "purple", action: "toggleView('promotion')", adminOnly: true },
    { label: "Laporan Rekap", icon: "fa-file-invoice", color: "blue", action: "bukaHalamanLaporan()", adminOnly: true },
    { label: "Cetak QR Code", icon: "fa-print", color: "indigo", action: "bukaHalamanCetakQR()", adminOnly: true },
    { label: "Tentang Aplikasi", icon: "fa-circle-info", color: "teal", action: "toggleView('about')", adminOnly: false },
    { label: "Pengaturan", icon: "fa-gear", color: "purple", action: "toggleView('settings')", adminOnly: true }
  ];

  let htmlContent = items.map(item => {
    const isDisabled = item.adminOnly && !isAdmin;
    if (isDisabled) {
      return `
        <div onclick="alert('Menu khusus Admin! Silakan login admin terlebih dahulu.')" class="p-3 bg-gray-100 border border-gray-200 rounded-2xl flex flex-col items-center justify-center gap-1.5 opacity-50 cursor-not-allowed">
          <i class="fa-solid ${item.icon} text-xl text-gray-400"></i>
          <span class="text-xs font-bold text-gray-500">${item.label}</span>
        </div>
      `;
    } else {
      return `
        <button onclick="toggleMenuModal(); ${item.action};" class="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col items-center justify-center gap-1.5 hover:bg-${item.color}-50 transition">
          <i class="fa-solid ${item.icon} text-xl text-${item.color}-600"></i>
          <span class="text-xs font-bold text-gray-800">${item.label}</span>
        </button>
      `;
    }
  }).join('');

  grid.innerHTML = htmlContent;
}

function getTodayTimeConfig(dateObj) {
  const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const dayKey = dayKeys[dateObj.getDay()];
  const def = DEFAULT_TIME_CONFIGS[dayKey];

  const rawActive = localStorage.getItem(`DAY_ACTIVE_${dayKey}`);
  const active = parseBool(rawActive, def.active);
  
  const rawPStart = localStorage.getItem(`TIME_${dayKey}_PAGI_START`);
  const rawPLimit = localStorage.getItem(`TIME_${dayKey}_PAGI_LIMIT`);
  const rawSStart = localStorage.getItem(`TIME_${dayKey}_SIANG_START`);
  const rawSLimit = localStorage.getItem(`TIME_${dayKey}_SIANG_LIMIT`);

  const pStart = padZeroTime(rawPStart && rawPStart.includes(":") ? rawPStart : def.pStart);
  const pLimit = padZeroTime(rawPLimit && rawPLimit.includes(":") ? rawPLimit : def.pLimit);
  const sStart = padZeroTime(rawSStart && rawSStart.includes(":") ? rawSStart : def.sStart);
  const sLimit = padZeroTime(rawSLimit && rawSLimit.includes(":") ? rawSLimit : def.sLimit);

  return { dayKey, active, pStart, pLimit, sStart, sLimit };
}

function autoDetectOrSyncSessionMode(timeStr, targetDateObj) {
  if (!targetDateObj) targetDateObj = new Date();
  const timeClean = padZeroTime(timeStr);
  const config = getTodayTimeConfig(targetDateObj);
  const textEl = document.getElementById("session-mode-text");
  const iconEl = document.getElementById("session-icon");

  if (!config.active) {
    if (textEl) textEl.innerText = "Hari Libur";
    if (iconEl) iconEl.className = "fa-solid fa-umbrella-beach text-amber-400 text-xs";
    currentScanSession = "PAGI";
    return;
  }

  if (timeClean < config.pStart) {
    if (textEl) textEl.innerText = "Belum Mulai";
    if (iconEl) iconEl.className = "fa-solid fa-hourglass-start text-amber-400 text-xs";
    currentScanSession = "PAGI";
  } else if (timeClean >= config.pStart && timeClean <= config.pLimit) {
    if (textEl) textEl.innerText = "Mode Pagi";
    if (iconEl) iconEl.className = "fa-solid fa-sun text-amber-400 text-xs";
    currentScanSession = "PAGI";
  } else if (timeClean > config.pLimit && timeClean < config.sStart) {
    if (textEl) textEl.innerText = "Terlambat";
    if (iconEl) iconEl.className = "fa-solid fa-triangle-exclamation text-amber-400 text-xs";
    currentScanSession = "PAGI";
  } else if (timeClean >= config.sStart && timeClean <= config.sLimit) {
    if (textEl) textEl.innerText = "Mode Siang";
    if (iconEl) iconEl.className = "fa-solid fa-cloud-sun text-blue-400 text-xs";
    currentScanSession = "SIANG";
  } else {
    if (textEl) textEl.innerText = "Selesai";
    if (iconEl) iconEl.className = "fa-solid fa-circle-check text-emerald-400 text-xs";
    currentScanSession = "SIANG";
  }
}

function toggleTimeModeSetting() {
  if (!isManualTimeMode) {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    const nowTimeStr = padZeroTime(d.toTimeString().split(' ')[0].substring(0, 5));
    
    const inputDate = prompt("Mode Manual: Tanggal Scan (YYYY-MM-DD):", todayStr);
    if (!inputDate || !inputDate.trim()) return;
    const inputTime = prompt("Mode Manual: Jam Scan (HH:MM):", nowTimeStr);
    if (!inputTime || !inputTime.trim()) return;

    isManualTimeMode = true;
    customScanDateOverride = formatCleanDateLocal(inputDate.trim());
    customScanTimeOverride = padZeroTime(inputTime.trim());
  } else {
    isManualTimeMode = false;
    customScanDateOverride = null;
    customScanTimeOverride = null;
  }
  
  updateTimeModeIndicator();
  refreshRealtimeSessionUI();
}

function updateTimeModeIndicator() {
  const indicator = document.getElementById("scan-mode-indicator");
  if (!indicator) return;
  if (isManualTimeMode && customScanDateOverride && customScanTimeOverride) {
    indicator.innerText = `MANUAL (${customScanDateOverride} ${customScanTimeOverride})`;
  } else {
    indicator.innerText = "Mode Waktu: AUTO (Realtime)";
  }
}

function refreshRealtimeSessionUI() {
  let activeDateObj = new Date();
  let activeTimeStr = padZeroTime(activeDateObj.toTimeString().split(' ')[0].substring(0, 5));

  if (isManualTimeMode && customScanDateOverride && customScanTimeOverride) {
    activeDateObj = new Date(customScanDateOverride + "T00:00:00");
    activeTimeStr = customScanTimeOverride;
  }

  autoDetectOrSyncSessionMode(activeTimeStr, activeDateObj);
}

function previewCSVFile() {
  const fileInput = document.getElementById('input-csv-file');
  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const lines = text.split(/\r\n|\n/);
    parsedBatchStudents = [];

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const cols = parseCSVLine(lines[i]);

      if (cols.length >= 3 && cols[0]) {
        parsedBatchStudents.push({
          id_siswa: cols[0],
          nisn: cols[1] || "-",
          nama: cols[2] || "",
          kelas: cols[3] || "Umum",
          ttl: cols[4] || "-",
          active: true
        });
      }
    }

    const previewContainer = document.getElementById('csv-preview-container');
    const previewCount = document.getElementById('csv-preview-count');
    const previewBox = document.getElementById('csv-preview-table-box');

    if (parsedBatchStudents.length > 0) {
      previewCount.innerText = `${parsedBatchStudents.length} Siswa Terbaca`;
      previewBox.innerHTML = parsedBatchStudents.map((s, idx) => `
        <div class="p-1.5 bg-white rounded-lg border border-gray-100 flex flex-col gap-0.5">
          <div class="flex items-center justify-between">
            <b>${idx + 1}. ${s.nama}</b> 
            <span class="text-[9px] font-extrabold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded">${s.kelas}</span>
          </div>
          <div class="text-[9px] text-gray-500 flex justify-between">
            <span>ID: ${s.id_siswa} | NISN: ${s.nisn}</span>
            <span class="font-bold text-gray-700">TTL: ${s.ttl}</span>
          </div>
        </div>
      `).join('');
      previewContainer.classList.remove('hidden');
    } else {
      alert("File CSV tidak berisi data yang valid.");
      previewContainer.classList.add('hidden');
    }
  };
  reader.readAsText(file);
}

async function processBatchUploadSiswa() {
  if (parsedBatchStudents.length === 0) return alert("Belum ada data siswa yang terbaca.");

  const btn = document.getElementById('btn-process-upload-batch');
  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan ${parsedBatchStudents.length} Siswa...`;

  const tx = db.transaction("students", "readwrite");
  const store = tx.objectStore("students");
  parsedBatchStudents.forEach(s => store.put(s));

  tx.oncomplete = async () => {
    loadStudentsView();
    populateClassDropdowns();

    if (navigator.onLine) {
      try {
        const mappedForSupabase = parsedBatchStudents.map(s => ({
          id_siswa: s.id_siswa,
          ID_SISWA: s.id_siswa,
          nisn: s.nisn,
          NISN: s.nisn,
          nama_siswa: s.nama,
          NAMA_SISWA: s.nama,
          kelas: s.kelas,
          KELAS: s.kelas,
          ttl: s.ttl,
          TTL: s.ttl,
          status: s.active ? 'Aktif' : 'Non-Aktif',
          STATUS: s.active ? 'Aktif' : 'Non-Aktif',
          qr_code_key: s.id_siswa,
          QR_CODE_KEY: s.id_siswa
        }));

        const { error } = await supabaseClient.from('siswa').upsert(mappedForSupabase, { onConflict: 'id_siswa' });
        if (!error) {
          alert("Data siswa kolektif berhasil disimpan ke Server!");
        } else {
          alert("Gagal memperbarui Server: " + error.message);
        }
      } catch (e) {
        alert("Data tersimpan di HP secara offline.");
      }
    } else {
      alert("Data siswa tersimpan secara lokal offline di HP.");
    }

    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Simpan Data Siswa ke System`;
    document.getElementById('input-csv-file').value = "";
    document.getElementById('csv-preview-container').classList.add('hidden');
    parsedBatchStudents = [];
    toggleView('students');
  };
}

async function renderTimeSettingsSummary() {
  const container = document.getElementById("saved-time-summary-box");
  if (!container) return;

  let html = "";
  DAYS_LIST.forEach(day => {
    const def = DEFAULT_TIME_CONFIGS[day.key];
    const rawActive = localStorage.getItem(`DAY_ACTIVE_${day.key}`);
    const active = parseBool(rawActive, def.active);
    
    const rawPStart = localStorage.getItem(`TIME_${day.key}_PAGI_START`);
    const rawPLimit = localStorage.getItem(`TIME_${day.key}_PAGI_LIMIT`);
    const rawSStart = localStorage.getItem(`TIME_${day.key}_SIANG_START`);
    const rawSLimit = localStorage.getItem(`TIME_${day.key}_SIANG_LIMIT`);

    const pStart = padZeroTime(rawPStart && rawPStart.includes(":") ? rawPStart : def.pStart);
    const pLimit = padZeroTime(rawPLimit && rawPLimit.includes(":") ? rawPLimit : def.pLimit);
    const sStart = padZeroTime(rawSStart && rawSStart.includes(":") ? rawSStart : def.sStart);
    const sLimit = padZeroTime(rawSLimit && rawSLimit.includes(":") ? rawSLimit : def.sLimit);

    html += `
      <div class="p-2 bg-slate-50 border border-gray-100 rounded-xl flex items-center justify-between text-[10px]">
        <div>
          <span class="font-bold text-gray-900">${day.label}</span>
          ${active ? 
            `<p class="text-gray-500">Pagi: <b class="text-emerald-700">${pStart} -${pLimit}</b> | Siang: <b class="text-blue-700">${sStart} -${sLimit}</b></p>` : 
            `<p class="text-rose-500 font-semibold">Status: Libur / Non-Aktif</p>`
          }
        </div>
        <span class="px-2 py-0.5 rounded-md font-bold text-[9px] ${active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-500'}">
          ${active ? 'Aktif' : 'Libur'}
        </span>
      </div>
    `;
  });
  container.innerHTML = html;
}

function renderDaysConfigForm() {
  const container = document.getElementById("days-config-container");
  if (!container) return;
  let html = "";
  DAYS_LIST.forEach(day => {
    const def = DEFAULT_TIME_CONFIGS[day.key];
    const rawActive = localStorage.getItem(`DAY_ACTIVE_${day.key}`);
    const active = parseBool(rawActive, def.active);
    
    const rawPStart = localStorage.getItem(`TIME_${day.key}_PAGI_START`);
    const rawPLimit = localStorage.getItem(`TIME_${day.key}_PAGI_LIMIT`);
    const rawSStart = localStorage.getItem(`TIME_${day.key}_SIANG_START`);
    const rawSLimit = localStorage.getItem(`TIME_${day.key}_SIANG_LIMIT`);

    const pStart = padZeroTime(rawPStart && rawPStart.includes(":") ? rawPStart : def.pStart);
    const pLimit = padZeroTime(rawPLimit && rawPLimit.includes(":") ? rawPLimit : def.pLimit);
    const sStart = padZeroTime(rawSStart && rawSStart.includes(":") ? rawSStart : def.sStart);
    const sLimit = padZeroTime(rawSLimit && rawSLimit.includes(":") ? rawSLimit : def.sLimit);

    html += `
      <div class="p-3 bg-slate-50 border border-gray-200 rounded-xl space-y-2">
        <div class="flex items-center justify-between border-b border-gray-200 pb-1.5">
          <span class="font-bold text-xs ${day.key === 'sun' ? 'text-amber-700' : 'text-gray-800'}">${day.label}</span>
          <label class="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" id="toggle-${day.key}" ${active ? 'checked' : ''} class="sr-only peer" onchange="toggleDayActiveUI('${day.key}')">
            <div class="w-9 h-5 bg-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            <span id="label-status-${day.key}" class="ml-2 text-[10px] font-bold ${active ? 'text-blue-600' : 'text-gray-400'}">${active ? 'Aktif' : 'Libur'}</span>
          </label>
        </div>
        <div id="inputs-box-${day.key}" class="grid grid-cols-2 gap-2 ${active ? '' : 'opacity-40 pointer-events-none'}">
          <div><label class="block text-[9px] font-semibold text-gray-600 mb-0.5">Mulai Pagi</label><input type="time" id="pagi-start-${day.key}" value="${pStart}" class="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-800"></div>
          <div><label class="block text-[9px] font-semibold text-gray-600 mb-0.5">Toleransi Pagi</label><input type="time" id="pagi-limit-${day.key}" value="${pLimit}" class="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-800"></div>
          <div><label class="block text-[9px] font-semibold text-gray-600 mb-0.5">Mulai Siang</label><input type="time" id="siang-start-${day.key}" value="${sStart}" class="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-800"></div>
          <div><label class="block text-[9px] font-semibold text-gray-600 mb-0.5">Batas Siang</label><input type="time" id="siang-limit-${day.key}" value="${sLimit}" class="w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-800"></div>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
  renderTimeSettingsSummary();
}

function setAllDaysActiveState(status) {
  DAYS_LIST.forEach(day => {
    const toggleEl = document.getElementById(`toggle-${day.key}`);
    if (toggleEl) {
      toggleEl.checked = status;
      toggleDayActiveUI(day.key);
    }
  });
}

function toggleDayActiveUI(dayKey) {
  const isChecked = document.getElementById(`toggle-${dayKey}`).checked;
  const inputsBox = document.getElementById(`inputs-box-${dayKey}`);
  const labelStatus = document.getElementById(`label-status-${dayKey}`);
  
  localStorage.setItem(`DAY_ACTIVE_${dayKey}`, String(isChecked));

  if (isChecked) {
    inputsBox.classList.remove('opacity-40', 'pointer-events-none');
    labelStatus.innerText = "Aktif";
    labelStatus.className = "ml-2 text-[10px] font-bold text-blue-600";
  } else {
    inputsBox.classList.add('opacity-40', 'pointer-events-none');
    labelStatus.innerText = "Libur";
    labelStatus.className = "ml-2 text-[10px] font-bold text-gray-400";
  }
  renderTimeSettingsSummary();
  refreshRealtimeSessionUI();
}

async function saveDaysTimeSettings() {
  const timeSettingsToSave = {};
  DAYS_LIST.forEach(day => {
    const def = DEFAULT_TIME_CONFIGS[day.key];
    const active = document.getElementById(`toggle-${day.key}`).checked;
    const pStart = padZeroTime(document.getElementById(`pagi-start-${day.key}`).value || def.pStart);
    const pLimit = padZeroTime(document.getElementById(`pagi-limit-${day.key}`).value || def.pLimit);
    const sStart = padZeroTime(document.getElementById(`siang-start-${day.key}`).value || def.sStart);
    const sLimit = padZeroTime(document.getElementById(`siang-limit-${day.key}`).value || def.sLimit);

    localStorage.setItem(`DAY_ACTIVE_${day.key}`, String(active));
    localStorage.setItem(`TIME_${day.key}_PAGI_START`, pStart);
    localStorage.setItem(`TIME_${day.key}_PAGI_LIMIT`, pLimit);
    localStorage.setItem(`TIME_${day.key}_SIANG_START`, sStart);
    localStorage.setItem(`TIME_${day.key}_SIANG_LIMIT`, sLimit);

    timeSettingsToSave[`DAY_ACTIVE_${day.key}`] = String(active);
    timeSettingsToSave[`TIME_${day.key}_PAGI_START`] = pStart;
    timeSettingsToSave[`TIME_${day.key}_PAGI_LIMIT`] = pLimit;
    timeSettingsToSave[`TIME_${day.key}_SIANG_START`] = sStart;
    timeSettingsToSave[`TIME_${day.key}_SIANG_LIMIT`] = sLimit;
  });
  renderTimeSettingsSummary();
  refreshRealtimeSessionUI();

  if (navigator.onLine) {
    try {
      const settingsArray = Object.keys(timeSettingsToSave).map(k => ({
        kunci_waktu: k,
        nilai: timeSettingsToSave[k]
      }));
      await supabaseClient.from('pengaturan_waktu').upsert(settingsArray, { onConflict: 'kunci_waktu' });
      alert("Pengaturan jam tersimpan di Server!");
    } catch (e) { alert("Pengaturan tersimpan lokal."); }
  } else alert("Perangkat offline. Tersimpan di HP ini.");
}

function applyTimeSettingsFromCloud(timeObj) {
  for (let key in timeObj) {
    if (timeObj.hasOwnProperty(key) && timeObj[key] !== "") {
      const valStr = String(timeObj[key]).trim();
      if (valStr.toLowerCase() === "true" || valStr.toLowerCase() === "false") {
        localStorage.setItem(key, valStr.toLowerCase());
      } else if (valStr.includes(":")) {
        localStorage.setItem(key, padZeroTime(valStr));
      } else {
        localStorage.setItem(key, valStr);
      }
    }
  }
  renderDaysConfigForm();
  refreshRealtimeSessionUI();
}

function loadLocalHistoryToMemory() {
  if (localStorage.getItem("CACHE_TINDAK_LANJUT")) {
    fetchedTindakLanjutHistory = JSON.parse(localStorage.getItem("CACHE_TINDAK_LANJUT"));
  }
  if (localStorage.getItem("CACHE_HARI_LIBUR")) {
    fetchedHariLiburList = JSON.parse(localStorage.getItem("CACHE_HARI_LIBUR"));
  }
  if (db) {
    const tx = db.transaction("attendance_history", "readonly");
    tx.objectStore("attendance_history").getAll().onsuccess = (e) => {
      fetchedAttendanceHistory = e.target.result || [];
      if (typeof updateMonitoringDashboard === "function") updateMonitoringDashboard();
      if (typeof renderDashboardView === "function") renderDashboardView();
    };
  }
}

function populateClassDropdowns() {
  const classes = [...new Set(cachedStudents.map(s => s.kelas))].filter(Boolean).sort();
  const optionsHtml = '<option value="ALL">Semua Kelas</option>' + classes.map(c => `<option value="${c}">${c}</option>`).join('');
  const optionsNoAllHtml = classes.map(c => `<option value="${c}">${c}</option>`).join('');

  const stdFilter = document.getElementById('filter-class-select');
  const monFilter = document.getElementById('monitoring-class-filter');
  const promFilter = document.getElementById('promote-from-class');
  const dashFilter = document.getElementById('dash-filter-class');
  const tlFilter = document.getElementById('tl-filter-class');

  if (stdFilter) stdFilter.innerHTML = optionsHtml;
  if (monFilter) monFilter.innerHTML = optionsHtml;
  if (dashFilter) dashFilter.innerHTML = optionsHtml;
  if (tlFilter) tlFilter.innerHTML = optionsHtml;
  if (promFilter) promFilter.innerHTML = optionsNoAllHtml;
}

async function loadStudentsView() {
  if (!db) await initDatabase();
  const tx = db.transaction("students", "readonly");
  tx.objectStore("students").getAll().onsuccess = (e) => {
    cachedStudents = e.target.result || [];
    filterStudentsList();
    renderClassSummaryBadges();
    
    const monFilter = document.getElementById('monitoring-class-filter');
    if (monFilter && monFilter.options.length <= 1) {
      populateClassDropdowns();
    }
  };
}

function renderClassSummaryBadges() {
  const badgeContainer = document.getElementById("class-summary-badges");
  if (!badgeContainer) return;
  const classes = [...new Set(cachedStudents.map(s => s.kelas))].filter(Boolean).sort();
  
  badgeContainer.innerHTML = classes.map(cls => {
    const count = cachedStudents.filter(s => s.kelas === cls && (s.active === undefined || s.active === true)).length;
    return `
      <button onclick="document.getElementById('filter-class-select').value='${cls}'; filterStudentsList();" class="flex-shrink-0 px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 shadow-sm hover:border-blue-400">
        ${cls}: <span class="text-blue-600 font-extrabold">${count}</span>
      </button>
    `;
  }).join('');
}

function filterStudentsList() {
  const searchEl = document.getElementById('search-student-input');
  const classEl = document.getElementById('filter-class-select');
  if (!searchEl || !classEl) return;

  const q = searchEl.value.toLowerCase();
  const cls = classEl.value;
  const activeStudents = cachedStudents.filter(s => s.active === undefined || s.active === true);
  document.getElementById('std-count-total').innerText = activeStudents.length;
  
  const filtered = activeStudents.filter(s => {
    const matchQ = s.nama.toLowerCase().includes(q) || s.id_siswa.toLowerCase().includes(q) || (s.nisn && s.nisn.includes(q));
    const matchC = cls === "ALL" || s.kelas === cls;
    return matchQ && matchC;
  });
  document.getElementById('std-count-filtered').innerText = filtered.length;
  const container = document.getElementById('students-list-container');
  container.innerHTML = filtered.map(s => `
    <div class="bg-white p-3 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
      <div><h4 class="font-bold text-xs text-gray-900">${s.nama}</h4><p class="text-[10px] text-gray-500">ID: ${s.id_siswa} | NISN: ${s.nisn || '-'}</p></div>
      <span class="px-2 py-1 bg-emerald-50 text-emerald-700 font-bold text-[10px] rounded-lg">${s.kelas}</span>
    </div>
  `).join('');
}

function generateNextStudentId() {
  if (!cachedStudents || cachedStudents.length === 0) return "S101";
  let maxNum = 0, prefix = "S";
  cachedStudents.forEach(s => {
    if (s.id_siswa) {
      const cleanId = String(s.id_siswa).trim();
      const match = cleanId.match(/^([a-zA-Z]+)(\d+)$/);
      if (match) {
        prefix = match[1]; 
        const num = parseInt(match[2], 10);
        if (!isNaN(num) && num > maxNum) maxNum = num;
      } else {
        const numOnly = parseInt(cleanId.replace(/\D/g, ''), 10);
        if (!isNaN(numOnly) && numOnly > maxNum) maxNum = numOnly;
      }
    }
  });
  return maxNum === 0 ? "S101" : prefix + (maxNum + 1);
}

function toggleView(viewName) {
  const views = ['scanner', 'success', 'students', 'monitoring', 'dashboard', 'about', 'tindak-lanjut', 'hari-libur', 'settings', 'promotion', 'edit-students', 'upload-batch'];
  views.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.classList.add('hidden');
  });
  const targetView = document.getElementById('view-' + viewName);
  if (targetView) targetView.classList.remove('hidden');

  if (viewName === 'students') loadStudentsView();
  if (viewName === 'monitoring' && typeof onMonitoringDateChange === "function") onMonitoringDateChange();
  if (viewName === 'dashboard' && typeof renderDashboardView === "function") renderDashboardView();
  if (viewName === 'tindak-lanjut' && typeof renderTindakLanjutView === "function") renderTindakLanjutView();
  if (viewName === 'hari-libur') renderHariLiburView();
  if (viewName === 'settings') renderDaysConfigForm();
  if (viewName === 'about') updateAboutStorageMetrics();
  if (viewName === 'scanner') refreshRealtimeSessionUI();
  if (viewName === 'edit-students') renderEditStudentsList();
}

function toggleMenuModal() { 
  renderMenuModalGrid();
  document.getElementById('menu-modal').classList.toggle('hidden'); 
}

function toggleAddStudentModal() { 
  const modal = document.getElementById('add-student-modal');
  const isHidden = modal.classList.contains('hidden');
  
  if (isHidden) {
    const autoId = generateNextStudentId();
    document.getElementById('new-std-id').value = autoId;
    document.getElementById('new-std-nisn').value = "";
    document.getElementById('new-std-nama').value = "";
    document.getElementById('new-std-kelas').value = "";
    document.getElementById('new-std-ttl').value = "";
  }
  modal.classList.toggle('hidden'); 
}

function renderEditStudentsList() {
  const container = document.getElementById("edit-students-list-container");
  const q = document.getElementById("edit-std-search").value.toLowerCase();
  
  const filtered = cachedStudents.filter(s => 
    s.nama.toLowerCase().includes(q) || 
    s.id_siswa.toLowerCase().includes(q) || 
    (s.nisn && s.nisn.includes(q))
  );

  if (filtered.length === 0) {
    container.innerHTML = `<div class="text-xs text-gray-400 text-center py-4">Siswa tidak ditemukan.</div>`;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const isActive = (s.active === undefined || s.active === true);
    return `
      <div class="bg-white p-3 rounded-2xl border ${isActive ? 'border-gray-200' : 'border-rose-200 bg-rose-50/20'} shadow-sm flex items-center justify-between">
        <div class="min-w-0 flex-1">
          <div class="flex items-center space-x-1.5">
            <h4 class="font-bold text-xs text-gray-900 truncate">${s.nama}</h4>
            <span class="px-1.5 py-0.2 rounded text-[8px] font-extrabold ${isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
              ${isActive ? 'Aktif' : 'Non-Aktif'}
            </span>
          </div>
          <p class="text-[10px] text-gray-500">ID: ${s.id_siswa} | NISN: ${s.nisn || '-'} | Kelas: <b>${s.kelas}</b></p>
        </div>
        <button onclick="openEditStudentModal('${s.id_siswa}')" class="px-3 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 rounded-xl text-xs font-bold hover:bg-blue-100">
          <i class="fa-solid fa-pen"></i> Edit
        </button>
      </div>
    `;
  }).join('');
}

async function saveEditStudentDetails() {
  const idSiswa = document.getElementById('edit-modal-id-siswa').value;
  const nama = document.getElementById('edit-modal-nama').value.trim();
  const nisn = document.getElementById('edit-modal-nisn').value.trim();
  const kelas = document.getElementById('edit-modal-kelas').value.trim();
  const ttl = document.getElementById('edit-modal-ttl').value.trim();
  const jk = document.getElementById('edit-modal-jk') ? document.getElementById('edit-modal-jk').value : "L";
  const isActive = document.getElementById('edit-modal-status-toggle').checked;
  const btnSave = document.getElementById('btn-save-edit-student');

  if (!nama || !kelas) return alert("Nama dan Kelas wajib diisi!");

  const std = cachedStudents.find(s => s.id_siswa === idSiswa);
  if (std) {
    std.nama = nama;
    std.nisn = nisn;
    std.kelas = kelas;
    std.ttl = ttl;
    std.jenis_kelamin = jk;
    std.active = isActive;

    btnSave.disabled = true;
    btnSave.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan Perubahan...`;

    const tx = db.transaction("students", "readwrite");
    tx.objectStore("students").put(std);
    
    tx.oncomplete = async () => {
      renderEditStudentsList();
      loadStudentsView();
      populateClassDropdowns();

      if (navigator.onLine) {
        try {
          const { error } = await supabaseClient
            .from('siswa')
            .upsert({
              id_siswa: std.id_siswa,
              nama_siswa: std.nama,
              nisn: std.nisn,
              kelas: std.kelas,
              ttl: std.ttl,
              jenis_kelamin: std.jenis_kelamin,
              status: std.active ? 'Aktif' : 'Non-Aktif',
              qr_code_key: std.id_siswa
            }, { onConflict: 'id_siswa' });

          if (!error) {
            alert("Perubahan data siswa berhasil disimpan ke Server!");
          } else {
            alert("Gagal memperbarui Server: " + error.message);
          }
        } catch (e) {
          alert("Data tersimpan lokal.");
        }
      } else {
        alert("Data siswa tersimpan di HP secara offline.");
      }

      btnSave.disabled = false;
      btnSave.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan`;
      closeEditStudentModal();
    };
  }
}

function closeEditStudentModal() {
  document.getElementById('edit-student-modal').classList.add('hidden');
}

async function saveEditStudentDetails() {
  const idSiswa = document.getElementById('edit-modal-id-siswa').value;
  const nama = document.getElementById('edit-modal-nama').value.trim();
  const nisn = document.getElementById('edit-modal-nisn').value.trim();
  const kelas = document.getElementById('edit-modal-kelas').value.trim();
  const ttl = document.getElementById('edit-modal-ttl').value.trim();
  const isActive = document.getElementById('edit-modal-status-toggle').checked;
  const btnSave = document.getElementById('btn-save-edit-student');

  if (!nama || !kelas) return alert("Nama dan Kelas wajib diisi!");

  const std = cachedStudents.find(s => s.id_siswa === idSiswa);
  if (std) {
    std.nama = nama;
    std.nisn = nisn;
    std.kelas = kelas;
    std.ttl = ttl;
    std.active = isActive;

    btnSave.disabled = true;
    btnSave.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan Perubahan...`;

    const tx = db.transaction("students", "readwrite");
    tx.objectStore("students").put(std);
    
    tx.oncomplete = async () => {
      renderEditStudentsList();
      loadStudentsView();
      populateClassDropdowns();

      if (navigator.onLine) {
        try {
          const { error } = await supabaseClient
            .from('siswa')
            .upsert({
              id_siswa: std.id_siswa,
              ID_SISWA: std.id_siswa,
              nama_siswa: std.nama,
              NAMA_SISWA: std.nama,
              nisn: std.nisn,
              NISN: std.nisn,
              kelas: std.kelas,
              KELAS: std.kelas,
              ttl: std.ttl,
              TTL: std.ttl,
              status: std.active ? 'Aktif' : 'Non-Aktif',
              STATUS: std.active ? 'Aktif' : 'Non-Aktif',
              qr_code_key: std.id_siswa,
              QR_CODE_KEY: std.id_siswa
            }, { onConflict: 'id_siswa' });

          if (!error) {
            alert("Perubahan data siswa berhasil disimpan ke Server!");
          } else {
            alert("Gagal memperbarui Server: " + error.message);
          }
        } catch (e) {
          alert("Data tersimpan lokal.");
        }
      } else {
        alert("Data siswa tersimpan di HP secara offline.");
      }

      btnSave.disabled = false;
      btnSave.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan Perubahan`;
      closeEditStudentModal();
    };
  }
}

function renderHariLiburView() {
  const container = document.getElementById("hari-libur-list-container");
  if (!container) return;
  container.innerHTML = fetchedHariLiburList.map(item => `
    <div class="bg-white p-3 rounded-xl border border-gray-200 flex items-center justify-between text-xs">
      <div><span class="font-bold text-blue-900 block">${item.tanggal || item.TANGGAL}</span><span>${item.keterangan || item.KETERANGAN_LIBUR}</span></div>
    </div>
  `).join('');
}

async function saveHariLiburNew() {
  const tgl = document.getElementById("input-libur-tanggal").value;
  const ket = document.getElementById("input-libur-ket").value.trim();
  if (!tgl || !ket) return alert("Tanggal & Keterangan wajib diisi!");
  
  const newItem = { 
    tanggal: formatCleanDateLocal(tgl), 
    TANGGAL: formatCleanDateLocal(tgl), 
    keterangan: ket, 
    KETERANGAN_LIBUR: ket 
  };
  fetchedHariLiburList.push(newItem);
  localStorage.setItem("CACHE_HARI_LIBUR", JSON.stringify(fetchedHariLiburList));
  renderHariLiburView();

  if (navigator.onLine) {
    await supabaseClient.from('hari_libur').upsert([newItem]);
  }
}

async function saveSchoolSettings() {
  const schoolName = document.getElementById("input-school-name").value.trim();
  const academicYear = document.getElementById("input-academic-year").value.trim();
  const principalName = document.getElementById("input-principal-name").value.trim();
  const principalNip = document.getElementById("input-principal-nip").value.trim();
  if (!schoolName) return alert("Nama sekolah wajib diisi!");

  localStorage.setItem("SCHOOL_NAME", schoolName);
  localStorage.setItem("ACADEMIC_YEAR", academicYear);
  localStorage.setItem("PRINCIPAL_NAME", principalName);
  localStorage.setItem("PRINCIPAL_NIP", principalNip);
  document.getElementById("app-header-school-name").innerText = `${schoolName} (${academicYear})`;

  if (navigator.onLine) {
    const schoolSettingsArray = [
      { kunci: 'SCHOOL_NAME', nilai: schoolName },
      { kunci: 'ACADEMIC_YEAR', nilai: academicYear },
      { kunci: 'PRINCIPAL_NAME', nilai: principalName },
      { kunci: 'PRINCIPAL_NIP', nilai: principalNip }
    ];
    await supabaseClient.from('pengaturan').upsert(schoolSettingsArray, { onConflict: 'kunci' });
  }
  alert("Identitas sekolah tersimpan!");
}

async function executeMassPromotion() {
  const fromCls = document.getElementById("promote-from-class").value;
  const toCls = document.getElementById("promote-to-class").value.trim();
  if (!fromCls || !toCls) return alert("Pilih kelas asal dan isi nama kelas baru!");

  const targetStudents = cachedStudents.filter(s => s.kelas === fromCls);
  if (targetStudents.length === 0) return alert("Tidak ada siswa di kelas tersebut!");

  if (!confirm(`Yakin memindahkan ${targetStudents.length} siswa dari ${fromCls} ke ${toCls}?`)) return;

  const tx = db.transaction("students", "readwrite");
  const store = tx.objectStore("students");
  targetStudents.forEach(s => {
    s.kelas = toCls;
    store.put(s);
  });

  tx.oncomplete = () => {
    loadStudentsView();
    alert("Kenaikan kelas lokal berhasil diterapkan!");
  };

  if (navigator.onLine) {
    const updatesData = targetStudents.map(s => ({
      id_siswa: s.id_siswa,
      ID_SISWA: s.id_siswa,
      kelas: toCls,
      KELAS: toCls,
      nama_siswa: s.nama,
      NAMA_SISWA: s.nama
    }));
    await supabaseClient.from('siswa').upsert(updatesData, { onConflict: 'id_siswa' });
    autoDownloadMasterStudents();
  }
}

async function updateAboutStorageMetrics() {
  let localKB = (JSON.stringify(localStorage).length / 1024).toFixed(1);
  const localEl = document.getElementById("about-local-size");
  if (localEl) localEl.innerText = `${localKB} KB`;

  const cacheEl = document.getElementById("about-cache-size");
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    const estimate = await navigator.storage.estimate();
    const usageMB = ((estimate.usage || 0) / (1024 * 1024)).toFixed(2);
    if (cacheEl) cacheEl.innerText = `${usageMB} MB`;
  } else {
    if (cacheEl) cacheEl.innerText = "12.4 MB";
  }
}

function clearAppCacheOnly() {
  if ('caches' in window) {
    caches.keys().then(keys => {
      Promise.all(keys.map(key => caches.delete(key))).then(() => {
        alert("Cache file aplikasi berhasil dibersihkan!");
        window.location.reload();
      });
    });
  } else {
    alert("Cache berhasil dibersihkan!");
    window.location.reload();
  }
}

function forceCheckAppUpdate() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let registration of registrations) {
        registration.update();
      }
    });
  }
  alert("Aplikasi telah menyegarkan file sistem terbaru!");
  window.location.reload();
}

// Gantilah isi fungsi saveNewStudentToDB pada bagian payloadSupabase:
async function saveNewStudentToDB() {
  const idSiswa = document.getElementById('new-std-id').value.trim();
  const nisn = document.getElementById('new-std-nisn').value.trim();
  const nama = document.getElementById('new-std-nama').value.trim();
  const kelas = document.getElementById('new-std-kelas').value.trim();
  const ttl = document.getElementById('new-std-ttl').value.trim();
  const jk = document.getElementById('new-std-jk') ? document.getElementById('new-std-jk').value : "L";
  
  if (!idSiswa || !nama || !kelas) return alert("ID, Nama, dan Kelas Wajib diisi!");

  const newStudentLocal = { 
    id_siswa: idSiswa, 
    nisn: nisn || "-", 
    nama: nama, 
    kelas: kelas, 
    ttl: ttl || "-", 
    jenis_kelamin: jk,
    active: true 
  };

  const tx = db.transaction("students", "readwrite");
  tx.objectStore("students").put(newStudentLocal);

  tx.oncomplete = async () => {
    if (navigator.onLine) {
      try {
        const payloadSupabase = {
          id_siswa: idSiswa,
          nisn: nisn || "-",
          nama_siswa: nama,
          kelas: kelas,
          ttl: ttl || "-",
          jenis_kelamin: jk,
          status: "Aktif",
          qr_code_key: idSiswa
        };

        const { error } = await supabaseClient
          .from('siswa')
          .upsert(payloadSupabase, { onConflict: 'id_siswa' });

        if (!error) {
          alert("Siswa baru berhasil disimpan ke Database Server!");
        } else {
          alert("Tersimpan lokal. Gagal ke server: " + error.message);
        }
      } catch (err) {
        alert("Terjadi kesalahan koneksi ke server.");
      }
    } else {
      alert("Perangkat Offline. Siswa baru tersimpan di HP/Browser lokal.");
    }

    toggleAddStudentModal();
    loadStudentsView();
    populateClassDropdowns();
  };
}

setInterval(() => {
  const isOnline = navigator.onLine;
  const dotEl = document.getElementById('status-dot');
  const textEl = document.getElementById('status-text');
  if (dotEl) dotEl.className = `w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-amber-400'} inline-block`;
  if (textEl) textEl.innerText = isOnline ? 'Online' : 'Offline';

  refreshRealtimeSessionUI();
}, 1000);

window.addEventListener('online', () => {
  syncQueueToGAS();
  autoDownloadMasterStudents();
});

window.onload = async () => {
  const storedRole = localStorage.getItem("USER_ROLE");
  if (storedRole) currentUserRole = storedRole;
  if (typeof updateRoleUI === "function") updateRoleUI();

  const localSchoolName = localStorage.getItem("SCHOOL_NAME");
  const localAcadYear = localStorage.getItem("ACADEMIC_YEAR") || "2026/2027";
  if (localSchoolName) {
    const headerEl = document.getElementById("app-header-school-name");
    const nameInput = document.getElementById("input-school-name");
    const yearInput = document.getElementById("input-academic-year");
    if (headerEl) headerEl.innerText = `${localSchoolName} (${localAcadYear})`;
    if (nameInput) nameInput.value = localSchoolName;
    if (yearInput) yearInput.value = localAcadYear;
  }
  
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const todayRealStr = `${year}-${month}-${day}`;

  const monDateFilter = document.getElementById("monitoring-date-filter");
  const dashDateFilter = document.getElementById("dashboard-date-filter");
  if (monDateFilter) monDateFilter.value = todayRealStr;
  if (dashDateFilter) dashDateFilter.value = todayRealStr;

  await initDatabase();
  await loadStudentsView();
  populateClassDropdowns();
  renderDaysConfigForm();
  
  if (navigator.onLine) {
    autoDownloadMasterStudents(todayRealStr);
  } else {
    loadLocalHistoryToMemory();
  }
  
  refreshRealtimeSessionUI();
};