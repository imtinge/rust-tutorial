# 第1章 环境搭建与第一个程序

> **学习目标**
> - 成功安装 Rust 工具链（rustc + cargo）
> - 理解 Cargo 是什么、为什么它是你的好帮手
> - 写出并运行第一个 Rust 程序
> - 看懂编译器的基本报错信息
>
> **预计学习时长**：1-2 小时

---

## 1.1 安装 Rust：给你的电脑装上"引擎"

Rust 工具链的安装比你想的简单多了。不用配环境变量，不用装一堆依赖，一条命令搞定。

### Windows 安装

去 [https://rustup.rs](https://rustup.rs) 下载 `rustup-init.exe`，双击运行，按提示走就行。

> **比喻**：rustup 就像 Rust 的"应用商店"——它负责下载、更新、管理 Rust 的各个版本，你以后想升级 Rust，只需要一句 `rustup update`。

### macOS / Linux 安装

打开终端，粘贴这一行：

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

### 验证安装

安装完成后，打开终端（Windows 用 PowerShell），输入：

```bash
rustc --version
cargo --version
```

看到版本号就说明装好了。如果提示"找不到命令"，关掉终端重新打开试试——环境变量可能还没刷新。

> ⚠️ **新手坑**：Windows 用户还需要安装 Visual Studio C++ Build Tools。去微软官网搜 "Build Tools for Visual Studio"，安装时勾选"C++ 桌面开发"工作负载。没有这个，Rust 编译时会报链接器错误。

---

## 1.2 Rust 工具链三剑客

装完 Rust 后，你的电脑多了三个核心工具：

| 工具 | 作用 | 生活比喻 |
|------|------|----------|
| `rustc` | Rust 编译器，把代码翻译成机器能跑的程序 | 翻译官 |
| `cargo` | Rust 的包管理器 + 构建工具，一站式管家 | 项目管家 |
| `rustup` | Rust 版本管理器，装/卸/切换版本 | 版本遥控器 |

> 📖 **术语解释 · Cargo**：Cargo 是 Rust 官方的构建工具和包管理器。你把它理解成 Rust 版的 npm（Node.js）或 pip（Python）就行。新建项目、装依赖、编译、跑测试、打包发布——全靠它。

99% 的时候你会用 `cargo` 而不是直接用 `rustc`，就像你做饭用电饭煲而不是拿个锅架在火上一样——工具帮你把繁琐的事自动化了。

### 1.2.1 关于 Edition：本书基于 2024

Rust 有个独特的概念叫 **edition（版本纪元）**：大约每三年，官方会把这一时期积累的新语法、新关键字打包成一个新 edition，写在你项目的 `Cargo.toml` 里：

```toml
[package]
name = "hello_rust"
version = "0.1.0"
edition = "2024"      # 就是这一行
```

目前有 2015、2018、2021、**2024** 四个 edition。从 Rust 1.85（2025 年 2 月）开始，`cargo new` 新建项目默认就是 2024，本书所有代码也基于 **edition 2024**。

**为什么要有 edition？** Rust 不想像某些语言那样，新版本一发布就让满地旧代码编译不过。于是它把"可能让旧代码产生歧义"的变化（比如新增一个保留字、收紧一处语法）放进 edition 里：你的项目不主动改 `edition`，编译器就继续按老规则编译；改成新 edition，才启用新规则。不同 edition 的库还能互相混用，所以升级没有"生态断层"。

**新手最可能撞上的几处 2024 变化**：

| 主题 | 2021 及以前的写法 | edition 2024 的写法 |
|------|------------------|--------------------|
| 声明调用 C 函数的块 | `extern "C" { ... }` | `unsafe extern "C" { ... }`（第 15 章细讲） |
| 导出给 C 用的函数 | `#[no_mangle]` | `#[unsafe(no_mangle)]` |
| `gen` | 可以当变量名（未启用的保留字） | 正式保留给未来的生成器（generator）语法，不能再当变量名 |
| `unsafe` 属性 | `#[no_mangle]`、`#[export_name]` 直接写 | 这类属性统一包成 `#[unsafe(no_mangle)]` |

变化的主线就一条：**凡是"我在这里绕过编译器安全检查"的地方，2024 都要求你明明白白写出 `unsafe`**，让危险点在代码里一眼可见。

> ⚠️ **新手坑**：你在网上（尤其是 2024 年之前的教程）搜到的代码可能写的是 `extern "C"`、`#[no_mangle]`，粘到自己的 2024 项目里会报错或警告。别慌——这不是你写错了，照着编译器提示补上 `unsafe` 就行；本书相关位置也都同时给出了新老两种写法。反过来，把本书的 2024 代码放进老项目，记得先把 `edition` 改成 `"2024"`。

---

## 1.3 用 Cargo 创建第一个项目

打开终端，进入你想放代码的目录，运行：

```bash
cargo new hello_rust
cd hello_rust
```

Cargo 会帮你生成这样的目录结构：

```
hello_rust/
├── Cargo.toml    # 项目配置文件（像 package.json）
├── src/
│   └── main.rs   # 你的代码写在这里
└── .git/         # Cargo 自动初始化了 git 仓库
```

> **比喻**：`Cargo.toml` 就像是你项目的"身份证"——记录了项目名、版本、依赖项等信息。`src/main.rs` 是程序的入口——就像 Python 里的 `if __name__ == "__main__":` 所在的那个文件。

打开 `src/main.rs`，你会看到 Cargo 已经帮你写好了一段代码：

```rust
// ✅ 完整可运行
fn main() {
    println!("Hello, world!");
}
```

没错，这就是你的第一个 Rust 程序。先别急着嫌弃它太简单，我们来拆解一下。

### 逐行拆解

- `fn`：Rust 里声明函数的关键字（function 的缩写）。就像 Python 的 `def`、JS 的 `function`。
- `main`：特殊函数名，程序的入口。Rust 程序从这里开始执行，就像 C 语言。
- `println!`：打印输出。注意后面的感叹号 `!`——它表示这是一个**宏**（macro），不是普通函数。
- `"Hello, world!"`：字符串字面量，双引号包裹。
- `;`：语句结束符。Rust 和 C/Java 一样，每条语句以分号结尾。

> 📖 **术语解释 · 宏（Macro）**：宏是一种"写代码的代码"。你可以把它理解成一个智能的代码模板——编译时它会展开成真正的代码。`println!` 后面的 `!` 就是在告诉你："我不是普通函数，我是宏！"现在不用深入，知道看到 `!` 就是宏就够了。

### 运行程序

回到终端，在项目目录下运行：

```bash
cargo run
```

你会看到类似输出：

```
   Compiling hello_rust v0.1.0 (C:\Users\your_name\projects\hello_rust)
    Finished dev [unoptimized + debuginfo] target(s) in 0.42s
     Running `target\debug\hello_rust.exe`
Hello, world!
```

恭喜！你刚运行了人生第一个 Rust 程序！

---

## 1.4 Cargo 常用命令速查

| 命令 | 作用 |
|------|------|
| `cargo new 项目名` | 创建新项目 |
| `cargo build` | 编译项目（不运行） |
| `cargo run` | 编译 + 运行 |
| `cargo build --release` | 编译优化版（用于发布，更快但编译更慢） |
| `cargo check` | 只检查代码能否编译，不生成二进制文件（最快） |
| `cargo test` | 运行测试 |
| `cargo add 依赖名` | 添加第三方依赖 |
| `cargo fmt` | 自动格式化代码 |
| `cargo clippy` | 运行代码 lint 检查（帮你发现潜在问题） |

> 💡 **技巧**：开发时用 `cargo check` 代替 `cargo build`——它快得多，因为不生成最终二进制文件。等你确认没问题了再 `cargo build`。

---

## 1.5 改一改，试试看

让我们把程序改得稍微有意思一点。把 `src/main.rs` 改成：

```rust
// ✅ 完整可运行
fn main() {
    let name = "Rustacean";       // 声明变量
    println!("你好, {}!", name);  // {} 是占位符
}
```

运行 `cargo run`，输出：`你好, Rustacean!`

这里出现了两个新东西：

- `let`：声明变量用的关键字。就像 Python 的 `=` 赋值，但 Rust 要求你显式用 `let`。
- `{}`：`println!` 里的占位符，会被后面的变量值替换。就像 Python 的 f-string 里 `{}` 或 JS 的模板字符串 `${}`。

---

## 1.6 和编译器交朋友

Rust 的编译器 `rustc` 是你学 Rust 途中最好的朋友，它会在编译时帮你揪出大量潜在 bug，代价是——你会经常看到红色报错。`rustc` 中专门负责所有权与引用规则检查的部分叫**借用检查器（borrow checker）**。

> **比喻**：借用检查器就像宿舍的查寝阿姨——她看起来很烦，每次都要检查你有没有违规用电，但她是真的在保护你的安全。Rust 的编译器也一样，帮你消灭内存隐患。

让我们故意写一段有问题的代码，感受一下：

```rust
fn main() {
    let x = 5;
    x = 6;  // 尝试重新赋值（没有 let）
    println!("{}", x);
}
```

运行 `cargo run`，你会看到一段编译器报错。让我们逐行读懂它：

```
error[E0384]: cannot assign twice to immutable variable `x`
 --> src/main.rs:3:5
  |
2 |     let x = 5;
  |         - first assignment to `x`
3 |     x = 6;
  |     ^^^^^ cannot assign twice to immutable variable
```

**逐行拆解**：
- `error[E0384]` — 错误码，E0384 表示"对不可变变量二次赋值"。遇到不认识的错误码，直接搜索引擎搜 `rust E0384` 就有详细解释
- `--> src/main.rs:3:5` — 错误位置：第 3 行第 5 列。Rust 会用 `|` 和 `^^^^^` 画出上下文和精确位置
- `first assignment to x` — 第一次赋值在第 2 行（`let x = 5;`）
- `cannot assign twice` — 你又赋了一次，不行

> 📌 **要点**：Rust 的编译器报错是所有编程语言里最友好的——它会告诉你错误在哪一行、是什么错误、怎么修。学会阅读报错，就等于拥有了免费的 24 小时导师。

关键是什么？**不要害怕报错**。

> **比喻**：Rust 之于 C/C++，就像一把"神奇钉枪"——它能钉钉子（写底层高性能代码），还带空仓提示（编译时检查内存安全），让你不必一枪接一枪打空了才发现没钉子（段错误、内存泄漏）。代价是你得先学会怎么用这把枪（所有权、借用、生命周期标注），但学会之后，效率和安全都有保障。

---

## 1.7 选择你的编辑器

| 编辑器/IDE | 推荐理由 |
|-----------|----------|
| **VS Code**（推荐） | 免费、轻量、装上 rust-analyzer 插件就是满分体验 |
| **RustRover** | JetBrains 出品，开箱即用，对新手最友好 |
| **Neovim** | 你是 Vim 党的话，配上 rustaceanvim 插件也很香（旧的 rust-tools.nvim 已归档停止维护，别再装它） |

> 💡 **强烈推荐**：安装 VS Code 的 `rust-analyzer` 插件。它会给你实时类型提示、自动补全、内联报错——极大提升 Rust 开发体验。

---

## 1.8 课后练习

### 基础题

**1.** 创建一个名为 `my_first_rust` 的 Cargo 项目，修改 `main.rs`，让它输出三行：
```
第一行：我是 Rust 新手
第二行：我一定会学会的
第三行：加油！
```

<details>
<summary>参考答案要点</summary>

```rust
// ✅ 完整可运行
fn main() {
    println!("第一行：我是 Rust 新手");
    println!("第二行：我一定会学会的");
    println!("第三行：加油！");
}
```
关键点：每个 `println!` 自动换行，不需要手动加 `\n`。
</details>

### 进阶题

**2.** 用 `{}` 占位符，在一行里输出：`"3 + 4 = 7"`。要求用变量存储 3 和 4，计算出结果后输出。

<details>
<summary>参考答案要点</summary>

```rust
// ✅ 完整可运行
fn main() {
    let a = 3;
    let b = 4;
    let sum = a + b;
    println!("{} + {} = {}", a, b, sum);
}
```
关键点：`println!` 可以接受多个占位符，按顺序替换。
</details>

### 挑战题

**3.** 故意写一段会触发编译错误的代码（比如给不可变变量赋值），阅读完整的报错信息，尝试理解报错中每一行的含义。然后修复它。

<details>
<summary>参考答案要点</summary>

故意写错：
```rust
fn main() {
    let score = 100;
    score = 90; // 错误：不可变变量不能重新赋值
}
```
修复：
```rust
// ✅ 完整可运行
fn main() {
    let mut score = 100;
    score = 90;
    println!("{}", score);
}
```
关键点：学会阅读报错的 `error[E0384]` 错误码，以及 `--> src/main.rs:3:5` 行号定位（出错的 `score = 90;` 在第 3 行）。
</details>

---

## 1.9 Mini Project：温度转换器

学完本章的知识，让我们动手写一个真正可运行的小程序——温度转换器，把摄氏度转成华氏度。

```rust
// ✅ 完整可运行
fn main() {
    let celsius: f64 = 37.0;
    let fahrenheit = celsius * 1.8 + 32.0;
    println!("{}°C = {:.1}°F", celsius, fahrenheit);
}
```

运行 `cargo run`，输出：`37°C = 98.6°F`。

**这个项目用到了什么**：
- `let` 声明变量（第 1 章）
- `f64` 浮点数类型（第 2 章会详细讲）
- `println!` 格式化输出（`{:.1}` 保留一位小数）
- 算术运算

> 💡 **技巧**：试着把 `celsius` 改成其他值，或者反向把华氏度转成摄氏度，看看你的公式对不对。

---

## 1.10 现实预期：学 Rust 是什么体验

在你正式开始 Rust 旅程之前，我需要跟你交个底——

学 Rust **不会一帆风顺**。你将会遇到：

- **挫败感**：编译器会拒绝你觉得"明明没问题"的代码，你会对着红色报错发呆
- **所有权墙**：前几章会卡在"所有权"和"借用"上，这是正常的——每个 Rust 开发者都经历过
- **生命周期恐惧**：看到 `<'a>` 就头大，觉得"为什么别的语言不需要这东西"

但你也会遇到：

- **"啊哈"时刻**：当所有权突然 click 了，你会觉得"原来如此，太优雅了"
- **第一次编译通过**：零警告、零段错误，程序跑得又快又稳
- **安全感**：编译通过后，你几乎不用担心内存问题——这在 C/C++ 里是不可想象的

> 📌 **要点**：Rust 的学习曲线像一座山——前面陡，后面平。翻过所有权和借用这道坎之后，你会发现后面的路越走越顺。

> 🦀 **老弟的建议**：当你被编译器"毒打"的时候，记住——它不是在找你茬，是在帮你排雷。每次报错都是一次学习机会。坚持下去，你会感谢现在的自己。

> ### 记忆卡片
>
> **一句话**：工欲善其事，必先利其器——cargo 就是 Rust 的"瑞士军刀"。
>
> **口诀**：new 建项目、run 一键跑、check 快体检、build 出产物。
>
> **三个判断题**（心里过一遍）：
> 1. `cargo check` 会生成可执行文件 → ✗（只做编译检查不出产物，所以快）
> 2. `println!` 的 `!` 表示它是宏，不是函数 → ✓
> 3. rustup 用来管理项目依赖 → ✗（rustup 管 Rust 工具链，管依赖的是 cargo）

---

## 自检清单

- [ ] 我能成功运行 `rustc --version` 和 `cargo --version`
- [ ] 我能用 `cargo new` 创建新项目
- [ ] 我能看懂 `Cargo.toml` 和 `src/main.rs` 的作用
- [ ] 我能运行 `cargo run` 并看到输出
- [ ] 我知道 `let` 声明变量、`println!` 打印输出
- [ ] 我能读懂编译器报错的错误码和行号定位
- [ ] 我不害怕编译器的红色报错，知道它是在帮我
- [ ] 我装好了编辑器或 IDE，能愉快地写 Rust 代码
- [ ] 我完成了温度转换器 mini project

---

> 🦀 **下一章预告**：在第 2 章，我们会系统学习 Rust 的基础语法——变量、数据类型、函数、控制流。你会发现 Rust 的语法既熟悉又有惊喜。
