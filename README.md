# codeFormat

`codeFormat` 是一个在生成代码时加载项目格式规范的跨平台 Agent Plugin。

## 安装

```bash
codex plugin marketplace add howhyone/code_format
codex plugin add codeFormat@codeFormat-marketplace
```

## 使用

安装后，直接描述代码需求即可。插件会在会话、用户请求和子 Agent 启动时加载项目格式配置，并约束新生成的代码。

也可以主动调用 `/code-format`，提醒当前请求遵守项目格式。

插件只约束本次生成内容，不会扫描、格式化或修改未被用户要求处理的已有文件。

支持读取常见配置：`.editorconfig`、Prettier、ESLint、SwiftFormat、`pyproject.toml`、Ruff、Biome 等。插件只读取配置路径并要求 Agent 在生成前查看相关内容，不替代项目已有 formatter。

## 安全边界

插件只读取项目格式配置，不执行 formatter，不修改文件，也不上传代码。Hook 失败时会自动放行主会话。

跨平台入口：Codex / Claude、Cursor、GitHub Copilot 和 Qoder。可设置 `CODE_FORMAT_OFF=1` 跳过当前 Hook 注入。

## 许可证

MIT
