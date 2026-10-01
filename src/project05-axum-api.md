# 实战5：Axum Web 后端 API

> **学习目标**
> - 用 Axum 框架构建生产级 Web 服务器
> - 实现路由、JSON API、查询参数、静态文件服务
> - 掌握 async Web 开发模式
> - 理解 Rust Web 后端的技术栈选择
>
> **预计学习时长**：3-4 小时

---

## 项目概览

> 💡 **比喻**：之前实战3的手写 HTTP 服务器就像用砖头自己搭房子——每块砖都得自己砌。Axum 是现成的框架——像用预制板建房，你只需要设计户型，框架帮你搞定承重、管道、电路。

### 功能需求

1. 多路由 Web 服务器（首页、关于、API）
2. JSON REST API（GET/POST/DELETE）
3. 查询参数解析
4. 结构化日志

### 技术栈

| 组件 | 作用 | 类比 |
|------|------|------|
| Axum | Web 框架 | Python 的 FastAPI |
| Tokio | 异步运行时 | Node.js 的事件循环 / libuv |
| Serde | JSON 序列化 | Python 的 json 模块 |
| Tower-HTTP | 中间件 | Express 的 middleware |
| Tracing | 日志 | Python 的 logging |

---

## 第一步：创建项目

```bash
cargo new axum_api
cd axum_api
```

`Cargo.toml`：
```toml
[dependencies]
axum = "0.7"
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tower-http = { version = "0.5", features = ["fs", "trace"] }
tracing = "0.1"
tracing-subscriber = "0.3"
```

---

## 第二步：最小 Web 服务器

11 行代码启动一个 Web 服务器——Axum 的简洁程度令人惊叹：

```rust
use axum::{routing::get, Router};

#[tokio::main]
async fn main() {
    let app = Router::new().route("/", get(homepage));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await.unwrap();
    println!("服务器运行在 http://127.0.0.1:3000");
    axum::serve(listener, app).await.unwrap();
}

async fn homepage() -> &'static str {
    "欢迎来到我的网站！"
}
```

运行 `cargo run`，浏览器访问 `http://127.0.0.1:3000` 即可看到输出。

> 📖 **术语解释 · Router**：路由器，URL 路径和处理函数之间的映射表。`.route("/", get(homepage))` 意思是"GET / 请求来了，调用 `homepage` 函数"。

> 📖 **术语解释 · Handler（处理函数）**：处理 HTTP 请求的异步函数。本教程中 handler 都是 `async fn`（Axum 也支持返回 `IntoResponse` 的同步 fn），返回值会被自动转成 HTTP 响应。

---

## 第三步：多路由与路径参数

```rust
use axum::{routing::get, Router, extract::Path};

async fn homepage() -> &'static str {
    "首页"
}

async fn about() -> &'static str {
    "关于页面"
}

async fn user_info(Path(id): Path<u32>) -> String {
    format!("用户 ID: {}", id)
}

#[tokio::main]
async fn main() {
    let app = Router::new()
        .route("/", get(homepage))
        .route("/about", get(about))
        .route("/users/:id", get(user_info));
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
```

访问 `/users/42` 会返回 `用户 ID: 42`。

> 📖 **术语解释 · Extractor（提取器）**：Axum 自动从请求中"提取"数据的机制。`Path(id)` 从 URL 路径提取参数，`Query(params)` 从查询字符串提取，`Json(data)` 从请求体提取 JSON。

---

## 第四步：JSON REST API

这是 Axum 最擅长的场景——JSON API：

