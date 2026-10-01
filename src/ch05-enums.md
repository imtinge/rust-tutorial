# 第5章 枚举与模式匹配：Rust 的表达力

> **学习目标**
> - 理解枚举（Enum）的概念和用法
> - 掌握 Option 和 Result 两大核心枚举
> - 熟练使用 `match` 和 `if let` 模式匹配
> - 理解模式匹配的穷尽性
>
> **预计学习时长**：2-3 小时

---

## 5.1 枚举：比其他语言更强大

先看一段代码，猜猜它在做什么：

```rust
enum OrderStatus {
    Processing,               // 无数据
    Delivering(String),       // 携带配送员名字
    Delivered,                // 无数据
    Cancelled(String),        // 携带取消原因
}
```

```rust
let s = OrderStatus::Delivering(String::from("小王"));
// 接下来用 match 来处理不同状态
```

> 📖 **术语解释 · 枚举（Enum）**：一种可以表示"多种可能值之一"的类型。Rust 的枚举比 C/Java 的强大得多——每个变体可以携带不同类型和数量的数据。就像一个快递柜，每个格子可以放不同形状的包裹。

> 💡 **比喻**：枚举就像奶茶店的订单状态——可能是"制作中"、"配送中"、"已送达"、"已取消"。每个状态是互斥的，你的订单只能处于其中一种状态。

### 带数据的枚举 vs 结构体

```rust
enum Message {
    Quit,                        // 无数据
    Move { x: i32, y: i32 },     // 像结构体一样带具名字段
    Write(String),               // 带一个字符串
    ChangeColor(i32, i32, i32),  // 带三个整数
}
```

```rust
let msg = Message::Write(String::from("hi"));
let pos = Message::Move { x: 10, y: 20 };
```

枚举的每个变体可以携带不同类型的数据，这是结构体做不到的。

> 💡 **比喻**：枚举就像一个"万能快递箱"——每个箱子里装的东西可以完全不同，但它们都属于同一个品牌（同一个枚举类型）。结构体则是"固定模板"——每个箱子的格子都一样。

---

## 5.2 Option：Rust 没有 null

先看一个函数——返回 `Option<String>`：

```rust
fn find_user(id: u32) -> Option<String> {
    if id == 1 { Some(String::from("Alice")) }
    else { None }
}
```

```rust
match find_user(1) {
    Some(name) => println!("找到了: {}", name),
    None => println!("用户不存在"),
}
```

Rust 里没有 `null`！取而代之的是 `Option` 枚举。

> ⚠️ **新手坑**：从 Python/JS 来的人常想直接用 `find_user(1)` 当字符串用——不行！`Option<String>` 不是 `String`，必须先 `match` 或 `unwrap`。

---

## 5.3 match：模式匹配

`match` 是 Rust 最强大的控制流结构之一。它像超级版的 `switch-case`，但更安全——**必须穷尽所有可能**。

```rust
fn describe(status: &OrderStatus) -> &str {
    match status {
        OrderStatus::Processing => "正在制作",
        OrderStatus::Delivering(_) => "配送中",
        OrderStatus::Delivered => "已送达",
        OrderStatus::Cancelled(_) => "已取消",
    }
}
```

> 💡 **比喻**：`match` 就像一个严格的安检员——你所有可能的情况都得过一遍安检，少一个都不行。这保证了你不会遗漏处理某个分支。

### match 绑定值

```rust
fn main() {
    let msg = Message::Write(String::from("hello"));
    match msg {
        Message::Quit => println!("退出"),
        Message::Move { x, y } => println!("移动到 ({}, {})", x, y),
        Message::Write(text) => println!("写入: {}", text),
        Message::ChangeColor(r, g, b) => println!("颜色: ({}, {}, {})", r, g, b),
    }
}
```

### 通配符 `_`

