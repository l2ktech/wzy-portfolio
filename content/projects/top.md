这是一个面向薄壁件加工/检测场景的**超声在线测厚系统**。项目重点不是把很多算法堆在一起，而是把超声探头、DPL 采集板卡和 C++/Qt 上位机连成一条稳定的数据链：持续采集 A 扫回波，解析板卡数据，计算厚度，判断数据有效性，再完成波形显示、日志记录和网络输出。

我重点参与的是**C++/Qt 测厚上位机、数据采集与处理、通信链路以及软件问题分析**。这套系统本身包含历史模块和团队已有代码，因此这里把“当前源码能够直接确认的内容”和“项目背景”分开描述，不把缺少原始证据的指标或原型包装成正式成果。

<figure>
<img src="media/top/09_ultrasonic_wave_filtered_stable.jpg" alt="超声 A 扫回波界面">
<figcaption>超声 A 扫回波：界面/底面回波与门限位置用于观察测量状态和厚度计算条件。</figcaption>
</figure>

## 系统主线

```mermaid
flowchart LR
  A["超声探头"] --> B["DPL 采集板卡"]
  B --> C["C++ / Qt 上位机"]
  C --> D["数据解析"]
  D --> E["厚度计算 / 状态判断"]
  E --> F["一维 Kalman / 数据处理"]
  F --> G["UI / 日志 / 网络输出"]
```

### 1. 超声采集与厚度计算

超声测厚的基础关系是：

`厚度 = 声速 × 往返传播时间 / 2`

除以 2 是因为超声从探头传播到反射面后还要返回探头。真正的工程难点不是公式，而是如何从 A 扫波形中得到可信的回波位置，并区分正常回波、噪声、异常峰和失效数据。

P01 工程通过 DPL SDK 与采集板卡交互，源码中可以看到 `Board / BoardModel`、`Beam / BeamModel`、`ReceiveDataProcessManager`、`SendParamsManager` 等模块，用于板卡模型、声束数据、接收解析和参数下发。

<figure>
<img src="media/top/14_tp500_waveform_annotated.png" alt="超声波形标注示意">
<figcaption>A 扫波形及标注：用于理解波形位置、门限与实际测量量之间的关系。</figcaption>
</figure>

## C++ / Qt 上位机

主程序基于 Visual Studio + Qt，核心工程为 `P01-Thicknesstool-socket/ThicknessToolsDpl`。上位机承担的主要职责包括：

- DPL 板卡初始化、参数配置和数据接收；
- Beam / 测量数据解析；
- 厚度、水层距离等物理量计算与状态维护；
- A 扫波形、厚度和设备状态显示；
- 配置、日志与测量数据保存；
- TCP / UDP 等网络通信；
- 采集、UI、网络和定时任务之间的线程与时序管理。

这类工业上位机运行在 Windows + Qt 环境，因此我把它看成**软实时系统**：可以优化平均周期和响应速度，但不能把 Windows 调度、UI 刷新、驱动和网络抖动说成严格硬实时保证。

## 一维 Kalman：让连续厚度估计更稳定

项目中有一维 `KalmanFilter` 实现。这里的“一维”可以理解为：每个周期主要处理一个连续标量，例如当前厚度值。

当前源码中的核心更新过程为：

```cpp
X_Mid = X_Last;
P_Mid = P_Last + Q;
K = P_Mid / (P_Mid + R);
X_Now = X_Mid + K * (Z - X_Mid);
P_Now = (1 - K) * P_Mid;
```

默认参数为：

```cpp
Q = 0.0001f;
R = 0.01f;
```

其中 `Q` 表示过程模型的不确定性，`R` 表示测量噪声的不确定性。工程上更重要的一点是：**滤波变平滑不等于测量精度自动提高。** 如果原始数据已经无效、超时或明显异常，不能因为滤波器还能输出一个数，就继续把旧估计当成新的有效测量。

## 64 字节固定长度通信帧

P01 的 `WinSocketStruct.h` 定义了固定长度数据帧：

```text
2B  header
4B  count
2B  type
50B data（25 × 2B）
2B  reserver1
2B  reserver2
2B  footer
-----------------
64B total
```

源码还定义了最多 `20` 个客户端槽位。固定长度协议的优点是字段位置明确、解析成本低，也便于和工业侧已有接口对接；同时仍然需要注意字段偏移、字节序、异常长度、连接状态和超时等问题。

## Qt 线程与时序问题

项目源码中存在自定义 `MyTimer`：对象通过 `moveToThread()` 改变 QObject 的线程归属，工作线程启动后执行 `slot_Work()`。

```cpp
mThread = new QThread;
this->moveToThread(mThread);
connect(mThread, SIGNAL(started()), this, SLOT(slot_Work()));
```

当前高精度版本内部使用持续轮询：

```cpp
while (mIsStart)
{
    if (t.elapsed_microsecond() > mInterval * 1000)
    {
        t.restart();
        emit timeout();
    }
}
```

这种写法可以追求更细的时间间隔，但代价是可能持续占用 CPU。对我来说，这类代码比“用了多线程”本身更值得分析：需要结合线程 ID、CPU 占用、周期分布和事件循环行为判断它是否真的适合当前场景。

## 我在这个项目里关注的工程问题

这个项目让我重点处理和理解的是一条真实工业数据链，而不是单独某一个算法：

- **测量可信性**：一个数字能算出来，不代表这一拍就一定能用；
- **采集与显示解耦**：高频采集不能因为 UI 刷新而被无意义阻塞；
- **网络数据边界**：固定帧、字段解析、超时和连接状态都必须显式处理；
- **软实时边界**：Windows/Qt 可以优化，但不能承诺硬实时最坏执行时间；
- **可维护性**：板卡、Beam、数据处理、网络、UI 和日志需要有清楚的职责边界；
- **问题定位**：从波形、日志、线程、网络和源码路径逐层缩小故障范围。

## 当前可直接核对的代码证据

源码仓库：`l2ktech/24-My-thickCplusCode`

- `P01-Thicknesstool-socket/ThicknessToolsDpl/`：C++ / Qt 测厚上位机；
- `ReceiveDataProcessManager.*`：数据接收与解析；
- `SendParamsManager.*`：板卡参数下发；
- `Beam.* / BeamModel.*`：声束数据模型；
- `WinSocketStruct.h`：64 字节固定长度协议、25 个两字节数据、20 客户端槽位；
- `MyTimer.cpp`：QThread、`moveToThread()` 与高精度轮询实现；
- `P02-Thick_recive/LittleRocket/KalmanFilter.*`：一维 Kalman 的 Q/R 和预测更新实现。

## 项目展示原则

这个页面只保留当前能由源码、图片或原始资料支撑的内容。过去资料里出现过的一些完整 PID、D-S 融合、MPC / ADAMS-Simulink、固定精度和长期稳定运行数字，目前不作为这个项目页面的已确认成果展示。

对我而言，这个项目最有价值的部分，是把**传感器采集 → 数据解析 → 状态估计 → C++/Qt 软件 → 工业通信 → 工程排错**真正串成了一条可以从源码落到实际设备的数据链。
