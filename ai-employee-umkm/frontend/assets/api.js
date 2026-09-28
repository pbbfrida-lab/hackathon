// Helper fetch bersama untuk dashboard dan chat.
(function () {
  const t = (key, vars) => (window.I18N ? window.I18N.t(key, vars) : key);

  async function api(path, options = {}) {
    const key = localStorage.getItem('omnistaff_api_key');
    const lang = window.I18N ? window.I18N.lang() : 'id';
    const headers = {
      'Content-Type': 'application/json',
      'x-omnistaff-lang': lang,
      ...(key ? { 'x-api-key': key } : {}),
    };
    let res = await fetch(path, { ...options, headers: { ...headers, ...(options.headers || {}) } });
    if (res.status === 401) {
      const entered = window.prompt(t('common.apiKeyPrompt'));
      if (entered) {
        localStorage.setItem('omnistaff_api_key', entered);
        return api(path, options);
      }
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || t('common.errorPrefix', { status: res.status }));
    return data;
  }
  window.api = api;
  window.rupiah = (n) => (window.I18N ? window.I18N.rupiah(n) : 'Rp' + Number(n || 0).toLocaleString('id-ID'));
})();
