/* ===================== 项目跟踪（含量尺管理） ===================== */
(function () {
  const App = window.App;

  const STAGES = ['咨询中', '已量尺', '已报价', '谈判中', '待签单', '已成交', '已流失'];

  let filter = '';
  let stageFilter = '';
  let tab = 'projects'; // projects | measurements

  App.registerModule({
    id: 'projects',
    title: '项目跟踪',
    icon: 'target',
    render: render
  });

  function stageColor(stage) {
    return {
      '咨询中': 'gray', '已量尺': 'amber', '已报价': 'blue', '谈判中': 'purple',
      '待签单': 'cyan', '已成交': 'green', '已流失': 'red'
    }[stage] || 'gray';
  }

  /* ---------- 标签页主控 ---------- */
  function render(el) {
    if (App.pendingTab) { tab = App.pendingTab; App.pendingTab = null; }
    el.innerHTML =
      '<div class="tabs">' +
        '<button class="tab' + (tab === 'projects' ? ' active' : '') + '" data-tab="projects">🎯 跟踪项目</button>' +
        '<button class="tab' + (tab === 'measurements' ? ' active' : '') + '" data-tab="measurements">📐 量尺管理</button>' +
      '</div>' +
      '<div id="tab-content"></div>';
    const box = el.querySelector('#tab-content');
    if (tab === 'projects') renderProjects(box); else App.renderMeasurements(box);
    el.querySelectorAll('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        tab = t.getAttribute('data-tab'); render(el);
      });
    });
  }

  /* ===================== 跟踪项目 ===================== */
  function renderProjects(el) {
    if (App.pendingSearch) { filter = App.pendingSearch; App.pendingSearch = null; }
    const q = filter.trim().toLowerCase();
    const all = App.DB.getAll('projects');

    const list = all.filter(function (p) {
      if (stageFilter && p.stage !== stageFilter) return false;
      if (!q) return true;
      return [p.projNo, p.name, p.customerName, p.owner, p.address, p.productType, p.source].some(function (f) {
        return String(f || '').toLowerCase().indexOf(q) >= 0;
      });
    }).sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });

    const sumAmount = list.reduce(function (s, p) { return s + App.num(p.estAmount); }, 0);

    const rows = list.map(function (p) {
      const due = p.nextFollow && p.nextFollow <= App.today();
      return '<tr>' +
        '<td><a class="link" data-act="detail" data-id="' + p.id + '">' + App.escapeHtml(p.projNo) + '</a></td>' +
        '<td>' + App.escapeHtml(p.customerName || '') + '</td>' +
        '<td>' + App.escapeHtml(p.name || '') + '</td>' +
        '<td class="muted">' + App.escapeHtml(p.productType || '') + '</td>' +
        '<td>' + App.badge(p.stage || '咨询中', stageColor(p.stage)) + '</td>' +
        '<td class="money">' + App.fmtMoney(p.estAmount) + '</td>' +
        '<td class="num muted">' + (p.nextFollow ? App.fmtDate(p.nextFollow) + (due ? ' ' + App.badge('到期', 'red') : '') : '—') + '</td>' +
        '<td class="muted">' + App.escapeHtml(p.owner || '') + '</td>' +
        '<td>' + App.actionBtns([
          { label: '跟进', cls: 'btn-outline', data: { act: 'follow', id: p.id } },
          { label: '转订单', cls: 'btn-outline', data: { act: 'toOrder', id: p.id } },
          { label: '编辑', cls: 'btn-outline', data: { act: 'edit', id: p.id } },
          { label: '删除', cls: 'btn-outline', data: { act: 'del', id: p.id } }
        ]) + '</td></tr>';
    }).join('');

    const chips = STAGES.map(function (s) {
      const n = all.filter(function (p) { return p.stage === s; }).length;
      return '<label class="chip"><input type="radio" name="st" value="' + s + '"' + (stageFilter === s ? ' checked' : '') + '><span>' + s + ' ' + n + '</span></label>';
    }).join('');

    el.innerHTML =
      '<div class="toolbar">' +
        '<input class="input" style="width:240px" placeholder="搜索项目 / 客户 / 负责人" id="search" value="' + App.escapeHtml(filter) + '">' +
        '<span class="spacer"></span>' +
        '<button class="btn btn-outline" id="export">导出</button>' +
        '<button class="btn btn-primary" id="add">＋ 登记项目</button>' +
      '</div>' +
      '<div class="pill-row" id="stage-chips" style="margin-bottom:14px">' +
        '<label class="chip"><input type="radio" name="st" value=""' + (!stageFilter ? ' checked' : '') + '><span>全部 ' + all.length + '</span></label>' + chips +
      '</div>' +
      '<div class="muted small" style="margin-bottom:12px">共 ' + list.length + ' 个项目 · 预计总额 ' + App.fmtMoney(sumAmount) + '</div>' +
      (rows
        ? '<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr>' +
          '<th>项目编号</th><th>客户</th><th>项目名称</th><th>类型</th><th>阶段</th><th class="num">预计金额</th><th class="num">下次跟进</th><th>负责人</th><th></th>' +
          '</tr></thead><tbody>' + rows + '</tbody></table></div></div>'
        : App.empty('🎯', '还没有跟踪项目', '点击「登记项目」录入正在跟进的潜在项目'));

    bind(el);
  }

  function bind(el) {
    el.querySelector('#search').addEventListener('input', App.debounce(function (e) {
      filter = e.target.value; renderProjects(el);
    }, 250));
    el.querySelector('#add').addEventListener('click', function () { openForm(el, null); });
    el.querySelector('#export').addEventListener('click', exportCSV);
    el.querySelectorAll('#stage-chips input[name="st"]').forEach(function (r) {
      r.addEventListener('change', function () { stageFilter = r.value; renderProjects(el); });
    });
    el.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const act = btn.getAttribute('data-act');
        const id = btn.getAttribute('data-id');
        if (act === 'edit') openForm(el, id);
        else if (act === 'del') del(id, el);
        else if (act === 'detail') detail(id, el);
        else if (act === 'follow') openFollowForm(id, function () { renderProjects(el); });
        else if (act === 'toOrder') toOrder(id);
      });
    });
  }

  function openForm(el, id) {
    const p = id ? App.DB.get('projects', id) : null;
    const s = App.settings();
    const body =
      '<div class="form-grid">' +
        '<div class="field"><label>项目编号</label><input class="input" value="' + App.escapeHtml(p ? p.projNo : '(保存时自动生成)') + '" disabled></div>' +
        '<div class="field"><label>阶段</label><select class="select" id="f-stage">' + App.selectOptions(STAGES, p ? p.stage : '咨询中') + '</select></div>' +
        '<div class="field"><label>客户 <span class="req">*</span></label>' + App.customerField(p ? p.customerId : null) + '</div>' +
        '<div class="field"><label>项目名称</label><input class="input" id="f-name" value="' + App.escapeHtml(p ? p.name : '') + '" placeholder="如：阳台阳光房、全屋门窗"></div>' +
        '<div class="field"><label>门窗类型</label><select class="select" id="f-type">' + App.selectOptions(s.productTypes, p ? p.productType : null, true) + '</select></div>' +
        '<div class="field"><label>预计金额（元）</label><input type="number" class="input" id="f-amount" value="' + (p ? p.estAmount : '') + '"></div>' +
        '<div class="field"><label>负责人</label><input class="input" id="f-owner" value="' + App.escapeHtml(p ? p.owner : '') + '"></div>' +
        '<div class="field"><label>下次跟进</label><input type="date" class="input" id="f-next" value="' + (p ? p.nextFollow : '') + '"></div>' +
        '<div class="field"><label>来源</label><select class="select" id="f-source">' +
          ['', '朋友介绍', '老客户', '门店', '网络', '小区推广', '其他'].map(function (x) {
            return '<option' + ((p && p.source === x) ? ' selected' : '') + '>' + x + '</option>';
          }).join('') + '</select></div>' +
        '<div class="field full"><label>项目地址</label><input class="input" id="f-address" value="' + App.escapeHtml(p ? p.address : '') + '"></div>' +
        '<div class="field full"><label>备注</label><textarea class="textarea" id="f-remark">' + App.escapeHtml(p ? p.remark : '') + '</textarea></div>' +
      '</div>';

    App.modal({
      title: p ? '编辑项目' : '登记跟踪项目',
      size: 'lg',
      body: body,
      onOk: async function () {
        const customerId = document.getElementById('f-customer').value;
        if (!customerId) { App.toast('请选择客户', 'error'); return false; }
        const cust = App.DB.get('customers', customerId);
        const rec = {
          id: p ? p.id : undefined,
          projNo: p ? p.projNo : await App.genNo('XM'),
          customerId: customerId,
          customerName: cust ? cust.name : '',
          name: document.getElementById('f-name').value.trim(),
          productType: document.getElementById('f-type').value,
          estAmount: App.num(document.getElementById('f-amount').value),
          stage: document.getElementById('f-stage').value,
          owner: document.getElementById('f-owner').value.trim(),
          nextFollow: document.getElementById('f-next').value,
          source: document.getElementById('f-source').value,
          address: document.getElementById('f-address').value.trim(),
          remark: document.getElementById('f-remark').value.trim(),
          createdAt: p ? p.createdAt : App.now()
        };
        await App.DB.put('projects', rec);
        App.toast(p ? '已保存' : '项目已登记', 'success');
        renderProjects(el);
      }
    });
  }

  /* ---------- 跟进记录 ---------- */
  function followItem(f) {
    return '<div class="follow-item">' +
      '<div class="follow-head">' + App.badge(f.method || '其他', 'blue') +
        '<span class="muted small">' + App.fmtDate(f.date) + '</span>' +
        (f.nextDate ? '<span class="muted small">下次跟进：' + App.fmtDate(f.nextDate) + '</span>' : '') +
      '</div>' +
      '<div class="follow-content">' + App.escapeHtml(f.content) + '</div>' +
    '</div>';
  }

  function openFollowForm(projectId, onDone) {
    const p = App.DB.get('projects', projectId);
    if (!p) return;
    App.modal({
      title: '记录跟进 · ' + (p.name || p.projNo),
      body:
        '<div class="form-grid">' +
          '<div class="field"><label>跟进日期</label><input type="date" class="input" id="fw-date" value="' + App.today() + '"></div>' +
          '<div class="field"><label>跟进方式</label><select class="select" id="fw-method">' + App.selectOptions(['电话', '微信', '上门', '短信', '其他'], '电话') + '</select></div>' +
          '<div class="field full"><label>跟进内容 <span class="req">*</span></label><textarea class="textarea" id="fw-content" placeholder="记录沟通情况、客户意向、报价反馈等"></textarea></div>' +
          '<div class="field"><label>下次跟进日期</label><input type="date" class="input" id="fw-next" value="' + (p.nextFollow || '') + '"></div>' +
        '</div>',
      okText: '保存跟进',
      onOk: async function () {
        const content = document.getElementById('fw-content').value.trim();
        if (!content) { App.toast('请填写跟进内容', 'error'); return false; }
        await App.DB.put('follows', {
          id: undefined,
          projectId: projectId,
          projectName: p.name,
          customerId: p.customerId,
          customerName: p.customerName,
          date: document.getElementById('fw-date').value,
          method: document.getElementById('fw-method').value,
          content: content,
          nextDate: document.getElementById('fw-next').value,
          createdAt: App.now()
        });
        p.nextFollow = document.getElementById('fw-next').value;
        await App.DB.put('projects', p);
        App.toast('跟进已记录', 'success');
        if (onDone) onDone();
      }
    });
  }

  function detail(id, el) {
    const p = App.DB.get('projects', id);
    if (!p) return;
    const follows = App.DB.getAll('follows').filter(function (f) { return f.projectId === id; })
      .sort(function (a, b) { return (b.date || '').localeCompare(a.date || '') || (b.createdAt || '').localeCompare(a.createdAt || ''); });

    App.modal({
      title: '项目详情 · ' + p.projNo,
      size: 'lg',
      footer: false,
      body:
        '<div class="grid-2">' +
          '<div><div class="section-title">基本信息</div>' +
            '<div class="stat-row"><span class="k">客户</span><span class="v">' + App.escapeHtml(p.customerName || '') + '</span></div>' +
            '<div class="stat-row"><span class="k">项目名称</span><span class="v">' + App.escapeHtml(p.name || '') + '</span></div>' +
            '<div class="stat-row"><span class="k">门窗类型</span><span class="v">' + App.escapeHtml(p.productType || '') + '</span></div>' +
            '<div class="stat-row"><span class="k">地址</span><span class="v">' + App.escapeHtml(p.address || '') + '</span></div>' +
            '<div class="stat-row"><span class="k">来源</span><span class="v">' + App.escapeHtml(p.source || '') + '</span></div>' +
            '<div class="stat-row"><span class="k">负责人</span><span class="v">' + App.escapeHtml(p.owner || '') + '</span></div>' +
            '<div class="stat-row"><span class="k">登记时间</span><span class="v">' + App.fmtDate(p.createdAt) + '</span></div>' +
          '</div>' +
          '<div><div class="section-title">商务信息</div>' +
            '<div class="stat-row"><span class="k">阶段</span><span class="v">' + App.badge(p.stage || '咨询中', stageColor(p.stage)) + '</span></div>' +
            '<div class="stat-row"><span class="k">预计金额</span><span class="v">' + App.fmtMoney(p.estAmount) + '</span></div>' +
            '<div class="stat-row"><span class="k">下次跟进</span><span class="v">' + (p.nextFollow ? App.fmtDate(p.nextFollow) : '—') + '</span></div>' +
            '<div class="section-title">操作</div>' +
            '<div style="display:flex;flex-direction:column;gap:8px">' +
              '<button class="btn btn-outline btn-sm" data-op="stage">变更阶段</button>' +
              '<button class="btn btn-outline btn-sm" data-op="follow">记录跟进</button>' +
              '<button class="btn btn-outline btn-sm" data-op="toOrder">转为订单</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        (p.remark ? '<div class="section-title">备注</div><div class="muted">' + App.escapeHtml(p.remark) + '</div>' : '') +
        '<div class="section-title">跟进记录（' + follows.length + '）</div>' +
        (follows.length ? follows.map(followItem).join('') : '<div class="muted small">暂无跟进记录，点击「记录跟进」添加</div>'),
      onMount: function (mask) {
        mask.querySelectorAll('[data-op]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            const op = btn.getAttribute('data-op');
            if (op === 'stage') changeStage(p, el);
            else if (op === 'follow') openFollowForm(p.id, function () { mask.remove(); detail(p.id, el); });
            else if (op === 'toOrder') toOrder(p.id);
          });
        });
      }
    });
  }

  function changeStage(p, el) {
    App.modal({
      title: '变更项目阶段',
      size: 'sm',
      body: '<div class="field"><label>选择阶段</label><select class="select" id="f-stage">' + App.selectOptions(STAGES, p.stage) + '</select></div>',
      onOk: async function () {
        p.stage = document.getElementById('f-stage').value;
        await App.DB.put('projects', p);
        App.toast('阶段已更新为「' + p.stage + '」', 'success');
        if (el) renderProjects(el);
      }
    });
  }

  function toOrder(id) {
    const p = App.DB.get('projects', id);
    if (!p) return;
    if (typeof App.openNewOrder === 'function') {
      App.openNewOrder({
        customerId: p.customerId,
        address: p.address,
        items: p.productType ? [{ productType: p.productType, width: 0, height: 0, qty: 1, material: '', glass: '', color: '', priceMode: '按㎡', unitPrice: 0, amount: 0, remark: '' }] : []
      });
    } else {
      App.go('orders');
    }
  }

  function del(id, el) {
    const p = App.DB.get('projects', id);
    App.confirm('确定删除项目「' + (p ? (p.name || p.projNo) : '') + '」吗？', async function () {
      await App.DB.remove('projects', id);
      App.toast('已删除', 'success');
      renderProjects(el);
    }, '删除');
  }

  function exportCSV() {
    const rows = [['项目编号', '客户', '项目名称', '类型', '阶段', '预计金额', '下次跟进', '负责人', '来源', '地址', '备注', '登记日期']];
    App.DB.getAll('projects').forEach(function (p) {
      rows.push([p.projNo, p.customerName, p.name, p.productType, p.stage, p.estAmount, p.nextFollow, p.owner, p.source, p.address, p.remark, App.fmtDate(p.createdAt)]);
    });
    App.download('项目跟踪-' + App.today() + '.csv', App.toCSV(rows), 'text/csv;charset=utf-8');
    App.toast('已导出 CSV', 'success');
  }
})();
