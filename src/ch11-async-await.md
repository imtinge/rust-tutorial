# 第11章 异步编程 async/await：让一个线程同时干一堆事

> **学习目标**
> - 理解异步解决什么问题，能区分并发与并行
> - 认识 `Future` 与 `.await`，知道 Future 是"惰性小票"
> - 会用 tokio 运行时写最小异步程序
> - 掌握顺序 await、`join!`、`tokio::spawn` 三种并发姿势及其区别
> - 看懂 E0373、E0733、future is not Send 三类高频报错
> - 知道异步里什么操作会"堵线程"以及异步与多线程如何选型
>
> **预计学习时长**：3-4 小时

---

## 11.1 从点外卖说起：异步到底解决什么

想象你开了一家外卖小店，只有一个店员。

**同步（阻塞）模式**：顾客 A 下单买黄焖鸡，店员亲自站在灶台前等 15 分钟，菜出锅才转身。这期间 B、C、D 的电话全没人接，店门口排起长队。这就是我们前 10 章写的普通代码——一行一行往下走，遇到耗时操作（读文件、等网络、等数据库），当前线程就干等着，啥也干不了。

**异步模式**：店员接到 A 的单后把单子往灶台一贴，转身立刻接 B 的电话；B 的菜也炖上了，再去回 C 的消息；哪道菜出锅了"叮"一声，他回头去处理哪道。一个人，照样让一摞订单同时在飞。

这就是异步：**在等待某件事完成的时间里，线程不闲着，去推进别的任务**。注意这里没有魔法——同一时刻，这个店员仍然只在做一个动作，但从"整段时间"看，他同时照应了所有订单。

> **比喻**：异步的线程就像一个熟练的后厨打荷工，手里开着四个灶眼。他不是有四只手（那叫并行），但他绝不会傻等一锅水烧开——等水响的时候，他早去切下一盘菜了。

在 Rust 里，编译器会把 `async fn` 在编译期改写成一个**状态机**。每次 `.await` 就是状态机里的一个"暂停点"：任务在这里交出线程，等条件到了再从暂停点恢复。整个过程不创建操作系统线程，所以一个线程可以轻松挂上**几万甚至几十万个异步任务**——这是用多线程硬开做不到的（每个 OS 线程默认要吃 MB 级栈内存）。

---

## 11.2 并发 vs 并行：别再混用

这两个词在中文里经常被混成"async = 多线程"，其实它们描述的是两件事：

- **并发（Concurrency）**：同时**应对**多件事。多件事在同一时间段内交替推进，单核 CPU 也能做到。关键是"任务可以暂停/让出"。
- **并行（Parallelism）**：同时**执行**多件事。需要多核 CPU，某一瞬间真有两个计算在物理上同时发生。

```
并发（一个人轮转三口锅）          并行（三个厨师各炒一口锅）
时间 →                            时间 →
厨师: A B C A C B A ...           厨师1: A A A A
                                  厨师2: B B B B
                                  厨师3: C C C C
```

异步主要给你的是**并发**：把等待时间填满。而 tokio 这类运行时默认用多线程调度器，于是异步任务在多核机器上**也能顺便并行**——但这两件事的概念请在脑子里分开。

---

## 11.3 Future：一张"将来才能取货的小票"

普通函数 `fn order() -> Dish`，调用就执行，返回一盘菜。

异步函数 `async fn order() -> Dish`，调用它时**菜不会开始做**，你拿到的只是一张取餐小票——在 Rust 里小票的类型叫 `Future`：

```rust
async fn order() -> &'static str {
    "黄焖鸡"
}

fn main() {
    let ticket = order(); // 只拿到小票，order 的函数体一行都没执行！
    // ticket 的类型：impl Future<Output = &'static str>
}
```

那什么时候才真的执行？**被轮询（poll）的时候**。实际编程里你几乎不手动 poll，而是用 `.await`：

