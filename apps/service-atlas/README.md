# Service Atlas

这是一个无边框的运行时知识图谱：服务是图谱节点，调用依赖是流动的连线，点击可直接前往对应服务。它只表达导航与运行时调用关系，不负责健康检查、状态监控或调用追踪。

## 本地预览

在仓库根目录运行：

```bash
npm install
npm run dev -- --port 4173
```

然后打开 <http://127.0.0.1:4173/>。生产构建可运行 `npm run build`。

## 添加组件

在 `public/config/catalogue.json` 的 `services` 中增加一条记录：

```js
{
  id: "example",
  name: "Example",
  href: "https://example.com",
  landmark: "application",
  tier: "application",
  color: "#a782f4",
}
```

- `id`：全局唯一标识。
- `name`：地图上显示的名称。
- `href`：可选跳转地址；外部 URL 会经过安全校验。
- `landmark`：组件的语义类别，方便后续扩展图谱表现。
- `tier`：组件所属领域层，可选值为 `ingress`（接入层）、`application`（应用服务）、`identity`（身份与权限）、`middleware`（中间件）和 `data`（数据与存储）。
- `color`：可选的六位十六进制节点色；未设置时使用 `landmark` 对应的默认色。

不需要维护坐标：页面会按照 `tier` 生成五个固定领域列，并把同层节点自动分配到纵向等距槽位。Graphviz `neato` 基于这些最终节点位置生成原生样条曲线，因此节点增加后仍能保持稳定分层和自动布线。布局结果按目录内容缓存，不会持续占用主线程计算；界面仍会根据连接数量自动区分枢纽、重要和标准节点。

## 添加调用关系

在同一文件的 `relations` 中增加一条记录：

```js
{
  source: "example",
  target: "postgresql",
  type: "data",
}
```

`source` 与 `target` 对应服务 `id`，调用方向只表达运行时数据流向；节点所在的领域层由服务自身的 `tier` 决定。支持的关系类型为 `route`、`authentication`、`data`、`cache` 和 `message`。

## 添加流量场景

在 `flows` 中配置需要低频轮播的调用路径：

```json
{
  "id": "login",
  "name": "登录链路",
  "path": ["traefik", "authelia", "lldap"],
  "return": true
}
```

相邻节点之间必须存在调用关系；关系可以反向复用，播放器会记录实际道路方向。`return: true` 会在正向完成后沿原路返回。浏览器每次加载都会以 `no-store` 读取外部 JSON，修改配置不需要重新编译源代码。

当前页面使用易于替换的 mock 目录数据，不要求 Kubernetes，也不依赖自动发现；后续可以由配置文件或服务清单生成同样的数据结构，因此扩展组件和关系只需维护目录数据。

## 自动部署

dev 环境通过 `https://atlas.acitrus.cn` 提供。合并 `apps/service-atlas`、对应 Chart 或环境 values
的修改后，GitHub Actions 会自动验证前端、构建并发布 SHA 镜像、通过 Helmfile 部署到 K3s，最后
检查外部健康端点。线上目录维护在 `environments/dev/service-atlas/values.yaml`；完整流程见
`deploy/DEPLOYMENT.md`。

## 测试

```bash
npm run test:atlas
```
