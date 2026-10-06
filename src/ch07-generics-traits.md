# 第7章 泛型与 Trait：写出通用代码

> **学习目标**
> - 理解泛型（Generics）的概念和语法
> - 掌握 Trait 的定义与实现
> - 学会 Trait 约束（Trait Bound）
> - 理解 Trait 对象（`dyn Trait`）与静态分发
>
> **预计学习时长**：3-4 小时

---

## 7.1 泛型：一份代码，多种类型

先看一段代码——一个函数能比较任意类型：

```rust
// 📎 片段 1/2：泛型函数定义
fn max<T: PartialOrd>(a: T, b: T) -> T {
    if a > b { a } else { b }
}
```

```rust
// 📎 片段 2/2：用不同类型调用
println!("{}", max(3, 7));       // 7 (i32)
println!("{}", max(3.14, 2.71)); // 3.14 (f64)
```

<details>
<summary>👉 点开：查看「泛型 max 函数」完整可运行版（✅）</summary>

```rust
fn max<T: PartialOrd>(a: T, b: T) -> T {
    if a > b {
        a
    } else {
        b
    }
}

fn main() {
    println!("{}", max(3, 7)); // 7 (i32)
    println!("{}", max(3.14, 2.71)); // 3.14 (f64)
}
```

</details>

> 📖 **术语解释 · 泛型（Generics）**：让函数或结构体不绑死在某个具体类型上，而是"泛化"为任意类型。相当于 TypeScript 的 `<T>` 或 Java 的 `Generics`。

> **比喻**：泛型就像万能插座——不管你插什么型号的插头（类型），只要符合规范（Trait 约束），都能充电。不用为每种插头单独造一个插座。

> `T: PartialOrd` 是 Trait 约束——告诉编译器 `T` 必须支持比较大小。没有这个约束，`a > b` 编译不过。

### 泛型结构体

```rust
struct Pair<T> {
    first: T,
    second: T,
}
fn main() {
    let p1 = Pair { first: 1, second: 2 };      // Pair<i32>
    let p2 = Pair { first: "a", second: "b" };  // Pair<&str>
    println!("{} {} {} {}", p1.first, p1.second, p2.first, p2.second);
}
```

### 多类型参数

```rust
struct KV<K, V> {
    key: K,
    value: V,
}
fn main() {
    let item = KV { key: 1, value: String::from("hello") };
    println!("{}: {}", item.key, item.value);
}
```

> 💡 **提示**：泛型类型参数通常用单个大写字母（T、K、V），但这只是惯例不是规定。泛型在编译时会**单态化**（monomorphization）——编译器为每种实际使用的类型生成一份具体代码，所以运行时零开销。

---

## 7.2 Trait：Rust 的接口

先看一段代码——定义 Trait 并实现：

```rust
// 📎 片段 1/2：定义 Trait 并为 Chinese 实现
trait Greet {
    fn say_hello(&self) -> String;
}
struct Chinese;
impl Greet for Chinese {
    fn say_hello(&self) -> String { String::from("你好！") }
}
```

```rust
// 📎 片段 2/2：创建实例、调用 trait 方法
let c = Chinese;
println!("{}", c.say_hello()); // 你好！
```

<details>
<summary>👉 点开：查看「Greet Trait 定义与实现」完整可运行版（✅）</summary>

```rust
trait Greet {
    fn say_hello(&self) -> String;
}
struct Chinese;
impl Greet for Chinese {
    fn say_hello(&self) -> String {
        String::from("你好！")
    }
}

fn main() {
    let c = Chinese;
    println!("{}", c.say_hello()); // 你好！
}
```

</details>

> 📖 **术语解释 · Trait**：定义一组方法签名，类型通过 `impl` 来实现这些方法。相当于其他语言的 Interface（接口）。Trait 描述的是"能做什么"，不关心"是什么"。

> **比喻**：Trait 就像考驾照——不管你开的是小汽车、卡车还是公交车，只要你有驾照（实现了 Trait），就能上路。Trait 定义了"会开车"这个能力，具体开什么车不重要。

### 默认方法

Trait 可以提供默认实现，实现者可以覆盖也可以直接用：

```rust
trait Animal {
    fn name(&self) -> &str;
    fn sound(&self) -> String {
        String::from("(沉默)")  // 默认实现
    }
}

struct Dog { n: String }
impl Animal for Dog {
    fn name(&self) -> &str { &self.n }
    // 不实现 sound，用默认值
}

struct Cat { n: String }
impl Animal for Cat {
    fn name(&self) -> &str { &self.n }
    fn sound(&self) -> String { String::from("喵~") }
}

fn main() {
    let d = Dog { n: String::from("旺财") };
    let c = Cat { n: String::from("咪咪") };
    println!("{}: {}", d.name(), d.sound());
    println!("{}: {}", c.name(), c.sound());
}
```