```rust
async fn kitchen() {
    let dish = order().await; // 在这里等小票出餐；等餐期间线程让给别人
    println!("出餐: {}", dish);
}
```

`.await` 的含义："如果这个 Future 还没好，我就在此暂停、把线程交出去；等好了，运行时会把我从下一行恢复。"

### Future 是惰性的：小票扔了，菜永远不会做

```rust
async fn maybe_run(tag: &str) {
    println!("[{}] 任务真的跑了!", tag);
}

#[tokio::main]
async fn main() {
    let f = maybe_run("被丢弃");
    drop(f);                       // 小票直接扔掉——函数体从未执行，无输出
    maybe_run("被 await").await;   // 只有这行会打印
}
```

运行输出：

```
[被 await] 任务真的跑了!
```

> 🐍 **Python/JS 类比**：写法几乎一模一样——`async`/`await` 两边都有。但语义有个大坑：**JS 的 Promise 是 eager（急切）的**。`const p = fetch(url)` 一写下去，请求立刻发出，哪怕你永远不 `.then`/`await` 它；Rust 的 Future 是 **lazy（惰性）的**，`fetch(url)` 只是组装状态机，必须有人 poll（通常就是 `.await` 或 `tokio::spawn`）才会跑。Python 的 `asyncio.Future`/协程本身也是惰性的，需要事件循环驱动，这一点和 Rust 更像。
>
> 一句话记忆：**Rust 里只创建不 await 的 Future = 一行代码都不会执行**。

### 最小可运行异步程序

上面代码里那个奇怪的 `#[tokio::main]` 是什么？Future 需要一个"运行时"来调度它，而我们的 `main` 是同步函数，不能直接 `.await`。tokio 提供一个宏，帮你把异步 main 包装起来：

```rust
#[tokio::main]
async fn main() {
    println!("你好, 异步世界!");
}
```

它大致展开成这样（理解即可，不用手写）：

```rust
fn main() {
    tokio::runtime::Runtime::new().unwrap().block_on(async {
        println!("你好, 异步世界!");
    });
}
```

即：建一个运行时，让它阻塞地驱动我们的异步代码直到完成。

---

## 11.4 tokio：Rust 异步的事实标准运行时

`async/await` 只是语言层面的语法，Rust 标准库**不提供**异步运行时（这是刻意设计，把选择权交给生态）。实践中绝大多数项目用 **tokio**——它提供：

- **调度器（executor）**：在一堆任务之间轮流 poll；
- **反应器（reactor）**：epoll/IOCP 等系统事件通知，网络和文件 IO 的"叮一声"来自它；
- **定时器（timer）**：`sleep`、超时；
- **异步版标准库**：`tokio::net::TcpListener`、`tokio::fs`、`tokio::sync::Mutex`、通道等。

添加依赖（按需开 feature 是更好的习惯，不用图省事开 `full`；本章要用到同步原语，所以带上 `sync`）：

```bash
cargo add tokio --features macros,rt-multi-thread,time,sync
```

```toml
# Cargo.toml（本书验证时 tokio 版本为 1.53）
# sync 提供 tokio::sync::{Mutex, Semaphore}，本章后半和 Mini Project 都要用
tokio = { version = "1", features = ["macros", "rt-multi-thread", "time", "sync"] }
```

`#[tokio::main]` 默认启动**多线程**调度器；单线程版写成 `#[tokio::main(flavor = "current_thread")]`——任务少、不想付多线程开销时（比如命令行小工具）用它。

---

## 11.5 三种并发姿势：顺序 await、join!、spawn

假设"下一个单"要模拟 800ms 的网络耗时：

```rust
// 📎 片段 1/5：公共的"下订单"函数
use std::time::Duration;
use tokio::time::{sleep, Instant};

async fn fetch_order(id: u32) -> u32 {
    sleep(Duration::from_millis(800)).await;
    id * 10
}
```

### 姿势一：顺序 await——耗时相加

