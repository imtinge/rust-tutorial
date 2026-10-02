# 第17章 Rust 与 AI 生态：搭上 AI 快车

> **学习目标**
> - 看清 Rust 在 AI/大模型浪潮中的位置——为什么"研究用 Python，生产看 Rust"
> - 认识 Rust AI 生态的代表 crate（推理、训练、应用接入）
> - 学会接入 AI 的两条路线：本地推理 vs 调用 API
> - 亲手写一个命令行 AI 问答助手
>
> **预计学习时长**：1 小时

> 💡 **说明**：如果你暂时对 AI 方向不感兴趣，本章可以跳过，不影响后续实战项目。但 AI 是 Rust 生态增长最快的领域之一，了解一下不吃亏。

---

## 17.1 为什么 AI 圈看上了 Rust

大模型火了之后，一个分工悄悄形成了：**Python 负责"研究"，Rust 盯上"生产"**。

为什么？因为模型从实验室走向产品时，冒出来四个新需求：

| 需求 | Python 的尴尬 | Rust 的优势 |
|------|--------------|-------------|
| **推理要快** | Token 生成是延迟敏感服务，解释器开销拖后腿 | 零开销抽象，底层性能对标 C/C++ |
| **内存要可控** | 模型权重动辄几个 GB，OOM 一次就是一次事故 | 无 GC、确定性内存管理，用多少占多少 |
| **部署要简单** | "依赖地狱"：服务器上装环境能折腾一天 | 编译成单个二进制文件，扔上去就跑 |
| **并发要安全** | C++ 推理服务的 UAF（释放后使用）事故让人心累 | 编译期就把数据竞争拦在门外 |

> 💡 **比喻**：Python 像大学的化学实验室——药品全、仪器全、随取随用，最适合做实验；Rust 像工厂的自动化产线——建产线慢一点，但一旦建好，跑得又快又稳、成本还低。**实验成功后要量产，就该考虑 Rust 了。**

结果就是：HuggingFace 官方出手做了推理框架 **candle**（纯 Rust），开源推理引擎 **mistral.rs**、训练框架 **burn** 也都选择了 Rust。

---

## 17.2 生态地图：Rust × AI 四大块

> 📖 **术语解释 · 推理（Inference）与训练（Training）**：训练是"教模型学习"（算力大户，研究阶段做）；推理是"用学好的模型回答问题"（生产阶段的主要工作）。你平时用的 ChatGPT、Ollama，跑的都是推理。

| 领域 | 代表 crate | 一句话定位 |
|------|-----------|-----------|
| **推理引擎** | `candle` | HuggingFace 官方 Rust 推理框架（CPU/GPU 都能跑） |
| | `mistral.rs` | 高吞吐本地大模型推理服务 |
| | `ort` | ONNX Runtime 绑定（Windows 生态友好） |
| **训练** | `burn` | 通用深度学习框架（PyTorch 风格） |
| | `tch-rs` | PyTorch 的 Rust 绑定 |
| **嵌入与分词** | `fastembed` | 文本向量嵌入（做 RAG、语义搜索的原料） |
| | `tokenizers` | HuggingFace 分词器（模型输入的预处理） |
| **应用接入** | `ollama` | 本地 Ollama 服务的客户端 |
| | `async-openai` | OpenAI 兼容 API 的异步客户端 |
| **Agent 编排** | `llm-chain` | LLM 应用编排（链式调用、工具调用） |

> ⚠️ **新手坑**：AI 生态演进飞快——**动手前先看 crates.io 的最新版本和官方示例**，别信一年前的博客。这是 Rust AI 圈的常态：读最新文档，而不是读过时教程。

---

## 17.3 接入 AI 的两条路线

写 Rust AI 应用，你面前有两条路：

| | 路线一：本地推理 | 路线二：调用 API |
|---|---|---|
| 做法 | 用 `candle`/`ort` 直接在自家程序里跑模型 | 用 `reqwest`/`async-openai` 调模型服务 |
| 优点 | 数据不出门、无网络依赖、长期成本低 | 几行代码就能用最强的模型 |
| 缺点 | 要下几个 GB 的权重、调 GPU 参数有学习曲线 | 按次付费、依赖外部服务 |
| 适合 | 隐私敏感、离线场景、超高并发 | 快速验证、中小规模、绝大多数应用 |

