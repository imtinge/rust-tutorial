# 实战3：异步 Web 服务器

> **学习目标**
> - 理解 Rust 异步编程（async/await）的基本概念
> - 使用 tokio 运行时构建异步服务器
> - 实现 HTTP 请求解析和响应
> - 综合运用所有权、错误处理、多线程、模块系统
>
> **预计学习时长**：3-4 小时

---

## 项目概览

> **比喻**：异步服务器就像一家咖啡厅——一个服务员（线程）可以同时服务多桌客人。客人 A 在等咖啡（I/O 操作）时，服务员不会傻站着，而是去招呼客人 B。等 A 的咖啡好了再端过去。这就是 async/await 的核心思想。

### 功能需求

1. 监听 TCP 端口，接收 HTTP 请求
2. 解析请求的路径和方法
3. 根据路径返回不同响应（`/`、`/time`、`/api/echo`）
4. 支持并发处理多个请求
5. 优雅的错误处理和日志输出

### 涉及知识点

| 章节 | 知识点 | 在项目中的运用 |
|------|--------|---------------|
| 第3章 | 所有权、借用 | 数据传递 |
| 第5章 | match、Result | 路由匹配、错误处理 |
| 第6章 | Vec、String | HTTP 请求/响应解析 |
| 第8章 | 闭包 | async 块 |
| 第10章 | 多线程 | tokio 并发 |
| 第11章 | async/await、tokio | 异步运行时、并发处理连接 |

---

## 第一步：创建项目

```bash
cargo new mini_server
cd mini_server
```

在 `Cargo.toml` 中添加依赖：

```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
```

> 💡 **技巧**：`tokio` 是 Rust 最流行的异步运行时——`features = ["full"]` 开启全部功能（TCP、文件、定时器等）。生产环境可以按需选择 features 减少体积。

---

## 第二步：理解 async/await 基础

> 📖 **术语解释 · async/await**：`async` 标记的函数返回一个 `Future`，`await` 等待 Future 完成。异步函数本身不会执行——需要运行时（如 tokio）来驱动。

> 📖 **术语解释 · Future**：表示一个"未来会产生值"的计算。就像你点外卖后拿到的订单号——订单号本身不是食物，但将来会变成食物。`await` 就是"等外卖送到"。

```rust
// 同步代码：阻塞等待
fn read_file() -> String { /* 读完才返回 */ }

// 异步代码：不阻塞
async fn read_file_async() -> String { /* 返回 Future */ }
// 调用时需要 .await
```

> **比喻**：同步 = 打电话等对方接（一直拿着手机），异步 = 发微信等回复（可以同时做别的事）。

### 热身：先写一个 30 行的 TCP echo 服务器

在碰 HTTP 之前，先跑通 tokio 网络编程的最小骨架——**收到什么原样发回什么**。把下面代码放进 `src/main.rs`，`cargo run` 后另开终端用 `ncat 127.0.0.1 8080`（或 PowerShell 的 `Test-NetConnection`）连上去，随便输入文字，会看到同样的内容被发回来：

```rust
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let listener = TcpListener::bind("127.0.0.1:8080").await?;
    println!("echo server listening on 8080");
    loop {
        let (mut socket, addr) = listener.accept().await?;
        println!("connection from {}", addr);
        // 每个连接丢给一个独立任务，主循环立刻回去 accept 下一个
        tokio::spawn(async move {
            let mut buf = [0u8; 1024];
            loop {
                let n = match socket.read(&mut buf).await {
                    Ok(0) => return,            // 对方关闭了连接
                    Ok(n) => n,
                    Err(e) => { eprintln!("read error: {}", e); return; }
                };
                if socket.write_all(&buf[..n]).await.is_err() {
                    return;
                }
            }
        });
    }
}
```

📌 **这就是后面整个 Web 服务器的骨架**：`TcpListener::bind` → 循环 `accept` → 每个连接 `tokio::spawn` 一个任务。唯一的区别是：echo 把字节原样发回，而 Web 服务器要把字节按 HTTP 格式**解析成请求**、再拼出 HTTP 格式的**响应**。热身跑通后，再继续往下写——别跳过这一步亲手连一次！

---

## 第三步：定义 HTTP 响应

```rust
use std::io;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

fn build_response(status: &str, body: &str) -> String {
    format!(
        "HTTP/1.1 {}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\r\n{}",
        status, body.len(), body
    )
}
```

> 📖 **设计思路**：HTTP 响应格式为 `状态行 + 头部 + 空行 + 正文`。我们用 `format!` 宏拼接。

---

## 第四步：路由处理

