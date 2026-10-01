# 实战4：简易 Redis 服务器

> **学习目标**
> - 用 async/await + tokio 构建一个真实的异步 TCP 服务器
> - 实现 Redis 核心命令（GET/SET/DEL/EXISTS）
> - 掌握并发数据共享（`Arc<Mutex<HashMap>>`）
> - 综合运用所有权、错误处理、模块系统、异步编程
>
> **预计学习时长**：3-4 小时

---

## 项目概览

> 💡 **比喻**：Redis 就像一个超级快的快递中转站——你存一个包裹（SET key value），取一个包裹（GET key），查有没有（EXISTS key），扔掉一个（DEL key）。我们来实现一个简化版。

### 功能需求

1. TCP 服务器，监听端口，接受客户端连接
2. 解析 RESP（Redis 序列化协议）格式的命令
3. 支持 `SET key value`、`GET key`、`DEL key`、`EXISTS key`、`PING` 五个命令
4. 多客户端并发访问，共享同一份数据
5. 异步处理，不阻塞

### 涉及知识点

| 章节 | 知识点 | 运用位置 |
|------|--------|---------|
| 第3章 | 所有权、借用 | 数据传递 |
| 第5章 | match、Result | 命令解析、错误处理 |
| 第6章 | HashMap | 数据存储 |
| 第9章 | 模块 | 代码组织 |
| 第10章 | Arc/Mutex | 并发共享 |
| 实战3 | async/await | 异步 TCP |
| 第12章 | 编译错误 | 开发中的调试 |

---

## 第一步：创建项目

```bash
cargo new mini_redis
cd mini_redis
```

`Cargo.toml`：
```toml
[dependencies]
tokio = { version = "1", features = ["full"] }
```

> 💡 **技巧**：网络编程中缓冲区管理是关键——本例用固定数组简化教学，生产环境可用 `bytes` crate 的 `BytesMut` 实现零拷贝分割。

---

## 第二步：解析 RESP 协议

Redis 使用 RESP 协议通信。`SET key value` 在协议里长这样：
```
*3\r\n$3\r\nSET\r\n$3\r\nkey\r\n$5\r\nvalue\r\n
```

格式：`*参数数\r\n` + 每个参数 `$长度\r\n内容\r\n`

```rust
fn parse_resp(data: &str) -> Option<Vec<String>> {
    let mut lines = data.split("\r\n");
    let first = lines.next()?;
    if !first.starts_with('*') { return None; }
    let count: usize = first[1..].parse().ok()?;
    let mut result = Vec::with_capacity(count);
    for _ in 0..count {
        let len_line = lines.next()?;
        if !len_line.starts_with('$') { return None; }
        lines.next().map(|s| result.push(s.to_string()));
    }
    Some(result)
}
```

> 📖 **设计思路**：简化版解析器——按 `\r\n` 分割，跳过长度行，取内容行。生产级解析器需要处理二进制数据和边界问题。

---

## 第三步：执行命令

```rust
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

fn execute(
    cmd: &[String],
    db: &Arc<Mutex<HashMap<String, String>>>,
) -> String {
    if cmd.is_empty() { return "-ERR empty command\r\n".to_string(); }
    match cmd[0].to_uppercase().as_str() {
        "SET" if cmd.len() >= 3 => {
            db.lock().unwrap().insert(cmd[1].clone(), cmd[2].clone());
            "+OK\r\n".to_string()
        }
        "GET" if cmd.len() >= 2 => {
            match db.lock().unwrap().get(&cmd[1]) {
                Some(v) => format!("${}\r\n{}\r\n", v.len(), v),
                None => "$-1\r\n".to_string(),  // null
            }
        }
        "DEL" if cmd.len() >= 2 => {
            let removed = db.lock().unwrap().remove(&cmd[1]).is_some();
            format!(":{}\r\n", if removed { 1 } else { 0 })
        }
        "EXISTS" if cmd.len() >= 2 => {
            let exists = db.lock().unwrap().contains_key(&cmd[1]);
            format!(":{}\r\n", if exists { 1 } else { 0 })
        }
        "PING" => "+PONG\r\n".to_string(),
        _ => "-ERR unknown command\r\n".to_string(),
    }
}
```

> 📖 **设计思路**：
> - `Arc<Mutex<HashMap>>` 共享数据库——`Arc` 多线程共享，`Mutex` 保证并发安全
> - `match` 匹配命令，`if cmd.len() >= N` 做参数完整性检查
> - 返回 RESP 格式的响应字符串

---

## 第四步：异步 TCP 服务器