```rust
// 📎 片段 2/5：顺序 await
async fn sequential() {
    let start = Instant::now();
    let a = fetch_order(1).await;
    let b = fetch_order(2).await;
    println!("顺序: a={}, b={}, 耗时 {:?}", a, b, start.elapsed());
}
```

### 姿势二：join!——同时等，耗时取最长

```rust
// 📎 片段 3/5：join!
async fn joined() {
    let start = Instant::now();
    let (a, b) = tokio::join!(fetch_order(1), fetch_order(2));
    println!("join!: a={}, b={}, 耗时 {:?}", a, b, start.elapsed());
}
```

### 姿势三：tokio::spawn——任务独立起飞

```rust
// 📎 片段 4/5：spawn
async fn spawned() {
    let start = Instant::now();
    let mut handles = Vec::new();
    for id in 1..=2 {
        let h = tokio::spawn(async move { fetch_order(id).await });
        handles.push(h);
    }
    for h in handles {
        let v = h.await.unwrap();
        println!("spawn 子任务结果: {}", v);
    }
    println!("spawn 总耗时 {:?}", start.elapsed());
}
```

<details>
<summary>👉 点开：三姿势完整可运行版（✅ 片段 5/5）</summary>

```rust
use std::time::Duration;
use tokio::time::{sleep, Instant};

async fn fetch_order(id: u32) -> u32 {
    sleep(Duration::from_millis(800)).await;
    id * 10
}

async fn sequential() {
    let start = Instant::now();
    let a = fetch_order(1).await;
    let b = fetch_order(2).await;
    println!("顺序: a={}, b={}, 耗时 {:?}", a, b, start.elapsed());
}

async fn joined() {
    let start = Instant::now();
    let (a, b) = tokio::join!(fetch_order(1), fetch_order(2));
    println!("join!: a={}, b={}, 耗时 {:?}", a, b, start.elapsed());
}

async fn spawned() {
    let start = Instant::now();
    let mut handles = Vec::new();
    for id in 1..=2 {
        let h = tokio::spawn(async move { fetch_order(id).await });
        handles.push(h);
    }
    for h in handles {
        let v = h.await.unwrap();
        println!("spawn 子任务结果: {}", v);
    }
    println!("spawn 总耗时 {:?}", start.elapsed());
}

#[tokio::main]
async fn main() {
    sequential().await;
    joined().await;
    spawned().await;
}
```

</details>

三者实际运行输出（`#[tokio::main]` 依次调用并 `.await` 它们）：

```
顺序: a=10, b=20, 耗时 1.6328381s
join!: a=10, b=20, 耗时 814.5744ms
spawn 子任务结果: 10
spawn 子任务结果: 20
spawn 总耗时 809.664ms
```

### ⚠️ 最容易记错的一点：join! 不产生 JoinHandle

`tokio::join!(f1, f2)` 做的事是：**在当前任务里同时轮询这两个 Future**——f1 没好就 poll 一下 f2，f2 没好就让出线程……它俩谁先好都不影响别人。最终 `join!` **像普通表达式一样返回一个结果元组** `(T1, T2)`：

```rust
let (a, b): (u32, u32) = tokio::join!(fetch_order(1), fetch_order(2));
// 没有任何 JoinHandle，join! 只是个宏表达式，任务也没有"脱离"当前函数
```

**`JoinHandle` 只来自 `tokio::spawn`**。spawn 把任务交给运行时独立调度——哪怕发起它的函数提前返回了，任务还在跑；你可以拿着 handle 稍后 `.await`（此时才取结果）、`.abort()` 取消，或用 `.is_finished()` 非阻塞地看它好没好。

### 三者对比表

