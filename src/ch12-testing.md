# 第12章 测试：让代码值得信赖

> **学习目标**
> - 学会编写和运行单元测试
> - 掌握 `assert!`、`assert_eq!`、`assert_ne!` 三大断言宏
> - 理解 `#[test]`、`#[should_panic]` 属性
> - 了解集成测试与文档测试
>
> **预计学习时长**：2-3 小时

---

## 12.1 为什么要写测试？

> 📖 **术语解释 · 测试（Testing）**：用代码验证代码正确性的方法。你写一段"期望输入 A 得到输出 B"的代码，如果实际运行结果不等于 B，测试就报错。就像质检员在出厂前检查每个产品。

> **比喻**：测试就像奶茶店的试喝环节——你先把做好的奶茶让店员尝一口，确认味道对了再端给客人。不试喝就端出去，万一糖放多了客人就投诉了。

Rust 内置了测试框架，不需要安装任何第三方库，`cargo test` 一条命令搞定。

---

## 12.2 第一个测试

先看一段最简单的测试代码：

```rust
// ✅ 完整文件：放进 src/lib.rs 后 cargo test 可跑
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}

#[cfg(test)]          // 只有测试时才编译这段代码
mod tests {
    use super::*;      // 引入父模块的函数

    #[test]            // 标记这是一个测试函数
    fn test_add() {
        assert_eq!(add(1, 2), 3);  // 断言 add(1,2) == 3
    }
}
```

> 📖 **术语解释 · `#[test]`**：属性标注，告诉 Rust 编译器"这个函数是测试"。`#[cfg(test)]` 告诉编译器"这块代码只在 `cargo test` 时编译，正常 `cargo build` 时忽略"。

运行测试：

```bash
cargo test
```

输出（输出有删减）：
```
running 1 test
test tests::test_add ... ok
…

test result: ok. 1 passed; 0 failed …
```
> 注：上面用 `…` 省略了部分行（真实输出还包含 ignored/measured/filtered 统计、耗时及文档测试结果等），具体以本机 cargo 版本为准。

---

## 12.3 三大断言宏

```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_assert() {
        assert!(true);            // 断言为 true
        assert_eq!(2 + 2, 4);     // 断言相等
        assert_ne!(2 + 2, 5);     // 断言不相等
    }
}
```

| 宏 | 作用 | 失败时 |
|---|------|--------|
| `assert!(expr)` | 表达式为 true | 报 `assertion failed` |
| `assert_eq!(a, b)` | a == b | 显示两边值 |
| `assert_ne!(a, b)` | a != b | 显示两边值 |

> 💡 **提示**：`assert_eq!`/`assert_ne!` 要求两边的类型实现 `PartialEq`（用来比较相等）与 `Debug`（失败时要打印两边的值）；自定义结构体/枚举可直接派生 `#[derive(PartialEq, Debug)]`。

---

## 12.4 测试 panic 情况

有些函数在特定条件下应该 panic，用 `#[should_panic]` 测试：

```rust
// ✅ 完整文件：放进 src/lib.rs 后 cargo test 可跑
pub fn divide(a: f64, b: f64) -> f64 {
    if b == 0.0 { panic!("除数不能为零"); }
    a / b
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[should_panic(expected = "除数不能为零")]
    fn test_divide_by_zero() {
        divide(1.0, 0.0);  // 应该 panic
    }
}
```

> **比喻**：`#[should_panic]` 就像你故意把杯子摔到地上，确认它确实会碎——"预期碎裂"测试。

---

## 12.5 使用 Result 的测试

测试函数也可以返回 `Result`，用 `?` 传播错误：

```rust
use std::num::ParseIntError;

#[cfg(test)]
mod tests {
    use super::*;  // 引入父模块的导入
    #[test]
    fn test_parse() -> Result<(), ParseIntError> {
        let n: i32 = "42".parse()?;
        assert_eq!(n, 42);
        Ok(())  // 返回 Ok 表示测试通过
    }
}
```

---

## 12.6 运行测试的常用命令

```bash
cargo test                  # 运行所有测试
cargo test test_add         # 只运行名字含 "test_add" 的测试
cargo test -- --nocapture   # 显示 println! 输出（默认会隐藏）
cargo test -- --test-threads=1  # 单线程运行（调试用）
```

> ⚠️ **新手坑**：测试函数里的 `println!` 输出默认不显示——因为测试可能并行跑，混在一起看不清。用 `--nocapture` 可以看到输出。

---

## 12.7 集成测试

