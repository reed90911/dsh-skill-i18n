/**
 * skill-i18n — 技能描述中文翻译（Host 半）
 *
 * 能力：
 *   - 两种翻译引擎：内置预制翻译表（零消耗、仅覆盖表内技能）与 LLM 实时翻译（任意技能、消耗额度）
 *   - 扫描频率：hourly / daily / startup / off，或自定义分钟数
 *   - 只翻译指定技能
 *   - 两级回滚：只还原 description，或用完整备份覆盖整个文件
 *   - 供设置页使用的 HTTP 接口（Client 半见 client.js）
 *
 * 依赖服务：tools（必需）、webServer（可选，缺失时只保留工具能力）
 */
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const MODULE = '[skill-i18n]';
const CJK = /[\u4e00-\u9fa5]/;
const TICK_MS = 60 * 1000;

const DEFAULTS = {
  engine: 'glossary',
  schedule: 'hourly',
  targetLanguage: 'zh-CN',
  sourceLanguage: 'en',
  skills: [],
  autoRunDelayMs: 8000,
  gapMs: 350,
  maxTextChars: 1200,
};

/** 预制翻译表：与项目内 32 个简历技能 + 2 个自建技能的既有译文一致。 */
const GLOSSARY = {
  'academic-cv': '学术简历（academic CV）：整理论文、基金、教学与服务，严格保留作者顺序与发表状态',
  'accomplishment-inventory': '成就盘点：通过访谈收集真实成果、规模与证据，形成可复用的素材库',
  'application-answers': '网申问答：依据简历证据撰写开放题与选拔标准回答，遵守字数限制',
  'career-change-resume': '转行简历：突出可迁移能力，保留原职位与背景，不虚构经验',
  'career-ops': '求职代理：评估岗位匹配度、改写 ATS 简历、写求职信、扫描招聘门户、追踪投递',
  'cover-letter-writer': '求职信撰写：基于真实经历写求职信或申请邮件，可解释转行与复出',
  'customer-success-resume': '客户成功简历：区分采用率、续约、增购与支持质量，避免混同销售业绩',
  'data-resume': '数据岗简历：数据分析、数据工程、数据科学与机器学习，连接方法与业务决策',
  'designer-resume': '设计岗简历：产品、UX/UI、用户研究与服务设计，连接研究与决策结果',
  'educator-resume': '教育岗简历：教学、教研与管理，保留资质状态并保护学生隐私',
  'entry-level-resume': '应届生简历：从课程、项目、实习与兼职中提炼经历，不虚构雇佣关系',
  'executive-resume': '高管简历：董事、VP、C-level 与董事会候选人，区分企业成果与个人职责',
  'finance-resume': '财务简历：会计、审计、FP&A、资金、银行与投资，准确标注归属与币种',
  'healthcare-resume': '医疗简历：护理、辅助医疗、临床支持与医务管理，保证执照与执业范围准确',
  'interview-prep': '面试准备：构建 STAR 故事库、公司与岗位简报、预测问题、开场与反问清单',
  'job-application-manager': '投递管理：记录岗位与阶段、设置跟进、周度复盘、追踪简历版本、起草消息',
  'linkedin-profile-writer': 'LinkedIn 文案：撰写标题、About 与经历描述，与简历保持一致',
  'marketing-resume': '市场岗简历：增长、投放、品牌、生命周期与内容，清晰归属渠道成果',
  'mock-interview': '模拟面试：扮演面试官逐题提问、追问细节、按评分表给出引用式反馈',
  'moli-browser': 'Moli 无头浏览器：用真实 V8 渲染页面，导出 Markdown、语义树、HTML、截图或 PDF，也可起 CDP 服务',
  'offer-negotiation': '薪酬谈判：拆解 base/bonus/equity、对标薪酬数据、设计一次还价、模拟电话沟通',
  'operations-resume': '运营简历：供应链、物流、制造、维护、零售与酒店，量化产能质量成本安全',
  'portfolio-case-study': '作品集案例：把真实项目写成决策-贡献-结果的叙事，不虚构客户成果',
  'product-manager-resume': '产品简历：呈现客户问题、优先级、决策与结果，区分产品方向与交付治理',
  'project-manager-resume': '项目简历：用范围、依赖、风险、进度与结果描述交付与 PMO 工作',
  'remote-jobs-search': '远程职位搜索：聚合 Remotive、Jobicy、RemoteOK 三个公开 API，按关键词与发布时间筛选',
  'resume-builder': '简历 JSON：生成可直接导入 rxresu.me 的 Reactive Resume JSON，含模板与版式',
  'resume-bullet-writer': '简历要点改写：把职责改写成可验证的成果句，缺数据时如实标注为估算',
  'resume-content-guide': '简历内容顾问：判断该写什么、删什么、版块顺序、篇幅、空窗期与各国惯例',
  'resume-proofreader': '简历校对：只改语法、清晰度与一致性，不改事实与语气',
  'resume-tailor': '简历定制：针对单个 JD 做需求表、证据映射、缺口提问、定制版本与 ATS 建议',
  'resume-writer': '简历撰写：从工作经历或草稿写出可直接复制的完整简历、标题与摘要',
  'sales-resume': '销售简历：SDR/BDR/AE、销售管理与售前，准确呈现配额、商机与归属周期',
  'software-engineer-resume': '软件工程师简历：前后端、全栈、移动、平台、DevOps、SRE 与安全，突出技术决策与交付',
  'technical-writer-resume': '技术写作简历：受众分析、信息设计、技术准确性与可展示的作品样本',
};

