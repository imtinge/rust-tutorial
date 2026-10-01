# 第15章 WebAssembly：Rust 进浏览器

> **学习目标**
> - 理解 WebAssembly（WASM）是什么、为什么 Rust 是最佳搭档
> - 搭建 Rust → WASM 开发环境
> - 写出第一个在浏览器中运行的 Rust 程序
> - 掌握 Rust 与 JavaScript 之间的数据交换
>
> **预计学习时长**：2-3 小时

---

## 15.1 什么是 WebAssembly？

> 📖 **术语解释 · WebAssembly（WASM）**：一种二进制指令格式，让 C/C++/Rust 等语言编译后在浏览器中以接近原生的速度运行。不是要取代 JavaScript，而是和 JS 互补——JS 管页面逻辑，WASM 干重活。

> 💡 **比喻**：JavaScript 是网页的"大管家"——擅长处理用户点击、更新页面、协调各模块。WebAssembly 是"幕后专家"——JS 调它来干重活（3D 渲染、大数据处理、物理引擎），速度快十倍。就像饭店经理（JS）和后厨大厨（WASM）的关系。

### 谁在用 WebAssembly？

- **Adobe Photoshop** 网页版——用 WASM 处理图形计算
- **Figma**——用 WASM 做复杂设计操作
- **Google Earth**——用 WASM 渲染 3D 地形
- **AutoCAD 网页版**——35 年历史的桌面软件搬上了浏览器

### 为什么 Rust + WASM 是天作之合？

| 优势 | 说明 |
|------|------|
| **无 GC** | Rust 用所有权系统管理内存，没有垃圾回收暂停——浏览器里性能可预测 |
| **体积小** | Rust 生成紧凑的 WASM 文件，没有运行时环境打包，一个模块可能只有几 KB |
| **内存安全** | 编译时消灭悬垂指针、缓冲区越界——WASM 沙箱里更安全 |
| **工具链一流** | `wasm-bindgen` + `wasm-pack` 让构建/测试/部署一条龙 |

---

## 15.2 搭建 WASM 开发环境

### 安装 wasm32 编译目标

```bash
rustup target add wasm32-unknown-unknown
```

> 📖 **术语解释 · `wasm32-unknown-unknown`**：编译目标名称。`wasm32` 表示 32 位 WASM，两个 `unknown` 表示"未知操作系统"和"未知环境"——因为 WASM 不运行在传统操作系统上，而是运行在浏览器里。

### 安装 wasm-pack

```bash
cargo install wasm-pack
```

> 💡 **比喻**：`wasm-pack` 就是"WASM 版的 Cargo"——帮你编译 Rust 到 WASM、生成 JS 胶水代码、打包发布。一条命令搞定从 Rust 到浏览器的全链路。

### 安装 cargo-generate（可选）

```bash
cargo install cargo-generate
```

用于从模板创建 WASM 项目。

---

## 15.3 第一个 WASM 程序：Hello from Rust

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

### 编写代码

`src/lib.rs`：
```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn greet(name: &str) -> String {
    format!("你好, {}! 来自 Rust WASM 🦀", name)
}
```

> 📖 **术语解释 · `#[wasm_bindgen]`**：属性标注，告诉 `wasm-bindgen`"这个函数要暴露给 JavaScript 调用"。加了它，JS 端就能直接 `greet("World")` 调用这个 Rust 函数。

### 构建到 WASM

```bash
wasm-pack build --target web
```

这会在 `pkg/` 目录生成：
- `hello_wasm.js` — JS 胶水代码
- `hello_wasm_bg.wasm` — 编译后的 WASM 二进制
- `hello_wasm.d.ts` — TypeScript 类型定义

### 在 HTML 中使用

创建 `index.html`：
```html
<!DOCTYPE html>
<html>
<body>
  <script type="module">
    import init, { greet } from "./pkg/hello_wasm.js";
    await init();
    const msg = greet("World");
    document.body.innerHTML = `<h1>${msg}</h1>`;
  </script>
</body>
</html>
```

用本地服务器打开（WASM 需要 HTTP 协议，不能直接双击 HTML 文件）：
```bash
npx serve .
# 或 python3 -m http.server
```

浏览器里会显示：`你好, World! 来自 Rust WASM 🦀`

---

## 15.4 Rust 与 JavaScript 数据交换

> 💡 **比喻**：Rust 和 JS 之间的数据交换就像两个语言不通的人做生意——需要翻译官（`wasm-bindgen`）。基本类型（数字、布尔）直接交换，复杂类型（字符串、数组）需要翻译。

### 基本类型：直接传递

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn add(a: i32, b: i32) -> i32 { a + b }