---

## 7.3 Trait 约束（Trait Bound）

用 Trait 限制泛型参数必须实现哪些 Trait：

```rust
// 内联写法
fn print_info<T: std::fmt::Debug + Clone>(item: &T) {
    println!("{:?}", item);
    let cloned = item.clone();
    println!("克隆: {:?}", cloned);
}

// where 子句写法（多个约束时更清晰）
fn print_info2<T>(item: &T)
where
    T: std::fmt::Debug + Clone,
{
    println!("{:?}", item);
}

fn main() {
    print_info(&vec![1, 2, 3]);
    print_info(&String::from("hello"));
}
```

> **比喻**：Trait 约束就像招工要求——"会开车 + 会英语"才录用。`T: Debug + Clone` 就是要求 `T` 既能调试打印又能克隆。

> 📖 **术语解释 · `#[derive(...)]`：让编译器自动实现 Trait**：上面 `T: Debug + Clone` 要求 `T` 实现这两个 trait，那怎么让自定义类型实现它们？最常用 `derive`——在类型上方写 `#[derive(Debug, Clone, PartialEq, ...)]`，编译器自动生成对应实现，不用手写。

| derive | 作用 | 典型场景 |
|--------|------|----------|
| `Debug` | 支持 `{:?}` 打印 | 调试、`println!` 看值 |
| `Clone` | 支持 `.clone()` 深拷贝 | 需要复制所有权 |
| `Copy` | 赋值时按位拷贝（隐式 Clone） | 仅含 Copy 字段的小类型 |
| `PartialEq` / `Eq` | 支持 `==` / `!=` 比较 | 断言、查找、去重 |
| `Default` | 支持 `::default()` 给初值 | 配置结构体、缺省值 |
| `Hash` | 支持作为 `HashMap` / `HashSet` 的 key | 用自定义类型做键 |

```rust
// 📎 片段：derive 自动实现多个 trait（需放进 fn main）
#[derive(Debug, Clone, PartialEq)]
struct Point { x: i32, y: i32 }

fn main() {
    let a = Point { x: 1, y: 2 };
    let b = a.clone();             // Clone 自动实现
    println!("{:?}", b);           // Debug 自动实现
    println!("相等? {}", a == b);   // PartialEq 自动实现
}
```

---

## 7.4 Trait 对象：动态分发

有时候你需要在同一个集合里存不同类型，但它们都实现了同一个 Trait：

```rust
trait Shape {
    fn area(&self) -> f64;
}

struct Circle { r: f64 }
struct Square { side: f64 }

impl Shape for Circle {
    fn area(&self) -> f64 { 3.14159 * self.r * self.r }
}
impl Shape for Square {
    fn area(&self) -> f64 { self.side * self.side }
}

fn main() {
    let shapes: Vec<Box<dyn Shape>> = vec![
        Box::new(Circle { r: 5.0 }),
        Box::new(Square { side: 4.0 }),
    ];
    for s in &shapes {
        println!("面积: {:.2}", s.area());
    }
}
```

> 📖 **术语解释 · `Box<dyn Trait>`**：把实现了某个 Trait 的值装进"箱子"（堆分配），用 `dyn` 表示动态分发。就像你把不同形状的东西装进统一规格的快递箱里，快递员（编译器）只需要知道"箱子里装的是 Shape"，不用知道具体是什么形状。

> ⚠️ **新手坑**：`dyn Trait` 有运行时开销（虚函数表查找），但在需要存储不同类型时是必要的。如果所有类型在编译时已知，泛型（静态分发）更高效。

---

## 7.5 impl Trait：更简洁的语法

```rust
// 📎 片段：Shape / Circle 的定义见上方 7.4 节
// 返回实现了 Trait 的类型
fn make_shape() -> impl Shape {
    Circle { r: 1.0 }
}

// 参数中使用
fn print_area(s: &impl Shape) {
    println!("面积: {:.2}", s.area());
}

fn main() {
    let s = make_shape();
    print_area(&s);
}
```

<details>
<summary>👉 点开：impl Trait 完整可运行版（✅）</summary>

```rust
trait Shape {
    fn area(&self) -> f64;
}

struct Circle { r: f64 }

impl Shape for Circle {
    fn area(&self) -> f64 {
        3.14159 * self.r * self.r
    }
}

fn make_shape() -> impl Shape {
    Circle { r: 1.0 }
}

fn print_area(s: &impl Shape) {
    println!("面积: {:.2}", s.area());
}

fn main() {
    let s = make_shape();
    print_area(&s);
}
```