const SCHEDULE_ALIAS = { hourly: 60, daily: 1440, startup: 0, off: -1 };

function log(...args) {
  console.error(MODULE, ...args);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function dshHome() {
  return process.env.DSH_HOME || join(homedir(), '.dsh');
}

function stateFile() {
  return join(dshHome(), 'skill-i18n', 'state.json');
}

function settingsFile() {
  return join(dshHome(), 'skill-i18n', 'settings.json');
}

function backupRoot() {
  return join(dshHome(), 'skill-i18n', 'backup');
}

function backupPath(name) {
  return join(backupRoot(), name, 'SKILL.md');
}

function readState() {
  try {
    const j = JSON.parse(readFileSync(stateFile(), 'utf8'));
    if (j && typeof j.skills === 'object' && j.skills) return { version: 1, skills: j.skills };
  } catch {
    /* 首次运行 */
  }
  return { version: 1, skills: {} };
}

function writeState(state) {
  mkdirSync(join(dshHome(), 'skill-i18n'), { recursive: true });
  writeFileSync(stateFile(), JSON.stringify({ version: 1, skills: state.skills }, null, 2), 'utf8');
}

function readSettings() {
  try {
    const j = JSON.parse(readFileSync(settingsFile(), 'utf8'));
    if (j && typeof j === 'object') return { ...DEFAULTS, ...j };
  } catch {
    /* 首次运行 */
  }
  return { ...DEFAULTS };
}

function writeSettings(next) {
  mkdirSync(join(dshHome(), 'skill-i18n'), { recursive: true });
  writeFileSync(settingsFile(), JSON.stringify(next, null, 2), 'utf8');
}

function sha256(s) {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}

function backupSkill(name, text) {
  const dst = backupPath(name);
  if (existsSync(dst)) return false;
  mkdirSync(join(backupRoot(), name), { recursive: true });
  writeFileSync(dst, text, 'utf8');
  return true;
}

function listBackups() {
  const root = backupRoot();
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(root, e.name, 'SKILL.md')))
    .map((e) => e.name)
    .sort();
}

function locateDescription(text) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!fm) return null;
  const start = fm.index + fm[0].indexOf(fm[1]);
  const lines = fm[1].split(/\r?\n/);
  const idx = lines.findIndex((l) => /^description:/.test(l));
  if (idx < 0) return null;
  let end = idx + 1;
  while (end < lines.length && /^\s/.test(lines[end]) && lines[end].trim() !== '') end++;
  let offset = start;
  for (let i = 0; i < idx; i++) offset += lines[i].length + 1;
  return {
    offset,
    length: lines.slice(idx, end).join('\n').length,
    block: lines.slice(idx, end).join('\n'),
  };
}

function getDescription(text) {
  const loc = locateDescription(text);
  if (!loc) return null;
  return { raw: loc.block.replace(/^description:\s*/, '').trim(), loc };
}

