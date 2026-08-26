# SO101 · 双臂毛巾折叠与 HIL 学习闭环

> **一句话定位**：三路相机 + Pi0.5 12D 双臂控制完成毛巾折叠长时序任务，先以固定协议建立可复现基线，再用 HIL/DAgger 采集“策略自己会犯的错”，经 Value→Advantage→ACP 做定向再训练并固定条件复测。

**硬指标（固定条件、无人工接管）**：**D0 基线 6/10 → 定向纠错与再训练后 7/10**（`N=10`，同时改动数据/动作/训练，不外推为长期成功率，不单归因某模块）。验证域为 **Level 1：初始相对平整毛巾**。

![双臂毛巾折叠演示](media/evo-rl/evo-rl-cropped.mp4)

## 架构 · 失败回流闭环

```mermaid
flowchart LR
    A["示教数据"] --> B["分阶段训练<br/>P1→P1+P2→双臂P3→P2+P3→P3+P4"]
    B --> C["Full D0 基线 6/10"]
    C --> D["真机 rollout"]
    D --> E["记录失败状态"]
    E --> F["HIL 定向纠错<br/>短暂接管+保存 intervention"]
    F --> G["Value→Advantage→ACP"]
    G --> H["Pi0.5 再训练"]
    H --> I["固定协议复测 7/10"]
    I --> D
```

核心：**先让真机暴露失败分布，再针对该分布补数据与训练**，而非盲目加示教。

## 3 个关键技术决策

### 1) 分阶段合成 — 降低长时序误差累积

- **问题**：抓边→折叠→转场→对齐→放盘误差逐段累积，端到端一次学会不稳定。
- **选择**：拆 5 阶段递进训练约 35h，再录 50 个完整 `episode` 从前阶段权重 `warm-start` 训练 Full D0，消除人工切 `prompt` 依赖。
- **证据**：[D0 成功 00](media/evo-rl/d0-ep00-success-xiaomi-contact.png) / [05](media/evo-rl/d0-ep05-success-xiaomi-contact.png) / [07](media/evo-rl/d0-ep07-success-xiaomi-contact.png)

### 2) 先排动作链，再谈模型

- **问题**：不动或大幅跳动可能是执行链而非模型。
- **选择**：按 `raw model output → processor/postprocessor → action_to_send → sent_action → 执行` 逐层排障；加启动前 `action gate`、运行参数与 `sent_action` 日志。
- **发现**：训练/推理环境不一致与 `runtime action processing` 路径分叉均曾导致异常；需把模型输出与执行链异常分离定位。

### 3) HIL + Value/Advantage/ACP — 只补会遇到的失败

- **问题**：加“完美示教”补不到策略真实访问的失败状态。
- **选择**：策略自主执行，仅在偏离/失败前短暂接管并记录 `policy_action / is_intervention / state / success`；Value 估计状态质量，`Advantage` 选片段，`ACP` 构正/负条件做条件模仿学习（离线改进，非在线 RL 探索）。
- **证据**：[HIL 接管](media/evo-rl/hil-active-xiaomi.mp4) / [Value 叠加](media/evo-rl/value-overlay.png) / [三连成功](media/evo-rl/evo-rl-three-successes.mp4)

## 量化结果

| 版本 | 固定协议纯策略 | N | 条件 |
|---|---|---|---|
| D0 基线 | **6/10** | 10 | 同一流程、无接管 |
| 定向纠错+ACP 再训练 | **7/10** | 10 | 同上，固定复测 |

> `N=10` 统计效力有限；提升为联合改动结果，不单归因。

## 边界与可迁移

- 未覆盖 Level 2 凌乱毛巾的找角/展开/失败恢复。
- `Value/Advantage/ACP` 为离线条件模仿路线，非真机在线探索式 RL。
- 可迁移：长任务分阶段合成、动作链分层排障、`is_intervention` 数据闭环、离线质量驱动的再训练范式。

> 深度文档：`content_out/P03-RLT/09-EvoRL双臂毛巾折叠技术主文档.md`
