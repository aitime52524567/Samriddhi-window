/* ===================== 财务管理 ===================== */
(function () {
  const App = window.App;

  let filter = '';
  let typeFilter = '';

  App.registerModule({
    id: 'finance',
    title: '财务管理',
    icon: 'finance',
    render: render
  });

  App.openNewFinance = function (prefill) {
    openForm(null, prefill);
  };

  function render(el) {
    if (App.pendingSearch) { filter = App.pendingSearch; App.pendingSearch = null; }
    const q = filter.trim().toLowerCase();

    const all = App.DB.getAll('finances').filter(function (f) {
      if (typeFilter && f.type !== typeFilter) return false;
      if (!q) return true;
      return [f.customerName, f.orderNo, f.productionNo, f.category, f.method, f.remark].some(function (x) {
        return String(x || '').toLowerCase().indexOf(q) >= 0;
      });
    }).sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });

    const income = all.filter(function (f) { return f.type === '收入'; }).reduce(function (s, f) { return s + App.num(f.amount); }, 0);
    const expense = all.filter(function (f) { return f.type === '支出'; }).reduce(function (s, f) { return s + App.num(f.amount); }, 0);

    const monthIncome = App.DB.getAll('finances').filter(function (f) { return f.type === '收入' && App.isThisMonth(f.date); }).reduce(function (s, f) { return s + App.num(f.amount); }, 0);
    const monthExpense = App.DB.getAll('finances').filter(function (f) { return f.type === '支出' && App.isThisMonth(f.date); }).reduce(function (s, f) { return s + App.num(f.amount); }, 0);

    const totalOrders = App.DB.getAll('orders').reduce(function (s, o) { return s + App.orderTotal(o); }, 0);
    const totalReceived = App.DB.getAll('finances').filter(function (f) { return f.type === '收入'; }).reduce(function (s, f) { return s + App.num(f.amount); }, 0);

    const kpis =
      '<div class="kpi-grid">' +
        '<div class="kpi"><div class="kpi-label">本月收入</div><div class="kpi-value" style="color:var(--green)">' + App.fmtMoney(monthIncome) + '</div><div class="kpi-sub">回款/收款</div></div>' +
        '<div class="kpi"><div class="kpi-label">本月支出</div><div class="kpi-value" style="color:var(--red)">' + App.fmtMoney(monthExpense) + '</div><div class="kpi-sub">采购/人工等</div></div>' +
        '<div class="kpi"><div class="kpi-label">本月结余</div><div class="kpi-value">' + App.fmtMoney(monthIncome - monthExpense) + '</div><div class="kpi-sub">收入 - 支出</div></div>' +
        '<div class="kpi"><div class="kpi-label">待回款</div><div class="kpi-value" style="color:var(--amber)">' + App.fmtMoney(totalOrders - totalReceived) + '</div><div class="kpi-sub">订单总额 - 已收</div></div>' +
      '</div>';

    const rows = all.map(function (f) {
      return '<tr>' +
        '<td class="num muted">' + App.fmtDate(f.date) + '</td>' +
        '<td>' + App.badge(f.type, f.type === '收入' ? 'green' : 'red') + '</td>' +
        '<td>' + App.escapeHtml(f.category || '') + '</td>' +
        '<td>' + App.escapeHtml(f.customerName || '') +
          (f.productionNo ? ' <span class="muted small">[' + App.escapeHtml(f.productionNo) + ']</span>' : '') +
          (f.orderNo ? ' <span class="muted small">(' + App.escapeHtml(f.orderNo) + ')</span>' : '') + '</td>' +
        '<td class="muted">' + App.escapeHtml(f.method || '') + '</td>' +
        '<td class="money" style="color:' + (f.type === '收入' ? 'var(--green)' : 'var(--red)') + '">' + (f.type === '收入' ? '+' : '-') + App.fmtMoney(f.amount) + '</td>' +
        '<td class="muted small">' + App.escapeHtml(f.remark || '') + '</td>' +
        '<td>' + App.actionBtns([
          { label: '编辑', cls: 'btn-outline', data: { act: 'edit', id: f.id } },
          { label: '删除', cls: 'btn-outline', data: { act: 'del', id: f.id } }
        ]) + '</td></tr>';
    }).join('');

    el.innerHTML =
      kpis +
      '<div class="toolbar">' +
        '<input class="input" style="width:240px" placeholder="搜索客户 / 订单 / 备注" id="search" value="' + App.escapeHtml(filter) + '">' +
        '<span class="spacer"></span>' +
        '<button class="btn btn-outline" id="export">导出</button>' +
        '<button class="btn btn-outline" id="add-expense">＋ 记支出</button>' +
        '<button class="btn btn-primary" id="add-income">＋ 记收款</button>' +
      '</div>' +
      '<div class="pill-row" id="type-chips" style="margin-bottom:14px">' +
        '<label class="chip"><input type="radio" name="t" value=""' + (!typeFilter ? ' checked' : '') + '><span>全部</span></label>' +
        '<label class="chip"><input type="radio" name="t" value="收入"' + (typeFilter === '收入' ? ' checked' : '') + '><span>收入</span></label>' +
        '<label class="chip"><input type="radio" name="t" value="支出"' + (typeFilter === '支出' ? ' checked' : '') + '><span>支出</span></label>' +
      '</div>' +
      '<div class="muted small" style="margin-bottom:12px">筛选结果：收入 ' + App.fmtMoney(income) + ' · 支出 ' + App.fmtMoney(expense) + ' · 结余 ' + App.fmtMoney(income - expense) + '</div>' +
      (rows
        ? '<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr>' +
          '<th class="num">日期</th><th>类型</th><th>类别</th><th>客户/订单</th><th>方式</th><th class="num">金额</th><th>备注</th><th></th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div></div>'
        : App.empty('💳', '暂无财务记录'));

    bind(el);
  }

  function bind(el) {
    el.querySelector('#search').addEventListener('input', App.debounce(function (e) {
      filter = e.target.value; render(el);
    }, 250));
    el.querySelector('#add-income').addEventListener('click', function () { openForm(null, { type: '收入' }); });
    el.querySelector('#add-expense').addEventListener('click', function () { openForm(null, { type: '支出' }); });
    el.querySelector('#export').addEventListener('click', exportCSV);
    el.querySelectorAll('#type-chips input[name="t"]').forEach(function (r) {
      r.addEventListener('change', function () { typeFilter = r.value; render(el); });
    });
    el.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const act = btn.getAttribute('data-act');
        const id = btn.getAttribute('data-id');
        if (act === 'edit') openForm(id, null);
        else if (act === 'del') del(id, el);
      });
    });
  }

  function orderOptions(selectedId) {
    const os = App.DB.getAll('orders').slice().sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
    let html = '<option value="">— 无关联订单 —</option>';
    html += os.map(function (o) {
      return '<option value="' + o.id + '"' + (o.id === selectedId ? ' selected' : '') + '>' + App.escapeHtml(o.orderNo + ' · ' + (o.customerName || '')) + '</option>';
    }).join('');
    return html;
  }

  function openForm(id, prefill) {
    const f = id ? App.DB.get('finances', id) : null;
    const s = App.settings();
    const type = f ? f.type : (prefill && prefill.type ? prefill.type : '收入');
    const orderId = f ? f.orderId : (prefill && prefill.orderId ? prefill.orderId : null);
    const customerId = f ? f.customerId : (prefill && prefill.customerId ? prefill.customerId : null);

    const body =
      '<div class="form-grid">' +
        '<div class="field"><label>类型</label><select class="select" id="f-type">' +
          '<option value="收入"' + (type === '收入' ? ' selected' : '') + '>收入（收款）</option>' +
          '<option value="支出"' + (type === '支出' ? ' selected' : '') + '>支出（付款）</option>' +
        '</select></div>' +
        '<div class="field"><label>类别</label><select class="select" id="f-category">' + App.selectOptions(s.financeCategories, f ? f.category : (type === '收入' ? '定金' : '材料采购')) + '</select></div>' +
        '<div class="field"><label>金额 <span class="req">*</span></label><input type="number" class="input" id="f-amount" value="' + (f ? f.amount : '') + '" placeholder="0.00"></div>' +
        '<div class="field"><label>日期</label><input type="date" class="input" id="f-date" value="' + (f ? f.date : App.today()) + '"></div>' +
        '<div class="field"><label>客户</label>' + App.customerField(customerId) + '</div>' +
        '<div class="field"><label>关联订单</label><select class="select" id="f-order">' + orderOptions(orderId) + '</select></div>' +
        '<div class="field"><label>支付方式</label><select class="select" id="f-method">' + App.selectOptions(s.paymentMethods, f ? f.method : null, true) + '</select></div>' +
        '<div class="field full"><label>备注</label><input class="input" id="f-remark" value="' + App.escapeHtml(f ? f.remark : '') + '"></div>' +
      '</div>';

    App.modal({
      title: f ? '编辑记录' : (type === '收入' ? '登记收款' : '登记支出'),
      body: body,
      onOk: async function () {
        const amount = App.num(document.getElementById('f-amount').value);
        if (amount <= 0) { App.toast('请填写正确金额', 'error'); return false; }
        const typeVal = document.getElementById('f-type').value;
        const customerId = document.getElementById('f-customer').value;
        const orderId = document.getElementById('f-order').value;
        const cust = customerId ? App.DB.get('customers', customerId) : null;
        const ord = orderId ? App.DB.get('orders', orderId) : null;

        const rec = {
          id: f ? f.id : undefined,
          type: typeVal,
          category: document.getElementById('f-category').value,
          amount: amount,
          date: document.getElementById('f-date').value,
          customerId: customerId || (ord ? ord.customerId : ''),
          customerName: cust ? cust.name : (ord ? ord.customerName : ''),
          orderId: orderId,
          orderNo: ord ? ord.orderNo : '',
          productionId: f ? f.productionId : (prefill && prefill.productionId ? prefill.productionId : ''),
          productionNo: f ? f.productionNo : (prefill && prefill.productionNo ? prefill.productionNo : ''),
          method: document.getElementById('f-method').value,
          remark: document.getElementById('f-remark').value.trim(),
          createdAt: f ? f.createdAt : App.now()
        };
        await App.DB.put('finances', rec);
        // 若订单已全额收款，可自动标记
        if (rec.type === '收入' && ord) {
          const received = App.orderReceived(ord.id);
          if (received >= App.orderTotal(ord) - 0.001 && App.num(App.orderTotal(ord)) > 0 && ord.status !== '已完成') {
            ord.status = '待验收';
            await App.DB.put('orders', ord);
            App.toast('订单已收清，状态更新为「待验收」', 'success');
            render(document.getElementById('content'));
            return;
          }
        }
        App.toast(f ? '已保存' : '已登记', 'success');
        render(document.getElementById('content'));
      },
      onMount: function (mask) {
        // 选择订单时联动客户
        mask.querySelector('#f-order').addEventListener('change', function (e) {
          const o = e.target.value ? App.DB.get('orders', e.target.value) : null;
          if (o && o.customerId) {
            const sel = mask.querySelector('#f-customer');
            sel.value = o.customerId;
          }
        });
      }
    });
  }

  function del(id, el) {
    App.confirm('确定删除这条财务记录吗？', async function () {
      await App.DB.remove('finances', id);
      App.toast('已删除', 'success');
      render(el);
    }, '删除');
  }

  function exportCSV() {
    const rows = [['日期', '类型', '类别', '客户', '订单号', '支付方式', '金额', '备注']];
    App.DB.getAll('finances').forEach(function (f) {
      rows.push([f.date, f.type, f.category, f.customerName, f.orderNo, f.method, f.amount, f.remark]);
    });
    App.download('财务记录-' + App.today() + '.csv', App.toCSV(rows), 'text/csv;charset=utf-8');
    App.toast('已导出 CSV', 'success');
  }
})();
