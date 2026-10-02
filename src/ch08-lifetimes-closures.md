# 第8章 生命周期与闭包：高级引用

> **学习目标**
> - 理解生命周期（Lifetime）的概念和标注语法
> - 学会函数、结构体中的生命周期标注
> - 掌握闭包（Closure）的定义和使用
> - 理解闭包捕获变量的三种方式
>
> **预计学习时长**：3-4 小时（本章是难点，别急）

---

## 8.1 生命周期：引用的"保质期"

> 📖 **术语解释 · 生命周期（Lifetime）**：编译器用来追踪引用有效期的机制。每个引用都有一个生命周期——从创建到最后一次使用的这段时间。就像食物有保质期，引用也有"有效期限"。

> 💡 **比喻**：生命周期就是奶茶的保质期——你借了一杯奶茶（引用），这杯奶茶必须在你的保质期（生命周期）内还是好的。如果奶茶过期了（原数据被释放）你还在喝（使用引用），那就是悬垂引用——Rust 编译器会拦住你。

### 为什么需要生命周期标注？

```rust
// 这个函数返回两个字符串中较长的那个——但编译器不知道返回的引用和谁关联
fn longest(x: &str, y: &str) -> &str {
    if x.len() > y.len() { x } else { y }
}
// 编译错误：需要生命周期参数！
```

> 🔧 **报错解法**：编译器报 `missing lifetime specifier`。你需要告诉编译器：返回的引用和哪个参数的生命周期一致。

### 生命周期标注语法

```rust
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}

fn main() {
    let s1 = String::from("long string");
    let s2 = String::from("hi");
    let result = longest(s1.as_str(), s2.as_str());
    println!("较长的: {}", result);
}
```

> 📖 **术语解释 · `<'a>`**：生命周期参数，用单引号加名称表示。`'a` 读作"生命周期 a"。它不改变引用的实际寿命，只是告诉编译器多个引用之间的**关系**——"返回值的生命周期和参数一样长"。

> 💡 **比喻**：`'a` 就像保质期标签——你告诉编译器"返回值和参数 x、y 用的是同一个保质期标签"。编译器据此检查：调用方使用返回值时，x 和 y 是否还活着。

> 🖼️ **图示（参考 cheats.rs · Meaning of `r: &'c S`）**：生命周期参数 `'c` 要求"被引用的数据活得足够久"，同时引用自己也不能活过 `'c`。

```text
假设拿到一个 r: &'c S：

地址        值
0xa  ┌─────┐
     │ S(0)│   ← 被 r 指向的数据；'c 要求它至少存在 'c 这么久
     └─────┘
0x6  ┌─────┐
     │ S(1)│
     └─────┘
0x3  ┌─────┐
     │ S(2)│
     └─────┘
     r : 0x6   ← r 自己也不能比 'c 活得久；
                 一旦 r 失效，对 0x6 的"借用锁"解开，原数据可重新被直接读写
```

### 生命周期省略规则

大多数时候你不用手写生命周期标注，编译器有三条省略规则：

1. 每个引用参数都有自己的生命周期参数。
2. 如果只有一个输入引用参数，输出引用用同样的生命周期。
3. 如果有 `&self` 或 `&mut self`，输出用 `self` 的生命周期。

```rust
// 省略前（手动标注）
fn first_word_explicit<'a>(s: &'a str) -> &'a str { s }
// 省略后（规则 1+2 自动应用）
fn first_word(s: &str) -> &str { s }
```

> ⚠️ **新手坑**：当函数有多个引用参数且返回引用时，编译器无法自动推断，必须手动标注。看到 `missing lifetime specifier` 就知道要加 `<'a>` 了。

---

> 🖼️ **图示（参考 cheats.rs · Borrowed State）**：通过 `&mut b` 借出后，原变量 `b` 被标记为"已借出"（⛔），在引用存活期间不能被直接读写；引用最后一次使用后 `b` 才解锁。这正是生命周期标注要解决的问题。

```text
let mut b = S(2);          // 地址 0x6
let r = &mut b;            // 借走后，b 进入"已借出"状态

┌──────────────┐
│ b : S(2)     │   地址 0x6   ← 在 r 存活期间，b 不能再被直接读写（⛔）
├──────────────┤
│ r : 0x6      │   ← r 是唯一能碰这块内存的把手
└──────────────┘
   // 直到 r 最后一次使用，b 才"解锁"，可被重新读写
```

## 8.2 结构体中的生命周期

结构体包含引用字段时，必须标注生命周期：

