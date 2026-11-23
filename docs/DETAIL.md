# 操作守卫

普通插件是“注册一个工具，等人来调”。这个插件反过来：它挂在工具执行前的那道钩子上，命中规则就**打断**，由你决定放行还是中止。

## 为什么需要它

2026-11-23 那天发生过两次：AI 为了替用户点按钮，用坐标盲点鼠标——一次点到任务栏弹出开始菜单，一次因为焦点在别的窗口，直接打开了另一个应用并切成全屏。用户正在用的窗口被干扰。

还有一次是想写系统 `hosts`，写了一轮才发现没有管理员权限，白费功夫。

这类问题的共同点：**损失发生在用户来得及喊停之前**。所以守卫要站在执行前，而不是事后报告。

## 拦什么

| 类别 | 典型模式 | 为什么拦 |
|---|---|---|
| 模拟键盘/鼠标 | `SendKeys`、`mouse_event`、`SetCursorPos`、`keybd_event`、`SendInput` | 会向当前活动窗口发送真实输入，可能落到你正在用的其他程序里 |
| 修改系统级配置 | 写 `drivers\etc\hosts`、`reg add/delete`、`netsh interface/winsock/advfirewall`、`schtasks /ru SYSTEM`、`bcdedit` | 需要管理员权限、影响整台机器、回滚麻烦 |
| 不可逆删除 | `Remove-Item -Recurse -Force` 指向系统盘、`del /s /q C:\`、`rm -rf /`、`format X:` | 删掉就没了 |
| 凭据明文外发 | 命令行里出现 `ghp_…`、`github_pat_…`、`sk-…` 这类明文 token | 会留在 shell 历史、日志和进程列表里 |

## 为什么是“确认”而不是“直接拒绝”

直接拒绝会让用户失去放行手段——有些场景确实需要用，比如用户明确要求模拟输入来操作某个无 API 的程序。

所以命中时返回的是 `ask`：界面弹出确认，附上命中的片段与原因，你点放行才执行。**打断 + 保留决定权**，比单方面拒绝更实用。

## 不误伤

守卫最容易变成绊脚石的地方是过度匹配。测试里专门放了一组“必须零误伤”的正常命令样本：

```
node tests/run.mjs
git status --short
Get-ChildItem -Force
npm run build
echo hello
curl -s https://api.github.com/user
pwsh -c "Get-Process | Select-Object -First 3"
```

这些必须全部放行，否则守卫就不能装。

## 只看两处

- 命令行类工具（`pwsh` / `bash` / `sh` / `shell` / `cmd`）：看 `command` / `cmd` / `script` / `code` 参数
- 文件类工具（`write` / `edit` / `read`）：只看目标路径

其他工具（`todo_write`、`task_report` 等）不受影响。

## 限制

- 规则是**模式匹配**，不是语义理解。变形写法（拆字符串、base64）能绕过它。
- 只覆盖已知的四类；新事故需要新规则。
- 命中后是否真的执行，取决于审批层与用户的决定：审批策略为 `never` 时，`ask` 会被自动拒绝。
- 不做沙箱隔离，也不替代权限系统——它只是补一层“执行前的停顿”。

## 装配

```bash
pnpm add git+https://github.com/drdrdr666/dsh-guard.git
```

再把 `dsh-guard` 加进 profile 的 `bundles`。