> 📖 **术语解释 · 集成测试（Integration Test）**：从外部调用你的库，测试公开 API 的整体行为。单元测试在 `src/` 内部，集成测试在 `tests/` 目录。

目录结构：
```
my_project/
├── src/
│   └── lib.rs       // 库代码
└── tests/
    └── integration.rs  // 集成测试
```

`src/lib.rs`：
```rust
pub fn multiply(a: i32, b: i32) -> i32 {
    a * b
}
```

`tests/integration.rs`：
```rust
use my_project::multiply;  // 引入库的公开函数

#[test]
fn test_multiply() {
    assert_eq!(multiply(3, 4), 12);
}
```

> **比喻**：单元测试像检查每个零件——轮子转不转、刹车灵不灵。集成测试像整车上路——组装好了能不能跑。

---

## 12.8 文档测试

Rust 的文档注释 `///` 里的代码可以被当作测试运行：

```rust
/// 将两个数字相加
///
/// # 示例
/// ```
/// use my_lib::add;
/// assert_eq!(add(2, 3), 5);
/// ```
pub fn add(a: i32, b: i32) -> i32 {
    a + b
}
```

运行 `cargo test` 会自动运行这段文档代码——如果示例写错了，测试就失败。

> **比喻**：文档测试就像"言行一致"检查——你文档里说的示例代码必须真的能跑通，不能吹牛。

---

## 12.9 综合示例：给 Todo 列表逻辑加测试

把前面学的拼起来：下面是一份**自包含的 `src/lib.rs`**——`Task` 结构体、计算下一个 id 的函数，以及针对它们的单元测试。`cargo test` 直接能跑（等做到实战 1 时，你会给真正的 Todo 工具补上同一套测试）：

```rust
// ✅ 完整可运行：放进 src/lib.rs
#[derive(Debug, PartialEq, Clone)]
pub struct Task {
    pub id: u32,
    pub title: String,
    pub done: bool,
}

