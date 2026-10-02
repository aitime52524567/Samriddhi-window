/* ===================== 生产管理 ===================== */
(function () {
  const App = window.App;

  let filter = '';
  let statusFilter = '';
  let tab = 'productions'; // productions | installations
  const STATUSES = ['待生产', '生产中', '已完成', '已交付'];

  App.registerModule({
    id: 'productions',
    title: '生产安装',
    icon: 'production',
    render: render
  });

  App.openNewProduction = function (order) {
    openForm(null, null, order);
  };

  /* ---------- 标签页主控 ---------- */
  function render(el) {
    if (App.pendingTab) { tab = App.pendingTab; App.pendingTab = null; }
    el.innerHTML =
      '<div class="tabs">' +
        '<button class="tab' + (tab === 'productions' ? ' active' : '') + '" data-tab="productions">🏭 生产管理</button>' +
        '<button class="tab' + (tab === 'installations' ? ' active' : '') + '" data-tab="installations">🔧 安装管理</button>' +
      '</div>' +
      '<div id="tab-content"></div>';
    const box = el.querySelector('#tab-content');
    if (tab === 'productions') renderProductions(box); else App.renderInstallations(box);
    el.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        tab = t.getAttribute('data-tab'); render(el);
      });
    });
  }

  /* ===================== 生产管理 ===================== */
  function renderProductions(el) {
    if (App.pendingSearch) { filter = App.pendingSearch; App.pendingSearch = null; }
    const q = filter.trim().toLowerCase();

    const list = App.DB.getAll('productions').filter(function (p) {
      if (statusFilter && p.status !== statusFilter) return false;
      if (!q) return true;
      return [p.prodNo, p.orderNo, p.customerName, p.workshop, p.factory].some(function (f) {
        return String(f || '').toLowerCase().indexOf(q) >= 0;
      });
    }).sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });

    const rows = list.map(function (p) {
      const paid = App.productionPaid(p.id);
      const payable = App.num(p.payAmount);
      const unpaid = payable - paid;
      return '<tr>' +
        '<td><a class="link" data-act="detail" data-id="' + p.id + '">' + App.escapeHtml(p.prodNo) + '</a></td>' +
        '<td class="muted">' + App.escapeHtml(p.orderNo || '') + '</td>' +
        '<td>' + App.escapeHtml(p.customerName || '') + '</td>' +
        '<td>' + App.badge(p.status) + '</td>' +
        '<td class="muted">' + App.escapeHtml(p.factory || p.workshop || '') + '</td>' +
        '<td class="money">' + App.fmtMoney(payable) + '</td>' +
        '<td class="money">' + App.fmtMoney(paid) + '</td>' +
        '<td class="money" style="color:' + (unpaid > 0.001 ? 'var(--amber)' : 'var(--green)') + '">' + App.fmtMoney(unpaid) + '</td>' +
        '<td>' + App.actionBtns([
          { label: '付款', cls: 'btn-outline', data: { act: 'pay', id: p.id } },
          { label: '编辑', cls: 'btn-outline', data: { act: 'edit', id: p.id } },
          { label: '删除', cls: 'btn-outline', data: { act: 'del', id: p.id } }
        ]) + '</td></tr>';
    }).join('');

    const chips = STATUSES.map(function (s) {
      return '<label class="chip"><input type="radio" name="st" value="' + s + '"' + (statusFilter === s ? ' checked' : '') + '><span>' + s + '</span></label>';
    }).join('');

    el.innerHTML =
      '<div class="toolbar">' +
        '<input class="input" style="width:240px" placeholder="搜索生产单 / 订单 / 客户" id="search" value="' + App.escapeHtml(filter) + '">' +
        '<span class="spacer"></span>' +
        '<button class="btn btn-primary" id="add">＋ 新建生产单</button>' +
      '</div>' +
      '<div class="pill-row" id="status-chips" style="margin-bottom:14px">' +
        '<label class="chip"><input type="radio" name="st" value=""' + (!statusFilter ? ' checked' : '') + '><span>全部</span></label>' + chips +
      '</div>' +
      (rows
        ? '<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr>' +
          '<th>生产单号</th><th>关联订单</th><th>客户</th><th>状态</th><th>厂家</th><th class="num">加工费</th><th class="num">已付</th><th class="num">未付</th><th></th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div></div>'
        : App.empty('🏭', '还没有生产单', '点击「新建生产单」安排生产'));

    bind(el);
  }

  function bind(el) {
    el.querySelector('#search').addEventListener('input', App.debounce(function (e) {
      filter = e.target.value; renderProductions(el);
    }, 250));
    el.querySelector('#add').addEventListener('click', function () { openForm(el, null, null); });
    el.querySelectorAll('#status-chips input[name="st"]').forEach(function (r) {
      r.addEventListener('change', function () { statusFilter = r.value; renderProductions(el); });
    });
    el.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const act = btn.getAttribute('data-act');
        const id = btn.getAttribute('data-id');
        if (act === 'edit') openForm(el, id, null);
        else if (act === 'del') del(id, el);
        else if (act === 'detail') detail(id, el);
        else if (act === 'pay') openPayForm(id, function () { renderProductions(el); });
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
    const p = id ? App.DB.get('productions', id) : null;
    const body =
      '<div class="form-grid">' +
        '<div class="field"><label>生产单号</label><input class="input" value="' + App.escapeHtml(p ? p.prodNo : '(保存时自动生成)') + '" disabled></div>' +
        '<div class="field"><label>状态</label><select class="select" id="f-status">' + App.selectOptions(STATUSES, p ? p.status : '待生产') + '</select></div>' +
        '<div class="field full"><label>关联订单 <span class="req">*</span></label><select class="select" id="f-order">' + orderOptions(p ? p.orderId : (order ? order.id : null)) + '</select></div>' +
        '<div class="field"><label>生产车间</label><input class="input" id="f-workshop" value="' + App.escapeHtml(p ? p.workshop : '') + '"></div>' +
        '<div class="field"><label>厂家 / 加工厂</label><input class="input" id="f-factory" value="' + App.escapeHtml(p ? p.factory : '') + '"></div>' +
        '<div class="field"><label>加工费（元）</label><input type="number" class="input" id="f-pay" value="' + (p && p.payAmount ? p.payAmount : '') + '" placeholder="0.00"></div>' +
        '<div class="field"><label>负责人</label><input class="input" id="f-owner" value="' + App.escapeHtml(p ? p.owner : '') + '"></div>' +
        '<div class="field"><label>开始日期</label><input type="date" class="input" id="f-start" value="' + (p ? p.startDate : App.today()) + '"></div>' +
        '<div class="field"><label>计划完工</label><input type="date" class="input" id="f-end" value="' + (p ? p.endDate : '') + '"></div>' +
        '<div class="field full"><label>备注</label><textarea class="textarea" id="f-remark">' + App.escapeHtml(p ? p.remark : '') + '</textarea></div>' +
      '</div>';

    App.modal({
      title: p ? '编辑生产单' : '新建生产单',
      body: body,
      onOk: async function () {
        const orderId = document.getElementById('f-order').value;
        if (!orderId) { App.toast('请选择关联订单', 'error'); return false; }
        const o = App.DB.get('orders', orderId);
        const rec = {
          id: p ? p.id : undefined,
          prodNo: p ? p.prodNo : await App.genNo('SC'),
          orderId: orderId,
          orderNo: o ? o.orderNo : '',
          customerName: o ? o.customerName : '',
          status: document.getElementById('f-status').value,
          workshop: document.getElementById('f-workshop').value.trim(),
          factory: document.getElementById('f-factory').value.trim(),
          payAmount: App.num(document.getElementById('f-pay').value),
          owner: document.getElementById('f-owner').value.trim(),
          startDate: document.getElementById('f-start').value,
          endDate: document.getElementById('f-end').value,
          remark: document.getElementById('f-remark').value.trim(),
          createdAt: p ? p.createdAt : App.now()
        };
        await App.DB.put('productions', rec);
        // 联动订单状态
        if (o) {
          if (rec.status === '生产中') o.status = '生产中';
          else if (rec.status === '已完成' || rec.status === '已交付') o.status = '待安装';
          await App.DB.put('orders', o);
        }
        App.toast(p ? '已保存' : '生产单已创建', 'success');
        if (el) renderProductions(el);
        else { App.pendingTab = 'productions'; App.go('productions'); }
      }
    });
  }

  function del(id, el) {
    App.confirm('确定删除这个生产单吗？', async function () {
      await App.DB.remove('productions', id);
      App.toast('已删除', 'success');
      renderProductions(el);
    }, '删除');
  }

  function detail(id, el) {
    const p = App.DB.get('productions', id);
    if (!p) return;
    const paid = App.productionPaid(p.id);
    const payable = App.num(p.payAmount);
    const unpaid = payable - paid;
    const payments = App.DB.getAll('finances').filter(function (f) { return f.productionId === p.id && f.type === '支出'; })
      .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });

    const payRows = payments.map(function (f) {
      return '<tr>' +
        '<td class="num muted">' + App.fmtDate(f.date) + '</td>' +
        '<td>' + App.escapeHtml(f.method || '') + '</td>' +
        '<td class="money" style="color:var(--red)">-' + App.fmtMoney(f.amount) + '</td>' +
        '<td class="muted small">' + App.escapeHtml(f.remark || '') + '</td>' +
        '</tr>';
    }).join('');

    App.modal({
      title: '生产单详情 · ' + p.prodNo,
      footer: false,
      body:
        '<div class="grid-2">' +
          '<div class="stat-row"><span class="k">生产单号</span><span class="v">' + App.escapeHtml(p.prodNo) + '</span></div>' +
          '<div class="stat-row"><span class="k">状态</span><span class="v">' + App.badge(p.status) + '</span></div>' +
          '<div class="stat-row"><span class="k">关联订单</span><span class="v">' + App.escapeHtml(p.orderNo || '') + '</span></div>' +
          '<div class="stat-row"><span class="k">客户</span><span class="v">' + App.escapeHtml(p.customerName || '') + '</span></div>' +
          '<div class="stat-row"><span class="k">车间</span><span class="v">' + App.escapeHtml(p.workshop || '') + '</span></div>' +
          '<div class="stat-row"><span class="k">厂家</span><span class="v">' + App.escapeHtml(p.factory || '') + '</span></div>' +
          '<div class="stat-row"><span class="k">负责人</span><span class="v">' + App.escapeHtml(p.owner || '') + '</span></div>' +
          '<div class="stat-row"><span class="k">开始 / 完工</span><span class="v">' + App.fmtDate(p.startDate) + ' ~ ' + App.fmtDate(p.endDate) + '</span></div>' +
        '</div>' +
        '<div class="section-title" style="display:flex;align-items:center;justify-content:space-between">' +
          '<span>付款给厂家</span>' +
          '<button class="btn btn-sm btn-primary" id="pay-btn">＋ 登记付款</button>' +
        '</div>' +
        '<div class="grid-3">' +
          '<div class="stat-row"><span class="k">加工费</span><span class="v">' + App.fmtMoney(payable) + '</span></div>' +
          '<div class="stat-row"><span class="k">已付</span><span class="v">' + App.fmtMoney(paid) + '</span></div>' +
          '<div class="stat-row"><span class="k">未付</span><span class="v" style="color:' + (unpaid > 0.001 ? 'var(--amber)' : 'var(--green)') + '">' + App.fmtMoney(unpaid) + '</span></div>' +
        '</div>' +
        (payments.length
          ? '<div class="card" style="margin-top:10px"><div class="table-wrap"><table class="tbl"><thead><tr>' +
            '<th class="num">日期</th><th>方式</th><th class="num">金额</th><th>备注</th>' +
            '</tr></thead><tbody>' + payRows + '</tbody></table></div></div>'
          : '<div class="muted small" style="margin-top:8px">暂无付款记录，点击「登记付款」记录付给厂家的款子</div>') +
        (p.remark ? '<div class="section-title">备注</div><div class="muted">' + App.escapeHtml(p.remark) + '</div>' : ''),
      onMount: function (mask) {
        mask.querySelector('#pay-btn').addEventListener('click', function () {
          mask.remove();
          openPayForm(p.id, function () { renderProductions(el); });
        });
      }
    });
  }

  function openPayForm(id, onDone) {
    const p = App.DB.get('productions', id);
    if (!p) return;
    const s = App.settings();
    const payable = App.num(p.payAmount);
    const paid = App.productionPaid(p.id);
    const unpaid = payable - paid;

    App.modal({
      title: '登记付款 · ' + p.prodNo,
      body:
        '<div class="muted small" style="margin-bottom:12px">厂家：' + App.escapeHtml(p.factory || p.workshop || '—') +
        '　加工费 ' + App.fmtMoney(payable) + ' · 已付 ' + App.fmtMoney(paid) + ' · 未付 ' + App.fmtMoney(unpaid) + '</div>' +
        '<div class="form-grid">' +
          '<div class="field"><label>金额 <span class="req">*</span></label><input type="number" class="input" id="p-amount" placeholder="0.00" value="' + (unpaid > 0.001 ? (Math.round(unpaid * 100) / 100) : '') + '"></div>' +
          '<div class="field"><label>日期</label><input type="date" class="input" id="p-date" value="' + App.today() + '"></div>' +
          '<div class="field"><label>类别</label><select class="select" id="p-category">' + App.selectOptions(s.financeCategories, '材料采购') + '</select></div>' +
          '<div class="field"><label>支付方式</label><select class="select" id="p-method">' + App.selectOptions(s.paymentMethods, null, true) + '</select></div>' +
          '<div class="field full"><label>备注</label><input class="input" id="p-remark" placeholder="如：付加工费定金 / 尾款"></div>' +
        '</div>',
      okText: '确认付款',
      onOk: async function () {
        const amount = App.num(document.getElementById('p-amount').value);
        if (amount <= 0) { App.toast('请填写正确的付款金额', 'error'); return false; }
        const remark = document.getElementById('p-remark').value.trim();
        await App.DB.put('finances', {
          id: undefined,
          type: '支出',
          category: document.getElementById('p-category').value,
          amount: amount,
          date: document.getElementById('p-date').value,
          customerId: p.orderId ? (App.DB.get('orders', p.orderId) || {}).customerId || '' : '',
          customerName: p.customerName || '',
          orderId: p.orderId || '',
          orderNo: p.orderNo || '',
          productionId: p.id,
          productionNo: p.prodNo,
          method: document.getElementById('p-method').value,
          remark: '付厂家 · ' + (p.factory || p.workshop || '') + (remark ? ' · ' + remark : ''),
          createdAt: App.now()
        });
        App.toast('已付款并记入财务支出', 'success');
        if (onDone) onDone();
      }
    });
  }
})();