```rust
fn main() {
    let n = 7;
    match n {
        1 => println!("一"),
        2 | 3 => println!("二或三"),  // 多个模式用 | 合并
        4..=10 => println!("四到十"), // 范围匹配
        _ => println!("其他"),        // _ 匹配剩余所有
    }
}
```

---

## 5.4 if let：简洁匹配

当你只关心一种情况，其余不管时，`if let` 比 `match` 更简洁：

```rust
fn main() {
    let maybe_name: Option<String> = Some(String::from("Bob"));

    // match 写法
    match &maybe_name {
        Some(name) => println!("你好 {}", name),
        _ => {},
    }

    // if let 写法——更简洁
    if let Some(name) = &maybe_name {
        println!("你好 {}", name);
    }
}
```

> 💡 **比喻**：`if let` 就像你只等一个人的快递——来了就拿走，不来就算了。`match` 则是等所有快递——每个单号都要处理。

---

## 5.5 while let：循环匹配

`while let` 是 `if let` 的循环版本——每次匹配成功就继续循环，匹配失败（返回 `None`）就退出。就像你不断从杯子里摸球，摸到了就继续，摸空了就停。

```rust
fn main() {
    let mut stack = vec![1, 2, 3]; // vec! 创建动态数组（第6章详讲）
    while let Some(top) = stack.pop() {
        println!("弹出: {}", top);
    } // 输出 3, 2, 1
}
```

---

## 5.6 Result：错误处理的主角

先看一个返回 `Result` 的函数：

```rust
use std::num::ParseIntError;
fn parse_num(s: &str) -> Result<i32, ParseIntError> {
    s.parse::<i32>()
}
```

```rust
match parse_num("42") {
    Ok(n) => println!("成功: {}", n),
    Err(e) => println!("失败: {}", e),
}
```

> 📖 **术语解释 · Result<T, E>**：表示操作可能成功也可能失败的类型。`Ok(value)` 表示成功，`Err(error)` 表示失败。这是 Rust 错误处理的核心。

### `?` 运算符：错误传播简写

```rust
fn read_and_parse() -> Result<i32, ParseIntError> {
    let s = "123";
    let n: i32 = s.parse()?; // 出错就自动 return Err
    Ok(n + 1)
}

fn main() {
    println!("{:?}", read_and_parse()); // Ok(124)
}
```

> 💡 **比喻**：`?` 就像快递签收时"有问题就退回"——如果解析出错，直接把错误抛给调用者，不用自己写 `match`。代码简洁很多。

> ⚠️ **新手坑**：`?` 只能在返回 `Result` 或 `Option` 的函数里用。在 `main` 里直接用会报错（除非 `main` 本身返回 `Result`）。

---

## 5.7 课后练习

### 基础题

**1.** 定义一个 `TrafficLight` 枚举，有 `Red`、`Yellow`、`Green` 三个变体。写一个函数返回每种灯对应的行动建议（"停"、"注意"、"行"）。

<details>
<summary>参考答案要点</summary>

```rust
enum TrafficLight { Red, Yellow, Green }
fn action(light: &TrafficLight) -> &str {
    match light {
        TrafficLight::Red => "停",
        TrafficLight::Yellow => "注意",
        TrafficLight::Green => "行",
    }
}
fn main() {
    println!("{}", action(&TrafficLight::Red)); // 停
}
```
关键点：`match` 必须穷尽所有变体。
</details>

### 进阶题

**2.** 写一个函数 `divide(a: f64, b: f64) -> Result<f64, String>`，除数为 0 时返回 `Err("除数不能为零")`，否则返回 `Ok(商)`。在 `main` 中用 `match` 处理。

<details>
<summary>参考答案要点</summary>

