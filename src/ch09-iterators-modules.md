# 第9章 迭代器与模块系统：组织大型项目

> **学习目标**
> - 掌握迭代器（Iterator）的使用和自定义
> - 熟练使用迭代器适配器链式调用
> - 理解模块（Module）系统与可见性
> - 学会用 `use` 引入路径和拆分文件
>
> **预计学习时长**：2-3 小时

---

## 9.1 迭代器：Rust 的函数式利器

> 📖 **术语解释 · 迭代器（Iterator）**：一种可以逐个遍历序列元素的模式。Rust 的迭代器是惰性的（lazy）——只有在被消费时才计算。相当于 Python 的 `iter()` + 生成器，但零运行时开销。

> **比喻**：迭代器就像自助餐的传送带——你站在那等，传送带一个个把菜送到你面前。菜在传送带上时还没被取走（惰性），你伸手取了才算消费。

### 基本使用

```rust
fn main() {
    let v = vec![1, 2, 3, 4, 5];

    // 方法一：for 循环（隐式迭代器）
    for x in &v { print!("{} ", x); }
    println!();

    // 方法二：显式迭代器
    let mut iter = v.iter();
    println!("{:?}", iter.next()); // Some(1)
    println!("{:?}", iter.next()); // Some(2)
}
```

### iter() vs into_iter() vs iter_mut()

```rust
fn main() {
    let v = vec![1, 2, 3];

    // iter()：借用 &T
    for x in &v { /* x 是 &i32 */ }

    // iter_mut()：可变借用 &mut T
    let mut v2 = vec![1, 2, 3];
    for x in &mut v2 { *x *= 2; }

    // into_iter()：获取所有权 T
    for x in v2 { /* x 是 i32 */ }
}
```

---

## 9.2 迭代器适配器：链式调用

> **比喻**：迭代器适配器就像工厂流水线——原料经过一道道工序（map、filter、collect），最终变成成品。每道工序都接收上一道的结果，干净利落。

### map：变换

```rust
fn main() {
    let v = vec![1, 2, 3];
    let doubled: Vec<i32> = v.iter().map(|x| x * 2).collect();
    println!("{:?}", doubled); // [2, 4, 6]
}
```

### filter：过滤

```rust
fn main() {
    let v = vec![1, 2, 3, 4, 5, 6];
    let evens: Vec<&i32> = v.iter().filter(|x| *x % 2 == 0).collect();
    println!("{:?}", evens); // [2, 4, 6]
}
```

### 链式组合

```rust
fn main() {
    let nums = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let result: Vec<i32> = nums
        .iter()
        .filter(|&&x| x % 2 == 0)    // 偶数
        .map(|&x| x * x)              // 平方
        .take(3)                       // 取前3个
        .collect();
    println!("{:?}", result); // [4, 16, 36]
}
```

> ⚠️ **新手坑**：迭代器是惰性的！你写了 `.map(|x| x * 2)` 但忘了 `.collect()`，什么都不会发生。必须有"消费者"（consuming adapter）来驱动它：`collect()`、`for` 循环、`sum()`（求和）等都是消费者；其中最基础的消费者是 `next()`——`collect`、`sum` 内部也是靠反复调用 `next()` 逐个取元素。

> 🔧 **报错解法**：`collect()` 需要类型标注。编译器报 `type annotations needed` 时，加上 `: Vec<类型>` 或用 turbofish 语法 `.collect::<Vec<i32>>()`。

### 其他常用适配器

```rust
fn main() {
    let v = vec![3, 1, 4, 1, 5, 9, 2, 6];

    let sum: i32 = v.iter().sum();           // 求和: 31
    let max = v.iter().max();                // 最大值: Some(9)
    let min = v.iter().min();                // 最小值: Some(1)
    let count = v.iter().count();            // 计数: 8
    let any = v.iter().any(|&x| x > 8);      // 是否有>8: true
    let all = v.iter().all(|&x| x > 0);      // 是否都>0: true

    println!("sum={} max={:?} any={}", sum, max, any);
}
```

