# 第2章 基础语法：变量、类型与函数

> **学习目标**
> - 掌握变量声明、可变性与遮蔽（shadowing）
> - 认识 Rust 的基本数据类型
> - 学会定义函数、理解返回值
> - 熟练使用 if / loop / while / for 控制流
> - 理解 Rust 中"表达式"与"语句"的区别
>
> **预计学习时长**：2-3 小时

---

## 2.1 变量声明与可变性

在 Rust 里，声明变量用 `let` 关键字。但和 Python/JS 有一个重大区别——**Rust 的变量默认不可变**。

> 📖 **术语解释 · 不可变（Immutable）**：一旦赋了值就不能改。就像你在奶茶店点了一杯"固定配方"的奶茶，做好了就不能再换配料了。

```rust
// ✅ 完整可运行
fn main() {
    let x = 5;       // 默认不可变
    let mut y = 10;  // 加了 mut 就可以改
    y = y + 1;       // OK：y 是可变的
    // x = x + 1;   // 编译错误：x 不可变
    println!("x={}, y={}", x, y);
}
```

> ⚠️ **新手坑**：从 Python/JS 过来的同学最容易忘了 `mut`。编译器会报 `cannot assign twice to immutable variable`，看到这个就想起加 `mut`。

### 变量遮蔽（Shadowing）

你可以用同一个变量名重新声明，新变量会"遮住"旧的：

```rust
// ✅ 完整可运行
fn main() {
    let x = 5;        // x 是 i32
    let x = x + 1;    // 遮蔽：新 x = 6
    let x = "hello";  // 遮蔽：还能改类型！x 变成 &str
    println!("{}", x); // 输出 hello
}
```

> **比喻**：遮蔽就像你把旧的奶茶杯扔了，用同一个杯子位置放了杯新的——而且新杯子里装的东西可以完全不同。`mut` 只能改值不能改类型，遮蔽可以改类型。

### let-else：匹配失败就提前退出

有些场景你要"先匹配一个模式，匹配上了才继续，匹配不上就直接返回"。用 `match` 写会多一层缩进；`let-else` 把它压成一行——**模式匹配成功，绑定变量进入外层作用域；失败则执行 `else` 分支**（通常直接 `return` / `break` / `continue`）。edition 2021+ 支持，2024 默认开启。

```rust
// ✅ 完整可运行
fn main() {
    let input: Option<i32> = Some(7);
    // 匹配成功 → n 进入后续作用域；失败（None）→ 走 else 直接返回
    let Some(n) = input else { return; };
    println!("拿到数字：{}", n);   // 拿到数字：7
}
```

> 📌 **要点**：`let-else` 的 `else` 分支**必须发散**（diverging）——即 `return`、`break`、`continue` 或 `panic!`，因为一旦走 else，下面的代码就不该再看到那个没绑定出来的变量。它专门用来"前置守卫"（guard），把错误情况挡在前面，主逻辑才能平铺直叙。

> 🐍 **Python/JS 类比**：`let Some(n) = x else { return; }` 等价于 Python 的 `if x is None: return` 后再 `n = x`。但 Rust 把"解包 + 守卫"合成了原子操作——你没法忘记判断，编译器强制 `else` 分支存在。

> 📖 **术语前瞻 · `Option`**：上面 `Some(7)` / `None` 来自 `Option` 枚举——Rust 用它替代其他语言的 `null`，"可能有值 / 可能没有"直接写进类型里。第 5 章会正式讲，这里你只需知道 `Some(7)` 表示"有值 7"、`None` 表示"没有值"即可。

### 常量 const

```rust
const MAX_POINTS: u32 = 100_000;
```

常量用 `const`，必须标注类型，不能用 `mut`，值在编译时就确定了。下划线 `_` 可以当千位分隔符提高可读性。

---

## 2.2 基本数据类型

Rust 是**静态类型**语言——编译时就要确定每个变量的类型。但大多数时候你不用手写类型，编译器会自动推断。