```rust
use axum::{routing::get, Router, Json, extract::Path};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

#[derive(Serialize, Deserialize, Clone)]
struct Task {
    id: u32,
    title: String,
    done: bool,
}

// 并发安全的内存存储：Arc 多任务共享 + Mutex 保证互斥
type Db = Arc<Mutex<Vec<Task>>>;

async fn list_tasks(axum::extract::State(db): axum::extract::State<Db>) -> Json<Vec<Task>> {
    Json(db.lock().unwrap().clone())
}

async fn create_task(
    axum::extract::State(db): axum::extract::State<Db>,
    Json(new_task): Json<CreateTask>,
) -> (axum::http::StatusCode, Json<Task>) {
    let mut tasks = db.lock().unwrap();
    let id = tasks.iter().map(|t| t.id).max().unwrap_or(0) + 1;
    let task = Task { id, title: new_task.title, done: false };
    tasks.push(task.clone());
    (axum::http::StatusCode::CREATED, Json(task))
}

#[derive(Deserialize)]
struct CreateTask { title: String }
```

> 📌 **要点**：`Arc<Mutex<Vec<Task>>>` 是 Rust Web 后端管理内存状态的标配——`Arc` 让多个并发请求共享同一份数据，`Mutex` 保证同一时刻只有一个请求在修改。这正是第 10 章学的组合在真实项目里的落地。

组装路由（注意 `with_state`）：

```rust
#[tokio::main]
async fn main() {
    let db: Db = Arc::new(Mutex::new(Vec::new()));
    let app = Router::new()
        .route("/api/tasks", get(list_tasks).post(create_task))
        .route("/api/tasks/:id", get(get_task).delete(delete_task))
        .with_state(db);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await.unwrap();
    println!("API 服务器运行在 http://127.0.0.1:3000");
    axum::serve(listener, app).await.unwrap();
}

async fn get_task(
    axum::extract::State(db): axum::extract::State<Db>,
    Path(id): Path<u32>,
) -> Json<Option<Task>> {
    Json(db.lock().unwrap().iter().find(|t| t.id == id).cloned())
}

async fn delete_task(
    axum::extract::State(db): axum::extract::State<Db>,
    Path(id): Path<u32>,
) -> &'static str {
    db.lock().unwrap().retain(|t| t.id != id);
    "已删除"
}
```

> 📌 **要点**：`get(list_tasks).post(create_task)` — 同一路由支持多个 HTTP 方法，链式调用。这是 REST API 的标准写法。

---

## 第五步：查询参数与状态码

```rust
use axum::extract::Query;
use axum::http::StatusCode;
use serde::Deserialize;

#[derive(Deserialize)]
struct Pagination { page: Option<u32>, per_page: Option<u32> }

async fn list_paginated(Query(p): Query<Pagination>) -> String {
    let page = p.page.unwrap_or(1);
    let per = p.per_page.unwrap_or(10);
    format!("第 {} 页，每页 {} 条", page, per)
}

async fn not_found() -> (StatusCode, &'static str) {
    (StatusCode::NOT_FOUND, "页面不存在")
}
```

访问 `/api/tasks/page?page=2&per_page=5` → `第 2 页，每页 5 条`

> 📖 **术语解释 · 状态码**：HTTP 响应的状态码。200=成功，404=未找到，500=服务器错误。Axum 中用元组 `(StatusCode, 返回值)` 返回自定义状态码。

---

## 第六步：添加日志中间件

```rust
use tower_http::trace::TraceLayer;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    let db: Db = Arc::new(Mutex::new(Vec::new()));

    let app = Router::new()
        .route("/", get(homepage))
        .route("/api/tasks", get(list_tasks).post(create_task))
        .route("/api/tasks/page", get(list_paginated))
        .layer(TraceLayer::new_for_http())  // 请求日志
        .with_state(db);

    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await.unwrap();
    println!("服务器运行在 http://127.0.0.1:3000");
    axum::serve(listener, app).await.unwrap();
}
```

> 💡 **比喻**：中间件就像酒店的安检通道——每个请求进来都先过一道安检（日志记录），然后才到达目的地（处理函数）。`TraceLayer` 自动记录每个请求的方法、路径、状态码、耗时。

---

## 完整代码

