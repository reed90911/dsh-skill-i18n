/**
 * skill-i18n — 设置页（Client 半）
 *
 * 视觉参照 DSH「设置 → Web 扩展」页：分区标题 + 圆角卡片 + 左侧线性图标 + 右侧控件。
 *
 * 注意：这里全部使用内联样式，不依赖 styles.insert —— 运行时不保证能拿到 styles 服务，
 * 一旦注入失败整个页面会退化成无样式（图标撑满屏幕）。内联样式在任何环境下都成立。
 */
window.__ModuleLoader__.load({
  id: 'dsh-skill-i18n',
  factory(require) {
    const React = require('react');
    const h = React.createElement;

    // ---------- 样式基元 ----------
    const BORDER = 'rgba(255,255,255,0.09)';
    const BORDER_SOFT = 'rgba(255,255,255,0.07)';
    const MUTED = 0.55;

    const S = {
      page: { display: 'flex', flexDirection: 'column', gap: '26px', maxWidth: '720px', paddingBottom: '8px' },
      headTitle: { margin: '0 0 6px', fontSize: '16px', fontWeight: 600, letterSpacing: '0.2px' },
      headDesc: { margin: 0, fontSize: '12.5px', lineHeight: 1.65, opacity: MUTED },
      section: { display: 'flex', flexDirection: 'column', gap: '10px' },
      sectionTitle: { margin: 0, fontSize: '13px', fontWeight: 600, opacity: 0.92 },
      list: { display: 'flex', flexDirection: 'column', gap: '10px' },

      item: {
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        padding: '14px 16px',
        border: '1px solid ' + BORDER,
        borderRadius: '12px',
        background: 'transparent',
      },
      itemOn: { border: '1px solid rgba(79,140,255,0.65)', background: 'rgba(79,140,255,0.07)' },
      itemStatic: { cursor: 'default' },
      clickable: { cursor: 'pointer' },

      ico: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '22px', height: '22px', flex: '0 0 22px', opacity: 0.85 },
      body: { display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 },
      name: { fontSize: '13.5px', fontWeight: 500, lineHeight: 1.35 },
      note: { fontSize: '12px', lineHeight: 1.6, opacity: MUTED },

      sw: { position: 'relative', width: '40px', height: '22px', borderRadius: '11px', background: 'rgba(255,255,255,0.16)', flex: '0 0 40px' },
      swOn: { background: '#3b82f6' },
      swDot: { position: 'absolute', top: '2px', left: '2px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff' },
      swDotOn: { left: '20px' },

      select: {
        font: 'inherit',
        fontSize: '12.5px',
        color: 'inherit',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '8px',
        padding: '6px 10px',
        outline: 'none',
        colorScheme: 'dark',
      },
      input: {
        font: 'inherit',
        fontSize: '12.5px',
        color: 'inherit',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '8px',
        padding: '6px 10px',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
      },
      field: { display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' },

      actions: { display: 'flex', flexWrap: 'wrap', gap: '10px' },
      btn: {
        font: 'inherit',
        fontSize: '12.5px',
        color: 'inherit',
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: '8px',
        padding: '7px 14px',
        cursor: 'pointer',
      },
      btnPrimary: { background: '#3b82f6', border: '1px solid #3b82f6', color: '#fff' },
      btnDanger: { color: '#f87171', border: '1px solid rgba(248,113,113,0.35)' },

      stats: { border: '1px solid ' + BORDER, borderRadius: '12px', overflow: 'hidden' },
      row: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '11px 16px', fontSize: '12.5px' },
      rowK: { opacity: 0.6 },
      rowV: { fontVariantNumeric: 'tabular-nums', fontWeight: 500 },

      hint: { margin: 0, fontSize: '12px', lineHeight: 1.65, opacity: 0.5 },
      msg: {
        margin: 0,
        padding: '12px 14px',
        border: '1px solid ' + BORDER,
        borderRadius: '10px',
        fontSize: '11.5px',
        lineHeight: 1.6,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        background: 'rgba(0,0,0,0.18)',
        maxHeight: '260px',
        overflow: 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      },
    };

    // ---------- 线性图标 ----------
    const ICONS = {
      table: ['M3 5.5h18', 'M3 12h18', 'M3 18.5h18', 'M8 3v18', 'M16 3v18'],
      bolt: ['M13 3 5 14h6l-1 7 8-11h-6z'],
      clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 7.5V12l3 1.8'],
      tag: ['M20 12.5 12.5 20a2 2 0 0 1-2.8 0L4 14.3V4h10.3l5.7 5.7a2 2 0 0 1 0 2.8z', 'M8.5 8.5h.01'],
      info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', 'M12 10.5v6', 'M12 7.2h.01'],
    };

    const svgProps = {
      width: 22,
      height: 22,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.6,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': true,
      style: { display: 'block' },
    };

    function Icon({ name }) {
      return h('svg', svgProps, (ICONS[name] || ICONS.info).map((d, i) => h('path', { key: i, d })));
    }

    // ---------- 接口 ----------
    let API_BASE = null;

    async function api(path, init) {
      const bases = API_BASE !== null ? [API_BASE] : ['/api', ''];
      let lastErr = null;
      for (const base of bases) {
        try {
          const res = await fetch(base + path, {
            headers: { 'content-type': 'application/json' },
            ...init,
          });
          if (!res.ok) {
            lastErr = new Error('HTTP ' + res.status + ' (' + base + path + ')');
            continue;
          }
          const text = await res.text();
          if (!text) {
            lastErr = new Error('空响应 (' + base + path + ')');
            continue;
          }
          API_BASE = base;
          return JSON.parse(text);
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr || new Error('接口不可达');
    }

    function diag() {
      try {
        const boot = window.__DSH_BOOT__;
        return {
          href: String(window.location.href).slice(0, 80),
          bootKeys: boot && typeof boot === 'object' ? Object.keys(boot).slice(0, 20) : null,
        };
      } catch (e) {
        return { error: String(e) };
      }
    }

    // ---------- 页面 ----------
    function Panel() {
      const [status, setStatus] = React.useState(null);
      const [settings, setSettings] = React.useState(null);
      const [busy, setBusy] = React.useState('');
      const [msg, setMsg] = React.useState('');
      const [skillInput, setSkillInput] = React.useState('');
      const [customMinutes, setCustomMinutes] = React.useState('30');

      async function refresh() {
        try {
          const [s, cfg] = await Promise.all([api('/skill-i18n/status'), api('/skill-i18n/settings')]);
          if (s && s.ok) setStatus(s);
          if (cfg && cfg.settings) {
            setSettings(cfg.settings);
            const sc = cfg.settings.schedule;
            if (typeof sc === 'number' && sc > 0) setCustomMinutes(String(sc));
            setSkillInput((cfg.settings.skills || []).join(', '));
          }
        } catch (e) {
          setMsg('读取状态失败：' + (e && e.message ? e.message : e) + '\n诊断：' + JSON.stringify(diag(), null, 2));
        }
      }

      React.useEffect(() => {
        refresh();
      }, []);

      async function save(patch, note) {
        setBusy('save');
        setMsg('');
        try {
          const body = { ...(settings || {}), ...patch };
          const r = await api('/skill-i18n/settings', { method: 'POST', body: JSON.stringify(body) });
          if (r && r.ok) {
            setSettings(r.settings);
            setMsg(note || '已保存');
            refresh();
          } else {
            setMsg('保存失败：' + JSON.stringify(r));
          }
        } catch (e) {
          setMsg('保存失败：' + (e && e.message ? e.message : e));
        } finally {
          setBusy('');
        }
      }

      async function run(action, extra) {
        setBusy(action);
        setMsg('执行中…');
        try {
          const skills = skillInput.trim()
            ? skillInput.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean)
            : undefined;
          const r = await api('/skill-i18n/run', {
            method: 'POST',
            body: JSON.stringify({ action, skills, ...(extra || {}) }),
          });
          setMsg(JSON.stringify(r, null, 2));
          refresh();
        } catch (e) {
          setMsg('执行失败：' + (e && e.message ? e.message : e));
        } finally {
          setBusy('');
        }
      }

      const engine = settings && settings.engine ? settings.engine : 'glossary';
      const schedule = settings && settings.schedule !== undefined ? settings.schedule : 'hourly';
      // 数字 0 表示「仅启动时」、-1 表示关闭，只有 >0 的分钟数才算自定义间隔
      const isCustomSchedule = typeof schedule === 'number' && schedule > 0;
      const scheduleChoice =
        typeof schedule === 'number'
          ? schedule > 0
            ? 'custom'
            : schedule === 0
              ? 'startup'
              : 'off'
          : String(schedule);

      function engineCard(id, icon, name, note, hint) {
        const on = engine === id;
        return h(
          'div',
          {
            style: { ...S.item, ...(on ? S.itemOn : {}), ...S.clickable },
            onClick: () => {
              if (busy) return;
              save({ engine: id }, '翻译引擎已切换：' + name);
            },
          },
          h('span', { style: S.ico }, h(Icon, { name: icon })),
          h(
            'span',
            { style: S.body },
            h('span', { style: S.name }, name),
            h('span', { style: S.note }, note),
            hint ? h('span', { style: S.note }, hint) : null,
          ),
          h(
            'span',
            { style: { ...S.sw, ...(on ? S.swOn : {}) } },
            h('span', { style: { ...S.swDot, ...(on ? S.swDotOn : {}) } }),
          ),
        );
      }

      function sectionTitle(text) {
        return h('h3', { style: S.sectionTitle }, text);
      }

      const statRows = status
        ? [
            ['技能总数', status.total],
            ['中文描述', status.chinese],
            ['英文描述', status.english],
            ['已记录', status.tracked],
            ['已备份', status.backups],
            ['预制表覆盖', status.glossaryCoverage],
          ]
        : [];

      return h(
        'div',
        { style: S.page },

        h(
          'div',
          null,
          h('h2', { style: S.headTitle }, '技能翻译'),
          h('p', { style: S.headDesc }, '把技能的英文描述翻译成中文，随时可还原；技能更新后按内容变化自动重译。'),
        ),

        h(
          'section',
          { style: S.section },
          sectionTitle('翻译引擎'),
          h(
            'div',
            { style: S.list },
            engineCard(
              'glossary',
              'table',
              '预制翻译表',
              '零消耗 · 结果稳定 · 只覆盖表内的技能',
              '不调用模型；表外的新技能会跳过并提示',
            ),
            engineCard(
              'llm',
              'bolt',
              '模型实时翻译',
              '任意技能可翻 · 新技能自动处理',
              '消耗额度：单条约 50–80 tokens；措辞更贴近原文',
            ),
          ),
        ),

        h(
          'section',
          { style: S.section },
          sectionTitle('扫描频率'),
          h(
            'div',
            { style: S.list },
            h(
              'div',
              { style: { ...S.item, ...S.itemStatic } },
              h('span', { style: S.ico }, h(Icon, { name: 'clock' })),
              h(
                'span',
                { style: S.body },
                h('span', { style: S.name }, '自动检查节奏'),
                h('span', { style: S.note }, status ? '当前：' + status.schedule : '修改后立即生效，无需重启'),
              ),
              h(
                'select',
                {
                  style: S.select,
                  value: scheduleChoice,
                  onChange: (e) => {
                    const v = e.target.value;
                    if (v === 'custom') save({ schedule: Number(customMinutes) || 30 }, '扫描频率：自定义');
                    else save({ schedule: v }, '扫描频率已更新');
                  },
                },
                h('option', { value: 'hourly' }, '每小时'),
                h('option', { value: 'daily' }, '每天'),
                h('option', { value: 'startup' }, '仅启动时'),
                h('option', { value: 'off' }, '关闭'),
                h('option', { value: 'custom' }, '自定义'),
              ),
            ),
            isCustomSchedule || schedule === 'custom'
              ? h(
                  'div',
                  { style: { ...S.item, ...S.itemStatic } },
                  h('span', { style: S.ico }, h(Icon, { name: 'clock' })),
                  h(
                    'span',
                    { style: S.body },
                    h('span', { style: S.name }, '自定义间隔'),
                    h('span', { style: S.note }, '单位为分钟'),
                  ),
                  h('input', {
                    style: { ...S.select, width: '84px', textAlign: 'right' },
                    type: 'number',
                    min: 1,
                    value: customMinutes,
                    onChange: (e) => setCustomMinutes(e.target.value),
                    onBlur: () =>
                      save(
                        { schedule: Number(customMinutes) || 30 },
                        '扫描频率：每 ' + (Number(customMinutes) || 30) + ' 分钟',
                      ),
                  }),
                )
              : null,
          ),
        ),

        h(
          'section',
          { style: S.section },
          sectionTitle('只翻译指定技能'),
          h(
            'div',
            { style: S.list },
            h(
              'div',
              { style: { ...S.item, ...S.itemStatic } },
              h('span', { style: S.ico }, h(Icon, { name: 'tag' })),
              h(
                'span',
                { style: S.field },
                h('input', {
                  style: S.input,
                  placeholder: '留空表示全部技能，多个用逗号分隔',
                  value: skillInput,
                  onChange: (e) => setSkillInput(e.target.value),
                  onBlur: () =>
                    save(
                      { skills: skillInput.split(/[,，\s]+/).map((s) => s.trim()).filter(Boolean) },
                      '技能范围已保存',
                    ),
                }),
                h('span', { style: S.note }, '例如：resume-tailor, moli-browser'),
              ),
            ),
          ),
        ),

        h(
          'section',
          { style: S.section },
          sectionTitle('操作'),
          h(
            'div',
            { style: S.actions },
            h(
              'button',
              { style: { ...S.btn, ...S.btnPrimary }, disabled: Boolean(busy), onClick: () => run('translate') },
              busy === 'translate' ? '翻译中…' : '立即翻译',
            ),
            h('button', { style: S.btn, disabled: Boolean(busy), onClick: () => run('translate', { force: true }) }, '强制重译'),
            h('button', { style: S.btn, disabled: Boolean(busy), onClick: () => run('restore') }, '还原为英文'),
            h(
              'button',
              { style: { ...S.btn, ...S.btnDanger }, disabled: Boolean(busy), onClick: () => run('restore', { fromBackup: true }) },
              '整文件回滚',
            ),
          ),
          h('p', { style: S.hint }, '「还原为英文」只改描述字段；「整文件回滚」用首次翻译前的完整副本覆盖整个 SKILL.md。'),
        ),

        status
          ? h(
              'section',
              { style: S.section },
              sectionTitle('当前状态'),
              h(
                'div',
                { style: S.stats },
                statRows.map(([k, v], i) =>
                  h(
                    'div',
                    { key: k, style: { ...S.row, ...(i > 0 ? { borderTop: '1px solid ' + BORDER_SOFT } : {}) } },
                    h('span', { style: S.rowK }, k),
                    h('span', { style: S.rowV }, String(v)),
                  ),
                ),
              ),
              status.pending && status.pending.length
                ? h(
                    'div',
                    { style: { ...S.item, ...S.itemStatic } },
                    h('span', { style: S.ico }, h(Icon, { name: 'info' })),
                    h(
                      'span',
                      { style: S.body },
                      h('span', { style: S.name }, '待翻译'),
                      h('span', { style: S.note }, status.pending.join(', ')),
                    ),
                  )
                : h('p', { style: S.hint }, '所有技能描述都已是中文。'),
              h('p', { style: S.hint }, '状态文件：' + status.stateFile),
              h('p', { style: S.hint }, '备份目录：' + status.backupDir),
            )
          : null,

        msg ? h('pre', { style: S.msg }, msg) : null,
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        ctx.slots.inject('settings.section', () =>
          ctx.slots.register(
            { name: 'settings.section', id: 'skill-i18n', order: 90, label: '技能翻译' },
            Panel,
          ),
        );
      },
    };
  },
});
