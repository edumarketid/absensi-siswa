function showLoginModal() { document.getElementById("login-modal").classList.remove("hidden"); }
function hideLoginModal() { document.getElementById("login-modal").classList.add("hidden"); }

function handleRoleBadgeClick() {
  if (currentUserRole === "ADMIN") {
    if (confirm("Keluar dari Mode Admin dan kembali menjadi Petugas?")) {
      switchToPetugasRole();
    }
  } else {
    showLoginModal();
  }
}

function switchToPetugasRole() {
  currentUserRole = "PETUGAS";
  localStorage.setItem("USER_ROLE", "PETUGAS");
  updateRoleUI();
  alert("Kembali ke mode Petugas.");
}

async function processAdminLogin() {
  const pass = document.getElementById("admin-pass-input").value;
  if (!pass) return alert("Masukkan password admin!");

  try {
    // Disesuaikan untuk membaca kolom 'kunci' dan 'nilai' (huruf kecil)
    const { data, error } = await supabaseClient
      .from('pengaturan')
      .select('nilai')
      .eq('kunci', 'ADMIN_PASSWORD')
      .maybeSingle();

    const storedPassword = data ? data.nilai : "123456";

    if (pass === storedPassword) {
      currentUserRole = "ADMIN";
      localStorage.setItem("USER_ROLE", "ADMIN");
      document.getElementById("admin-pass-input").value = "";
      updateRoleUI();
      hideLoginModal();
      alert("Login Admin Berhasil!");
    } else {
      alert("Password Salah!");
    }
  } catch (e) {
    alert("Gagal memverifikasi password admin!");
  }
}

function updateRoleUI() {
  const badge = document.getElementById("app-role-badge");
  const statusText = document.getElementById("menu-role-status-text");

  if (currentUserRole === "ADMIN") {
    if (badge) {
      badge.innerText = "ADMIN (LOGOUT)";
      badge.className = "text-[10px] font-bold text-emerald-300 bg-emerald-950/60 px-1.5 py-0.2 rounded-md border border-emerald-500/30 cursor-pointer select-none";
    }
    if (statusText) {
      statusText.innerText = "MODE ADMIN";
      statusText.className = "text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800";
    }
  } else {
    if (badge) {
      badge.innerText = "PETUGAS";
      badge.className = "text-[10px] font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.2 rounded-md border border-amber-500/30 cursor-pointer select-none";
    }
    if (statusText) {
      statusText.innerText = "MODE PETUGAS";
      statusText.className = "text-[9px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800";
    }
  }
  if (typeof renderMenuModalGrid === "function") renderMenuModalGrid();
}