# 第4章 结构体与方法：组织你的数据

> **学习目标**
> - 学会定义和实例化结构体（Struct）
> - 掌握元组结构体和单元结构体
> - 理解方法（Method）与关联函数
> - 学会使用派生 Trait（`#[derive]`）
>
> **预计学习时长**：2-3 小时

---

## 4.1 什么是结构体？

先看一段代码，猜猜它在做什么：

```rust
// 📎 片段 1/2：先定义 MilkTea 结构体
struct MilkTea {
    name: String,
    price: f64,
    sugar_free: bool,
}
```

这就是一个结构体——把三个相关字段（名字、价格、是否无糖）打包在一起。现在来创建一个实例：

```rust
// 📎 片段 2/2：创建实例并使用字段
fn main() {
    let drink = MilkTea {
        name: String::from("珍珠奶茶"),
        price: 15.0,
        sugar_free: false,
    };
    println!("{} 价格 {} 元", drink.name, drink.price);
}
```

<details>
<summary>👉 点开：查看「定义结构体 + 创建实例」完整可运行版（✅）</summary>

```rust
struct MilkTea {
    name: String,
    price: f64,
    sugar_free: bool,
}

fn main() {
    let drink = MilkTea {
        name: String::from("珍珠奶茶"),
        price: 15.0,
        sugar_free: false,
    };
    println!("{} 价格 {} 元", drink.name, drink.price);
}
```

</details>

> 📖 **术语解释 · 结构体（Struct）**：把多个相关字段打包到一起的自定义数据类型。就像你设计一张"员工信息表"模板——姓名、年龄、职位都是表上的字段，每个员工填一张表就是一个结构体实例。

> **比喻**：结构体就像奶茶店的菜单模板——名字、价格、是否含糖是字段，每一杯具体的奶茶就是一个实例。`珍珠奶茶` 是一个实例，`芋泥波波` 也是一个实例。

> ⚠️ **新手坑**：结构体字段默认是**不可变**的。想改字段值？需要把整个实例声明为 `mut`——不能只让某个字段可变。

---

## 4.2 结构体简写与更新语法

### 字段简写

当变量名和字段名一样时，可以简写：

```rust
// 📎 片段 1/2：字段简写（MilkTea 定义见 4.1 节）
fn main() {
    let name = String::from("珍珠奶茶");
    let drink = MilkTea { name, price: 15.0, sugar_free: false };
    // name 字段直接用了 name 变量的值
    println!("{}", drink.name);
}
```

<details>
<summary>👉 点开：字段简写完整可运行版（✅ 片段 2/2）</summary>

```rust
struct MilkTea {
    name: String,
    price: f64,
    sugar_free: bool,
}

fn main() {
    let name = String::from("珍珠奶茶");
    let drink = MilkTea { name, price: 15.0, sugar_free: false };
    println!("{}", drink.name);
}
```

</details>

### 更新语法

先有一个实例，再基于它创建一个只改一个字段的新实例：

```rust
// 📎 片段 1/2：先有一个 original 实例
fn main() {
    let original = MilkTea {
        name: String::from("珍珠奶茶"),
        price: 15.0, sugar_free: false,
    };
```

```rust
// 📎 片段 2/2：基于 original 改一个字段
    let no_sugar = MilkTea {
        sugar_free: true,
        ..original // 其余字段照搬
    };
    println!("{} {}", no_sugar.name, no_sugar.sugar_free);
}
```

<details>
<summary>👉 点开：查看「更新语法」完整可运行版（✅）</summary>

```rust
struct MilkTea {
    name: String,
    price: f64,
    sugar_free: bool,
}

fn main() {
    let original = MilkTea {
        name: String::from("珍珠奶茶"),
        price: 15.0,
        sugar_free: false,
    };
    let no_sugar = MilkTea {
        sugar_free: true,
        ..original // 其余字段照搬
    };
    println!("{} {}", no_sugar.name, no_sugar.sugar_free);
}
```

</details>

> **比喻**：更新语法就像你在奶茶店说"和刚才那杯一样，但换成无糖的"——其他参数照搬，只改你需要变的那一项。

---

## 4.3 元组结构体与单元结构体

### 元组结构体

