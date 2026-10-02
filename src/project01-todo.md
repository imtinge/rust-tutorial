# 实战1：命令行 Todo 工具

> **学习目标**
> - 把前面学到的结构体、枚举、集合、错误处理、模块全部串联起来
> - 完成一个可运行、可持久化的命令行 Todo 管理工具
> - 获得完整的"从需求到代码"的项目经验
>
> **预计学习时长**：2-3 小时

---

## 项目概览

> **比喻**：这个项目就像你亲手组装一辆自行车——结构体是车架，枚举是变速齿轮，集合是轮子，错误处理是刹车，模块系统是螺丝把各部件连起来。装完就能骑！

### 功能需求

1. 添加待办事项（`add "买牛奶"`）
2. 列出所有待办事项（`list`）
3. 标记完成（`done 1`）
4. 删除待办事项（`remove 1`）
5. 持久化到 JSON 文件（重启不丢失）
6. 清除已完成项（`clear`）

### 涉及知识点

| 章节 | 知识点 | 在项目中的运用 |
|------|--------|---------------|
| 第2章 | 变量、函数、控制流 | 命令解析、条件分支 |
| 第3章 | 所有权、借用 | 参数传递、引用 |
| 第4章 | 结构体、方法 | Todo 项和列表的数据结构 |
| 第5章 | 枚举、match | 命令类型定义、模式匹配 |
| 第6章 | Vec、错误处理 | 待办列表存储、文件读写 |
| 第9章 | 迭代器 | id 计算、列表遍历 |

---

## 第一步：创建项目

```bash
cargo new todo_cli
cd todo_cli
```

在 `Cargo.toml` 中添加 JSON 序列化依赖：

```toml
[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

> 💡 **技巧**：`serde` 是 Rust 生态中最流行的序列化库——把结构体自动转成 JSON（或反序列化）。`features = ["derive"]` 启用 `#[derive(Serialize, Deserialize)]`。

---

## 第二步：定义数据结构

创建 `src/main.rs`：

```rust
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Task {
    id: u32,
    title: String,
    done: bool,
}

#[derive(Debug)]
enum Command {
    Add(String),
    List,
    Done(u32),
    Remove(u32),
    Clear,
}
```

> 📖 **设计思路**：
> - `Task` 结构体——每条待办的"id、标题、是否完成"
> - `Command` 枚举——用变体区分不同命令，`Add` 携带标题、`Done/Remove` 携带 id

---

## 第三步：实现核心逻辑

```rust
const FILE_PATH: &str = "todo.json";

fn load_tasks() -> Vec<Task> {
    match fs::read_to_string(FILE_PATH) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

fn save_tasks(tasks: &[Task]) {
    let json = serde_json::to_string_pretty(tasks).unwrap();
    fs::write(FILE_PATH, json).expect("保存失败");
}

fn next_id(tasks: &[Task]) -> u32 {
    tasks.iter().map(|t| t.id).max().unwrap_or(0) + 1
}
```

> 📖 **设计思路**：
> - `load_tasks`：读取文件，反序列化成 `Vec<Task>`，文件不存在就返回空列表
> - ⚠️ 注意：`todo.json` 内容损坏时也会静默返回空列表（教学简化）——生产环境应该打印警告提示用户检查文件，而不是让任务"凭空消失"
> - `save_tasks`：序列化并写入文件
> - `next_id`：用迭代器找出最大 id + 1

---

## 第四步：解析命令行参数

```rust
fn parse_command(args: &[String]) -> Option<Command> {
    if args.len() < 2 { return None; }
    match args[1].as_str() {
        "add" if args.len() >= 3 => Some(Command::Add(args[2..].join(" "))),
        "list" => Some(Command::List),
        "done" if args.len() >= 3 => args[2].parse().ok().map(Command::Done),
        "remove" if args.len() >= 3 => args[2].parse().ok().map(Command::Remove),
        "clear" => Some(Command::Clear),
        _ => None,
    }
}
```

> 📖 **设计思路**：用 `match` 模式匹配命令名，用 `if args.len() >= 3` 做守卫条件保证参数完整。`parse().ok()` 把 `Result` 转成 `Option`。

---

## 第五步：执行命令