```rust
fn divide(a: f64, b: f64) -> Result<f64, String> {
    if b == 0.0 { Err(String::from("除数不能为零")) }
    else { Ok(a / b) }
}
fn main() {
    match divide(10.0, 3.0) {
        Ok(result) => println!("结果: {:.2}", result),
        Err(e) => println!("错误: {}", e),
    }
    match divide(10.0, 0.0) {
        Ok(result) => println!("结果: {}", result),
        Err(e) => println!("错误: {}", e),
    }
}
```
关键点：`Result` 是泛型枚举，`Ok` 和 `Err` 可以携带不同类型的数据。
</details>

### 挑战题

**3.** 定义一个 `Shape` 枚举：`Circle(f64)`（半径）、`Rectangle(f64, f64)`（宽高）、`Triangle(f64, f64, f64)`（三边）。写一个 `area` 方法计算面积（三角形用海伦公式）。在 `main` 中测试三种形状。

<details>
<summary>参考答案要点</summary>

```rust
enum Shape {
    Circle(f64),
    Rectangle(f64, f64),
    Triangle(f64, f64, f64),
}
impl Shape {
    fn area(&self) -> f64 {
        match self {
            Shape::Circle(r) => 3.14159 * r * r,
            Shape::Rectangle(w, h) => w * h,
            Shape::Triangle(a, b, c) => {
                let s = (a + b + c) / 2.0;
                (s * (s - a) * (s - b) * (s - c)).sqrt()
            }
        }
    }
}
fn main() {
    let shapes = [
        Shape::Circle(5.0),
        Shape::Rectangle(3.0, 4.0),
        Shape::Triangle(3.0, 4.0, 5.0),
    ];
    for s in &shapes {
        println!("面积: {:.2}", s.area());
    }
}
```
关键点：用 `impl` 给枚举定义方法；`match self` 中的 `self` 是引用（`&self`），模式匹配用 `Shape::Circle(r)` 解构。
</details>

---

## 5.8 Mini Project：简单状态机

用枚举和 `match` 实现一个红绿灯状态机：

```rust
enum Light { Red, Yellow, Green }
impl Light {
    fn next(&self) -> Light {
        match self {
            Light::Red => Light::Green,
            Light::Green => Light::Yellow,
            Light::Yellow => Light::Red,
        }
    }
    fn name(&self) -> &str {
        match self { Light::Red => "红灯", Light::Yellow => "黄灯", Light::Green => "绿灯" }
    }
}
```

```rust
fn main() {
    let mut light = Light::Red;
    for _ in 0..6 {
        print!("{} -> ", light.name());
        light = light.next();
    }
    println!("..."); // 循环6次：红->绿->黄->红->绿->黄->...
}
```

> 📌 **要点**：`match` 的穷尽性保证了你永远不会漏掉一个状态。如果以后加了新灯色（比如 `Blue`），编译器会强制你在所有 `match` 里处理它。

> ### 📝 记忆卡片
>
> **一句话**：enum 表达"多种可能"，match 保证"每种都处理"。
>
> **口诀**：match 必穷尽，`_` 来兜底；Option 逼你处理 None，从此告别 null。
>
> **三个判断题**（心里过一遍）：
> 1. match 漏掉一个枚举变体会编译报错 → ✓
> 2. `if let` 能像 match 一样穷尽所有分支 → ✗（只处理一种）
> 3. `Option<T>` 让你绕开编译器直接解引用取值 → ✗（必须 match/unwrap/?，编译器强制你面对 None）

---

## 自检清单

- [ ] 我能定义带数据的枚举
- [ ] 我理解 `Option` 是 Rust 替代 null 的方案
- [ ] 我会用 `match` 处理所有分支，知道穷尽性的含义
- [ ] 我会使用 `if let` 简化只关心一种情况的匹配
- [ ] 我理解 `Result` 和 `?` 运算符
- [ ] 我知道 `_` 通配符的作用
- [ ] 我完成了红绿灯状态机 mini project

---

> 🦀 **下一章预告**：第 6 章我们来学集合（Vector、HashMap）和错误处理——让你的程序能存储更多数据、更健壮地处理异常。
