// =========================================================
// app.js — Frontend GitHub (satu-satunya frontend publik)
// =========================================================
// Frontend TIDAK menyimpan password/secret/credential.
// Frontend TIDAK menentukan tenant/database secara bebas —
// seluruhnya diputuskan oleh Apps Script Master di server.
// =========================================================

function switchTab(tab) {
  var isLogin = tab === 'login';
  document.getElementById('tabLogin').classList.toggle('active', isLogin);
  document.getElementById('tabRegister').classList.toggle('active', !isLogin);
  document.getElementById('formLogin').classList.toggle('hidden', !isLogin);
  document.getElementById('formRegister').classList.toggle('hidden', isLogin);
  document.getElementById('formTitle').textContent = isLogin ? 'Masuk ke SIMA' : 'Daftarkan Lembaga';
  document.getElementById('formSub').textContent = isLogin
    ? 'Portal madrasah — satu pintu untuk semua lembaga.'
    : 'Pendaftaran akan diperiksa dan disetujui oleh Superadmin sebelum dapat login.';
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

async function doLogin(e) {
  e.preventDefault();
  var btn = document.getElementById('loginBtn');
  setMsg('loginMsg', '');
  btn.disabled = true; btn.textContent = 'Memeriksa...';

  var username = document.getElementById('loginUsername').value.trim();
  var password = document.getElementById('loginPassword').value;

  try {
    var res = await callMaster('tenantLogin', { username: username, password: password });
    if (res.ok) {
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
