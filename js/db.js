/* ===================== 数据层（localStorage 实现） ===================== */
window.App = window.App || {};

(function () {
  const App = window.App;

  const PREFIX = 'ddw_';
  const STORES = [
    'customers',
    'orders',
    'measurements',
    'productions',
    'installations',
    'materials',
    'stockLogs',
    'finances',
    'follows',
    'projects',
    'settings'
  ];

  const cache = {};

  function keyOf(store) { return PREFIX + store; }

  function load(store) {
    if (cache[store]) return cache[store];
    let data = [];
    try {
      const raw = localStorage.getItem(keyOf(store));
      data = raw ? JSON.parse(raw) : [];
    } catch (e) { data = []; }
    if (!Array.isArray(data)) data = [];
    cache[store] = data;
    return data;
  }

  function persist(store) {
    try {
      localStorage.setItem(keyOf(store), JSON.stringify(cache[store]));
    } catch (e) {
      App.toast && App.toast('保存失败：本地存储空间不足，请先备份并清理数据', 'error');
      throw e;
    }
  }

  const DB = {
    // 读取整个 store（数组）
    getAll(store) {
      return load(store).slice();
    },

    // 按 id 读取
    get(store, id) {
      return load(store).find(function (r) { return r.id === id; }) || null;
    },

    // 插入或更新（有 id 则更新）
    async put(store, record) {
      const list = load(store);
      if (!record.id) record.id = App.uid(store.slice(0, 3));
      record.updatedAt = App.now();
      if (!record.createdAt) record.createdAt = App.now();
      const idx = list.findIndex(function (r) { return r.id === record.id; });
      if (idx >= 0) list[idx] = record; else list.push(record);
      persist(store);
      return record;
    },

    // 删除
    async remove(store, id) {
      const list = load(store);
      const idx = list.findIndex(function (r) { return r.id === id; });
      if (idx >= 0) { list.splice(idx, 1); persist(store); return true; }
      return false;
    },

    // 清空
    async clear(store) {
      cache[store] = [];
      persist(store);
    },

    // 批量替换（用于恢复备份）
    async replaceAll(store, records) {
      cache[store] = Array.isArray(records) ? records : [];
      persist(store);
    },

    async clearAll() {
      for (const s of STORES) {
        cache[s] = [];
        persist(s);
      }
    },

    // 导出全部数据
    exportAll() {
      const dump = { version: 1, exportedAt: App.now(), data: {} };
      for (const s of STORES) dump.data[s] = load(s);
      return JSON.stringify(dump, null, 2);
    },

    // 导入备份
    async importAll(jsonText) {
      const dump = JSON.parse(jsonText);
      if (!dump || !dump.data) throw new Error('无效的备份文件');
      for (const s of STORES) {
        if (Array.isArray(dump.data[s])) {
          cache[s] = dump.data[s];
          persist(s);
        }
      }
    },

    STORES: STORES
  };

  App.DB = DB;
})();
