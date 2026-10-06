# 第15章 Unsafe Rust 与 FFI：Rust 的"后门"

> **学习目标**
> - 理解 `unsafe` 关键字的含义和五大能力
> - 学会安全地使用 `unsafe` 块
> - 了解 FFI（外部函数接口）调用 C 代码的基本方式
> - 建立"unsafe 不等于不安全"的正确认知
>
> **预计学习时长**：1-2 小时

---

## 15.1 为什么需要 Unsafe？

Rust 的安全保证在编译时检查，但有些场景编译器无法验证：

- 调用 C 语言写的函数
- 操作裸指针（raw pointer）
- 访问可变全局变量
- 操作联合体（union）
- 调用其他 unsafe 函数

> 📖 **术语解释 · Unsafe**：`unsafe` 关键字告诉编译器"这段代码我负责保证安全，你别管了"。不是"不安全"，而是"编译器无法验证安全性，由程序员接管"。就像你跟安检员说"这个包我知道没问题，你放行吧"——出了事你负责。

> **比喻**：`unsafe` 就像你有一把万能钥匙——能打开任何门，但你得自己确认打开的不是别人家的门。正常情况不需要用，但有些活（修管道、装线路）确实得绕过门禁。

---

## 15.2 Unsafe 的五大能力

### 能力一：调用 unsafe 函数

```rust
unsafe fn dangerous() -> i32 {
    // 这个函数可能做了编译器无法检查的事
    42
}

fn main() {
    let result = unsafe { dangerous() };
    println!("{}", result);
}
```

### 能力二：操作裸指针

> 📖 **术语解释 · 裸指针（Raw Pointer）**：`*const T` 和 `*mut T`，类似 C 语言的指针。不受借用检查器约束，但也不享受安全保证——可能悬垂、可能越界。

```rust
fn main() {
    let mut x = 42;
    let r1 = &x as *const i32;   // 创建裸指针（安全）
    let r2 = &mut x as *mut i32;

    unsafe {
        println!("r1 = {}", *r1);  // 解引用（unsafe）
        *r2 = 100;                   // 通过裸指针修改
        println!("r2 = {}", *r2);
    }
}
```

> ⚠️ **新手坑**：创建裸指针不需要 unsafe，但**解引用**需要。裸指针不做空检查、不做越界检查——出事了是你自己的责任。

### 能力三：访问可变静态变量

```rust
static mut COUNTER: i32 = 0;

fn add_one() {
    unsafe { COUNTER += 1; }
}

fn main() {
    add_one();
    add_one();
    let c = unsafe { COUNTER };  // 先读出值，避免在 unsafe 块里隐式取引用
    println!("计数: {}", c);  // 2
}
```

> 📌 **要点**：`static mut` 是全局可变的，多线程访问时可能数据竞争——所以每次访问都要包在 `unsafe` 里。

> ⚠️ **Edition 2024 · static_mut_refs**：上面的**直接读写**（复制读出、`COUNTER += 1`）在 2024 仍允许；但对 `static mut` **取引用**不行了——
> `let r = unsafe { &mut COUNTER };` 会直接报错：`error: creating a mutable reference to mutable static is discouraged`（lint `static_mut_refs`，2024 默认 deny）。因为这种引用一旦被多个线程同时持有就是数据竞争，编译器无法替你排除。实际项目里全局可变状态优先用 `AtomicI32`（原子整数）、`Mutex`（第 10 章）或 `OnceLock`，把 `static mut` 留给确实需要的底层场景。

### 能力四：访问 union 字段

```rust
union IntOrFloat {
    i: i32,
    f: f32,
}

fn main() {
    let u = IntOrFloat { i: 42 };
    unsafe {
        println!("int = {}", u.i);  // 读取 union 需要 unsafe
    }
}
```

### 能力五：调用外部函数（FFI）

```rust
// edition 2024 写法：extern 块本身要标 unsafe；2021 版直接写 extern "C" {
unsafe extern "C" {
    fn abs(x: i32) -> i32;  // C 标准库的 abs 函数
}

fn main() {
    let x = -5;
    let result = unsafe { abs(x) };
    println!("|{}| = {}", x, result);  // |-5| = 5
}
```

> **比喻**：FFI 就像请了一个外国厨师——你不懂他的手法（C 代码的安全保证），但你给他钥匙（`extern "C"`），让他进厨房做菜。出了食品安全问题你负责。

---

