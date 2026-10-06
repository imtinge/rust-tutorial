# 第3章 所有权与借用：Rust 的灵魂

> **学习目标**
> - 理解所有权（Ownership）的三条规则
> - 掌握移动（Move）与拷贝（Copy）的区别
> - 学会借用（Borrowing）与引用（Reference）
> - 理解可变引用与不可变引用的规则
> - 认识切片（Slice）类型
>
> **预计学习时长**：3-4 小时（本章是重点，慢慢来）

---

## 3.1 为什么需要所有权？

在 Python 和 JavaScript 里，你创建变量、传参、返回值，内存由垃圾回收器（GC）自动清理。方便是方便，但 GC 运行时会有性能开销。

在 C/C++ 里，你手动分配释放内存。快是快，但人类嘛，总是会忘记释放（内存泄漏）或者释放两次（崩溃）。

Rust 的方案是**所有权系统**——编译时检查内存安全，运行时零开销。没有 GC，没有手动管理，全靠编译器在编译时帮你检查。

> **比喻**：所有权就像奶茶杯的使用权——你买了一杯奶茶，这杯奶茶的"所有权"就是你的。你喝完了把杯子扔掉（离开作用域自动释放）。你要借给别人喝（借用），但不能两个人同时独占一杯（同一时刻只有一个所有者）。

> 💡 **另一个比喻**：**垃圾回收的性能开销 = 穿全套盔甲走路**。Python/JS 的 GC 让你安全，但每一步都多了额外负担。Rust 的所有权模型让你像脱掉盔甲一样轻装上阵——代价是你得学会怎么管理所有权。

---

## 3.2 所有权三条规则

Rust 所有权系统建立在这三条规则上：

1. **每个值都有一个所有者**（一个变量）。
2. **同一时刻，一个值只能有一个所有者**。
3. **当所有者离开作用域，值被自动释放**（drop）。

> 📖 **术语解释 · 作用域（Scope）**：变量"活着"的范围。在 `{}` 包裹的代码块里声明的变量，出了这个 `{}` 就不存在了。就像你住在宿舍楼里，出了宿舍楼就不再是"这个楼的住户"。

```rust
// ✅ 完整可运行
fn main() {
    {                           // s 的作用域开始
        let s = String::from("hi");
        println!("{}", s);
    }                           // s 离开作用域，内存自动释放
    // println!("{}", s);       // 编译错误：s 不存在了
}
```

---

## 3.3 移动（Move）：所有权的转移

对于堆上的数据（如 `String`），赋值不是拷贝，而是"移动"——所有权转交，原变量失效。

```rust
// ✅ 完整可运行
fn main() {
    let s1 = String::from("hello");
    let s2 = s1;          // s1 的所有权"移动"给了 s2
    // println!("{}", s1); // 编译错误：s1 已失效
    println!("{}", s2);    // OK
}
```

> ⚠️ **新手坑**：这是从 Python 过来最容易踩的坑。Python 里 `s2 = s1` 后两个都能用，Rust 里 `s1` 被"掏空"了。

> 🔧 **报错解法**：上面代码如果取消注释 `println!("{}", s1)`（该行在第 4 行），编译器会给你这样的输出：
> ```
> error[E0382]: borrow of moved value: `s1`
>  --> src/main.rs:4:20
>   |
> 2 |     let s1 = String::from("hello");
>   |         -- move occurs because `s1` has type `String`, which does not implement the `Copy` trait
> 3 |     let s2 = s1;
>   |              -- value moved here
> 4 |     println!("{}", s1);
>   |                    ^^ value borrowed here after move
>   |
> help: consider cloning the value if the performance cost is acceptable
>   |
> 3 |     let s2 = s1.clone();
>   |                ++++++++
> ```
> 逐行拆解：
> - `error[E0382]` — 错误码，表示"使用了已被移动的值"
> - `move occurs because s1 has type String, which does not implement the Copy trait` — 告诉你为什么移动：因为 `String` 不是 Copy 类型
> - `value moved here` — 指出在第 3 行，`s1` 的值移动到了 `s2`
> - `value borrowed here after move` — 指出在第 4 行，你试图在移动后使用 `s1`
>
> 解决方案：如果两边都要用，用 `let s2 = s1.clone();` 显式克隆。
>
> 📌 **要点**：编译器报错不是终点——它是教学。仔细读每一行，你会发现自己对"移动"概念的理解在报错中逐渐加深。与编译器合作，而非对抗。
>
> **比喻**：移动就像你把奶茶杯给了别人——杯子只有一个，给了别人你就没有了。如果你想两人各一杯，那就买两杯（clone）。