### enumerate / zip / fold：三个高频适配器

```rust
fn main() {
    // enumerate：给每个元素附带下标 (索引, 值)
    let v = vec!["a", "b", "c"];
    for (i, x) in v.iter().enumerate() {
        println!("第{}个: {}", i, x);
    }

    // zip：把两个迭代器"拉链式"配对
    let names = vec!["Alice", "Bob"];
    let scores = vec![90, 85];
    for (n, s) in names.iter().zip(scores.iter()) {
        println!("{}: {}", n, s);
    }

    // fold：从一个初始值开始，逐个"累进"成最终结果
    let total: i32 = (1..=5).fold(0, |acc, x| acc + x); // 0+1+2+3+4+5 = 15
    println!("总和: {}", total);
}
```

> 📖 **术语解释**：
> - `enumerate()` 把 `(值)` 变成 `(下标, 值)`——做"带序号"遍历时比手写计数器干净。
> - `zip(a, b)` 两两配对，配完为止（长度以较短的那个为准）。
> - `fold(init, |acc, x| ...)` 是迭代器的"瑞士军刀"——`acc` 是累加器，从 `init` 起逐步合并每个 `x`；`sum()`、`count()` 本质都是它的特例。

> 💡 **闭包参数里的 `&`（`|&x|` / `|&&x|`）**：上面 `filter(|&&x| x % 2 == 0)` 里的 `&&` 不是笔误。`v.iter()` 产出 `&i32`，`filter` 的闭包又拿到 `&&i32`。写 `|x|` 得到 `&&i32`，`|&x|` 解一层引用得到 `&i32`，`|&&x|` 再解一层得到 `i32`。`map` 里同理：`|&x| x * x` 与 `|x| *x` 的区别就在收的是 `&i32` 还是 `i32`（第 8 章 8.5 讲过闭包参数与 `Fn` 约束）。用 `&` 做"解构式接收"能省掉 `*` 解引用，代码更顺手。

---

## 9.3 自定义迭代器

实现 `Iterator` Trait 即可创建自定义迭代器：

```rust
struct Counter { current: u32, max: u32 }

impl Counter {
    fn new(max: u32) -> Counter {
        Counter { current: 0, max }
    }
}

impl Iterator for Counter {
    type Item = u32;  // 关联类型
    fn next(&mut self) -> Option<Self::Item> {
        if self.current < self.max {
            self.current += 1;
            Some(self.current)
        } else { None }
    }
}

fn main() {
    for n in Counter::new(5) {
        print!("{} ", n); // 1 2 3 4 5
    }
    println!();
    // 也能用适配器
    let sum: u32 = Counter::new(10).filter(|x| x % 2 == 0).sum();
    println!("偶数和: {}", sum); // 30
}
```

> 📖 **术语解释 · 关联类型（Associated Type）**：在 Trait 中定义的占位类型，由实现者指定具体类型。`type Item = u32` 表示"这个迭代器产出 u32 类型的值"。相当于"这个工厂的产品类型是 u32"。

---

## 9.4 模块系统：组织你的代码

> 📖 **术语解释 · 模块（Module）**：用 `mod` 关键字定义的代码组织单元。模块可以包含函数、结构体、常量等。相当于 Python 的 module 或 JS 的 ES Module。

> **比喻**：模块系统就像公司的组织架构——公司（crate）下面有部门（mod），部门下面有小组（子 mod），小组里有员工（函数/结构体）。`pub` 决定哪些是"公开"的，哪些是"内部"的。

### 定义模块

```rust
mod restaurant {
    pub mod front {
        pub fn order() -> String { String::from("一份炒饭") }
        fn kitchen_secret() -> String { String::from("秘方不外传") }
    }
    pub fn greet() { println!("欢迎光临！"); }
}

fn main() {
    restaurant::greet();                    // OK：pub
    restaurant::front::order();            // OK：pub
    // restaurant::front::kitchen_secret(); // 编译错误：不是 pub
}
```

