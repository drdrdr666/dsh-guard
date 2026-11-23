/**
 * dsh-guard —— 在工具执行前拦下几类已知会造成损失的操作。
 *
 * 与普通插件的区别：它不注册工具、不等人调用，而是挂在 `tools/pre-execute`
 * 上，命中规则就返回 `{ kind: 'ask' }`，由审批层弹出确认。用户可以选择放行。
 *
 * 为什么用 ask 而不是 deny：deny 会让用户失去放行手段，而 ask 既打断又保留决定权。
 */

import { inspect, describe } from './lib/rules.js';

export const name = 'dsh-guard';

export const inject = [];

export function apply(ctx) {
    ctx.effect(function* () {
        yield ctx.on(
            'tools/pre-execute',
            async (exec, next) => {
                let hit = null;
                try {
                    hit = inspect(exec);
                } catch {
                    // 规则本身出问题不能让整条链路卡死
                    return next();
                }
                if (!hit) return next();
                return {
                    kind: 'ask',
                    reason: describe(hit, String(exec?.name || 'tool')),
                    displayReason: `${hit.label}：${hit.why}`,
                };
            },
            { prepend: true },
        );
    }, 'dsh-guard: pre-execute');
}