</details>

> 💡 **技巧**：`impl Trait` 在参数位置等价于泛型约束 `T: Trait`，在返回位置表示"返回某个实现了 Trait 的具体类型"（编译器自动推断）。

---

## 7.6 Newtype 模式：一行代码的零成本封装

> 📖 **术语解释 · Newtype**：用一个只有一个字段的结构体包装已有类型，创造新语义。编译后零开销（不会多占内存），但编译器把它当成全新类型。

先看问题——两个 `u32` 混在一起，编译器帮不了你：

```rust
fn transfer(from: u32, to: u32, amount: u32) { /* ... */ }

fn main() {
    transfer(1001, 2002, 50);       // 对
    transfer(50, 1001, 2002);      // 编译器不报错！参数顺序全错
}
```

用 Newtype 给每个数字一个"身份"：

```rust
// 📎 片段 1/2：用 Newtype 定义带语义的类型和函数
struct AccountId(u32);
struct Amount(u32);

fn transfer(from: AccountId, to: AccountId, amount: Amount) {
    println!("{} -> {}: {} 元", from.0, to.0, amount.0);
}
```

```rust
// 📎 片段 2/2：main 中调用
fn main() {
    let a = AccountId(1001);
    let b = AccountId(2002);
    let money = Amount(50);
    transfer(a, b, money);   // OK
    // transfer(money, a, b); // 编译错误！类型不匹配
}
```

<details>
<summary>👉 点开：查看「Newtype 版转账」完整可运行版（✅）</summary>

```rust
struct AccountId(u32);
struct Amount(u32);

fn transfer(from: AccountId, to: AccountId, amount: Amount) {
    println!("{} -> {}: {} 元", from.0, to.0, amount.0);
}

fn main() {
    let a = AccountId(1001);
    let b = AccountId(2002);
    let money = Amount(50);
    transfer(a, b, money); // OK
}
```

</details>

> **比喻**：Newtype 就像给每个数字发工牌——`u32` 本来都长一样，套上 `AccountId` 工牌后编译器一眼就能认出谁是账户、谁是金额，张冠李戴直接被拦。

> 📌 **要点**：Newtype 是 Rust 生产代码的高频模式——给"裸数字"赋予语义、绕过孤儿规则（orphan rule）为外部类型实现 trait、区分单位（`Meters` vs `Seconds`）。实战 1 的 `Task` 结构体也是这种思路的延伸——用有名字的类型把相关数据打包，让编译器帮你把关，而不是散落一地的裸变量（严格说，Newtype 特指单字段元组结构体，`Task` 这种多字段结构体是它的近亲）。

> 📖 **术语解释 · 孤儿规则**：只有 Trait 或类型至少一方定义在当前 crate 里，才能为该类型实现该 Trait；防止跨 crate 的实现冲突。

---

## 7.7 课后练习

### 基础题

**1.** 写一个泛型函数 `first<T>(v: &[T]) -> Option<&T>`，返回切片的第一个元素引用。

<details>
<summary>参考答案要点</summary>

```rust
fn first<T>(v: &[T]) -> Option<&T> {
    if v.is_empty() { None } else { Some(&v[0]) }
}
fn main() {
    let nums = vec![10, 20, 30];
    let words = vec![String::from("hi"), String::from("there")];
    println!("{:?}", first(&nums));  // Some(10)
    println!("{:?}", first(&words)); // Some("hi")
}
```
关键点：返回引用避免所有权转移；`Option` 处理空向量。
</details>

### 进阶题

**2.** 定义一个 `Summary` Trait，有方法 `summarize(&self) -> String`。给 `Article`（标题+内容）和 `Tweet`（用户名+内容）两个结构体实现它。写一个函数接收 `&impl Summary` 并打印摘要。

<details>
<summary>参考答案要点</summary>

```rust
trait Summary {
    fn summarize(&self) -> String;
}
struct Article { title: String, content: String }
struct Tweet { user: String, content: String }
impl Summary for Article {
    fn summarize(&self) -> String {
        format!("【{}】{}", self.title, self.content)
    }
}
impl Summary for Tweet {
    fn summarize(&self) -> String {
        format!("@{}: {}", self.user, self.content)
    }
}
fn show(s: &impl Summary) {
    println!("{}", s.summarize());
}
fn main() {
    let a = Article { title: String::from("Rust发布"), content: String::from("新版本来了") };
    let t = Tweet { user: String::from("rustlang"), content: String::from("v1.0!") };
    show(&a);
    show(&t);
}
```
关键点：`format!` 宏用于格式化字符串拼接。
</details>

