# PAROL6 · 六轴机械臂 ROS2 整机系统

> **一句话定位**：从 6×闭环步进与 SocketCAN 唯一执行入口向上，打通 ROS2/MoveIt2 规划—连续碰撞审计—安全门执行，以 D405 RGB-D + 抓取过滤完成真机闭环抓放；VLM 仅做语义选目标，不绕过几何与安全层；MuJoCo 用于同模型动力学仿真与控制链验证。

**硬指标**：**20 mm 白色方块真机闭环抓放已跑通**（选取→接近→闭爪确认→抬升→释放，同一安全链）。手眼外参跨姿态验证不足时不签发给运动链。

![PAROL6 真机抓取演示](media/parol6/parol6-nostamp.mp4)

## 架构 · 权限隔离

![PAROL6 系统总架构](media/parol6/system-architecture.png)

```mermaid
flowchart LR
    A["任务/VLM<br/>仅 target_id+置信度"] --> B["D405 RGB-D 感知"]
    B --> C["TF2 / PlanningScene"]
    C --> D["MoveIt2 规划"]
    D --> E["轨迹与连续碰撞审计"]
    E --> F["FollowJointTrajectory"]
    F --> G["执行核心<br/>authority/lease/STOP"]
    G --> H["SocketCAN"]
    H --> I["6× 驱动器"]
    I --> J["状态回读/receipt"]
    J --> C
```

原则：**高层可提“做什么”，不可直控电机“怎么动”**；所有真机动作经同一坐标、规划、碰撞与安全检查。

## 3 个关键技术决策

### 1) 唯一执行入口 — 消灭“各自补 offset”

- **问题**：关节方向/零位/减速比/多圈在网页、ROS、脚本、驱动各补一套，RViz 对但真机偏。
- **选择**：SocketCAN 为唯一底层入口；方向/零位/减速比/多圈恢复收敛到统一坐标源。
- **证据**：[产品渲染](media/parol6/hero.png) / [系统架构](media/parol6/system-architecture.png)

### 2) 规划≠可执行 — 连续碰撞与执行终态审计

- **问题**：MoveIt2 规划成功仍可能碰撞、超限或 `stall`。
- **选择**：`robot_state` 新鲜度 → PlanningScene → 关节限位 → 整段轨迹连续碰撞 → 执行终态检查；异常从 `fresh` 状态重规划，不重放旧轨迹。
- **证据**：[抓取抬升](media/parol6/grasp-lift.png) / [释放位姿](media/parol6/release.png) / [三连成功](media/parol6/parol6-three-successes.mp4)

### 3) 感知分层 — RGB-D 定几何，VLM 定语义

- **问题**：VLM 直控电机不可控；纯几何又不懂“抓哪个”。
- **选择**：近场 GR-ConvNet 生成候选 + 桌面/夹爪 `self-mask`/可达性/尺寸过滤 + 闭爪后持物确认；VLM 仅输出 `target_id`，三维坐标仍由 RGB-D+TF2 计算。
- **仿真边界**：MuJoCo 配置质量/惯量/阻尼/`actuator`，观测 `qpos/qvel` 与控制响应，作动力学与控制链验证，不把重力补偿/计算力矩写作已完成真机能力。
- **证据**：[成功帧](media/parol6/success-066-01_抓取成功-01_两次中的第一次-contact.png) / [Isaac 数字孪生](media/parol6/isaac-overview.png)

## 量化结果

| 项 | 结果 | 条件 |
|---|---|---|
| 闭环抓放 | 已跑通 | 20 mm 白色方块，D405 近场，同一安全链 |
| 真机链路 | 打通 | 6×闭环步进 + CANable2 + SocketCAN + TF2/MoveIt2 |
| 仿真 | MuJoCo 动力学验证 | 同模型参数化，非真机控制能力口径 |

## 边界与可迁移

- 未把 VLM 输出直接接入执行层；多物体鲁棒性持续迭代。
- 手眼外参未充分跨姿态验证前不进入运动链。
- 可迁移：SocketCAN 唯一入口思想、TF2/PlanningScene 审计、抓取过滤与持物确认、安全门设计、MuJoCo 动力学验证方法。

> 深度文档：`content_out/P02-PAROL6/02-PAROL6六轴机械臂技术主文档.md`
