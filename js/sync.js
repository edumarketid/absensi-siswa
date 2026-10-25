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
      .eq('tanggal', targetDateStr);

    // 3. Ambil Pengaturan Waktu
    const { data: timeData } = await supabaseClient.from('pengaturan_waktu').select('*');
    if (timeData && Array.isArray(timeData)) {
      const timeObj = {};
      timeData.forEach(t => {
        const k = t.kunci_waktu;
        const v = t.nilai;
        if (k) timeObj[k] = v;
      });
      if (typeof applyTimeSettingsFromCloud === "function") applyTimeSettingsFromCloud(timeObj);
    }

    // 4. Ambil Pengaturan Umum Sekolah
    const { data: configData } = await supabaseClient.from('pengaturan').select('*');
    if (configData && Array.isArray(configData)) {
      const cfgMap = {};
      configData.forEach(c => {
        const k = c.kunci;
        const v = c.nilai;
        if (k) cfgMap[k] = v;
      });
      const schoolName = cfgMap.SCHOOL_NAME || "SMK Negeri 1 Wakatobi";
      const academicYear = cfgMap.ACADEMIC_YEAR || "2026/2027";
      localStorage.setItem("SCHOOL_NAME", schoolName);
      localStorage.setItem("ACADEMIC_YEAR", academicYear);
      const headerEl = document.getElementById("app-header-school-name");
      if (headerEl) headerEl.innerText = `${schoolName} (${academicYear})`;
    }

    // Normalisasi Data Siswa ke IndexedDB (Sinkronisasi Penuh)
    if (studentsData && Array.isArray(studentsData)) {
      const normalizedStudents = studentsData.map(s => {
        const id = s.id_siswa || s.id;
        const nisnVal = s.nisn || "-";
        const namaVal = s.nama_siswa || s.nama || "";
        const kelasVal = s.kelas || "";
        const ttlVal = s.ttl || "-";
        const jkVal = s.jenis_kelamin || "-";
        const statusVal = s.status || s.status_siswa;
        let activeBool = true;

        if (statusVal !== undefined && statusVal !== null && statusVal !== "") {
          const stStr = String(statusVal).toLowerCase().trim();
          if (stStr === 'non-aktif' || stStr === 'nonaktif' || stStr === 'false' || stStr === '0') {
            activeBool = false;
          } else {
            activeBool = true;
          }
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
        store.clear(); // Bersihkan memori lokal lama
        normalizedStudents.forEach(s => store.put(s));
        tx.oncomplete = () => {
          if (typeof cachedStudents !== "undefined") cachedStudents = normalizedStudents;
          if (typeof loadStudentsView === "function") loadStudentsView();
          if (typeof populateClassDropdowns === "function") populateClassDropdowns();
        };
      }
    } else {
      // Jika data siswa di Supabase kosong sama sekali
      if (db) {
        const tx = db.transaction("students", "readwrite");
        tx.objectStore("students").clear();
        tx.oncomplete = () => {
          if (typeof cachedStudents !== "undefined") cachedStudents = [];
          if (typeof loadStudentsView === "function") loadStudentsView();
        };
      }
    }

    // Normalisasi Data Absensi Harian ke IndexedDB & Memori Utama (Sinkronisasi Penuh)
    let freshAttendanceList = [];
    if (attendanceData && Array.isArray(attendanceData)) {
      freshAttendanceList = attendanceData.map(a => {
        const tgl = formatCleanDateLocal(a.tanggal || targetDateStr);
        const idS = a.id_siswa;
        const logId = a.log_id || `${tgl}_${idS}`;
        const stAkhir = a.status_akhir || a.status_presensi || "HADIR";

        return {
          queue_id: String(logId),
          tanggal: tgl,
          id_siswa: String(idS).trim(),
          nama: a.nama_siswa || a.nama || "",
          kelas: a.kelas || "",
          jam_pagi: a.jam_pagi || "",
          status_pagi: a.status_pagi || "",
          jam_siang: a.jam_siang || "",
          status_siang: a.status_siang || "",
          status_akhir: String(stAkhir).toUpperCase(),
          status_presensi: String(stAkhir).toUpperCase()
        };
      });
    }

    // Update variabel global
    fetchedTodayAttendance = freshAttendanceList;

    // Bersihkan dan perbarui cache attendance_history lokal di IndexedDB
    if (db) {
      const tx = db.transaction("attendance_history", "readwrite");
      const store = tx.objectStore("attendance_history");
      store.clear(); // Hapus seluruh cache absensi lama di HP/Browser
      freshAttendanceList.forEach(rec => store.put(rec));
      tx.oncomplete = () => {
        if (typeof updateMonitoringDashboard === "function") updateMonitoringDashboard();
        if (typeof renderDashboardView === "function") renderDashboardView();
      };
    } else {
      if (typeof updateMonitoringDashboard === "function") updateMonitoringDashboard();
      if (typeof renderDashboardView === "function") renderDashboardView();
    }

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
      tanggal: q.tanggal,
      id_siswa: q.id_siswa,
      nama_siswa: q.nama,
      kelas: q.kelas,
      jam_pagi: q.jam_pagi || (q.sesi === "PAGI" ? q.jam : null),
      status_pagi: q.status_pagi || (q.sesi === "PAGI" ? q.status_presensi : null),
      jam_siang: q.jam_siang || (q.sesi === "SIANG" ? q.jam : null),
      status_siang: q.status_siang || (q.sesi === "SIANG" ? q.status_presensi : null),
      status_akhir: q.status_akhir || q.status_presensi
    }));

    const { error } = await supabaseClient.from('absensi_harian').upsert(payload, { onConflict: 'log_id' });

    if (!error) {
      const tx = db.transaction("attendance_queue", "readwrite");
      const store = tx.objectStore("attendance_queue");
      queueData.forEach(q => store.delete(q.queue_id));
      
      tx.oncomplete = () => {
        if (typeof updateQueueCountUI === "function") updateQueueCountUI();
        if (infoEl) infoEl.innerText = "Berhasil terkirim ke Server!";
        autoDownloadMasterStudents();
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