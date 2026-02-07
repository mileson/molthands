# GitHub + Vercel 自动部署集成报告

> 生成时间: 2026-02-07
> 操作者: Claude Code

---

## 一、操作概述

本次操作完成了以下任务：
1. 创建 GitHub 私有仓库
2. 初始化本地 Git 并推送代码
3. 配置 Vercel 与 GitHub 的关联
4. 验证自动部署功能

---

## 二、环境变量配置

### 2.1 所需的凭证

在 `.env.local` 文件中添加以下配置：

```bash
# ===== GitHub 配置 =====
# GitHub Personal Access Token (用于创建仓库、推送代码)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx

# GitHub 用户名
GITHUB_USERNAME=你的用户名

# 默认仓库可见性 (public 或 private)
GITHUB_REPO_VISIBILITY=private

# ===== Vercel 配置 =====
# Vercel API Token (用于关联 GitHub 仓库)
VERCEL_TOKEN=xxxxxxxxxxxxxxxx
```

### 2.2 凭证获取方式

#### GitHub Token
1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token (classic)"
3. 勾选权限: `repo` (完整仓库访问权限)
4. 复制生成的 Token

#### Vercel Token
1. 访问 https://vercel.com/account/tokens
2. 点击 "Create Token"
3. 选择 "Full Account" 权限
4. 复制生成的 Token

---

## 三、操作步骤详解

### 步骤 1: 创建 GitHub 仓库

使用 GitHub API 创建仓库：

```bash
curl -X POST \
  -H "Authorization: token $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github.v3+json" \
  https://api.github.com/user/repos \
  -d '{
    "name": "molthands",
    "description": "MoltHands - OpenClaw Agent 任务协作平台",
    "private": true,
    "auto_init": false
  }'
```

**API 端点**: `POST /user/repos`
**关键参数**:
- `name`: 仓库名称
- `private`: 是否私有
- `description`: 仓库描述

### 步骤 2: 初始化本地 Git 并推送

```bash
# 初始化 Git
git init

# 添加所有文件
git add .

# 创建首次提交
git commit -m "Initial commit"

# 添加远程仓库
git remote add origin https://github.com/Mileson/molthands.git

# 推送到 main 分支
git branch -M main
git push -u origin main
```

### 步骤 3: 关联 GitHub 到 Vercel

使用 Vercel API 关联仓库：

```bash
curl -X POST \
  -H "Authorization: Bearer $VERCEL_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.vercel.com/v9/projects/{projectId}/link?teamId={teamId}" \
  -d '{
    "type": "github",
    "repo": "Mileson/molthands",
    "branch": "main"
  }'
```

**API 端点**: `POST /v9/projects/{projectId}/link`
**关键参数**:
- `type`: 固定为 "github"
- `repo`: GitHub 仓库路径 (owner/repo)
- `branch`: 生产分支名称

### 步骤 4: 验证关联状态

```bash
curl -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v9/projects/{projectId}?teamId={teamId}"
```

查看响应中的 `link` 字段确认关联成功。

---

## 四、关联验证结果

```
==================================================
   Vercel <-> GitHub 关联验证报告
==================================================

【Vercel 项目信息】
  项目名称: molthands
  项目ID: prj_YOUR_PROJECT_ID
  框架: nextjs

【GitHub 关联状态】
  关联类型: github
  仓库: Mileson/molthands
  生产分支: main
  仓库ID: YOUR_REPO_ID

【自动部署配置】
  Git评论: onPullRequest: true
  Git提供商选项: createDeployments: enabled

【部署域名】
  - www.molthands.com
  - molt-orpin.vercel.app
  - molthands.com

==================================================
   验证结果: 关联成功
==================================================
```

---

## 五、自动化工作流程

关联完成后，后续的代码更新流程：

```
┌─────────────────────────────────────────────────────────────────┐
│                     自动部署工作流                               │
│                                                                 │
│   ┌─────────────┐    git push    ┌─────────────┐               │
│   │  本地代码    │ ─────────────> │  GitHub     │               │
│   └─────────────┘                └──────┬──────┘               │
│                                         │                       │
│                                         │ webhook               │
│                                         ▼                       │
│                                  ┌─────────────┐                │
│                                  │   Vercel    │                │
│                                  │  自动构建    │                │
│                                  └──────┬──────┘                │
│                                         │                       │
│                                         │ deploy                │
│                                         ▼                       │
│                                  ┌─────────────┐                │
│                                  │ molthands   │                │
│                                  │   .com      │                │
│                                  └─────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

### 日常操作命令

```bash
# 1. 修改代码后
git add .

# 2. 提交更改
git commit -m "feat: 添加新功能"

# 3. 推送到 GitHub (自动触发 Vercel 部署)
git push origin main
```

---

## 六、安全注意事项

1. **Token 安全**:
   - GitHub Token 和 Vercel Token 已存储在 `.env.local`
   - `.gitignore` 已配置忽略 `.env*.local` 文件
   - 切勿将 Token 提交到代码仓库

2. **Token 刷新**:
   - 如果 Token 泄露，立即在对应平台撤销并重新生成
   - 更新 `.env.local` 中的 Token 值

3. **权限最小化**:
   - GitHub Token 仅需 `repo` 权限
   - Vercel Token 仅需项目读写权限

---

## 七、故障排查

### 问题 1: 推送后 Vercel 没有自动部署

**检查步骤**:
1. 确认 Vercel 项目已关联 GitHub 仓库
2. 确认分支名称与生产分支一致
3. 检查 Vercel Dashboard 的 Git 设置

### 问题 2: 关联失败

**可能原因**:
1. Vercel 没有访问该 GitHub 仓库的权限
2. 需要先在 Vercel Dashboard 安装 GitHub App

**解决方案**:
访问 https://vercel.com/account/integrations 确认 GitHub 集成状态

---

## 八、参考链接

- [GitHub API 文档](https://docs.github.com/en/rest)
- [Vercel API 文档](https://vercel.com/docs/rest-api)
- [Vercel Git 集成](https://vercel.com/docs/deployments/git)
