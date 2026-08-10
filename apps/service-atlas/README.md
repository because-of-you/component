# Service Atlas

这是一个无边框的运行时知识图谱：服务是图谱节点，调用依赖是流动的连线，点击可直接前往对应服务。它只表达导航与运行时调用关系，不负责健康检查、状态监控或调用追踪。

## 本地预览

在仓库根目录运行：

```bash
python3 -m http.server 4173 --directory apps/service-atlas
```

然后打开 <http://127.0.0.1:4173/>。

## 添加组件

在 `src/catalogue.mjs` 的 `services` 中增加一条记录：

```js
{
  id: "example",
  name: "Example",
  href: "https://example.com",
  landmark: "application",
}
```

- `id`：全局唯一标识。
- `name`：地图上显示的名称。
- `href`：可选跳转地址；外部 URL 会经过安全校验。
- `landmark`：组件的语义类别，方便后续扩展图谱表现。

不需要维护坐标：运行时关系会自动生成稳定的从左到右分层布局，界面也会根据连接数量自动区分枢纽、重要和标准节点。

## 添加调用关系

在同一文件的 `relations` 中增加一条记录：

```js
{
  source: "example",
  target: "postgresql",
  type: "data",
}
```

`source` 与 `target` 对应服务 `id`，调用方向会直接决定自动布局的层级。支持的关系类型为 `route`、`authentication`、`data`、`cache` 和 `message`。

当前页面使用易于替换的 mock 目录数据，不要求 Kubernetes，也不依赖自动发现；后续可以由配置文件或服务清单生成同样的数据结构，因此扩展组件和关系只需维护目录数据。

## 测试

```bash
node --test apps/service-atlas/tests/*.test.mjs
```
