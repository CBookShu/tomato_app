# 同步功能使用说明

这份说明讲的是 Tomato App 的数据同步怎么用，重点包括：

- 需要先安装什么工具
- 怎么先验证本机 Git 认证是否可用
- 怎么在 App 里绑定远程仓库
- 怎么同步、解绑、处理冲突

当前同步方案不要求 App 内登录 GitHub。  
App 只负责连接你本机已经准备好的 Git 认证环境，然后把本地数据同步到你指定的远程仓库和分支。

## 1. 使用前准备

### 1.1 安装 Git

先确认本机已经安装 `git`：

```bash
git --version
```

如果命令不可用，先安装 Git。  
在 macOS 上通常可以用系统自带工具、Xcode Command Line Tools，或者包管理器安装。

### 1.2 选择一种 GitHub 认证方式

如果你要绑定的是 GitHub 仓库，先把本机 Git 认证准备好。可选方式有：

- `gh auth login`，适合 HTTPS
- Git Credential Manager，适合 HTTPS
- Personal Access Token，适合 HTTPS
- SSH key，适合 SSH

注意：

- App **不会**在内部打开 GitHub 授权页
- App **不会**要求你填写 OAuth `client ID`
- App 绑定时只会调用本机已经准备好的 Git 认证链

### 1.3 验证本机认证

绑定前，建议先在终端里做一次验证。

#### 方式 A：GitHub CLI

如果你安装了 `gh`，先检查状态：

```bash
gh auth status
```

如果没有登录，执行：

```bash
gh auth login -h github.com --git-protocol https
```

登录完成后，再执行一次：

```bash
gh auth status
```

#### 方式 B：直接验证仓库访问

用你准备绑定的远程地址做一次 Git 测试。

HTTPS 仓库示例：

```bash
git ls-remote https://github.com/<owner>/<repo>.git HEAD
```

SSH 仓库示例：

```bash
git ls-remote git@github.com:<owner>/<repo>.git HEAD
```

如果认证已经准备好，这条命令应该能正常返回远端信息。  
如果出现类似下面的错误，说明本机认证还没准备好：

```text
fatal: could not read Username for 'https://github.com': Device not configured
```

#### 方式 C：SSH 认证

如果你打算用 SSH 绑定 GitHub 仓库，可以先验证：

```bash
ssh -T git@github.com
```

如果返回的是 GitHub 的欢迎信息或认证成功提示，说明 SSH 认证可用。

### 1.4 先做一次终端侧验收

推荐在打开 App 之前，先确认下面至少一条命令能成功：

```bash
git ls-remote https://github.com/<owner>/<repo>.git HEAD
```

或者：

```bash
git ls-remote git@github.com:<owner>/<repo>.git HEAD
```

这一步通过后，App 里的 `绑定远程` 才有条件成功。

## 2. 在 App 里绑定仓库

### 2.1 打开同步设置

在 Tomato App 里进入：

1. `设置`
2. `数据同步`

### 2.2 填写远程地址和分支

在同步卡片里填写：

- `远程地址`
- `目标分支`

例如：

- 远程地址：`https://github.com/<owner>/<repo>.git`
- 目标分支：`main`

### 2.3 点击“绑定远程”

点击 `绑定远程` 后，App 会：

1. 检查远程地址和分支
2. 连接你的本机 Git 认证
3. 把本地数据目录初始化为 Git 仓库
4. 绑定远程
5. 执行首次同步或继续同步

### 2.4 绑定成功后的状态

绑定成功后，你会在设置页看到：

- 当前远程地址
- 当前分支
- 最近同步时间
- `立即同步` 按钮
- `解绑` 按钮

如果远端是空仓库，App 会自动完成首次推送。  
如果远端已经有内容，App 会按 Git 同步流程处理。

## 3. 日常同步怎么用

### 3.1 手动同步

在已经绑定的情况下，点击 `立即同步`。

App 会尽量保持本地数据优先：

- 本地有更新时会先保留本地内容
- 再和远端同步
- 遇到冲突时会停止并保留本地状态

### 3.2 冲突怎么处理

如果同步发生冲突，界面会显示：

- `有冲突`
- 冲突备份分支名
- `手动处理后继续同步`

处理方式：

1. 打开数据目录里的仓库，执行 `git status`
2. 查看哪些文件带有冲突标记
3. 在当前工作区把这些文件改好，删除冲突标记并保留你要的内容
4. 执行 `git add .`
5. 执行 `git commit` 完成这次合并
6. 回到 App，再点击 `手动处理后继续同步`

App 不会自动把你的本地内容清空，也不会自动覆盖成远端版本。
冲突备份分支只是保险，不建议直接把它拿去 merge。

### 3.3 解绑仓库

如果你想停止同步，可以点击 `解绑`。

解绑后：

- 只会清除绑定状态
- 不会删除你的本地数据
- 之后可以重新绑定别的远程仓库

## 4. 常见错误

### 4.1 `could not read Username for 'https://github.com'`

含义：

- 本机没有准备好 GitHub HTTPS 认证

处理：

1. 安装并登录 `gh`
2. 或配置 Git Credential Manager
3. 或改用 SSH 认证

### 4.2 绑定后一直显示同步失败

可能原因：

- 远程地址写错
- 目标分支写错
- 本机认证不可用
- 网络不通

先在终端里用 `git ls-remote <你的远程地址> HEAD` 验证一遍。

### 4.3 冲突后看不到“已同步”

这通常表示冲突还没有真正处理完。  
先解决本地冲突，再重新同步。

## 5. 推荐工作流

推荐你每次换机器或重新装系统时，按下面顺序做：

1. 安装 `git`
2. 选择并配置一种 GitHub 认证方式
3. 在终端里验证 `gh auth status` 或 `git ls-remote`
4. 打开 Tomato App
5. 在 `设置 > 数据同步` 里填写远程地址和目标分支
6. 点击 `绑定远程`
7. 绑定成功后按需点击 `立即同步`

## 6. 示例

如果你要绑定这个仓库：

- HTTPS 远程地址：`https://github.com/<owner>/<repo>.git`
- SSH 远程地址：`git@github.com:<owner>/<repo>.git`
- 目标分支：`main`

先在终端确认这条命令可用：

```bash
git ls-remote https://github.com/<owner>/<repo>.git HEAD
```

如果你用的是 SSH，再确认：

```bash
git ls-remote git@github.com:<owner>/<repo>.git HEAD
```

如果能正常返回结果，再回到 App 里点击 `绑定远程`。