### 标量类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `i32` / `u32` | 有符号/无符号 32 位整数 | `let a: i32 = -5;` |
| `i64` / `u64` | 64 位整数 | `let b: u64 = 100;` |
| `f32` / `f64` | 浮点数 | `let pi = 3.14;`（默认 f64） |
| `bool` | 布尔值 | `let flag = true;` |
| `char` | 单个 Unicode 字符 | `let c = '🦀';` |

> **比喻**：Rust 的整数类型就像是不同大小的杯子——`i8` 是小号杯（最多装 -128 到 127），`i64` 是大号杯（能装天文数字）。`i` 开头能装负数（有符号），`u` 开头只能装正数（无符号）。

```rust
// ✅ 完整可运行
fn main() {
    let integer: i32 = 42;
    let float: f64 = 3.14159;
    let boolean: bool = true;
    let character: char = 'A';
    println!("{} {} {} {}", integer, float, boolean, character);
}
```

> 📖 **术语解释 · `usize`**：Rust 专门用来表示"长度 / 下标"的无符号整数类型——`Vec::len()` 的返回值、`for i in 0..v.len()` 里的 `i` 都是 `usize`。它的大小取决于平台（64 位系统上是 64 位，能表示到天文数字），所以你**不能**直接拿它和 `i32` 相加，要先转换。

> 📌 **要点（类型转换 `as`）**：Rust 不做隐式数值转换——`i32` 不会自动变成 `u32`。需要时用 `as`：`let n = len as i32;`。`as` 在整数间是"按位重新解释"语义（不是饱和、不是四舍五入），大类型转小类型可能丢高位；浮点转整数会直接**截断**小数部分。

```rust
// ✅ 完整可运行
fn main() {
    let v = vec![10, 20, 30];
    let len: usize = v.len();      // 长度用 usize
    let idx: i32 = 0;
    // let bad = len + idx;        // ❌ 类型不同，编译错误
    let sum = len as i32 + idx;    // ✅ 用 as 显式转换
    println!("长度 {}, 头元素 {}", sum, v[0]);

    let big: i32 = 300;
    let small: u8 = big as u8;     // ⚠️ 300 超过 u8 上限 255，按位截断为 44
    println!("300 as u8 = {}", small);

    let pi = 3.9_f64;
    let trunc = pi as i32;         // 浮点转整数：截断小数 → 3
    println!("3.9 as i32 = {}", trunc);
}
```

> ⚠️ **新手坑（溢出）**：Debug 模式下整数溢出直接 panic，Release 模式静默回绕（见第 13 章陷阱五）。涉及"下标 / 长度"时优先用 `usize` 当索引，别用 `i32`——既贴合语义，又避免 `usize`/`i32` 混用报错。

### 元组与数组

```rust
// ✅ 完整可运行
fn main() {
    let tup: (i32, f64, &str) = (1, 2.5, "hi"); // 元组
    let (a, b, c) = tup;                         // 解构
    println!("{} {} {}", a, b, c);
    let arr = [1, 2, 3, 4, 5];                   // 数组
    println!("{}", arr[0]);                       // 下标访问
}
```

> 📖 **术语解释 · 元组（Tuple）**：把几个不同类型的值打包在一起，就像一个固定的礼盒。数组（Array）则是把一堆**同类型**的值排成一排，长度固定。

---

## 2.3 函数

Rust 用 `fn` 声明函数，参数需要标注类型，返回值用 `->` 标注。

```rust
// ✅ 完整可运行
fn add(a: i32, b: i32) -> i32 {
    a + b  // 注意：没有分号！这是表达式
}

fn main() {
    let result = add(3, 4);
    println!("{}", result); // 7
}
```

> ⚠️ **新手坑**：`a + b` 后面没有分号！在 Rust 里，函数最后一行**不加分号**就是返回值。加了分号就变成了语句，返回 `()`（空元组），类型不匹配会报错。

