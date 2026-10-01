# 附录D：术语中英对照表

> 查官方文档、看英文报错、逛 Reddit 和 Stack Overflow 时，中文术语经常对不上号。这张表覆盖全书核心术语，**左边中文，右边英文**——看到英文就知道在说啥。

## 一、语言基础（第1-2章）

| 中文 | 英文 | 一句话解释 |
|------|------|-----------|
| 绑定 | binding | `let x = 5` 这个动作 |
| 不可变性 | immutability | 变量默认"上锁"，改值要 `mut` |
| 遮蔽 | shadowing | 同名新变量覆盖旧变量，类型可不同 |
| 表达式 | expression | 能产生值的代码片段（Rust 里大半代码都是） |
| 语句 | statement | 执行动作、返回 `()` 的代码 |
| 作用域 | scope | 变量可见范围（一对花括号） |
| 宏 | macro | 编译期"写代码的代码"，调用带 `!` |
| 属性 | attribute | `#[...]` 注解（如 `#[derive(Debug)]`） |

## 二、所有权体系（第3章，最重要）

| 中文 | 英文 | 一句话解释 |
|------|------|-----------|
| 所有权 | ownership | 每个值有且只有一个所有者 |
| 所有者 | owner | 负责释放值内存的变量 |
| 移动 | move | 所有权"交钥匙"，原变量作废 |
| 复制 | copy | 栈字节拷贝，双方独立（整数等小类型） |
| 深拷贝 | clone | 连堆数据一起复制一份 |
| 借用 | borrowing | 通过引用使用值，不拿走所有权 |
| 引用 | reference | `&T` / `&mut T` |
| 悬垂引用 | dangling reference | 指向已释放内存的引用（Rust 编译期杜绝） |
| 借用检查器 | borrow checker | 编译器里查借用的"宿管阿姨" |
| 切片 | slice | `&str` / `&[T]`：数据的一段"视图" |

## 三、数据类型（第4-5章）

| 中文 | 英文 | 一句话解释 |
|------|------|-----------|
| 结构体 | struct | 把相关字段打包的"简历模板" |
| 枚举 | enum | 表达"多种可能"的类型 |
| 变体 | variant | 枚举的某一个分支 |
| 元组 | tuple | 固定长度、可混装类型的小包裹 |
| 模式匹配 | pattern matching | `match` 按形状拆值 |
| 穷尽性检查 | exhaustiveness checking | 漏一个分支编译器不放行 |
| 关联函数 | associated function | `Struct::new()` 这种没有 `self` 的函数 |
| 方法 | method | 第一个参数是 `self` 的函数 |
| 结构体更新语法 | struct update syntax | `..base` 接管剩余字段 |

## 四、集合与错误处理（第6章）

| 中文 | 英文 | 一句话解释 |
|------|------|-----------|
| 动态数组 | Vec | 能自动扩容的数组 |
| 键值表 | HashMap | 键值对存储，类似 Python dict |
| 恐慌 | panic | 不可恢复错误，程序直接退出 |
| 可恢复错误 | recoverable error | 用 `Result` 表达的"还能救"的错误 |
| 错误传播 | error propagation | `?` 把错误自动上抛给调用者 |

## 五、泛型与 Trait（第7章）

| 中文 | 英文 | 一句话解释 |
|------|------|-----------|
| 泛型 | generics | 一套逻辑适配多种类型 |
| 单态化 | monomorphization | 编译期为每个具体类型生成专用代码 |
| 特征 | trait | 类型的"能力清单" |
| 约束 | bound | `T: Trait` 限制泛型必须有什么能力 |
| 特征对象 | trait object | `dyn Trait`，运行期定类型的接口 |
| 孤儿规则 | orphan rule | trait 或类型至少一个是本 crate 的才能 impl |
| Newtype 模式 | newtype pattern | 单字段元组结构体包装，赋予类型语义 |

## 六、生命周期与闭包（第8章）

| 中文 | 英文 | 一句话解释 |
|------|------|-----------|
| 生命周期 | lifetime | 引用有效的存活范围 |
| 生命周期标注 | lifetime annotation | `'a`：描述引用间的关系，不改变寿命 |
| 省略规则 | elision rules | 三条自动推断规则，多数场景不用手写 |
| 闭包 | closure | `\|x\| x + 1` 能捕获环境的匿名函数 |
| 捕获 | capture | 闭包"记住"外部变量的方式 |

## 七、迭代器与模块（第9章）

| 中文 | 英文 | 一句话解释 |
|------|------|-----------|
| 迭代器 | iterator | 按序访问集合的流水线 |
| 适配器 | adapter | `map`/`filter` 等变换流水线的方法 |
| 消费器 | consumer | `sum`/`collect` 等真正"开工"的方法 |
| 惰性 | lazy | 不消费就不执行 |
| 模块 | module | `mod` 组织代码的"部门" |
| 可见性 | visibility | `pub` 公开，默认私有 |
| 路径 | path | `self`/`super`/`crate` 三个起点 |

## 八、智能指针与并发（第10章）

| 中文 | 英文 | 一句话解释 |
|------|------|-----------|
| 智能指针 | smart pointer | 带管理策略的指针（Box/Rc/Arc/Mutex…） |
| 引用计数 | reference counting | Rc/Arc：记住几个所有者，归零释放 |
| 内部可变性 | interior mutability | RefCell/Mutex：看起来不可变，内部可改 |
| 数据竞争 | data race | 多线程同时读写同一数据（Rust 编译期杜绝） |
| 线程安全的 | thread-safe | Arc 是，Rc 不是 |
| 调度器 | scheduler | tokio 决定哪个任务先跑的"排班表" |

## 九、测试与工程（第11、16章）

| 中文 | 英文 | 一句话解释 |
|------|------|-----------|
| 单元测试 | unit test | `#[cfg(test)]` 模块里的小测试 |
| 集成测试 | integration test | `tests/` 目录，从外部测公开接口 |
| 断言 | assertion | `assert!` / `assert_eq!` / `assert_ne!` |
| 工作空间 | workspace | 多个 crate 在一个屋檐下统一构建 |
| 条件编译 | conditional compilation | `#[cfg(feature = "x")]` |
| 语义化版本 | semantic versioning | `1.2.3` = 主版本.次版本.修订号 |

## 十、Unsafe 与应用方向（第12-17章）

| 中文 | 英文 | 一句话解释 |
|------|------|-----------|
| 不安全代码 | unsafe code | 编译器不检查、程序员自己负责 |
| 裸指针 | raw pointer | `*const T` / `*mut T`，无借用检查 |
| 外部函数接口 | FFI | Rust 调 C / C 调 Rust 的翻译官 |
| 联合体 | union | 多字段共享同一段内存（unsafe） |
| 栈 | stack | 大小已知、自动管理、快 |
| 堆 | heap | 动态分配、所有权系统管理 |
| 内存布局 | memory layout | 数据在栈/堆上的真实摆放 |
| WebAssembly | WASM | Rust 编译进浏览器的字节码 |
| 推理 | inference | 用训练好的模型算答案（生产阶段） |
| 训练 | training | 教模型学东西（研究阶段） |

> 💡 **技巧**：看到不认识的英文术语，先来这张表扫一眼；表里没有的，直接在 [官方术语列表](https://doc.rust-lang.org/std/index.html#Modules) 或 cheats.rs 里搜。
