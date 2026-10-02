/* ===================== 安装管理 ===================== */
(function () {
  const App = window.App;

  let filter = '';
  let statusFilter = '';
  const STATUSES = ['待安装', '已排单', '安装中', '已完成', '已验收'];

  // 由「生产安装」模块调用，作为其「安装管理」标签页
  App.renderInstallations = render;

  App.openNewInstall = function (order) {
    openForm(null, null, order);
  };

  function render(el) {
    if (App.pendingSearch) { filter = App.pendingSearch; App.pendingSearch = null; }
    const q = filter.trim().toLowerCase();

    const list = App.DB.getAll('installations').filter(function (i) {
      if (statusFilter && i.status !== statusFilter) return false;
      if (!q) return true;
      return [i.installNo, i.orderNo, i.customerName, i.installer, i.address].some(function (f) {
        return String(f || '').toLowerCase().indexOf(q) >= 0;
      });
    }).sort(function (a, b) { return (b.installDate || '').localeCompare(a.installDate || ''); });

    const rows = list.map(function (i) {
      return '<tr>' +
        '<td><a class="link" data-act="detail" data-id="' + i.id + '">' + App.escapeHtml(i.installNo) + '</a></td>' +
        '<td class="muted">' + App.escapeHtml(i.orderNo || '') + '</td>' +
        '<td>' + App.escapeHtml(i.customerName || '') + '</td>' +
        '<td>' + App.badge(i.status) + '</td>' +
        '<td class="num muted">' + App.fmtDate(i.installDate) + '</td>' +
        '<td class="muted">' + App.escapeHtml(i.installer || '') + '</td>' +
        '<td class="muted small">' + App.escapeHtml(i.address || '') + '</td>' +
        '<td>' + App.actionBtns([
          { label: '编辑', cls: 'btn-outline', data: { act: 'edit', id: i.id } },
          { label: '删除', cls: 'btn-outline', data: { act: 'del', id: i.id } }
        ]) + '</td></tr>';
    }).join('');

    const chips = STATUSES.map(function (s) {
      return '<label class="chip"><input type="radio" name="st" value="' + s + '"' + (statusFilter === s ? ' checked' : '') + '><span>' + s + '</span></label>';
    }).join('');

    el.innerHTML =
      '<div class="toolbar">' +
        '<input class="input" style="width:240px" placeholder="搜索安装单 / 订单 / 客户" id="search" value="' + App.escapeHtml(filter) + '">' +
        '<span class="spacer"></span>' +
        '<button class="btn btn-primary" id="add">＋ 新建安装单</button>' +
      '</div>' +
      '<div class="pill-row" id="status-chips" style="margin-bottom:14px">' +
        '<label class="chip"><input type="radio" name="st" value=""' + (!statusFilter ? ' checked' : '') + '><span>全部</span></label>' + chips +
      '</div>' +
      (rows
        ? '<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr>' +
          '<th>安装单号</th><th>关联订单</th><th>客户</th><th>状态</th><th class="num">安装日期</th><th>安装师傅</th><th>地址</th><th></th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div></div>'
        : App.empty('🔧', '还没有安装单', '点击「新建安装单」派工安装'));

    bind(el);
  }

  function bind(el) {
    el.querySelector('#search').addEventListener('input', App.debounce(function (e) {
      filter = e.target.value; render(el);
    }, 250));
    el.querySelector('#add').addEventListener('click', function () { openForm(el, null, null); });
    el.querySelectorAll('#status-chips input[name="st"]').forEach(function (r) {
      r.addEventListener('change', function () { statusFilter = r.value; render(el); });
    });
    el.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const act = btn.getAttribute('data-act');
        const id = btn.getAttribute('data-id');
        if (act === 'edit') openForm(el, id, null);
        else if (act === 'del') del(id, el);
        else if (act === 'detail') detail(id);
      });
    });
  }

  function orderOptions(selectedId) {
    const os = App.DB.getAll('orders').slice().sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
    let html = '<option value="">— 选择订单 —</option>';
    html += os.map(function (o) {
      return '<option value="' + o.id + '"' + (o.id === selectedId ? ' selected' : '') + '>' + App.escapeHtml(o.orderNo + ' · ' + (o.customerName || '')) + '</option>';
    }).join('');
    return html;
  }

  function openForm(el, id, order) {
    const i = id ? App.DB.get('installations', id) : null;
    const body =
      '<div class="form-grid">' +
        '<div class="field"><label>安装单号</label><input class="input" value="' + App.escapeHtml(i ? i.installNo : '(保存时自动生成)') + '" disabled></div>' +
        '<div class="field"><label>状态</label><select class="select" id="f-status">' + App.selectOptions(STATUSES, i ? i.status : '待安装') + '</select></div>' +
        '<div class="field full"><label>关联订单 <span class="req">*</span></label><select class="select" id="f-order">' + orderOptions(i ? i.orderId : (order ? order.id : null)) + '</select></div>' +
        '<div class="field"><label>安装日期</label><input type="date" class="input" id="f-date" value="' + (i ? i.installDate : App.today()) + '"></div>' +
        '<div class="field"><label>安装师傅</label><input class="input" id="f-installer" value="' + App.escapeHtml(i ? i.installer : '') + '"></div>' +
        '<div class="field full"><label>安装地址</label><input class="input" id="f-address" value="' + App.escapeHtml(i ? i.address : (order ? order.address : '')) + '"></div>' +
        '<div class="field full"><label>备注</label><textarea class="textarea" id="f-remark">' + App.escapeHtml(i ? i.remark : '') + '</textarea></div>' +
      '</div>';

    App.modal({
      title: i ? '编辑安装单' : '新建安装单',
      body: body,
      onOk: async function () {
        const orderId = document.getElementById('f-order').value;
        if (!orderId) { App.toast('请选择关联订单', 'error'); return false; }
        const o = App.DB.get('orders', orderId);
        const rec = {
          id: i ? i.id : undefined,
          installNo: i ? i.installNo : await App.genNo('AZ'),
          orderId: orderId,
          orderNo: o ? o.orderNo : '',
          customerName: o ? o.customerName : '',
          status: document.getElementById('f-status').value,
          installDate: document.getElementById('f-date').value,
          installer: document.getElementById('f-installer').value.trim(),
          address: document.getElementById('f-address').value.trim(),
          remark: document.getElementById('f-remark').value.trim(),
          createdAt: i ? i.createdAt : App.now()
        };
        await App.DB.put('installations', rec);
        if (o) {
          if (rec.status === '已排单' || rec.status === '安装中') o.status = '安装中';
          else if (rec.status === '已完成') o.status = '待验收';
          else if (rec.status === '已验收') o.status = '已完成';
          await App.DB.put('orders', o);
        }
        App.toast(i ? '已保存' : '安装单已创建', 'success');
        if (el) render(el);
        else { App.pendingTab = 'installations'; App.go('productions'); }
      }
    });
  }

  function del(id, el) {
    App.confirm('确定删除这个安装单吗？', async function () {
      await App.DB.remove('installations', id);
      App.toast('已删除', 'success');
      render(el);
    }, '删除');
  }

  function detail(id) {
    const i = App.DB.get('installations', id);
    if (!i) return;
    App.modal({
      title: '安装单详情 · ' + i.installNo,
      footer: false,
      body:
        '<div class="grid-2">' +
          '<div class="stat-row"><span class="k">安装单号</span><span class="v">' + App.escapeHtml(i.installNo) + '</span></div>' +
          '<div class="stat-row"><span class="k">状态</span><span class="v">' + App.badge(i.status) + '</span></div>' +
          '<div class="stat-row"><span class="k">关联订单</span><span class="v">' + App.escapeHtml(i.orderNo || '') + '</span></div>' +
          '<div class="stat-row"><span class="k">客户</span><span class="v">' + App.escapeHtml(i.customerName || '') + '</span></div>' +
          '<div class="stat-row"><span class="k">安装日期</span><span class="v">' + App.fmtDate(i.installDate) + '</span></div>' +
          '<div class="stat-row"><span class="k">安装师傅</span><span class="v">' + App.escapeHtml(i.installer || '') + '</span></div>' +
          '<div class="stat-row"><span class="k">地址</span><span class="v">' + App.escapeHtml(i.address || '') + '</span></div>' +
        '</div>' +
        (i.remark ? '<div class="section-title">备注</div><div class="muted">' + App.escapeHtml(i.remark) + '</div>' : '')
    });
  }
})();
