# 第16章 WebAssembly：Rust 进浏览器

> **学习目标**
> - 理解 WebAssembly（WASM）是什么、为什么 Rust 是最佳搭档
> - 搭建 Rust → WASM 开发环境
> - 写出第一个在浏览器中运行的 Rust 程序
> - 掌握 Rust 与 JavaScript 之间的数据交换
>
> **预计学习时长**：2-3 小时

---

## 16.1 什么是 WebAssembly？

> 📖 **术语解释 · WebAssembly（WASM）**：一种二进制指令格式，让 C/C++/Rust 等语言编译后在浏览器中以接近原生的速度运行。不是要取代 JavaScript，而是和 JS 互补——JS 管页面逻辑，WASM 干重活。

> **比喻**：JavaScript 是网页的"大管家"——擅长处理用户点击、更新页面、协调各模块。WebAssembly 是"幕后专家"——JS 调它来干重活（3D 渲染、大数据处理、物理引擎），速度快十倍。就像饭店经理（JS）和后厨大厨（WASM）的关系。

### 谁在用 WebAssembly？

- **Adobe Photoshop** 网页版——用 WASM 处理图形计算
- **Figma**——用 WASM 做复杂设计操作
- **Google Earth**——用 WASM 渲染 3D 地形
- **AutoCAD 网页版**——40 多年历史的桌面软件搬上了浏览器

### 为什么 Rust + WASM 是天作之合？

| 优势 | 说明 |
|------|------|
| **无 GC** | Rust 用所有权系统管理内存，没有垃圾回收暂停——浏览器里性能可预测 |
| **体积小** | Rust 生成紧凑的 WASM 文件，没有运行时环境打包，一个模块可能只有几 KB |
| **内存安全** | 编译时消灭悬垂指针、缓冲区越界——WASM 沙箱里更安全 |
| **工具链一流** | `wasm-bindgen` 负责互操作，`trunk` 一条命令完成构建/起服/热重载 |

---

## 16.2 搭建 WASM 开发环境

### 安装 wasm32 编译目标

```bash
rustup target add wasm32-unknown-unknown
```

> 📖 **术语解释 · `wasm32-unknown-unknown`**：编译目标名称。`wasm32` 表示 32 位 WASM，两个 `unknown` 表示"未知操作系统"和"未知环境"——因为 WASM 不运行在传统操作系统上，而是运行在浏览器里。

### 安装 trunk

```bash
cargo install trunk --locked
# 更快的方式：装了 cargo-binstall 后用预编译二进制
cargo binstall trunk
```

> **比喻**：`trunk` 就是"WASM 版的一站式打包车间"——它读一个 `index.html`，自动帮你完成：`cargo build` 到 WASM → 跑 `wasm-bindgen` 生成 JS 胶水 → 把产物带哈希地放进 `dist/`。开发时它还自带本地服务器和浏览器热重载，改一行 Rust，页面自动刷新。

装完用 `trunk --version` 验证。

---

## 16.3 第一个 WASM 程序：Hello from Rust

### 创建项目

```bash
cargo new --lib hello_wasm
cd hello_wasm
```

`Cargo.toml`：
```toml
[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2"
```

> 📖 **术语解释 · `cdylib`**：C 兼容的动态库。告诉编译器"这个库要编译成可以被其他语言（JS/WASM）加载的格式"。普通 Rust 库是 `rlib`，WASM 用 `cdylib`。

> 📖 **术语解释 · `wasm-bindgen`**：Rust 和 JavaScript 之间的"翻译官"。Rust 和 JS 的内存模型完全不同——Rust 有严格的类型，JS 有 `undefined` 和动态类型。`wasm-bindgen` 自动生成胶水代码，让两边能互相调用。

### 编写 Rust 代码

`src/lib.rs`：
```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("你好, {}! 来自 Rust WASM 🦀", name)
}
```

> 📖 **术语解释 · `#[wasm_bindgen]`**：属性标注，告诉 `wasm-bindgen`"这个函数要暴露给 JavaScript 调用"。加了它，JS 端就能调用这个 Rust 函数。

### 编写 index.html

在项目根目录（和 `Cargo.toml` 同级）创建 `index.html`：

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <!-- 告诉 trunk：编译本目录的 Cargo 项目并加载 WASM -->
  <link data-trunk rel="rust" />
</head>
<body>
  <h1 id="out">加载中…</h1>
  <script>
    // trunk 初始化 WASM 完成后会派发这个事件
    addEventListener("TrunkApplicationStarted", () => {
      // Rust 导出的函数挂在 window.wasmBindings 上
      document.getElementById("out").textContent =
        wasmBindings.greet("World");
    });
  </script>
