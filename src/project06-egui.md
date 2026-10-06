# 实战6：egui 桌面 GUI 应用

> **学习目标**
> - 理解"立即模式（immediate mode）GUI"的核心思想
> - 用 eframe + egui 写出一个能交互的桌面窗口程序
> - 掌握"状态放在 struct 字段、每帧重画"的 GUI 编程模型
> - 会用常见控件：文本框、滑块、按钮、复选框、列表
>
> **预计学习时长**：2-3 小时

---

## 项目概览

> **比喻**：之前的实战都是"命令行里打字、屏幕上吐字"。这一章我们做**带窗口、能点按钮**的桌面程序——就像从"发电报"升级到"用 App"。egui 是 Rust 里最容易上手的 GUI 库：你不用拖控件、不用学 XML 布局，写几行 Rust 就出一个窗口。

### 功能需求

我们要做一个**迷你个人面板**，把前面学的所有权、结构体、Vec、String 全用上：

1. 一个窗口，顶部显示问候语
2. 名字输入框 + 年龄滑块（改了立刻反映在问候语里）
3. 一个计数器（按钮 +1 / -1）
4. 一个待办清单（输入框添加、按钮删除）

### 技术栈

| 组件 | 作用 | 类比 |
|------|------|------|
| egui | 立即模式 GUI 库，负责画按钮/文本框/滑块 | 前端的 React 组件（但更轻） |
| eframe | egui 的"应用框架"，提供窗口壳、事件循环 | 把 egui 装进一个真正能跑的桌面窗口 |

> 📖 **术语解释 · 立即模式 GUI（Immediate Mode）**：传统 GUI（如 Qt、GTK）是"保留模式"——你先创建一堆控件对象存着，改数据再去更新它们。egui 是**立即模式**：每一帧（每秒约 60 次）都把"画界面"的代码从头跑一遍，界面就是这段代码此刻的输出。没有"控件对象"要你管理，没有数据绑定——**状态就是你 struct 里的字段，UI 是它的镜子**。代价是每次重画都执行一遍 UI 代码，但 egui 极快，几十个控件毫无压力。

> 📌 **要点**：egui 应用需要本地有图形环境（Windows / macOS / Linux 桌面）。它**无法**在服务器无头环境或浏览器里直接跑——这正是它和本书第 16 章 WebAssembly（Rust 进浏览器）的区别。想让 egui 跑在网页上，需要额外用 `eframe` 的 Web 目标编译成 WASM。

> 📌 **版本说明**：本教程基于 **eframe 0.36（egui 0.36.2）** 的 API 编写。egui 迭代极快、每个版本都有破坏性变更，最关键的变化是 **`App` 的方法从 `update(ctx, frame)` 改名为 `ui(ui, frame)`**——新版直接把 `&mut egui::Ui` 传给你（不再先传 `Context`、再 `CentralPanel::show(ctx, …)`），需要全局上下文时用 `ui.ctx()` 获取。如果你拉到其它版本，以 `docs.rs/eframe` 对应版本的 `eframe::App` trait 为准。教学核心（状态在 struct、每帧重画）始终不变。

---

## 第一步：创建项目

```bash
cargo new egui_panel
cd egui_panel
```

`Cargo.toml`：

```toml
[package]
name = "egui_panel"
version = "0.1.0"
edition = "2024"

[dependencies]
eframe = "0.36"
```

> 📌 **关于版本**：`eframe = "0.36"` 会拉到 0.36.x 的最新补丁（含 0.36.2）。egui/eframe 要求较新的 Rust 工具链（egui 0.36 需 Rust 1.95+），请先 `rustup update` 确保工具链够新。

---

## 第二步：最小 egui 应用

11 行就能弹出一个窗口——这就是 egui 的爽点：

```rust
use eframe::egui;

fn main() -> eframe::Result {
    let options = eframe::NativeOptions::default();
    eframe::run_native(
        "我的第一个 egui 应用",
        options,
        Box::new(|_cc| Ok(Box::new(MyApp::default()))),
    )?;
    Ok(())
}

#[derive(Default)]
struct MyApp {
    name: String,
}

impl eframe::App for MyApp {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        egui::CentralPanel::default().show(ui, |ui| {
            ui.heading("你好，egui！");
            ui.label("把状态放在 struct 字段里，每帧都重画我。");
        });
    }
}
```

运行 `cargo run`，会弹出一个窗口，里面写着"你好，egui！"。

> 📖 **术语解释 · `eframe::App` trait**：你写的 `MyApp` 要实现这个 trait，核心就是 `ui` 方法——**每一帧被调用一次**，你在这里用 `ui` 画出当前界面。第一个参数 `ui` 就是当前帧的 UI 句柄，你直接在它上面加控件；要拿全局上下文 `ctx`（改字体、开深色模式等）时用 `ui.ctx()`；`_frame` 是窗口句柄（改窗口大小、全屏等用）。
>
> 📖 **术语解释 · `run_native`**：eframe 提供的入口函数——它帮你创建系统窗口、启动事件循环、每帧调用你的 `ui`。第三个参数是个闭包，负责"创建 App 实例"，`Ok(Box::new(MyApp::default()))` 表示用默认值初始化（闭包拿到 `_cc: &CreationContext`，可用于读取持久化数据或定制 egui）。注意 `run_native` 返回 `Result<(), eframe::Error>`，示例用 `?` 把启动错误向上传播（你已在第 6 章学过 `?`）。