> 🔧 **报错解法**：如果你加了分号，编译器会给你这样的输出（1.99 实测）：
> ```
> error[E0308]: mismatched types
>  --> src/main.rs:1:27
>   |
> 1 | fn add(a: i32, b: i32) -> i32 {
>   |    ---                    ^^^ expected `i32`, found `()`
> 2 |     a + b;
>   |          - help: remove this semicolon to return this value
> ```
> 逐行拆解：
> - `error[E0308]` — 类型不匹配错误
> - `--> src/main.rs:1:27` — 主报错指向第 1 行的返回类型 `i32`（第 27 列）；修复建议指向第 2 行的分号
> - `expected i32, found ()` — 函数声明返回 `i32`，但实际返回了 `()`（因为分号把它变成了语句）
>
> 解决方案：删掉最后一行的分号，或者用 `return a + b;`。
>
> 📌 **要点**：记住这个规律——**分号把表达式变成语句，语句返回 `()`**。如果你看到 `expected X, found ()`，第一个检查的就是最后一行有没有多加分号。

### 语句 vs 表达式

这是 Rust 里一个关键概念：

- **语句**：执行一个操作，不返回值。比如 `let x = 5;`
- **表达式**：计算并产生一个值。比如 `a + b`、`if condition { 1 } else { 2 }`

```rust
// ✅ 完整可运行
fn main() {
    let x = if true { 5 } else { 10 }; // if 是表达式
    println!("{}", x); // 5
}
```

> **比喻**：语句就像"做一件事"——你倒了一杯水，没有产出什么。表达式就像"算一道题"——你算出了答案。Rust 大量使用表达式，这让代码更简洁。

---

## 2.4 控制流

### if / else if / else

```rust
// ✅ 完整可运行
fn main() {
    let score = 85;
    if score >= 90 {
        println!("优秀");
    } else if score >= 60 {
        println!("及格");
    } else {
        println!("加油");
    }
}
```

### loop：无限循环

```rust
// ✅ 完整可运行
fn main() {
    let mut count = 0;
    loop {
        count += 1;
        if count >= 3 { break; }
    }
    println!("count = {}", count); // 3
}
```

`loop` 可以返回值：

```rust
// ✅ 完整可运行
fn main() {
    let mut n = 0;
    let result = loop {
        n += 1;
        if n == 10 { break n * 2; }
    };
    println!("{}", result); // 20
}
```

### while：条件循环

```rust
// ✅ 完整可运行
fn main() {
    let mut n = 3;
    while n > 0 {
        println!("{}!", n);
        n -= 1;
    }
    println!("发射！");
}
```

### for：遍历循环

```rust
// ✅ 完整可运行
fn main() {
    for i in 1..=5 {       // 1 到 5（含）
        println!("{}", i);
    }
    for item in [10, 20, 30] {
        println!("{}", item);
    }
}
```

> **比喻**：`1..=5` 就像"从 1 号到 5 号的连续座位号"，两个点等号表示包含终点。如果写 `1..5` 则不含 5，就像 Python 的 `range(1, 5)`。

---

## 2.5 注释

```rust
// ✅ 完整可运行
fn main() {
    // 单行注释
    /* 多行注释
       可以跨越多行 */
    /// 文档注释——出现在项目文档里
    println!("注释不影响运行");
}
```

---

## 2.6 课后练习

### 基础题

**1.** 写一个函数 `is_even(n: i32) -> bool`，判断一个数是否为偶数。在 `main` 中测试 `8` 和 `7`。

<details>
<summary>参考答案要点</summary>

```rust
// ✅ 完整可运行
fn is_even(n: i32) -> bool {
    n % 2 == 0
}
fn main() {
    println!("{}", is_even(8));  // true
    println!("{}", is_even(7));  // false
}
```
关键点：`n % 2 == 0` 本身就是表达式，直接作为返回值。
</details>

### 进阶题

**2.** 用 `for` 循环计算 1 到 100 的和，输出结果。

