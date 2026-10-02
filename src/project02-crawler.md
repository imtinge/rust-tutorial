# 实战2：简单文件爬虫

> **学习目标**
> - 掌握文件系统操作（`std::fs`、`std::path`）
> - 理解递归遍历目录树
> - 学会读取文件内容并搜索关键词
> - 综合运用错误处理、迭代器、闭包
>
> **预计学习时长**：2-3 小时

---

## 项目概览

> **比喻**：文件爬虫就像一个勤劳的图书管理员——你告诉他"去3楼找所有含'Rust'的书"，他就一层层走、一本本翻，把结果列给你。

### 功能需求

1. 递归遍历指定目录下的所有文件
2. 在文件内容中搜索关键词
3. 显示匹配的文件名、行号、匹配行内容
4. 支持文件扩展名过滤（只搜 `.rs` 文件）
5. 显示搜索统计（扫描了多少文件、找到多少匹配）

### 涉及知识点

| 章节 | 知识点 | 在项目中的运用 |
|------|--------|---------------|
| 第3章 | 所有权、借用 | 文件路径传递 |
| 第6章 | Result、? | 文件操作错误处理 |
| 第6章 | Vec | 收集文件列表与搜索结果 |
| 第9章 | 迭代器 | 遍历文件、行处理 |
| 第10章 | 多线程（可选） | 并行搜索加速 |

---

## 第一步：创建项目

```bash
cargo new file_crawler
cd file_crawler
```

---

## 第二步：定义数据结构

```rust
use std::fs;
use std::path::{Path, PathBuf};
use std::env;

#[derive(Debug)]
struct Match {
    file: PathBuf,
    line_num: usize,
    line_text: String,
}

#[derive(Debug)]
struct SearchResult {
    keyword: String,
    matches: Vec<Match>,
    files_scanned: usize,
}
```

> 📖 **设计思路**：
> - `Match`：一次匹配结果——哪个文件、第几行、那一行写了什么
> - `SearchResult`：整个搜索的汇总——关键词、所有匹配、扫描了多少文件

---

## 第三步：递归遍历目录

```rust
fn walk_dir(dir: &Path, ext: &str, files: &mut Vec<PathBuf>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                walk_dir(&path, ext, files);  // 递归进入子目录
            } else if path.extension()
                .and_then(|e| e.to_str()) == Some(ext) {
                files.push(path);             // 匹配扩展名的文件
            }
        }
    }
}
```

> 📖 **设计思路**：用递归遍历目录树。`flatten()` 跳过读取失败的条目。`extension()` 提取文件扩展名。

> ⚠️ **新手坑**：`read_dir` 返回的 `entries` 是迭代器，每个元素是 `io::Result<DirEntry>`。用 `flatten()` 自动跳过出错的项——比 `unwrap()` 安全得多。

---

## 第四步：搜索文件内容

```rust
fn search_file(path: &Path, keyword: &str, results: &mut Vec<Match>) {
    if let Ok(content) = fs::read_to_string(path) {
        for (line_num, line) in content.lines().enumerate() {
            if line.contains(keyword) {
                results.push(Match {
                    file: path.to_path_buf(),
                    line_num: line_num + 1,
                    line_text: line.trim().to_string(),
                });
            }
        }
    }
}
```

> 📖 **设计思路**：`lines()` 返回行迭代器，`enumerate()` 获取行号。`contains` 做子串搜索。`trim()` 去掉行首尾空白。

---

## 第五步：整合搜索逻辑

```rust
fn search(root: &Path, keyword: &str, ext: &str) -> SearchResult {
    let mut files = Vec::new();
    walk_dir(root, ext, &mut files);

    let mut matches = Vec::new();
    for file in &files {
        search_file(file, keyword, &mut matches);
    }

    SearchResult {
        keyword: keyword.to_string(),
        matches,
        files_scanned: files.len(),
    }
}
```

---

## 第六步：格式化输出

```rust
fn print_result(result: &SearchResult) {
    println!("================================");
    println!("搜索关键词: \"{}\"", result.keyword);
    println!("扫描文件数: {}", result.files_scanned);
    println!("匹配数: {}", result.matches.len());
    println!("================================");

    // 按文件分组
    let mut current_file: Option<&PathBuf> = None;
    for m in &result.matches {
        if Some(&m.file) != current_file {
            current_file = Some(&m.file);
            println!("\n📄 {}", m.file.display());
        }
        println!("  L{}: {}", m.line_num, m.line_text);
    }
}
```

> 📖 **设计思路**：用 `Option` 记录当前打印的文件名，只在切换文件时打印文件标题——让输出更整洁。

---

## 第七步：主函数

