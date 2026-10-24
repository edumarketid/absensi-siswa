async function renderDashboardView() {
  if (!cachedStudents || cachedStudents.length === 0) {
    if (typeof loadStudentsView === 'function') {
      await loadStudentsView();
    }
  }

  const dateInputEl = document.getElementById('dashboard-date-filter');
  const d = new Date();
  const realTodayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  
  let rawDateVal = dateInputEl ? dateInputEl.value : realTodayStr;
  const targetDate = formatCleanDateLocal(rawDateVal) || realTodayStr;

  if (dateInputEl) dateInputEl.value = targetDate;

  const queueRecords = await getAllQueueFromDB();
  const localHist = await getAllLocalHistoryFromDB();

  const rawRecords = [...fetchedTodayAttendance, ...fetchedAttendanceHistory, ...localHist, ...queueRecords]
    .filter(r => formatCleanDateLocal(r.tanggal) === targetDate);

  const activeStudents = cachedStudents.filter(s => s.active === undefined || s.active === true);

  let totalStd = activeStudents.length;
  let countHadir = 0, countTerlambat = 0, countAlpa = 0, countIzin = 0, countSakit = 0, countKegiatan = 0, countBolos = 0;

  activeStudents.forEach(std => {
    const rec = rawRecords.find(r => String(r.id_siswa).trim().toUpperCase() === String(std.id_siswa).trim().toUpperCase());

    if (!rec) {
      countAlpa++;
    } else {
      const stAkhir = String(rec.status_akhir || rec.status_presensi || "ALPA").trim().toUpperCase();
      const stPagi = String(rec.status_pagi || "").trim().toUpperCase();

      if (stAkhir === "HADIR" || stPagi === "HADIR") countHadir++;
      else if (stAkhir === "ALPA") countAlpa++;
      else if (stAkhir === "BOLOS") countBolos++;
      else if (stAkhir === "IZIN") countIzin++;
      else if (stAkhir === "SAKIT") countSakit++;
      else if (stAkhir === "KEGIATAN") countKegiatan++;

      if (stPagi === "TERLAMBAT" || stAkhir === "TERLAMBAT") {
        countTerlambat++;
        countHadir++;
      }
    }
  });

  const pctHadir = totalStd > 0 ? Math.round((countHadir / totalStd) * 100) : 0;

  const setElText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.innerText = val;
  };

  setElText('dash-pct-total', `${pctHadir}%`);
  setElText('dash-pct-sub', `${countHadir} dari ${totalStd} Siswa Hadir`);
  setElText('dash-count-hadir', countHadir);
  setElText('dash-count-terlambat', countTerlambat);
  setElText('dash-count-alpa', countAlpa);
  setElText('dash-count-bolos', countBolos);
  setElText('dash-count-izinsakit', countIzin + countSakit);
  setElText('dash-count-kegiatan', countKegiatan);

  if (typeof renderDashboardClassSummary === 'function') renderDashboardClassSummary(rawRecords);
  if (typeof renderDashboardStudentTable === 'function') renderDashboardStudentTable();
}

function renderDashboardClassSummary(rawRecords) {
  const container = document.getElementById('dashboard-class-summary');
  if (!container) return;
  const activeStudents = cachedStudents.filter(s => s.active === undefined || s.active === true);
  const classes = [...new Set(activeStudents.map(s => s.kelas))].filter(Boolean).sort();

  if (classes.length === 0) {
    container.innerHTML = `<div class="text-[10px] text-gray-400 text-center py-2">Belum ada data kelas.</div>`;
    return;
  }

  container.innerHTML = classes.map(cls => {
    const stds = activeStudents.filter(s => s.kelas === cls);
    let hadirVal = 0;
    stds.forEach(std => {
      const rec = rawRecords.find(r => String(r.id_siswa).trim().toUpperCase() === String(std.id_siswa).trim().toUpperCase());
      if (rec) {
        const st = String(rec.status_akhir || rec.status_presensi || "HADIR").toUpperCase();
        if (st === "HADIR") hadirVal++;
      }
    });
    const pct = stds.length > 0 ? Math.round((hadirVal / stds.length) * 100) : 0;
    return `
      <div class="p-2 bg-slate-50 border border-gray-100 rounded-xl flex items-center justify-between text-xs">
        <div>
          <span class="font-bold text-gray-800">${cls}</span>
          <p class="text-[10px] text-gray-500">${hadirVal} dari ${stds.length} siswa hadir</p>
        </div>
        <span class="font-black text-xs ${pct >= 85 ? 'text-emerald-600' : 'text-amber-600'}">${pct}%</span>
      </div>
    `;
  }).join('');
}

