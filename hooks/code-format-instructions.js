#!/usr/bin/env node
// 脚本概要：在各 Agent 平台的生命周期事件中注入项目格式约束；只读配置，不修改代码。

const fs = require('fs');
const path = require('path');

const CONFIG_NAMES = [
  '.editorconfig', '.prettierrc', '.prettierrc.json', '.prettierrc.js',
  'prettier.config.js', 'eslint.config.js', '.eslintrc', '.eslintrc.json',
  '.swiftformat', 'swiftformat.json', 'pyproject.toml', 'ruff.toml',
  'biome.json', 'gofmt.toml', '.clang-format', 'rustfmt.toml', '.rustfmt.toml',
];

function projectRoot() {
  return process.env.CLAUDE_PROJECT_DIR || process.env.CURSOR_PROJECT_DIR || process.cwd();
}

function findConfigs() {
  const found = [];
  let dir = path.resolve(projectRoot());
  while (true) {
    for (const name of CONFIG_NAMES) {
      const file = path.join(dir, name);
      if (fs.existsSync(file)) found.push(path.relative(projectRoot(), file) || name);
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return [...new Set(found)];
}

function context() {
  if (process.env.CODE_FORMAT_OFF === '1') return '';
  const configs = findConfigs();
  const configLine = configs.length
    ? `检测到项目格式配置：${configs.join('、')}。生成前先读取与本次文件相关的配置。`
    : '未检测到项目格式配置，使用语言和框架的默认格式规范。';
  return [
    'CODE FORMAT ACTIVE',
    '生成或修改代码前，先读取项目格式配置和相邻代码，严格遵守项目已有格式。',
    configLine,
    '适用于任何语言：遵守该语言和框架的常规格式，保持语句、表达式和调用的可读换行，不要为了压缩代码把多个独立操作拼到同一行。',
    '保持缩进、换行、括号、命名、导入顺序和文件组织一致。只约束本次生成内容，不主动扫描或修改其他已有文件。',
  ].join('\n');
}

function writeOutput(event, text, platform = process.env.CODE_FORMAT_PLATFORM || 'legacy') {
  if (!text) return;
  if (platform === 'copilot') {
    process.stdout.write(JSON.stringify({ additionalContext: text }));
  } else if (platform === 'qoder') {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } }));
  } else if (platform === 'cursor') {
    process.stdout.write(JSON.stringify({ additional_context: text, ...(event === 'UserPromptSubmit' ? { continue: true } : {}) }));
  } else if (event === 'SubagentStart') {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } }));
  } else {
    process.stdout.write(text);
  }
}

const event = process.env.CODE_FORMAT_EVENT || 'SessionStart';
try { writeOutput(event, context()); } catch (_) { /* 格式约束失败时放行主会话 */ }