// 已有任务的最大 id + 1；空列表从 1 开始
pub fn next_id(tasks: &[Task]) -> u32 {
    tasks.iter().map(|t| t.id).max().unwrap_or(0) + 1
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_next_id_empty() {
        let tasks: Vec<Task> = vec![];
        assert_eq!(next_id(&tasks), 1);
    }

    #[test]
    fn test_next_id_with_tasks() {
        let tasks = vec![
            Task { id: 1, title: String::from("a"), done: false },
            Task { id: 3, title: String::from("b"), done: false },
        ];
        assert_eq!(next_id(&tasks), 4);
    }

    #[test]
    fn test_add_and_remove() {
        let mut tasks = Vec::new();
        let id = next_id(&tasks);
        tasks.push(Task { id, title: String::from("测试"), done: false });
        assert_eq!(tasks.len(), 1);
        tasks.retain(|t| t.id != id);
        assert_eq!(tasks.len(), 0);
    }
}
```

---

## 12.10 课后练习

### 基础题

**1.** 给以下函数写一个单元测试，验证 `square(4)` 返回 `16`：
```rust
pub fn square(n: i32) -> i32 { n * n }
```

<details>
<summary>参考答案要点</summary>

```rust
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_square() {
        assert_eq!(square(4), 16);
        assert_eq!(square(0), 0);
        assert_eq!(square(-3), 9);
    }
}
```
关键点：`assert_eq!` 验证返回值；测试多个边界值（0 和负数）。
</details>

### 进阶题

**2.** 写一个函数 `fib(n: u32) -> u32` 计算斐波那契数列第 n 项（fib(0)=0, fib(1)=1），写 3 个测试覆盖 n=0、n=1、n=10。

<details>
<summary>参考答案要点</summary>

```rust
// ✅ 完整文件：放进 src/lib.rs 后 cargo test 可跑
pub fn fib(n: u32) -> u32 {
    if n <= 1 { n } else { fib(n-1) + fib(n-2) }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_fib_base() { assert_eq!(fib(0), 0); assert_eq!(fib(1), 1); }
    #[test]
    fn test_fib_10() { assert_eq!(fib(10), 55); }
}
```
关键点：测试边界条件（0 和 1）和正常值（10）。
</details>

### 挑战题

**3.** 给实战3（Web 服务器）的 `parse_path` 函数写单元测试，验证它能正确解析 `"GET /index.html HTTP/1.1"` 返回 `/index.html`。（`parse_path` 的最小实现见下方参考答案，可直接跑；完整实现见实战 3。）

<details>
<summary>参考答案要点</summary>

```rust
// 最小实现：取请求第一行，按空格分割，第二段即路径（完整版见实战3）
pub fn parse_path(request: &str) -> String {
    request.lines().next()
        .and_then(|line| line.split_whitespace().nth(1))
        .unwrap_or("/")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_parse_path_normal() {
        assert_eq!(parse_path("GET /index.html HTTP/1.1"), "/index.html");
    }
    #[test]
    fn test_parse_path_root() {
        assert_eq!(parse_path("GET / HTTP/1.1"), "/");
    }
    #[test]
    fn test_parse_path_empty() {
        assert_eq!(parse_path(""), "/");
    }
}
```
关键点：测试正常路径、根路径、空输入三种情况。
</details>

---

## 12.11 Mini Project：给计算器加测试

写一个简单的计算器函数并给它写完整的单元测试：

```rust
// 📎 片段 1/2：计算器函数
pub fn calc(a: f64, b: f64, op: char) -> Result<f64, String> {
    match op {
        '+' => Ok(a + b),
        '-' => Ok(a - b),
        '*' => Ok(a * b),
        '/' => if b == 0.0 { Err("除以零".into()) } else { Ok(a / b) },
        _ => Err("未知运算符".into()),
    }
}
```

```rust
// 📎 片段 2/2：单元测试
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_add() { assert_eq!(calc(1.0, 2.0, '+'), Ok(3.0)); }
    #[test]
    fn test_div() { assert_eq!(calc(10.0, 4.0, '/'), Ok(2.5)); }
    #[test]
    fn test_div_zero() {
        assert_eq!(calc(1.0, 0.0, '/'), Err("除以零".into()));
    }
    #[test]
    fn test_unknown_op() {
        assert!(calc(1.0, 2.0, '%').is_err());
    }
}
```

<details>
<summary>👉 点开：查看「计算器 + 完整测试」完整文件（✅，cargo test 可跑）</summary>

```rust
pub fn calc(a: f64, b: f64, op: char) -> Result<f64, String> {
    match op {
        '+' => Ok(a + b),
        '-' => Ok(a - b),
        '*' => Ok(a * b),
        '/' => if b == 0.0 { Err("除以零".into()) } else { Ok(a / b) },
        _ => Err("未知运算符".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn test_add() { assert_eq!(calc(1.0, 2.0, '+'), Ok(3.0)); }
    #[test]
    fn test_div() { assert_eq!(calc(10.0, 4.0, '/'), Ok(2.5)); }
    #[test]
    fn test_div_zero() {
        assert_eq!(calc(1.0, 0.0, '/'), Err("除以零".into()));
    }
    #[test]
    fn test_unknown_op() {
        assert!(calc(1.0, 2.0, '%').is_err());
    }
}
```

</details>

> 📌 **要点**：测试不是"写完代码再补"——而是"边写边测"。每个函数完成后立刻写测试，确认正常路径、边界值、错误路径都覆盖到了。

> ### 记忆卡片
>
> **一句话**：`#[test]` 标注、`cargo test` 运行、断言三件套（assert!/assert_eq!/assert_ne!）验结果。
>
> **口诀**：单元测试贴身写（同文件 `#[cfg(test)]`），集成测试隔壁住（`tests/` 目录）。
>
> **三个判断题**（心里过一遍）：
> 1. 单元测试写在 tests/ 目录 → ✗（那是集成测试；单元测试在源码内的 tests 模块）
> 2. `#[should_panic]` 表示测试期望函数 panic → ✓
> 3. 文档注释里的示例代码也能被 `cargo test` 执行 → ✓

---

## 自检清单

- [ ] 我会用 `#[test]` 标注测试函数
- [ ] 我会用 `assert!`、`assert_eq!`、`assert_ne!` 三大断言宏
- [ ] 我会用 `#[should_panic]` 测试应该 panic 的代码
- [ ] 我知道 `cargo test` 运行所有测试
- [ ] 我理解单元测试和集成测试的区别
- [ ] 我知道文档注释里的代码也能被测试
- [ ] 我完成了给计算器加测试 mini project

---

> 🦀 **下一章预告**：第 13 章我们进入"痛点攻坚"第一站——编译器错误。你的 Rust 工具箱已经非常完整了，接下来专治学习路上的三大痛点（编译错误、内存布局、Unsafe/FFI），然后是应用方向（WebAssembly、Cargo 进阶）和 6 个实战项目——把所有知识点串联起来！
