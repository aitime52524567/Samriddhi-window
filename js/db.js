/* ===================== 数据层（本地缓存 + 云同步） ===================== */
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

  // CloudBase 环境 ID（多人共享数据存在这里）
  const ENV_ID = 'samriddhi-d9gocmm94731104e7';
  // Publishable Key（控制台「API Key 配置」生成，用于无需登录的公开访问）
  const PUBLISHABLE_KEY = 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjlkMWRjMzFlLWI0ZDAtNDQ4Yi1hNzZmLWIwY2M2M2Q4MTQ5OCJ9.eyJpc3MiOiJodHRwczovL3NhbXJpZGRoaS1kOWdvY21tOTQ3MzExMDRlNy5hcC1zaGFuZ2hhaS50Y2ItYXBpLnRlbmNlbnRjbG91ZGFwaS5jb20iLCJzdWIiOiJhbm9uIiwiYXVkIjoic2FtcmlkZGhpLWQ5Z29jbW05NDczMTEwNGU3IiwiZXhwIjo0MDk0NjMwODQwLCJpYXQiOjE3OTA5NDc2NDAsIm5vbmNlIjoib29wOEpRMWJTMmF6X2p5YlgtamEtUSIsImF0X2hhc2giOiJvb3A4SlExYlMyYXpfanliWC1qYS1RIiwibmFtZSI6IkFub255bW91cyIsInNjb3BlIjoiYW5vbnltb3VzIiwicHJvamVjdF9pZCI6InNhbXJpZGRoaS1kOWdvY21tOTQ3MzExMDRlNyIsIm1ldGEiOnsicGxhdGZvcm0iOiJQdWJsaXNoYWJsZUtleSJ9LCJ1c2VyX3R5cGUiOiIiLCJjbGllbnRfdHlwZSI6ImNsaWVudF91c2VyIiwiaXNfc3lzdGVtX2FkbWluIjpmYWxzZX0.jY6rU3LGKDQ0f-jR7x5lfE_gUQerbhUz_v9el2-qCYZUlts_cpYE2r-FI_SwfCpzHXz9RqajRMQpab-0KvIcMdq9WsDqymURVR_X1_YR8xOeAEuwhivFvQrJerNUvVyggKs80Az9S70qNx1ct3kYUJzUr010r7CKANLxyMHdxbDB01OlFI9Cy8mCFcocx8eUYX6nhXoNVNcu-nI5qjgcSIELLnrscOUGnxiyvde7EAP1kli2MCTYWMYDf8fmvHCk_21uxodFw2U7E64LQddYGW9uBDrYqzjNFu8VVtAwfCQxAuGD5H9m0ZzifI5pCoOB3042V-8Ncyj5y0YBbHhcig';

  const cache = {};

  // 云端状态
  let cloudApp = null;   // cloudbase app
  let cdb = null;        // cloudbase database
  let cloudReady = false;

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

  /* ---------- 云端同步 ---------- */
  async function initCloud() {
    if (!window.cloudbase) return false;
    if (!PUBLISHABLE_KEY || PUBLISHABLE_KEY.indexOf('REPLACE') === 0) return false;
    try {
      cloudApp = window.cloudbase.init({ env: ENV_ID, accessKey: PUBLISHABLE_KEY });
      cdb = cloudApp.database();
      cloudReady = true;
      return true;
    } catch (e) {
      console.error('[CloudBase] 初始化失败：', e);
      return false;
    }
  }

  // 从云端拉取全量数据到本地缓存
  async function pullAll() {
    if (!cdb) return false;
    for (const store of STORES) {
      try {
        const res = await cdb.collection(store).limit(1000).get();
        const list = (res && res.data ? res.data : []).map(function (d) {
          const rec = Object.assign({}, d);
          if (!rec.id && d._id) rec.id = d._id;
          delete rec._id;
          return rec;
        });
        cache[store] = list;
        persist(store);
      } catch (e) {
        // 集合不存在或权限不足，忽略，继续其他集合
      }
    }
    return true;
  }

  async function pushRecord(store, record) {
    if (!cdb) return;
    try {
      await cdb.collection(store).doc(record.id).set(record);
    } catch (e) {
      console.error('[CloudBase] 推送失败 ' + store, e);
    }
  }

  async function pushRemove(store, id) {
    if (!cdb) return;
    try {
      await cdb.collection(store).doc(id).remove();
    } catch (e) {
      console.error('[CloudBase] 删除失败 ' + store, e);
    }
  }

  const DB = {
    // 读取整个 store（数组，同步读本地缓存）
    getAll(store) {
      return load(store).slice();
    },

    // 按 id 读取
    get(store, id) {
      return load(store).find(function (r) { return r.id === id; }) || null;
    },

    // 插入或更新（本地 + 云端）
    async put(store, record) {
      const list = load(store);
      if (!record.id) record.id = App.uid(store.slice(0, 3));
      record.updatedAt = App.now();
      if (!record.createdAt) record.createdAt = App.now();
      const idx = list.findIndex(function (r) { return r.id === record.id; });
      if (idx >= 0) list[idx] = record; else list.push(record);
      persist(store);
      await pushRecord(store, record);
      return record;
    },

    // 删除
    async remove(store, id) {
      const list = load(store);
      const idx = list.findIndex(function (r) { return r.id === id; });
      if (idx >= 0) {
        list.splice(idx, 1);
        persist(store);
        await pushRemove(store, id);
        return true;
      }
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

    // 云端接口
    initCloud: initCloud,
    pullAll: pullAll,
    isCloudReady: function () { return cloudReady; },

    STORES: STORES
  };

  App.DB = DB;
})();
