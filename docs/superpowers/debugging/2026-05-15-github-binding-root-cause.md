# GitHub 绑定失败根因分析

## 结论

当前 GitHub 绑定失败的根因不是 UI，也不是仓库 URL 格式，而是**执行绑定时所在环境没有可用的 GitHub 认证链**。

在这台机器上验证到：

- `gh` 命令不可用
- 对 `https://github.com/CBookShu/note_0513` 执行 `git ls-remote` 时直接失败
- 错误是：

```text
fatal: could not read Username for 'https://github.com': Device not configured
```

这说明 Git 在访问 GitHub HTTPS 远端时，无法拿到用户名/凭证，且当前环境也没有可用的交互式认证路径。

## 复现步骤

### 1. 直接验证 Git 远端访问

```bash
git ls-remote https://github.com/CBookShu/note_0513 HEAD
```

结果：

```text
fatal: could not read Username for 'https://github.com': Device not configured
```

### 2. 验证 GitHub CLI 是否可用

```bash
gh auth status
```

结果：

```text
zsh:1: command not found: gh
```

### 3. 验证应用绑定链路

在 Tomato App 的设置页中填写：

- 远程地址：`https://github.com/CBookShu/note_0513`
- 目标分支：`main`

点击 `绑定远程` 后，页面显示绑定失败，并回传 Git 的用户名读取错误。

## 代码路径

绑定链路会走到：

1. Renderer 的设置页提交远程地址和分支
2. Main 进程的 `sync:bind-repository`
3. `SyncService.bindRepository(...)`
4. `GitClient.addRemote(...)` / `GitClient.getRemoteDefaultBranch(...)`
5. Git 对 GitHub HTTPS 远端发起认证访问
6. 因为当前环境没有可用凭证，Git 失败

相关文件：

- [`tomato_app/src/main/sync/sync-service.ts`](/Users/cbookshu/dev/temp/tomato_app/tomato_app/src/main/sync/sync-service.ts)
- [`tomato_app/src/main/sync/git-credentials.ts`](/Users/cbookshu/dev/temp/tomato_app/tomato_app/src/main/sync/git-credentials.ts)
- [`tomato_app/src/main/sync/repository-binding.ts`](/Users/cbookshu/dev/temp/tomato_app/tomato_app/src/main/sync/repository-binding.ts)
- [`tomato_app/src/renderer/components/Sync/SyncSettings.tsx`](/Users/cbookshu/dev/temp/tomato_app/tomato_app/src/renderer/components/Sync/SyncSettings.tsx)

## 关键证据

- `gh` 不存在，说明本机没有 GitHub CLI 认证工具可直接使用
- `git ls-remote` 失败，说明不是 UI 控件问题，而是 Git 访问远端时卡在认证
- 应用当前的 `createGitCredentialEnv()` 没有注入额外 GitHub 凭证环境

## 影响

这意味着：

- 在该环境里，GitHub HTTPS 仓库无法完成绑定
- 绑定流程能把 URL 和分支传到 Git 层，但无法跨过认证
- 当前失败属于**本机认证准备不足**，不是仓库绑定 UI 本身的 bug

## 建议的下一步

要让 GitHub 绑定真正通过，必须先让本机具备可用的 GitHub 认证方式，例如：

- `gh auth login`
- Git Credential Manager
- SSH key
- 可用的 Personal Access Token 认证链

如果后续希望应用层面提供更友好的失败提示，可以把这个错误映射成“请先在本机完成 GitHub 认证”的可读提示，但这不改变根因本身。

## 本次验证状态

- 根因确认：完成
- 代码修复：未执行
- 文档记录：完成

