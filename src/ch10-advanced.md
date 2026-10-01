# 第10章 智能指针、并发与宏：进阶利器

> **学习目标**
> - 理解智能指针（Box、Rc、RefCell）的区别与场景
> - 掌握多线程编程基础
> - 理解 Send 与 Sync Trait
> - 认识宏（Macro）的基本概念
>
> **预计学习时长**：3-4 小时

---

## 10.1 智能指针：比引用更强大的"指针"

> 📖 **术语解释 · 智能指针（Smart Pointer）**：不仅指向数据，还拥有数据所有权、并在离开作用域时自动清理的"高级引用"。`String` 和 `Vec` 本质上也是智能指针。

> 💡 **比喻**：普通引用就像你指着别人的杯子说"那是他的"——你不拥有它。智能指针就像你自己拿了一个杯子——你拥有它，用完自动回收。

### Box：把数据放到堆上

```rust
fn main() {
    let b = Box::new(5);      // 5 被放到堆上，b 指向它
    println!("{}", b);         // 像普通值一样使用
}   // b 离开作用域，堆上的 5 自动释放
```

> 💡 **比喻**：`Box` 就像你租了一个储物柜——把东西放进去，钥匙在你手里，不租了（离开作用域）东西自动搬走。主要用于递归类型和较大的数据。

### Rc：引用计数（共享所有权）

> 📖 **术语解释 · Rc**：Reference Counted，引用计数智能指针。允许多个所有者共享同一份数据——每多一个引用计数 +1，少一个 -1，归零时释放。

> 💡 **比喻**：`Rc` 就像合租的房子——多个室友共享一套房，最后一个人搬走时退租。但合租有个规矩：不能同时改装修（不可变）。

```rust
use std::rc::Rc;

fn main() {
    let a = Rc::new(String::from("共享数据"));
    let b = Rc::clone(&a);    // 引用计数 +1，不是深拷贝
    let c = Rc::clone(&a);    // 引用计数 +1
    println!("计数: {}", Rc::strong_count(&a)); // 3
    println!("{} {} {}", a, b, c);
}   // 最后一个 Rc 离开时数据才释放
```

> ⚠️ **新手坑**：`Rc` 不是线程安全的！不能跨线程使用。多线程用 `Arc`（Atomic Rc）。

### RefCell：内部可变性

```rust
use std::cell::RefCell;

fn main() {
    let data = RefCell::new(vec![1, 2, 3]);
    data.borrow_mut().push(4);  // 运行时借用检查
    println!("{:?}", data.borrow()); // [1, 2, 3, 4]
}
```

> 📖 **术语解释 · 内部可变性（Interior Mutability）**：在拥有不可变引用的情况下修改内部数据。借用检查从编译时推迟到运行时。就像一个"只读"的外壳里面藏了一个"可写"的内核。

> ⚠️ **新手坑**：`RefCell` 的借用检查在运行时——如果违反借用规则（同时多个可变借用），程序会 panic，而不是编译错误。

### 经典组合：Rc+RefCell

```rust
use std::rc::Rc;
use std::cell::RefCell;

fn main() {
    let shared = Rc::new(RefCell::new(0));
    let a = Rc::clone(&shared);
    let b = Rc::clone(&shared);
    *a.borrow_mut() += 10;   // a 修改
    *b.borrow_mut() += 20;   // b 修改
    println!("{}", *shared.borrow()); // 30
}
```

---

## 10.2 多线程并发

Rust 的并发安全在编译时保证——`Send` 和 `Sync` Trait 让编译器帮你检查线程安全。

> 📖 **术语解释 · Send / Sync**：
> - `Send`：类型可以安全地跨线程转移所有权
> - `Sync`：`&T` 可以安全地跨线程共享
>
> 大多数类型自动实现了这两个 Trait，你不用手动实现。

### std::thread：创建线程

```rust
use std::thread;
use std::time::Duration;

fn main() {
    let handle = thread::spawn(|| {
        for i in 0..3 {
            println!("子线程: {}", i);
            thread::sleep(Duration::from_millis(100));
        }
    });

    for i in 0..3 {
        println!("主线程: {}", i);
        thread::sleep(Duration::from_millis(50));
    }

    handle.join().unwrap(); // 等待子线程结束
}
```