> 📖 **术语解释 · pub**：可见性修饰符，标记为公开。不加 `pub` 的默认是模块私有。就像公司里标注了"公开"的文件所有人能看，没标注的只有部门内部能看。

### use：引入路径

```rust
mod math {
    pub fn add(a: i32, b: i32) -> i32 { a + b }
    pub fn mul(a: i32, b: i32) -> i32 { a * b }
}

fn main() {
    // 不用 use，写全路径
    println!("{}", math::add(1, 2));

    // 用 use 简化
    use math::{add, mul};
    println!("{} {}", add(3, 4), mul(2, 5));

    // 用 as 重命名
    use math::add as plus;
    println!("{}", plus(10, 20));
}
```

### `*` 通配导入

```rust
use std::collections::*;
fn main() {
    let mut m: HashMap<i32, &str> = HashMap::new();
    m.insert(1, "one");
}
```

> ⚠️ **新手坑**：避免在库代码（lib）中用 `use xxx::*`——容易造成名称冲突，也不清晰。在测试代码里用用可以。

### 同名类型：模块内不行，模块间可以

```rust
mod chinese { pub struct Chef; }
mod french  { pub struct Chef; }   // 不同模块同名：OK

fn main() {
    // 同一个模块里两个类型不能同名（error: the name `Chef` is defined multiple times）；
    // 模块间的同名用路径区分，或 use ... as 起别名：
    use chinese::Chef as ChineseChef;
    let _ = ChineseChef;
    let _ = french::Chef;
}
```

> 📌 **要点**：名字的唯一性是按"命名空间（模块）"算的，不是按整个程序。想要"同一个东西的第二个名字"，用类型别名 `type Meters = u32;`；想要"两个不同东西同名"，把它们放进不同模块。

### 路径的三个起点：`self`、`super`、`crate`

写路径时除了"从当前位置往下找"，还可以明确指定起点：

```rust
mod kitchen {
    pub mod stove {
        pub fn ignite() { println!("点火！"); }
    }
    pub fn prepare() {
        stove::ignite();                     // 从当前模块往下找
        super::announce();                   // super：回到上一级（父模块）
        crate::kitchen::stove::ignite();     // crate：从 crate 根出发，写全路径
    }
}

fn announce() { println!("开始备菜！"); }

fn main() { kitchen::prepare(); }
```

> 📖 **术语解释 · 路径起点**：`self` = 当前模块（就像文件系统里的 `./`），`super` = 父模块（就像 `..`），`crate` = 当前 crate 的根（就像 `/`）。第 12 章写单元测试时你会频繁见到 `use super::*;`——意思就是"把父模块（被测代码）的所有东西引进测试模块"。

注意别把路径起点 `self::` 和方法接收者 `&self` 搞混——它们可以同时出现：

```rust
fn announce() { println!("当前模块的通知"); }

struct Waiter;
impl Waiter {
    fn serve(&self) {              // &self：方法接收者（调用这个方法的那个实例）
        self::announce();          // self:: 路径起点：从当前模块找 announce
    }
}

fn main() {
    let w = Waiter;
    w.serve();                     // 实际调用一个 &self 方法
}
```

---

## 9.5 拆分模块到文件

当项目变大时，把模块拆到不同文件：

```
src/
├── main.rs
├── math.rs        // 对应 mod math
└── utils/
    ├── mod.rs      // 对应 mod utils
    └── helper.rs   // 对应 mod utils::helper
```

`main.rs`：
```rust
mod math;           // 引入 math.rs
mod utils;          // 引入 utils/mod.rs

fn main() {
    println!("{}", math::add(1, 2));
    utils::greet();
}
```

`math.rs`：
```rust
pub fn add(a: i32, b: i32) -> i32 { a + b }
```

`utils/mod.rs`：
```rust
pub mod helper;     // 引入 utils/helper.rs
pub fn greet() { println!("Utils says hi"); }
```

