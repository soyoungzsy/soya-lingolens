# Contributing to Soya LingoLens

感谢你愿意帮助改进 Soya LingoLens。

## 提交 Issue

Bug 报告请尽量包含：

- Chrome 版本和操作系统。
- 出现问题的网站类型；涉及隐私时请勿粘贴敏感网址或正文。
- 可以复现问题的最小步骤。
- 预期结果和实际结果。
- 扩展版本，以及 `chrome://extensions/` 中显示的错误信息。

功能建议请描述要解决的学习问题，而不仅是界面或实现方案。

## 本地开发

1. Fork 并 clone 仓库。
2. 在 Chrome 打开 `chrome://extensions/`。
3. 开启开发者模式并加载项目根目录。
4. 修改代码后点击扩展卡片的“重新加载”，再刷新测试网页。

项目不需要安装依赖或运行构建命令。

## 提交前检查

```bash
node --check background.js
node --check content.js
node --check sidepanel.js
node --check options.js
python3 -m json.tool manifest.json > /dev/null
```

请同时在普通英文网页和 X/Twitter 上手动验证核心流程。

## 安全与隐私

- 禁止提交 API Key、访问令牌、Cookie、浏览记录或个人学习记录。
- 新增联网服务时，必须同步更新 `manifest.json`、README 和 `PRIVACY.md`。
- 不要扩大网站权限，除非功能明确需要并已在 README 中解释。
- 不要加入分析埋点、广告或隐蔽的数据收集。

## Pull Request

- 每个 PR 聚焦一个问题。
- 描述改动原因、用户影响和验证方法。
- 涉及界面时附上前后截图。
- 涉及存储结构时说明兼容和迁移策略。