### 跨线程传数据：move 闭包

```rust
use std::thread;

fn main() {
    let data = vec![1, 2, 3];
    let handle = thread::spawn(move || {
        println!("子线程收到: {:?}", data);
    });
    handle.join().unwrap();
}
```

> ⚠️ **新手坑**：不加 `move`，闭包引用了主线程的 `data`，编译器会报生命周期错误。加 `move` 把所有权转移到子线程。

### Arc：线程安全的 Rc

```rust
use std::sync::Arc;
use std::thread;

fn main() {
    let data = Arc::new(vec![1, 2, 3]);
    let handles: Vec<_> = (0..3).map(|i| {
        let data = Arc::clone(&data);
        thread::spawn(move || {
            println!("线程 {} 看到: {:?}", i, data);
        })
    }).collect();
    for h in handles { h.join().unwrap(); }
}
```

### Mutex：互斥锁

```rust
use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    let counter = Arc::new(Mutex::new(0));
    let handles: Vec<_> = (0..10).map(|_| {
        let counter = Arc::clone(&counter);
        thread::spawn(move || {
            let mut num = counter.lock().unwrap();
            *num += 1;
        })
    }).collect();
    for h in handles { h.join().unwrap(); }
    println!("结果: {}", *counter.lock().unwrap()); // 10
}
```

> 💡 **比喻**：`Mutex` 就像公共厕所——一次只能一个人用，进去要锁门（`lock()`），出来要开门。`Arc<Mutex<T>>` 是多线程共享可变数据的标准组合。

---

## 10.3 通道（Channel）：消息传递

```rust
use std::sync::mpsc;
use std::thread;

fn main() {
    let (tx, rx) = mpsc::channel();
    thread::spawn(move || {
        let msgs = vec!["你好", "世界", "Rust"];
        for m in msgs { tx.send(m).unwrap(); }
    });
    for received in rx { // rx 会自动结束
        println!("收到: {}", received);
    }
}
```

> 💡 **比喻**：通道就像快递传送——你在一头放东西（`tx.send()`），另一头自动收到（`rx` 遍历）。发完就关，收完就停。

---

## 10.4 Deref 与 Drop：智能指针的左膀右臂

### Deref Trait：让智能指针像引用一样用

> 📖 **术语解释 · Deref**：解引用 Trait。实现 `Deref` 后，智能指针可以自动转换为普通引用，用 `*` 解引用或直接调用方法。就像快递箱外面贴了一个"内容物等同 XXX"的标签——你拿着箱子就等于拿着内容。

```rust
use std::ops::Deref;
struct MyBox<T>(T);
impl<T> Deref for MyBox<T> {
    type Target = T;
    fn deref(&self) -> &Self::Target { &self.0 }
}
```

```rust
let x = MyBox(String::from("hello"));
println!("{}", *x);   // 解引用: hello
println!("{}", x.len()); // 自动 deref 调用 len()
```

> 💡 **比喻**：`Deref` 就像翻译官——你跟外国人说话（操作 `Box<T>`），翻译官自动帮你翻成当地语言（当作 `T` 用），你不需要自己翻。

> ⚠️ **新手坑**：`String` 实现了 `Deref<Target=str>`，所以 `&String` 能自动转成 `&str`。这就是为什么你传 `&String` 给接收 `&str` 的函数不会报错。

### Drop Trait：离开作用域时自动清理

> 📖 **术语解释 · Drop**：析构 Trait。实现 `Drop` 后，值离开作用域时自动调用 `drop` 方法清理资源。就像租的房子退租时自动打扫干净。

```rust
struct Resource { name: String }
impl Drop for Resource {
    fn drop(&mut self) {
        println!("清理: {}", self.name);
    }
}
```

```rust
fn main() {
    let r = Resource { name: String::from("数据库连接") };
    println!("使用中...");
} // 离开作用域，自动打印 "清理: 数据库连接"
```

