function toggleScanSessionMode() {
  currentScanSession = currentScanSession === "PAGI" ? "SIANG" : "PAGI";
  refreshRealtimeSessionUI();
}

function changeCameraFacing(facingMode) {
  activeCameraFacingMode = facingMode;
  const btnBack = document.getElementById("cam-facing-back");
  const btnFront = document.getElementById("cam-facing-front");

  if (facingMode === "environment") {
    if (btnBack) btnBack.className = "px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-blue-500 text-white shadow transition";
    if (btnFront) btnFront.className = "px-2 py-0.5 text-[9px] font-extrabold rounded-full text-gray-300 hover:text-white transition";
  } else {
    if (btnFront) btnFront.className = "px-2 py-0.5 text-[9px] font-extrabold rounded-full bg-blue-500 text-white shadow transition";
    if (btnBack) btnBack.className = "px-2 py-0.5 text-[9px] font-extrabold rounded-full text-gray-300 hover:text-white transition";
  }

  if (isCameraActive) {
    stopCamera().then(() => {
      initScanner();
    });
  }
}

async function initScanner() {
  if (!html5QrCode) html5QrCode = new Html5Qrcode("reader");
  document.getElementById('camera-off-placeholder').classList.add('hidden');
  document.getElementById('scan-frame-box').classList.remove('hidden');
  isProcessingScan = false;
  if (!isCameraActive) {
    try {
      await html5QrCode.start({ facingMode: activeCameraFacingMode }, { fps: 15, qrbox: 250 }, onScanSuccess);
      isCameraActive = true;
      document.getElementById('btn-camera-text').innerText = "Matikan Kamera";
    } catch (err) {
      console.error("Gagal memulai kamera:", err);
    }
  }
}

async function stopCamera() {
  if (html5QrCode && isCameraActive) {
    try {
      await html5QrCode.stop();
    } catch(e) {}
  }
  isCameraActive = false;
  document.getElementById('btn-camera-text').innerText = "Nyalakan Kamera";
  document.getElementById('camera-off-placeholder').classList.remove('hidden');
  document.getElementById('scan-frame-box').classList.add('hidden');
}

function toggleCameraState() { isCameraActive ? stopCamera() : initScanner(); }

async function nextScanAndAutoStartCamera() {
  isProcessingScan = false;
  toggleView('scanner');
  if (!isCameraActive) {
    await initScanner();
  }
}

async function onScanSuccess(text) {
  if (isProcessingScan) return; 
  isProcessingScan = true;

  playBeepSound();

  let nowDateObj = new Date();
  const year = nowDateObj.getFullYear();
  const month = String(nowDateObj.getMonth() + 1).padStart(2, '0');
  const day = String(nowDateObj.getDate()).padStart(2, '0');
  let dateStr = `${year}-${month}-${day}`;
  let timeStr = padZeroTime(nowDateObj.toTimeString().split(' ')[0].substring(0, 5));

  if (isManualTimeMode && customScanDateOverride && customScanTimeOverride) {
    dateStr = customScanDateOverride;
    timeStr = customScanTimeOverride;
    nowDateObj = new Date(dateStr + "T00:00:00");
  }

  const timeConfig = getTodayTimeConfig(nowDateObj);

  if (!timeConfig.active) {
    alert(`Presensi Ditolak! Hari ${timeConfig.dayKey.toUpperCase()} diatur sebagai Hari Libur / Non-Aktif.`);
    setTimeout(() => { isProcessingScan = false; }, 1500);
    return;
  }

  autoDetectOrSyncSessionMode(timeStr, nowDateObj);

  let computedStatus = "HADIR";

  if (currentScanSession === "PAGI") {
    if (timeStr < timeConfig.pStart) {
      alert(`Presensi Pagi Ditolak! Belum memasuki jam mulai pagi (${timeConfig.pStart}).`);
      setTimeout(() => { isProcessingScan = false; }, 1500);
      return;
    } else if (timeStr > timeConfig.pLimit) {
      computedStatus = "TERLAMBAT";
    }
  } else if (currentScanSession === "SIANG") {
    if (timeStr < timeConfig.sStart) {
      alert(`Presensi Siang Ditolak! Belum memasuki jam mulai siang (${timeConfig.sStart}).`);
      setTimeout(() => { isProcessingScan = false; }, 1500);
      return;
    } else if (timeStr > timeConfig.sLimit) {
      alert(`Presensi Siang Ditolak! Jam scan (${timeStr}) telah melewati batas waktu siang (${timeConfig.sLimit}).`);
      setTimeout(() => { isProcessingScan = false; }, 1500);
      return;
    }
  }

  const tx = db.transaction("students", "readonly");
  tx.objectStore("students").get(text.trim()).onsuccess = async (e) => {
    const student = e.target.result;
    if (student) {

      if (student.active !== undefined && student.active === false) {
        alert(`Presensi Gagal! Siswa (${student.nama}) berstatus NON-AKTIF.`);
        setTimeout(() => { isProcessingScan = false; }, 1500);
        return;
      }

      const queueId = `${dateStr}_${student.id_siswa}`;

      let existing = fetchedTodayAttendance.find(r => 
        String(r.id_siswa).trim().toUpperCase() === String(student.id_siswa).trim().toUpperCase() && 
        formatCleanDateLocal(r.tanggal) === dateStr
      );

      let jamPagi = existing ? (existing.jam_pagi || "") : "";
      let statusPagi = existing ? (existing.status_pagi || "") : "";
      let jamSiang = existing ? (existing.jam_siang || "") : "";
      let statusSiang = existing ? (existing.status_siang || "") : "";
      
      if (currentScanSession === "PAGI") {
        jamPagi = timeStr;
        statusPagi = computedStatus;
      } else if (currentScanSession === "SIANG") {
        jamSiang = timeStr;
        statusSiang = computedStatus;
      }

      let statusAkhir = computedStatus;
      if (existing && existing.status_pagi && currentScanSession === "SIANG") {
        statusAkhir = existing.status_pagi;
      }

      const record = {
        queue_id: queueId,
        tanggal: dateStr, 
        jam: timeStr, 
        id_siswa: student.id_siswa,
        nama: student.nama, 
        kelas: student.kelas, 
        sesi: currentScanSession,
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
        String(r.id_siswa).trim().toUpperCase() === String(student.id_siswa).trim().toUpperCase() && 
        formatCleanDateLocal(r.tanggal) === dateStr
      ));
      fetchedTodayAttendance.push(record);

      if (navigator.onLine) syncQueueToGAS();

      document.getElementById('res-nama').innerText = student.nama;
      document.getElementById('res-nisn').innerText = student.nisn || "-";
      document.getElementById('res-kelas').innerText = student.kelas;
      document.getElementById('res-jam-scan').innerText = timeStr;
      
      const statusCardBox = document.getElementById('status-card-box');
      const badgeBox = document.getElementById('res-badge-box');
      const statusText = document.getElementById('res-presensi-status');
      statusText.innerText = computedStatus;

      if (computedStatus === "TERLAMBAT") {
        statusCardBox.className = "bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center shadow-sm space-y-2";
        badgeBox.className = "text-amber-600 font-extrabold text-xl";
      } else {
        statusCardBox.className = "bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center shadow-sm space-y-2";
        badgeBox.className = "text-emerald-600 font-extrabold text-xl";
      }
      
      toggleView('success');

      setTimeout(async () => {
        await nextScanAndAutoStartCamera();
      }, 1800);

    } else {
      alert("Siswa tidak ditemukan!");
      setTimeout(() => { isProcessingScan = false; }, 1500);
    }
  };
}