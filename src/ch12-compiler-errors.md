# 第12章 编译错误攻坚：与编译器做朋友

> **学习目标**
> - 掌握 Rust 最常见的 6 大编译错误及其修复方案
> - 学会逐行阅读编译器输出，把报错当教学素材
> - 了解 5 个经典新手陷阱及其根因
> - 建立"与编译器合作而非对抗"的心态
>
> **预计学习时长**：2-3 小时

---

## 12.1 为什么 Rust 编译器这么"凶"？

> 💡 **比喻**：Rust 编译器就像一个特别严格的安检员——你包里有一丁点违禁品她都不放过。但你想想，上飞机时你愿意安检松一点还是严一点？严，才能保证不出事。Rust 编译器帮你消灭了段错误、内存泄漏、数据竞争——代价是你得多跟她解释几句。

> 📌 **要点**：Rust 编译器报错信息是所有编程语言里最友好的。它包含：错误码（搜索用）、精确行号定位、上下文标注、修复建议。学会读报错 = 拥有 24 小时免费导师。

---

## 12.2 六大高频编译错误

### 错误一：E0382 — 使用了已移动的值

```rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1;
    println!("{}", s1);  // 报错！
}
```

编译器输出：
```
error[E0382]: borrow of moved value: `s1`
 --> src/main.rs:3:20
  |
1 |     let s1 = String::from("hello");
  |         -- move occurs because `s1` has type `String`
2 |     let s2 = s1;
  |              -- value moved to `s2` here
3 |     println!("{}", s1);
  |                    ^^ value borrowed here after move
  |
help: consider cloning the value
  |
2 |     let s2 = s1.clone();
  |                ++++++++
```

**逐行拆解**：
- `move occurs because s1 has type String` — `String` 不是 Copy 类型，赋值即移动
- `value moved to s2 here` — 第 2 行，所有权转移到了 `s2`
- `value borrowed here after move` — 第 3 行，移动后又用了 `s1`
- `help: consider cloning` — 编译器直接给了修复建议！

**修复方案**：
```rust
let s2 = s1.clone();  // 深拷贝，两边都能用
// 或者：用引用而非移动
let s2 = &s1;         // s1 仍拥有数据
```

> 📌 **要点**：`String`、`Vec`、`HashMap` 等堆数据是 Move 语义；`i32`、`f64`、`bool` 等栈数据是 Copy 语义。

---

### 错误二：E0384 — 不可变变量二次赋值

```rust
fn main() {
    let x = 5;
    x = 6;  // 报错！
}
```

```
error[E0384]: cannot assign twice to immutable variable `x`
 --> src/main.rs:2:5
  |
1 |     let x = 5;
  |         - first assignment to `x`
2 |     x = 6;
  |     ^^^^^ cannot assign twice to immutable variable
```

**修复方案**：
```rust
let mut x = 5;  // 加 mut
x = 6;          // OK
```

> ⚠️ **新手坑**：从 Python/JS 来的人最容易忘 `mut`。看到 `cannot assign twice` 就条件反射加 `mut`。

---

### 错误三：E0502 — 可变与不可变引用冲突

```rust
fn main() {
    let mut s = String::from("hi");
    let r1 = &s;
    let r2 = &mut s;  // 报错！
    println!("{}", r1);
}
```

```
error[E0502]: cannot borrow `s` as mutable because it is also borrowed as immutable
 --> src/main.rs:3:14
  |
1 |     let r1 = &s;
  |               - immutable borrow occurs here
2 |     let r2 = &mut s;
  |              ^^^^^^ mutable borrow occurs here
3 |     println!("{}", r1);
  |                  ---- immutable borrow later used here
```

**逐行拆解**：
- `immutable borrow occurs here` — 第 1 行创建了不可变引用 `r1`
- `mutable borrow occurs here` — 第 2 行又创建可变引用，冲突
- `immutable borrow later used here` — 第 3 行还在用 `r1`，所以 `r1` 的借用没结束