function setDescription(text, value) {
  const loc = locateDescription(text);
  if (!loc) return null;
  return text.slice(0, loc.offset) + 'description: ' + JSON.stringify(value) + text.slice(loc.offset + loc.length);
}

function scanSkills(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const file = join(dir, entry.name, 'SKILL.md');
    if (!existsSync(file)) continue;
    try {
      if (!statSync(file).isFile()) continue;
    } catch {
      continue;
    }
    out.push({ name: entry.name, file });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** schedule → 分钟：>0 定时，0 仅启动，-1 关闭。 */
function resolveSchedule(raw) {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw > 0 ? raw : raw === 0 ? 0 : -1;
  if (typeof raw === 'string') {
    const k = raw.trim().toLowerCase();
    if (k in SCHEDULE_ALIAS) return SCHEDULE_ALIAS[k];
    const n = Number(k);
    if (Number.isFinite(n)) return n > 0 ? n : n === 0 ? 0 : -1;
  }
  return SCHEDULE_ALIAS[DEFAULTS.schedule];
}

function describeSchedule(minutes) {
  if (minutes < 0) return 'off（关闭自动翻译）';
  if (minutes === 0) return 'startup（仅启动时）';
  if (minutes === 60) return 'hourly（每小时）';
  if (minutes === 1440) return 'daily（每天）';
  return '每 ' + minutes + ' 分钟';
}

function normalizeOnly(value) {
  if (value === undefined || value === null) return null;
  const list = Array.isArray(value) ? value : [value];
  const out = list.map((v) => String(v || '').trim()).filter(Boolean);
  return out.length ? out : null;
}

export default {
  name: 'skill-i18n',
  inject: ['tools'],

  apply(ctx, config = {}) {
    const staticOptions = { ...DEFAULTS, ...(config && typeof config === 'object' ? config : {}) };
    const skillDir = staticOptions.skillDir || join(dshHome(), 'skills');
    let lastRunAt = 0;
    let startedAt = Date.now();
    let busy = false;

    const translator = () => ctx.get('translator');

    function currentSettings() {
      const s = readSettings();
      return { ...staticOptions, ...s, skillDir };
    }

    function llmRoute() {
      const adm = ctx.get('agentDefaultModel');
      if (!adm) return null;
      try {
        const sel = adm.currentSelection();
        if (sel && sel.provider && sel.model) return sel;
      } catch {
        /* 回退 */
      }
      return null;
    }

    async function translateWithLlm(text, route, settings) {
      const llm = ctx.get('llm');
      if (!llm) throw new Error('llm 服务不可用');
      const prompt =
        '把下面这段英文的技能描述翻译成简洁、自然的中文。只输出译文本身，不要加引号、不要解释、不要保留原文。\n\n' + text;
      const req = {
        provider: route.provider,
        model: route.model,
        maxTokens: 1400,
        temperature: 0,
        system: '你只做一件事：把给定的英文技能描述翻译成简体中文，直接输出译文，不输出任何解释或前后缀。',
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
      };
      if (route.reasoningEffort) req.reasoningEffort = route.reasoningEffort;
      let out = '';
      for await (const chunk of llm.stream(req)) {
        if (chunk.type === 'text-delta') out += chunk.text;
        else if (chunk.type === 'finish' && chunk.reason && chunk.reason.kind === 'error') {
          const f = chunk.reason.failure || {};
          throw new Error('模型调用失败: ' + (f.message || f.code || 'unknown'));
        } else if (chunk.type === 'finish' && chunk.reason && chunk.reason.kind === 'aborted') {
          throw new Error('模型调用被中止');
        }
      }
      return out.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').trim();
    }

    async function translateOne(skillName, text, settings, engineInfo) {
      if (settings.engine === 'glossary') {
        const hit = GLOSSARY[skillName];
        if (!hit) throw new Error('预制翻译表里没有这个技能（可切换到模型实时翻译）');
        return hit;
      }
      if (engineInfo.kind === 'translator') {
        const trimmed = text.length > settings.maxTextChars ? text.slice(0, settings.maxTextChars) : text;
        const spec = engineInfo.tr.resolve({
          text: trimmed,
          targetLanguage: settings.targetLanguage,
          sourceLanguage: settings.sourceLanguage,
          provider: engineInfo.provider,
        });
        return String((await engineInfo.tr.translate(spec)) || '').trim();
      }
      if (!engineInfo.route) throw new Error('没有可用的模型');
      const trimmed = text.length > settings.maxTextChars ? text.slice(0, settings.maxTextChars) : text;
      return translateWithLlm(trimmed, engineInfo.route, settings);
    }

    async function resolveEngine(settings) {
      if (settings.engine === 'glossary') return { kind: 'glossary' };
      const tr = translator();
      if (tr) {
        try {
          const providers = await tr.availableProviders();
          if (providers && providers.length) {
            const order = ['bing', 'google', 'deepseek-account', 'deepseek-official'];
            const picked = order.find((p) => providers.includes(p)) || providers[0];
            return { kind: 'translator', provider: picked, tr };
          }
        } catch {
          /* 落到 llm */
        }
      }
      const route = llmRoute();
      if (route) return { kind: 'llm', route };
      return { error: '模型实时翻译不可用：没有可用的 llm 模型' };
    }

    /** 翻译：only 为 null 时用 settings.skills（空数组视为全部）。 */
    async function runTranslate({ force = false, only = undefined } = {}) {
      if (busy) return { ok: false, error: '已有翻译任务在执行' };
      busy = true;
      try {
        const settings = currentSettings();
        const all = scanSkills(skillDir);
        const explicit = only !== undefined ? normalizeOnly(only) : normalizeOnly(settings.skills);
        const names = explicit;
        const skills = names === null ? all : all.filter((s) => names.includes(s.name));
        const notFound = names === null ? [] : names.filter((n) => !all.some((s) => s.name === n));

        if (skills.length === 0) {
          return { ok: true, total: 0, translated: 0, skipped: 0, failed: [], notFound, engine: settings.engine, note: '没有可处理的技能' };
        }

        const engineInfo = await resolveEngine(settings);
        if (engineInfo.error) return { ok: false, error: engineInfo.error, total: skills.length };

        const state = readState();
        let translated = 0;
        let restoredFromCache = 0;
        let skipped = 0;
        let backedUp = 0;
        const failed = [];

        for (const skill of skills) {
          let text;
          try {
            text = readFileSync(skill.file, 'utf8');
          } catch (e) {
            failed.push({ skill: skill.name, error: '读取失败: ' + (e.message || e) });
            continue;
          }
          const desc = getDescription(text);
          if (!desc) {
            skipped++;
            continue;
          }
          const current = desc.raw;
          if (!force && CJK.test(current)) {
            skipped++;
            continue;
          }
          const prev = state.skills[skill.name];
          if (prev && prev.original === current && prev.translated && !force) {
            if (prev.restored) {
              skipped++;
              continue;
            }
            try {
              if (backupSkill(skill.name, text)) backedUp++;
              writeFileSync(skill.file, setDescription(text, prev.translated), 'utf8');
              restoredFromCache++;
            } catch (e) {
              failed.push({ skill: skill.name, error: '写回缓存失败: ' + (e.message || e) });
            }
            continue;
          }
          try {
            const zh = await translateOne(skill.name, current, settings, engineInfo);
            if (!zh || !CJK.test(zh)) {
              failed.push({ skill: skill.name, error: '翻译结果为空或不含中文' });
              continue;
            }
            if (backupSkill(skill.name, text)) backedUp++;
            writeFileSync(skill.file, setDescription(text, zh), 'utf8');
            state.skills[skill.name] = {
              original: current,
              originalHash: sha256(current),
              translated: zh,
              restored: false,
              engine: settings.engine,
              updatedAt: new Date().toISOString(),
            };
            translated++;
          } catch (e) {
            failed.push({ skill: skill.name, error: e && e.message ? e.message : String(e) });
          }
          if (settings.engine !== 'glossary') await sleep(settings.gapMs);
        }

        writeState(state);
        lastRunAt = Date.now();
        return {
          ok: true,
          engine: engineInfo.kind,
          total: skills.length,
          translated,
          restoredFromCache,
          skipped,
          backedUp,
          failed,
          notFound,
        };
      } finally {
        busy = false;
      }
    }

    async function runRestore({ only = undefined, fromBackup = false } = {}) {
      const settings = currentSettings();
      const names = only !== undefined ? normalizeOnly(only) : normalizeOnly(settings.skills);
      const state = readState();

      if (fromBackup) {
        const available = listBackups();
        const picked = names === null ? available : available.filter((n) => names.includes(n));
        const notFound = names === null ? [] : names.filter((n) => !available.includes(n));
        let restored = 0;
        let missing = 0;
        const failed = [];
        for (const name of picked) {
          const dir = join(skillDir, name);
          if (!existsSync(dir)) {
            missing++;
            continue;
          }
          try {
            copyFileSync(backupPath(name), join(dir, 'SKILL.md'));
            if (state.skills[name]) state.skills[name].restored = true;
            restored++;
          } catch (e) {
            failed.push({ skill: name, error: e.message || String(e) });
          }
        }
        writeState(state);
        return { ok: true, mode: 'backup', tracked: available.length, restored, missing, failed, notFound };
      }

      const tracked = Object.keys(state.skills);
      const targets = names === null ? tracked : tracked.filter((n) => names.includes(n));
      const notFound = names === null ? [] : names.filter((n) => !tracked.includes(n));
      let restored = 0;
      let alreadyOriginal = 0;
      let missing = 0;
      const failed = [];

      for (const name of targets) {
        const file = join(skillDir, name, 'SKILL.md');
        if (!existsSync(file)) {
          missing++;
          continue;
        }
        let text;
        try {
          text = readFileSync(file, 'utf8');
        } catch (e) {
          failed.push({ skill: name, error: e.message || String(e) });
          continue;
        }
        const desc = getDescription(text);
        if (!desc) continue;
        const entry = state.skills[name];
        if (desc.raw === entry.original) {
          alreadyOriginal++;
          entry.restored = true;
          continue;
        }
        try {
          writeFileSync(file, setDescription(text, entry.original), 'utf8');
          entry.restored = true;
          restored++;
        } catch (e) {
          failed.push({ skill: name, error: e.message || String(e) });
        }
      }
      writeState(state);
      return { ok: true, mode: 'state', tracked: tracked.length, restored, alreadyOriginal, missing, failed, notFound };
    }

    function runStatus() {
      const settings = currentSettings();
      const state = readState();
      const skills = scanSkills(skillDir);
      let zh = 0;
      let en = 0;
      const pending = [];
      const untranslated = [];
      for (const skill of skills) {
        try {
          const desc = getDescription(readFileSync(skill.file, 'utf8'));
          if (!desc) continue;
          if (CJK.test(desc.raw)) zh++;
          else {
            en++;
            pending.push(skill.name);
            if (!GLOSSARY[skill.name]) untranslated.push(skill.name);
          }
        } catch {
          /* 忽略 */
        }
      }
      const minutes = resolveSchedule(settings.schedule);
      return {
        ok: true,
        skillDir,
        engine: settings.engine,
        engineLabel: settings.engine === 'glossary' ? '预制翻译表' : '模型实时翻译',
        schedule: describeSchedule(minutes),
        scheduleValue: settings.schedule,
        targetLanguage: settings.targetLanguage,
        skillsFilter: settings.skills || [],
        total: skills.length,
        chinese: zh,
        english: en,
        pending,
        glossaryCoverage: skills.filter((s) => GLOSSARY[s.name]).length,
        tracked: Object.keys(state.skills).length,
        backups: listBackups().length,
        lastRunAt: lastRunAt ? new Date(lastRunAt).toISOString() : null,
        stateFile: stateFile(),
        settingsFile: settingsFile(),
        backupDir: backupRoot(),
      };
    }

    // ---- 供设置页调用的 HTTP 接口 ----
    const webServer = ctx.get('webServer');
    if (webServer) {
      const routes = [
        {
          path: '/skill-i18n/status',
          handler: (req, res) => sendJson(res, 200, runStatus()),
        },
        {
          path: '/skill-i18n/settings',
          handler: async (req, res) => {
            if (req.method === 'GET') {
              sendJson(res, 200, { ok: true, settings: currentSettings() });
              return;
            }
            const body = await readJsonBody(req);
            if (!body || typeof body !== 'object') {
              sendJson(res, 400, { ok: false, error: 'bad-body' });
              return;
            }
            const merged = { ...currentSettings(), ...body };
            writeSettings({
              engine: merged.engine,
              schedule: merged.schedule,
              targetLanguage: merged.targetLanguage,
              skills: Array.isArray(merged.skills) ? merged.skills : [],
            });
            sendJson(res, 200, { ok: true, settings: currentSettings() });
          },
        },
        {
          path: '/skill-i18n/run',
          handler: async (req, res) => {
            const body = await readJsonBody(req);
            if (!body || typeof body.action !== 'string') {
              sendJson(res, 400, { ok: false, error: 'bad-action' });
              return;
            }
            if (body.action === 'translate') {
              sendJson(res, 200, await runTranslate({ force: Boolean(body.force), only: body.skills }));
            } else if (body.action === 'restore') {
              sendJson(res, 200, await runRestore({ only: body.skills, fromBackup: Boolean(body.fromBackup) }));
            } else if (body.action === 'status') {
              sendJson(res, 200, runStatus());
            } else {
              sendJson(res, 400, { ok: false, error: 'unknown-action' });
            }
          },
        },
      ];
      for (const r of routes) {
        // 同时挂载 /api 前缀与无前缀两种路径：不同宿主（Electron 内嵌页 / 浏览器页）网关不同
        for (const p of [r.path, '/api' + r.path]) {
          ctx.effect(() => webServer.register({ kind: 'exact', path: p, handler: r.handler }));
        }
      }
      log('http routes: GET /skill-i18n/status, GET|POST /skill-i18n/settings, POST /skill-i18n/run');
    }

    // ---- 工具（与设置页共用同一套逻辑）----
    ctx.tools.register({
      name: 'skill_i18n',
      description:
        '管理技能描述的中文翻译：status 查看状态，translate 翻译（skills 只翻指定技能、force 强制重译），restore 还原（skills 限定、fromBackup 用完整备份回滚）。引擎与频率在「设置 → 技能翻译」里配置。',
      parameters: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['status', 'translate', 'restore'] },
          skills: { type: 'array', items: { type: 'string' }, description: '只处理这些技能（省略则按设置）' },
          force: { type: 'boolean', description: 'translate 时强制重译' },
          fromBackup: { type: 'boolean', description: 'restore 时用完整备份覆盖' },
        },
        required: ['action'],
        additionalProperties: false,
      },
      output: {
        schema: { type: 'object' },
        render(args, value) {
          return [{ type: 'text', text: JSON.stringify(value, null, 2) }];
        },
      },
      async execute(args) {
        const action = args && args.action;
        const skills = args && args.skills ? normalizeOnly(args.skills) : undefined;
        if (action === 'status') return runStatus();
        if (action === 'translate') return runTranslate({ force: Boolean(args && args.force), only: skills });
        if (action === 'restore') return runRestore({ only: skills, fromBackup: Boolean(args && args.fromBackup) });
        return { ok: false, error: '未知 action: ' + String(action) };
      },
    });

    // ---- 启动时的一次性执行 ----
    ctx.effect(() => {
      const timer = setTimeout(() => {
        const s = currentSettings();
        if (resolveSchedule(s.schedule) === -1) return;
        runTranslate().catch((e) => log('startup translate failed:', e && e.message ? e.message : e));
      }, staticOptions.autoRunDelayMs);
      return () => clearTimeout(timer);
    });

    // ---- 每分钟检查一次，按当前设置决定是否该跑（改配置立即生效，无需重载）----
    ctx.effect(() => {
      const timer = setInterval(() => {
        const s = currentSettings();
        const minutes = resolveSchedule(s.schedule);
        if (minutes <= 0) return;
        const due = lastRunAt === 0 ? Date.now() - startedAt > minutes * 60000 : Date.now() - lastRunAt > minutes * 60000;
        if (!due) return;
        runTranslate().catch((e) => log('scheduled translate failed:', e && e.message ? e.message : e));
      }, TICK_MS);
      return () => clearInterval(timer);
    });

    log('loaded: skillDir=' + skillDir + ' engine=' + currentSettings().engine + ' schedule=' + currentSettings().schedule);
  },
};

// ---- HTTP 小工具 ----
async function readJsonBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}

function sendJson(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}