字段没有名字，只有类型，适合简单场景：

```rust
struct Color(i32, i32, i32);
struct Point(i32, i32, i32);

fn main() {
    let red = Color(255, 0, 0);
    let origin = Point(0, 0, 0);
    println!("R={} G={} B={}", red.0, red.1, red.2);
}
```

> **比喻**：元组结构体就像只有几号位的储物柜——你不需要给每个格子起名字，只要知道 1 号柜、2 号柜就行。

### 单元结构体

没有任何字段，用于实现 Trait（后面章节会用到）：

```rust
struct AlwaysEqual;

fn main() {
    let _subject = AlwaysEqual;
}
```

---

## 4.4 方法与关联函数

> 📖 **术语解释 · 方法（Method）**：定义在结构体上的函数，第一个参数是 `&self` 或 `&mut self` 或 `self`，表示"操作自身"。就像给奶茶加了个"加糖"的操作——这个操作属于这杯奶茶。

### 定义方法

先定义结构体，再在 `impl` 块里写方法：

```rust
// 📎 片段 1/3：先定义结构体
#[derive(Debug)]
struct Rectangle { width: f64, height: f64 }
```

> 📖 **术语解释 · #[derive(Debug)]**：`derive`（派生）让编译器**自动实现**括号里的 Trait。`Debug` 决定 `{:?}` 打印格式——加了它，`println!("{:?}", r)` 就能直接打印结构体。后面还会见到 `Clone`（克隆）、`PartialEq`（可比较）等，4.5 节会系统讲。

```rust
// 📎 片段 2/3：在 impl 块里定义方法
impl Rectangle {
    fn area(&self) -> f64 { self.width * self.height }
    fn scale(&mut self, f: f64) {
        self.width *= f; self.height *= f;
    }
}
```

现在用一下这些方法：

```rust
// 📎 片段 3/3：创建实例、调用方法
fn main() {
    let mut r = Rectangle { width: 3.0, height: 4.0 };
    println!("面积: {}", r.area());  // 12
    r.scale(2.0);
    println!("{:?}", r);          // Rectangle { width: 6.0, height: 8.0 }
}
```

<details>
<summary>👉 点开：查看「结构体 + impl 方法 + main」完整可运行版（✅）</summary>

```rust
#[derive(Debug)]
struct Rectangle {
    width: f64,
    height: f64,
}

impl Rectangle {
    fn area(&self) -> f64 {
        self.width * self.height
    }
    fn scale(&mut self, f: f64) {
        self.width *= f;
        self.height *= f;
    }
}

fn main() {
    let mut r = Rectangle { width: 3.0, height: 4.0 };
    println!("面积: {}", r.area()); // 12
    r.scale(2.0);
    println!("{:?}", r); // Rectangle { width: 6.0, height: 8.0 }
}
```

</details>

> 📖 **术语解释 · impl 块**：`impl` 是 implementation 的缩写，`impl 结构体名 { ... }` 块里定义的方法和关联函数都属于这个结构体。就像奶茶店的操作手册——所有关于这杯奶茶的操作都写在手册里。

### 关联函数（Associated Function）

```rust
// 📎 片段 1/2：在已有 impl 块里再加一个关联函数
impl Rectangle {
    fn square(size: f64) -> Rectangle {
        Rectangle { width: size, height: size }
    }
}
```

```rust
// 📎 片段 2/2：用 :: 调用关联函数
fn main() {
    let sq = Rectangle::square(5.0); // 用 :: 调用
    println!("面积: {}", sq.area());  // 25
}
```

<details>
<summary>👉 点开：查看「关联函数 square」完整可运行版（✅）</summary>

```rust
struct Rectangle {
    width: f64,
    height: f64,
}

impl Rectangle {
    fn area(&self) -> f64 {
        self.width * self.height
    }
    fn square(size: f64) -> Rectangle {
        Rectangle { width: size, height: size }
    }
}

fn main() {
    let sq = Rectangle::square(5.0); // 用 :: 调用
    println!("面积: {}", sq.area()); // 25
}
```

</details>

> 📖 **术语解释 · 关联函数**：不以 `self` 为参数的函数，类似其他语言的"静态方法"或"构造函数"。没有实例也能调用。

