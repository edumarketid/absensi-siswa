function initDatabase() {
  return new Promise((resolve) => {
    const req = indexedDB.open("AbsensiQR_DB", 3);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains("students")) database.createObjectStore("students", { keyPath: "id_siswa" });
      if (!database.objectStoreNames.contains("attendance_queue")) database.createObjectStore("attendance_queue", { keyPath: "queue_id" });
      if (!database.objectStoreNames.contains("attendance_history")) database.createObjectStore("attendance_history", { keyPath: "queue_id" });
    };
    req.onsuccess = (e) => { 
      db = e.target.result; 
      updateQueueCountUI(); 
      loadLocalHistoryToMemory();
      resolve(db); 
    };
  });
}

function saveToAttendanceQueue(record) {
  return new Promise((resolve) => {
    const tx = db.transaction("attendance_queue", "readwrite");
    tx.objectStore("attendance_queue").put(record);
    tx.oncomplete = () => { updateQueueCountUI(); resolve(); };
  });
}

function saveToLocalHistoryDB(record) {
  return new Promise((resolve) => {
    if (!db) return resolve();
    const tx = db.transaction("attendance_history", "readwrite");
    tx.objectStore("attendance_history").put(record);
    tx.oncomplete = () => resolve();
  });
}

function getAllQueueFromDB() {
  return new Promise((resolve) => {
    if (!db) return resolve([]);
    const tx = db.transaction("attendance_queue", "readonly");
    tx.objectStore("attendance_queue").getAll().onsuccess = (e) => resolve(e.target.result || []);
  });
}

function getAllLocalHistoryFromDB() {
  return new Promise((resolve) => {
    if (!db) return resolve([]);
    const tx = db.transaction("attendance_history", "readonly");
    tx.objectStore("attendance_history").getAll().onsuccess = (e) => resolve(e.target.result || []);
  });
}

function updateQueueCountUI() {
  getAllQueueFromDB().then(recs => { 
    const el = document.getElementById('queue-count');
    if (el) el.innerText = recs.length; 
  });
}