```rust
use axum::{
    routing::get,
    Router, Json, extract::{Path, Query, State},
    http::StatusCode,
};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tower_http::trace::TraceLayer;

#[derive(Serialize, Deserialize, Clone)]
struct Task { id: u32, title: String, done: bool }

#[derive(Deserialize)]
struct CreateTask { title: String }

#[derive(Deserialize)]
struct Pagination { page: Option<u32>, per_page: Option<u32> }

type Db = Arc<Mutex<Vec<Task>>>;

async fn homepage() -> &'static str {
    "API 运行中。路由: GET /api/tasks, POST /api/tasks, GET /api/tasks/:id"
}

async fn list_tasks(State(db): State<Db>) -> Json<Vec<Task>> {
    Json(db.lock().unwrap().clone())
}

async fn create_task(
    State(db): State<Db>,
    Json(input): Json<CreateTask>,
) -> (StatusCode, Json<Task>) {
    let mut tasks = db.lock().unwrap();
    let id = tasks.iter().map(|t| t.id).max().unwrap_or(0) + 1;
    let task = Task { id, title: input.title, done: false };
    tasks.push(task.clone());
    (StatusCode::CREATED, Json(task))
}

async fn get_task(State(db): State<Db>, Path(id): Path<u32>) -> Json<Option<Task>> {
    Json(db.lock().unwrap().iter().find(|t| t.id == id).cloned())
}

async fn delete_task(State(db): State<Db>, Path(id): Path<u32>) -> &'static str {
    db.lock().unwrap().retain(|t| t.id != id);
    "已删除"
}

async fn list_paginated(Query(p): Query<Pagination>) -> String {
    format!("第 {} 页，每页 {} 条", p.page.unwrap_or(1), p.per_page.unwrap_or(10))
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    let db: Db = Arc::new(Mutex::new(vec![
        Task { id: 1, title: "学Rust".into(), done: false },
        Task { id: 2, title: "写API".into(), done: true },
    ]));
    let app = Router::new()
        .route("/", get(homepage))
        .route("/api/tasks", get(list_tasks).post(create_task))
        .route("/api/tasks/:id", get(get_task).delete(delete_task))
        .route("/api/tasks/page", get(list_paginated))
        .layer(TraceLayer::new_for_http())
        .with_state(db);
    let listener = tokio::net::TcpListener::bind("127.0.0.1:3000").await.unwrap();
    println!("Server running on http://127.0.0.1:3000");
    axum::serve(listener, app).await.unwrap();
}
```

---

## 运行与测试

```bash
cargo run
```

用 curl 测试 API：

```bash
# 首页
curl http://127.0.0.1:3000/

# 获取任务列表
curl http://127.0.0.1:3000/api/tasks

# 创建任务（然后再 GET 列表，能看到新任务！）
curl -X POST http://127.0.0.1:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"学WASM"}'

curl http://127.0.0.1:3000/api/tasks

# 获取单个任务
curl http://127.0.0.1:3000/api/tasks/1

# 分页查询
curl "http://127.0.0.1:3000/api/tasks/page?page=2&per_page=5"
```

---

## 进阶挑战

1. **持久化**：用 `sled` 或 `SQLite` 替换内存存储
2. **认证**：用 `axum-extra` 实现 JWT 认证中间件
3. **静态文件**：用 `tower_http::services::ServeDir` 提供 HTML/CSS/JS 静态服务
4. **WebSocket**：用 `axum::extract::ws::WebSocket` 实现实时通信
5. **模板渲染**：用 `askama` crate 做服务端 HTML 渲染

---

## 自检清单

- [ ] 服务器能启动并响应请求
- [ ] GET /api/tasks 返回 JSON 任务列表
- [ ] POST /api/tasks 能创建新任务
- [ ] 路径参数 `/api/tasks/:id` 能正确提取
- [ ] 查询参数 `?page=2&per_page=5` 能正确解析
- [ ] 日志中间件输出了请求信息
- [ ] 代码没有 unsafe（除教学简化外）

---

> 🦀 **恭喜你完成了全部 5 个实战项目！** 从 CLI 工具到文件处理到 Web 服务器到 Redis 到 Web API，你已经在 Rust 的主要应用方向上都有了实战经验。
