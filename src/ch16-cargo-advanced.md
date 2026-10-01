# 第16章 Cargo 进阶：从学习到生产

> **学习目标**
> - 掌握工作空间（Workspace）组织多 crate 项目
> - 学会用 features 实现条件编译
> - 了解发布 crate 到 crates.io 的流程
> - 掌握 Cargo.toml 依赖管理的进阶技巧
>
> **预计学习时长**：2-3 小时

---

## 16.1 为什么需要 Cargo 进阶？

前面 15 章你写的都是"单个项目"。但当项目变大——比如一个 Web 服务带 CLI 工具带共享库——单 crate 就不够用了。

> 💡 **比喻**：单 crate 就像一人小作坊——所有工具混在一个房间里。工作空间就像把作坊升级成工厂——车间（crate）分开，仓库（依赖）共享，流水线（构建）统一调度。

---

## 16.2 工作空间（Workspace）

> 📖 **术语解释 · Workspace**：多个 crate 的集合，共享一个 `Cargo.lock` 和 `target` 目录。适合"一个项目多个组件"的场景。

### 目录结构

```
my_workspace/
├── Cargo.toml          # 工作空间根配置
├── crates/
│   ├── utils/          # 库 crate
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   └── cli/            # 二进制 crate
│       ├── Cargo.toml
│       └── src/main.rs
```

根 `Cargo.toml`：
```toml
[workspace]
members = ["crates/utils", "crates/cli"]
```

### crate 之间互相引用

`crates/cli/Cargo.toml`：
```toml
[dependencies]
utils = { path = "../utils" }
```

`crates/utils/src/lib.rs`：
```rust
pub fn add(a: i32, b: i32) -> i32 { a + b }
```

`crates/cli/src/main.rs`：
```rust
use utils::add;

fn main() {
    println!("{}", add(1, 2));
}
```

> 📌 **要点**：工作空间的三大好处——① 依赖只编译一次（`utils` 被 `cli` 引用时不会重复编译）② 统一的 `Cargo.lock` 保证版本一致 ③ 一条 `cargo build` 构建全部。

---

## 16.3 Features：条件编译

> 📖 **术语解释 · Feature**：Cargo 的条件编译开关。用户安装你的 crate 时可以选装哪些功能——就像点奶茶选加料。

### 定义 features

`Cargo.toml`：
```toml
[dependencies]
serde_json = { version = "1", optional = true }

[features]
default = []
json = ["serde_json"]  # json 功能启用 serde_json 依赖
premium = ["json"]     # premium 包含 json
```

### 代码中使用

```rust
#[cfg(feature = "json")]
pub fn parse_json(s: &str) -> Option<i32> {
    serde_json::from_str(s).ok()
}

#[cfg(not(feature = "json"))]
pub fn parse_json(s: &str) -> Option<i32> {
    s.parse().ok()
}
```

### 安装方按需启用

```toml
# 用户 A：只要基础功能
my_lib = "1.0"

# 用户 B：要 JSON 支持
my_lib = { version = "1.0", features = ["json"] }
```

> 💡 **比喻**：features 就像点奶茶——基础款（default）自带茶底，加珍珠（json feature）多 2 块，加芋泥加波波（premium）多 5 块。用户按需选，不用为一杯奶茶付全套的钱。

---

## 16.4 发布到 crates.io

### 发布前检查

```toml
[package]
name = "my_lib"
version = "0.1.0"
edition = "2021"
description = "一句话描述你的库"
license = "MIT"
repository = "https://github.com/you/my_lib"
```

> ⚠️ **新手坑**：`name`、`version`、`description`、`license` 四项缺一不可——没有它们 `cargo publish` 会直接拒绝。名字一旦发布就永久占用，发布前想好。

### 发布流程

```bash
cargo login            # 输入 crates.io 的 API token（一次性）
cargo publish --dry-run # 预演，检查打包内容
cargo publish           # 正式发布
```

发布后全世界都能用：
```toml
[dependencies]
my_lib = "0.1"
```

> 📌 **要点**：版本号语义化——`0.x.y` 是开发期（随时可 breaking），`1.0` 起承诺兼容。大版本升级（1.x → 2.0）意味着 breaking change。

---

## 16.5 依赖管理进阶

### 各种依赖写法

```toml
[dependencies]
serde = "1"                              # 版本范围 ^1.0
rand = { version = "0.8", features = ["std"] }  # 启用 features
my_local = { path = "../my_local" }      # 本地路径（开发期）
my_git = { git = "https://github.com/x/y" }     # 直接从 git 拉

[dev-dependencies]                       # 只在测试/示例时编译
criterion = "0.5"

[build-dependencies]                     # build.rs 用
cc = "1"
```

### 版本号规则

| 写法 | 含义 |
|------|------|
| `"1"` | `>=1.0.0, <2.0.0` — 兼容 1.x 全部 |
| `"1.2"` | `>=1.2.0, <2.0.0` — 1.2 及以上 |
| `"=1.2.3"` | 精确锁定 1.2.3 |
| `"^1.2"` | 同 `"1.2"`（默认） |
| `"~1.2"` | `>=1.2.0, <1.3.0` — 小版本内 |

> 💡 **技巧**：`cargo update` 更新 `Cargo.lock` 内的版本（在语义化范围内）；`cargo add serde` 快速添加依赖；`cargo tree` 查看依赖树。

---

## 16.6 常用 Cargo 命令速查（进阶版）