## 15.3 Safe Rust 包装 Unsafe

最佳实践：把 unsafe 封装在安全 API 后面：

```rust
fn split_at_mut(slice: &mut [i32], mid: usize) -> (&mut [i32], &mut [i32]) {
    let len = slice.len();
    assert!(mid <= len);
    let ptr = slice.as_mut_ptr();
    unsafe {
        (
            std::slice::from_raw_parts_mut(ptr, mid),
            std::slice::from_raw_parts_mut(ptr.add(mid), len - mid),
        )
    }
}

fn main() {
    let mut v = vec![1, 2, 3, 4, 5];
    let (a, b) = split_at_mut(&mut v, 2);
    println!("{:?} {:?}", a, b);  // [1, 2] [3, 4, 5]
}
```

> 📌 **要点**：标准库里大量使用 unsafe——但都包装在安全 API 后面。你用 `Vec`、`String`、`HashMap` 时不需要 unsafe，因为标准库已经帮你处理好了。

---

## 15.4 调用 C 代码：FFI 实战

> 📖 **术语解释 · FFI**：Foreign Function Interface，外部函数接口。让 Rust 调用 C/汇编/其他语言的函数，或被其他语言调用。就像不同语言之间的翻译官。

### Rust 调用 C 的 `abs` 函数

```rust
// edition 2024：unsafe extern "C"；2021：extern "C"
unsafe extern "C" {
    fn abs(x: i32) -> i32;
}

fn main() {
    let n = unsafe { abs(-42) };
    println!("{}", n);  // 42
}
```

### Rust 函数暴露给 C

```rust
#[unsafe(no_mangle)]  // edition 2024 起需要 unsafe 修饰；2021 版写 #[no_mangle]
pub extern "C" fn add_in_rust(a: i32, b: i32) -> i32 {
    a + b
}
```

编译成 `.so`/`.dll` 后，C 代码就可以链接并调用 `add_in_rust`。

> ⚠️ **新手坑**：FFI 调用的外部函数不受 Rust 安全保证——如果 C 代码有内存错误，可能污染 Rust 的数据。FFI 是 unsafe 的根本原因。

---

## 15.5 什么时候用 Unsafe？

| 场景 | 是否需要 unsafe | 说明 |
|------|:---:|------|
| 日常 Rust 编程 | 不需要 | 99% 的代码不需要 |
| 调用 C 库 | 需要 | FFI 必须包在 unsafe 里 |
| 写底层库（如标准库） | 需要 | 实现基础数据结构 |
| 性能极限优化 | 可能需要 | 裸指针绕过借用检查器 |
| 嵌入式/系统编程 | 可能需要 | 直接操作硬件寄存器 |

> 💡 **技巧**：能用 Safe Rust 解决的，永远不要用 unsafe。如果你写了 unsafe，确保：1) 块尽可能小 2) 包装在安全 API 后面 3) 用注释说明为什么是安全的 4) 充分测试

---

## 15.6 课后练习

### 基础题

**1.** 以下代码能编译吗？为什么？
```rust
let x = 42;
let ptr = &x as *const i32;
println!("{}", *ptr);
```

<details>
<summary>参考答案要点</summary>

不能编译。创建裸指针（`&x as *const i32`）是安全的，但解引用 `*ptr` 需要 unsafe：
```rust
let x = 42;
let ptr = &x as *const i32;
unsafe { println!("{}", *ptr); }
```
</details>

### 进阶题

**2.** 用 `static mut` 实现一个全局计数器，写两个函数 `increment` 和 `get_count`，在 main 中调用 3 次 increment 后打印结果。

<details>
<summary>参考答案要点</summary>

```rust
static mut COUNT: i32 = 0;
fn increment() { unsafe { COUNT += 1; } }
fn get_count() -> i32 { unsafe { COUNT } }
fn main() {
    increment(); increment(); increment();
    println!("{}", get_count());  // 3
}
```
注意：`static mut` 不是线程安全的；2024 下还不能对它取引用（`static_mut_refs`），实际项目用 `AtomicI32`。
</details>

### 挑战题

**3.** 用 FFI 调用 C 标准库的 `rand()` 函数（需要 `extern "C"`），生成 5 个随机数并打印。

<details>
<summary>参考答案要点</summary>

```rust
// edition 2024：unsafe extern "C"；2021：extern "C"
unsafe extern "C" {
    fn rand() -> i32;
}
fn main() {
    for _ in 0..5 {
        let n = unsafe { rand() };
        println!("{}", n);
    }
}
```
注意：`rand()` 返回值范围和种子依赖平台，实际项目用 `rand` crate。
</details>

