# 第6章 集合与错误处理：让程序更健壮

> **学习目标**
> - 熟练使用 Vec（动态数组）、String、HashMap
> - 掌握 `panic!` 与 `Result` 的区别和使用场景
> - 学会用 `?` 运算符简化错误传播
> - 理解自定义错误类型
>
> **预计学习时长**：2-3 小时

---

## 6.1 Vec：动态数组

先看一段代码——创建、添加、访问：

```rust
fn main() {
    let mut v: Vec<i32> = Vec::new();
    v.push(1);             // 添加元素
    println!("{:?}", v);   // [1]
    let first = v[0];       // 索引访问
    println!("第一个: {}", first);
    println!("长度: {}", v.len());
}
```

> 📖 **术语解释 · Vec**：Rust 的动态数组，能在堆上自动扩容。相当于 Python 的 `list`、JS 的 `Array`。`T` 是泛型参数，表示数组里装什么类型。

> 💡 **比喻**：`Vec` 就像一列可以自动加车厢的火车——你往里放东西，满了就自动加一节车厢，不用你操心。

### 用 `vec!` 宏快速创建

```rust
fn main() {
    let v = vec![1, 2, 3, 4, 5];
    let zeros = vec![0; 5]; // 5 个 0
    println!("{:?}", zeros); // [0, 0, 0, 0, 0]
}
```

### 遍历 Vec

```rust
fn main() {
    let v = vec![10, 20, 30];
    for val in &v {           // 不可变引用遍历
        println!("{}", val);
    }
    let mut v2 = vec![1, 2, 3];
    for val in &mut v2 {      // 可变引用遍历
        *val *= 2;            // 解引用后修改
    }
    println!("{:?}", v2);     // [2, 4, 6]
}
```

> ⚠️ **新手坑**：`v[i]` 访问越界会直接 panic（程序崩溃）。安全的访问方式是 `v.get(i)`，返回 `Option<&T>`：
> ```rust
> match v.get(100) {
>     Some(val) => println!("{}", val),
>     None => println!("越界了"),
> }
> ```

---

## 6.2 String：Rust 的字符串

先看一段代码——创建和操作字符串：

```rust
let mut s = String::from("hello");
s.push_str(", world");  // 追加
s.push('!');           // 追加单字符
println!("{}", s);     // hello, world!
```

```rust
let literal: &str = "rust";
let owned: String = literal.to_string();  // &str 转 String
let slice: &str = &owned;                  // String 转 &str
```

> 📖 **术语解释 · String vs &str**：`String` 是拥有所有权的、可增长的字符串（在堆上），`&str` 是字符串的引用/切片（不拥有所有权）。就像 `String` 是你买的书，`&str` 是你从图书馆借来看的书。

> ⚠️ **新手坑**：Rust 的 `String` 是 UTF-8 编码的，不支持直接用索引访问字符——因为一个 Unicode 字符可能占多个字节。`s[0]` 在 Rust 里是非法的！用 `s.chars().nth(0)` 代替（注意它返回 `Option<char>`，越界时是 `None`，要配合 `match` 或 `.unwrap()` 使用）。

> 💡 **比喻**：Rust 字符串是一列 UTF-8 字节的火车。你直接数"第 3 节车厢"可能取到的不是你想要的字符——因为有的字符占 1 节车厢，有的占 3 节。用 `chars()` 方法才是按"字符"遍历。

---

## 6.3 HashMap：键值对存储

先看一段代码——存入和查询：

```rust
use std::collections::HashMap;
let mut scores: HashMap<String, i32> = HashMap::new();
scores.insert(String::from("Alice"), 95);
match scores.get("Alice") {
    Some(&s) => println!("Alice: {}", s),  // 95
    None => println!("未找到"),
}
```

> 📖 **术语解释 · HashMap**：键值对集合，相当于 Python 的 `dict`、JS 的 `Object`/`Map`。`K` 是键的类型，`V` 是值的类型。

### insert 与 entry