> 💡 **技巧**：方法用 `.` 调用（`r.area()`），关联函数用 `::` 调用（`Rectangle::square()`）。就像 Python 里 `list.append()` 是方法，`list()` 是"关联函数"。

---

## 4.5 派生 Trait：一行代码搞定常用功能

先看一行代码：

```rust
#[derive(Debug, Clone, PartialEq)]
struct User { name: String, age: u32 }
```

加了 `#[derive]`，这三个 Trait 就自动实现了。来用一下：

```rust
fn main() {
    let u1 = User { name: String::from("Alice"), age: 25 };
    let u2 = u1.clone();         // Clone：深拷贝
    println!("{:?}", u1);       // Debug：打印
    println!("{}", u1 == u2);   // PartialEq：比较
}
```

Rust 提供了 `#[derive]` 属性，自动实现常用 Trait——不用手写一行方法实现。

| 派生 Trait | 功能 |
|-----------|------|
| `Debug` | 允许用 `{:?}` 打印 |
| `Clone` | 允许调用 `.clone()` 深拷贝 |
| `Copy` | 赋值时自动拷贝（需所有字段都是 Copy） |
| `PartialEq` | 允许用 `==` 和 `!=` 比较 |
| `Eq` | 标记"比较永远成立、没有不等价特例"（配合 `PartialEq`；`f64` 等不能用） |
| `Hash` | 计算哈希值；配合 `Eq + PartialEq` 一起派生后才能用作 HashMap 的 Key |
| `Default` | 提供默认值 `User::default()` |

> 📌 **注意**：想把结构体当 `HashMap` 的键，要求 `K: Eq + Hash`——`Hash` 和 `Eq`（以及它依赖的 `PartialEq`）要一起派生，只派生一个 `Hash` 不够。

> ⚠️ **新手坑**：`String` 类型的字段不能 `Copy`（因为 `String` 不是 Copy 类型），所以含 `String` 字段的结构体不能 `#[derive(Copy)]`。想复制就用 `Clone`。

---

## 4.6 课后练习

### 基础题

**1.** 定义一个 `Book` 结构体，包含 `title: String` 和 `pages: u32`，在 `main` 中创建一个实例并打印标题和页数。

<details>
<summary>参考答案要点</summary>

```rust
#[derive(Debug)]
struct Book {
    title: String,
    pages: u32,
}
fn main() {
    let b = Book { title: String::from("Rust入门"), pages: 300 };
    println!("《{}》共 {} 页", b.title, b.pages);
}
```
</details>

### 进阶题

**2.** 给 `Book` 添加一个方法 `reading_time(&self) -> u32`，假设每分钟读 2 页，返回需要多少分钟。再添加一个关联函数 `new(title: &str, pages: u32) -> Book` 作为构造函数。

<details>
<summary>参考答案要点</summary>

```rust
struct Book {
    title: String,
    pages: u32,
}
impl Book {
    fn new(title: &str, pages: u32) -> Book {
        Book { title: String::from(title), pages }
    }
    fn reading_time(&self) -> u32 {
        self.pages / 2
    }
}
fn main() {
    let b = Book::new("Rust进阶", 300);
    println!("需要 {} 分钟读完", b.reading_time());
}
```
关键点：关联函数用 `::` 调用；方法用 `.` 调用。
</details>

### 挑战题

**3.** 定义一个 `BankAccount` 结构体，包含 `owner: String` 和 `balance: f64`。实现三个方法：`deposit(&mut self, amount: f64)`、`withdraw(&mut self, amount: f64) -> bool`（余额不足返回 false）、`info(&self)` 打印账户信息。

<details>
<summary>参考答案要点</summary>

```rust
struct BankAccount {
    owner: String,
    balance: f64,
}
impl BankAccount {
    fn deposit(&mut self, amount: f64) {
        self.balance += amount;
    }
    fn withdraw(&mut self, amount: f64) -> bool {
        if self.balance >= amount {
            self.balance -= amount;
            true
        } else {
            false
        }
    }
    fn info(&self) {
        println!("户主: {} 余额: {}", self.owner, self.balance);
    }
}
fn main() {
    let mut acc = BankAccount { owner: String::from("张三"), balance: 100.0 };
    acc.deposit(50.0);
    acc.info();
    let ok = acc.withdraw(200.0);
    println!("取款成功: {}", ok);
    acc.info();
}
```
关键点：`deposit` 和 `withdraw` 用 `&mut self`；`withdraw` 有返回值用 `if` 表达式。
</details>