```rust
fn route(path: &str) -> String {
    match path {
        "/" => build_response("200 OK", "<h1>欢迎来到 Mini Server 🦀</h1>"),
        "/time" => {
            let body = format!("<h1>当前时间戳: {}</h1>", now_ts());
            build_response("200 OK", &body)
        }
        "/api/echo" => build_response("200 OK", "<p>Echo API - 请发送 POST 请求</p>"),
        _ => build_response("404 Not Found", "<h1>404 - 页面不存在</h1>"),
    }
}

fn now_ts() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}
```

> 📖 **设计思路**：用 `match` 匹配路径，返回不同的 HTTP 响应。真实项目中可以用 `axum` 或 `actix-web` 等框架。

---

## 第五步：解析 HTTP 请求

```rust
fn parse_path(request: &str) -> String {
    // HTTP 请求第一行: GET /path HTTP/1.1
    request.lines().next()
        .and_then(|line| line.split_whitespace().nth(1))
        .unwrap_or("/")
        .to_string()
}
```

> 📖 **设计思路**：取第一行，按空格分割，第二部分就是路径。用 `Option` 链式调用避免 panic。

> ⚠️ **新手坑（教学简化）**：这里用固定的 1024 字节缓冲，超长请求会被截断——对浏览器访问足够了，但生产环境的 HTTP 服务器要循环读取直到碰到空行 `\r\n\r\n`（请求头结束标志），还要处理大 body。另一个思路是用 `String` 边读边追加（`read_to_end` 或循环 `read` + `push_str`），本书为突出协议主线没有展开。

---

## 第六步：处理连接

```rust
async fn handle_connection(mut stream: tokio::net::TcpStream) {
    let mut buffer = [0u8; 1024];
    // 关键：接住 read 返回的 n——本次实际读到的字节数
    let n = match stream.read(&mut buffer).await {
        Ok(0) => return,  // 连接关闭
        Ok(n) => n,
        Err(e) => { eprintln!("读取失败: {}", e); return; }
    };

    // 只能解析前 n 个字节；用整个 buffer 会把未初始化的零字节/残留内容也带进来
    let request = String::from_utf8_lossy(&buffer[..n]);
    let path = parse_path(&request);
    let response = route(&path);

    // 从状态行解析真实状态码（而不是在整个响应里 contains("200")）
    let code = status_code(&response).unwrap_or(0);
    println!("📝 {} -> {}", path, code);

    if stream.write_all(response.as_bytes()).await.is_err() {
        eprintln!("写入失败");
    }
}

/// 解析响应第一行 "HTTP/1.1 200 OK" 中的状态码；调用方可用 (200..300).contains(&code) 判定成功
fn status_code(response: &str) -> Option<u16> {
    response.lines().next()?
        .split_whitespace().nth(1)?
        .parse().ok()
}
```

> 📖 **设计思路**：
> - `read().await` 异步读取数据，并保存实际字节数 `n`
> - 只按 `&buffer[..n]` 转字符串——这是所有 `read` 类 API 的通用纪律
> - `String::from_utf8_lossy` 把字节安全转成字符串
> - 解析路径 → 路由 → 写回响应
> - 状态码从状态行解析，判定成功用区间 `200..300`，不能用 `contains("200")`（正文里恰好出现"200"就会误判）

---

## 第七步：主函数启动服务器

```rust
#[tokio::main]
async fn main() -> io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:8080").await?;
    println!("🚀 服务器运行在 http://127.0.0.1:8080");
    println!("按 Ctrl+C 停止\n");

    loop {
        let (stream, addr) = listener.accept().await?;
        println!("📞 新连接: {}", addr);

        // 每个连接 spawn 一个异步任务
        tokio::spawn(async move {
            handle_connection(stream).await;
        });
    }
}
```

> 📖 **设计思路**：
> - `#[tokio::main]` 把 `main` 变成异步入口
> - `TcpListener::bind` 异步绑定端口
> - `listener.accept().await` 等待新连接
> - `tokio::spawn` 为每个连接创建独立异步任务——这就是并发的关键！

> **比喻**：`tokio::spawn` 就像咖啡厅经理——每来一桌客人就喊一个服务员去服务。多个服务员可以同时工作，互不阻塞。

---

## 完整代码

> 💡 建议：完整代码末尾附带了一组针对解析函数的单元测试——`cargo test` 全绿后再 `cargo run` 启动服务器。