**修复方案**：在创建可变引用前，确保不可变引用不再使用：
```rust
let r1 = &s;
println!("{}", r1);    // r1 用完了
let r2 = &mut s;       // 现在可变借用 OK
```

> 📌 **要点**：Rust 的 NLL（Non-Lexical Lifetimes）特性会自动判断引用的最后使用位置。不是"作用域结束"才释放，而是"最后一次使用"就释放。

---

### 错误四：E0277 — Trait 未实现

```rust
fn print_info<T: std::fmt::Debug>(item: T) {
    println!("{:?}", item);
}

struct MyStruct { name: String }

fn main() {
    print_info(MyStruct { name: String::from("test") });  // 报错！
}
```

```
error[E0277]: the trait bound `MyStruct: Debug` is not satisfied
 --> src/main.rs:6:16
  |
6 |     print_info(MyStruct { name: String::from("test") });
  |               ^^^^^^^^ the trait `Debug` is not implemented for `MyStruct`
  |
help: consider annotating `MyStruct` with `#[derive(Debug)]`
  |
1 + #[derive(Debug)]
  |
```

**修复方案**：编译器直接告诉你加 `#[derive(Debug)]`：
```rust
#[derive(Debug)]
struct MyStruct { name: String }
```

> 💡 **技巧**：看到 `trait bound X is not satisfied`，先看编译器的 `help:` 提示——它通常直接给你修复方案。

---

### 错误五：E0308 — 类型不匹配

```rust
fn add(a: i32, b: i32) -> i32 {
    a + b;  // 报错！多了分号
}
```

```
error[E0308]: mismatched types
 --> src/main.rs:2:5
  |
1 |   fn add(a: i32, b: i32) -> i32 {
  |                              --- expected `i32` because of return type
2 |       a + b;
  |       ^^^^^ expected `i32`, found `()`
  |
help: remove this semicolon
  |
2 -     a + b;
2 +     a + b
  |
```

**修复方案**：删掉分号，或用 `return`：
```rust
fn add(a: i32, b: i32) -> i32 {
    a + b   // 表达式，直接返回
}
```

> 📌 **要点**：当函数本该返回值却返回了 `()` 时，多半是多了分号——分号把表达式变成了语句，语句返回 `()`。

---

### 错误六：E0596 — 不可变变量借为可变

```rust
fn main() {
    let s = String::from("hi");
    let r = &mut s;  // 报错！
}
```

```
error[E0596]: cannot borrow `s` as mutable, as it is not declared as mutable
 --> src/main.rs:2:13
  |
1 |     let s = String::from("hi");
  |         - help: consider changing this to be mutable: `mut s`
2 |     let r = &mut s;
  |             ^^^^^^ cannot borrow as mutable
```

**修复方案**：
```rust
let mut s = String::from("hi");  // 加 mut
let r = &mut s;                   // OK
```

---

## 12.3 五大经典新手陷阱

### 陷阱一：for 循环中使用 Vec 的 len

```rust
let mut v = vec![1, 2, 3];
for i in 0..v.len() {
    v.push(i);  // 想无限添加
}
```

**问题**：`v.len()` 在循环开始时只求值一次，之后不会更新。输出只加了 3 个元素。

**修复**：用 `while` 循环，每次都重新求值：
```rust
let mut v = vec![1, 2, 3];
let mut i = 0;
while i < v.len() {
    v.push(i);
    i += 1;
    if v.len() > 100 { break; } // 安全上限，避免无限循环
}
```

> 📌 **要点**：`for i in 0..v.len()` 的 `v.len()` 是快照——循环开始时确定，之后不变。

---

### 陷阱二：闭包捕获引用后传给线程

```rust
let names = vec![String::from("Alice"), String::from("Bob")];
let name = &names[0];
// std::thread::spawn(move || println!("{}", name));  // 编译错误！
```

**问题**：`name` 是 `&String` 引用，`move` 闭包捕获的是引用本身。但 `thread::spawn` 要求闭包的生命周期是 `'static`（不能借用主线程的局部变量），所以编译器拒绝。