---

## 15.7 Mini Project：用 FFI 调用 C 的 strlen

用 `extern "C"` 声明 C 标准库的 `strlen` 函数，**真正调用它**统计字符串字节数——然后把 unsafe 封装进安全 API。

关键在 `CString`：C 字符串必须以 `\0` 结尾，而 Rust 的 `String`/`&str` 没有这个约定，所以要先转换格式：

```rust
// 📎 片段 1/2：extern 声明 + 安全封装
use std::ffi::CString;
use std::os::raw::c_char;

// edition 2024：unsafe extern "C"；2021：extern "C"
unsafe extern "C" {
    fn strlen(s: *const c_char) -> usize;  // C 函数签名
}

// 安全封装：调用者不需要写 unsafe
pub fn c_string_len(s: &str) -> usize {
    // CString 把数据复制一份，并保证末尾有 \0
    let c = CString::new(s).expect("字符串里不能包含 \\0");
    unsafe { strlen(c.as_ptr()) }  // 真正的 FFI 调用点，且只在这一处
}
```

```rust
// 📎 片段 2/2：调用
fn main() {
    let s = "hello, FFI";
    println!("Rust 统计: {} 字节", s.len());
    println!("C 统计:   {} 字节", c_string_len(s));
}
```

<details>
<summary>👉 点开：FFI 调用 strlen 完整可运行版（✅）</summary>

```rust
use std::ffi::CString;
use std::os::raw::c_char;

unsafe extern "C" {
    fn strlen(s: *const c_char) -> usize;
}

fn c_string_len(s: &str) -> usize {
    let c = CString::new(s).expect("字符串里不能包含 \\0");
    unsafe { strlen(c.as_ptr()) }
}

fn main() {
    let s = "hello, FFI";
    println!("Rust 统计: {} 字节", s.len());
    println!("C 统计:   {} 字节", c_string_len(s));
}
```

</details>

运行后两个数字完全一致——但一个由 Rust 的 `len()` 数出来，另一个是 C 的 `strlen` 跨过 FFI 边界替你数出来的。

> ⚠️ **新手坑**：不能直接把 `&str` 的指针喂给 `strlen`——Rust 字符串没有 `\0` 结尾，`strlen` 会一路越界读取，直到碰巧撞上一个 0 字节，行为未定义。`CString` 负责补上结尾的 `\0`，这正是"安全封装"的价值：把"格式差异"这个坑挡在边界内。

> 📌 **要点**：这个练习展示了 FFI 的标准工作流——`extern "C"` 声明 C 函数签名，`CString` 做数据格式转换，`unsafe` 块内调用，再把 unsafe 包进安全函数。调用者只看到 `c_string_len(s)`，完全感知不到背后的 unsafe。

> ### 记忆卡片
>
> **一句话**：unsafe 不是"不安全"，是"编译器不查，你自己负责"。
>
> **口诀**：五大能力——unsafe 函数、裸指针、static mut、union、extern FFI；最佳实践是包进安全 API。
>
> **三个判断题**（心里过一遍）：
> 1. 写了 unsafe 代码程序就一定有内存问题 → ✗（只是不检查，写对了一样安全）
> 2. FFI 调用 C 函数必须包在 unsafe 块里 → ✓
> 3. Rust 字符串可以直接把指针传给 C 的 `strlen` → ✗（无 `\0` 结尾，要先用 `CString` 转换）

---

## 自检清单

- [ ] 我理解 unsafe 不是"不安全"，而是"编译器不检查"
- [ ] 我知道 unsafe 的五大能力
- [ ] 我理解裸指针不受借用检查器约束
- [ ] 我知道 FFI 调用 C 函数需要 `extern "C"` + unsafe
- [ ] 我知道最佳实践是把 unsafe 封装在安全 API 后面
- [ ] 我知道 99% 的日常代码不需要 unsafe
- [ ] 我完成了 FFI 调用 strlen mini project

---

> 🦀 **下一章预告**：第 16 章我们进入应用方向——WebAssembly，让 Rust 跑进浏览器。痛点攻坚三部曲（编译错误、内存布局、Unsafe/FFI）到此完成，接下来还有 Cargo 进阶和 6 个实战项目——把所有知识串联起来，写出真正可运行的 Rust 程序！