> **图示（参考 cheats.rs · Move Semantics）**：下面的小图用 `S(n)` 表示栈上的"命名称"（变量槽），`▼` 表示值落到哪个槽。和上面代码对照看，移动的本质一目了然。

```text
栈 (stack)
┌─────────────┐
│ t : S(1)    │   ← let t = S(1);  在栈上预留名为 t 的槽，存入值 S(1)
└─────────────┘
      │   let a = t;   ← 执行"移动"：值从 t 的槽搬到 a 的槽
      ▼
┌─────────────┐
│ a : S(1)    │   ← a 现在持有这个值
├─────────────┤
│ t : (失效)   │   ← t 被标记失效：编译器禁止你再碰它
└─────────────┘
                 （若 S 是 Copy 类型，这里是拷贝，t 仍可用——见下文"拷贝"）
```

### 拷贝（Copy）：栈数据的例外

对于栈上的简单类型（整数、浮点数、布尔等），赋值时自动拷贝，原变量仍然有效：

```rust
// ✅ 完整可运行
fn main() {
    let x = 5;
    let y = x;        // i32 是 Copy 类型，直接拷贝
    println!("{} {}", x, y); // 两个都能用
}
```

> 📖 **术语解释 · 栈（Stack）与堆（Heap）**：栈像食堂的餐盘——后放先拿，速度快，大小固定。堆像自助仓库——你想要多大空间就申请多大，但管理更复杂。整数等简单值放栈上，`String` 等动态数据放堆上。

---

## 3.4 函数与所有权

把值传给函数，所有权也跟着移动：

```rust
// ✅ 完整可运行
fn say(name: String) {
    println!("你好, {}", name);
} // name 离开作用域，被释放

fn main() {
    let s = String::from("Rust");
    say(s);              // s 的所有权移动到函数里
    // println!("{}", s); // 编译错误：s 已移动
}
```

函数返回值也会转移所有权：

```rust
// ✅ 完整可运行
fn make_greeting() -> String {
    String::from("Hello!")
}

fn main() {
    let s = make_greeting(); // 所有权从函数转移到 main
    println!("{}", s);        // OK
}
```

---

## 3.5 引用与借用

每次传参都把所有权移走也太麻烦了。Rust 的解法是**借用**——你把东西"借"给别人用，但所有权还是你的。

> 📖 **术语解释 · 借用（Borrowing）**：通过引用使用某个值，但不获取所有权。就像你把书借给同学看，书还是你的，同学看完要还回来。

> **比喻**：借用检查器就像宿舍的查寝阿姨——她确保借东西的规矩被遵守：不能两个人同时拿走同一件东西（不可变和可变引用不能共存），借了的东西不能被原主人在借出期间修改（可变借用时不能有其他引用）。

### 不可变引用 `&T`

```rust
// ✅ 完整可运行
fn len(s: &String) -> usize {
    s.len() // 只读，不获取所有权
}

fn main() {
    let s = String::from("hello");
    let l = len(&s);     // 借用 s 的引用
    println!("'{}' 长度 {}", s, l); // s 仍然可用！
}
```

> 📖 **术语解释 · usize**：无符号整数类型，位数和本机指针一样（64 位机器上就是 64 位）。所有"长度、容量、下标"都用它——`len()` 返回 `usize`，数组/`Vec` 的下标也必须是 `usize`，想拿 `i32` 变量当下标得先转（见后文 `as`）。

> **图示（参考 cheats.rs · References as Pointers）**：下面的小图用 `S(n)` 表示栈上的"命名称"（变量槽），`0x..` 表示内存地址。它直观说明"引用存的是地址，不是值"。

```text
栈 (stack)
┌──────────────┐
│ a : S(1)     │   地址 0x100   ← let a = S(1);
├──────────────┤
│ r : 0x100    │   ← let r = &a;  r 这个 &S 存的是 a 的【地址】，不是值
└──────────────┘
                 r 不拥有 S(1)，只是"记下了 a 在哪"。
                 a 离开作用域时 S(1) 被释放——若 r 还指向它就成悬垂引用，
                 借用检查器会提前拦下这种用法。
```

### 可变引用 `&mut T`

```rust
// ✅ 完整可运行
fn push_world(s: &mut String) {
    s.push_str(", world");
}

fn main() {
    let mut s = String::from("hello");
    push_world(&mut s);     // 可变借用
    println!("{}", s);      // "hello, world"
}
```

> **图示（参考 cheats.rs · (Mutable) References）**：可变引用 `&mut T` 是唯一能改写那块内存的把手——"解引用 `*r`"就是顺着地址去改原值。

