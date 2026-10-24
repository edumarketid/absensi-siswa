async function autoDownloadMasterStudents(targetDateStr) {
  if (!navigator.onLine) {
    loadLocalHistoryToMemory();
    return;
  }

  if (!targetDateStr) {
    const d = new Date();
    const realToday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const monDate = document.getElementById("monitoring-date-filter") ? document.getElementById("monitoring-date-filter").value : "";
    const dashDate = document.getElementById("dashboard-date-filter") ? document.getElementById("dashboard-date-filter").value : "";
    targetDateStr = formatCleanDateLocal(monDate || dashDate || realToday);
  } else {
    targetDateStr = formatCleanDateLocal(targetDateStr);
  }

  try {
    // 1. Ambil Data Siswa dari Supabase
    const { data: studentsData, error: stdError } = await supabaseClient.from('siswa').select('*');
    if (stdError) console.error("Error fetching siswa:", stdError);
    
    // 2. Ambil Data Absensi Harian (Disesuaikan dengan tanggal)
    const { data: attendanceData } = await supabaseClient
      .from('absensi_harian')
      .select('*')
      .or(`tanggal.eq.${targetDateStr},TANGGAL.eq.${targetDateStr}`);

    // 3. Ambil Pengaturan Waktu
    const { data: timeData } = await supabaseClient.from('pengaturan_waktu').select('*');
    if (timeData && Array.isArray(timeData)) {
      const timeObj = {};
      timeData.forEach(t => {
        const k = t.kunci_waktu || t.KUNCI_WAKTU;
        const v = t.nilai || t.NILAI;
        if (k) timeObj[k] = v;
      });
      if (typeof applyTimeSettingsFromCloud === "function") applyTimeSettingsFromCloud(timeObj);
    }

    // 4. Ambil Pengaturan Umum Sekolah
    const { data: configData } = await supabaseClient.from('pengaturan').select('*');
    if (configData && Array.isArray(configData)) {
      const cfgMap = {};
      configData.forEach(c => {
        const k = c.kunci || c.KUNCI;
        const v = c.nilai || c.NILAI;
        if (k) cfgMap[k] = v;
      });
      const schoolName = cfgMap.SCHOOL_NAME || "SMK Negeri 1 Wakatobi";
      const academicYear = cfgMap.ACADEMIC_YEAR || "2026/2027";
      localStorage.setItem("SCHOOL_NAME", schoolName);
      localStorage.setItem("ACADEMIC_YEAR", academicYear);
      const headerEl = document.getElementById("app-header-school-name");
      if (headerEl) headerEl.innerText = `${schoolName} (${academicYear})`;
    }

    // Normalisasi Data Siswa ke IndexedDB
    if (studentsData && Array.isArray(studentsData)) {
      const normalizedStudents = studentsData.map(s => {
        const id = s.id_siswa || s.ID_SISWA || s.id;
        const nisnVal = s.nisn || s.NISN || "-";
        const namaVal = s.nama_siswa || s.NAMA_SISWA || s.nama || "";
        const kelasVal = s.kelas || s.KELAS || "";
        const ttlVal = s.ttl || s.TTL || "-";
        const jkVal = s.jenis_kelamin || s.JENIS_KELAMIN || s.jk || "-";
        const statusVal = s.status || s.STATUS || s.status_siswa;
        let activeBool = true;

        if (statusVal !== undefined && statusVal !== null) {
          const stStr = String(statusVal).toLowerCase().trim();
          activeBool = (stStr === 'aktif' || stStr === 'true' || stStr === '1');
        } else if (s.active !== undefined) {
          activeBool = parseBool(s.active, true);
        }

        return {
          id_siswa: String(id).trim(),
          nisn: String(nisnVal).trim(),
          nama: String(namaVal).trim(),
          kelas: String(kelasVal).trim(),
          ttl: String(ttlVal).trim(),
          jenis_kelamin: String(jkVal).trim(),
          active: activeBool
        };
      }).filter(s => s.id_siswa && s.id_siswa !== 'undefined');

      if (db) {
        const tx = db.transaction("students", "readwrite");
        const store = tx.objectStore("students");
        store.clear();
        normalizedStudents.forEach(s => store.put(s));
        tx.oncomplete = () => {
          if (typeof loadStudentsView === "function") loadStudentsView();
          if (typeof populateClassDropdowns === "function") populateClassDropdowns();
        };
      }
    }

    // Normalisasi Data Absensi Harian
    if (attendanceData && Array.isArray(attendanceData)) {
      fetchedTodayAttendance = attendanceData.map(a => {
        const tgl = formatCleanDateLocal(a.tanggal || a.TANGGAL || targetDateStr);
        const idS = a.id_siswa || a.ID_SISWA;
        const logId = a.log_id || a.LOG_ID || `${tgl}_${idS}`;
        const stAkhir = a.status_akhir || a.STATUS_AKHIR || a.status_presensi || a.STATUS_PRESENSI || "HADIR";

        return {
          queue_id: String(logId),
          tanggal: tgl,
          id_siswa: String(idS).trim(),
          nama: a.nama_siswa || a.NAMA_SISWA || a.nama || "",
          kelas: a.kelas || a.KELAS || "",
          jam_pagi: a.jam_pagi || a.JAM_PAGI || "",
          status_pagi: a.status_pagi || a.STATUS_PAGI || "",
          jam_siang: a.jam_siang || a.JAM_SIANG || "",
          status_siang: a.status_siang || a.STATUS_SIANG || "",
          status_akhir: String(stAkhir).toUpperCase(),
          status_presensi: String(stAkhir).toUpperCase()
        };
      });
    } else {
      fetchedTodayAttendance = [];
    }

    if (typeof updateMonitoringDashboard === "function") updateMonitoringDashboard();
    if (typeof renderDashboardView === "function") renderDashboardView();

  } catch (e) {
    console.error("Gagal memuat data dari Server:", e);
    loadLocalHistoryToMemory();
  }
}