```rust
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

async fn handle_client(
    mut stream: tokio::net::TcpStream,
    db: Arc<Mutex<HashMap<String, String>>>,
) {
    let mut buffer = [0u8; 512];
    loop {
        match stream.read(&mut buffer).await {
            Ok(0) => return,   // 连接关闭
            Ok(n) => {
                let data = String::from_utf8_lossy(&buffer[..n]);
                if let Some(cmd) = parse_resp(&data) {
                    let response = execute(&cmd, &db);
                    let _ = stream.write_all(response.as_bytes()).await;
                }
            }
            Err(_) => return,
        }
    }
}

#[tokio::main]
async fn main() {
    let db = Arc::new(Mutex::new(HashMap::new()));
    let listener = TcpListener::bind("127.0.0.1:6379").await.unwrap();
    println!("Redis 服务器运行在 127.0.0.1:6379");

    loop {
        let (stream, addr) = listener.accept().await.unwrap();
        println!("新连接: {}", addr);
        let db = Arc::clone(&db);
        tokio::spawn(handle_client(stream, db));
    }
}
```

> 📖 **设计思路**：
> - `#[tokio::main]` 异步入口
> - `TcpListener::bind("127.0.0.1:6379")` — 6379 是 Redis 默认端口
> - 每个连接 `tokio::spawn` 一个异步任务
> - `Arc::clone` 共享数据库所有权

---

## 完整代码

```rust
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;

fn parse_resp(data: &str) -> Option<Vec<String>> {
    let mut lines = data.split("\r\n");
    let first = lines.next()?;
    if !first.starts_with('*') { return None; }
    let count: usize = first[1..].parse().ok()?;
    let mut result = Vec::with_capacity(count);
    for _ in 0..count {
        let len_line = lines.next()?;
        if !len_line.starts_with('$') { return None; }
        lines.next().map(|s| result.push(s.to_string()));
    }
    Some(result)
}

fn execute(cmd: &[String], db: &Arc<Mutex<HashMap<String, String>>>) -> String {
    if cmd.is_empty() { return "-ERR empty\r\n".into(); }
    match cmd[0].to_uppercase().as_str() {
        "SET" if cmd.len() >= 3 => {
            db.lock().unwrap().insert(cmd[1].clone(), cmd[2].clone());
            "+OK\r\n".into()
        }
        "GET" if cmd.len() >= 2 => {
            match db.lock().unwrap().get(&cmd[1]) {
                Some(v) => format!("${}\r\n{}\r\n", v.len(), v),
                None => "$-1\r\n".into(),
            }
        }
        "DEL" if cmd.len() >= 2 => {
            let r = db.lock().unwrap().remove(&cmd[1]).is_some();
            format!(":{}\r\n", if r { 1 } else { 0 })
        }
        "EXISTS" if cmd.len() >= 2 => {
            let e = db.lock().unwrap().contains_key(&cmd[1]);
            format!(":{}\r\n", if e { 1 } else { 0 })
        }
        "PING" => "+PONG\r\n".into(),
        _ => "-ERR unknown\r\n".into(),
    }
}

async fn handle_client(
    mut stream: tokio::net::TcpStream,
    db: Arc<Mutex<HashMap<String, String>>>,
) {
    let mut buffer = [0u8; 512];
    loop {
        match stream.read(&mut buffer).await {
            Ok(0) | Err(_) => return,
            Ok(n) => {
                let data = String::from_utf8_lossy(&buffer[..n]);
                if let Some(cmd) = parse_resp(&data) {
                    let resp = execute(&cmd, &db);
                    let _ = stream.write_all(resp.as_bytes()).await;
                }
            }
        }
    }
}

#[tokio::main]
async fn main() {
    let db = Arc::new(Mutex::new(HashMap::new()));
    let listener = TcpListener::bind("127.0.0.1:6379").await.unwrap();
    println!("Redis running on 127.0.0.1:6379");
    loop {
        let (stream, addr) = listener.accept().await.unwrap();
        println!("Connected: {}", addr);
        let db = Arc::clone(&db);
        tokio::spawn(handle_client(stream, db));
    }
}
```

---

## 运行与测试

启动服务器：
```bash
cargo run
```

用 `redis-cli` 测试（需安装 Redis 客户端）：
```bash
$ redis-cli
127.0.0.1:6379> SET name "Rust"
OK
127.0.0.1:6379> GET name
"Rust"
127.0.0.1:6379> EXISTS name
(integer) 1
127.0.0.1:6379> DEL name
(integer) 1
127.0.0.1:6379> GET name
(nil)
127.0.0.1:6379> PING
PONG
```

---

## 进阶挑战

1. **EXPIRE 命令**：给 key 设置过期时间，到时自动删除
2. **LIST 类型**：支持 `LPUSH`/`RPUSH`/`LRANGE` 列表操作
3. **持久化**：把数据写入文件，重启后恢复
4. **Pub/Sub**：实现发布订阅模式
5. **多线程 worker 池**：限制最大并发连接数

---

## 自检清单

- [ ] 服务器能成功启动并监听 6379 端口
- [ ] SET/GET 命令正确工作
- [ ] DEL/EXISTS 命令正确工作
- [ ] PING 返回 PONG
- [ ] 多客户端可以并发连接和操作
- [ ] redis-cli 能连上并正常交互
- [ ] 没有 `unwrap()` 在可能导致崩溃的地方

---

> 🦀 **下一个项目**：Axum Web 后端 API——用 Axum 框架构建生产级 Web 服务器！
