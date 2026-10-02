/* ===================== 量尺管理（并入项目跟踪模块） ===================== */
(function () {
  const App = window.App;

  let filter = '';

  // 由「项目跟踪」模块调用，作为其「量尺管理」标签页
  App.renderMeasurements = render;

  function render(el) {
    if (App.pendingSearch) { filter = App.pendingSearch; App.pendingSearch = null; }
    const q = filter.trim().toLowerCase();

    const list = App.DB.getAll('measurements').filter(function (m) {
      if (!q) return true;
      return [m.customerName, m.measurer, m.address].some(function (f) {
        return String(f || '').toLowerCase().indexOf(q) >= 0;
      });
    }).sort(function (a, b) { return (b.measureDate || '').localeCompare(a.measureDate || ''); });

    const rows = list.map(function (m) {
      const itemCount = (m.items || []).length;
      return '<tr>' +
        '<td class="muted">' + App.fmtDate(m.measureDate) + '</td>' +
        '<td><a class="link" data-act="detail" data-id="' + m.id + '">' + App.escapeHtml(m.customerName || '') + '</a></td>' +
        '<td class="muted">' + App.escapeHtml(m.measurer || '') + '</td>' +
        '<td class="num">' + itemCount + '</td>' +
        '<td class="muted small">' + App.escapeHtml(m.address || '') + '</td>' +
        '<td>' + App.actionBtns([
          { label: '转订单', cls: 'btn-outline', data: { act: 'toOrder', id: m.id } },
          { label: '编辑', cls: 'btn-outline', data: { act: 'edit', id: m.id } },
          { label: '删除', cls: 'btn-outline', data: { act: 'del', id: m.id } }
        ]) + '</td></tr>';
    }).join('');

    el.innerHTML =
      '<div class="toolbar">' +
        '<input class="input" style="width:260px" placeholder="搜索客户 / 量尺人" id="search" value="' + App.escapeHtml(filter) + '">' +
        '<span class="spacer"></span>' +
        '<button class="btn btn-primary" id="add">＋ 新增量尺</button>' +
      '</div>' +
      (rows
        ? '<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr>' +
          '<th>量尺日期</th><th>客户</th><th>量尺人</th><th class="num">尺寸项</th><th>地址</th><th></th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div></div>'
        : App.empty('📐', '还没有量尺记录', '点击「新增量尺」记录上门测量数据'));

    bind(el);
  }

  function bind(el) {
    el.querySelector('#search').addEventListener('input', App.debounce(function (e) {
      filter = e.target.value; render(el);
    }, 250));
    el.querySelector('#add').addEventListener('click', function () { openForm(el, null); });
    el.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const act = btn.getAttribute('data-act');
        const id = btn.getAttribute('data-id');
        if (act === 'edit') openForm(el, id);
        else if (act === 'del') del(id, el);
        else if (act === 'detail') detail(id);
        else if (act === 'toOrder') toOrder(id);
      });
    });
  }

  function itemsHtml(items) {
    items = items || [];
    const rows = items.map(function (it, i) {
      return '<tr>' +
        '<td><input class="input" data-f="name" value="' + App.escapeHtml(it.name || '') + '" placeholder="如：客厅窗"></td>' +
        '<td><input class="input num" data-f="width" value="' + (it.width || '') + '" placeholder="宽(mm)"></td>' +
        '<td><input class="input num" data-f="height" value="' + (it.height || '') + '" placeholder="高(mm)"></td>' +
        '<td><input class="input num" data-f="qty" value="' + (it.qty || 1) + '"></td>' +
        '<td><input class="input" data-f="note" value="' + App.escapeHtml(it.note || '') + '"></td>' +
        '<td class="del-cell"><button class="btn btn-sm btn-outline" data-rm="1">✕</button></td>' +
        '</tr>';
    }).join('');
    return '<table class="mini-table"><thead><tr><th>位置/名称</th><th>宽(mm)</th><th>高(mm)</th><th>数量</th><th>备注</th><th></th></tr></thead>' +
      '<tbody id="item-body">' + (rows || '') + '</tbody></table>';
  }

  function openForm(el, id) {
    const m = id ? App.DB.get('measurements', id) : null;
    const body =
      '<div class="form-grid">' +
        '<div class="field"><label>客户 <span class="req">*</span></label>' + App.customerField(m ? m.customerId : null) + '</div>' +
        '<div class="field"><label>量尺日期</label><input type="date" class="input" id="f-date" value="' + (m ? m.measureDate : App.today()) + '"></div>' +
        '<div class="field"><label>量尺人</label><input class="input" id="f-measurer" value="' + App.escapeHtml(m ? m.measurer : '') + '"></div>' +
        '<div class="field"><label>联系电话</label><input class="input" id="f-phone" value="' + App.escapeHtml(m ? m.phone : '') + '"></div>' +
        '<div class="field full"><label>量尺地址</label><input class="input" id="f-address" value="' + App.escapeHtml(m ? m.address : '') + '"></div>' +
        '<div class="field full"><label>尺寸明细</label>' + itemsHtml(m ? m.items : []) +
          '<button class="btn btn-outline btn-sm" id="add-row" style="margin-top:8px">＋ 添加一行</button></div>' +
        '<div class="field full"><label>备注</label><textarea class="textarea" id="f-remark">' + App.escapeHtml(m ? m.remark : '') + '</textarea></div>' +
      '</div>';

    App.modal({
      title: m ? '编辑量尺记录' : '新增量尺记录',
      size: 'lg',
      body: body,
      onOk: async function () {
        const customerId = document.getElementById('f-customer').value;
        if (!customerId) { App.toast('请选择客户', 'error'); return false; }
        const cust = App.DB.get('customers', customerId);
        const items = [];
        document.querySelectorAll('#item-body tr').forEach(function (tr) {
          const name = tr.querySelector('[data-f="name"]').value.trim();
          if (!name) return;
          items.push({
            name: name,
            width: App.num(tr.querySelector('[data-f="width"]').value),
            height: App.num(tr.querySelector('[data-f="height"]').value),
            qty: App.num(tr.querySelector('[data-f="qty"]').value) || 1,
            note: tr.querySelector('[data-f="note"]').value.trim()
          });
        });
        const rec = {
          id: m ? m.id : undefined,
          customerId: customerId,
          customerName: cust ? cust.name : '',
          measureDate: document.getElementById('f-date').value,
          measurer: document.getElementById('f-measurer').value.trim(),
          phone: document.getElementById('f-phone').value.trim(),
          address: document.getElementById('f-address').value.trim(),
          items: items,
          remark: document.getElementById('f-remark').value.trim(),
          createdAt: m ? m.createdAt : App.now()
        };
        await App.DB.put('measurements', rec);
        App.toast(m ? '已更新' : '已新增', 'success');
        render(el);
      },
      onMount: function (mask) {
        mask.querySelector('#add-row').addEventListener('click', function () {
          const tr = document.createElement('tr');
          tr.innerHTML =
            '<td><input class="input" data-f="name" placeholder="如：客厅窗"></td>' +
            '<td><input class="input num" data-f="width" placeholder="宽(mm)"></td>' +
            '<td><input class="input num" data-f="height" placeholder="高(mm)"></td>' +
            '<td><input class="input num" data-f="qty" value="1"></td>' +
            '<td><input class="input" data-f="note"></td>' +
            '<td class="del-cell"><button class="btn btn-sm btn-outline" data-rm="1">✕</button></td>';
          mask.querySelector('#item-body').appendChild(tr);
        });
        mask.querySelector('#item-body').addEventListener('click', function (e) {
          if (e.target.hasAttribute && e.target.hasAttribute('data-rm')) {
            e.target.closest('tr').remove();
          }
        });
        if (!m || !(m.items && m.items.length)) {
          const tr = document.createElement('tr');
          tr.innerHTML =
            '<td><input class="input" data-f="name" placeholder="如：客厅窗"></td>' +
            '<td><input class="input num" data-f="width" placeholder="宽(mm)"></td>' +
            '<td><input class="input num" data-f="height" placeholder="高(mm)"></td>' +
            '<td><input class="input num" data-f="qty" value="1"></td>' +
            '<td><input class="input" data-f="note"></td>' +
            '<td class="del-cell"><button class="btn btn-sm btn-outline" data-rm="1">✕</button></td>';
          mask.querySelector('#item-body').appendChild(tr);
        }
      }
    });
  }

  function del(id, el) {
    App.confirm('确定删除这条量尺记录吗？', async function () {
      await App.DB.remove('measurements', id);
      App.toast('已删除', 'success');
      render(el);
    }, '删除');
  }

  function detail(id) {
    const m = App.DB.get('measurements', id);
    if (!m) return;
    const itemRows = (m.items || []).map(function (it) {
      return '<tr><td>' + App.escapeHtml(it.name) + '</td><td class="num">' + App.fmtNum(it.width) + '</td>' +
        '<td class="num">' + App.fmtNum(it.height) + '</td><td class="num">' + App.fmtNum(it.qty) + '</td>' +
        '<td class="muted">' + App.escapeHtml(it.note || '') + '</td></tr>';
    }).join('');
    App.modal({
      title: '量尺详情',
      size: 'lg',
      footer: false,
      body:
        '<div class="grid-2">' +
          '<div class="stat-row"><span class="k">客户</span><span class="v">' + App.escapeHtml(m.customerName) + '</span></div>' +
          '<div class="stat-row"><span class="k">量尺日期</span><span class="v">' + App.fmtDate(m.measureDate) + '</span></div>' +
          '<div class="stat-row"><span class="k">量尺人</span><span class="v">' + App.escapeHtml(m.measurer || '') + '</span></div>' +
          '<div class="stat-row"><span class="k">地址</span><span class="v">' + App.escapeHtml(m.address || '') + '</span></div>' +
        '</div>' +
        '<div class="section-title">尺寸明细</div>' +
        (itemRows ? '<div class="table-wrap"><table class="tbl"><thead><tr><th>位置/名称</th><th class="num">宽(mm)</th><th class="num">高(mm)</th><th class="num">数量</th><th>备注</th></tr></thead><tbody>' + itemRows + '</tbody></table></div>' : '<div class="muted small">无明细</div>') +
        (m.remark ? '<div class="section-title">备注</div><div class="muted">' + App.escapeHtml(m.remark) + '</div>' : '')
    });
  }

  function toOrder(id) {
    const m = App.DB.get('measurements', id);
    if (!m) return;
    if (typeof App.openNewOrder === 'function') {
      App.openNewOrder({
        customerId: m.customerId,
        address: m.address,
        items: (m.items || []).map(function (it) {
          return { productType: it.name, width: it.width, height: it.height, qty: it.qty, material: '', glass: '', color: '', priceMode: '按㎡', unitPrice: 0, amount: 0, remark: it.note || '' };
        })
      });
    } else {
      App.go('orders');
    }
  }
})();