async function triggerManualSync() {
  if (!navigator.onLine) {
    alert("Perangkat sedang Offline. Pastikan koneksi internet terhubung untuk mengirim antrean!");
    return;
  }
  
  const btnSync = document.getElementById("btn-manual-sync");
  const originalHTML = btnSync ? btnSync.innerHTML : "";
  
  if (btnSync) {
    btnSync.disabled = true;
    btnSync.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-[10px]"></i><span>Mengirim...</span>`;
  }
  
  await syncQueueToGAS();
  
  if (btnSync) {
    btnSync.disabled = false;
    btnSync.innerHTML = originalHTML;
  }
}

async function syncQueueToGAS() {
  const queueData = await getAllQueueFromDB();
  const infoEl = document.getElementById("sync-info-text");
  if (queueData.length === 0) {
    if (infoEl) infoEl.innerText = "Antrean kosong (semua data tersimpan).";
    return;
  }

  try {
    const payload = queueData.map(q => ({
      log_id: `${q.tanggal}-${q.id_siswa}`,
      LOG_ID: `${q.tanggal}-${q.id_siswa}`,
      tanggal: q.tanggal,
      TANGGAL: q.tanggal,
      id_siswa: q.id_siswa,
      ID_SISWA: q.id_siswa,
      nama_siswa: q.nama,
      NAMA_SISWA: q.nama,
      kelas: q.kelas,
      KELAS: q.kelas,
      jam_pagi: q.jam_pagi || (q.sesi === "PAGI" ? q.jam : null),
      JAM_PAGI: q.jam_pagi || (q.sesi === "PAGI" ? q.jam : null),
      status_pagi: q.status_pagi || (q.sesi === "PAGI" ? q.status_presensi : null),
      STATUS_PAGI: q.status_pagi || (q.sesi === "PAGI" ? q.status_presensi : null),
      jam_siang: q.jam_siang || (q.sesi === "SIANG" ? q.jam : null),
      JAM_SIANG: q.jam_siang || (q.sesi === "SIANG" ? q.jam : null),
      status_siang: q.status_siang || (q.sesi === "SIANG" ? q.status_presensi : null),
      STATUS_SIANG: q.status_siang || (q.sesi === "SIANG" ? q.status_presensi : null),
      status_akhir: q.status_akhir || q.status_presensi,
      STATUS_AKHIR: q.status_akhir || q.status_presensi
    }));

    const { error } = await supabaseClient.from('absensi_harian').upsert(payload, { onConflict: 'log_id' });

    if (!error) {
      const tx = db.transaction("attendance_queue", "readwrite");
      const store = tx.objectStore("attendance_queue");
      queueData.forEach(q => store.delete(q.queue_id));
      
      tx.oncomplete = () => {
        if (typeof updateQueueCountUI === "function") updateQueueCountUI();
        if (infoEl) infoEl.innerText = "Berhasil terkirim ke Server!";
      };
    } else {
      console.error("Server Error:", error);
      alert("Gagal mengirim ke Server: " + error.message);
      if (infoEl) infoEl.innerText = "Gagal sinkron. Cek RLS / Koneksi.";
    }
  } catch (e) {
    console.error("Gagal sinkron ke Server:", e);
    alert("Terjadi kesalahan saat pengiriman data.");
  }
}