> 💡 **提示**：示例没有给出 `helper.rs` 的内容——该文件可以先为空（`mod helper;` 只要求文件存在），以后再往里加 `pub fn ...`。

> 💡 **技巧**：两种风格都合法：`utils/mod.rs` 是 2015 旧风格，`utils.rs` + `utils/helper.rs` 是 2018+ 新风格，官方教程采用后者，新项目推荐后者。`cargo` 都能自动找到对应文件。

---

## 9.6 包与 Crate

> 📖 **术语解释 · Crate**：Rust 的编译单元。一个 Crate 可以是二进制（可执行程序）或库（供其他 Crate 使用）。**Package**（包）包含一个或多个 Crate，由 `Cargo.toml` 定义。

```
my_project/
├── Cargo.toml
└── src/
    ├── main.rs    → 二进制 crate（程序入口）
    └── lib.rs     → 库 crate（供他人引用）
```

```rust
// src/lib.rs
pub fn hello() { println!("Hello from lib!"); }
```

```rust
// src/main.rs
use my_project::hello; // 引用自己包的库
fn main() { hello(); }
```

---

## 9.7 课后练习

### 基础题

**1.** 用迭代器适配器一行完成：从 `[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]` 中筛选出 3 的倍数，求它们的平方和。

<details>
<summary>参考答案要点</summary>

```rust
fn main() {
    let nums = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    let sum: i32 = nums.iter()
        .filter(|&&x| x % 3 == 0)
        .map(|&x| x * x)
        .sum();
    println!("{}", sum); // 9 + 36 + 81 = 126
}
```
关键点：`filter` 和 `map` 链式调用；`sum()` 直接消费迭代器。
</details>

### 进阶题

**2.** 自定义一个 `Fibonacci` 迭代器，实现 `Iterator` Trait，产出斐波那契数列。在 `main` 中用 `.take(10)` 取前 10 个并打印。

<details>
<summary>参考答案要点</summary>

```rust
struct Fibonacci { a: u64, b: u64 }
impl Fibonacci {
    fn new() -> Self { Fibonacci { a: 0, b: 1 } }
}
impl Iterator for Fibonacci {
    type Item = u64;
    fn next(&mut self) -> Option<Self::Item> {
        let result = self.a;
        let next = self.a + self.b;
        self.a = self.b;
        self.b = next;
        Some(result)
    }
}
fn main() {
    for n in Fibonacci::new().take(10) {
        print!("{} ", n); // 0 1 1 2 3 5 8 13 21 34
    }
}
```
关键点：在 `next` 中更新状态并返回前一个值。
</details>

### 挑战题

**3.** 创建一个多模块项目：`math` 模块（add/sub）、`geometry` 模块（`circle_area`/`rectangle_area`），用 `use` 引入并在 `main` 中调用。

<details>
<summary>参考答案要点</summary>

文件结构：
```
src/
├── main.rs
├── math.rs
└── geometry.rs
```

```rust
// math.rs
pub fn add(a: f64, b: f64) -> f64 { a + b }
pub fn sub(a: f64, b: f64) -> f64 { a - b }
```

```rust
// geometry.rs
pub fn circle_area(r: f64) -> f64 { 3.14159 * r * r }
pub fn rectangle_area(w: f64, h: f64) -> f64 { w * h }
```

```rust
// main.rs
mod math;
mod geometry;
use math::{add, sub};
fn main() {
    println!("add: {}", add(1.0, 2.0));
    println!("sub: {}", sub(5.0, 3.0));
    println!("circle: {:.2}", geometry::circle_area(5.0));
    println!("rect: {}", geometry::rectangle_area(3.0, 4.0));
}
```
关键点：`mod` 声明 + 文件名对应；`pub` 让函数对外可见；`use` 引入路径。
</details>

---

## 9.8 Mini Project：文本分块迭代器

自定义一个迭代器，把长文本按固定字数切成一块一块地产出——像切蛋糕一样切文本：