---

## 第三步：加交互状态（文本框 + 滑块 + 按钮）

GUI 的"状态"就是 struct 里的字段。我们在 `MyApp` 里加 `name` 和 `age`，界面上用控件修改它们：

```rust
use eframe::egui;

fn main() -> eframe::Result {
    let options = eframe::NativeOptions::default();
    eframe::run_native(
        "我的第一个 egui 应用",
        options,
        Box::new(|_cc| Ok(Box::new(MyApp::default()))),
    )?;
    Ok(())
}

#[derive(Default)]
struct MyApp {
    name: String,
    age: u32,
}

impl eframe::App for MyApp {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        egui::CentralPanel::default().show(ui, |ui| {
            ui.heading("你好，egui！");

            // horizontal：让"标签 + 输入框"排在同一行
            ui.horizontal(|ui| {
                ui.label("你的名字：");
                ui.text_edit_singleline(&mut self.name);
            });

            // Slider：滑块，范围 0..=120，.text 是左边的说明文字
            ui.add(egui::Slider::new(&mut self.age, 0..=120).text("年龄"));

            if ui.button("加一岁").clicked() {
                self.age += 1;
            }

            // 问候语会随 name / age 实时变化——因为它每帧都重画
            ui.label(format!("你好 '{}'，你 {} 岁了", self.name, self.age));
        });
    }
}
```

试着在输入框打字、拖滑块、点按钮——问候语会**立刻**跟着变。这就是立即模式的精髓：**你从没"更新"过哪个控件，控件只是 struct 当前状态的一张快照**。

> 💡 **技巧**：`ui.button("加一岁").clicked()` 返回 `true` 表示这一帧用户点了按钮。`if ... { self.age += 1; }` 直接改 struct 字段——下一帧重画时新值就显示出来了。所有交互都是这个套路：`&mut self.xxx` 把字段的可变引用交给控件，控件替你改。

---

## 第四步：加功能（计数器 + 待办清单）

再加两个常用场景，展示"可变状态"怎么在 GUI 里玩：一个 `i32` 计数器、一个 `Vec<String>` 待办清单。

```rust
use eframe::egui;

fn main() -> eframe::Result {
    let options = eframe::NativeOptions::default();
    eframe::run_native(
        "我的第一个 egui 应用",
        options,
        Box::new(|_cc| Ok(Box::new(MyApp::default()))),
    )?;
    Ok(())
}

#[derive(Default)]
struct MyApp {
    name: String,
    age: u32,
    counter: i32,
    todo_input: String,
    todos: Vec<String>,
}

impl eframe::App for MyApp {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        egui::CentralPanel::default().show(ui, |ui| {
            ui.heading("你好，egui！");

            ui.horizontal(|ui| {
                ui.label("你的名字：");
                ui.text_edit_singleline(&mut self.name);
            });
            ui.add(egui::Slider::new(&mut self.age, 0..=120).text("年龄"));
            if ui.button("加一岁").clicked() {
                self.age += 1;
            }
            ui.label(format!("你好 '{}'，你 {} 岁了", self.name, self.age));

            ui.separator(); // 分割线

            // 计数器
            ui.heading("计数器");
            ui.horizontal(|ui| {
                if ui.button("+1").clicked() { self.counter += 1; }
                if ui.button("-1").clicked() { self.counter -= 1; }
                ui.label(format!("当前：{}", self.counter));
            });

            ui.separator();

            // 待办清单
            ui.heading("待办清单");
            ui.horizontal(|ui| {
                ui.text_edit_singleline(&mut self.todo_input);
                if ui.button("添加").clicked() {
                    let text = self.todo_input.trim().to_string();
                    if !text.is_empty() {
                        self.todos.push(text);   // Vec<String>：动态数组（第 6 章）
                        self.todo_input.clear();  // 清空输入框
                    }
                }
            });

            // 遍历显示，每行一个"✓"删除按钮
            // 注意：不能在遍历 self.todos 时直接 remove（借用冲突），
            // 先记下要删的下标，循环结束后再删
            let mut to_remove: Option<usize> = None;
            for (i, item) in self.todos.iter().enumerate() {
                ui.horizontal(|ui| {
                    ui.label(format!("{}. {}", i + 1, item));
                    if ui.button("✓").clicked() {
                        to_remove = Some(i);
                    }
                });
            }
            if let Some(i) = to_remove {
                self.todos.remove(i);
            }
        });
    }
}
```

