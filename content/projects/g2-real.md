这是 RoboChallenge **G2 真机抓取**项目，围绕超市货架抓取任务，用真实数据微调 Pi0.5，并在主策略外增加视觉确认和安全门，处理"模型动作能出，但目标可能选错或执行不安全"的问题。

项目覆盖**真机数据治理、Pi0.5 微调、Vision Sidecar、动作 Gate / Recovery 以及官方评测复盘**。Pi0.5、LeRobot、YOLO 为上游框架或模型，系统重点是把它们接成一条能真机运行、能排错、能复盘的链路。

![G2 真机抓取成功](media/robochallenge-g2/grasp-success.mp4)

## 项目目标

真机失败表明"目标在画面里"不等于策略一定抓对那个实例。因此重点解决：

- 如何把原始采集数据清洗成能训练的高质量主集；
- 如何让模型动作在真正执行前经过独立视觉确认和安全 Gate；
- 如何根据官方 rollout、Trace 和视频复盘真实失败，而不是只展示成功片段。

## 主要工作

- 清洗 RoboChallenge 真机数据，处理 Prompt 与真实动作不一致、静止尾段、错误持物等问题；
- 使用 Pi0.5 进行真机任务微调；
- 将 YOLO detector / classifier 独立成 Vision Sidecar，并用 Gate / Recovery 与主策略组合；
- 根据官方 rollout、Trace 和视频复盘真实失败，而不是只展示成功片段。

## 系统怎么工作

**真机数据 → 数据检查与治理 → Pi0.5 微调 → 真机推理 → 视觉确认与安全 Gate → 机器人执行 → rollout / 官方评测 → 失败复盘 → 回到数据和训练**

```mermaid
flowchart LR
    A["真机数据<br/>约 2800 条候选"] --> B["数据治理<br/>1362 可追溯 → 435 双手主集"]
    B --> C["Pi0.5 微调"]
    C --> D["真机推理"]
    D --> E["Vision Sidecar 视觉确认"]
    E --> F{"Verifier / Gate"}
    F -->|"拦截"| G["Recovery<br/>松开 · 后退 · 重观测"]
    G --> D
    F -->|"放行"| H["机器人执行"]
    H --> I["rollout / 官方评测"]
    I --> J["失败复盘"]
    J --> A
```

![G2 在线主链与证据闭环架构](media/robochallenge-g2/system-overview.png)

## 关键工程工作

### 1. 真机数据先治理，再继续训练

RoboChallenge 真机数据从约 **2800 条候选 → 1362 条可追溯 RAW 数据 → 435 条高质量双手主集**。清洗重点包括 Prompt 与实际抓取目标不一致、抓取后错误状态、长时间静止尾段和多相机时间错位等问题。

![G2 货架训练相机视角](media/robochallenge-g2/training-cameraview.png)

行为克隆会认真学习监督数据中的错误，因此**数据治理本身是策略工程的一部分**。

### 2. VLA 外面再加一层独立视觉确认

主策略外增加独立 Vision Sidecar，让 detector / classifier 提供目标证据，再由 Verifier 和 Gate 决定当前动作是否允许继续；不满足条件时进入 Recovery，而不是让策略无条件执行到底。

## 项目结果

- RoboChallenge 单目标官方评测：**79 分 / Success Rate 0.6 / 11 rollouts**（无公开榜单截图，不报排名）；
- 双目标研究线：**35.5 分 / SR 0.1 / 13 rollouts / 1 次完整成功**，瓶颈在相似实例选择与双手状态管理，仍在持续迭代。

![饮料抓取比赛](media/robochallenge-g2/g2-beverage-competition.png)

![饮料抓取项目](media/robochallenge-g2/g2-beverage-project.png)


## 技术栈

**Pi0.5 · LeRobot · OpenPI · G2 · YOLO · Vision Sidecar · Verifier / Gate / Recovery · JAX / PyTorch**
