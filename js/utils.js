function playBeepSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); 
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15); 
  } catch(e) {}
}

function padZeroTime(timeStr) {
  if (!timeStr || typeof timeStr !== "string" || timeStr.trim() === "" || timeStr === "undefined" || timeStr === "null") return "00:00";
  var clean = timeStr.trim();
  var match = clean.match(/\d{1,2}:\d{2}/);
  if (match) {
    var parts = match[0].split(":");
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    if (isNaN(h) || h > 23 || h < 0) h = 0;
    if (isNaN(m) || m > 59 || m < 0) m = 0;
    var hStr = h < 10 ? "0" + h : "" + h;
    var mStr = m < 10 ? "0" + m : "" + m;
    return hStr + ":" + mStr;
  }
  return "00:00";
}

function parseBool(val, defaultVal = false) {
  if (val === null || val === undefined || val === "") return defaultVal;
  if (typeof val === "boolean") return val;
  const str = String(val).trim().toLowerCase();
  if (str === "true") return true;
  if (str === "false") return false;
  return defaultVal;
}

function formatCleanDateLocal(val) {
  if (!val) return "";
  const str = String(val).trim();
  const match = str.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : str;
}

function downloadCSVTemplate() {
  const csvHeader = "ID_SISWA,NISN,NAMA_SISWA,KELAS,TTL\nS101,0081234567,Ahmad Fauzi,X TKR 1,\"Jakarta, 12 Desember 2012\"\nS102,0087654321,Siti Rahma,X TKR 1,\"Makassar, 15 Februari 2012\"\nS103,0089988776,Budi Santoso,X TKR 2,\"Wakatobi, 20 Maret 2012\"";
  const blob = new Blob([csvHeader], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "Template_Data_Siswa.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function parseCSVLine(line) {
  const pattern = new RegExp(
    '\\s*("([^"]*(?:""[^"]*)*)"|([^,;]+)|)\\s*(?:[,;]|$)',
    'g'
  );
  const values = [];
  let match;
  while ((match = pattern.exec(line)) !== null) {
    if (match.index === pattern.lastIndex) {
      pattern.lastIndex++;
    }
    let value = match[2] !== undefined ? match[2].replace(/""/g, '"') : match[3];
    if (value !== undefined) {
      values.push(value.trim());
    }
  }
  return values;
}