async function renderDashboardStudentTable() {
  const d = new Date();
  const realTodayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dateEl = document.getElementById('dashboard-date-filter');
  const targetDate = formatCleanDateLocal(dateEl ? dateEl.value : realTodayStr) || realTodayStr;
  const selectedClass = document.getElementById('dash-filter-class') ? document.getElementById('dash-filter-class').value : "ALL";
  const selectedStatus = document.getElementById('dash-filter-status') ? document.getElementById('dash-filter-status').value : "ALL";
  const searchQ = document.getElementById('dash-search-student') ? document.getElementById('dash-search-student').value.toLowerCase() : "";

  const queueRecords = await getAllQueueFromDB();
  const localHist = await getAllLocalHistoryFromDB();
  const rawRecords = [...fetchedTodayAttendance, ...fetchedAttendanceHistory, ...localHist, ...queueRecords].filter(r => formatCleanDateLocal(r.tanggal) === targetDate);

  const container = document.getElementById('dash-student-table-container');
  if (!container) return;
  const activeStudents = cachedStudents.filter(s => s.active === undefined || s.active === true);

  const filtered = activeStudents.filter(std => {
    const matchClass = (selectedClass === "ALL" || std.kelas === selectedClass);
    const matchQ = std.nama.toLowerCase().includes(searchQ) || std.id_siswa.toLowerCase().includes(searchQ);
    
    const rec = rawRecords.find(r => String(r.id_siswa).trim().toUpperCase() === String(std.id_siswa).trim().toUpperCase());
    const status = rec ? String(rec.status_akhir || rec.status_presensi || "HADIR").toUpperCase() : "ALPA";
    const matchStatus = (selectedStatus === "ALL" || status === selectedStatus);

    return matchClass && matchQ && matchStatus;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="text-xs text-gray-400 text-center py-3">Tidak ada siswa yang sesuai filter.</div>`;
    return;
  }

  container.innerHTML = filtered.map(std => {
    const rec = rawRecords.find(r => String(r.id_siswa).trim().toUpperCase() === String(std.id_siswa).trim().toUpperCase());
    const status = rec ? String(rec.status_akhir || rec.status_presensi || "HADIR").toUpperCase() : "ALPA";
    const jamScan = rec ? (rec.jam_pagi || rec.jam_siang || rec.jam || "-") : "-";

    let badgeStyle = "bg-gray-100 text-gray-700";
    if (status === "HADIR") badgeStyle = "bg-emerald-100 text-emerald-800";
    else if (status === "TERLAMBAT") badgeStyle = "bg-amber-100 text-amber-800";
    else if (status === "ALPA") badgeStyle = "bg-red-100 text-red-800";
    else if (status === "BOLOS") badgeStyle = "bg-rose-100 text-rose-800";
    else if (status === "IZIN" || status === "SAKIT") badgeStyle = "bg-indigo-100 text-indigo-800";
    else if (status === "KEGIATAN") badgeStyle = "bg-purple-100 text-purple-800";

    return `
      <div onclick="showStudentDetailModal('${std.id_siswa}')" class="p-2.5 bg-slate-50 border border-gray-100 rounded-xl flex items-center justify-between cursor-pointer hover:bg-slate-100 transition">
        <div>
          <h5 class="font-bold text-xs text-gray-900">${std.nama}</h5>
          <p class="text-[10px] text-gray-500">${std.kelas} | Jam: ${jamScan}</p>
        </div>
        <span class="text-[9px] font-extrabold px-2 py-0.5 rounded-md ${badgeStyle}">${status}</span>
      </div>
    `;
  }).join('');
}

function showStudentDetailModal(idSiswa) {
  const std = cachedStudents.find(s => s.id_siswa === idSiswa);
  if (!std) return;

  document.getElementById('modal-std-name').innerText = std.nama;
  document.getElementById('modal-std-sub').innerText = `Kelas: ${std.kelas} | ID: ${std.id_siswa} | NISN: ${std.nisn || '-'}`;

  const d = new Date();
  const realTodayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const targetDate = formatCleanDateLocal(document.getElementById('dashboard-date-filter').value) || realTodayStr;
  const rec = [...fetchedTodayAttendance, ...fetchedAttendanceHistory].find(r => String(r.id_siswa).trim().toUpperCase() === String(idSiswa).trim().toUpperCase() && formatCleanDateLocal(r.tanggal) === targetDate);

  const contentEl = document.getElementById('modal-std-status-content');
  if (rec) {
    contentEl.innerHTML = `
      <p>Tanggal: <b>${rec.tanggal}</b></p>
      <p>Jam Pagi: <b>${rec.jam_pagi || '-'}</b> | Jam Siang: <b>${rec.jam_siang || '-'}</b></p>
      <p>Status Pagi: <b>${rec.status_pagi || '-'}</b> | Status Siang: <b>${rec.status_siang || '-'}</b></p>
      <p>Status Akhir Presensi: <b class="text-blue-700">${rec.status_akhir || rec.status_presensi || 'HADIR'}</b></p>
    `;
  } else {
    contentEl.innerHTML = `<p class="text-rose-600 font-bold">Belum Melakukan Absensi / Tanpa Keterangan (Alpa)</p>`;
  }

  document.getElementById('student-detail-modal').classList.remove('hidden');
}

function closeStudentDetailModal() {
  document.getElementById('student-detail-modal').classList.add('hidden');
}

function onMonitoringDateChange() {
  const d = new Date();
  const realTodayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const targetDate = formatCleanDateLocal(document.getElementById('monitoring-date-filter').value) || realTodayStr;
  updateMonitoringDashboard();
  if (navigator.onLine) autoDownloadMasterStudents(targetDate);
}

async function updateMonitoringDashboard() {
  const d = new Date();
  const realTodayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const targetDate = formatCleanDateLocal(document.getElementById('monitoring-date-filter').value) || realTodayStr;
  const selectedClass = document.getElementById('monitoring-class-filter').value;
  const selectedSessionFilter = document.getElementById('monitoring-session-filter').value;
  const selectedStatusFilter = document.getElementById('monitoring-status-filter').value || "ALL";
  
  const queueRecords = await getAllQueueFromDB();
  const localHist = await getAllLocalHistoryFromDB();
  
  let rawRecords = [...fetchedTodayAttendance, ...fetchedAttendanceHistory, ...localHist, ...queueRecords].filter(r => formatCleanDateLocal(r.tanggal) === targetDate);

  const activeStudents = cachedStudents.filter(s => s.active === undefined || s.active === true);
  const classStudents = activeStudents.filter(s => selectedClass === "ALL" || s.kelas === selectedClass);
  let hadir = 0, terlambat = 0, alpa = 0, sakit = 0, izin = 0, kegiatan = 0;
  const filteredActionStudents = [];

  const dateObj = new Date(targetDate + "T00:00:00");
  const timeConfig = getTodayTimeConfig(dateObj);
  const now = new Date();
  const todayFormatted = realTodayStr;
  const nowStr = padZeroTime(now.toTimeString().split(' ')[0]);
  
  const isPastSiangLimit = (targetDate < todayFormatted) || (targetDate === todayFormatted && nowStr >= (timeConfig.sLimit + ":01"));

  classStudents.forEach(std => {
    const stdRec = rawRecords.find(r => 
      String(r.id_siswa).trim().toUpperCase() === String(std.id_siswa).trim().toUpperCase() &&
      formatCleanDateLocal(r.tanggal) === targetDate
    );

    var targetStatus = "";
    if (stdRec) {
      if (selectedSessionFilter === "PAGI") {
        targetStatus = String(stdRec.status_pagi || stdRec.status_presensi || stdRec.status_akhir || "").toUpperCase();
      } else if (selectedSessionFilter === "SIANG") {
        targetStatus = String(stdRec.status_siang || stdRec.status_presensi || stdRec.status_akhir || "").toUpperCase();
      }
    }

    let evalStatus = targetStatus;
    if (!targetStatus || targetStatus === "") {
      evalStatus = isPastSiangLimit ? "ALPA" : "BELUM";
    }

    if (evalStatus === "HADIR") hadir++;
    else if (evalStatus === "TERLAMBAT") terlambat++;
    else if (evalStatus === "ALPA") alpa++;
    else if (evalStatus === "SAKIT") sakit++;
    else if (evalStatus === "IZIN") izin++;
    else if (evalStatus === "KEGIATAN") kegiatan++;

    let matchStatus = false;
    if (selectedStatusFilter === "ALL") {
      matchStatus = true; 
    } else {
      matchStatus = (evalStatus === selectedStatusFilter);
    }

    if (matchStatus) {
      filteredActionStudents.push({
        student: std,
        status: targetStatus || (isPastSiangLimit ? "ALPA" : "BELUM"),
        isAbsented: !!targetStatus
      });
    }
  });

  document.getElementById('stat-hadir').innerText = hadir + terlambat;
  document.getElementById('stat-terlambat').innerText = terlambat;
  document.getElementById('stat-alpa').innerText = alpa;
  document.getElementById('stat-sakit').innerText = sakit;
  document.getElementById('stat-izin').innerText = izin;
  document.getElementById('stat-kegiatan').innerText = kegiatan;

  renderPieChart(hadir, terlambat, alpa, sakit, izin, kegiatan, classStudents.length);
  renderClassBarChartHorizontal(rawRecords, selectedSessionFilter);
  renderMonitoringActionListFiltered(targetDate, filteredActionStudents, isPastSiangLimit, selectedSessionFilter, selectedStatusFilter);
}

function renderClassBarChartHorizontal(attendanceRecords, selectedSessionFilter) {
  const container = document.getElementById('classBarChartContainer');
  const ctx = document.getElementById('classBarChart').getContext('2d');
  if (myBarChart) myBarChart.destroy();

  const activeStudents = cachedStudents.filter(s => s.active === undefined || s.active === true);
  const classes = [...new Set(activeStudents.map(s => s.kelas))].filter(Boolean).sort();
  const labels = [];
  const percentages = [];

  classes.forEach(cls => {
    const studentsInCls = activeStudents.filter(s => s.kelas === cls);
    let countHadirVal = 0;
    
    studentsInCls.forEach(std => {
      const stdRec = attendanceRecords.find(r => 
        String(r.id_siswa).trim().toUpperCase() === String(std.id_siswa).trim().toUpperCase()
      );

      if (stdRec) {
        var st = "";
        if (selectedSessionFilter === "PAGI") {
          st = String(stdRec.status_pagi || stdRec.status_presensi || stdRec.status_akhir || "").toUpperCase();
        } else if (selectedSessionFilter === "SIANG") {
          st = String(stdRec.status_siang || stdRec.status_presensi || stdRec.status_akhir || "").toUpperCase();
        }
        
        if (st === "HADIR" || st === "TERLAMBAT") countHadirVal++;
      }
    });
    
    const pct = studentsInCls.length > 0 ? Math.round((countHadirVal / studentsInCls.length) * 100) : 0;
    labels.push(cls);
    percentages.push(pct);
  });

  const dynamicHeight = Math.max(160, classes.length * 28);
  container.style.height = `${dynamicHeight}px`;

  myBarChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '% Kehadiran',
        data: percentages,
        backgroundColor: '#0b3c5d',
        borderRadius: 6,
        barThickness: 14
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } },
        y: { ticks: { font: { size: 10, weight: 'bold' } } }
      },
      onClick: (e, elements) => {
        if (elements.length > 0) {
          const idx = elements[0].index;
          const selectedCls = labels[idx];
          document.getElementById('monitoring-class-filter').value = selectedCls;
          updateMonitoringDashboard();
        }
      }
    }
  });
}

function handleActionBtnClick(idSiswa, status) {
  const d = new Date();
  const realTodayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const targetDate = formatCleanDateLocal(document.getElementById('monitoring-date-filter').value) || realTodayStr;
  setManualPresensiAction(idSiswa, status, targetDate);
}

function renderMonitoringActionListFiltered(targetDate, studentItems, isPastLimit, selectedSessionFilter, selectedStatusFilter) {
  const container = document.getElementById('monitoring-student-action-list');
  const badgeEl = document.getElementById('monitoring-count-badge');
  const headerTitleEl = document.getElementById('monitoring-action-header-title');

  headerTitleEl.innerText = "Daftar Siswa & Aksi Presensi";
  badgeEl.innerText = `${studentItems.length} Siswa Filtered`;
  badgeEl.className = "text-[10px] text-indigo-700 font-bold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200";

  if (studentItems.length === 0) {
    container.innerHTML = `<div class="bg-gray-50 border border-gray-200 p-4 rounded-xl text-center text-xs text-gray-500 font-bold"><i class="fa-solid fa-circle-info"></i> Tidak ada siswa yang sesuai kriteria filter.</div>`;
    return;
  }

  container.innerHTML = studentItems.map(item => {
    const std = item.student;
    const st = item.status;
    
    let badgeStyle = "bg-gray-100 text-gray-700";
    if (st === "HADIR") badgeStyle = "bg-emerald-100 text-emerald-800";
    else if (st === "TERLAMBAT") badgeStyle = "bg-amber-100 text-amber-800";
    else if (st === "ALPA") badgeStyle = "bg-red-100 text-red-800";
    else if (st === "IZIN" || st === "SAKIT") badgeStyle = "bg-indigo-100 text-indigo-800";
    else if (st === "KEGIATAN") badgeStyle = "bg-purple-100 text-purple-800";
    else if (st === "BELUM") badgeStyle = "bg-amber-50 text-amber-700 border border-amber-200";

    return `
      <div id="action-item-${std.id_siswa}" class="p-2.5 bg-slate-50 border border-gray-200 rounded-xl space-y-1.5 transition-all duration-300">
        <div class="flex items-center justify-between">
          <div class="min-w-0 flex-1">
            <h5 class="font-bold text-xs text-gray-900 truncate">${std.nama}</h5>
            <p class="text-[10px] text-gray-500">${std.kelas} | ID: ${std.id_siswa}</p>
          </div>
          <span class="text-[9px] font-extrabold px-2 py-0.5 rounded-full ${badgeStyle}">
            ${st}
          </span>
        </div>
        <div class="grid grid-cols-5 gap-1 pt-1">
          <button onclick="handleActionBtnClick('${std.id_siswa}', 'HADIR')" class="py-1 bg-emerald-600 text-white font-bold text-[9px] rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition">Hadir</button>
          <button onclick="handleActionBtnClick('${std.id_siswa}', 'IZIN')" class="py-1 bg-indigo-600 text-white font-bold text-[9px] rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition">Izin</button>
          <button onclick="handleActionBtnClick('${std.id_siswa}', 'SAKIT')" class="py-1 bg-blue-600 text-white font-bold text-[9px] rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition">Sakit</button>
          <button onclick="handleActionBtnClick('${std.id_siswa}', 'KEGIATAN')" class="py-1 bg-purple-600 text-white font-bold text-[9px] rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition">Keg.</button>
          <button onclick="handleActionBtnClick('${std.id_siswa}', 'ALPA')" class="py-1 bg-rose-600 text-white font-bold text-[9px] rounded-lg shadow-sm hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-0.5" title="Koreksi ke Alpa">
            <i class="fa-solid fa-rotate-left text-[8px]"></i> Alpa
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function setManualPresensiAction(idSiswa, status, targetDate) {
  const student = cachedStudents.find(s => s.id_siswa === idSiswa);
  if (!student) return;

  const selectedSessionFilter = document.getElementById('monitoring-session-filter').value || "PAGI";
  const cleanTargetDate = formatCleanDateLocal(targetDate);
  const timeStr = padZeroTime((isManualTimeMode && customScanTimeOverride) ? customScanTimeOverride : new Date().toTimeString().split(' ')[0].substring(0, 5));
  const queueId = `${cleanTargetDate}_${idSiswa}`;

  let existing = fetchedTodayAttendance.find(r => 
    String(r.id_siswa).trim().toUpperCase() === String(idSiswa).trim().toUpperCase() && 
    formatCleanDateLocal(r.tanggal) === cleanTargetDate
  );

  let jamPagi = existing ? (existing.jam_pagi || "") : "";
  let statusPagi = existing ? (existing.status_pagi || "") : "";
  let jamSiang = existing ? (existing.jam_siang || "") : "";
  let statusSiang = existing ? (existing.status_siang || "") : "";
  
  if (selectedSessionFilter === "PAGI") {
    jamPagi = timeStr;
    statusPagi = status;
  } else if (selectedSessionFilter === "SIANG") {
    jamSiang = timeStr;
    statusSiang = status;
  }

  const statusAkhir = status;

  const record = {
    queue_id: queueId,
    tanggal: cleanTargetDate,
    jam: timeStr,
    id_siswa: idSiswa,
    nama: student.nama,
    kelas: student.kelas,
    sesi: selectedSessionFilter,
    status_presensi: statusAkhir,
    status_pagi: statusPagi,
    jam_pagi: jamPagi,
    status_siang: statusSiang,
    jam_siang: jamSiang,
    status_akhir: statusAkhir,
    timestamp: Date.now()
  };

  await saveToAttendanceQueue(record);
  await saveToLocalHistoryDB(record);
  
  fetchedTodayAttendance = fetchedTodayAttendance.filter(r => !(
    String(r.id_siswa).trim().toUpperCase() === String(idSiswa).trim().toUpperCase() && 
    formatCleanDateLocal(r.tanggal) === cleanTargetDate
  ));
  fetchedTodayAttendance.push(record);

  setTimeout(() => {
    updateMonitoringDashboard();
    renderDashboardView();
  }, 150);

  if (navigator.onLine) syncQueueToGAS();
}

function renderPieChart(hadir, terlambat, alpa, sakit, izin, kegiatan, totalStudentsCount) {
  const ctx = document.getElementById('attendancePieChart').getContext('2d');
  if (myPieChart) myPieChart.destroy();

  const totalHadirVal = hadir + terlambat;
  const effectiveTotal = totalStudentsCount || (hadir + terlambat + alpa + sakit + izin + kegiatan);
  const percentVal = effectiveTotal > 0 ? Math.round((totalHadirVal / effectiveTotal) * 100) : 0;
  
  document.getElementById('chart-center-percent').innerText = `${percentVal}%`;

  myPieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Hadir', 'Terlambat', 'Alpa', 'Sakit', 'Izin', 'Kegiatan'],
      datasets: [{ data: [hadir, terlambat, alpa, sakit, izin, kegiatan], backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#6366f1', '#a855f7'] }]
    },
    options: { responsive: true, maintainAspectRatio: false, cutout: '72%', plugins: { legend: { display: false } } }
  });
}

function switchTLTab(tabName) {
  currentTLTab = tabName;
  const btnPending = document.getElementById("tl-tab-btn-pending");
  const btnDone = document.getElementById("tl-tab-btn-done");

  if (tabName === "pending") {
    btnPending.className = "flex-1 py-1.5 rounded-lg bg-white text-rose-700 shadow-sm transition";
    btnDone.className = "flex-1 py-1.5 rounded-lg text-gray-600 transition";
  } else {
    btnDone.className = "flex-1 py-1.5 rounded-lg bg-white text-emerald-700 shadow-sm transition";
    btnPending.className = "flex-1 py-1.5 rounded-lg text-gray-600 transition";
  }
  renderTindakLanjutView();
}

function getLocalTLStatusList() {
  try { return JSON.parse(localStorage.getItem("TL_STATUS_STORE") || "{}"); } catch(e) { return {}; }
}

function saveLocalTLStatus(idSiswa, dataObj) {
  const store = getLocalTLStatusList();
  store[idSiswa] = dataObj;
  localStorage.setItem("TL_STATUS_STORE", JSON.stringify(store));
}

function removeLocalTLStatus(idSiswa) {
  const store = getLocalTLStatusList();
  delete store[idSiswa];
  localStorage.setItem("TL_STATUS_STORE", JSON.stringify(store));
}

async function sendTLClassSummaryWA() {
  const selectedClass = document.getElementById("tl-filter-class").value;
  const schoolName = localStorage.getItem("SCHOOL_NAME") || "Sekolah";

  if (selectedClass === "ALL") {
    return alert("Pilih kelas tertentu terlebih dahulu pada filter kelas!");
  }

  const allHistory = [...fetchedTodayAttendance, ...fetchedAttendanceHistory, ...(await getAllLocalHistoryFromDB())];
  const tlStore = getLocalTLStatusList();
  const activeStudents = cachedStudents.filter(s => (s.active === undefined || s.active === true) && s.kelas === selectedClass);

  if (activeStudents.length === 0) return alert(`Tidak ada siswa di kelas ${selectedClass}.`);

  const detectedStudents = [];

  activeStudents.forEach(std => {
    const idS = String(std.id_siswa).trim().toUpperCase();
    const stdRecords = allHistory.filter(r => String(r.id_siswa).trim().toUpperCase() === idS);
    stdRecords.sort((a,b) => String(a.tanggal).localeCompare(String(b.tanggal)));

    let totalAlpa = 0;
    stdRecords.forEach(r => {
      const stAkhir = String(r.status_akhir || r.status_presensi || "").trim().toUpperCase();
      if (stAkhir === "ALPA") totalAlpa++;
    });

    let maxSeqTerlambat = 0, currentSeqTerlambat = 0;
    stdRecords.forEach(r => {
      const stPagi = String(r.status_pagi || "").trim().toUpperCase();
      if (stPagi === "TERLAMBAT") {
        currentSeqTerlambat++;
        if (currentSeqTerlambat > maxSeqTerlambat) maxSeqTerlambat = currentSeqTerlambat;
      } else if (stPagi === "HADIR") {
        currentSeqTerlambat = 0;
      }
    });

    let maxSeqBolos = 0, currentSeqBolos = 0;
    stdRecords.forEach(r => {
      const stAkhir = String(r.status_akhir || r.status_presensi || "").trim().toUpperCase();
      if (stAkhir === "BOLOS") {
        currentSeqBolos++;
        if (currentSeqBolos > maxSeqBolos) maxSeqBolos = currentSeqBolos;
      } else if (stAkhir !== "") {
        currentSeqBolos = 0;
      }
    });

    const categories = [];
    if (totalAlpa >= 3) categories.push(`Akumulasi ${totalAlpa}x Alpa`);
    if (maxSeqTerlambat >= 3) categories.push(`3x Terlambat Berturut-turut`);
    if (maxSeqBolos >= 3) categories.push(`3x Bolos Berturut-turut`);

    if (categories.length > 0) {
      const isDone = !!tlStore[std.id_siswa];
      detectedStudents.push({ nama: std.nama, kategori: categories.join(", "), status: isDone ? "Sudah Ditindak" : "Perlu Penanganan" });
    }
  });

  if (detectedStudents.length === 0) return alert(`Selamat! Tidak ada siswa di kelas ${selectedClass} yang terdeteksi melanggar.`);

  let message = `Yth. Bapak/Ibu Wali Kelas *${selectedClass}*,\n\nBerikut daftar rekap tindak lanjut kedisiplinan siswa di kelas Anda:\n\n`;
  detectedStudents.forEach((item, index) => {
    message += `${index + 1}. *${item.nama}*\n   - Catatan: ${item.kategori}\n   - Status: ${item.status}\n\n`;
  });
  message += `Mohon untuk dapat dilakukan pembinaan atau koordinasi dengan orang tua siswa terkait. Terima kasih.\n\n_Salam Kedisiplinan ${schoolName}_`;

  window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
}

async function renderTindakLanjutView() {
  const container = document.getElementById('tindak-lanjut-list-container');
  const selectedClassFilter = document.getElementById('tl-filter-class').value;

  container.innerHTML = `<div class="text-center py-6 text-xs text-gray-400 font-bold"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Menganalisis riwayat absensi siswa...</div>`;

  const allHistory = [...fetchedTodayAttendance, ...fetchedAttendanceHistory, ...(await getAllLocalHistoryFromDB())];
  const tlStore = getLocalTLStatusList();

  const activeStudents = cachedStudents.filter(s => s.active === undefined || s.active === true);
  const filteredByClassStudents = activeStudents.filter(s => selectedClassFilter === "ALL" || s.kelas === selectedClassFilter);

  const detectedList = [];

  filteredByClassStudents.forEach(std => {
    const idS = String(std.id_siswa).trim().toUpperCase();
    const stdRecords = allHistory.filter(r => String(r.id_siswa).trim().toUpperCase() === idS);
    stdRecords.sort((a,b) => String(a.tanggal).localeCompare(String(b.tanggal)));

    let totalAlpa = 0;
    stdRecords.forEach(r => {
      const stAkhir = String(r.status_akhir || r.status_presensi || "").trim().toUpperCase();
      if (stAkhir === "ALPA") totalAlpa++;
    });

    let maxSeqTerlambat = 0, currentSeqTerlambat = 0;
    stdRecords.forEach(r => {
      const stPagi = String(r.status_pagi || "").trim().toUpperCase();
      if (stPagi === "TERLAMBAT") {
        currentSeqTerlambat++;
        if (currentSeqTerlambat > maxSeqTerlambat) maxSeqTerlambat = currentSeqTerlambat;
      } else if (stPagi === "HADIR") {
        currentSeqTerlambat = 0;
      }
    });

    let maxSeqBolos = 0, currentSeqBolos = 0;
    stdRecords.forEach(r => {
      const stAkhir = String(r.status_akhir || r.status_presensi || "").trim().toUpperCase();
      if (stAkhir === "BOLOS") {
        currentSeqBolos++;
        if (currentSeqBolos > maxSeqBolos) maxSeqBolos = currentSeqBolos;
      } else if (stAkhir !== "") {
        currentSeqBolos = 0;
      }
    });

    const categories = [];
    if (totalAlpa >= 3) categories.push(`Akumulasi ${totalAlpa}x Alpa`);
    if (maxSeqTerlambat >= 3) categories.push(`3x Terlambat Berturut-turut`);
    if (maxSeqBolos >= 3) categories.push(`3x Bolos Berturut-turut`);

    if (categories.length > 0) {
      detectedList.push({
        student: std,
        categories: categories,
        categoryText: categories.join(", "),
        isDone: !!tlStore[std.id_siswa],
        savedInfo: tlStore[std.id_siswa] || null
      });
    }
  });

  const pendingItems = detectedList.filter(item => !item.isDone);
  const doneItems = detectedList.filter(item => item.isDone);

  document.getElementById("tl-count-pending").innerText = pendingItems.length;
  document.getElementById("tl-count-done").innerText = doneItems.length;

  const activeItems = (currentTLTab === "pending") ? pendingItems : doneItems;

  if (activeItems.length === 0) {
    container.innerHTML = `
      <div class="bg-white p-6 rounded-2xl border border-gray-200 text-center text-xs text-gray-500 space-y-1">
        <i class="fa-solid fa-circle-check text-2xl ${currentTLTab === 'pending' ? 'text-emerald-500' : 'text-gray-300'}"></i>
        <p class="font-bold text-gray-700">${currentTLTab === 'pending' ? 'Tidak Ada Siswa Perlu Penanganan' : 'Belum Ada Siswa Selesai Ditindak'}</p>
        <p class="text-[10px] text-gray-400">${currentTLTab === 'pending' ? 'Seluruh siswa aman dari kriteria pelanggaran.' : 'Siswa yang sudah ditindaklanjuti akan muncul di sini.'}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = activeItems.map(item => {
    const std = item.student;
    const isDone = item.isDone;
    const info = item.savedInfo;

    return `
      <div class="bg-white p-3.5 rounded-2xl border ${isDone ? 'border-emerald-200 bg-emerald-50/20' : 'border-rose-200 shadow-sm'} space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div>
            <h4 class="font-bold text-xs text-gray-900">${std.nama}</h4>
            <p class="text-[10px] text-gray-500">Kelas: <b>${std.kelas}</b> | ID: ${std.id_siswa}</p>
          </div>
          <span class="text-[9px] font-extrabold px-2 py-0.5 rounded-md ${isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
            ${isDone ? 'Sudah Ditindak' : 'Perlu Penanganan'}
          </span>
        </div>

        <div class="p-2 rounded-xl text-xs font-semibold ${isDone ? 'bg-emerald-50 text-emerald-900 border border-emerald-100' : 'bg-rose-50 text-rose-900 border border-rose-100'}">
          <i class="fa-solid fa-triangle-exclamation text-[10px] mr-1"></i> Pelanggaran: ${item.categoryText}
        </div>

        ${isDone ? `
          <div class="bg-gray-50 p-2 rounded-xl text-[11px] text-gray-700 border border-gray-200 space-y-0.5">
            <p><b>Catatan Tindakan:</b> ${info.catatan || '-'}</p>
            <p class="text-[9px] text-gray-400">Ditangani tgl: ${info.tanggal}</p>
          </div>
        ` : ''}

        <div class="pt-1 flex justify-end items-center gap-2 border-t border-gray-100">
          ${!isDone ? `
            <button onclick="openTLActionModal('${std.id_siswa}', '${std.nama}', '${item.categoryText}')" class="px-3 py-1.5 bg-rose-600 text-white font-bold text-xs rounded-xl shadow-sm hover:bg-rose-700 active:scale-95 transition flex items-center gap-1.5">
              <i class="fa-solid fa-user-shield"></i> Tindak Lanjut
            </button>
          ` : `
            <button onclick="reopenTLStatus('${std.id_siswa}')" class="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px] rounded-lg hover:bg-amber-100 transition flex items-center gap-1">
              <i class="fa-solid fa-arrow-rotate-left"></i> Buka Kembali
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');
}

function openTLActionModal(idSiswa, nama, kategoriText) {
  document.getElementById('tl-modal-id-siswa').value = idSiswa;
  document.getElementById('tl-modal-nama').value = nama;
  document.getElementById('tl-modal-kategori-text').value = kategoriText;
  document.getElementById('tl-modal-catatan').value = "";
  document.getElementById('tl-action-modal').classList.remove('hidden');
}

function closeTLActionModal() {
  document.getElementById('tl-action-modal').classList.add('hidden');
}

function confirmSaveTLAction() {
  const idSiswa = document.getElementById('tl-modal-id-siswa').value;
  const catatan = document.getElementById('tl-modal-catatan').value.trim();
  const kategoriText = document.getElementById('tl-modal-kategori-text').value;

  if (!catatan) return alert("Isi catatan penanganan terlebih dahulu!");

  const d = new Date();
  const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  saveLocalTLStatus(idSiswa, {
    tanggal: todayStr,
    catatan: catatan,
    kategori: kategoriText
  });

  closeTLActionModal();
  renderTindakLanjutView();
}

function reopenTLStatus(idSiswa) {
  if (confirm("Yakin ingin membatalkan status penanganan dan mengembalikan ke daftar 'Perlu Penanganan'?")) {
    removeLocalTLStatus(idSiswa);
    renderTindakLanjutView();
  }
}