| | 顺序 `.await` | `tokio::join!` | `tokio::spawn` |
|---|---|---|---|
| 并发推进吗 | 否，严格排队 | 是，同时轮询 | 是，独立调度 |
| 返回什么 | 各 Future 自己的输出 | 所有输出组成的**元组** | **`JoinHandle<T>`**（再 await 取 T） |
| 任务脱离当前函数吗 | 否 | 否（就在当前任务内） | **是**，当前函数返回也照跑 |
| 能单独取消 | 不能 | 不能 | `handle.abort()` |
| 一个失败/取消 | 后面不执行 | 全部仍会被 poll，结果各自携带 | 互不影响，await handle 时得到 `Err(JoinError)` |
| 适用场景 | 有先后依赖 | 数量固定（通常 2–4 个）、要一起等 | 数量动态、后台任务、并发流水线 |

补充工具：

- **`try_join!`**：和 `join!` 类似，但任一个返回 `Err` 就**短路**（其余的仍会被 drop）；处理 `Result` 时优先用它。
- **数量在运行时才知道**：循环里 `tokio::spawn` 再收集 `Vec<JoinHandle<T>`，最后统一 await（就像姿势三）。需要"任何一个完成就继续"时看 `tokio::select!`；第三方 `futures` crate 的 `FuturesUnordered`/`join_all` 提供更丰富的集合式组合。

---

## 11.6 报错解析：三道坎

### 坎一：E0373——任务借用了当前函数的局部变量

```rust
// 坏例子：spawn 的任务只借用了 data
#[tokio::main]
async fn main() {
    let data = vec![1, 2, 3];
    tokio::spawn(async {
        println!("{:?}", data); // data 是 main 的局部变量
    });
}
```

```
error[E0373]: async block may outlive the current function, but it borrows `data`,
which is owned by the current function
 --> src/main.rs:5:18
  |
5 |     tokio::spawn(async {
  |                  ^^^^^ may outlive borrowed value `data`
6 |         println!("{:?}", data);
  |                          ---- `data` is borrowed here
  |
help: to force the async block to take ownership of `data` ..., use the `move` keyword
  |
5 |     tokio::spawn(async move {
  |                        ++++
```

> 注：以上报错输出为示意，具体输出以本机版本为准。

为什么普通 `async { data }` 在同一个函数里直接 await 没事、spawn 就报错？因为 spawn 出去的任务生命周期独立，编译器没法保证它用 `data` 时 `data` 还活着。加上 **`move`** 让异步块拿走所有权即可：

```rust
tokio::spawn(async move {
    println!("{:?}", data); // data 的所有权已移交给任务
});
```

> **注意**：`move` 只解决"借用谁的"。spawn 还要求任务满足 **`'static`**（不能借短生命周期的引用）和 **`Send`**（多线程运行时要能在线程间转移任务）——这两个约束合起来就是下两道坎的根源。

### 坎二：E0733——async fn 递归需要装箱

```rust
async fn countdown(n: u32) {
    if n > 0 {
        countdown(n - 1).await; // 直接递归调用
    }
}
```

```
error[E0733]: recursion in an async fn requires boxing
 --> src/main.rs:1:1
  |
1 | async fn countdown(n: u32) {
  | ^^^^^^^^^^^^^^^^^^^^^^^^^^
  |
= note: a recursive `async fn` call must introduce indirection such as `Box::pin`
  to avoid an infinitely sized future
```

原理：async fn 编译成状态机，其内部要存放它 await 的那个 Future。递归时状态机里套着同类型的状态机，大小无限递归。用 **`Box::pin`** 加一层堆上的间接引用就打破了：

> 📖 **术语解释 · Pin（钉住）**：`Pin` 就是"钉住"一个值，防止它在内存中被移动。async 状态机可能是**自引用**的（内部指针指向自己的其他字段），值一旦移动这些指针就会失效；把值钉住、地址固定后，才能给这样的自引用 Future 取地址并轮询它。`Box::pin(x)` 即把 `x` 放到堆上并钉住。

```rust
async fn countdown(n: u32) {
    if n > 0 {
        Box::pin(countdown(n - 1)).await;
    }
}
```

> **说明**：E0733 从 async/await 稳定（Rust 1.39）起就是"async 递归需装箱"的错误码，不存在版本间的调整。注意别和 **E0752** 混淆——那是另一类错误：裸写 `async fn main` 却没有运行时（`#[tokio::main]` 没加时会见到）。具体输出以你本地编译器为准。