</body>
</html>
```

两个关键约定：

1. `<link data-trunk rel="rust" />`——trunk 看到这个标签，就知道要编译同目录的 Rust crate。不写 `href` 时，它自动在 HTML 所在目录找 `Cargo.toml`。
2. **`TrunkApplicationStarted` 事件**——WASM 的获取和初始化是异步的，trunk 完成后会派发这个事件；Rust 导出的全部函数挂在全局对象 `window.wasmBindings` 上。在事件回调里调用它们最稳妥。

### 构建并运行

开发阶段用 `trunk serve`：

```bash
trunk serve --open
```

trunk 会编译 Rust 到 WASM、生成 JS 胶水、启动本地服务器（默认 `http://127.0.0.1:8080`）。注意：`trunk serve` 默认**不会**自动打开浏览器，需要加 `--open` 参数才会打开。之后你每改一次 `src/lib.rs`，它会自动重新构建并刷新页面。浏览器里会显示：

```
你好, World! 来自 Rust WASM 🦀
```

准备部署时用 release 构建：

```bash
trunk build --release
```

产物全部在 `dist/` 目录里：

- `index.html`——自动替换好脚本引用的页面
- `hello_wasm-<哈希>.js`——JS 胶水代码
- `hello_wasm-<哈希>_bg.wasm`——编译后的 WASM 二进制

`dist/` 是纯静态文件，扔到任何静态文件服务器（Nginx、GitHub Pages、对象存储）上即可。

> ⚠️ **新手坑**：WASM 页面不能直接双击 HTML 文件用 `file://` 打开——浏览器的安全策略会拦截。`trunk serve` 已经帮你起好了 HTTP 服务器，直接访问它给出的地址即可。

---

## 16.4 Rust 与 JavaScript 数据交换

> **比喻**：Rust 和 JS 之间的数据交换就像两个语言不通的人做生意——需要翻译官（`wasm-bindgen`）。基本类型（数字、布尔）直接交换，复杂类型（字符串、数组）需要翻译。

### 基本类型：直接传递

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 { a + b }

#[wasm_bindgen]
pub fn is_even(n: i32) -> bool { n % 2 == 0 }
```

JS 端（在 `TrunkApplicationStarted` 之后）：`wasmBindings.add(3, 4)` 返回 `7`，`wasmBindings.is_even(6)` 返回 `true`。

### 字符串：自动转换

```rust
#[wasm_bindgen]
pub fn shout(s: &str) -> String {
    s.to_uppercase()
}
```

JS 端：`wasmBindings.shout("hello")` 返回 `"HELLO"`。

### 调用 JavaScript 函数

Rust 也能调用 JS 函数——用 `#[wasm_bindgen]` 声明外部函数（底层就是 FFI，见第 15 章）：

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn alert_msg(msg: &str) {
    alert(msg);  // 调用 JS 的 alert()
}

#[wasm_bindgen]
// edition 2024：unsafe extern "C"；2021：extern "C"
unsafe extern "C" {
    fn alert(s: &str);  // 声明 JS 函数
}
```

实际项目中更常用的是 `web-sys` crate（`wasm-bindgen` 生态的一部分），它把 DOM、`window`、`fetch` 等上千个 Web API 都包装成了 Rust 类型，不必自己逐个声明。

### Option 和 Result

```rust
#[wasm_bindgen]
pub fn find(n: i32) -> Option<i32> {
    if n > 0 { Some(n * 2) } else { None }
}
```

JS 端：`wasmBindings.find(5)` 返回 `10`，`wasmBindings.find(-1)` 返回 `undefined`。

---

## 16.5 底层原理：trunk 替你做了什么？

`trunk build` 看似一条命令，背后是三步：

```bash
# 1. 把 Rust 编译成 WASM
cargo build --target wasm32-unknown-unknown --release

# 2. 用 wasm-bindgen CLI 生成 JS 胶水（需 cargo install wasm-bindgen-cli）
wasm-bindgen target/wasm32-unknown-unknown/release/hello_wasm.wasm \
    --out-dir dist --target web --no-typescript