```rust
struct Excerpt<'a> {
    part: &'a str,
}

fn main() {
    let novel = String::from("这是一个很长的故事...");
    let first = &novel[..12]; // "这是一个"（4 个汉字 × 3 字节）
    let excerpt = Excerpt { part: first };
    println!("{}", excerpt.part);
}
```

> 💡 **比喻**：结构体包含引用就像你拿着一张借书证——借书证（结构体）的有效期不能超过书（被引用的数据）在图书馆的存放期。`'a` 确保结构体不会比被引用的字符串活得更久。

---

## 8.3 `'static` 生命周期

`'static` 表示引用在整个程序运行期间都有效。所有字符串字面量都是 `'static`：

```rust
fn main() {
    let s: &'static str = "我活了整个程序"; // 字面量是 'static
    println!("{}", s);
}
```

> ⚠️ **新手坑**：不要为了消除生命周期错误就随便加 `'static`——这通常意味着你的设计有问题。`'static` 应该让编译器推断，而不是手动标注。

---

## 8.4 闭包：匿名函数

先看一段代码——用闭包做加法：

```rust
let add = |a: i32, b: i32| a + b;  // 闭包
let greet = || println!("你好！");    // 无参数闭包
println!("{}", add(1, 2));         // 3
greet();                            // 你好！
```

> 📖 **术语解释 · 闭包（Closure）**：可以捕获外部变量的匿名函数。相当于 JS 的箭头函数 `() => {}` 或 Python 的 `lambda`。Rust 闭包用 `|参数| { 函数体 }` 语法。

> 💡 **比喻**：闭包就像一个"带记忆的计算器"——不仅有自己的运算逻辑，还能记住外面定义的变量。普通函数是"白纸"，闭包是"带着笔记本"的函数。

### 捕获变量

闭包可以捕获外部变量，有三种方式：

```rust
fn main() {
    let name = String::from("Alice");

    // 1. 不可变借用（Fn）
    let greet = || println!("你好 {}", name);
    greet();

    // 2. 可变借用（FnMut）
    let mut count = 0;
    let mut inc = || { count += 1; };
    inc();
    println!("count = {}", count); // 1

    // 3. 获取所有权并消耗它（FnOnce——只能调用一次）
    let msg = String::from("hello");
    let consume = || {
        let _taken = msg;  // 把 msg 移出闭包环境 → FnOnce
    };
    consume();
    // consume(); // 取消注释会报错：FnOnce 只能调用一次
}
```

> 📖 **术语解释 · Fn / FnMut / FnOnce**：三种闭包 Trait，按捕获方式递进：
> - `Fn`：不可变借用外部变量（最常见）
> - `FnMut`：可变借用外部变量
> - `FnOnce`：移走外部变量所有权（只能调用一次）
>
> `move` 描述的是"怎么拿"（一开始就按值拿），`Fn`/`FnMut`/`FnOnce` 描述的是"怎么用"（只读 / 可写 / 移走）。`move` 闭包完全可能是 `Fn`（如上方第 1 个示例）。编译器自动推断，你通常不用手动标注。

### `move` 关键字

`move` 强制闭包获取外部变量的所有权：

```rust
fn main() {
    let data = vec![1, 2, 3];
    let printer = move || println!("{:?}", data);
    printer();
    // println!("{:?}", data); // 编译错误：data 已被移动
}
```

> 💡 **比喻**：`move` 就像你把笔记本从桌上"搬"到手里——原来的位置就空了。常用于多线程场景，把数据"搬"到新线程。

---

## 8.5 闭包作为参数

```rust
fn apply<F: Fn(i32) -> i32>(f: F, x: i32) -> i32 {
    f(x)
}

fn main() {
    let double = |x| x * 2;
    let add_one = |x| x + 1;
    println!("{}", apply(double, 5));    // 10
    println!("{}", apply(add_one, 5));  // 6
}
```

### 闭包作为返回值

```rust
fn make_adder(n: i32) -> impl Fn(i32) -> i32 {
    move |x| x + n  // move 确保闭包拥有 n 的拷贝
}

fn main() {
    let add5 = make_adder(5);
    println!("{}", add5(3)); // 8
}
```

> ⚠️ **新手坑**：返回闭包时通常需要 `move`，因为闭包引用的局部变量在函数返回后会失效。不加 `move` 会报生命周期错误。

---

## 8.6 课后练习

### 基础题

**1.** 写一个函数 `longest_word(words: &[&str]) -> Option<&str>`，返回最长的字符串切片。注意生命周期标注。

<details>
<summary>参考答案要点</summary>