```rust
use std::io;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};

fn build_response(status: &str, body: &str) -> String {
    format!(
        "HTTP/1.1 {}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\r\n{}",
        status, body.len(), body
    )
}

fn now_ts() -> u64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs()
}

fn route(path: &str) -> String {
    match path {
        "/" => build_response("200 OK", "<h1>欢迎来到 Mini Server</h1><p>路由: /, /time, /api/echo</p>"),
        "/time" => {
            let body = format!("<h1>时间戳: {}</h1>", now_ts());
            build_response("200 OK", &body)
        }
        "/api/echo" => build_response("200 OK", "<p>Echo API</p>"),
        _ => build_response("404 Not Found", "<h1>404 Not Found</h1>"),
    }
}

fn parse_path(request: &str) -> String {
    request.lines().next()
        .and_then(|line| line.split_whitespace().nth(1))
        .unwrap_or("/")
        .to_string()
}

async fn handle_connection(mut stream: TcpStream) {
    let mut buffer = [0u8; 1024];
    // 接住实际读到的字节数 n
    let n = match stream.read(&mut buffer).await {
        Ok(0) | Err(_) => return,
        Ok(n) => n,
    };
    // 只解析前 n 个字节
    let request = String::from_utf8_lossy(&buffer[..n]);
    let path = parse_path(&request);
    let response = route(&path);
    // 状态码从状态行解析，2xx 记为成功
    let code = status_code(&response).unwrap_or(0);
    let ok = (200..300).contains(&code);
    println!("[{}] {} -> {} ({})", timestamp(), path, code, if ok { "成功" } else { "失败" });
    let _ = stream.write_all(response.as_bytes()).await;
}

/// 解析 "HTTP/1.1 200 OK" 状态行中的状态码
fn status_code(response: &str) -> Option<u16> {
    response.lines().next()?
        .split_whitespace().nth(1)?
        .parse().ok()
}

fn timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    format!("{:02}:{:02}:{:02}", (secs/3600)%24, (secs/60)%60, secs%60)
}

#[tokio::main]
async fn main() -> io::Result<()> {
    let listener = TcpListener::bind("127.0.0.1:8080").await?;
    println!("Server running at http://127.0.0.1:8080");
    println!("Press Ctrl+C to stop\n");
    loop {
        let (stream, addr) = listener.accept().await?;
        println!("New connection: {}", addr);
        tokio::spawn(handle_connection(stream));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_status_code() {
        assert_eq!(status_code("HTTP/1.1 200 OK\r\n"), Some(200));
        assert_eq!(status_code("HTTP/1.1 404 Not Found\r\n"), Some(404));
        assert_eq!(status_code("HTTP/1.1 301 Moved\r\n"), Some(301));
        assert_eq!(status_code(""), None);              // 空响应
        assert_eq!(status_code("garbage"), None);     // 没有状态码段
    }

    #[test]
    fn parses_request_path() {
        assert_eq!(parse_path("GET /time HTTP/1.1\r\nHost: x\r\n"), "/time");
        assert_eq!(parse_path(""), "/");              // 缺行时回默认路由
    }

    #[test]
    fn routes_have_expected_status() {
        assert_eq!(status_code(&route("/")), Some(200));
        assert_eq!(status_code(&route("/time")), Some(200));
        assert_eq!(status_code(&route("/no-such-page")), Some(404));
    }
}
```

---

## 运行效果

```bash
$ cargo run
Server running at http://127.0.0.1:8080
Press Ctrl+C to stop

New connection: 127.0.0.1:54321
[00:00:42] / -> 200 (成功)
New connection: 127.0.0.1:54322
[00:00:43] /time -> 200 (成功)
New connection: 127.0.0.1:54323
[00:00:44] /notfound -> 404 (失败)
```

在浏览器中访问：
- `http://127.0.0.1:8080/` → 欢迎页面
- `http://127.0.0.1:8080/time` → 当前时间戳
- `http://127.0.0.1:8080/notfound` → 404 页面

---

## 进阶挑战

1. **POST 支持**：解析 POST 请求的 body，实现真正的 echo API
2. **JSON API**：返回 JSON 格式数据（用 `serde_json`）
3. **静态文件服务**：把路径映射到文件系统，返回文件内容
4. **优雅停机**：捕获 Ctrl+C 信号，等待所有连接处理完再退出
5. **连接池**：限制最大并发连接数

---

## 自检清单

- [ ] 服务器能成功启动并监听端口
- [ ] 浏览器访问 `/` 能看到欢迎页面
- [ ] 访问不存在路径返回 404
- [ ] 多个请求能并发处理（用 `tokio::spawn`）
- [ ] 控制台打印了请求日志
- [ ] 没有 `unwrap()` 在可能导致崩溃的地方

---

> 🦀 **下一个项目**：简易 Redis 服务器——用 async/await + tokio 构建一个真实的 TCP 服务器！
