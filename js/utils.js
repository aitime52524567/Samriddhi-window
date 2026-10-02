/* ===================== 工具函数 ===================== */
window.App = window.App || {};

(function () {
  const App = window.App;

  App.uid = function (prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  };

  App.now = function () {
    return new Date().toISOString();
  };

  App.today = function () {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  };

  App.fmtDate = function (ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d)) return String(ts);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  };

  App.fmtDateTime = function (ts) {
    if (!ts) return '';
    const d = new Date(ts);
    if (isNaN(d)) return String(ts);
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day + ' ' + h + ':' + mi;
  };

  App.fmtMoney = function (n) {
    if (n === null || n === undefined || isNaN(n)) return '0.00';
    return '¥' + Number(n).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  App.fmtNum = function (n) {
    if (n === null || n === undefined || isNaN(n)) return '0';
    return Number(n).toLocaleString('zh-CN');
  };

  App.num = function (v) {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  };

  App.escapeHtml = function (s) {
    if (s === null || s === undefined) return '';
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  // 生成单号：前缀 + 年月日 + 序号
  App.genNo = async function (prefix) {
    const dateStr = App.today().replace(/-/g, '');
    const key = 'ddw_seq_' + prefix + '_' + dateStr;
    let seq = 1;
    try {
      seq = parseInt(localStorage.getItem(key) || '0', 10) + 1;
    } catch (e) {}
    localStorage.setItem(key, String(seq));
    return prefix + dateStr + '-' + String(seq).padStart(3, '0');
  };

  App.debounce = function (fn, ms) {
    let t;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  };

  App.monthStart = function () {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  };

  App.yearStart = function () {
    const d = new Date();
    return new Date(d.getFullYear(), 0, 1).toISOString();
  };

  // 区间判断：本月
  App.isThisMonth = function (ts) {
    if (!ts) return false;
    const d = new Date(ts), n = new Date();
    return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth();
  };

  // 下载文本文件
  App.download = function (filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  };

  App.readFileAsText = function (file) {
    return new Promise(function (resolve, reject) {
      const r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = reject;
      r.readAsText(file);
    });
  };

  /* ---------- 模块注册 ---------- */
  App.moduleList = [];
  App.registerModule = function (mod) {
    App.moduleList.push(mod);
  };

  /* ---------- 图标 ---------- */
  App.icons = {
    dashboard: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    customers: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    measure: '<rect x="1" y="8" width="22" height="8" rx="2"/><line x1="6" y1="8" x2="6" y2="16"/><line x1="11" y1="8" x2="11" y2="16"/><line x1="16" y1="8" x2="16" y2="16"/><line x1="21" y1="8" x2="21" y2="16"/>',
    orders: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    production: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    install: '<rect x="1" y="3" width="15" height="13" rx="1"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
    finance: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
  };

  App.icon = function (name, size) {
    const path = App.icons[name] || App.icons.dashboard;
    return '<svg viewBox="0 0 24 24" width="' + (size || 19) + '" height="' + (size || 19) + '" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + path + '</svg>';
  };

  // CSV 导出（处理中文，带 BOM）
  App.toCSV = function (rows) {
    const esc = function (v) {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
      return s;
    };
    const lines = rows.map(function (r) { return r.map(esc).join(','); });
    return '\uFEFF' + lines.join('\r\n');
  };
})();