```rust
fn longest_word<'a>(words: &'a [&'a str]) -> Option<&'a str> {
    let mut longest: &str = "";
    for &w in words {
        if w.len() > longest.len() {
            longest = w;
        }
    }
    if longest.is_empty() { None } else { Some(longest) }
}
fn main() {
    let words = ["apple", "banana", "kiwi"];
    println!("{:?}", longest_word(&words)); // Some("banana")
}
```
关键点：别看只有一个参数，`&[&str]` 里有**两个**生命周期（切片借用 + 内层 `&str`），省略规则 2 要求"恰好一个输入生命周期"才生效——所以这里必须手写 `<'a>`。
</details>

### 进阶题

**2.** 写一个函数 `make_multiplier(factor: f64) -> impl Fn(f64) -> f64`，返回一个闭包把输入乘以 `factor`。在 `main` 中测试。

<details>
<summary>参考答案要点</summary>

```rust
fn make_multiplier(factor: f64) -> impl Fn(f64) -> f64 {
    move |x| x * factor
}
fn main() {
    let double = make_multiplier(2.0);
    let triple = make_multiplier(3.0);
    println!("{}", double(5.0));  // 10
    println!("{}", triple(5.0));  // 15
}
```
关键点：`move` 捕获 `factor` 的所有权；`f64` 是 Copy 类型所以实际是拷贝。
</details>

### 挑战题

**3.** 定义一个包含字符串引用的结构体 `TextEditor<'a>`，有 `text: &'a str` 字段。实现方法 `word_count(&self) -> usize`（按空格分隔统计单词数）和 `contains(&self, keyword: &str) -> bool`。在 `main` 中测试，确保被引用的字符串比结构体活得久。

<details>
<summary>参考答案要点</summary>

```rust
struct TextEditor<'a> {
    text: &'a str,
}
impl<'a> TextEditor<'a> {
    fn word_count(&self) -> usize {
        self.text.split_whitespace().count()
    }
    fn contains(&self, keyword: &str) -> bool {
        self.text.contains(keyword)
    }
}
fn main() {
    let content = String::from("Rust is awesome and Rust is fast");
    let editor = TextEditor { text: &content };
    println!("单词数: {}", editor.word_count()); // 7
    println!("包含 fast: {}", editor.contains("fast")); // true
}
```
关键点：`impl<'a>` 在 impl 块上也要标注生命周期；`content` 的生命周期必须比 `editor` 长——这里 `content` 在 main 作用域，`editor` 也在，编译器自动检查。
</details>

---

## 8.7 Mini Project：可配置的过滤器

用闭包写一个列表过滤器——接收一个闭包决定保留哪些元素：

```rust
fn filter<F>(nums: &[i32], f: F) -> Vec<i32>
where F: Fn(&i32) -> bool
{
    nums.iter().filter(|&x| f(x)).cloned().collect()
}
```

```rust
fn main() {
    let nums = vec![1, 2, 3, 4, 5, 6, 7, 8];
    let evens = filter(&nums, |x| x % 2 == 0);
    let bigs = filter(&nums, |x| *x > 4);
    println!("偶数: {:?}", evens); // [2, 4, 6, 8]
    println!("大于4: {:?}", bigs); // [5, 6, 7, 8]
}
```

> 📌 **要点**：同一个 `filter` 函数，传入不同闭包就能做不同过滤——这就是函数式编程的威力。闭包让代码像积木一样可组合。

> ### 📝 记忆卡片
>
> **一句话**：生命周期标注只"描述"引用之间的关系，不改变任何引用的寿命。
>
> **口诀**：三个省略规则能省则省；`move` 强制拿走所有权。
>
> **三个判断题**（心里过一遍）：
> 1. 加了 `'a` 标注，引用就能活得更久 → ✗（只描述关系，不延长寿命）
> 2. 加了 `move` 的闭包一定是 FnOnce → ✗（move 决定捕获方式，怎么用才决定 Fn/FnMut/FnOnce）
> 3. 大多数函数不需要手写生命周期标注 → ✓（省略规则覆盖）

---

## 自检清单

- [ ] 我理解生命周期是编译器追踪引用有效期的机制
- [ ] 我会标注函数和结构体的生命周期参数 `<'a>`
- [ ] 我知道生命周期省略规则，能判断何时需要手动标注
- [ ] 我理解 `'static` 的含义和适用场景
- [ ] 我会定义闭包并捕获外部变量
- [ ] 我理解 `Fn` / `FnMut` / `FnOnce` 的区别
- [ ] 我知道何时需要 `move` 关键字
- [ ] 我完成了可配置过滤器 mini project

---

> 🦀 **下一章预告**：第 9 章我们学迭代器（Iterator）和模块系统——让代码既优雅又可维护。