> 💡 **比喻**：`Drop` 就像酒店退房——你不需要手动去前台退钥匙，退房时间一到自动帮你收拾，收回钥匙。

---

## 10.5 类型转换：From 与 Into

> 📖 **术语解释 · From / Into**：标准库的类型转换 Trait。实现 `From` 会自动获得 `Into`。就像你写了"怎么把人民币转成美元"，反过来"美元转人民币"也自动会了。

```rust
struct Celsius(f64);
struct Fahrenheit(f64);
impl From<Celsius> for Fahrenheit {
    fn from(c: Celsius) -> Self {
        Fahrenheit(c.0 * 1.8 + 32.0)
    }
}
```

```rust
let c = Celsius(100.0);
let f: Fahrenheit = c.into();  // 自动转换
println!("{:.1}°F", f.0);       // 212.0°F
```

> 💡 **比喻**：`From` 就像你学会了"把人民币换成美元"的手续——实现这个方向后，编译器自动赠送 `Into`，让你换个姿势调用（`usd: Usd = rmb.into()`），方向不变。想反向？老老实实再写一个 `impl From<Usd> for Rmb`。

> ⚠️ **新手坑**：`From` 和 `Into` 会消耗原始值的所有权。如果转换**可能失败**，用 `TryFrom`/`TryInto`（返回 `Result`）；如果只想借用不转移所有权，实现 `AsRef` 或手写返回引用的方法。

---

## 10.6 宏：写代码的代码

> 📖 **术语解释 · 宏（Macro）**：一种在编译时生成代码的机制。`println!`、`vec!`、`format!` 都是宏。宏用 `!` 和普通函数区分。

> 💡 **比喻**：宏就像厨房里的"自动炒菜机"——你告诉它配方（宏定义），它自动炒出一盘菜（生成代码）。函数是你自己炒的菜，宏是机器帮你炒的。

### 声明宏：macro_rules!

```rust
macro_rules! say_hi {
    // 匹配模式 => 展开代码
    () => { println!("Hi!"); };
    ($name:expr) => { println!("Hi, {}!", $name); };
    ($name:expr, $n:expr) => {
        for _ in 0..$n { println!("Hi, {}!", $name); }
    };
}

fn main() {
    say_hi!();                    // Hi!
    say_hi!("Alice");            // Hi, Alice!
    say_hi!("Bob", 3);           // 打印 3 次 Hi, Bob!
}
```

### 为什么用宏而不是函数？

```rust
// vec! 宏可以接受任意数量、任意类型的参数
fn main() {
    let v1 = vec![1, 2, 3];        // Vec<i32>
    let v2 = vec!["a", "b"];       // Vec<&str>
    let v3 = vec![0; 5];          // 5 个 0
    // 函数做不到这种灵活的参数模式
}
```

> ⚠️ **新手坑**：宏很强大但也很复杂——新手阶段能看懂 `println!` 和 `vec!` 的用法就行，暂不需要自己写复杂宏。

---

## 10.7 课后练习

### 基础题

**1.** 用 `Box` 在堆上创建一个 `String`，打印它的值和长度，然后让它自动释放。

<details>
<summary>参考答案要点</summary>

```rust
fn main() {
    let s = Box::new(String::from("hello world"));
    println!("值: {} 长度: {}", s, s.len());
} // s 自动释放
```
</details>

### 进阶题

**2.** 创建 3 个线程，每个线程打印自己的线程编号（0/1/2）和一段消息，主线程等待所有线程结束后打印"全部完成"。

<details>
<summary>参考答案要点</summary>

```rust
use std::thread;
fn main() {
    let handles: Vec<_> = (0..3).map(|i| {
        thread::spawn(move || {
            println!("线程 {} 说: Hello!", i);
        })
    }).collect();
    for h in handles {
        h.join().unwrap();
    }
    println!("全部完成");
}
```
关键点：`move` 捕获 `i`；`join()` 等待线程完成。
</details>

### 挑战题

**3.** 用 `Arc<Mutex<Vec<i32>>>` 创建一个共享的向量，启动 5 个线程各 push 10 个数字（线程编号×10 到 线程编号×10+9），最后主线程打印所有数字并验证总数为 50。