```text
栈 (stack)
┌──────────────┐
│ a : S(1)     │   地址 0x100   ← let mut a = S(1);
├──────────────┤
│ r : 0x100    │   ← let r = &mut a;  r 是唯一能改这块内存的把手
└──────────────┘
   *r = S(2);   ← 通过 r 把 0x100 处的值改成 S(2)，a 本身也变成 S(2)
                 解引用 *r = "顺着地址去改那块内存"
```

### 借用的两条铁律

1. **同一时刻，可以有多个不可变引用，或者只有一个可变引用**——不能混搭。
2. **引用必须始终有效**——不能引用已经释放的数据。

```rust
// ✅ 完整可运行
fn main() {
    let mut s = String::from("hi");
    let r1 = &s;       // 不可变借用
    let r2 = &s;       // 多个不可变借用 OK
    // let r3 = &mut s; // 编译错误：已有不可变引用
    println!("{} {}", r1, r2);

    let r3 = &mut s;   // r1, r2 不再使用后，可变借用 OK
    r3.push_str("!");
    println!("{}", r3);
}
```

> ⚠️ **新手坑**：不可变引用和可变引用不能同时存在。编译器报 `cannot borrow as mutable because it is also borrowed as immutable`。记住：**要么多个只读，要么一个可写，不能混着来。**

> 🔧 **报错解法**：如果报借用冲突，检查是否有不可变引用还没用完就创建了可变引用。解决方案：在创建可变引用前，确保所有不可变引用不再使用（Rust 的 NLL 特性会自动判断引用最后使用的位置）。

---

## 3.6 悬垂引用——Rust 不允许

> 📖 **术语解释 · 悬垂引用（Dangling Reference）**：引用指向的内存已经被释放了。就像你拿着一张已过期的仓库号牌去取东西——仓库都拆了。

```rust
// fn dangle() -> &String {
//     let s = String::from("hi");
//     &s  // 错误！s 在函数结束时被释放，引用就悬垂了
// }
```

Rust 编译器会直接拒绝这段代码。解决方案——返回 `String` 本身，转移所有权：

```rust
fn no_dangle() -> String {
    let s = String::from("hi");
    s // 移动所有权，不悬垂
}
```

---

## 3.7 切片（Slice）

切片是对一段连续数据的"引用视图"，不获取所有权。

```rust
// ✅ 完整可运行
fn main() {
    let s = String::from("hello world");
    let hello: &str = &s[0..5];   // 切片：前5个字符
    let world: &str = &s[6..11];   // 切片：后5个字符
    println!("{} {}", hello, world);
}
```

> 📖 **术语解释 · 切片（Slice）**：就像你切了一块蛋糕——你不拥有整个蛋糕（所有权在原蛋糕手里），但你拿着这块切片可以看、可以吃。`&str` 就是字符串切片的类型。

> ⚠️ **新手坑**：切片下标必须落在 **UTF-8 字符边界**上。Rust 字符串是按字节切的，而一个汉字占 3 个字节：对 `"你好"` 取 `[0..1]` 正好切在"你"字中间，程序会在运行时 panic（`byte index 1 is not a char boundary`）。处理中文等非 ASCII 文本时，别想当然地按"第几个字"去切，可改用 `chars()` 等方法。

数组也有切片：

```rust
// ✅ 完整可运行
fn main() {
    let arr = [1, 2, 3, 4, 5];
    let slice: &[i32] = &arr[1..4]; // [2, 3, 4]
    println!("{:?}", slice);
}
```

> 💡 **字节切片 `&[u8]`**：`String`/`&str` 的底层是 UTF-8 字节序列，调用 `.as_bytes()` 能得到它的字节切片 `&[u8]`（一串 `u8`）。当你要"按字节"处理文本（比如找空格、分隔符）时，`as_bytes()` + 字节切片比 `chars()` 更直接；每个字节可用字节字面量 `b' '` 比对。注意 `&[u8]` 和 `&str` 不是一回事——前者是裸字节，后者保证是合法 UTF-8。

---

## 3.8 课后练习

### 基础题

**1.** 以下代码会编译失败吗？为什么？怎么修？

```rust
fn main() {
    let s = String::from("rust");
    let s2 = s;
    println!("{}", s);
}
```

<details>
<summary>参考答案要点</summary>

会编译失败。`let s2 = s;` 把 `s` 的所有权移动给了 `s2`，之后 `s` 失效。
修复方案一：`let s2 = s.clone();`
修复方案二：把 `println!("{}", s)` 改成 `println!("{}", s2);`
</details>

### 进阶题

**2.** 写一个函数 `first_word(s: &String) -> &str`，返回字符串中第一个单词的切片（以空格分隔）。在 `main` 中测试。