### 坎三：future is not Send——锁（或别的非 Send 类型）跨了 .await

下面是最常见的翻车写法：`guard` 被 `move` 进 spawn 的任务，而且在任务里跨越了 `.await`：

```rust
// 坏例子：std 锁的 guard 被带进 spawn 任务并跨越 .await
use std::sync::Mutex;

#[tokio::main]
async fn main() {
    let m = Mutex::new(0);
    let guard = m.lock().unwrap();
    tokio::spawn(async move {
        println!("{}", guard);
        tokio::time::sleep(std::time::Duration::from_secs(1)).await; // 持锁跨越暂停点
    });
}
```

```
error: future cannot be sent between threads safely
   --> src/main.rs:8:5
    |
8   |     tokio::spawn(async move {
    |     _____________^
9   |         println!("{}", guard);
10  |         tokio::time::sleep(std::time::Duration::from_secs(1)).await;
11  |     });
    |_____^ future created by async block is not `Send`
    |
help: ... the trait `Send` is not implemented for `std::sync::MutexGuard<'_, i32>`
note: captured value is not `Send`
note: required by a bound in `tokio::spawn`
    F: Future + Send + 'static,
                 ^^^^
```

> 注：以上报错输出为示意，具体输出以本机版本为准。

为什么 std 的 `MutexGuard` 不是 `Send`？大多数 OS 要求锁必须在加锁的线程上解锁，所以 guard 被设计成不能跨线程转移。异步任务在 `.await` 后可能在另一个线程上恢复——于是"持着 std 锁 guard 跨 await"直接不合法。

两条出路：

1. **在 await 之前释放锁**——把临界区缩小成一个不跨 await 的小块（最常用）：

```rust
{
    let mut num = counter.lock().unwrap();
    *num += 1;
} // guard 在这里 drop，锁已释放
tokio::time::sleep(Duration::from_millis(10)).await;
```

2. **确实需要持锁跨越等待点**时，用异步锁 **`tokio::sync::Mutex`**，它的 guard 是 Send：

```rust
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

#[tokio::main]
async fn main() {
    let m = Arc::new(Mutex::new(0u32));
    let m2 = m.clone();
    let handle = tokio::spawn(async move {
        let mut g = m2.lock().await;   // 异步加锁
        *g += 1;
        tokio::time::sleep(Duration::from_millis(10)).await; // 合法
        *g
    });
    println!("结果: {}", handle.await.unwrap());
}
```

> **要点**：别无脑把所有 `std::sync::Mutex` 换成 tokio 版——异步锁成本更高。规则是：**临界区内没有 `.await` 就用 std 锁（性能更好）；必须持锁等待才用 tokio 锁。**

---

## 11.7 别在异步里"堵线程"

`std::thread::sleep`、同步文件读写、大循环算 CPU……这些操作在 async fn 里**全部能编译通过**——编译器不拦你，但它们会把干活的线程彻底霸占，异步的优势瞬间归零。

实测（单线程运行时最明显）：

```rust
#[tokio::main(flavor = "current_thread")]
async fn main() {
    tokio::spawn(async {
        println!("另一个任务开始");
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
        println!("另一个任务结束");
    });
    std::thread::sleep(std::time::Duration::from_millis(100)); // 堵住唯一线程
    println!("主线程睡醒了");
}
```

```
主线程睡醒了
```

spawn 出去的任务连"另一个任务开始"都没来得及打印——唯一线程在睡大觉，运行时根本没机会调度它。换成 `tokio::time::sleep`，线程在等待时就能去跑别的任务。

阻塞操作清单与对策：

| 阻塞操作 | 对策 |
|----------|------|
| `std::thread::sleep` | `tokio::time::sleep` |
| 同步文件 IO（`std::fs`） | `tokio::fs`；文件系统本身没有真正的异步通知，tokio 内部也是丢到阻塞线程池 |
| 一小段不可避免的同步/阻塞调用 | `tokio::task::spawn_blocking` 丢到专用阻塞线程池 |
| CPU 密集的长计算 | 别放进异步任务；用 rayon 并行，或独立线程 + 通道 |
| 持锁太久 | 缩小临界区，见 11.6 |

---

## 11.8 异步 vs 多线程：到底怎么选

| 场景 | 选择 |
|------|------|
| Web 服务、代理、网关：大量连接、大量时间花在等 IO | **异步**（axum、reqwest、tokio 网络栈） |
| 同时发起一批外部请求/查询 | 异步 + `join!`/spawn |
| CPU 密集：矩阵运算、数据处理、压缩、编解码 | **多线程**（rayon / scoped threads） |
| 后台有一堆要等 IO 的独立任务 | 异步 spawn |
| 低连接数但每个请求算得狠 | 多线程，或异步里把计算 spawn_blocking/rayon |
| 嵌入式、极简命令行工具 | current-thread 异步或干脆同步 |

经验法则：**瓶颈在"等"——异步；瓶颈在"算"——多线程**。现实系统往往两者混合：异步外壳接 IO，重计算部分转多线程。

---

## 11.9 课后练习

### 基础题

**1.** 写两个 `async fn`，分别 `tokio::time::sleep` 600ms 和 300ms。先用两次顺序 `.await` 调用并打印总耗时；再改成 `tokio::join!` 打印耗时，对比两个数字。

<details>
<summary>参考答案要点</summary>

```rust
use std::time::Duration;
use tokio::time::{sleep, Instant};