#[wasm_bindgen]
pub fn is_even(n: i32) -> bool { n % 2 == 0 }
```

JS 端：`add(3, 4)` 返回 `7`，`is_even(6)` 返回 `true`。

### 字符串：自动转换

```rust
#[wasm_bindgen]
pub fn shout(s: &str) -> String {
    s.to_uppercase()
}
```

JS 端：`shout("hello")` 返回 `"HELLO"`。

### 调用 JavaScript 函数

Rust 也能调用 JS 函数——用 `js_sys` crate：

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn alert_msg(msg: &str) {
    alert(msg);  // 调用 JS 的 alert()
}

#[wasm_bindgen]
extern "C" {
    fn alert(s: &str);  // 声明 JS 函数
}
```

### Option 和 Result

```rust
#[wasm_bindgen]
pub fn find(n: i32) -> Option<i32> {
    if n > 0 { Some(n * 2) } else { None }
}
```

JS 端：`find(5)` 返回 `10`，`find(-1)` 返回 `undefined`。

---

## 15.5 WASM 开发流程速查

```
Rust 代码 → wasm-pack build → pkg/ 目录(JS+WASM) → HTML 引入 → 浏览器运行
```

| 步骤 | 命令/操作 |
|------|----------|
| 添加 WASM 编译目标 | `rustup target add wasm32-unknown-unknown` |
| 安装构建工具 | `cargo install wasm-pack` |
| 编写 Rust 代码 | `#[wasm_bindgen]` 标注导出函数 |
| 构建 | `wasm-pack build --target web` |
| 使用 | HTML 中 `import` 生成的 JS 文件 |

> ⚠️ **新手坑**：WASM 不能直接打开 HTML 文件运行——必须通过 HTTP 服务器。用 `npx serve` 或 `python3 -m http.server` 启动本地服务器。

---

## 15.6 课后练习

### 基础题

**1.** 写一个 WASM 函数 `fib(n: u32) -> u32`，返回斐波那契数列第 n 项。在浏览器中测试 `fib(10)`。

<details>
<summary>参考答案要点</summary>

```rust
#[wasm_bindgen]
pub fn fib(n: u32) -> u32 {
    if n <= 1 { n } else { fib(n-1) + fib(n-2) }
}
```
JS 端：`fib(10)` 返回 `55`。
</details>

### 进阶题

**2.** 写一个 WASM 函数 `reverse_string(s: &str) -> String`，反转字符串。在 HTML 中做一个输入框，实时显示反转结果。

<details>
<summary>参考答案要点</summary>

```rust
#[wasm_bindgen]
pub fn reverse_string(s: &str) -> String {
    s.chars().rev().collect()
}
```
HTML 中用 `oninput` 实时调用并显示。
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

## 15.7 Mini Project：密码强度分析器

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
<head><meta charset="utf-8"><title>密码强度</title></head>
<body>
  <input type="password" id="pwd" placeholder="输入密码" oninput="check()">
  <p id="result"></p>
  <script type="module">
    import init, { check_password } from "./pkg/hello_wasm.js";
    await init();
    window.check = () => {
      const pwd = document.getElementById("pwd").value;
      document.getElementById("result").textContent = "强度: " + check_password(pwd);
    };
  </script>
</body>
</html>
```

> 📌 **要点**：这就是 Rust 在浏览器中的威力——用 Rust 的类型安全和性能做计算密集型任务（密码分析、加密、图像处理），用 JS 做页面交互。各取所长。

> ### 📝 记忆卡片
>
> **一句话**：WASM 让 Rust 跑进浏览器，与 JS 各取所长。
>
> **口诀**：wasm-pack build 出 pkg，JS import 来调用，HTTP 服务器起起来。
>
> **三个判断题**（心里过一遍）：
> 1. WebAssembly 的目标是取代 JavaScript → ✗（互补：Rust 算重活，JS 管交互）
> 2. `#[wasm_bindgen]` 标注的函数可以被 JS 调用 → ✓
> 3. 双击打开 HTML 文件就能运行 WASM 页面 → ✗（必须通过 HTTP 服务器访问）

---

## 自检清单

- [ ] 我理解 WebAssembly 不是取代 JavaScript，而是互补
- [ ] 我能安装 WASM 工具链（wasm32 target + wasm-pack）
- [ ] 我会用 `#[wasm_bindgen]` 导出 Rust 函数给 JS
- [ ] 我能构建 WASM 并在 HTML 中调用
- [ ] 我理解 Rust 和 JS 之间基本类型、字符串的交换方式
- [ ] 我完成了密码强度分析器 mini project

---

> 🦀 **下一章预告**：第 16 章我们学 Cargo 进阶——工作空间、features 条件编译、发布到 crates.io，让你的 Rust 项目从"能跑"升级到"能上线"。之后第 17 章看看最热门的 AI 生态，再进入 5 个实战项目！
