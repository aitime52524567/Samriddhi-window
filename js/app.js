/* ===================== 应用入口 / 路由 ===================== */
(function () {
  const App = window.App;
  const nav = document.getElementById('nav');
  const content = document.getElementById('content');
  const titleEl = document.getElementById('page-title');
  const searchBox = document.getElementById('global-search');

  const modules = App.moduleList;
  let current = null;

  App.go = function (moduleId, pendingSearch) {
    if (pendingSearch) App.pendingSearch = pendingSearch;
    location.hash = '#/' + moduleId;
  };

  function buildNav() {
    nav.innerHTML = modules.map(function (m) {
      return '<a class="nav-item" href="#/' + m.id + '" data-id="' + m.id + '">' +
        App.icon(m.icon) + '<span>' + App.escapeHtml(m.title) + '</span></a>';
    }).join('');
  }

  function route() {
    let hash = (location.hash || '').replace('#/', '') || modules[0].id;
    if (!modules.find(function (m) { return m.id === hash; })) hash = modules[0].id;
    const mod = modules.find(function (m) { return m.id === hash; });
    current = mod;
    titleEl.textContent = mod.title;
    document.querySelectorAll('.nav-item').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-id') === mod.id);
    });
    content.innerHTML = '';
    try {
      mod.render(content);
    } catch (e) {
      console.error(e);
      content.innerHTML = App.empty('⚠️', '模块加载出错', String(e.message || e));
    }
    App.pendingSearch = null;
    searchBox.value = '';
  }

  window.addEventListener('hashchange', route);

  /* ---------- 全局搜索 ---------- */
  function globalSearch(q) {
    q = (q || '').trim().toLowerCase();
    if (!q) { route(); return; }
    titleEl.textContent = '搜索结果：' + q;

    const customers = App.DB.getAll('customers');
    const orders = App.DB.getAll('orders');
    const measurements = App.DB.getAll('measurements');
    const finances = App.DB.getAll('finances');

    const hit = function (fields) {
      return fields.some(function (f) { return String(f || '').toLowerCase().indexOf(q) >= 0; });
    };

    const sections = [];

    const cs = customers.filter(function (c) { return hit([c.name, c.phone, c.tel2, c.address]); });
    if (cs.length) {
      sections.push('<div class="section-title">客户（' + cs.length + '）</div><div class="card"><div class="table-wrap"><table class="tbl"><tbody>' +
        cs.slice(0, 20).map(function (c) {
          return '<tr><td><a class="link" data-go="customers" data-s="' + App.escapeHtml(c.name) + '">' + App.escapeHtml(c.name) + '</a></td>' +
            '<td class="muted">' + App.escapeHtml(c.phone || '') + '</td><td class="muted">' + App.escapeHtml(c.address || '') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>');
    }

    const os = orders.filter(function (o) { return hit([o.orderNo, o.customerName, o.address, o.remark]); });
    if (os.length) {
      sections.push('<div class="section-title">订单（' + os.length + '）</div><div class="card"><div class="table-wrap"><table class="tbl"><tbody>' +
        os.slice(0, 20).map(function (o) {
          return '<tr><td><a class="link" data-go="orders" data-s="' + App.escapeHtml(o.orderNo) + '">' + App.escapeHtml(o.orderNo) + '</a></td>' +
            '<td>' + App.escapeHtml(o.customerName || '') + '</td><td>' + App.badge(o.status) + '</td>' +
            '<td class="money">' + App.fmtMoney(orderTotal(o)) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>');
    }

    const ms = measurements.filter(function (m) { return hit([m.customerName, m.measurer, m.address]); });
    if (ms.length) {
      sections.push('<div class="section-title">量尺记录（' + ms.length + '）</div><div class="card"><div class="table-wrap"><table class="tbl"><tbody>' +
        ms.slice(0, 20).map(function (m) {
          return '<tr><td><a class="link" data-go="projects" data-tab="measurements" data-s="' + App.escapeHtml(m.customerName) + '">' + App.escapeHtml(m.customerName || '') + '</a></td>' +
            '<td class="muted">' + App.fmtDate(m.measureDate) + '</td><td class="muted">' + App.escapeHtml(m.measurer || '') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>');
    }

    const fs = finances.filter(function (f) { return hit([f.customerName, f.orderNo, f.productionNo, f.category, f.remark]); });
    if (fs.length) {
      sections.push('<div class="section-title">财务记录（' + fs.length + '）</div><div class="card"><div class="table-wrap"><table class="tbl"><tbody>' +
        fs.slice(0, 20).map(function (f) {
          return '<tr><td><a class="link" data-go="finance" data-s="' + App.escapeHtml(f.customerName || f.orderNo) + '">' + App.escapeHtml(f.customerName || f.orderNo || '') + '</a></td>' +
            '<td>' + App.badge(f.type === '收入' ? '收入' : '支出', f.type === '收入' ? 'green' : 'red') + '</td>' +
            '<td class="money">' + App.fmtMoney(f.amount) + '</td><td class="muted">' + App.fmtDate(f.date) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>');
    }

    if (!sections.length) {
      content.innerHTML = App.empty('🔍', '未找到相关内容', '换个关键词试试');
      return;
    }
    content.innerHTML = '<div style="max-width:900px">' + sections.join('') + '</div>';
  }

  function orderTotal(o) {
    if (o.totalAmount) return o.totalAmount;
    return (o.items || []).reduce(function (s, it) { return s + App.num(it.amount); }, 0);
  }

  content.addEventListener('click', function (e) {
    const a = e.target.closest && e.target.closest('[data-go]');
    if (a) {
      if (a.hasAttribute('data-tab')) App.pendingTab = a.getAttribute('data-tab');
      App.go(a.getAttribute('data-go'), a.getAttribute('data-s'));
    }
  });

  searchBox.addEventListener('input', App.debounce(function () {
    globalSearch(searchBox.value);
  }, 250));

  /* ---------- 数据备份 ---------- */
  document.getElementById('btn-backup').addEventListener('click', function () {
    App.modal({
      title: '数据备份 / 恢复',
      size: 'sm',
      footer: false,
      body:
        '<div style="display:flex;flex-direction:column;gap:12px">' +
          '<p class="muted small">数据保存在当前浏览器的本地存储中。建议定期备份，换电脑或重装浏览器前务必先导出。</p>' +
          '<button class="btn btn-primary btn-block" id="bk-export">⬇ 导出备份文件（JSON）</button>' +
          '<button class="btn btn-outline btn-block" id="bk-import">⬆ 从备份文件恢复</button>' +
          '<input type="file" id="bk-file" accept=".json" style="display:none">' +
        '</div>',
      onMount: function (mask) {
        mask.querySelector('#bk-export').addEventListener('click', function () {
          App.download('昇丽迪门窗-备份-' + App.today() + '.json', App.DB.exportAll());
          App.toast('备份已导出', 'success');
        });
        mask.querySelector('#bk-import').addEventListener('click', function () {
          mask.querySelector('#bk-file').click();
        });
        mask.querySelector('#bk-file').addEventListener('change', async function (e) {
          const file = e.target.files[0];
          if (!file) return;
          const text = await App.readFileAsText(file);
          App.confirm('恢复将覆盖当前全部数据，是否继续？', async function () {
            try {
              await App.DB.importAll(text);
              App.toast('数据恢复成功', 'success');
              location.reload();
            } catch (err) {
              App.toast('恢复失败：' + err.message, 'error');
            }
          }, '确认恢复');
        });
      }
    });
  });

  /* ---------- 启动 ---------- */
  buildNav();
  route();
})();