### 挑战题

**3.** 定义一个 `Comparable` Trait（有 `compare(&self, other: &Self) -> Ordering` 方法）。实现一个泛型函数 `largest<T: Comparable>(items: &[T]) -> Option<&T>`，找出最大元素。给 `i32` 实现 `Comparable` 并测试。

<details>
<summary>参考答案要点</summary>

```rust
use std::cmp::Ordering;
trait Comparable {
    fn compare(&self, other: &Self) -> Ordering;
}
impl Comparable for i32 {
    fn compare(&self, other: &Self) -> Ordering {
        self.cmp(other)
    }
}
fn largest<T: Comparable>(items: &[T]) -> Option<&T> {
    if items.is_empty() { return None; }
    let mut max = &items[0];
    for item in &items[1..] {
        if item.compare(max) == Ordering::Greater {
            max = item;
        }
    }
    Some(max)
}
fn main() {
    let nums = vec![3, 7, 2, 9, 1];
    match largest(&nums) {
        Some(n) => println!("最大: {}", n),
        None => println!("空"),
    }
}
```
关键点：`Self` 指代实现 Trait 的类型本身；`Ordering` 是标准库枚举。
</details>

---

## 7.8 Mini Project：形状面积计算器

用泛型和 Trait 写一个支持多种形状的面积计算器：

```rust
// 📎 片段 1/2：定义 Area Trait 并为两种形状实现
trait Area { fn area(&self) -> f64; }
struct Circle { r: f64 }
struct Rect { w: f64, h: f64 }
impl Area for Circle {
    fn area(&self) -> f64 { 3.14159 * self.r * self.r }
}
impl Area for Rect {
    fn area(&self) -> f64 { self.w * self.h }
}
```

```rust
// 📎 片段 2/2：泛型函数 + main
fn print_area<T: Area>(shape: &T) {
    println!("面积: {:.2}", shape.area());
}
fn main() {
    let c = Circle { r: 5.0 };
    let r = Rect { w: 3.0, h: 4.0 };
    print_area(&c); // 78.54
    print_area(&r); // 12.00
}
```

<details>
<summary>👉 点开：查看「形状面积计算器」完整可运行版（✅）</summary>

```rust
trait Area {
    fn area(&self) -> f64;
}
struct Circle {
    r: f64,
}
struct Rect {
    w: f64,
    h: f64,
}
impl Area for Circle {
    fn area(&self) -> f64 {
        3.14159 * self.r * self.r
    }
}
impl Area for Rect {
    fn area(&self) -> f64 {
        self.w * self.h
    }
}

fn print_area<T: Area>(shape: &T) {
    println!("面积: {:.2}", shape.area());
}

fn main() {
    let c = Circle { r: 5.0 };
    let r = Rect { w: 3.0, h: 4.0 };
    print_area(&c); // 78.54
    print_area(&r); // 12.00
}
```

</details>

> 📌 **要点**：`print_area<T: Area>` 只关心"能不能算面积"，不关心"是什么形状"。这就是 Trait 的核心价值——面向行为编程。

> ### 记忆卡片
>
> **一句话**：泛型是"一套逻辑多种类型"，Trait 是类型的"能力清单"。
>
> **口诀**：`impl Trait` 编译期定（单态化零开销），`dyn Trait` 运行期查表。
>
> **三个判断题**（心里过一遍）：
> 1. 泛型单态化后，运行时没有动态分发开销 → ✓
> 2. `dyn Trait` 的大小编译期已知 → ✗（不定大小，要用 `&dyn` 或 `Box<dyn>`）
> 3. Newtype 模式能绕过孤儿规则给外部类型实现 trait → ✓

---

## 自检清单

- [ ] 我能定义泛型函数和泛型结构体
- [ ] 我理解 Trait 约束限制泛型参数的行为能力
- [ ] 我会给类型实现 Trait（含默认方法）
- [ ] 我知道 `Box<dyn Trait>` 用于运行时多态
- [ ] 我理解 `impl Trait` 在参数和返回位置的用法
- [ ] 我会用 Newtype 模式给裸类型赋予语义
- [ ] 我理解泛型的单态化是编译时零开销的
- [ ] 我完成了形状面积计算器 mini project

---

> 🦀 **下一章预告**：第 8 章的**生命周期**是继所有权之后的又一座大山（闭包倒是很温柔）。生命周期听起来吓人，但我会用"奶茶保质期"的比喻帮你轻松搞定。