**修复**：直接克隆所需值，让闭包拥有自己的数据：
```rust
let name = names[0].clone();
std::thread::spawn(move || println!("{}", name));  // 现在安全了
```

---

### 陷阱三：String 索引不是字符

```rust
let s = "你好";
// println!("{}", s[0]);  // 编译错误！
```

**问题**：Rust 的 `String` 是 UTF-8 字节序列。`"你好"` 每个汉字占 3 字节，`s[0]` 取的是第 1 个字节，不是一个完整字符。

**修复**：用 `chars()` 按字符遍历：
```rust
let s = "你好";
let first_char = s.chars().next().unwrap();  // '你'
println!("{}", first_char);
```

> 💡 **比喻**：Rust 字符串是一列 UTF-8 字节的火车。你直接数"第 3 节车厢"可能取到的不是你想要的字符——因为有的字符占 1 节车厢，有的占 3 节。

---

### 陷阱四：迭代器的惰性

```rust
let nums = vec![1, 2, 3];
nums.iter().map(|x| println!("{}", x));  // 什么都没打印！
```

**问题**：迭代器是惰性的——你创建了 map 迭代器但没有消费它，`println!` 永远不会执行。

**修复**：加 `.collect()` 或用 `for`：
```rust
nums.iter().map(|x| println!("{}", x)).collect::<Vec<_>>();
// 或更好的写法：
for x in &nums { println!("{}", x); }
```

---

### 陷阱五：算术溢出

```rust
let x: u8 = 255;
let y = x + 1;  // debug 模式 panic，release 模式回绕到 0
```

**问题**：`u8` 最大值是 255，加 1 溢出。Debug 模式直接 panic，Release 模式默默回绕（变成 0）。

**修复**：用 `checked_add` 或 `saturating_add`：
```rust
let y = x.checked_add(1).unwrap_or(255);   // 溢出返回 255
let z = x.saturating_add(1);                 // 饱和加法，溢出停在 255
```

> ⚠️ **新手坑**：Debug 和 Release 行为不同！开发时正常，上线后默默出错——最难排查的 bug。

---

## 12.4 FAQ：编译器报错常见问题

**Q: 编译器说了一大堆 `error`，我该从哪个开始看？**

> 从**第一个**开始看。Rust 编译器一次编译会输出多个错误，但它们可能是连锁反应——修了第一个，后面的可能自动消失。每修一个就重新编译，别想一口气修完所有问题。就像多米诺骨牌，推倒第一个才知道后面有几个。

**Q: 编译器建议我加 `#[derive(Debug)]`，加了之后又报别的错怎么办？**

> 别想一口气修完所有问题——每修一个就重新编译，看下一个。

**Q: Debug 模式能跑，Release 模式报错怎么办？**

> 大概率是未定义行为（UB）或溢出。Debug 有更多运行时检查，Release 优化掉了。用 `cargo run --release` 复现后，检查是否有算术溢出或 `unsafe` 代码。

**Q: 报错信息太长看不懂怎么办？**

> 三个步骤：1) 看 `error[Exxxx]` 错误码，搜 `rust Exxxx` 2) 看 `--> src/xxx.rs:行:列` 定位 3) 看 `help:` 部分——编译器经常直接给修复方案。

---

## 12.5 课后练习

### 基础题

**1.** 以下代码报了什么错误？如何修复？
```rust
fn main() {
    let mut s = String::from("hello");
    let r = &mut s;
    println!("{}{}", s, r);
}
```

<details>
<summary>参考答案要点</summary>

错误：E0502 — `s` 被借为可变（`r`）后，又在 `println!` 中不可变借用（`s` 和 `r` 同时使用）。修复：在可变借用前使用 `s`，或先消费可变引用：
```rust
let mut s = String::from("hello");
{
    let r = &mut s;
    r.push_str(" world");
}
println!("{}", s);
```
</details>

### 进阶题

**2.** 以下代码输出什么？为什么不是 `[1, 2, 3, 0, 1, 2, 3, 4]`？
```rust
let mut v = vec![1, 2, 3];
for i in 0..v.len() {
    v.push(i);
}
```

