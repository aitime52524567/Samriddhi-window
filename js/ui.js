/* ===================== UI 组件 ===================== */
window.App = window.App || {};

(function () {
  const App = window.App;

  /* ---------- 业务配置 ---------- */
  App.STATUS_COLOR = {
    '待生产': 'blue', '生产中': 'purple',
    '待安装': 'cyan', '安装中': 'cyan', '待验收': 'amber', '已完成': 'green',
    '已取消': 'gray', '已排单': 'cyan', '已验收': 'green', '已收款': 'green',
    '已交付': 'green'
  };

  App.DEFAULT_SETTINGS = {
    companyName: '昇丽迪门窗',
    phone: '',
    productTypes: ['平开窗', '推拉窗', '平开门', '推拉门', '阳光房', '折叠门', '纱窗'],
    materialTypes: ['断桥铝', '普通铝合金', '塑钢', '实木', '铝木复合'],
    glassTypes: ['单玻', '中空玻璃', '钢化玻璃', '夹胶玻璃', 'Low-E玻璃'],
    colorTypes: ['白色', '香槟金', '灰色', '咖啡色', '黑色', '木纹'],
    paymentMethods: ['现金', '微信', '支付宝', '银行转账', 'POS刷卡'],
    financeCategories: ['定金', '尾款', '全款', '材料采购', '人工费', '运输费', '设备', '其他'],
    orderStatuses: ['待生产', '生产中', '待安装', '安装中', '待验收', '已完成', '已取消']
  };

  App.settings = function () {
    const list = App.DB.getAll('settings');
    const stored = list.find(function (s) { return s.id === 'main'; }) || {};
    const merged = Object.assign({}, App.DEFAULT_SETTINGS, stored);
    // 已废弃的订单状态，从状态列表中剔除（兼容旧数据）
    merged.orderStatuses = (merged.orderStatuses || []).filter(function (st) {
      return st !== '待量尺' && st !== '待报价';
    });
    return merged;
  };

  App.saveSettings = async function (patch) {
    const cur = App.settings();
    const merged = Object.assign({}, cur, patch);
    merged.id = 'main';
    merged.updatedAt = App.now();
    if (!merged.createdAt) merged.createdAt = App.now();
    await App.DB.put('settings', merged);
  };

  /* ---------- Toast ---------- */
  App.toast = function (msg, type) {
    const root = document.getElementById('toast-root');
    const el = document.createElement('div');
    el.className = 'toast ' + (type || '');
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warn' ? '⚠' : 'ℹ';
    el.innerHTML = '<span>' + icon + '</span><span>' + App.escapeHtml(msg) + '</span>';
    root.appendChild(el);
    setTimeout(function () {
      el.style.opacity = '0';
      el.style.transition = 'opacity .25s';
      setTimeout(function () { el.remove(); }, 260);
    }, 2600);
  };

  /* ---------- Badge ---------- */
  App.badge = function (text, color) {
    const c = color || App.STATUS_COLOR[text] || 'gray';
    return '<span class="badge badge-' + c + '">' + App.escapeHtml(text) + '</span>';
  };

  /* ---------- Modal ---------- */
  App.modal = function (opts) {
    const root = document.getElementById('modal-root');
    const mask = document.createElement('div');
    mask.className = 'modal-mask';
    const size = opts.size ? ' modal-' + opts.size : '';
    mask.innerHTML =
      '<div class="modal' + size + '">' +
        '<div class="modal-head">' +
          '<div class="modal-title">' + (opts.title || '') + '</div>' +
          '<button class="modal-close" data-close="1">×</button>' +
        '</div>' +
        '<div class="modal-body">' + (opts.body || '') + '</div>' +
        (opts.footer !== false
          ? '<div class="modal-foot">' +
              '<button class="btn btn-outline" data-close="1">取消</button>' +
              '<button class="btn btn-primary" data-ok="1">' + (opts.okText || '保存') + '</button>' +
            '</div>'
          : '') +
      '</div>';
    root.appendChild(mask);

    const close = function () { mask.remove(); };
    mask.addEventListener('click', async function (e) {
      if (e.target === mask) { close(); return; }
      if (e.target.hasAttribute && e.target.hasAttribute('data-close')) { close(); return; }
      if (e.target.hasAttribute && e.target.hasAttribute('data-ok')) {
        if (opts.onOk) {
          let r;
          try {
            r = await opts.onOk(mask);
          } catch (err) {
            console.error(err);
            App.toast('操作出错：' + (err && err.message ? err.message : err), 'error');
            return;
          }
          if (r === false) return;
        }
        close();
      }
    });
    if (opts.onMount) opts.onMount(mask);
    return { el: mask, close: close };
  };

  /* ---------- Confirm ---------- */
  App.confirm = function (msg, onOk, okText) {
    App.modal({
      title: '确认操作',
      size: 'sm',
      body: '<p style="font-size:14px;color:#334155">' + App.escapeHtml(msg) + '</p>',
      okText: okText || '确定',
      onOk: function () { onOk && onOk(); }
    });
  };

  /* ---------- Empty state ---------- */
  App.empty = function (icon, title, sub, actionHTML) {
    return '<div class="empty">' +
      '<div class="empty-icon">' + (icon || '📄') + '</div>' +
      '<div class="empty-title">' + App.escapeHtml(title || '暂无数据') + '</div>' +
      (sub ? '<div class="muted small">' + App.escapeHtml(sub) + '</div>' : '') +
      (actionHTML ? '<div style="margin-top:14px">' + actionHTML + '</div>' : '') +
      '</div>';
  };

  /* ---------- 列表渲染辅助 ---------- */
  App.renderTable = function (headers, rowsHtml, emptyHtml) {
    if (!rowsHtml) {
      return '<div class="card"><div class="card-body">' + (emptyHtml || App.empty('📄', '暂无数据')) + '</div></div>';
    }
    const ths = headers.map(function (h) {
      const cls = h.align === 'right' ? ' class="num"' : '';
      return '<th' + cls + '>' + h.label + '</th>';
    }).join('');
    return '<div class="card"><div class="table-wrap">' +
      '<table class="tbl"><thead><tr>' + ths + '</tr></thead><tbody>' + rowsHtml + '</tbody></table>' +
      '</div></div>';
  };

  /* ---------- 订单金额辅助 ---------- */
  App.orderTotal = function (o) {
    if (o && o.totalAmount !== undefined && o.totalAmount !== null) return App.num(o.totalAmount);
    if (!o || !o.items) return 0;
    return o.items.reduce(function (s, it) { return s + App.num(it.amount); }, 0);
  };

  App.orderReceived = function (orderId) {
    const o = App.DB.get('orders', orderId);
    if (o && o.receivedAmount !== undefined && o.receivedAmount !== null) return App.num(o.receivedAmount);
    const fs = App.DB.getAll('finances');
    return fs.filter(function (f) { return f.orderId === orderId && f.type === '收入'; })
      .reduce(function (s, f) { return s + App.num(f.amount); }, 0);
  };

  App.orderBalance = function (o) {
    return App.orderTotal(o) - App.orderReceived(o.id);
  };

  App.orderPaid = function (orderId) {
    const o = App.DB.get('orders', orderId);
    if (o && o.paidAmount !== undefined && o.paidAmount !== null) return App.num(o.paidAmount);
    const fs = App.DB.getAll('finances');
    return fs.filter(function (f) { return f.orderId === orderId && f.type === '支出'; })
      .reduce(function (s, f) { return s + App.num(f.amount); }, 0);
  };

  App.orderPendingPay = function (o) {
    return App.orderCost(o) - App.orderPaid(o.id);
  };

  App.orderMaterialFee = function (o) {
    if (o && o.materialCost !== undefined && o.materialCost !== null) return App.num(o.materialCost);
    // 兼容旧数据：仅有 cost 字段时，视作材料费
    if (o && o.cost !== undefined && o.cost !== null &&
        (o.materialCost === undefined || o.materialCost === null) &&
        (o.transportCost === undefined || o.transportCost === null) &&
        (o.installLabor === undefined || o.installLabor === null)) {
      return App.num(o.cost);
    }
    return 0;
  };

  App.orderMaterialTax = function (o) {
    if (o && o.materialTax !== undefined && o.materialTax !== null) return App.num(o.materialTax);
    // 兼容旧数据：仅有 tax 字段时，视作材料税收
    if (o && o.tax !== undefined && o.tax !== null &&
        (o.materialTax === undefined || o.materialTax === null) &&
        (o.laborTax === undefined || o.laborTax === null)) {
      return App.num(o.tax);
    }
    return 0;
  };

  App.orderTransportFee = function (o) {
    return (o && o.transportCost !== undefined && o.transportCost !== null) ? App.num(o.transportCost) : 0;
  };

  App.orderTransportTax = function (o) {
    return (o && o.transportTax !== undefined && o.transportTax !== null) ? App.num(o.transportTax) : 0;
  };

  App.orderInstallFee = function (o) {
    return (o && o.installLabor !== undefined && o.installLabor !== null) ? App.num(o.installLabor) : 0;
  };

  App.orderLaborTax = function (o) {
    return (o && o.laborTax !== undefined && o.laborTax !== null) ? App.num(o.laborTax) : 0;
  };

  // 各项成本（含税）= 费用 + 税收
  App.orderMaterialCost = function (o) {
    return App.orderMaterialFee(o) + App.orderMaterialTax(o);
  };

  App.orderTransportCost = function (o) {
    return App.orderTransportFee(o) + App.orderTransportTax(o);
  };

  App.orderInstallCost = function (o) {
    return App.orderInstallFee(o) + App.orderLaborTax(o);
  };

  App.orderAuxFee = function (o) {
    return (o && o.auxCost !== undefined && o.auxCost !== null) ? App.num(o.auxCost) : 0;
  };

  App.orderAuxTax = function (o) {
    return (o && o.auxTax !== undefined && o.auxTax !== null) ? App.num(o.auxTax) : 0;
  };

  App.orderAuxCost = function (o) {
    return App.orderAuxFee(o) + App.orderAuxTax(o);
  };

  App.orderManagementRate = function (o) {
    return (o && o.managementRate !== undefined && o.managementRate !== null && o.managementRate !== '') ? App.num(o.managementRate) : 5;
  };

  App.orderManagementFee = function (o) {
    return App.orderTotal(o) * App.orderManagementRate(o) / 100;
  };

  App.orderCost = function (o) {
    return App.orderManagementFee(o) + App.orderMaterialCost(o) + App.orderTransportCost(o) + App.orderInstallCost(o) + App.orderAuxCost(o);
  };

  App.orderProfit = function (o) {
    return App.orderTotal(o) - App.orderCost(o);
  };

  App.orderChannelCompany = function (o) {
    return (o && o.channelCompany) ? o.channelCompany : '';
  };

  App.orderChannelFee = function (o) {
    return (o && o.channelFee !== undefined && o.channelFee !== null) ? App.num(o.channelFee) : 0;
  };

  App.orderChannelRate = function (o) {
    return (o && o.channelRate !== undefined && o.channelRate !== null && o.channelRate !== '') ? App.num(o.channelRate) : 6;
  };

  // 利润 = 毛利润 × (1 − 税率%)
  App.orderNetProfit = function (o) {
    return App.orderProfit(o) * (1 - App.orderChannelRate(o) / 100);
  };

  // 现金利润 = 利润（通道费不再从利润中扣除）
  App.orderCashProfit = function (o) {
    return App.orderNetProfit(o);
  };

  App.orderTax = function (o) {
    return App.orderMaterialTax(o) + App.orderTransportTax(o) + App.orderLaborTax(o) + App.orderAuxTax(o);
  };

  // 税率（%）：默认材料 8%、运输 9%、人工 3.5%；已有税率则读取，否则按费用/税收反推，再退回默认
  App.orderMaterialTaxRate = function (o) {
    if (o && o.materialTaxRate !== undefined && o.materialTaxRate !== null && o.materialTaxRate !== '') return App.num(o.materialTaxRate);
    const fee = App.orderMaterialFee(o);
    const tax = App.orderMaterialTax(o);
    if (fee > 0 && tax > 0) return Math.round(tax / fee * 10000) / 100;
    return 8;
  };

  App.orderTransportTaxRate = function (o) {
    if (o && o.transportTaxRate !== undefined && o.transportTaxRate !== null && o.transportTaxRate !== '') return App.num(o.transportTaxRate);
    const fee = App.orderTransportFee(o);
    const tax = App.orderTransportTax(o);
    if (fee > 0 && tax > 0) return Math.round(tax / fee * 10000) / 100;
    return 9;
  };

  App.orderLaborTaxRate = function (o) {
    if (o && o.laborTaxRate !== undefined && o.laborTaxRate !== null && o.laborTaxRate !== '') return App.num(o.laborTaxRate);
    const fee = App.orderInstallFee(o);
    const tax = App.orderLaborTax(o);
    if (fee > 0 && tax > 0) return Math.round(tax / fee * 10000) / 100;
    return 3.5;
  };

  App.orderAuxTaxRate = function (o) {
    if (o && o.auxTaxRate !== undefined && o.auxTaxRate !== null && o.auxTaxRate !== '') return App.num(o.auxTaxRate);
    const fee = App.orderAuxFee(o);
    const tax = App.orderAuxTax(o);
    if (fee > 0 && tax > 0) return Math.round(tax / fee * 10000) / 100;
    return 8;
  };

  App.productionPaid = function (productionId) {
    const fs = App.DB.getAll('finances');
    return fs.filter(function (f) { return f.productionId === productionId && f.type === '支出'; })
      .reduce(function (s, f) { return s + App.num(f.amount); }, 0);
  };

  App.customerOptions = function (selectedId, includeEmpty) {
    const cs = App.DB.getAll('customers').slice().sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'zh'); });
    let html = includeEmpty ? '<option value="">— 选择客户 —</option>' : '';
    html += cs.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === selectedId ? ' selected' : '') + '>' + App.escapeHtml(c.name + (c.phone ? '（' + c.phone + '）' : '')) + '</option>';
    }).join('');
    return html;
  };

  // 客户选择字段：下拉框 + 「从客户库选取」按钮
  App.customerField = function (selectedId, selectId) {
    selectId = selectId || 'f-customer';
    return '<div class="customer-picker">' +
      '<select class="select" id="' + selectId + '">' + App.customerOptions(selectedId, true) + '</select>' +
      '<button type="button" class="btn btn-outline" data-pick-customer="' + selectId + '">🔍 选取</button>' +
      '</div>';
  };

  // 从客户库选取：弹出客户列表，支持搜索，选中后回填到目标 select
  App.chooseCustomer = function (targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const selectedId = target.value;
    let q = '';

    function renderList(mask) {
      const kw = q.trim().toLowerCase();
      const cs = App.DB.getAll('customers').filter(function (c) {
        if (!kw) return true;
        return [c.name, c.phone, c.tel2, c.address, c.source].some(function (f) {
          return String(f || '').toLowerCase().indexOf(kw) >= 0;
        });
      }).sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'zh'); });

      const listEl = mask.querySelector('#cc-list');
      if (!cs.length) {
        listEl.innerHTML = App.empty('👥', '没有匹配的客户', '可先到客户管理新增');
        return;
      }
      listEl.innerHTML = cs.map(function (c) {
        const sel = c.id === selectedId ? ' style="background:var(--primary-light)"' : '';
        return '<div class="cc-row" data-id="' + c.id + '"' + sel + '>' +
          '<div class="cc-name">' + App.escapeHtml(c.name) + (c.id === selectedId ? ' <span class="badge badge-blue">当前</span>' : '') + '</div>' +
          '<div class="cc-meta muted small">' + App.escapeHtml(c.phone || '') + ' · ' + App.escapeHtml(c.address || '') + '</div>' +
          '<button type="button" class="btn btn-sm btn-primary">选取</button>' +
          '</div>';
      }).join('');
    }

    App.modal({
      title: '从客户库选取',
      size: 'md',
      footer: false,
      body:
        '<input class="input" id="cc-search" placeholder="搜索姓名 / 电话 / 地址…">' +
        '<div class="muted small" style="margin:8px 0">共 ' + App.DB.getAll('customers').length + ' 位客户，点击「选取」或整行选中</div>' +
        '<div id="cc-list" style="margin-top:8px;max-height:52vh;overflow-y:auto"></div>',
      onMount: function (mask) {
        renderList(mask);
        const s = mask.querySelector('#cc-search');
        s.focus();
        s.addEventListener('input', function (e) { q = e.target.value; renderList(mask); });
        mask.querySelector('#cc-list').addEventListener('click', function (e) {
          const row = e.target.closest('[data-id]');
          if (!row) return;
          target.value = row.getAttribute('data-id');
          try { target.dispatchEvent(new Event('change', { bubbles: true })); } catch (err) {}
          App.toast('已选择客户', 'success');
          mask.remove();
        });
      }
    });
  };

  App.selectOptions = function (list, selected, includeEmpty) {
    let html = includeEmpty ? '<option value="">—</option>' : '';
    html += (list || []).map(function (s) {
      return '<option value="' + App.escapeHtml(s) + '"' + (s === selected ? ' selected' : '') + '>' + App.escapeHtml(s) + '</option>';
    }).join('');
    return html;
  };

  App.actionBtns = function (buttons) {
    return '<div class="cell-actions">' + buttons.map(function (b) {
      const cls = 'btn btn-sm ' + (b.cls || 'btn-outline');
      const data = Object.keys(b.data || {}).map(function (k) {
        return ' data-' + k + '="' + App.escapeHtml(b.data[k]) + '"';
      }).join('');
      return '<button class="' + cls + '" ' + data + '>' + App.escapeHtml(b.label) + '</button>';
    }).join('') + '</div>';
  };

  // 全局：点击「从客户库选取」按钮
  document.addEventListener('click', function (e) {
    const btn = e.target.closest && e.target.closest('[data-pick-customer]');
    if (btn) App.chooseCustomer(btn.getAttribute('data-pick-customer'));
  });
})();