async fn task_a() { sleep(Duration::from_millis(600)).await; }
async fn task_b() { sleep(Duration::from_millis(300)).await; }

#[tokio::main]
async fn main() {
    let s = Instant::now();
    task_a().await;
    task_b().await;
    println!("顺序: {:?}", s.elapsed()); // 约 900ms

    let s = Instant::now();
    tokio::join!(task_a(), task_b());
    println!("join!: {:?}", s.elapsed()); // 约 600ms
}
```
</details>

### 进阶题

**2.** 用 `tokio::spawn` 并发启动 5 个"请求"（`move` 捕获编号 1..=5，每个 sleep 200ms，返回编号），收集全部 `JoinHandle` 后依次 await，打印每个结果和总耗时。

<details>
<summary>参考答案要点</summary>

```rust
use std::time::Duration;
use tokio::time::{sleep, Instant};

#[tokio::main]
async fn main() {
    let start = Instant::now();
    let mut handles = Vec::new();
    for id in 1..=5u32 {
        handles.push(tokio::spawn(async move {
            sleep(Duration::from_millis(200)).await;
            id
        }));
    }
    for h in handles {
        println!("结果: {}", h.await.unwrap());
    }
    println!("总耗时: {:?}", start.elapsed()); // 约 200ms，不是 1000ms
}
```
关键点：`move` 把 `id` 所有权交给任务；JoinHandle 先收集后 await，并发才成立。
</details>

### 挑战题

**3.** 给 10 个各耗时 300ms 的任务加并发上限 3（`tokio::sync::Semaphore::new(3)`），spawn 全部任务后统一收集结果。先预测总耗时（约 ceil(10/3)×300ms = 1200ms），再运行验证。

<details>
<summary>参考答案要点</summary>

```rust
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Semaphore;
use tokio::time::{sleep, Instant};