```rust
// 📎 片段 1/2：实现 Chunks 迭代器
struct Chunks<'a> {
    text: &'a str,
    size: usize,   // 每块字数
}
impl<'a> Iterator for Chunks<'a> {
    type Item = String;
    fn next(&mut self) -> Option<String> {
        if self.text.is_empty() { return None; }
        let chunk: String = self.text.chars().take(self.size).collect();
        self.text = &self.text[chunk.len()..]; // 跳过已取字符
        Some(chunk)
    }
}
```

```rust
// 📎 片段 2/2：使用 Chunks
fn main() {
    let text = "Rust是一门很棒的系统编程语言";
    // 每 4 个字一块
    for (i, chunk) in (Chunks { text, size: 4 }).enumerate() {
        println!("第{}块: {}", i + 1, chunk);
    }
    // 用适配器组合：只要前 3 块并转大写
    let first3: Vec<String> = Chunks { text: "abcdefg", size: 2 }
        .take(3).map(|s| s.to_uppercase()).collect();
    println!("{:?}", first3); // ["AB", "CD", "EF"]
}
```

<details>
<summary>👉 点开：查看「文本分块迭代器」完整可运行版（✅）</summary>

```rust
struct Chunks<'a> {
    text: &'a str,
    size: usize, // 每块字数
}
impl<'a> Iterator for Chunks<'a> {
    type Item = String;
    fn next(&mut self) -> Option<String> {
        if self.text.is_empty() {
            return None;
        }
        let chunk: String = self.text.chars().take(self.size).collect();
        self.text = &self.text[chunk.len()..]; // 跳过已取字符
        Some(chunk)
    }
}

fn main() {
    let text = "Rust是一门很棒的系统编程语言";
    // 每 4 个字一块
    for (i, chunk) in (Chunks { text, size: 4 }).enumerate() {
        println!("第{}块: {}", i + 1, chunk);
    }
    // 用适配器组合：只要前 3 块并转大写
    let first3: Vec<String> = Chunks { text: "abcdefg", size: 2 }
        .take(3)
        .map(|s| s.to_uppercase())
        .collect();
    println!("{:?}", first3); // ["AB", "CD", "EF"]
}
```

</details>

> 📌 **要点**：自定义迭代器实现后，可以无缝使用 `.take()`、`.filter()`、`.map()` 等所有适配器——这就是 Rust 迭代器设计的精妙之处。注意 `Chunks` 借用了文本（持有 `&'a str`，不复制整段文本），但每一块的产出是新分配的 `String`。

> ### 记忆卡片
>
> **一句话**：迭代器是惰性的流水线，模块是代码的组织架构。
>
> **口诀**：不消费不执行；`self` 是我、`super` 是上级、`crate` 是根。
>
> **三个判断题**（心里过一遍）：
> 1. `iter().map(...)` 不消费就不会执行 → ✓（惰性是迭代器的天性）
> 2. 迭代器比手写 for 循环慢 → ✗（零成本抽象，编译后等价）
> 3. `use super::*` 的意思是引入 crate 根的所有项 → ✗（是父模块）

---

## 自检清单
- [ ] 我能用 `map`、`filter`、`take`、`collect` 链式处理数据
- [ ] 我知道迭代器是惰性的，需要 `collect` 或 `for` 消费
- [ ] 我能自定义迭代器（实现 `Iterator` Trait）
- [ ] 我理解 `mod` 定义模块、`pub` 控制可见性
- [ ] 我会用 `use` 引入路径
- [ ] 我知道 `self`、`super`、`crate` 三个路径起点的含义
- [ ] 我能拆分模块到不同文件
- [ ] 我理解 Crate 和 Package 的关系
- [ ] 我完成了文本分块迭代器 mini project

---

> 🦀 **下一章预告**：第 10 章是进阶利器——智能指针、并发编程和宏。学完这些你就掌握了 Rust 的高级武器库。