# 3. 拷贝 WASM、改写 HTML 中的脚本引用
```

第 2 步生成的 JS 胶水负责：在浏览器里实例化 WASM 模块、在 Rust 的线性内存和 JS 对象之间拷贝/转换数据（比如 Rust 的 `String` 变成 JS 的字符串）。trunk 只是把这套流程自动化，并加上哈希指纹、压缩、热重载等工程能力。

> ⚠️ **关于 wasm-pack（2025 年现状）**：很多旧教程用的是 `wasm-pack build`。请注意：Rust 官方 2025-07-21 在博客宣布 [sunsetting the rustwasm GitHub org](https://blog.rust-lang.org/inside-rust/2025/07/21/sunsetting-the-rustwasm-github-org/)——该组织已于 2025 年 9 月归档；**`wasm-pack` 仓库随之归档、不再积极维护**；`wasm-bindgen` 则迁移到独立的 [wasm-bindgen 组织](https://github.com/wasm-bindgen)继续活跃维护。所以在旧资料里看到 wasm-pack 命令，知道它是"上一代打包工具"即可；新项目直接用 `trunk`，而 `wasm-bindgen` 本身仍然是整个互操作的基石。

---

## 16.6 课后练习

### 基础题

**1.** 写一个 WASM 函数 `fib(n: u32) -> u32`，返回斐波那契数列第 n 项。用 `trunk serve` 在浏览器中测试 `fib(10)`。

<details>
<summary>参考答案要点</summary>

```rust
#[wasm_bindgen]
pub fn fib(n: u32) -> u32 {
    if n <= 1 { n } else { fib(n-1) + fib(n-2) }
}
```
JS 端：`wasmBindings.fib(10)` 返回 `55`。
</details>

### 进阶题

**2.** 写一个 WASM 函数 `reverse_string(s: &str) -> String`，反转字符串。在页面中放一个输入框，实时显示反转结果。

<details>
<summary>参考答案要点</summary>

```rust
#[wasm_bindgen]
pub fn reverse_string(s: &str) -> String {
    s.chars().rev().collect()
}
```
HTML 中监听输入框的 `input` 事件，在 `TrunkApplicationStarted` 之后实时调用并显示。
</details>

### 挑战题

**3.** 写一个 WASM 函数 `analyze_text(text: &str) -> String`，返回一段文本的字符数、单词数、行数的 JSON 字符串。

<details>
<summary>参考答案要点</summary>

```rust
#[wasm_bindgen]
pub fn analyze_text(text: &str) -> String {
    let chars = text.chars().count();
    let words = text.split_whitespace().count();
    let lines = text.lines().count();
    format!(r#"{{"chars":{},"words":{},"lines":{}}}"#, chars, words, lines)
}
```
</details>

---

## 16.7 Mini Project：密码强度分析器

用 Rust WASM 写一个密码强度检查器——在浏览器中运行，用 Rust 的性能做实时分析。

`src/lib.rs`：
```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn check_password(pwd: &str) -> String {
    let mut score = 0;
    if pwd.len() >= 8 { score += 1; }
    if pwd.len() >= 12 { score += 1; }
    if pwd.chars().any(|c| c.is_uppercase()) { score += 1; }
    if pwd.chars().any(|c| c.is_lowercase()) { score += 1; }
    if pwd.chars().any(|c| c.is_numeric()) { score += 1; }
    if pwd.chars().any(|c| !c.is_alphanumeric()) { score += 1; }
    match score {
        0..=2 => "弱".into(),
        3..=4 => "中".into(),
        5 => "强".into(),
        _ => "极强".into(),
    }
}
```

`index.html`：
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>密码强度</title>
  <link data-trunk rel="rust" />
</head>
<body>
  <input type="password" id="pwd" placeholder="输入密码">
  <p id="result"></p>
  <script>
    addEventListener("TrunkApplicationStarted", () => {
      document.getElementById("pwd").oninput = (e) => {
        document.getElementById("result").textContent =
          "强度: " + wasmBindings.check_password(e.target.value);
      };
    });
  </script>
</body>
</html>
```

`trunk serve` 打开页面，输入密码即可看到实时强度。

> 📌 **要点**：这就是 Rust 在浏览器中的威力——用 Rust 的类型安全和性能做计算密集型任务（密码分析、加密、图像处理），用 JS 做页面交互。各取所长。

> ### 记忆卡片
>
> **一句话**：WASM 让 Rust 跑进浏览器，与 JS 各取所长。
>
> **口诀**：trunk serve 一把梭——编译、起服、热重载；导出函数 wasmBindings，启动事件里来调用。
>
> **三个判断题**（心里过一遍）：
> 1. WebAssembly 的目标是取代 JavaScript → ✗（互补：Rust 算重活，JS 管交互）
> 2. `#[wasm_bindgen]` 标注的函数可以被 JS 调用 → ✓
> 3. 双击打开 HTML 文件就能运行 WASM 页面 → ✗（必须通过 HTTP 服务器，用 trunk serve）

---

## 自检清单

- [ ] 我理解 WebAssembly 不是取代 JavaScript，而是互补
- [ ] 我能安装 WASM 工具链（wasm32 target + trunk）
- [ ] 我会用 `#[wasm_bindgen]` 导出 Rust 函数给 JS
- [ ] 我能用 `trunk serve` 开发、`trunk build --release` 打包
- [ ] 我理解 `TrunkApplicationStarted` 事件和 `window.wasmBindings` 的用法
- [ ] 我理解 Rust 和 JS 之间基本类型、字符串的交换方式
- [ ] 我完成了密码强度分析器 mini project

---

> 🦀 **下一章预告**：第 17 章我们学 Cargo 进阶——工作空间、features 条件编译、发布到 crates.io，让你的 Rust 项目从"能跑"升级到"能上线"。再进入 6 个实战项目！