> 📌 **要点**：新手路线二起步——它只需要你已经会的技能：结构体 + serde + HTTP 请求。模型逻辑在服务端，你写的是"高效、稳定、单二进制"的接入层，这正是市面上缺人的岗位。

### 实战热身：用 reqwest 调本地 Ollama

[Ollama](https://ollama.com) 是最流行的本地模型服务——一条命令安装，`ollama pull qwen3` 拉模型，`ollama serve` 启动服务。我们的 Rust 程序只需要给它发一个 HTTP POST：

```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
reqwest = { version = "0.12", features = ["json"] }
serde = { version = "1", features = ["derive"] }
```

```rust
use serde::{Deserialize, Serialize};

#[derive(Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: Vec<Message<'a>>,
    stream: bool,
}

#[derive(Serialize)]
struct Message<'a> {
    role: &'a str,
    content: &'a str,
}

// 响应结构体用"拥有数据"的 String：
// reqwest 的 .json() 需要 DeserializeOwned，借不出 &'a str
#[derive(Deserialize)]
struct ChatResponse {
    message: RespMessage,
}

#[derive(Deserialize)]
struct RespMessage {
    content: String,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let body = ChatRequest {
        model: "qwen3",
        messages: vec![
            Message { role: "system", content: "你是一个 Rust 导师，回答要简洁。" },
            Message { role: "user", content: "用一句话解释所有权" },
        ],
        stream: false,
    };

    let resp: ChatResponse = reqwest::Client::new()
        .post("http://localhost:11434/api/chat")
        .json(&body)
        .send()
        .await?
        .json()
        .await?;

    println!("模型回答：{}", resp.message.content);
    Ok(())
}
```

> 📌 **要点**：注意请求用 `&'a str` 借用（省内存），响应用 `String` 拥有（`DeserializeOwned` 的要求）——**所有权知识在这里真实派上用场**。`?` 把网络错误一路上抛，整段代码没有一个 `unwrap()`。

---

### 路线一示例：用 candle 在本地跑推理

`candle` 是 HuggingFace 官方的 Rust 推理框架，CPU/GPU 都能跑，让你直接在本机加载模型做推理、数据不出门。最小的"Hello World"是先理解它的底层积木——张量（Tensor）：

```toml
[dependencies]
candle-core = "0.6"
```

```rust
use candle_core::{Device, Tensor};

fn main() -> Result<(), candle_core::Error> {
    let device = Device::Cpu;
    // 张量就是"带形状的数组"，是模型计算的基本单位
    let a = Tensor::new(&[1.0f32, 2.0, 3.0], &device)?;
    let b = Tensor::new(&[10.0f32, 20.0, 30.0], &device)?;
    let c = (&a + &b)?; // 逐元素相加
    println!("{:?}", c.to_vec1::<f32>()?); // [11.0, 22.0, 33.0]
    Ok(())
}
```

> 💡 **说明**：真实推理要加载 `.safetensors` 权重、跑模型前向、做分词与后处理，代码从十几行起步。`candle` 仓库的 `candle-examples` 里有现成的 `llama`、`whisper`、`stable-diffusion` 等完整示例，照抄比从零写快得多。**动手前务必看 crate 最新文档**，版本迭代很快。

### 路线二进阶：用 async-openai 客户端

`reqwest` 适合理解原理，但生产里更推荐用封装好的 `async-openai`——它把请求/响应结构体、流式解析都做好了，你只关心业务逻辑：

```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
async-openai = "0.20"
```

```rust
use async_openai::{Client, config::OpenAIConfig};
use async_openai::types::{
    ChatCompletionRequestMessageArgs, CreateChatCompletionRequestArgs, Role,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 换成你的 key；兼容 OpenAI 及绝大多数 OpenAI 兼容服务
    let config = OpenAIConfig::new().with_api_key(std::env::var("OPENAI_API_KEY")?);
    let client = Client::with_config(config);

    let req = CreateChatCompletionRequestArgs::default()
        .model("gpt-4o-mini")
        .messages([
            ChatCompletionRequestMessageArgs::default()
                .role(Role::System)
                .content("你是一个简洁的 Rust 助教。")
                .build()?,
            ChatCompletionRequestMessageArgs::default()
                .role(Role::User)
                .content("用一句话解释生命周期")
                .build()?,
        ])
        .build()?;

    let resp = client.chat().completions().create(req).await?;
    if let Some(choice) = resp.choices.first() {
        println!("{}", choice.message.content.as_deref().unwrap_or("（空）"));
    }
    Ok(())
}
```

> ⚠️ **注意**：上面是 `async-openai` 0.20 左右的写法，**具体类型名/方法随版本会变**——以 `docs.rs/async-openai` 为准。它内部也用 `reqwest` + `serde`，你 17.3 练的"结构体 + HTTP"功底直接派上用场。

### 顺带一提：用 fastembed 做文本嵌入

做语义搜索 / RAG 的第一步，是把文字变成向量。`fastembed` 封装了轻量嵌入模型：

```toml
[dependencies]
fastembed = "2"
```

```rust
use fastembed::{TextEmbedding, InitOptions};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 首次运行会自动下载模型权重（约几十 MB）
    let model = TextEmbedding::try_new(Default::default())?;
    let embeddings = model.embed(vec!["你好，世界", "Rust 真快"], None)?;

    let v = &embeddings[0];
    println!("向量维度: {}", v.len());        // 通常 384 或 768
    println!("前 5 维: {:?}", &v[..5]);
    // 有了向量就能算余弦相似度：意思越近，得分越高
    Ok(())
}
```

> 📌 **要点**：嵌入（Embedding）把"语义"压进一串数字。两个句子语义越近，向量在空间里越靠近——这就是"语义搜索 / RAG"的数学基础。

### 训练侧一览：用 burn 定义模型

研究侧多用 Python 训练，但 Rust 也有通用深度学习框架 `burn`（PyTorch 风格）。下面示意如何定义一个最简单的两层 MLP 并前向：

```toml
[dependencies]
burn = { version = "0.13", features = ["std"] }
```

```rust
use burn::nn::{Linear, LinearConfig};
use burn::module::Module;
use burn::tensor::{Backend, Tensor};

#[derive(Module, Debug)]
pub struct Mlp<B: Backend> {
    linear: Linear<B>, // 一个线性层：y = x·W + b
}

impl<B: Backend> Mlp<B> {
    /// 一次前向：线性变换后接 ReLU 激活
    pub fn forward(&self, x: Tensor<B, 2>) -> Tensor<B, 2> {
        self.linear.forward(x).relu()
    }
}
```

> 💡 **说明**：上面是示意（略去了 `new()` 构造与训练循环）。`burn` 的最大卖点是能一份代码编译到 CPU/GPU/WebGPU 多种后端，且训练可完全用 Rust 写。多数团队生产里用**现成模型 + Rust 做接入与推理**，而非从零训练——所以比起 `burn`，先把 `candle` / `async-openai` / `fastembed` 用熟更划算。

---

## 17.4 课后练习

### 基础题

**1.** 把上面实战热身代码里的 `stream: false` 改成 `stream: true` 会发生什么？查资料说出原因（提示：流式响应是一行一个 JSON，不能用一次 `.json()` 反序列化）。

<details>
<summary>参考答案要点</summary>

服务端会持续返回多行 JSON（每行一个 token 增量），HTTP 连接不关闭。`resp.json()` 期待一个完整 JSON 文档，会一直等到超时。要消费流式响应，需按行读取（`bytes_stream()` + 按行切分），或直接用 `ollama`/`async-openai` 这类封装好的客户端 crate。
</details>

### 进阶题

**2.** 给请求结构体加一个 `temperature: f64` 字段（控制回答的"发散程度"，0.0 严谨、1.0 活跃），发请求验证模型回答风格的变化。

<details>
<summary>参考答案要点</summary>

在 `ChatRequest` 加 `temperature: f64`，构造时传 `temperature: 0.2`。Ollama 的 `/api/chat` 接受该可选字段（serde 序列化时字段名必须匹配）。发散度越高回答越发散，越低越确定。
</details>

### 挑战题

**3.** 用 `fastembed` crate（或其文档示例）把一句话转成向量，打印向量的前 5 个维度和总长度——这是搭建"语义搜索/RAG"的第一步。

<details>
<summary>参考答案要点</summary>

`fastembed` 的用法：`TextEmbedding::try_new(Default::default())?` 初始化，`model.embed(vec!["你好，世界"], false)?` 得到 `Vec<Embedding>`。向量的典型长度是 384 或 768（取决于模型），是 `Vec<f32>`。有了向量就能算余弦相似度，实现"意思相近的文本得分高"。
</details>

---

## 17.5 Mini Project：命令行 AI 问答助手

把实战热身升级成**多轮对话**：循环读用户输入，维护对话历史，支持 `quit` 退出——一个 60 行就能写完的"本地 ChatGPT 终端版"。

```rust
use serde::{Deserialize, Serialize};
use std::io::{self, Write};

#[derive(Serialize, Clone)]
struct Message {
    role: String,
    content: String,
}

#[derive(Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<Message>,
    stream: bool,
}

#[derive(Deserialize)]
struct ChatResponse {
    message: RespMessage,
}

#[derive(Deserialize)]
struct RespMessage {
    content: String,
}
```

```rust
async fn ask(
    client: &reqwest::Client,
    messages: Vec<Message>,
) -> Result<String, Box<dyn std::error::Error>> {
    let body = ChatRequest {
        model: String::from("qwen3"),
        messages,
        stream: false,
    };
    let resp: ChatResponse = client
        .post("http://localhost:11434/api/chat")
        .json(&body)
        .send()
        .await?
        .json()
        .await?;
    Ok(resp.message.content)
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let client = reqwest::Client::new();
    // system 消息设定 AI 的"人设"，全程保留在历史最前面
    let mut messages = vec![Message {
        role: String::from("system"),
        content: String::from("你是一个简洁友好的 Rust 助教。"),
    }];
    println!("🦀 AI 问答助手（输入 quit 退出）");
    loop {
        print!("你: ");
        io::stdout().flush()?;               // print! 不换行，要手动刷新缓冲
        let mut input = String::new();
        io::stdin().read_line(&mut input)?;
        let input = input.trim().to_string();
        if input.is_empty() || input == "quit" {
            break;
        }
        messages.push(Message { role: String::from("user"), content: input });
        match ask(&client, messages.clone()).await {
            Ok(reply) => {
                println!("AI: {}", reply);
                // 把 AI 的回答也记进历史，下一轮它才"记得"自己说过什么
                messages.push(Message { role: String::from("assistant"), content: reply });
            }
            Err(e) => {
                println!("请求失败: {}（先确认 ollama serve 已启动）", e);
                messages.pop();  // 撤回这条 user 消息，别让失败的对话污染历史
            }
        }
    }
    Ok(())
}
```

> 📌 **要点**：多轮对话的本质就一句话——**把历史消息原样发回去**。AI 没有记忆，你每轮把整个 `messages` 数组发给它，它才"记得"上文。这也是所有 ChatGPT 类应用的通用做法。

> 🦀 **恭喜！** 应用方向三部曲（WebAssembly、Cargo 进阶、AI 生态）到此完成。接下来就是 5 个实战项目——从实战 1 命令行 Todo 工具开始，一路写到实战 5 的 Axum Web API。而且你已经会调 AI 了——卡住时让它给你讲报错，比干瞪眼快十倍！

---

> ### 📝 记忆卡片
>
> **一句话**：Python 做研究，Rust 做生产——AI 应用接入层是 Rust 的新战场。
>
> **口诀**：本地推理用 `candle`，调 API 用 `reqwest`；多轮对话就是"历史原样发回去"。
>
> **三个判断题**（心里过一遍）：
> 1. Rust 的 AI 训练生态比 Python 更成熟 → ✗（研究侧 Python 仍是霸主，Rust 强在生产侧）
> 2. `reqwest` 发 JSON 请求用 `.json(&body)`，响应反序列化要求 `DeserializeOwned` → ✓
> 3. AI 有记忆，不用每轮都发完整历史 → ✗（无状态，必须每轮带上 `messages`）

---

## 自检清单

- [ ] 我能说出 Rust 在 AI 生产场景的四个优势（快、省内存、易部署、并发安全）
- [ ] 我知道推理和训练的区别
- [ ] 我认识 candle、burn、ollama、async-openai 各自的定位
- [ ] 我理解本地推理和调 API 两条路线的取舍
- [ ] 我能用 reqwest + serde 构造请求/响应结构体调用 HTTP API
- [ ] 我理解多轮对话要"把历史原样发回去"
- [ ] 我完成了命令行 AI 问答助手 mini project

---
