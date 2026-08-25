// =========================================================
// app.js — Frontend GitHub (satu-satunya frontend publik)
// =========================================================
// Frontend TIDAK menyimpan password/secret/credential DI SERVER.
// "Ingat saya" hanya menyimpan data secara LOKAL di browser
// pengguna (localStorage), tidak pernah dikirim ke tempat lain
// selain proses login normal ke Apps Script Master.
// Frontend TIDAK menentukan tenant/database secara bebas —
// seluruhnya diputuskan oleh Apps Script Master di server.
// =========================================================

var REMEMBER_KEY = 'sima_remember_v1';

function toggleForm(target) {
  var isLogin = target === 'login';
  document.getElementById('formLogin').classList.toggle('hidden', !isLogin);
  document.getElementById('formRegister').classList.toggle('hidden', isLogin);
  document.getElementById('formTitle').textContent = isLogin ? 'Halaman Login SIMA' : 'Daftarkan Lembaga';
  document.getElementById('formSub').textContent = isLogin
    ? ''
    : 'Pendaftaran akan diperiksa dan disetujui oleh Superadmin sebelum dapat login.';
}

function togglePassword() {
  var input = document.getElementById('loginPassword');
  var isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
}

function setMsg(id, text, kind) {
  var el = document.getElementById(id);
  el.textContent = text || '';
  el.className = 'msg' + (kind ? (' ' + kind) : '');
}

function masterUrl() {
  var url = (window.SIMA_CONFIG || {}).MASTER_URL;
  if (!url || url.indexOf('PASTE_URL') !== -1) {
    throw new Error('MASTER_URL belum dikonfigurasi di config.js');
  }
  return url;
}

async function callMaster(action, payload) {
  var res = await fetch(masterUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // hindari CORS preflight pada Apps Script
    body: JSON.stringify(Object.assign({ action: action }, payload))
  });
  return res.json();
}

// --- "Ingat saya": simpan/kembalikan username & password secara LOKAL saja ---
function loadRemembered() {
  try {
    var raw = localStorage.getItem(REMEMBER_KEY);
    if (!raw) return;
    var data = JSON.parse(atob(raw));
    if (data && data.u) {
      document.getElementById('loginUsername').value = data.u;
      document.getElementById('loginPassword').value = data.p ? atob(data.p) : '';
      document.getElementById('rememberMe').checked = true;
    }
  } catch (e) {
    localStorage.removeItem(REMEMBER_KEY);
  }
}

function saveRemembered(username, password, remember) {
  if (!remember) {
    localStorage.removeItem(REMEMBER_KEY);
    return;
  }
  var data = { u: username, p: btoa(password) };
  localStorage.setItem(REMEMBER_KEY, btoa(JSON.stringify(data)));
}

document.addEventListener('DOMContentLoaded', loadRemembered);

// =========================================================
// PWA: splash loading, registrasi service worker, tombol Instal
// =========================================================
document.addEventListener('DOMContentLoaded', function () {
  var loading = document.getElementById('loading');
  if (loading) {
    // Beri jeda singkat supaya animasi kartu login tidak "tabrakan"
    // dengan splash, lalu sembunyikan.
    setTimeout(function () { loading.classList.add('hidden'); }, 350);
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('./sw.js').catch(function (err) {
      console.warn('SW register gagal:', err);
    });
  });
}

var deferredPrompt = null;
var installBtn = document.getElementById('install-btn');

// Sudah berjalan sebagai app terinstall (standalone)? Kalau ya, tombol
// tidak perlu ditampilkan sama sekali.
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true; // iOS Safari
}

