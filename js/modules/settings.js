/* ===================== 系统设置 ===================== */
(function () {
  const App = window.App;

  App.registerModule({
    id: 'settings',
    title: '系统设置',
    icon: 'settings',
    render: render
  });

  function render(el) {
    const s = App.settings();

    const listField = function (label, key, hint) {
      return '<div class="field"><label>' + label + '</label>' +
        '<textarea class="textarea" id="set-' + key + '" style="min-height:90px">' +
        App.escapeHtml((s[key] || []).join('\n')) + '</textarea>' +
        '<span class="hint">' + (hint || '每行一个选项') + '</span></div>';
    };

    el.innerHTML =
      '<div class="grid-2">' +
        '<div class="card"><div class="card-head"><div class="card-title">公司信息</div></div><div class="card-body">' +
          '<div class="form-grid">' +
            '<div class="field full"><label>公司名称</label><input class="input" id="set-companyName" value="' + App.escapeHtml(s.companyName) + '"></div>' +
            '<div class="field full"><label>联系电话</label><input class="input" id="set-phone" value="' + App.escapeHtml(s.phone || '') + '"></div>' +
          '</div></div></div>' +

        '<div class="card"><div class="card-head"><div class="card-title">数据管理</div></div><div class="card-body">' +
          '<div style="display:flex;flex-direction:column;gap:10px">' +
            '<p class="muted small">数据保存在当前浏览器本地。可导出备份、或加载示例数据体验功能。</p>' +
            '<button class="btn btn-outline" id="btn-seed">🧪 加载示例数据</button>' +
            '<button class="btn btn-outline" id="btn-backup2">💾 备份 / 恢复</button>' +
            '<button class="btn btn-danger" id="btn-clear">🗑 清空所有数据</button>' +
          '</div></div></div>' +

        '<div class="card"><div class="card-head"><div class="card-title">门窗产品类型</div></div><div class="card-body">' +
          listField('产品类型（每行一个）', 'productTypes', '用于订单明细下拉选择') + '</div></div>' +

        '<div class="card"><div class="card-head"><div class="card-title">材质 / 玻璃 / 颜色</div></div><div class="card-body">' +
          '<div class="form-grid">' +
            listField('材质类型', 'materialTypes') +
            listField('玻璃类型', 'glassTypes') +
            listField('颜色', 'colorTypes') +
          '</div></div></div>' +

        '<div class="card"><div class="card-head"><div class="card-title">财务选项</div></div><div class="card-body">' +
          '<div class="form-grid">' +
            listField('收款类别', 'financeCategories') +
            listField('支付方式', 'paymentMethods') +
            listField('订单状态', 'orderStatuses', '订单流程状态，可自定义') +
          '</div></div></div>' +
      '</div>' +
      '<div style="margin-top:16px;text-align:right">' +
        '<button class="btn btn-primary" id="btn-save">保存设置</button>' +
      '</div>';

    el.querySelector('#btn-save').addEventListener('click', async function () {
      const readList = function (key) {
        return (el.querySelector('#set-' + key).value || '').split('\n')
          .map(function (x) { return x.trim(); }).filter(Boolean);
      };
      const patch = {
        companyName: el.querySelector('#set-companyName').value.trim() || '昇丽迪门窗',
        phone: el.querySelector('#set-phone').value.trim(),
        productTypes: readList('productTypes'),
        materialTypes: readList('materialTypes'),
        glassTypes: readList('glassTypes'),
        colorTypes: readList('colorTypes'),
        financeCategories: readList('financeCategories'),
        paymentMethods: readList('paymentMethods'),
        orderStatuses: readList('orderStatuses')
      };
      await App.saveSettings(patch);
      App.toast('设置已保存', 'success');
    });

    el.querySelector('#btn-seed').addEventListener('click', seedDemo);
    el.querySelector('#btn-backup2').addEventListener('click', function () {
      document.getElementById('btn-backup').click();
    });
    el.querySelector('#btn-clear').addEventListener('click', function () {
      App.confirm('确定清空所有数据吗？此操作不可撤销，建议先备份。', async function () {
        await App.DB.clearAll();
        App.toast('已清空全部数据', 'success');
        location.reload();
      }, '确认清空');
    });
  }

  /* ---------- 示例数据 ---------- */
  async function seedDemo() {
    const has = App.DB.getAll('customers').length > 0;
    if (has) {
      App.confirm('当前已有数据，加载示例数据会追加在其中，是否继续？', function () { doSeed(); }, '继续加载');
    } else {
      doSeed();
    }
  }

  async function doSeed() {
    const c1 = await App.DB.put('customers', { id: undefined, name: '张伟', phone: '13800001111', address: '阳光花园 3 栋 502', source: '朋友介绍', type: '零售', remark: '', createdAt: App.now() });
    const c2 = await App.DB.put('customers', { id: undefined, name: '李娜', phone: '13900002222', address: '翡翠湾 8 栋 1801', source: '老客户', type: '零售', remark: '', createdAt: App.now() });
    const c3 = await App.DB.put('customers', { id: undefined, name: '王强', phone: '13700003333', address: '紫荆公馆 12 栋 303', source: '门店', type: '零售', remark: '', createdAt: App.now() });

    const o1 = await App.DB.put('orders', {
      id: undefined, orderNo: await App.genNo('DD'), customerId: c1.id, customerName: c1.name,
      address: '阳光花园 3 栋 502', status: '待安装', createdAt: App.now(),
      items: [
        { productType: '平开窗', material: '断桥铝', glass: '中空玻璃', color: '香槟金', width: 1800, height: 1500, qty: 2, priceMode: '按㎡', unitPrice: 580, remark: '' },
        { productType: '推拉门', material: '断桥铝', glass: '钢化玻璃', color: '香槟金', width: 2400, height: 2200, qty: 1, priceMode: '按㎡', unitPrice: 680, remark: '阳台门' }
      ]
    });
    o1.totalAmount = App.orderTotal(o1); await App.DB.put('orders', o1);

    const o2 = await App.DB.put('orders', {
      id: undefined, orderNo: await App.genNo('DD'), customerId: c2.id, customerName: c2.name,
      address: '翡翠湾 8 栋 1801', status: '生产中', createdAt: App.now(),
      items: [
        { productType: '平开窗', material: '断桥铝', glass: 'Low-E玻璃', color: '灰色', width: 1500, height: 1400, qty: 4, priceMode: '按㎡', unitPrice: 620, remark: '' }
      ]
    });
    o2.totalAmount = App.orderTotal(o2); await App.DB.put('orders', o2);

    const o3 = await App.DB.put('orders', {
      id: undefined, orderNo: await App.genNo('DD'), customerId: c3.id, customerName: c3.name,
      address: '紫荆公馆 12 栋 303', status: '待生产', createdAt: App.now(),
      items: [
        { productType: '阳光房', material: '断桥铝', glass: '夹胶玻璃', color: '黑色', width: 3000, height: 2600, qty: 1, priceMode: '按㎡', unitPrice: 980, remark: '' }
      ]
    });
    o3.totalAmount = App.orderTotal(o3); await App.DB.put('orders', o3);

    await App.DB.put('finances', { id: undefined, type: '收入', category: '定金', amount: 5000, date: App.today(), customerId: c1.id, customerName: c1.name, orderId: o1.id, orderNo: o1.orderNo, method: '微信', remark: '预收定金', createdAt: App.now() });
    await App.DB.put('finances', { id: undefined, type: '收入', category: '定金', amount: 3000, date: App.today(), customerId: c2.id, customerName: c2.name, orderId: o2.id, orderNo: o2.orderNo, method: '银行转账', remark: '预收定金', createdAt: App.now() });

    await App.DB.put('productions', { id: undefined, prodNo: await App.genNo('SC'), orderId: o2.id, orderNo: o2.orderNo, customerName: o2.customerName, status: '生产中', workshop: '一号车间', owner: '刘师傅', startDate: App.today(), endDate: '', remark: '', createdAt: App.now() });
    await App.DB.put('installations', { id: undefined, installNo: await App.genNo('AZ'), orderId: o1.id, orderNo: o1.orderNo, customerName: o1.customerName, status: '已排单', installDate: App.today(), installer: '陈师傅', address: o1.address, remark: '', createdAt: App.now() });

    App.toast('示例数据已加载', 'success');
    location.reload();
  }
})();
