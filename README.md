# dsh-skill-i18n

自动把技能描述（`SKILL.md` frontmatter 的 `description`）翻译成中文，带设置页、可切引擎、频率可配、支持指定技能与两级回滚。

## 设置页

安装后出现在 **设置 → 技能翻译**（`settings.section`，order 90）。

页面能力：

| 区域 | 作用 |
|---|---|
| 翻译引擎 | 预制翻译表 / 模型实时翻译，开关切换，即时保存 |
| 扫描频率 | 每小时 / 每天 / 仅启动时 / 关闭 / 自定义分钟 |
| 只翻译指定技能 | 逗号分隔，留空 = 全部；同时作用于自动翻译与操作按钮 |
| 操作 | 立即翻译 / 强制重译 / 还原为英文 / 整文件回滚 |
| 当前状态 | 技能数、中英分布、已记录、已备份、预制表覆盖、待翻译列表 |

配置写入 `~/.dsh/skill-i18n/settings.json`，改动**立即生效**（Host 每分钟检查一次，按当前设置判断是否到点，不需要重启）。

## 两种翻译引擎

| 引擎 | 优点 | 代价 |
|---|---|---|
| `glossary`（默认） | 零消耗、结果稳定、措辞紧凑 | 只覆盖内置 35 个技能；表外技能跳过并提示 |
| `llm` | 任意技能、新技能自动处理、贴近原文结构 | 每条 50–80 tokens，35 个约 2–3k tokens |

翻译走 DSH 的 `llm` 服务（默认模型）。`translator` 服务在部分安装里只有类型定义、没有实现，插件会检测并回退。

## 两级回滚

| 方式 | 范围 |
|---|---|
| `restore` | 只把 `description` 写回原文，文件其它内容不动 |
| `restore({ fromBackup: true })` | 用 `~/.dsh/skill-i18n/backup/<技能>/SKILL.md` 覆盖整个文件 |

备份在**首次改写前**创建，之后不覆盖，所以永远是最初版本。

## 工具接口

```
skill_i18n({ action: "status" })
skill_i18n({ action: "translate", skills: ["resume-tailor"] })
skill_i18n({ action: "translate", force: true })
skill_i18n({ action: "restore", fromBackup: true })
```

## 数据位置

```
~/.dsh/skill-i18n/settings.json   设置页写入
~/.dsh/skill-i18n/state.json      原文 / 译文 / 是否已还原
~/.dsh/skill-i18n/backup/         整文件备份
```

## ⚠️ 维护注意（都是实际踩过的坑）

**1. Client 必须用内联样式**

`styles.insert(css)` 在设置页上下文里拿不到 `styles` 服务，注入会被静默跳过，页面退化成无样式：卡片没边框、SVG 图标撑满整屏。所有视觉必须写成内联 `style` 对象。

**2. SVG 必须写死 width/height**

没有 CSS 约束时 SVG 默认按容器铺满。图标统一 22×22 + `strokeWidth 1.6`。

**3. 客户端脚本不能有跨行字符串**

单引号/双引号字符串里出现真实换行是语法错误，整个 client bundle 解析失败，DSH 会报「启动脚本内容不完整」。长文案用模板字符串（反引号）。

**4. 包名不要带 `@scope`**

`@local/xxx` 这类名字在客户端清单 URL `/plugins/??pkg/client.js@pkg2/client.js` 里会和分隔符 `@` 冲突，容易退化成一个空占位脚本。用无作用域名（`dsh-skill-i18n`）。

**5. 接口地址要探测前缀**

DSH 桌面版页面跑在 `dsh-app://app/`，裸相对路径会被内部协议吃掉变成 404。Host 侧同时挂 `/skill-i18n/*` 与 `/api/skill-i18n/*`，Client 依次探测并缓存可用前缀。

**6. Host 拿服务要先取局部变量**

`ctx.get('webServer')` 之后要用局部变量调用，直接 `ctx.webServer.xxx` 会抛 `cannot get property without inject`。

**7. 推理型模型要给足 maxTokens**

`deepseek-flash` 之类会先花额度思考，`maxTokens: 300` 时正文常为空。当前设 1400 + 系统提示。

## 已知限制

- 只处理 `~/.dsh/skills`；DSH 安装包自带技能在 `app.asar` 里只读
- 插件自带技能在 `node_modules`，升级会覆盖，本插件不碰
- 只改 `description` 字段，技能正文不受影响
- 手动还原过的技能，内容未再变化前不会被自动翻回去