```rust
fn main() {
    let mut map: HashMap<&str, i32> = HashMap::new();
    map.insert("a", 1);              // 直接插入/覆盖
    map.entry("a").or_insert(2);     // 只有不存在时才插入
    println!("{:?}", map);            // {"a": 1}
    map.entry("b").or_insert(3);     // "b" 不存在，插入
    println!("{:?}", map);            // {"a": 1, "b": 3}
}
```

> 💡 **比喻**：`entry().or_insert()` 就像抢座——有人了就不动，没人就坐下。直接 `insert` 则是强行换人。

---

## 6.4 panic!：程序崩溃

> 📖 **术语解释 · panic**：Rust 中表示"不可恢复的错误"。调用 `panic!` 宏会打印错误信息、展开栈、退出程序。就像火车出了大事故——只能紧急停车。

```rust
fn main() {
    let v = vec![1, 2, 3];
    // v[10]; // 越界会 panic
    panic!("这是故意的崩溃"); // 手动触发
}
```

### 什么时候用 panic？

- 程序状态不一致，无法继续运行
- 数组越界、除以零等编程错误
- 程序启动时配置缺失

> ⚠️ **新手坑**：不要用 `panic!` 处理正常的错误情况（如文件不存在、用户输入错误）。这些应该用 `Result`。

---

## 6.5 Result 深入

```rust
use std::fs::File;
use std::io::{self, Read};

fn read_file(path: &str) -> Result<String, io::Error> {
    let mut file = File::open(path)?;    // 打开失败就自动返回 Err
    let mut contents = String::new();
    file.read_to_string(&mut contents)?;  // 读取失败就自动返回 Err
    Ok(contents)
}

fn main() {
    match read_file("hello.txt") {
        Ok(content) => println!("文件内容: {}", content),
        Err(e) => println!("读取失败: {}", e),
    }
}
```

### unwrap 与 expect：快速解包

```rust
fn main() {
    let s = String::from("42");
    let n: i32 = s.parse().unwrap();      // 出错就 panic
    let n2: i32 = s.parse().expect("解析失败"); // 出错就 panic（带消息）
    println!("{} {}", n, n2);
}
```

> ⚠️ **新手坑**：`unwrap()` 在生产代码中尽量少用——出错就 panic。用 `?` 或 `match` 优雅处理错误。写快速原型时用 `unwrap()` 没问题。

---

## 6.6 自定义错误类型

当你的函数有多种错误来源时，可以用 `enum` 统一管理：

```rust
use std::num::ParseIntError;

#[derive(Debug)]
enum AppError {
    Io(String),
    Parse(ParseIntError),
    Empty,
}

fn parse_config(s: &str) -> Result<i32, AppError> {
    if s.is_empty() { return Err(AppError::Empty); }
    let n = s.parse::<i32>().map_err(AppError::Parse)?;
    Ok(n)
}

fn main() {
    println!("{:?}", parse_config("42"));   // Ok(42)
    println!("{:?}", parse_config(""));      // Err(Empty)
    println!("{:?}", parse_config("abc"));   // Err(Parse(...))
}
```

> 💡 **比喻**：自定义错误类型就像快递公司的投诉分类——"丢件"、"损坏"、"延误"各有各的处理方式。用 `enum` 把它们统一管理，调用者可以 `match` 不同错误做不同处理。

---

## 6.7 课后练习

### 基础题

**1.** 创建一个 `Vec<String>`，添加三个水果名字，遍历打印每个名字和长度。

<details>
<summary>参考答案要点</summary>

```rust
fn main() {
    let mut fruits = Vec::new();
    fruits.push(String::from("苹果"));
    fruits.push(String::from("香蕉"));
    fruits.push(String::from("西瓜"));
    for f in &fruits {
        println!("{} 长度 {}", f, f.len());
    }
}
```
关键点：`String` 的 `len()` 返回字节数，不是字符数。
</details>

### 进阶题

**2.** 用 `HashMap` 统计一段文本中每个单词出现的次数（空格分隔），打印结果。

