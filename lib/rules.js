/**
 * 拦截规则。
 *
 * 每一条都来自 2026-11-23 那天的真实事故，而不是泛泛的"危险命令列表"：
 *   - 盲点坐标操作鼠标键盘，两次误触用户的其他窗口（弹出开始菜单、打开别的应用并切全屏）
 *   - 试图写系统 hosts 才发现没有管理员权限，白费一轮
 *   - 不可逆的递归删除
 *   - 把 token 明文拼进命令行或网络请求
 *
 * 命中后返回 { kind: 'ask' }：交给审批层让用户决定，而不是直接拒绝——
 * 直接拒绝会让用户失去放行手段。
 */

const SHELL_TOOLS = new Set(['pwsh', 'bash', 'sh', 'shell', 'cmd']);

export const RULES = [
    {
        id: 'input-simulation',
        label: '模拟键盘/鼠标',
        patterns: [
            /SendKeys/i,
            /mouse_event/i,
            /SetCursorPos/i,
            /keybd_event/i,
            /\bSendInput\b/i,
            /\bBlockInput\b/i,
        ],
        why: '会向当前活动窗口发送真实输入，可能点到你正在用的其他程序',
    },
    {
        id: 'system-file',
        label: '修改系统级配置',
        patterns: [
            /drivers[\\/]+etc[\\/]+hosts/i,
            /\breg\s+(add|delete|import)\b/i,
            /\bnetsh\s+(interface|winsock|advfirewall)\b/i,
            /\bschtasks\b[^\n]*\/ru\s+system/i,
            /\bbcdedit\b/i,
        ],
        why: '需要管理员权限、影响整台机器，且回滚麻烦',
    },
    {
        id: 'destructive-delete',
        label: '不可逆删除',
        patterns: [
            /Remove-Item\b[^\n]*-Recurse[^\n]*-Force[^\n]*(?:[A-Za-z]:\\?\s*$|[A-Za-z]:\\(?:Windows|Users)\b)/i,
            /\bdel\b[^\n]*\/[sq][^\n]*[A-Za-z]:\\?\s*$/i,
            /\brm\s+-[a-z]*r[a-z]*f?[a-z]*\s+\/(?:\s|$)/i,
            /\bformat\s+[A-Za-z]:/i,
        ],
        why: '递归强制删除，删掉就没了',
    },
    {
        id: 'credential-exposure',
        label: '凭据明文外发',
        patterns: [
            /(?:ghp_|github_pat_|sk-)[A-Za-z0-9_\-]{20,}/,
        ],
        why: '命令行里出现明文 token，会留在历史记录、日志与进程列表里',
    },
];

/**
 * 检查一次工具调用是否命中规则。
 * @param {{name?:string, arguments?:Record<string, unknown>}} exec
 * @returns {{id:string,label:string,why:string,excerpt:string}|null}
 */
export function inspect(exec) {
    if (!exec || typeof exec !== 'object') return null;
    const name = String(exec.name || '');
    const args = exec.arguments && typeof exec.arguments === 'object' ? exec.arguments : {};

    // 只对命令行类工具看命令体；写文件类工具看目标路径
    let text = '';
    if (SHELL_TOOLS.has(name)) {
        text = [args.command, args.cmd, args.script, args.code].filter((v) => typeof v === 'string').join('\n');
    } else if (name === 'write' || name === 'edit' || name === 'read') {
        text = typeof args.file_path === 'string' ? args.file_path : '';
    }
    if (!text) return null;

    for (const rule of RULES) {
        for (const pattern of rule.patterns) {
            const m = text.match(pattern);
            if (!m) continue;
            const at = typeof m.index === 'number' ? m.index : 0;
            const excerpt = text.slice(Math.max(0, at - 30), at + Math.min(60, m[0].length + 30)).replace(/\s+/g, ' ').trim();
            return { id: rule.id, label: rule.label, why: rule.why, excerpt };
        }
    }
    return null;
}

/** 组装给审批层的说明文字。 */
export function describe(hit, toolName) {
    return `拦截 ${toolName}：${hit.label} —— ${hit.why}。命中片段：${hit.excerpt}`;
}