```rust
fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 3 {
        println!("用法: file_crawler <目录> <关键词> [扩展名]");
        println!("示例: file_crawler src fn rs");
        return;
    }

    let dir = Path::new(&args[1]);
    let keyword = &args[2];
    let ext = if args.len() >= 4 { args[3].as_str() } else { "rs" };

    if !dir.is_dir() {
        println!("错误: {} 不是有效目录", dir.display());
        return;
    }

    let result = search(dir, keyword, ext);
    print_result(&result);
}
```

---

## 完整代码

```rust
use std::fs;
use std::path::{Path, PathBuf};
use std::env;

#[derive(Debug)]
struct Match {
    file: PathBuf,
    line_num: usize,
    line_text: String,
}

#[derive(Debug)]
struct SearchResult {
    keyword: String,
    matches: Vec<Match>,
    files_scanned: usize,
}

fn walk_dir(dir: &Path, ext: &str, files: &mut Vec<PathBuf>) {
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                walk_dir(&path, ext, files);
            } else if path.extension().and_then(|e| e.to_str()) == Some(ext) {
                files.push(path);
            }
        }
    }
}

fn search_file(path: &Path, keyword: &str, results: &mut Vec<Match>) {
    if let Ok(content) = fs::read_to_string(path) {
        for (i, line) in content.lines().enumerate() {
            if line.contains(keyword) {
                results.push(Match {
                    file: path.to_path_buf(),
                    line_num: i + 1,
                    line_text: line.trim().to_string(),
                });
            }
        }
    }
}

fn search(root: &Path, keyword: &str, ext: &str) -> SearchResult {
    let mut files = Vec::new();
    walk_dir(root, ext, &mut files);
    let mut matches = Vec::new();
    for f in &files { search_file(f, keyword, &mut matches); }
    SearchResult { keyword: keyword.to_string(), matches, files_scanned: files.len() }
}

fn print_result(result: &SearchResult) {
    println!("================================");
    println!("搜索关键词: \"{}\"", result.keyword);
    println!("扫描文件数: {}", result.files_scanned);
    println!("匹配数: {}", result.matches.len());
    println!("================================");
    let mut current: Option<&PathBuf> = None;
    for m in &result.matches {
        if Some(&m.file) != current {
            current = Some(&m.file);
            println!("\n📄 {}", m.file.display());
        }
        println!("  L{}: {}", m.line_num, m.line_text);
    }
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 3 {
        eprintln!("用法: file_crawler <目录> <关键词> [扩展名]");
        eprintln!("示例: file_crawler src fn rs");
        std::process::exit(1);
    }
    let dir = Path::new(&args[1]);
    let keyword = &args[2];
    let ext = if args.len() >= 4 { args[3].as_str() } else { "rs" };
    if !dir.is_dir() {
        eprintln!("错误: {} 不是有效目录", dir.display());
        std::process::exit(1);
    }
    let result = search(dir, keyword, ext);
    print_result(&result);
}
```

---

## 运行效果

```bash
$ cargo run -- src fn rs
================================
搜索关键词: "fn"
扫描文件数: 1
匹配数: 6
================================

📄 src\main.rs
  L19: fn walk_dir(dir: &Path, ext: &str, files: &mut Vec<PathBuf>) {
  L33: fn search_file(path: &Path, keyword: &str, results: &mut Vec<Match>) {
  L47: fn search(root: &Path, keyword: &str, ext: &str) -> SearchResult {
  L63: fn print_result(result: &SearchResult) {
  L80: fn main() {
  L84: println!("示例: file_crawler src fn rs");
```

> 💡 注意最后一条：关键词 `fn` 是**子串匹配**，连用法提示字符串里的 `file_crawler src fn rs` 也被搜出来了。换成更精确的正则匹配（挑战题 2）可以避免这种"误伤"。

---

## 进阶挑战

1. **大小写不敏感搜索**：加 `--ignore-case` 参数
2. **正则表达式**：用 `regex` crate 支持正则搜索
3. **并行搜索**：用 `std::thread` 或 `rayon` crate 并行搜索多个文件
4. **输出到文件**：支持 `--output result.txt` 把搜索结果写入文件

---

## 自检清单

- [ ] 我的爬虫能递归遍历子目录
- [ ] 能按文件扩展名过滤
- [ ] 能正确显示匹配文件名、行号、行内容
- [ ] 无效目录输入有错误提示
- [ ] 扫描二进制文件时不会崩溃（`read_to_string` 失败时优雅跳过）

---

> 🦀 **下一个项目**：异步 Web 服务器——用 Rust 的 async/await 构建一个真实的 HTTP 服务器！