<details>
<summary>参考答案要点</summary>

```rust
// ✅ 完整可运行
fn first_word(s: &String) -> &str {
    let bytes = s.as_bytes();
    for (i, &byte) in bytes.iter().enumerate() {
        if byte == b' ' { return &s[0..i]; }
    }
    &s[..] // 没有空格，整个字符串就是第一个单词
}
fn main() {
    let s = String::from("hello world");
    let w = first_word(&s);
    println!("{}", w); // hello
}
```
关键点：返回切片 `&str` 而不是 `String`，避免所有权转移；借用 `&String` 不获取所有权。
</details>

### 挑战题

**3.** 解释以下代码为什么编译失败，并修复它（保持功能不变）：

```rust
fn main() {
    let mut s = String::from("hello");
    let r1 = &s;
    let r2 = &mut s;
    println!("{} {}", r1, r2);
}
```

<details>
<summary>参考答案要点</summary>

编译失败原因：`r1` 是不可变引用，`r2` 是可变引用，不能同时存在。
修复方案：
```rust
// ✅ 完整可运行
fn main() {
    let mut s = String::from("hello");
    let r1 = &s;
    println!("{}", r1);       // 先用完 r1
    let r2 = &mut s;          // r1 不再使用，可变借用 OK
    r2.push_str(" world");
    println!("{}", r2);
}
```
关键点：理解 NLL（Non-Lexical Lifetimes）——引用的有效期到**最后一次使用**为止，不是到作用域结束。
</details>

---

## 3.9 Mini Project：字符串分析器

用所有权、借用、切片写一个字符串分析工具——统计一段文本的长度和第一个单词。

```rust
// ✅ 完整可运行
fn first_word(s: &str) -> &str {
    let bytes = s.as_bytes();
    for (i, &byte) in bytes.iter().enumerate() {
        if byte == b' ' { return &s[..i]; }
    }
    &s[..] // 没有空格，整个就是第一个单词
}

fn main() {
    let text = String::from("hello world rust");
    let word = first_word(&text);  // 借用，不拿走所有权
    // 注：函数要 &str，这里传 &String 也能过——编译器靠 Deref coercion 自动转（第 10 章讲原理）
    println!("长度: {}, 首词: {}", text.len(), word);
}
```

**用到了什么**：`&str` 切片借用、`&String` 不可变引用、迭代器遍历、字节比较。

> 📖 **术语解释 · Deref coercion（解引用强制转换）**：注意到上面 `first_word(&text)` —— 函数签名要 `&str`，我们却传了 `&String`，它居然编译过了。因为 `String` 实现了 `Deref<Target = str>`，编译器会**自动把 `&String` 转成 `&str`**。凡是"需要 `&T`、手头是 `&U` 且 `U: Deref<Target = T>`"的地方，编译器都帮你自动转一层，不必手写 `&text[..]`。同理 `&Vec<T>` 能当 `&[T]` 用。这就是 Deref coercion——方法 / 函数参数处的"隐式转型"，记住它能少写很多 `&` 和 `[..]`。

> 💡 **技巧**：试着扩展它——返回第二个单词，或者统计有多少个单词。注意每一步的借用关系！

> 📌 **要点**：这个项目展示了 Rust 的核心设计——`first_word` 借用了 `text` 但不拿走所有权，调用后 `text` 仍然可用。这就是"借用"的威力。

> ### 记忆卡片
>
> **一句话**：赋值不是复制，是"交钥匙"——钥匙（所有权）交出去，原变量就进不了门。
>
> **口诀**：一值一主，主走值灭；Stack 复制，Heap 搬家。
>
> **三个判断题**（心里过一遍）：
> 1. `let s2 = s1;`（String）之后再用 `s1` → 编译器拦 → ✓
> 2. `let y = x;`（i32）之后 `x` 就不能用了 → ✗（i32 是 Copy 类型）
> 3. 函数传 `String` 参数，所有权转移给函数 → ✓

---

## 自检清单

- [ ] 我能说出所有权的三条规则
- [ ] 我理解 `String` 的赋值是"移动"而 `i32` 是"拷贝"
- [ ] 我知道函数传参会转移所有权
- [ ] 我会用 `&T` 做不可变借用、`&mut T` 做可变借用
- [ ] 我知道不可变引用和可变引用不能同时存在
- [ ] 我理解什么是悬垂引用以及 Rust 如何避免它
- [ ] 我会用切片 `&str` 和 `&[T]` 引用数据的一部分
- [ ] 我完成了字符串分析器 mini project

---

> 🦀 **下一章预告**：第 4 章我们来学结构体（Struct）——把你零散的数据组织起来，就像给数据设计一个"简历模板"。