<details>
<summary>参考答案要点</summary>

```rust
// ✅ 完整可运行
fn main() {
    let mut sum = 0;
    for i in 1..=100 {
        sum += i;
    }
    println!("1 到 100 的和是 {}", sum); // 5050
}
```
关键点：`1..=100` 包含 100；`sum` 需要 `mut`。
</details>

### 挑战题

**3.** 写一个函数 `fizzbuzz(n: i32) -> String`，实现 FizzBuzz：能被 3 整除返回 "Fizz"，能被 5 整除返回 "Buzz"，能被 15 整除返回 "FizzBuzz"，否则返回数字的字符串形式。

<details>
<summary>参考答案要点</summary>

```rust
// ✅ 完整可运行
fn fizzbuzz(n: i32) -> String {
    if n % 15 == 0 { "FizzBuzz".to_string() }
    else if n % 3 == 0 { "Fizz".to_string() }
    else if n % 5 == 0 { "Buzz".to_string() }
    else { n.to_string() }
}
fn main() {
    for i in 1..=20 {
        println!("{}", fizzbuzz(i));
    }
}
```
关键点：`if` 是表达式可以直接作为返回值；注意判断顺序要先 15 再 3 和 5；`to_string()` 把数字转成字符串。
</details>

---

## 2.7 Mini Project：猜数字游戏

把本章学的变量、函数、控制流全部用起来——写一个猜数字游戏。

> 💡 **提示**：这段代码用到了一些后面才会讲到的概念（如 `match`、`String` 方法），看不懂没关系，先跑起来体验一下！

```rust
// ✅ 完整可运行
use std::io;

fn main() {
    let secret = 42;
    println!("猜一个 1-100 的数字！");
    loop {
        let mut guess = String::new();
        io::stdin().read_line(&mut guess).unwrap();
        let num: i32 = match guess.trim().parse() {
            Ok(n) => n,
            Err(_) => { println!("请输入数字！"); continue; }
        };
        if num < secret { println!("太小了！"); }
        else if num > secret { println!("太大了！"); }
        else { println!("猜对了！"); break; }
    }
}
```

**用到了什么**：`let mut` 可变变量、`loop` 循环、`if/else` 条件分支、`match` 模式匹配、`String` 字符串、函数调用。

> 💡 **技巧**：试着把 `secret` 改成随机数（需要 `rand` crate），让游戏更有挑战性。

> ### 记忆卡片
>
> **一句话**：`let` 默认上锁（不可变），shadowing 是"同名换新装"。
>
> **口诀**：默认不可变，mut 才能改；同名可遮蔽，类型可不同。
>
> **三个判断题**（心里过一遍）：
> 1. `let x = 5; x = 6;` 能编译 → ✗（E0384，忘了 mut）
> 2. 遮蔽允许新变量同名且类型不同 → ✓
> 3. `if` 的条件必须加括号 → ✗（Rust 不需要括号，加了 clippy 会嫌你啰嗦）

---

## 自检清单

- [ ] 我知道 `let` 默认不可变，`let mut` 才能修改
- [ ] 我理解遮蔽（shadowing）和 `mut` 的区别
- [ ] 我能区分 `i32`、`f64`、`bool`、`char` 等基本类型
- [ ] 我会定义带参数和返回值的函数
- [ ] 我理解"表达式不加分号就是返回值"
- [ ] 我会读 E0308 错误码并知道怎么修
- [ ] 我理解 `let-else` 的"匹配失败就退出"守卫用法
- [ ] 我会用 `if`、`loop`、`while`、`for` 控制流
- [ ] 我知道 `1..5` 和 `1..=5` 的区别
- [ ] 我完成了猜数字游戏 mini project

---

> 🦀 **下一章预告**：第 3 章是 Rust 的重头戏——所有权与借用。这是 Rust 独步天下的核心特性，也是新手最容易卡住的地方。别怕，我会用奶茶和宿舍阿姨的比喻帮你搞懂它！
