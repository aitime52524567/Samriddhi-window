/* ===================== 客户管理 ===================== */
(function () {
  const App = window.App;

  let filter = '';

  App.registerModule({
    id: 'customers',
    title: '客户管理',
    icon: 'customers',
    render: render
  });

  function render(el) {
    if (App.pendingSearch) { filter = App.pendingSearch; App.pendingSearch = null; }
    const q = filter.trim().toLowerCase();

    const customers = App.DB.getAll('customers').filter(function (c) {
      if (!q) return true;
      return [c.name, c.phone, c.tel2, c.address, c.source].some(function (f) {
        return String(f || '').toLowerCase().indexOf(q) >= 0;
      });
    }).sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });

    const rows = customers.map(function (c) {
      const orders = App.DB.getAll('orders').filter(function (o) { return o.customerId === c.id; });
      const total = orders.reduce(function (s, o) { return s + App.orderTotal(o); }, 0);
      const lastFollow = lastFollowOf(c.id);
      const due = pendingFollow(c.id);
      return '<tr>' +
        '<td><a class="link" data-act="detail" data-id="' + c.id + '">' + App.escapeHtml(c.name) + '</a>' + (due ? ' ' + App.badge('待跟进', 'red') : '') + '</td>' +
        '<td class="muted">' + App.escapeHtml(c.phone || '') + '</td>' +
        '<td class="muted small">' + App.escapeHtml(c.address || '') + '</td>' +
        '<td class="muted">' + App.escapeHtml(c.source || '') + '</td>' +
        '<td class="num muted small">' + (lastFollow ? App.fmtDate(lastFollow.date) : '—') + '</td>' +
        '<td class="num">' + orders.length + '</td>' +
        '<td class="money">' + App.fmtMoney(total) + '</td>' +
        '<td>' + App.actionBtns([
          { label: '跟进', cls: 'btn-outline', data: { act: 'follow', id: c.id } },
          { label: '编辑', cls: 'btn-outline', data: { act: 'edit', id: c.id } },
          { label: '删除', cls: 'btn-outline', data: { act: 'del', id: c.id } }
        ]) + '</td></tr>';
    }).join('');

    el.innerHTML =
      '<div class="toolbar">' +
        '<input class="input" style="width:260px" placeholder="搜索客户 / 电话 / 地址" id="search" value="' + App.escapeHtml(filter) + '">' +
        '<span class="spacer"></span>' +
        '<button class="btn btn-outline" id="export">导出</button>' +
        '<button class="btn btn-primary" id="add">＋ 新增客户</button>' +
      '</div>' +
      (rows
        ? '<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr>' +
          '<th>客户姓名</th><th>电话</th><th>地址</th><th>来源</th><th class="num">最近跟进</th><th class="num">订单数</th><th class="num">累计金额</th><th></th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div></div>'
        : App.empty('👥', '还没有客户', '点击右上角「新增客户」开始录入'));

    bind(el);
  }

  function bind(el) {
    el.querySelector('#search').addEventListener('input', App.debounce(function (e) {
      filter = e.target.value;
      render(el);
    }, 250));

    el.querySelector('#add').addEventListener('click', function () { openForm(el, null); });
    el.querySelector('#export').addEventListener('click', exportCSV);

    el.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const act = btn.getAttribute('data-act');
        const id = btn.getAttribute('data-id');
        if (act === 'edit') openForm(el, id);
        else if (act === 'del') del(id, el);
        else if (act === 'detail') detail(id);
        else if (act === 'follow') openFollowForm(id, function () { render(el); });
      });
    });
  }

  function openForm(el, id) {
    const c = id ? App.DB.get('customers', id) : null;
    const body =
      '<div class="form-grid">' +
        '<div class="field full"><label>客户姓名 <span class="req">*</span></label><input class="input" id="f-name" value="' + App.escapeHtml(c ? c.name : '') + '"></div>' +
        '<div class="field"><label>手机号码</label><input class="input" id="f-phone" value="' + App.escapeHtml(c ? c.phone : '') + '"></div>' +
        '<div class="field"><label>备用电话</label><input class="input" id="f-tel2" value="' + App.escapeHtml(c ? c.tel2 : '') + '"></div>' +
        '<div class="field full"><label>安装地址</label><input class="input" id="f-address" value="' + App.escapeHtml(c ? c.address : '') + '"></div>' +
        '<div class="field"><label>客户来源</label><select class="select" id="f-source">' +
          ['', '朋友介绍', '老客户', '门店', '网络', '小区推广', '其他'].map(function (s) {
            return '<option' + ((c && c.source === s) ? ' selected' : '') + '>' + s + '</option>';
          }).join('') + '</select></div>' +
        '<div class="field"><label>客户类型</label><select class="select" id="f-type">' +
          ['零售', '工程', '批发', '其他'].map(function (s) {
            return '<option' + ((c && c.type === s) ? ' selected' : '') + '>' + s + '</option>';
          }).join('') + '</select></div>' +
        '<div class="field full"><label>备注</label><textarea class="textarea" id="f-remark">' + App.escapeHtml(c ? c.remark : '') + '</textarea></div>' +
      '</div>';

    App.modal({
      title: c ? '编辑客户' : '新增客户',
      body: body,
      onOk: async function () {
        const name = document.getElementById('f-name').value.trim();
        if (!name) { App.toast('请填写客户姓名', 'error'); return false; }
        const rec = {
          id: c ? c.id : undefined,
          name: name,
          phone: document.getElementById('f-phone').value.trim(),
          tel2: document.getElementById('f-tel2').value.trim(),
          address: document.getElementById('f-address').value.trim(),
          source: document.getElementById('f-source').value,
          type: document.getElementById('f-type').value,
          remark: document.getElementById('f-remark').value.trim(),
          createdAt: c ? c.createdAt : App.now()
        };
        await App.DB.put('customers', rec);
        App.toast(c ? '已更新' : '已新增', 'success');
        render(el);
      }
    });
  }

  /* ---------- 跟进记录 ---------- */
  function lastFollowOf(customerId) {
    const list = App.DB.getAll('follows').filter(function (f) { return f.customerId === customerId && !f.projectId; });
    if (!list.length) return null;
    return list.slice().sort(function (a, b) {
      return (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || '');
    })[0];
  }

  function pendingFollow(customerId) {
    const lf = lastFollowOf(customerId);
    return !!(lf && lf.nextDate && lf.nextDate <= App.today());
  }

  function followItem(f) {
    return '<div class="follow-item">' +
      '<div class="follow-head">' + App.badge(f.method || '其他', 'blue') +
        '<span class="muted small">' + App.fmtDate(f.date) + '</span>' +
        (f.nextDate ? '<span class="muted small">下次跟进：' + App.fmtDate(f.nextDate) + '</span>' : '') +
      '</div>' +
      '<div class="follow-content">' + App.escapeHtml(f.content) + '</div>' +
    '</div>';
  }

  function openFollowForm(customerId, onDone) {
    const c = App.DB.get('customers', customerId);
    if (!c) return;
    App.modal({
      title: '新增跟进 · ' + c.name,
      body:
        '<div class="form-grid">' +
          '<div class="field"><label>跟进日期</label><input type="date" class="input" id="fw-date" value="' + App.today() + '"></div>' +
          '<div class="field"><label>跟进方式</label><select class="select" id="fw-method">' + App.selectOptions(['电话', '微信', '上门', '短信', '其他'], '电话') + '</select></div>' +
          '<div class="field full"><label>跟进内容 <span class="req">*</span></label><textarea class="textarea" id="fw-content" placeholder="记录沟通内容、客户需求、报价意向等"></textarea></div>' +
          '<div class="field"><label>下次跟进日期</label><input type="date" class="input" id="fw-next" value=""></div>' +
        '</div>',
      okText: '保存跟进',
      onOk: async function () {
        const content = document.getElementById('fw-content').value.trim();
        if (!content) { App.toast('请填写跟进内容', 'error'); return false; }
        await App.DB.put('follows', {
          id: undefined,
          customerId: customerId,
          customerName: c.name,
          date: document.getElementById('fw-date').value,
          method: document.getElementById('fw-method').value,
          content: content,
          nextDate: document.getElementById('fw-next').value,
          createdAt: App.now()
        });
        App.toast('跟进已记录', 'success');
        if (onDone) onDone();
      }
    });
  }

  function del(id, el) {
    const c = App.DB.get('customers', id);
    const orderCount = App.DB.getAll('orders').filter(function (o) { return o.customerId === id; }).length;
    App.confirm('确定删除客户「' + (c ? c.name : '') + '」吗？' +
      (orderCount ? '（该客户下有 ' + orderCount + ' 个订单，订单不会被删除）' : ''),
      async function () {
        await App.DB.remove('customers', id);
        App.toast('已删除', 'success');
        render(el);
      }, '删除');
  }

  function detail(id) {
    const c = App.DB.get('customers', id);
    if (!c) return;
    const orders = App.DB.getAll('orders').filter(function (o) { return o.customerId === id; });
    const fins = App.DB.getAll('finances').filter(function (f) { return f.customerId === id; });
    const follows = App.DB.getAll('follows').filter(function (f) { return f.customerId === id && !f.projectId; })
      .sort(function (a, b) { return (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''); });
    const total = orders.reduce(function (s, o) { return s + App.orderTotal(o); }, 0);
    const received = fins.filter(function (f) { return f.type === '收入'; }).reduce(function (s, f) { return s + App.num(f.amount); }, 0);

    const orderRows = orders.map(function (o) {
      return '<tr><td><a class="link" data-goto="orders" data-s="' + App.escapeHtml(o.orderNo) + '">' + App.escapeHtml(o.orderNo) + '</a></td>' +
        '<td>' + App.badge(o.status) + '</td><td class="money">' + App.fmtMoney(App.orderTotal(o)) + '</td>' +
        '<td class="num muted">' + App.fmtDate(o.createdAt) + '</td></tr>';
    }).join('');

    App.modal({
      title: '客户详情',
      size: 'lg',
      footer: false,
      body:
        '<div class="grid-2">' +
          '<div><div class="section-title">基本信息</div>' +
            '<div class="stat-row"><span class="k">姓名</span><span class="v">' + App.escapeHtml(c.name) + '</span></div>' +
            '<div class="stat-row"><span class="k">电话</span><span class="v">' + App.escapeHtml(c.phone || '') + (c.tel2 ? ' / ' + App.escapeHtml(c.tel2) : '') + '</span></div>' +
            '<div class="stat-row"><span class="k">地址</span><span class="v">' + App.escapeHtml(c.address || '') + '</span></div>' +
            '<div class="stat-row"><span class="k">来源</span><span class="v">' + App.escapeHtml(c.source || '') + '</span></div>' +
            '<div class="stat-row"><span class="k">备注</span><span class="v">' + App.escapeHtml(c.remark || '') + '</span></div>' +
          '</div>' +
          '<div><div class="section-title">交易统计</div>' +
            '<div class="stat-row"><span class="k">订单数</span><span class="v">' + orders.length + ' 单</span></div>' +
            '<div class="stat-row"><span class="k">累计订单额</span><span class="v">' + App.fmtMoney(total) + '</span></div>' +
            '<div class="stat-row"><span class="k">累计回款</span><span class="v">' + App.fmtMoney(received) + '</span></div>' +
            '<div class="stat-row"><span class="k">待回款</span><span class="v">' + App.fmtMoney(total - received) + '</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="section-title">订单记录（' + orders.length + '）</div>' +
        (orderRows ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>订单号</th><th>状态</th><th class="num">金额</th><th class="num">日期</th></tr></thead><tbody>' + orderRows + '</tbody></table></div>' : '<div class="muted small">暂无订单</div>') +
        '<div class="section-title-row">' +
          '<div class="section-title" style="margin:0">跟进记录（' + follows.length + '）</div>' +
          '<button class="btn btn-outline btn-sm" id="btn-add-follow">＋ 新增跟进</button>' +
        '</div>' +
        (follows.length ? follows.map(followItem).join('') : '<div class="muted small">暂无跟进记录，点击「新增跟进」记录沟通情况</div>'),
      onMount: function (mask) {
        mask.querySelector('#btn-add-follow').addEventListener('click', function () {
          openFollowForm(id, function () {
            mask.remove();
            detail(id);
          });
        });
      }
    });
  }

  function exportCSV() {
    const rows = [['客户姓名', '手机号码', '备用电话', '地址', '来源', '类型', '备注', '创建时间']];
    App.DB.getAll('customers').forEach(function (c) {
      rows.push([c.name, c.phone, c.tel2, c.address, c.source, c.type, c.remark, App.fmtDate(c.createdAt)]);
    });
    App.download('客户列表-' + App.today() + '.csv', App.toCSV(rows), 'text/csv;charset=utf-8');
    App.toast('已导出 CSV', 'success');
  }
})();