> 📌 **要点（借用检查的实战）**：上面"先记 `to_remove`、循环后再 `remove`"不是多此一举——`for item in self.todos.iter()` 借用了 `self.todos` 的不可变引用，此时**不能再** `self.todos.remove(i)`（可变借用），编译器会报 E0502。先把要删的下标存进局部变量，等循环结束、不可变借用释放，再删。这正是第 3 章"借用规则"在真实 GUI 代码里的体现。

---

## 完整代码

把上面四步拼起来就是完整可运行版（复制进 `src/main.rs` 直接 `cargo run`）：

```rust
use eframe::egui;

fn main() -> eframe::Result {
    let options = eframe::NativeOptions::default();
    eframe::run_native(
        "我的第一个 egui 应用",
        options,
        Box::new(|_cc| Ok(Box::new(MyApp::default()))),
    )?;
    Ok(())
}

#[derive(Default)]
struct MyApp {
    name: String,
    age: u32,
    counter: i32,
    todo_input: String,
    todos: Vec<String>,
}

impl eframe::App for MyApp {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        egui::CentralPanel::default().show(ui, |ui| {
            ui.heading("你好，egui！");

            ui.horizontal(|ui| {
                ui.label("你的名字：");
                ui.text_edit_singleline(&mut self.name);
            });
            ui.add(egui::Slider::new(&mut self.age, 0..=120).text("年龄"));
            if ui.button("加一岁").clicked() {
                self.age += 1;
            }
            ui.label(format!("你好 '{}'，你 {} 岁了", self.name, self.age));

            ui.separator();

            ui.heading("计数器");
            ui.horizontal(|ui| {
                if ui.button("+1").clicked() { self.counter += 1; }
                if ui.button("-1").clicked() { self.counter -= 1; }
                ui.label(format!("当前：{}", self.counter));
            });

            ui.separator();

            ui.heading("待办清单");
            ui.horizontal(|ui| {
                ui.text_edit_singleline(&mut self.todo_input);
                if ui.button("添加").clicked() {
                    let text = self.todo_input.trim().to_string();
                    if !text.is_empty() {
                        self.todos.push(text);
                        self.todo_input.clear();
                    }
                }
            });

            let mut to_remove: Option<usize> = None;
            for (i, item) in self.todos.iter().enumerate() {
                ui.horizontal(|ui| {
                    ui.label(format!("{}. {}", i + 1, item));
                    if ui.button("✓").clicked() {
                        to_remove = Some(i);
                    }
                });
            }
            if let Some(i) = to_remove {
                self.todos.remove(i);
            }
        });
    }
}
```

---

## 运行

```bash
cargo run
```

窗口会弹出来。试着：
- 在名字框打字，问候语实时变化
- 拖年龄滑块，点"加一岁"按钮
- 在待办框输入文字、点"添加"，再用每行的"✓"删除

> ⚠️ **新手坑（Linux）**：egui 在 Linux 上需要系统图形库，首次 `cargo run` 若报缺库，先装：
> ```bash
> sudo apt-get install -y libxkbcommon-dev libssl-dev libxcb-shape0-dev \
>   libxcb-xfixes0-dev libgtk-3-dev pkg-config
> ```
> Windows / macOS 通常开箱即用，不需要额外装库。

---

## 进阶挑战

1. **持久化**：在 `Cargo.toml` 开启 `eframe` 的 `persistence` feature，用 `App::save` 把状态写入 `cc.storage`；下次启动时在 `new(cc)` 里用 `cc.storage.get_value(...)` 读回（见 `docs.rs/eframe` 的 `Storage` trait）
2. **深色模式**：在 `ui` 里加个按钮，触发 `ui.ctx().set_visuals(egui::Visuals::dark())` 切换主题（注意：新版 `ctx` 要用 `ui.ctx()` 拿）
3. **复选框**：给待办项加 `bool done` 字段，用 `ui.checkbox(&mut item.done, "")` 标记完成
4. **更多控件**：试试 `ui.add(egui::ComboBox::from_label("选择").add_option("A"))` 下拉框、`ui.image(...)` 显示图片
5. **Web 版**：用 `trunk` + `eframe` 的 Web 目标，把同一个应用编译成网页（呼应第 16 章 WebAssembly）

---

## 自检清单

- [ ] 我能说出"立即模式 GUI"和"保留模式 GUI"的区别
- [ ] 我理解状态放在 struct 字段、每帧重画的含义
- [ ] 我能写出 `impl eframe::App` 的 `ui` 方法（注意新版直接收 `ui`）
- [ ] 窗户能弹出来并显示问候语
- [ ] 名字输入框和年龄滑块能实时改变界面
- [ ] 计数器 +1 / -1 工作正常
- [ ] 待办清单能添加和删除
- [ ] 我知道为什么删除前要先记下标（借用规则）

---

> 🦀 **恭喜你完成了全部 6 个实战项目！** 从 CLI 工具到文件处理到 Web 服务器到 Redis 到 Web API 再到今天的桌面 GUI——你已经在 Rust 的 CLI、网络、并发、Web、GUI 等主要应用方向上都留下了实战足迹。下一步，带着这些手感去读 TRPL 和官方文档，往更深的系统编程、嵌入式、游戏、AI 方向探索吧！
