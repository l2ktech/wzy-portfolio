这是一个把 **多任务 VLA 仿真训练、Quest 3 示教采集和 G2 真机部署**连起来的机器人学习项目。前半段在 AgiBotWorld R2A / GenieSim 中训练和评测 ACoT-VLA，后半段进入 RoboChallenge G2 真机任务，用 Pi0.5、数据治理和独立视觉确认继续推进真实抓取。

我主要负责**数据合同与任务适配、训练配置、checkpoint 评测、Quest 3 示教链、真机数据治理、Pi0.5 微调、Vision Sidecar、动作 Gate / Recovery 以及官方评测复盘**。OpenPI、ACoT、Pi0.5、GenieSim 和 LeRobot 都是上游框架或模型，我的工作重点是把它们接成一条真正可以训练、部署、评测和迭代的工程链。

## 项目由三部分组成

### 1. R2A / ACoT-VLA 多任务仿真训练

在 15 个机器人操作任务上对齐三路图像、state / action、Prompt、动作维度、单位、norm stats 和推理后处理，并通过 OpenPI Policy Server 接入 GenieSim / 官方评测。

### 2. Quest 3 示教采集

通过 WebXR、WebSocket Bridge 和 UDP 把 Quest 3 控制器动作映射到 GenieSim G2，同时记录 state、action、任务元数据和三路视频，再转换成后续训练可以使用的 LeRobot 数据。

### 3. RoboChallenge G2 真机

围绕超市货架抓取任务，对真实数据做清洗和重组，微调 Pi0.5，并在主策略外增加 Vision Sidecar、Verifier、Gate、Recovery 和 Safety Filter，处理“模型动作能出，但目标可能选错或执行不安全”的问题。

## 我负责的部分

- 对齐多任务训练和官方评测的数据合同；
- 处理图像、state/action、动作维度、单位、Prompt、norm stats 和后处理一致性；
- 组织短 probe、checkpoint 保存和 rollout 评测，避免只看 training loss；
- 搭建 Quest 3 → WebXR → WebSocket → UDP → GenieSim 的示教链；
- 对录制数据做 inspect、三路视频检查、accept / reject 和 LeRobot 转换；
- 清洗 RoboChallenge 真机数据，处理 Prompt 与真实动作不一致、静止尾段、错误持物等问题；
- 使用 Pi0.5 进行真机任务微调；
- 将 YOLO detector / classifier 独立成 Vision Sidecar，并用 Gate / Recovery 与主策略组合；
- 根据官方 rollout、Trace 和视频复盘真实失败，而不是只展示成功片段。

## 系统怎么工作

**多任务数据 / VR 示教 / 真机数据 → 数据检查与统一合同 → ACoT 或 Pi0.5 训练 → Policy Server / 真机推理 → 视觉确认与安全 Gate → 机器人执行 → rollout / 官方评测 → 失败复盘 → 回到数据和训练**

整个项目最核心的工作不是“换了哪个模型”，而是让**训练时的数据语义、推理时的输入输出以及机器人真正执行的动作保持一致**。

## 关键工程工作

### 1. 数据 shape 对了，不代表动作语义对了

R2A 链路同时包含三路视觉、183D / 159D state、40D 原始 action、实际参与控制的 21D 动作以及模型接口需要的 padding。左右臂顺序、rad / deg、绝对/相对动作、Prompt 和 denorm 只要有一处错位，程序仍然可能正常运行，但机器人行为已经错误。

因此我把这些约束收敛成统一数据合同，并在训练和评测前做机械检查，而不是等机器人表现异常后再猜原因。

### 2. 最后一个 checkpoint 不一定最好

R2A `all_15 round1` 官方评测中：

- **4K：0.389**；
- **约 10K：0.185**；
- **16K：0.173**；
- **约 20K：0.152**。

这说明继续训练并没有自动带来更好策略。后续流程改成短 probe、高频保存和尽早 rollout，用真实任务表现选 checkpoint，而不是默认训练越久越好。

### 3. Quest 3 把示教变成结构化数据

Quest 3 线最终确认留存 **42 episodes / 42 H5 / 126 MP4 / 约 13 GB**。真正重要的不是文件数量，而是控制器坐标映射、通信延迟、state/action/视频同步以及录制后的数据验收都进入了一条固定流程。

### 4. 真机数据先治理，再继续训练

RoboChallenge 真机数据从约 **2800 条候选 → 1362 条可追溯 RAW 数据 → 435 条高质量双手主集**。清洗重点包括 Prompt 与实际抓取目标不一致、抓取后错误状态、长时间静止尾段和多相机时间错位等问题。

这个过程让我更加确认：行为克隆会认真学习监督数据里的错误，因此**数据治理本身就是策略工程的一部分**。

### 5. VLA 外面再加一层独立视觉确认

真机失败表明“目标在画面里”不等于策略一定抓对那个实例。因此主策略外增加独立 Vision Sidecar，让 detector / classifier 提供目标证据，再由 Verifier 和 Gate 决定当前动作是否允许继续；不满足条件时进入 Recovery，而不是让策略无条件执行到底。

## 项目结果

目前可以明确核对的代表性结果包括：

- R2A 15 任务 `all_15 round1` 最佳已评 checkpoint：**4K = 0.389**；
- Quest 3 示教链：**42 episodes / 126 路视频文件**完成验收留存；
- RoboChallenge 单目标官方评测：**79 分 / Success Rate 0.6 / 11 rollouts**；
- 双目标任务目前仍不稳定，历史 13 次 rollout 只有 **1 次完整成功**。

因此这个项目的价值不是“已经把所有 VLA 任务做成熟”，而是我完整经历了**仿真训练 → 数据合同 → VR 示教 → 真机数据治理 → VLA 微调 → 视觉确认 → 官方评测 → 失败复盘**这条链路，并且知道如何根据真实失败回到正确的工程层继续处理。

## 技术栈

**ACoT-VLA · OpenPI · Pi0.5 · LeRobot · AgiBotWorld R2A · GenieSim · Quest 3 / WebXR · G2 · YOLO · Vision Sidecar · JAX / PyTorch · 多模态机器人学习**
