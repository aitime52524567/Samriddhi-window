/* ===================== 订单管理（报价） ===================== */
(function () {
  const App = window.App;

  let filter = '';
  let statusFilter = '';

  App.registerModule({
    id: 'orders',
    title: '订单管理',
    icon: 'orders',
    render: render
  });

  // 供其他模块调用：新建订单（可带量尺预填）
  App.openNewOrder = function (prefill) {
    openForm(null, prefill);
  };

  function render(el) {
    if (App.pendingSearch) { filter = App.pendingSearch; App.pendingSearch = null; }
    const q = filter.trim().toLowerCase();
    const st = App.settings().orderStatuses;

    const orders = App.DB.getAll('orders').filter(function (o) {
      if (statusFilter && o.status !== statusFilter) return false;
      if (!q) return true;
      return [o.orderNo, o.customerName, o.address, o.remark].some(function (f) {
        return String(f || '').toLowerCase().indexOf(q) >= 0;
      });
    }).sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });

    const sumTotal = orders.reduce(function (s, o) { return s + App.orderTotal(o); }, 0);
    const sumManagement = orders.reduce(function (s, o) { return s + App.orderManagementFee(o); }, 0);
    const sumMaterial = orders.reduce(function (s, o) { return s + App.orderMaterialCost(o); }, 0);
    const sumMaterialTax = orders.reduce(function (s, o) { return s + App.orderMaterialTax(o); }, 0);
    const sumTransport = orders.reduce(function (s, o) { return s + App.orderTransportCost(o); }, 0);
    const sumTransportTax = orders.reduce(function (s, o) { return s + App.orderTransportTax(o); }, 0);
    const sumLabor = orders.reduce(function (s, o) { return s + App.orderInstallCost(o); }, 0);
    const sumLaborTax = orders.reduce(function (s, o) { return s + App.orderLaborTax(o); }, 0);
    const sumAux = orders.reduce(function (s, o) { return s + App.orderAuxCost(o); }, 0);
    const sumAuxTax = orders.reduce(function (s, o) { return s + App.orderAuxTax(o); }, 0);
    const sumCost = orders.reduce(function (s, o) { return s + App.orderCost(o); }, 0);
    const sumTax = orders.reduce(function (s, o) { return s + App.orderTax(o); }, 0);
    const sumNetProfit = orders.reduce(function (s, o) { return s + App.orderNetProfit(o); }, 0);
    const sumReceived = orders.reduce(function (s, o) { return s + App.orderReceived(o.id); }, 0);

    const rows = orders.map(function (o) {
      const received = App.orderReceived(o.id);
      const orderTotal = App.orderTotal(o);
      const receivedPct = orderTotal > 0 ? received / orderTotal * 100 : 0;
      const balance = orderTotal - received;
      const paid = App.orderPaid(o.id);
      const pendingPay = App.orderCost(o) - paid;
      const managementFee = App.orderManagementFee(o);
      const materialCost = App.orderMaterialCost(o);
      const transportCost = App.orderTransportCost(o);
      const installCost = App.orderInstallCost(o);
      const auxCost = App.orderAuxCost(o);
      const costTotal = App.orderCost(o);
      const netProfit = App.orderNetProfit(o);
      return '<tr>' +
        '<td><a class="link" data-act="detail" data-id="' + o.id + '">' + App.escapeHtml(o.orderNo) + '</a></td>' +
        '<td>' + App.escapeHtml(o.customerName || '') + '</td>' +
        '<td>' + App.badge(o.status) + '</td>' +
        '<td class="money">' + App.fmtMoney(App.orderTotal(o)) + '</td>' +
        '<td class="money muted">' + App.fmtMoney(managementFee) + '</td>' +
        '<td class="money muted">' + App.fmtMoney(materialCost) + '</td>' +
        '<td class="money muted">' + App.fmtMoney(transportCost) + '</td>' +
        '<td class="money muted">' + App.fmtMoney(installCost) + '</td>' +
        '<td class="money muted">' + App.fmtMoney(auxCost) + '</td>' +
        '<td class="money"><a class="link" data-cost-detail="' + o.id + '" title="查看成本与税收明细">' + App.fmtMoney(costTotal) + '</a></td>' +
        '<td class="money"><a class="link" data-profit-detail="' + o.id + '" style="color:' + (netProfit >= 0 ? 'var(--green)' : 'var(--red)') + '" title="查看利润明细">' + App.fmtMoney(netProfit) + '</a></td>' +
        '<td class="money">' + App.fmtMoney(received) + ' <span class="muted small">(' + App.fmtNum(receivedPct) + '%)</span></td>' +
        '<td class="money" style="color:' + (balance > 0.001 ? 'var(--red)' : 'var(--green)') + '">' + App.fmtMoney(balance) + '</td>' +
        '<td class="money">' + App.fmtMoney(paid) + '</td>' +
        '<td class="money" style="color:' + (pendingPay > 0.001 ? 'var(--red)' : 'var(--green)') + '">' + App.fmtMoney(pendingPay) + '</td>' +
        '<td class="num muted">' + App.fmtDate(o.createdAt) + '</td>' +
        '<td>' + App.actionBtns([
          { label: '详情', cls: 'btn-outline', data: { act: 'detail', id: o.id } },
          { label: '编辑', cls: 'btn-outline', data: { act: 'edit', id: o.id } },
          { label: '删除', cls: 'btn-outline', data: { act: 'del', id: o.id } }
        ]) + '</td></tr>';
    }).join('');

    const statusChips = st.map(function (s) {
      return '<label class="chip"><input type="radio" name="st" value="' + App.escapeHtml(s) + '"' + (statusFilter === s ? ' checked' : '') + '><span>' + s + '</span></label>';
    }).join('');

    el.innerHTML =
      '<div class="toolbar">' +
        '<input class="input" style="width:240px" placeholder="搜索订单号 / 客户 / 地址" id="search" value="' + App.escapeHtml(filter) + '">' +
        '<span class="spacer"></span>' +
        '<button class="btn btn-outline" id="export">导出</button>' +
        '<button class="btn btn-primary" id="add">＋ 新建订单</button>' +
      '</div>' +
      '<div class="pill-row" id="status-chips" style="margin-bottom:14px">' +
        '<label class="chip"><input type="radio" name="st" value=""' + (!statusFilter ? ' checked' : '') + '><span>全部</span></label>' + statusChips +
      '</div>' +
      '<div class="muted small" style="margin-bottom:12px">共 ' + orders.length + ' 单 · 订单总额 ' + App.fmtMoney(sumTotal) + ' · 成本 ' + App.fmtMoney(sumCost) + '（管理 ' + App.fmtMoney(sumManagement) + ' · 材料 ' + App.fmtMoney(sumMaterial) + ' · 运输 ' + App.fmtMoney(sumTransport) + ' · 人工 ' + App.fmtMoney(sumLabor) + ' · 辅材 ' + App.fmtMoney(sumAux) + '）· 税收合计 ' + App.fmtMoney(sumTax) + '（材料 ' + App.fmtMoney(sumMaterialTax) + ' · 运输 ' + App.fmtMoney(sumTransportTax) + ' · 人工 ' + App.fmtMoney(sumLaborTax) + ' · 辅材 ' + App.fmtMoney(sumAuxTax) + '）· 利润 ' + App.fmtMoney(sumNetProfit) + ' · 已收 ' + App.fmtMoney(sumReceived) + ' · 待收 ' + App.fmtMoney(sumTotal - sumReceived) + '</div>' +
      (rows
        ? '<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr>' +
          '<th>订单号</th><th>客户</th><th>状态</th><th class="num">订单总额</th><th class="num">管理费</th><th class="num">材料成本</th><th class="num">运输成本</th><th class="num">人工成本</th><th class="num">辅材成本</th><th class="num">综合成本合计</th><th class="num">利润</th><th class="num">已收</th><th class="num">待收</th><th class="num">已支</th><th class="num">待支</th><th class="num">日期</th><th></th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div></div>'
        : App.empty('📋', '没有符合条件的订单', '点击「新建订单」开始'));

    bind(el);
  }

  function bind(el) {
    el.querySelector('#search').addEventListener('input', App.debounce(function (e) {
      filter = e.target.value; render(el);
    }, 250));
    el.querySelector('#add').addEventListener('click', function () { openForm(null); });
    el.querySelector('#export').addEventListener('click', exportCSV);
    el.querySelectorAll('#status-chips input[name="st"]').forEach(function (r) {
      r.addEventListener('change', function () {
        statusFilter = r.value; render(el);
      });
    });
    el.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const act = btn.getAttribute('data-act');
        const id = btn.getAttribute('data-id');
        if (act === 'edit') openForm(id);
        else if (act === 'del') del(id, el);
        else if (act === 'detail') detail(id, el);
      });
    });
    el.querySelectorAll('[data-cost-detail]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        costDetail(btn.getAttribute('data-cost-detail'));
      });
    });
    el.querySelectorAll('[data-profit-detail]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        profitDetail(btn.getAttribute('data-profit-detail'));
      });
    });
  }

  function profitDetail(id) {
    const o = App.DB.get('orders', id);
    if (!o) return;
    const gross = App.orderProfit(o);
    const rate = App.orderChannelRate(o);
    const net = App.orderNetProfit(o);
    const company = App.orderChannelCompany(o);
    const cash = App.orderCashProfit(o);

    App.modal({
      title: '利润明细 · ' + o.orderNo,
      size: 'sm',
      footer: false,
      body:
        '<div class="stat-row"><span class="k">毛利润</span><span class="v">' + App.fmtMoney(gross) + '</span></div>' +
        '<div class="stat-row"><span class="k">税率</span><span class="v">' + App.fmtNum(rate) + '%</span></div>' +
        '<div class="stat-row"><span class="k">利润</span><span class="v" style="color:' + (net >= 0 ? 'var(--green)' : 'var(--red)') + '">' + App.fmtMoney(net) + ' <span class="muted">（= 毛利润 × (1 − 税率%)）</span></span></div>' +
        '<div class="stat-row"><span class="k">通道公司</span><span class="v">' + (company ? App.escapeHtml(company) : '<span class="muted">—</span>') + '</span></div>' +
        '<div class="stat-row" style="border-top:1px solid var(--border);padding-top:8px"><span class="k">现金利润</span><span class="v" style="font-weight:600;color:' + (cash >= 0 ? 'var(--green)' : 'var(--red)') + '">' + App.fmtMoney(cash) + '</span></div>'
    });
  }

  function costDetail(id) {
    const o = App.DB.get('orders', id);
    if (!o) return;
    const materialFee = App.orderMaterialFee(o);
    const materialTax = App.orderMaterialTax(o);
    const transportFee = App.orderTransportFee(o);
    const transportTax = App.orderTransportTax(o);
    const installFee = App.orderInstallFee(o);
    const laborTax = App.orderLaborTax(o);
    const managementFee = App.orderManagementFee(o);
    const auxFee = App.orderAuxFee(o);
    const auxTax = App.orderAuxTax(o);
    const cost = App.orderCost(o);
    const tax = App.orderTax(o);

    function row(label, fee, t, rate) {
      return '<div class="stat-row"><span class="k">' + label + '</span><span class="v">' + App.fmtMoney(fee + t) + '</span></div>' +
        '<div class="stat-row"><span class="k">　费用 / 税收</span><span class="v muted">' + App.fmtMoney(fee) + ' + ' + App.fmtMoney(t) + '（税 ' + App.fmtNum(rate) + '%）</span></div>';
    }

    App.modal({
      title: '成本合计明细 · ' + o.orderNo,
      size: 'sm',
      footer: false,
      body:
        '<div class="stat-row"><span class="k">管理费</span><span class="v">' + App.fmtMoney(managementFee) + '</span></div>' +
        '<div class="stat-row"><span class="k">　比例</span><span class="v muted">' + App.fmtNum(App.orderManagementRate(o)) + '%</span></div>' +
        row('材料成本', materialFee, materialTax, App.orderMaterialTaxRate(o)) +
        row('运输成本', transportFee, transportTax, App.orderTransportTaxRate(o)) +
        row('人工成本', installFee, laborTax, App.orderLaborTaxRate(o)) +
        row('辅材成本', auxFee, auxTax, App.orderAuxTaxRate(o)) +
        '<div class="stat-row" style="border-top:1px solid var(--border);padding-top:8px"><span class="k">成本合计</span><span class="v" style="font-weight:600">' + App.fmtMoney(cost) + '</span></div>' +
        '<div class="stat-row"><span class="k">成本税收合计</span><span class="v">' + App.fmtMoney(tax) + '</span></div>'
    });
  }

  /* ---------- 计价 ---------- */
  function rowArea(w, h) { return App.num(w) * App.num(h) / 1000000; }
  function rowAmount(it) {
    if (it.priceMode === '按樘') return it.qty * App.num(it.unitPrice);
    return rowArea(it.width, it.height) * it.qty * App.num(it.unitPrice);
  }

  function itemsTableHtml(items) {
    const s = App.settings();
    items = items || [];
    const rows = items.map(function (it, i) {
      return '<tr data-idx="' + i + '">' +
        '<td><select class="input" data-f="productType">' + App.selectOptions(s.productTypes, it.productType, true) + '</select></td>' +
        '<td><select class="input" data-f="material">' + App.selectOptions(s.materialTypes, it.material, true) + '</select></td>' +
        '<td><select class="input" data-f="glass">' + App.selectOptions(s.glassTypes, it.glass, true) + '</select></td>' +
        '<td><select class="input" data-f="color">' + App.selectOptions(s.colorTypes, it.color, true) + '</select></td>' +
        '<td><input class="input num" data-f="width" value="' + (it.width || '') + '" placeholder="宽"></td>' +
        '<td><input class="input num" data-f="height" value="' + (it.height || '') + '" placeholder="高"></td>' +
        '<td><input class="input num" data-f="qty" value="' + (it.qty || 1) + '"></td>' +
        '<td><select class="input" data-f="priceMode">' + App.selectOptions(['按㎡', '按樘'], it.priceMode || '按㎡') + '</select></td>' +
        '<td><input class="input num" data-f="unitPrice" value="' + (it.unitPrice || '') + '" placeholder="单价"></td>' +
        '<td class="num muted" data-view="area">' + (it.width && it.height ? App.fmtNum(rowArea(it.width, it.height) * it.qty) : '-') + '</td>' +
        '<td class="money" data-view="amount">' + App.fmtMoney(rowAmount(it)) + '</td>' +
        '<td><input class="input" data-f="remark" value="' + App.escapeHtml(it.remark || '') + '"></td>' +
        '<td class="del-cell"><button class="btn btn-sm btn-outline" data-rm="1">✕</button></td>' +
        '</tr>';
    }).join('');
    return '<table class="mini-table" id="items-table"><thead><tr>' +
      '<th>产品类型</th><th>材质</th><th>玻璃</th><th>颜色</th><th>宽(mm)</th><th>高(mm)</th><th>数量</th><th>计价</th><th>单价</th><th>面积(㎡)</th><th>金额</th><th>备注</th><th></th>' +
      '</tr></thead><tbody id="items-body">' + (rows || '') + '</tbody></table>';
  }

  function openForm(id, prefill) {
    const o = id ? App.DB.get('orders', id) : null;
    const s = App.settings();
    let items = o ? o.items : (prefill && prefill.items ? prefill.items : []);
    const address = o ? o.address : (prefill && prefill.address ? prefill.address : '');
    const customerId = o ? o.customerId : (prefill && prefill.customerId ? prefill.customerId : null);
    const status = o ? o.status : '待生产';

    const body =
      '<div class="form-grid">' +
        '<div class="field"><label>订单号</label><input class="input" id="f-no" value="' + App.escapeHtml(o ? o.orderNo : '(保存时自动生成)') + '" disabled></div>' +
        '<div class="field"><label>状态</label><select class="select" id="f-status">' + App.selectOptions(s.orderStatuses, status) + '</select></div>' +
        '<div class="field"><label>客户 <span class="req">*</span></label>' + App.customerField(customerId) + '</div>' +
        '<div class="field"><label>安装地址</label><input class="input" id="f-address" value="' + App.escapeHtml(address) + '"></div>' +
        '<div class="field full"><label>门窗明细（报价）</label><div style="overflow-x:auto">' + itemsTableHtml(items) + '</div>' +
          '<button class="btn btn-outline btn-sm" id="add-row" style="margin-top:8px">＋ 添加一行</button></div>' +
        '<div class="field full"><label>备注</label><textarea class="textarea" id="f-remark">' + App.escapeHtml(o ? o.remark : '') + '</textarea></div>' +
      '</div>' +
      '<div style="display:flex;justify-content:flex-end;align-items:flex-end;gap:12px;margin-top:14px;flex-wrap:wrap">' +
        '<div class="field" style="width:150px"><label>管理费（元）</label>' +
          '<div class="customer-picker">' +
            '<input type="number" class="input" id="f-management-total" value="' + (o ? App.orderManagementFee(o) : '') + '" placeholder="0.00" readonly>' +
            '<button type="button" class="btn btn-outline" data-open-management title="按订单总额比例设置管理费">比例</button>' +
          '</div>' +
        '</div>' +
        '<input type="hidden" id="f-management-rate" value="' + (o ? App.orderManagementRate(o) : 5) + '">' +
        '<div class="field" style="width:150px"><label>材料成本（元）</label>' +
          '<div class="customer-picker">' +
            '<input type="number" class="input" id="f-material-total" value="' + (o ? App.orderMaterialCost(o) : '') + '" placeholder="0.00" readonly>' +
            '<button type="button" class="btn btn-outline" data-open-cost="material" title="填写材料费与材料税收">明细</button>' +
          '</div>' +
        '</div>' +
        '<input type="hidden" id="f-material" value="' + (o ? App.orderMaterialFee(o) : '') + '">' +
        '<input type="hidden" id="f-material-tax" value="' + (o ? App.orderMaterialTax(o) : '') + '">' +
        '<input type="hidden" id="f-material-rate" value="' + (o ? App.orderMaterialTaxRate(o) : 8) + '">' +
        '<div class="field" style="width:150px"><label>运输成本（元）</label>' +
          '<div class="customer-picker">' +
            '<input type="number" class="input" id="f-transport-total" value="' + (o ? App.orderTransportCost(o) : '') + '" placeholder="0.00" readonly>' +
            '<button type="button" class="btn btn-outline" data-open-cost="transport" title="填写运输费与运输税收">明细</button>' +
          '</div>' +
        '</div>' +
        '<input type="hidden" id="f-transport" value="' + (o ? App.orderTransportFee(o) : '') + '">' +
        '<input type="hidden" id="f-transport-tax" value="' + (o ? App.orderTransportTax(o) : '') + '">' +
        '<input type="hidden" id="f-transport-rate" value="' + (o ? App.orderTransportTaxRate(o) : 9) + '">' +
        '<div class="field" style="width:150px"><label>人工成本（元）</label>' +
          '<div class="customer-picker">' +
            '<input type="number" class="input" id="f-labor-total" value="' + (o ? App.orderInstallCost(o) : '') + '" placeholder="0.00" readonly>' +
            '<button type="button" class="btn btn-outline" data-open-cost="labor" title="填写人工费与人工税收">明细</button>' +
          '</div>' +
        '</div>' +
        '<input type="hidden" id="f-labor" value="' + (o ? App.orderInstallFee(o) : '') + '">' +
        '<input type="hidden" id="f-labor-tax" value="' + (o ? App.orderLaborTax(o) : '') + '">' +
        '<input type="hidden" id="f-labor-rate" value="' + (o ? App.orderLaborTaxRate(o) : 3.5) + '">' +
        '<div class="field" style="width:150px"><label>辅材成本（元）</label>' +
          '<div class="customer-picker">' +
            '<input type="number" class="input" id="f-aux-total" value="' + (o ? App.orderAuxCost(o) : '') + '" placeholder="0.00" readonly>' +
            '<button type="button" class="btn btn-outline" data-open-cost="aux" title="填写辅材费与辅材税收">明细</button>' +
          '</div>' +
        '</div>' +
        '<input type="hidden" id="f-aux" value="' + (o ? App.orderAuxFee(o) : '') + '">' +
        '<input type="hidden" id="f-aux-tax" value="' + (o ? App.orderAuxTax(o) : '') + '">' +
        '<input type="hidden" id="f-aux-rate" value="' + (o ? App.orderAuxTaxRate(o) : 8) + '">' +
        '<div class="field" style="width:130px"><label>通道公司</label><input type="text" class="input" id="f-channel-company" value="' + (o ? App.escapeHtml(App.orderChannelCompany(o)) : '') + '" placeholder="公司名"></div>' +
        '<div class="field" style="width:100px"><label>税率（%）</label><input type="number" class="input" id="f-channel-rate" value="' + (o ? App.orderChannelRate(o) : 6) + '" step="0.1" placeholder="6"></div>' +
        '<div style="text-align:right">' +
          '<div style="font-size:15px;font-weight:600">合计：<span id="sum-total" style="color:var(--primary)">¥0.00</span></div>' +
          '<div class="muted small">成本：<span id="sum-cost">¥0.00</span> · 税收合计：<span id="sum-tax">¥0.00</span> · 利润：<span id="sum-profit">¥0.00</span></div>' +
        '</div>' +
      '</div>';

    App.modal({
      title: o ? '编辑订单' : '新建订单',
      size: 'lg',
      body: body,
      okText: o ? '保存' : '创建订单',
      onOk: async function () {
        const customerId = document.getElementById('f-customer').value;
        if (!customerId) { App.toast('请选择客户', 'error'); return false; }
        const cust = App.DB.get('customers', customerId);

        const items = [];
        document.querySelectorAll('#items-body tr').forEach(function (tr) {
          const it = {
            productType: tr.querySelector('[data-f="productType"]').value,
            material: tr.querySelector('[data-f="material"]').value,
            glass: tr.querySelector('[data-f="glass"]').value,
            color: tr.querySelector('[data-f="color"]').value,
            width: App.num(tr.querySelector('[data-f="width"]').value),
            height: App.num(tr.querySelector('[data-f="height"]').value),
            qty: App.num(tr.querySelector('[data-f="qty"]').value) || 1,
            priceMode: tr.querySelector('[data-f="priceMode"]').value,
            unitPrice: App.num(tr.querySelector('[data-f="unitPrice"]').value),
            remark: tr.querySelector('[data-f="remark"]').value.trim()
          };
          if (it.productType || it.width || it.height) items.push(it);
        });

        let orderNo = o ? o.orderNo : await App.genNo('DD');
        const rec = {
          id: o ? o.id : undefined,
          orderNo: orderNo,
          customerId: customerId,
          customerName: cust ? cust.name : '',
          address: document.getElementById('f-address').value.trim(),
          status: document.getElementById('f-status').value,
          items: items,
          totalAmount: items.reduce(function (sum, it) { return sum + rowAmount(it); }, 0),
          managementRate: App.num(document.getElementById('f-management-rate').value),
          materialCost: App.num(document.getElementById('f-material').value),
          materialTax: App.num(document.getElementById('f-material-tax').value),
          materialTaxRate: App.num(document.getElementById('f-material-rate').value),
          transportCost: App.num(document.getElementById('f-transport').value),
          transportTax: App.num(document.getElementById('f-transport-tax').value),
          transportTaxRate: App.num(document.getElementById('f-transport-rate').value),
          installLabor: App.num(document.getElementById('f-labor').value),
          laborTax: App.num(document.getElementById('f-labor-tax').value),
          laborTaxRate: App.num(document.getElementById('f-labor-rate').value),
          auxCost: App.num(document.getElementById('f-aux').value),
          auxTax: App.num(document.getElementById('f-aux-tax').value),
          auxTaxRate: App.num(document.getElementById('f-aux-rate').value),
          channelCompany: document.getElementById('f-channel-company').value.trim(),
          channelRate: App.num(document.getElementById('f-channel-rate').value),
          remark: document.getElementById('f-remark').value.trim(),
          createdAt: o ? o.createdAt : App.now()
        };
        await App.DB.put('orders', rec);
        App.toast(o ? '已保存' : '订单已创建', 'success');
        render(currentEl());
      },
      onMount: function (mask) {
        function addRow() {
          const tr = document.createElement('tr');
          tr.innerHTML =
            '<td><select class="input" data-f="productType">' + App.selectOptions(s.productTypes, null, true) + '</select></td>' +
            '<td><select class="input" data-f="material">' + App.selectOptions(s.materialTypes, null, true) + '</select></td>' +
            '<td><select class="input" data-f="glass">' + App.selectOptions(s.glassTypes, null, true) + '</select></td>' +
            '<td><select class="input" data-f="color">' + App.selectOptions(s.colorTypes, null, true) + '</select></td>' +
            '<td><input class="input num" data-f="width" placeholder="宽"></td>' +
            '<td><input class="input num" data-f="height" placeholder="高"></td>' +
            '<td><input class="input num" data-f="qty" value="1"></td>' +
            '<td><select class="input" data-f="priceMode">' + App.selectOptions(['按㎡', '按樘'], '按㎡') + '</select></td>' +
            '<td><input class="input num" data-f="unitPrice" placeholder="单价"></td>' +
            '<td class="num muted" data-view="area">-</td>' +
            '<td class="money" data-view="amount">¥0.00</td>' +
            '<td><input class="input" data-f="remark"></td>' +
            '<td class="del-cell"><button class="btn btn-sm btn-outline" data-rm="1">✕</button></td>';
          mask.querySelector('#items-body').appendChild(tr);
        }
        function recalcRow(tr) {
          const w = App.num(tr.querySelector('[data-f="width"]').value);
          const h = App.num(tr.querySelector('[data-f="height"]').value);
          const qty = App.num(tr.querySelector('[data-f="qty"]').value) || 1;
          const mode = tr.querySelector('[data-f="priceMode"]').value;
          const price = App.num(tr.querySelector('[data-f="unitPrice"]').value);
          const area = rowArea(w, h);
          tr.querySelector('[data-view="area"]').textContent = (w && h) ? App.fmtNum(area * qty) : '-';
          const amt = mode === '按樘' ? qty * price : area * qty * price;
          tr.querySelector('[data-view="amount"]').textContent = App.fmtMoney(amt);
          recalcTotal();
        }
        function recalcTotal() {
          let sum = 0;
          mask.querySelectorAll('#items-body tr').forEach(function (tr) {
            const w = App.num(tr.querySelector('[data-f="width"]').value);
            const h = App.num(tr.querySelector('[data-f="height"]').value);
            const qty = App.num(tr.querySelector('[data-f="qty"]').value) || 1;
            const mode = tr.querySelector('[data-f="priceMode"]').value;
            const price = App.num(tr.querySelector('[data-f="unitPrice"]').value);
            sum += mode === '按樘' ? qty * price : rowArea(w, h) * qty * price;
          });
          mask.querySelector('#sum-total').textContent = App.fmtMoney(sum);
          const managementRate = App.num(mask.querySelector('#f-management-rate').value);
          const managementFee = sum * managementRate / 100;
          mask.querySelector('#f-management-total').value = managementFee;
          const materialFee = App.num(mask.querySelector('#f-material').value);
          const materialTax = App.num(mask.querySelector('#f-material-tax').value);
          const transportFee = App.num(mask.querySelector('#f-transport').value);
          const transportTax = App.num(mask.querySelector('#f-transport-tax').value);
          const laborFee = App.num(mask.querySelector('#f-labor').value);
          const laborTax = App.num(mask.querySelector('#f-labor-tax').value);
          const auxFee = App.num(mask.querySelector('#f-aux').value);
          const auxTax = App.num(mask.querySelector('#f-aux-tax').value);
          const channelRate = App.num(mask.querySelector('#f-channel-rate').value);
          const cost = managementFee + materialFee + materialTax + transportFee + transportTax + laborFee + laborTax + auxFee + auxTax;
          const tax = materialTax + transportTax + laborTax + auxTax;
          const profit = sum - cost;
          mask.querySelector('#sum-cost').textContent = App.fmtMoney(cost);
          mask.querySelector('#sum-tax').textContent = App.fmtMoney(tax);
          mask.querySelector('#sum-profit').textContent = App.fmtMoney(profit * (1 - channelRate / 100));
        }
        const costMenuCfgs = {
          material: { title: '材料成本明细', feeLabel: '材料费', taxLabel: '材料税收', totalLabel: '材料成本合计', feeId: '#f-material', taxId: '#f-material-tax', rateId: '#f-material-rate', displayId: '#f-material-total' },
          transport: { title: '运输成本明细', feeLabel: '运输费', taxLabel: '运输税收', totalLabel: '运输成本合计', feeId: '#f-transport', taxId: '#f-transport-tax', rateId: '#f-transport-rate', displayId: '#f-transport-total' },
          labor: { title: '人工成本明细', feeLabel: '人工费', taxLabel: '人工税收', totalLabel: '人工成本合计', feeId: '#f-labor', taxId: '#f-labor-tax', rateId: '#f-labor-rate', displayId: '#f-labor-total' },
          aux: { title: '辅材成本明细', feeLabel: '辅材费', taxLabel: '辅材税收', totalLabel: '辅材成本合计', feeId: '#f-aux', taxId: '#f-aux-tax', rateId: '#f-aux-rate', displayId: '#f-aux-total' }
        };
        function openCostMenu(key) {
          const cfg = costMenuCfgs[key];
          if (!cfg) return;
          const fee = App.num(mask.querySelector(cfg.feeId).value);
          const rate = App.num(mask.querySelector(cfg.rateId).value);
          const tax = fee * rate / 100;
          App.modal({
            title: cfg.title,
            size: 'sm',
            body:
              '<div class="field"><label>' + cfg.feeLabel + '（元）</label><input type="number" class="input" id="mm-fee" value="' + fee + '" placeholder="0.00"></div>' +
              '<div class="field"><label>税率（%）</label><input type="number" class="input" id="mm-rate" value="' + rate + '" step="0.1" min="0"></div>' +
              '<div class="muted small" style="text-align:right;margin-top:8px">' + cfg.taxLabel + '：<span id="mm-tax" style="font-weight:600">' + App.fmtMoney(tax) + '</span>（= ' + cfg.feeLabel + ' × ' + rate + '%）</div>' +
              '<div style="text-align:right;margin-top:4px">' + cfg.totalLabel + '：<span id="mm-total" style="font-weight:600;color:var(--primary)">' + App.fmtMoney(fee + tax) + '</span></div>',
            okText: '确定',
            onOk: function () {
              const f = App.num(document.getElementById('mm-fee').value);
              const r = App.num(document.getElementById('mm-rate').value);
              const t = f * r / 100;
              mask.querySelector(cfg.feeId).value = f;
              mask.querySelector(cfg.rateId).value = r;
              mask.querySelector(cfg.taxId).value = t;
              mask.querySelector(cfg.displayId).value = f + t;
              recalcTotal();
            },
            onMount: function (mm) {
              function sync() {
                const f = App.num(mm.querySelector('#mm-fee').value);
                const r = App.num(mm.querySelector('#mm-rate').value);
                const t = f * r / 100;
                mm.querySelector('#mm-tax').textContent = App.fmtMoney(t);
                mm.querySelector('#mm-total').textContent = App.fmtMoney(f + t);
              }
              mm.querySelector('#mm-fee').addEventListener('input', sync);
              mm.querySelector('#mm-rate').addEventListener('input', sync);
              mm.querySelector('#mm-fee').focus();
            }
          });
        }
        function openManagementMenu() {
          const rate = App.num(mask.querySelector('#f-management-rate').value);
          App.modal({
            title: '管理费设置',
            size: 'sm',
            body:
              '<div class="field"><label>管理费比例（%）</label><input type="number" class="input" id="mm-mrate" value="' + rate + '" step="0.1" min="0"></div>' +
              '<div class="muted small" style="margin-top:8px">管理费 = 订单总额 × 比例%</div>',
            okText: '确定',
            onOk: function () {
              mask.querySelector('#f-management-rate').value = App.num(document.getElementById('mm-mrate').value);
              recalcTotal();
            },
            onMount: function (mm) {
              mm.querySelector('#mm-mrate').focus();
            }
          });
        }
        mask.querySelector('#add-row').addEventListener('click', addRow);
        mask.querySelectorAll('[data-open-cost]').forEach(function (btn) {
          btn.addEventListener('click', function () { openCostMenu(btn.getAttribute('data-open-cost')); });
        });
        mask.querySelector('[data-open-management]').addEventListener('click', openManagementMenu);
        mask.querySelector('#f-channel-rate').addEventListener('input', recalcTotal);
        mask.querySelector('#items-body').addEventListener('input', function (e) {
          if (e.target.hasAttribute && e.target.hasAttribute('data-f')) recalcRow(e.target.closest('tr'));
        });
        mask.querySelector('#items-body').addEventListener('change', function (e) {
          if (e.target.hasAttribute && e.target.hasAttribute('data-f')) recalcRow(e.target.closest('tr'));
        });
        mask.querySelector('#items-body').addEventListener('click', function (e) {
          if (e.target.hasAttribute && e.target.hasAttribute('data-rm')) {
            e.target.closest('tr').remove(); recalcTotal();
          }
        });
        if (!(o && o.items && o.items.length) && !(prefill && prefill.items && prefill.items.length)) addRow();
        recalcTotal();
      }
    });
  }

  function currentEl() { return document.getElementById('content'); }

  function del(id, el) {
    const o = App.DB.get('orders', id);
    App.confirm('确定删除订单「' + (o ? o.orderNo : '') + '」吗？相关财务、生产、安装记录不会被删除。',
      async function () {
        await App.DB.remove('orders', id);
        App.toast('已删除', 'success');
        render(el);
      }, '删除');
  }

  function detail(id, el) {
    const o = App.DB.get('orders', id);
    if (!o) return;
    const s = App.settings();
    const received = App.orderReceived(o.id);
    const total = App.orderTotal(o);
    const materialFee = App.orderMaterialFee(o);
    const materialCost = App.orderMaterialCost(o);
    const materialTax = App.orderMaterialTax(o);
    const transportFee = App.orderTransportFee(o);
    const transportCost = App.orderTransportCost(o);
    const transportTax = App.orderTransportTax(o);
    const installFee = App.orderInstallFee(o);
    const installCost = App.orderInstallCost(o);
    const laborTax = App.orderLaborTax(o);
    const managementFee = App.orderManagementFee(o);
    const auxFee = App.orderAuxFee(o);
    const auxCost = App.orderAuxCost(o);
    const auxTax = App.orderAuxTax(o);
    const cost = App.orderCost(o);
    const tax = App.orderTax(o);
    const profit = App.orderProfit(o);
    const netProfit = App.orderNetProfit(o);
    const channelCompany = App.orderChannelCompany(o);
    const channelRate = App.orderChannelRate(o);
    const cashProfit = App.orderCashProfit(o);
    const balance = total - received;
    const receivedPercent = total > 0 ? received / total * 100 : 0;
    const paid = App.orderPaid(o.id);
    const pendingPay = cost - paid;

    const itemRows = (o.items || []).map(function (it) {
      const area = rowArea(it.width, it.height);
      return '<tr><td>' + App.escapeHtml(it.productType || '') + '</td>' +
        '<td>' + App.escapeHtml(it.material || '') + '</td>' +
        '<td>' + App.escapeHtml(it.glass || '') + '</td>' +
        '<td class="num">' + App.fmtNum(it.width) + '</td><td class="num">' + App.fmtNum(it.height) + '</td>' +
        '<td class="num">' + App.fmtNum(it.qty) + '</td>' +
        '<td class="num">' + (it.width && it.height ? App.fmtNum(area * it.qty) : '-') + '</td>' +
        '<td class="money">' + App.fmtMoney(rowAmount(it)) + '</td></tr>';
    }).join('');

    const fins = App.DB.getAll('finances').filter(function (f) { return f.orderId === id; })
      .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
    const finRows = fins.map(function (f) {
      return '<tr><td class="muted">' + App.fmtDate(f.date) + '</td>' +
        '<td>' + App.badge(f.type, f.type === '收入' ? 'green' : 'red') + '</td>' +
        '<td>' + App.escapeHtml(f.category || '') + '</td><td class="muted">' + App.escapeHtml(f.method || '') + '</td>' +
        '<td class="money">' + App.fmtMoney(f.amount) + '</td></tr>';
    }).join('');

    App.modal({
      title: '订单详情 · ' + o.orderNo,
      size: 'lg',
      footer: false,
      body:
        '<div class="grid-3">' +
          '<div><div class="section-title">基本信息</div>' +
            '<div class="stat-row"><span class="k">客户</span><span class="v">' + App.escapeHtml(o.customerName || '') + '</span></div>' +
            '<div class="stat-row"><span class="k">状态</span><span class="v">' + App.badge(o.status) + '</span></div>' +
            '<div class="stat-row"><span class="k">地址</span><span class="v">' + App.escapeHtml(o.address || '') + '</span></div>' +
            '<div class="stat-row"><span class="k">创建</span><span class="v">' + App.fmtDate(o.createdAt) + '</span></div>' +
          '</div>' +
          '<div><div class="section-title">金额</div>' +
            '<div class="stat-row"><span class="k">订单总额</span><span class="v">' + App.fmtMoney(total) + '</span></div>' +
            '<div class="stat-row"><span class="k">管理费</span><span class="v">' + App.fmtMoney(managementFee) + '</span></div>' +
            '<div class="stat-row"><span class="k">材料成本</span><span class="v">' + App.fmtMoney(materialCost) + '</span></div>' +
            '<div class="stat-row"><span class="k">　材料费 / 税收</span><span class="v muted">' + App.fmtMoney(materialFee) + ' + ' + App.fmtMoney(materialTax) + '</span></div>' +
            '<div class="stat-row"><span class="k">运输成本</span><span class="v">' + App.fmtMoney(transportCost) + '</span></div>' +
            '<div class="stat-row"><span class="k">　运输费 / 税收</span><span class="v muted">' + App.fmtMoney(transportFee) + ' + ' + App.fmtMoney(transportTax) + '</span></div>' +
            '<div class="stat-row"><span class="k">人工成本</span><span class="v">' + App.fmtMoney(installCost) + '</span></div>' +
            '<div class="stat-row"><span class="k">　人工费 / 税收</span><span class="v muted">' + App.fmtMoney(installFee) + ' + ' + App.fmtMoney(laborTax) + '</span></div>' +
            '<div class="stat-row"><span class="k">辅材成本</span><span class="v">' + App.fmtMoney(auxCost) + '</span></div>' +
            '<div class="stat-row"><span class="k">　辅材费 / 税收</span><span class="v muted">' + App.fmtMoney(auxFee) + ' + ' + App.fmtMoney(auxTax) + '</span></div>' +
            '<div class="stat-row"><span class="k">成本合计</span><span class="v">' + App.fmtMoney(cost) + '</span></div>' +
            '<div class="stat-row"><span class="k">税收合计</span><span class="v">' + App.fmtMoney(tax) + '</span></div>' +
            '<div class="stat-row"><span class="k">毛利润</span><span class="v" style="color:' + (profit >= 0 ? 'var(--green)' : 'var(--red)') + '">' + App.fmtMoney(profit) + '</span></div>' +
            '<div class="stat-row"><span class="k">税率</span><span class="v">' + App.fmtNum(channelRate) + '%</span></div>' +
            '<div class="stat-row"><span class="k">利润</span><span class="v" style="color:' + (netProfit >= 0 ? 'var(--green)' : 'var(--red)') + '">' + App.fmtMoney(netProfit) + '</span></div>' +
            '<div class="stat-row"><span class="k">通道公司</span><span class="v">' + (channelCompany ? App.escapeHtml(channelCompany) : '<span class="muted">—</span>') + '</span></div>' +
            '<div class="stat-row"><span class="k">现金利润</span><span class="v" style="color:' + (cashProfit >= 0 ? 'var(--green)' : 'var(--red)') + '">' + App.fmtMoney(cashProfit) + '</span></div>' +
            '<div class="stat-row"><span class="k">已收款</span><span class="v"><a class="link" data-op="edit-paid" title="编辑已收费用">' + App.fmtMoney(received) + '</a> <span class="muted">（占 ' + App.fmtNum(receivedPercent) + '%）</span></span></div>' +
            '<div class="stat-row"><span class="k">待收款</span><span class="v" style="color:' + (balance > 0.001 ? 'var(--red)' : 'var(--green)') + '">' + App.fmtMoney(balance) + '</span></div>' +
            '<div class="stat-row"><span class="k">已支</span><span class="v"><a class="link" data-op="edit-paidout" title="编辑已支金额">' + App.fmtMoney(paid) + '</a></span></div>' +
            '<div class="stat-row"><span class="k">待支</span><span class="v" style="color:' + (pendingPay > 0.001 ? 'var(--red)' : 'var(--green)') + '">' + App.fmtMoney(pendingPay) + '</span></div>' +
          '</div>' +
          '<div><div class="section-title">操作</div>' +
            '<div style="display:flex;flex-direction:column;gap:8px">' +
              '<button class="btn btn-outline btn-sm" data-op="status">变更状态</button>' +
              '<button class="btn btn-outline btn-sm" data-op="change-total">变更订单总额</button>' +
              '<button class="btn btn-outline btn-sm" data-op="finance">登记收款</button>' +
              '<button class="btn btn-outline btn-sm" data-op="expense">登记支出</button>' +
              '<button class="btn btn-outline btn-sm" data-op="production">生成生产单</button>' +
              '<button class="btn btn-outline btn-sm" data-op="install">生成安装单</button>' +
            '</div></div>' +
        '</div>' +
        '<div class="section-title">门窗明细（' + (o.items || []).length + '）</div>' +
        (itemRows ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>产品</th><th>材质</th><th>玻璃</th><th class="num">宽</th><th class="num">高</th><th class="num">数量</th><th class="num">面积</th><th class="num">金额</th></tr></thead><tbody>' + itemRows + '</tbody></table></div>' : '<div class="muted small">无明细</div>') +
        '<div class="section-title">财务往来（' + fins.length + '）</div>' +
        (finRows ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>日期</th><th>类型</th><th>类别</th><th>方式</th><th class="num">金额</th></tr></thead><tbody>' + finRows + '</tbody></table></div>' : '<div class="muted small">暂无</div>') +
        (o.remark ? '<div class="section-title">备注</div><div class="muted">' + App.escapeHtml(o.remark) + '</div>' : ''),
      onMount: function (mask) {
        mask.querySelectorAll('[data-op]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            const op = btn.getAttribute('data-op');
            if (op === 'status') changeStatus(o, el);
            else if (op === 'change-total') changeTotal(o, el);
            else if (op === 'finance') App.openNewFinance({ orderId: o.id, customerId: o.customerId, type: '收入' });
            else if (op === 'expense') App.openNewFinance({ orderId: o.id, customerId: o.customerId, type: '支出' });
            else if (op === 'edit-paid') editPaid(o, el);
            else if (op === 'edit-paidout') editPaidOut(o, el);
            else if (op === 'production') { mask.remove(); if (typeof App.openNewProduction === 'function') App.openNewProduction(o); }
            else if (op === 'install') { mask.remove(); if (typeof App.openNewInstall === 'function') App.openNewInstall(o); }
          });
        });
      }
    });
  }

  function editPaid(o, el) {
    const cur = App.orderReceived(o.id);
    App.modal({
      title: '编辑已收费用 · ' + o.orderNo,
      size: 'sm',
      body: '<div class="field"><label>已收费用（元）</label><input type="number" class="input" id="f-paid" value="' + cur + '" step="0.01" min="0"></div>',
      okText: '保存',
      onOk: async function () {
        o.receivedAmount = App.num(document.getElementById('f-paid').value);
        await App.DB.put('orders', o);
        App.toast('已收费用已更新', 'success');
        if (el) render(el);
      }
    });
  }

  function editPaidOut(o, el) {
    const cur = App.orderPaid(o.id);
    App.modal({
      title: '编辑已支金额 · ' + o.orderNo,
      size: 'sm',
      body: '<div class="field"><label>已支金额（元）</label><input type="number" class="input" id="f-paidout" value="' + cur + '" step="0.01" min="0"></div>',
      okText: '保存',
      onOk: async function () {
        o.paidAmount = App.num(document.getElementById('f-paidout').value);
        await App.DB.put('orders', o);
        App.toast('已支金额已更新', 'success');
        if (el) render(el);
      }
    });
  }

  function changeTotal(o, el) {
    const cur = App.orderTotal(o);
    App.modal({
      title: '变更订单总额 · ' + o.orderNo,
      size: 'sm',
      body: '<div class="field"><label>订单总额（元）</label><input type="number" class="input" id="f-total" value="' + cur + '" step="0.01" min="0"></div>',
      okText: '保存',
      onOk: async function () {
        o.totalAmount = App.num(document.getElementById('f-total').value);
        await App.DB.put('orders', o);
        App.toast('订单总额已更新', 'success');
        if (el) render(el);
      }
    });
  }

  function changeStatus(o, el) {
    const s = App.settings();
    App.modal({
      title: '变更订单状态',
      size: 'sm',
      body: '<div class="field"><label>选择状态</label><select class="select" id="f-status">' + App.selectOptions(s.orderStatuses, o.status) + '</select></div>',
      onOk: async function () {
        o.status = document.getElementById('f-status').value;
        await App.DB.put('orders', o);
        App.toast('状态已更新为「' + o.status + '」', 'success');
        if (el) render(el);
      }
    });
  }

  function exportCSV() {
    const rows = [['订单号', '客户', '状态', '地址', '总额', '管理费', '材料成本', '材料费', '材料税收', '运输成本', '运输费', '运输税收', '人工成本', '人工费', '人工税收', '辅材成本', '辅材费', '辅材税收', '成本合计', '税收合计', '毛利润', '税率', '利润', '通道公司', '现金利润', '备注', '创建日期']];
    App.DB.getAll('orders').forEach(function (o) {
      rows.push([o.orderNo, o.customerName, o.status, o.address, App.orderTotal(o),
        App.orderManagementFee(o),
        App.orderMaterialCost(o), App.orderMaterialFee(o), App.orderMaterialTax(o),
        App.orderTransportCost(o), App.orderTransportFee(o), App.orderTransportTax(o),
        App.orderInstallCost(o), App.orderInstallFee(o), App.orderLaborTax(o),
        App.orderAuxCost(o), App.orderAuxFee(o), App.orderAuxTax(o),
        App.orderCost(o), App.orderTax(o), App.orderProfit(o),
        App.orderChannelRate(o), App.orderNetProfit(o), App.orderChannelCompany(o), App.orderCashProfit(o),
        o.remark, App.fmtDate(o.createdAt)]);
    });
    App.download('订单列表-' + App.today() + '.csv', App.toCSV(rows), 'text/csv;charset=utf-8');
    App.toast('已导出 CSV', 'success');
  }
})();