```rust
fn run(cmd: Command, tasks: &mut Vec<Task>) {
    match cmd {
        Command::Add(title) => {
            let id = next_id(tasks);
            tasks.push(Task { id, title, done: false });
            save_tasks(tasks);
            println!("[+] 已添加 #{}: {}", id, tasks.last().unwrap().title);
        }
        Command::List => {
            if tasks.is_empty() { println!("暂无待办"); return; }
            for t in tasks.iter() {
                let mark = if t.done { "[x]" } else { "[ ]" };
                println!("#{} {} {}", t.id, mark, t.title);
            }
        }
        Command::Done(id) => {
            if let Some(t) = tasks.iter_mut().find(|t| t.id == id) {
                t.done = true;
                save_tasks(tasks);
                println!("[v] 完成 #{}", id);
            } else { println!("找不到 #{}", id); }
        }
        Command::Remove(id) => {
            tasks.retain(|t| t.id != id);
            save_tasks(tasks);
            println!("[-] 已删除 #{}", id);
        }
        Command::Clear => {
            let before = tasks.len();
            tasks.retain(|t| !t.done);
            save_tasks(tasks);
            println!("[*] 清理了 {} 项", before - tasks.len());
        }
    }
}
```

> 📖 **设计思路**：
> - `iter_mut()` + `find()` 定位并修改待办
> - `retain()` 过滤删除——一行代码搞定"删除指定 id"或"删除已完成"
> - 每次修改后自动 `save_tasks` 持久化

---

## 第六步：主函数入口

```rust
fn main() {
    let args: Vec<String> = env::args().collect();
    let mut tasks = load_tasks();

    match parse_command(&args) {
        Some(cmd) => run(cmd, &mut tasks),
        None => print_usage(),
    }
}

fn print_usage() {
    println!("用法:");
    println!("  todo add <标题>     添加待办");
    println!("  todo list           列出全部");
    println!("  todo done <id>      标记完成");
    println!("  todo remove <id>    删除待办");
    println!("  todo clear          清除已完成");
}
```

---

## 第七步：给核心逻辑写测试

还记得第 12 章吗？**纯函数最值得测**。`next_id` 和 `parse_command` 不碰文件、不打印，几行测试就能守住核心规则。把下面模块加在 `main.rs` 末尾，`cargo test` 即可运行：

```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn args(parts: &[&str]) -> Vec<String> {
        parts.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn next_id_starts_at_1_and_skips_gaps() {
        assert_eq!(next_id(&[]), 1);
        let mk = |id| Task { id, title: String::new(), done: false };
        assert_eq!(next_id(&[mk(1), mk(5), mk(2)]), 6); // 取最大 +1，不取长度 +1
    }

    #[test]
    fn parses_known_commands() {
        assert!(matches!(
            parse_command(&args(&["todo", "add", "学", "Rust"])),
            Some(Command::Add(t)) if t == "学 Rust"
        ));
        assert!(matches!(parse_command(&args(&["todo", "list"])), Some(Command::List)));
        assert!(matches!(parse_command(&args(&["todo", "done", "3"])), Some(Command::Done(3))));
    }

    #[test]
    fn rejects_bad_input() {
        assert!(parse_command(&args(&["todo"])).is_none());
        assert!(parse_command(&args(&["todo", "frobnicate"])).is_none());
        assert!(parse_command(&args(&["todo", "done", "abc"])).is_none()); // id 解析失败
    }
}
```

> 💡 **说明**：`use super::*;` 把父模块（`main.rs`）的私有函数也引进来——单元测试可以测私有项。`run` 里的 `Add` 分支会写 `todo.json`，想测它得先隔离文件路径，留给你做进阶练习。

## 完整代码

把以上代码拼到一起就是完整的 `src/main.rs`：

