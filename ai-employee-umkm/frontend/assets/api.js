// Helper fetch bersama untuk dashboard dan chat.
(function () {
  async function api(path, options = {}) {
    const key = localStorage.getItem('omnistaff_api_key');
    const headers = { 'Content-Type': 'application/json', ...(key ? { 'x-api-key': key } : {}) };
    let res = await fetch(path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    if (res.status === 401) {
      const entered = window.prompt('Masukkan API key (APP_API_KEY di file .env):');
      if (entered) {
        localStorage.setItem('omnistaff_api_key', entered);
        return api(path, options);
      }
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Permintaan gagal (${res.status})`);
    return data;
  }
  window.api = api;
  window.rupiah = (n) => 'Rp' + Number(n || 0).toLocaleString('id-ID');
})();