<details>
<summary>参考答案要点</summary>

```rust
use std::collections::HashMap;
fn main() {
    let text = "hello world hello rust world world";
    let mut counts: HashMap<&str, i32> = HashMap::new();
    for word in text.split_whitespace() {
        let count = counts.entry(word).or_insert(0);
        *count += 1;
    }
    for (word, count) in &counts {
        println!("{}: {}", word, count);
    }
}
```
关键点：`entry().or_insert(0)` 返回值的可变引用，可以直接 `*count += 1`。
</details>

### 挑战题

**3.** 写一个函数 `read_numbers(path: &str) -> Result<Vec<i32>, String>`，从文件中读取每行一个数字。文件不存在返回 `Err("文件不存在")`，某行不是数字返回 `Err("第 N 行解析失败")`。在 `main` 中测试。

<details>
<summary>参考答案要点</summary>

```rust
use std::fs;
fn read_numbers(path: &str) -> Result<Vec<i32>, String> {
    let content = fs::read_to_string(path)
        .map_err(|_| String::from("文件不存在"))?;
    let mut nums = Vec::new();
    for (i, line) in content.lines().enumerate() {
        let n: i32 = line.trim().parse()
            .map_err(|_| format!("第 {} 行解析失败", i + 1))?;
        nums.push(n);
    }
    Ok(nums)
}
fn main() {
    match read_numbers("numbers.txt") {
        Ok(nums) => println!("{:?}", nums),
        Err(e) => println!("错误: {}", e),
    }
}
```
关键点：`map_err` 转换错误类型；`enumerate()` 同时获取索引和值。
</details>

---

## 6.8 Mini Project：单词频率统计器

用 `Vec`、`HashMap`、错误处理写一个文本词频统计器：

```rust
use std::collections::HashMap;
fn word_freq(text: &str) -> HashMap<&str, u32> {
    let mut map = HashMap::new();
    for word in text.split_whitespace() {
        *map.entry(word).or_insert(0) += 1;
    }
    map
}
```

```rust
fn main() {
    let text = "the quick brown fox jumps over the lazy dog the fox";
    let freq = word_freq(text);
    let mut sorted: Vec<_> = freq.into_iter().collect();
    sorted.sort_by(|a, b| b.1.cmp(&a.1));
    for (word, count) in sorted {
        println!("{}: {}", word, count);
    }
}
// 输出：the: 3, fox: 2, quick: 1, brown: 1, ...
```

> 📌 **要点**：`entry().or_insert(0)` 是 HashMap 的经典惯用法——"有就用，没有就插默认值"。把它记住，以后天天用。

> ### 📝 记忆卡片
>
> **一句话**：集合装数据，Result 管错误——能恢复的用 `Result`，救不回来的才 `panic!`。
>
> **口诀**：Vec 越界就 panic，`get` 才给 Option；`?` 是错误传送带。
>
> **三个判断题**（心里过一遍）：
> 1. Vec 用下标访问越界会返回 None → ✗（直接 panic！用 `.get()` 才返回 Option）
> 2. 生产环境应该到处 `unwrap()` → ✗（用 `?` 传播，或 `expect("带原因")`）
> 3. HashMap 的 entry API 能"有则更新、无则插入" → ✓

---

## 自检清单

- [ ] 我能用 `Vec::new()` 和 `vec![]` 创建动态数组
- [ ] 我理解 `String` 和 `&str` 的区别
- [ ] 我会用 `HashMap` 存储和查询键值对
- [ ] 我知道 `panic!` 用于不可恢复的错误，`Result` 用于可恢复的错误
- [ ] 我会用 `?` 运算符传播错误
- [ ] 我理解 `unwrap()` 出错会 panic，尽量用 `match` 代替
- [ ] 我会定义自定义错误类型
- [ ] 我完成了词频统计器 mini project

---

> 🦀 **下一章预告**：第 7 章我们进入进阶阶段——泛型与 Trait。这是 Rust 写出通用、复用代码的关键工具。