---

## 4.7 Mini Project：学生成绩追踪器

用结构体和方法写一个学生成绩追踪器：

```rust
// 📎 片段 1/2：定义 Student 结构体和方法
struct Student {
    name: String,
    scores: Vec<f64>, // Vec<T>：长度可变的数组，第 6 章细讲，这里先照抄
}
impl Student {
    fn new(name: &str) -> Student {
        Student { name: String::from(name), scores: vec![] } // vec![]：空数组
    }
    fn add_score(&mut self, s: f64) { self.scores.push(s); }
    fn average(&self) -> f64 {
        if self.scores.is_empty() { return 0.0; }
        // len() 是 usize（第 3 章讲过），f64 / usize 不能直接除，
        // 用 as 把类型转成 f64
        let mut total = 0.0;
        for score in &self.scores { total += score; }
        total / self.scores.len() as f64
    }
}
```

> 📖 **术语解释 · `as` 类型转换**：`值 as 类型` 做**基础数值类型间的转换**，如 `len as f64`、`x as i32`。注意两点：①浮点转整型会**直接截断小数**（`3.9 as i32` 得 `3`，不是四舍五入）；②大类型转小类型会**截断溢出**（`300i32 as u8` 得 `44`），编译器不拦你。要"安全转换"用第 10 章的 `try_from`。

```rust
// 📎 片段 2/2：使用 Student
fn main() {
    let mut s = Student::new("小明");
    s.add_score(85.0);
    s.add_score(92.0);
    s.add_score(78.0);
    println!("{} 平均分: {:.1}", s.name, s.average());
}
```

<details>
<summary>👉 点开：查看「学生成绩追踪器」完整可运行版（✅）</summary>

```rust
struct Student {
    name: String,
    scores: Vec<f64>,
}
impl Student {
    fn new(name: &str) -> Student {
        Student { name: String::from(name), scores: vec![] }
    }
    fn add_score(&mut self, s: f64) {
        self.scores.push(s)
    }
    fn average(&self) -> f64 {
        if self.scores.is_empty() {
            return 0.0;
        }
        let mut total = 0.0;
        for score in &self.scores {
            total += score;
        }
        total / self.scores.len() as f64
    }
}

fn main() {
    let mut s = Student::new("小明");
    s.add_score(85.0);
    s.add_score(92.0);
    s.add_score(78.0);
    println!("{} 平均分: {:.1}", s.name, s.average());
}
```

</details>

> 📌 **要点**：关联函数 `new` 做"构造函数"，方法 `add_score`/`average` 操作实例。这是 Rust 中最常见的结构体使用模式。

> ### 记忆卡片
>
> **一句话**：结构体是给数据定的"简历模板"，`impl` 给它装上方法。
>
> **口诀**：`&self` 只读、`&mut self` 能改、关联函数没有 self（`::new()`）。
>
> **三个判断题**（心里过一遍）：
> 1. `..base` 更新语法会把 base 中的非 Copy 字段"搬走" → ✓
> 2. 所有 impl 里的函数第一个参数都必须是 self → ✗（关联函数没有 self）
> 3. `&self` 方法可以修改结构体字段 → ✗（要 `&mut self`）

---

## 自检清单

- [ ] 我会定义结构体并创建实例
- [ ] 我理解元组结构体和单元结构体的区别
- [ ] 我会在 `impl` 块里定义方法和关联函数
- [ ] 我知道方法用 `.` 调用、关联函数用 `::` 调用
- [ ] 我会用 `#[derive(Debug, Clone, PartialEq)]` 给结构体加功能
- [ ] 我理解为什么含 `String` 的结构体不能 `Copy`
- [ ] 我完成了学生成绩追踪器 mini project

---

> 🦀 **下一章预告**：第 5 章我们来学枚举（Enum）和模式匹配（Pattern Matching）——这是 Rust 最强大的表达力工具，让代码既安全又优雅。