<details>
<summary>参考答案要点</summary>

输出 `v` 为 `[1, 2, 3, 0, 1, 2]`。因为 `v.len()` 在循环开始时求值一次（=3），所以循环只跑 3 次。修复：用 `while i < v.len()` 每次重新求值。
</details>

### 挑战题

**3.** 以下代码编译失败，找出所有错误并修复。指出每个错误的错误码。
```rust
fn double(x: i32) -> i32 {
    x * 2;
}
fn main() {
    let s = String::from("hello");
    let s2 = s;
    println!("{}", s);
    let n = double(5);
    println!("{}", n);
}
```

<details>
<summary>参考答案要点</summary>

两个错误：
1. `E0308` — `double` 函数 `x * 2;` 多了分号，返回 `()` 而非 `i32`。修复：删分号
2. `E0382` — `s` 被 move 到 `s2` 后又使用 `s`。修复：用 `s.clone()` 或 `&s`

```rust
fn double(x: i32) -> i32 { x * 2 }  // 修复 E0308
fn main() {
    let s = String::from("hello");
    let s2 = s.clone();               // 修复 E0382
    println!("{}", s);
    let n = double(5);
    println!("{}", n);
}
```
</details>

---

## 12.6 Mini Project：Debug 大挑战

下面这段代码有 **2 个错误**。你的任务：编译它、读懂每个报错、逐一修复——全程不许看提示。

```rust
fn double(x: i32) -> i32 {
    x * 2;
}

fn main() {
    let s = String::from("hello");
    let s2 = s;
    println!("{}", s);
    let n = double(5);
    println!("{}", n);
}
```

<details>
<summary>卡住了？点开看错误清单（先自己试！）</summary>

1. **E0308** — `double` 函数 `x * 2;` 多了分号，返回 `()` 而非 `i32` → 删分号
2. **E0382** — `s` 被 move 到 `s2` 后又使用 `s` → 用 `s.clone()` 或 `&s`
3. 验证：修完后编译通过，输出 `hello` 和 `10`

修复后：
```rust
fn double(x: i32) -> i32 {
    x * 2
}

fn main() {
    let s = String::from("hello");
    let s2 = s.clone();
    println!("{}", s);
    let n = double(5);
    println!("{}", n);
}
```
</details>

> 📌 **要点**：真实工作中 debug 就是这个节奏——一次编译报多个错，从第一个修起，每修一个重新编译。这个过程练 10 遍，你对编译器输出的"语感"就培养起来了。

> ### 📝 记忆卡片
>
> **一句话**：编译器输出 = 错误码 + 位置 + help——从第一个错修起，改一个编译一次。
>
> **口诀**：E0382 搬走了、E0384 没加 mut、E0502 借用撞车。
>
> **三个判断题**（心里过一遍）：
> 1. 一次报 5 个错，应该全改完再重新编译 → ✗（从第一个改起，改一个验一个）
> 2. 编译器的 `help:` 提示通常可以直接采纳 → ✓
> 3. Release 模式下整数溢出会 panic → ✗（Debug 才 panic，Release 是回绕）

---

## 自检清单

- [ ] 我能看懂 `error[Exxxx]` 错误码并搜索解决方案
- [ ] 我理解 E0382（moved value）和 E0384（immutable）的区别
- [ ] 我知道 E0502（可变/不可变引用冲突）怎么修
- [ ] 我知道 E0308（类型不匹配）通常是多加了分号
- [ ] 我会读编译器的 `help:` 提示
- [ ] 我知道 for 循环中 `v.len()` 只求值一次
- [ ] 我知道 String 不能直接用索引访问字符
- [ ] 我知道迭代器是惰性的，需要消费才会执行
- [ ] 我知道 Debug 和 Release 在溢出时行为不同
- [ ] 我完成了 Debug 大挑战 mini project

---

> 🦀 **下一章预告**：第 13 章我们来看 Rust 的内存布局——用可视化方式理解栈、堆、指针的关系，"看得透"才能写得好。