<details>
<summary>参考答案要点</summary>

```rust
use std::sync::{Arc, Mutex};
use std::thread;
fn main() {
    let shared = Arc::new(Mutex::new(Vec::new()));
    let handles: Vec<_> = (0..5).map(|t| {
        let shared = Arc::clone(&shared);
        thread::spawn(move || {
            let mut vec = shared.lock().unwrap();
            for i in 0..10 {
                vec.push(t * 10 + i);
            }
        })
    }).collect();
    for h in handles { h.join().unwrap(); }
    let vec = shared.lock().unwrap();
    println!("总数: {}", vec.len()); // 50
    println!("{:?}", vec);
}
```
关键点：`Arc::clone` 共享所有权；`lock().unwrap()` 获取互斥锁。
</details>

---

## 10.8 Mini Project：多线程并行求和

用 `Arc` + `Mutex` + 多线程实现并行计算 1 到 10000 的和：

```rust
use std::sync::{Arc, Mutex};
use std::thread;
fn parallel_sum(n: u64, threads: usize) -> u64 {
    let chunk = n / threads as u64;
    let result = Arc::new(Mutex::new(0u64));
    let handles: Vec<_> = (0..threads).map(|i| {
        let result = Arc::clone(&result);
        let start = i as u64 * chunk + 1;
        let end = if i == threads - 1 { n } else { start + chunk - 1 };
        thread::spawn(move || {
            let local: u64 = (start..=end).sum();
            *result.lock().unwrap() += local;
        })
    }).collect();
    for h in handles { h.join().unwrap(); }
    let total = *result.lock().unwrap();
    total
}
```

> 📌 **要点**：最后一句不能直接写 `*result.lock().unwrap()`——`MutexGuard` 是临时值，作为块尾表达式会活到作用域结束，而那时 `result`（Arc）已被 Drop，导致悬垂借用。先赋值给 `total` 再返回，让 `Guard` 在语句结束时释放锁。这是和第 12 章编译错误攻坚呼应的经典案例。

```rust
fn main() {
    println!("1 到 10000 的和: {}", parallel_sum(10000, 4));
}
// 输出: 50005000
```

> 📌 **要点**：这是 `Arc<Mutex<T>>` 的经典使用模式——多个线程各算一部分，通过互斥锁安全地汇总。实际工程中大数据处理都这么做。

> ### 📝 记忆卡片
>
> **一句话**：独占用 Box，共享用 Arc，共享还要改就 `Arc<Mutex<T>>`。
>
> **口诀**：Rc 不出线程，Arc 才能跨线程；RefCell 是单线程的"内部可变"。
>
> **三个判断题**（心里过一遍）：
> 1. `Rc` 可以直接跨线程共享 → ✗（非线程安全，跨线程要 Arc）
> 2. 多线程"共享且可修改"的标准配方是 `Arc<Mutex<T>>` → ✓
> 3. `macro_rules!` 是声明宏，在编译期展开 → ✓

---

## 自检清单

- [ ] 我理解 `Box` 把数据放到堆上
- [ ] 我知道 `Rc` 用于单线程共享所有权，`Arc` 用于多线程
- [ ] 我理解 `RefCell` 的内部可变性和运行时借用检查
- [ ] 我理解 `Deref` 让智能指针像引用一样使用
- [ ] 我理解 `Drop` 在离开作用域时自动清理
- [ ] 我会用 `From` / `Into` 做类型转换
- [ ] 我会用 `std::thread::spawn` 创建线程
- [ ] 我知道跨线程传数据需要 `move` 闭包
- [ ] 我会用 `Arc<Mutex>` 安全地多线程共享可变数据
- [ ] 我理解 `Send` 和 `Sync` 是编译时线程安全保证
- [ ] 我认识宏的基本语法和 `!` 标记
- [ ] 我完成了多线程并行求和 mini project

---

> 🦀 **下一章预告**：第 11 章我们学测试——让代码值得信赖，写出可以验证正确性的 Rust 程序。
