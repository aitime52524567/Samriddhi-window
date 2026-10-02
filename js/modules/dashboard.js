/* ===================== 工作台 ===================== */
(function () {
  const App = window.App;

  App.registerModule({
    id: 'dashboard',
    title: '工作台',
    icon: 'dashboard',
    render: render
  });

  function render(el) {
    const orders = App.DB.getAll('orders');
    const customers = App.DB.getAll('customers');
    const finances = App.DB.getAll('finances');
    const measurements = App.DB.getAll('measurements');

    const monthOrders = orders.filter(function (o) { return App.isThisMonth(o.createdAt); });
    const monthSales = monthOrders.reduce(function (s, o) { return s + App.orderTotal(o); }, 0);
    const monthIncome = finances.filter(function (f) { return f.type === '收入' && App.isThisMonth(f.date); })
      .reduce(function (s, f) { return s + App.num(f.amount); }, 0);
    const monthExpense = finances.filter(function (f) { return f.type === '支出' && App.isThisMonth(f.date); })
      .reduce(function (s, f) { return s + App.num(f.amount); }, 0);

    const toProduce = orders.filter(function (o) { return o.status === '待生产'; }).length;
    const producing = orders.filter(function (o) { return o.status === '生产中'; }).length;
    const toInstall = orders.filter(function (o) { return o.status === '待安装' || o.status === '安装中'; }).length;

    const kpis = [
      { label: '客户总数', value: customers.length, sub: '本月新增 ' + customers.filter(function (c) { return App.isThisMonth(c.createdAt); }).length + ' 个', icon: '👥', color: '#dbeafe', fg: '#2563eb' },
      { label: '本月订单', value: monthOrders.length, sub: '待生产 ' + toProduce + ' · 生产中 ' + producing, icon: '📋', color: '#fef3c7', fg: '#d97706' },
      { label: '本月销售额', value: App.fmtMoney(monthSales), sub: '订单总额', icon: '💰', color: '#dcfce7', fg: '#16a34a' },
      { label: '本月回款', value: App.fmtMoney(monthIncome), sub: '支出 ' + App.fmtMoney(monthExpense), icon: '📈', color: '#cffafe', fg: '#0891b2' },
      { label: '待安装', value: toInstall, sub: '安装/待验收订单', icon: '🚚', color: '#ede9fe', fg: '#7c3aed' }
    ];

    const kpiHtml = kpis.map(function (k) {
      return '<div class="kpi"><div class="kpi-head">' +
        '<div><div class="kpi-label">' + k.label + '</div><div class="kpi-value">' + k.value + '</div></div>' +
        '<div class="kpi-icon" style="background:' + k.color + '">' + k.icon + '</div>' +
        '</div><div class="kpi-sub">' + k.sub + '</div></div>';
    }).join('');

    /* 待办 */
    const todos = [];
    orders.forEach(function (o) {
      if (o.status === '待生产') todos.push({ tag: '待生产', color: 'blue', txt: '订单 ' + o.orderNo + ' 待安排生产', go: 'orders', s: o.orderNo });
      if (o.status === '待安装') todos.push({ tag: '待安装', color: 'cyan', txt: '订单 ' + o.orderNo + ' 待安排安装', go: 'productions', tab: 'installations', s: o.orderNo });
    });

    const todoHtml = todos.length
      ? todos.slice(0, 8).map(function (t) {
          return '<a class="stat-row" style="display:flex;align-items:center;cursor:pointer;text-decoration:none" data-go="' + t.go + '" data-s="' + App.escapeHtml(t.s) + '"' + (t.tab ? ' data-tab="' + t.tab + '"' : '') + '>' +
            App.badge(t.tag, t.color) + '<span style="margin-left:8px;flex:1">' + App.escapeHtml(t.txt) + '</span>' +
            '<span class="muted">›</span></a>';
        }).join('')
      : '<div class="muted small">暂无待办事项 🎉</div>';

    /* 最近订单 */
    const recentOrders = orders.slice().sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); }).slice(0, 8);
    const recentOrderHtml = recentOrders.length
      ? '<table class="tbl"><thead><tr><th>订单号</th><th>客户</th><th>状态</th><th class="num">金额</th><th class="num">日期</th></tr></thead><tbody>' +
        recentOrders.map(function (o) {
          return '<tr><td><a class="link" data-go="orders" data-s="' + App.escapeHtml(o.orderNo) + '">' + App.escapeHtml(o.orderNo) + '</a></td>' +
            '<td>' + App.escapeHtml(o.customerName || '') + '</td><td>' + App.badge(o.status) + '</td>' +
            '<td class="money">' + App.fmtMoney(App.orderTotal(o)) + '</td>' +
            '<td class="num muted">' + App.fmtDate(o.createdAt) + '</td></tr>';
        }).join('') + '</tbody></table>'
      : App.empty('📋', '还没有订单');

    /* 最近财务 */
    const recentFin = finances.slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); }).slice(0, 8);
    const recentFinHtml = recentFin.length
      ? '<table class="tbl"><thead><tr><th>日期</th><th>类型</th><th>类别</th><th>关联</th><th class="num">金额</th></tr></thead><tbody>' +
        recentFin.map(function (f) {
          return '<tr><td class="muted">' + App.fmtDate(f.date) + '</td>' +
            '<td>' + App.badge(f.type, f.type === '收入' ? 'green' : 'red') + '</td>' +
            '<td>' + App.escapeHtml(f.category || '') + '</td>' +
            '<td class="muted">' + App.escapeHtml(f.customerName || f.orderNo || '') + '</td>' +
            '<td class="money">' + App.fmtMoney(f.amount) + '</td></tr>';
        }).join('') + '</tbody></table>'
      : App.empty('💳', '还没有财务记录');

    el.innerHTML =
      '<div class="kpi-grid">' + kpiHtml + '</div>' +
      '<div class="grid-2">' +
        '<div class="card"><div class="card-head"><div class="card-title">⏰ 待办提醒</div></div><div class="card-body" style="padding:8px 18px 14px">' + todoHtml + '</div></div>' +
        '<div class="card"><div class="card-head"><div class="card-title">📋 最近订单</div>' +
          '<a class="link small" data-go="orders">查看全部 ›</a></div><div class="card-body no-pad"><div class="table-wrap">' + recentOrderHtml + '</div></div></div>' +
      '</div>' +
      '<div style="height:16px"></div>' +
      '<div class="card"><div class="card-head"><div class="card-title">💳 最近财务</div>' +
        '<a class="link small" data-go="finance">查看全部 ›</a></div><div class="card-body no-pad"><div class="table-wrap">' + recentFinHtml + '</div></div></div>';

    el.querySelectorAll('[data-go]').forEach(function (a) {
      a.addEventListener('click', function () {
        App.go(a.getAttribute('data-go'), a.getAttribute('data-s'));
      });
    });
  }
})();