#[tokio::main]
async fn main() {
    let permits = Arc::new(Semaphore::new(3));
    let start = Instant::now();
    let mut handles = Vec::new();
    for id in 1..=10u32 {
        let permit = permits.clone().acquire_owned().await.unwrap();
        handles.push(tokio::spawn(async move {
            sleep(Duration::from_millis(300)).await;
            drop(permit); // 完成后立刻归还名额
            id
        }));
    }
    let mut done = 0;
    for h in handles {
        h.await.unwrap();
        done += 1;
    }
    println!("完成 {} 个任务，耗时 {:?}", done, start.elapsed());
}
```
关键点：permit 必须在任务结束时才 drop；上限流靠"获取名额"这一步排队实现。
</details>

---

## 11.10 Mini Project：异步外卖厨房

接收一批订单，模拟每道菜不同的烹饪耗时；用 `spawn` 并发做菜，并用 `Semaphore` 限制最多 2 个厨师同时开火：

```rust
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Semaphore;
use tokio::time::{sleep, Instant};

struct Order {
    id: u32,
    dish: &'static str,
    cook_ms: u64,
}

async fn cook(order: Order) -> (u32, &'static str) {
    sleep(Duration::from_millis(order.cook_ms)).await;
    (order.id, order.dish)
}

#[tokio::main]
async fn main() {
    let orders = vec![
        Order { id: 1, dish: "黄焖鸡", cook_ms: 300 },
        Order { id: 2, dish: "麻辣烫", cook_ms: 500 },
        Order { id: 3, dish: "盖浇饭", cook_ms: 400 },
    ];

    let permits = Arc::new(Semaphore::new(2)); // 最多 2 个厨师

    let start = Instant::now();
    let mut handles = Vec::new();
    for o in orders {
        let permit = permits.clone().acquire_owned().await.unwrap();
        handles.push(tokio::spawn(async move {
            let result = cook(o).await;
            drop(permit); // 做完立刻归还名额
            result
        }));
    }
    for h in handles {
        let (id, dish) = h.await.unwrap();
        println!("{} 号订单出餐: {}", id, dish);
    }
    println!("全部出餐耗时: {:?}", start.elapsed());
}
```

运行输出：

```
1 号订单出餐: 黄焖鸡
2 号订单出餐: 麻辣烫
3 号订单出餐: 盖浇饭
全部出餐耗时: 779.404ms
```

解读：1、2 号先开火；300ms 后 1 号做完，3 号立刻补上（700ms 时完成）；2 号 500ms 完成。总耗时约 800ms，而顺序做要 1200ms。

**这个项目用到了什么**：
- `async fn` 与 `.await`
- `tokio::spawn` + `JoinHandle` 收集
- `tokio::sync::Semaphore` 并发限流（真实服务里保护下游/数据库的标配思路）

> ### 记忆卡片
>
> **一句话**：异步就是"等待时让出线程"，用一个线程照应海量任务。
>
> **口诀**：Future 是小票，不 poll 不执行；顺序相加、join 取最长、spawn 拿 handle；锁不跨 await，等待用 tokio sleep。
>
> **三个判断题**（心里过一遍）：
> 1. `tokio::join!` 返回一组 JoinHandle → ✗（它返回结果元组；JoinHandle 来自 spawn）
> 2. `let f = fetch();` 之后请求就已经发出 → ✗（Future 惰性，必须 await/spawn 才执行）
> 3. async fn 里可以放心用 `std::thread::sleep` → ✗（堵线程；用 `tokio::time::sleep`）

---

## 自检清单

- [ ] 我能说清异步解决什么问题，并区分并发与并行
- [ ] 我知道 `async fn` 返回 Future，且 Future 是惰性的
- [ ] 我理解 `.await` 是暂停/让出/恢复点
- [ ] 我会用 `#[tokio::main]` 和 tokio feature 搭建最小程序
- [ ] 我能区分顺序 await、`join!`、`spawn`，知道 join! 返回元组不产生 handle
- [ ] 我看得懂 E0373（加 move）、E0733（Box::pin）、future is not Send（锁跨 await）
- [ ] 我知道异步里不能堵线程，知道 sleep/IO/CPU 密集各自的对策
- [ ] 我能按"瓶颈在等还是在算"选择异步或多线程
- [ ] 我完成了异步外卖厨房 mini project

---

> 🦀 **下一章预告**：第 12 章我们学测试——让代码值得信赖，写出可以验证正确性的 Rust 程序。