// iOS Safari TIDAK PERNAH mengirim event 'beforeinstallprompt' (Apple tidak
// mendukung API ini). Satu-satunya cara install di iOS adalah manual lewat
// menu Share -> "Add to Home Screen". Untuk browser ini kita tetap tampilkan
// tombolnya, tapi saat diklik menampilkan instruksi, bukan prompt otomatis.
function isIos() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function refreshInstallButton() {
  if (!installBtn) return;
  if (isStandalone()) {
    installBtn.classList.remove('visible');
    return;
  }
  if (deferredPrompt || isIos()) {
    installBtn.classList.add('visible');
  } else {
    installBtn.classList.remove('visible');
  }
}

window.addEventListener('beforeinstallprompt', function (e) {
  e.preventDefault();
  deferredPrompt = e;
  refreshInstallButton();
});

if (installBtn) {
  installBtn.addEventListener('click', function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.finally(function () {
        deferredPrompt = null;
        refreshInstallButton();
      });
      return;
    }
    if (isIos()) {
      alert('Untuk instal di iPhone/iPad:\n\n1. Ketuk ikon Share (kotak dengan panah ke atas) di Safari\n2. Pilih "Add to Home Screen" / "Tambah ke Layar Utama"\n3. Ketuk "Add"');
    }
  });
}

window.addEventListener('appinstalled', function () {
  deferredPrompt = null;
  refreshInstallButton();
});

// Tampilkan tombol sedini mungkin untuk kasus iOS (tidak menunggu event apa pun).
refreshInstallButton();


async function doLogin(e) {
  e.preventDefault();
  var btn = document.getElementById('loginBtn');
  setMsg('loginMsg', '');
  btn.disabled = true; btn.textContent = 'Memeriksa...';

  var username = document.getElementById('loginUsername').value.trim();
  var password = document.getElementById('loginPassword').value;
  var remember = document.getElementById('rememberMe').checked;

  try {
    var res = await callMaster('tenantLogin', { username: username, password: password });
    if (res.ok) {
      saveRemembered(username, password, remember);
      setMsg('loginMsg', 'Berhasil, mengarahkan ke ' + res.namaLembaga + '...', 'ok');
      var target = res.backendUrl + (res.backendUrl.indexOf('?') === -1 ? '?' : '&') +
        'tenant=' + encodeURIComponent(res.tenantId) + '&token=' + encodeURIComponent(res.token);
      window.location.href = target;
    } else {
      setMsg('loginMsg', humanizeError(res.message), 'err');
    }
  } catch (err) {
    setMsg('loginMsg', 'Tidak dapat menghubungi server: ' + err.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Masuk';
  }
  return false;
}

async function doRegister(e) {
  e.preventDefault();
  var btn = document.getElementById('registerBtn');
  setMsg('registerMsg', '');
  btn.disabled = true; btn.textContent = 'Mengirim...';

  var namaLembaga = document.getElementById('regNama').value.trim();
  var username = document.getElementById('regUsername').value.trim();
  var password = document.getElementById('regPassword').value;

  try {
    var res = await callMaster('tenantRegister', { namaLembaga: namaLembaga, username: username, password: password });
    if (res.ok) {
      setMsg('registerMsg', 'Pendaftaran terkirim (' + res.tenantId + '). Menunggu persetujuan Superadmin.', 'ok');
      document.getElementById('formRegister').reset();
    } else {
      setMsg('registerMsg', humanizeError(res.message), 'err');
    }
  } catch (err) {
    setMsg('registerMsg', 'Tidak dapat menghubungi server: ' + err.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = 'Daftar';
  }
  return false;
}

function humanizeError(code) {
  var map = {
    TENANT_NOT_FOUND: 'Username tidak ditemukan',
    PASSWORD_SALAH: 'Password salah',
    TENANT_NOT_ACTIVE: 'Akun belum aktif / masih menunggu persetujuan Superadmin',
    CLUSTER_NOT_FOUND: 'Cluster tenant tidak ditemukan, hubungi Superadmin',
    CLUSTER_NOT_AVAILABLE: 'Server sedang tidak tersedia, coba lagi nanti'
  };
  return map[code] || code || 'Terjadi kesalahan';
}