```rust
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;

const FILE_PATH: &str = "todo.json";

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Task {
    id: u32,
    title: String,
    done: bool,
}

#[derive(Debug)]
enum Command {
    Add(String),
    List,
    Done(u32),
    Remove(u32),
    Clear,
}

fn load_tasks() -> Vec<Task> {
    fs::read_to_string(FILE_PATH)
        .ok()
        .and_then(|c| serde_json::from_str(&c).ok())
        .unwrap_or_default()
}

fn save_tasks(tasks: &[Task]) {
    let json = serde_json::to_string_pretty(tasks).expect("序列化失败");
    fs::write(FILE_PATH, json).expect("写入失败");
}

fn next_id(tasks: &[Task]) -> u32 {
    tasks.iter().map(|t| t.id).max().unwrap_or(0) + 1
}

fn parse_command(args: &[String]) -> Option<Command> {
    if args.len() < 2 { return None; }
    match args[1].as_str() {
        "add" if args.len() >= 3 => Some(Command::Add(args[2..].join(" "))),
        "list" => Some(Command::List),
        "done" if args.len() >= 3 => args[2].parse().ok().map(Command::Done),
        "remove" if args.len() >= 3 => args[2].parse().ok().map(Command::Remove),
        "clear" => Some(Command::Clear),
        _ => None,
    }
}

fn run(cmd: Command, tasks: &mut Vec<Task>) {
    match cmd {
        Command::Add(title) => {
            let id = next_id(tasks);
            tasks.push(Task { id, title, done: false });
            save_tasks(tasks);
            println!("[+] 已添加 #{}: {}", id, tasks.last().unwrap().title);
        }
        Command::List => {
            if tasks.is_empty() { println!("暂无待办"); return; }
            for t in tasks {
                let mark = if t.done { "[x]" } else { "[ ]" };
                println!("#{} {} {}", t.id, mark, t.title);
            }
        }
        Command::Done(id) => {
            match tasks.iter_mut().find(|t| t.id == id) {
                Some(t) => { t.done = true; save_tasks(tasks); println!("[v] 完成 #{}", id); }
                None => println!("找不到 #{}", id),
            }
        }
        Command::Remove(id) => {
            tasks.retain(|t| t.id != id);
            save_tasks(tasks);
            println!("[-] 已删除 #{}", id);
        }
        Command::Clear => {
            let before = tasks.len();
            tasks.retain(|t| !t.done);
            save_tasks(tasks);
            println!("[*] 清理了 {} 项", before - tasks.len());
        }
    }
}

fn print_usage() {
    println!("用法: todo <命令> [参数]");
    println!("  add <标题>   添加待办");
    println!("  list         列出全部");
    println!("  done <id>    标记完成");
    println!("  remove <id>  删除待办");
    println!("  clear        清除已完成");
}

fn main() {
    let args: Vec<String> = env::args().collect();
    let mut tasks = load_tasks();
    match parse_command(&args) {
        Some(cmd) => run(cmd, &mut tasks),
        None => print_usage(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(parts: &[&str]) -> Vec<String> {
        parts.iter().map(|s| s.to_string()).collect()
    }

    #[test]
    fn next_id_starts_at_1_and_skips_gaps() {
        assert_eq!(next_id(&[]), 1);
        let mk = |id| Task { id, title: String::new(), done: false };
        assert_eq!(next_id(&[mk(1), mk(5), mk(2)]), 6);
    }

    #[test]
    fn parses_known_commands() {
        assert!(matches!(
            parse_command(&args(&["todo", "add", "学", "Rust"])),
            Some(Command::Add(t)) if t == "学 Rust"
        ));
        assert!(matches!(parse_command(&args(&["todo", "list"])), Some(Command::List)));
        assert!(matches!(parse_command(&args(&["todo", "done", "3"])), Some(Command::Done(3))));
    }

    #[test]
    fn rejects_bad_input() {
        assert!(parse_command(&args(&["todo"])).is_none());
        assert!(parse_command(&args(&["todo", "frobnicate"])).is_none());
        assert!(parse_command(&args(&["todo", "done", "abc"])).is_none());
    }
}
```

---

## 运行效果

```bash
$ cargo run -- add "学Rust所有权"
[+] 已添加 #1: 学Rust所有权

$ cargo run -- add "写一个Todo工具"
[+] 已添加 #2: 写一个Todo工具

$ cargo run -- list
#1 [ ] 学Rust所有权
#2 [ ] 写一个Todo工具

$ cargo run -- done 1
[v] 完成 #1

$ cargo run -- list
#1 [x] 学Rust所有权
#2 [ ] 写一个Todo工具

$ cargo run -- clear
[*] 清理了 1 项

$ cargo run -- list
#2 [ ] 写一个Todo工具
```

---

## 进阶挑战

完成后试试这些扩展：

1. **优先级**：给 `Task` 加 `priority: Priority`（Low/Medium/High），`list` 时按优先级排序
2. **截止日期**：加 `deadline: Option<String>`，过期自动标红
3. **多列表**：支持 `todo work add xxx` 和 `todo home add xxx` 分类管理

---

## 自检清单

- [ ] 我的程序能 `add` 并 `list`
- [ ] 数据能保存到 `todo.json` 并重启后加载
- [ ] `done` 和 `remove` 正确工作
- [ ] `clear` 只清除已完成的项
- [ ] 输入无效命令时显示用法提示
- [ ] 代码中没有 `unwrap()` 导致的意外 panic（除了确定安全的地方）

---

> 🦀 **下一个项目**：文件爬虫——遍历目录、搜索文件内容，带你深入文件 I/O 和递归！