```bash
cargo build --release      # 优化编译（发布用，快但编译慢）
cargo doc --open           # 生成文档并在浏览器打开
cargo install <crate>      # 安装二进制工具（如 cargo-edit）
cargo outdated             # 检查过期依赖（需 cargo-outdated）
cargo audit                # 检查安全漏洞（需 cargo-audit）
cargo workspace            # 没有这个命令——用 cargo build 在根目录即可
```

---

## 16.7 课后练习

### 基础题

**1.** 创建一个工作空间，包含 `math`（库）和 `calc`（CLI）两个 crate。`math` 提供 `add/sub/mul`，`calc` 调用它们做简单计算。

<details>
<summary>参考答案要点</summary>

根 `Cargo.toml`：
```toml
[workspace]
members = ["math", "calc"]
```

`math/src/lib.rs`：
```rust
pub fn add(a: i32, b: i32) -> i32 { a + b }
pub fn sub(a: i32, b: i32) -> i32 { a - b }
pub fn mul(a: i32, b: i32) -> i32 { a * b }
```

`calc/Cargo.toml` 加 `math = { path = "../math" }`，`main.rs` 用 `use math::{add, sub};`。
关键点：根目录 `cargo build` 一次构建全部。
</details>

### 进阶题

**2.** 给 `math` crate 加一个 `advanced` feature，启用时暴露 `pow` 函数；不启用时调用 `pow` 会编译错误。

<details>
<summary>参考答案要点</summary>

`Cargo.toml`：
```toml
[features]
advanced = []
```

`lib.rs`：
```rust
#[cfg(feature = "advanced")]
pub fn pow(base: i32, exp: u32) -> i32 {
    (1..=exp).fold(1, |acc, _| acc * base)
}
```

CLI 启用时：`math = { path = "../math", features = ["advanced"] }`。
关键点：`#[cfg(feature = "x")]` 控制函数是否编译。
</details>

### 挑战题

**3.** 给你的库写好 `Cargo.toml` 元数据（description、license、repository），运行 `cargo publish --dry-run` 并解读输出——确保没有缺项警告。

<details>
<summary>参考答案要点</summary>

必须的四项：`name`、`version`、`description`、`license`。
`cargo publish --dry-run` 会打包到 `target/package/`，检查：
- 有没有漏掉的文件（`.gitignore` 的文件不会打包）
- 有没有意外把敏感文件（密码、token）打进去
- 元数据是否完整
关键点：`--dry-run` 是发布前的安全网，一定先跑它。
</details>

---

## 16.8 Mini Project：给 Todo 工具升级为工作空间

把实战 1 的 Todo CLI 拆成"库 + CLI"两个 crate，练习工作空间组织：

```
todo_workspace/
├── Cargo.toml              # [workspace] members = ["todo-core", "todo-cli"]
├── todo-core/
│   ├── Cargo.toml
│   └── src/lib.rs          # Task 结构体 + add/list/done/remove 逻辑
└── todo-cli/
    ├── Cargo.toml          # depends on todo-core
    └── src/main.rs         # 命令行入口
```

`todo-core/src/lib.rs` 核心部分：
```rust
#[derive(Clone)]
pub struct Task {
    pub id: u32,
    pub title: String,
    pub done: bool,
}

pub fn next_id(tasks: &[Task]) -> u32 {
    tasks.iter().map(|t| t.id).max().unwrap_or(0) + 1
}

pub fn add(tasks: &mut Vec<Task>, title: String) -> Task {
    let id = next_id(tasks);
    let t = Task { id, title, done: false };
    tasks.push(t.clone());
    t
}
```

`todo-cli/src/main.rs`：
```rust
use todo_core::{Task, add};

fn main() {
    let mut tasks: Vec<Task> = vec![];
    let t = add(&mut tasks, String::from("学工作空间"));
    println!("已添加 #{}: {}", t.id, t.title);
}
```

> 📌 **要点**：把核心逻辑放进库 crate（`lib.rs`），CLI 只是薄薄一层入口——这是 Rust 项目的标准分层。库可以被其他 CLI、Web 服务、测试代码同时复用。还有个额外好处：实战 5 的 Axum 版 Todo 也能直接依赖 `todo-core`，一份逻辑三种用法。

> ### 📝 记忆卡片
>
> **一句话**：workspace 多 crate 一锅端，features 开关按需编译。
>
> **口诀**：根目录 build 全家桶；发布先 `--dry-run`。
>
> **三个判断题**（心里过一遍）：
> 1. workspace 成员互相依赖要先发布到 crates.io → ✗（path 依赖直接引）
> 2. `#[cfg(feature = "x")]` 控制代码是否参与编译 → ✓
> 3. `cargo publish` 直接发布，不需要 --dry-run 检查 → ✗（--dry-run 是发布前的安全网）

---

## 自检清单

- [ ] 我能用工作空间组织多个 crate
- [ ] 我知道 workspace 成员之间如何互相引用
- [ ] 我会用 `#[cfg(feature = "x")]` 做条件编译
- [ ] 我知道发布 crate 需要哪些必填元数据
- [ ] 我会区分 `dependencies` / `dev-dependencies` / `build-dependencies`
- [ ] 我理解语义化版本号（`"1"` vs `"=1.2.3"` vs `"~1.2"`）
- [ ] 我完成了 Todo 工作空间 mini project

---

> 🦀 **下一章预告**：第 17 章我们聊一个最时髦的方向——Rust 与 AI 生态：为什么"研究用 Python，生产看 Rust"，以及怎么用你已经掌握的 serde + reqwest 知识，写一个命令行 AI 问答助手。学到这里，你已能像生产环境工程师一样组织、发布、维护 Rust 项目——最后一站，出发！
