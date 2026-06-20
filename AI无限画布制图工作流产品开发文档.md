# AI 无限画布制图工作流产品开发文档

版本：v0.1  
目标读者：AI 开发者、前端工程师、MCP/插件开发者、产品设计者  
推荐底层：tldraw + React + Node.js MCP Server + Codex Skill/Plugin + Codex image 2.0 生图能力  

---

## 1. 项目概述

本项目要实现一套类似“AI 设计协作画布”的工作流：用户在 Codex 中打开一个本地无限画布，在画布里创建图片占位框，Codex 根据用户需求调用 Codex 内置的 image 2.0 生图模型生成图片，并将生成结果自动放入画布。用户可以继续在画布上用箭头、文字、圈选、手绘标注等方式指出修改意见，Codex 再读取这些标注，将其转换成结构化修图指令，调用 image 2.0 进行图片修复、重绘或局部修改，最后把新版图片重新放回无限画布中。

这个产品不是单纯的“生图工具”，而是一个面向多轮视觉创作的本地工作台。它将无限画布、AI 生图、AI 修图、视觉标注、版本管理、素材管理、Codex 自动化流程组合起来，让用户可以像设计总监一样通过画布进行反馈，而不是反复用文字描述“左边一点”“那个碗旁边”“右上角的元素”。

### 1.1 项目目标

1. 用户可以在 Codex 中一键打开本地无限画布。
2. 用户可以在画布中创建图片占位框，并指定尺寸比例。
3. Codex 可以识别当前选中的占位框，并根据尺寸自动生成合适比例的图片。
4. 生成图片自动保存到当前画布项目的 assets 目录。
5. 生成图片自动插入到画布中的目标占位框。
6. 用户可以在画布中用箭头、文字、圈选、画笔等方式对图片做修改标注。
7. Codex 可以读取标注，并把标注意图转换为结构化修图指令。
8. Codex 调用 image 2.0 对图片进行修改。
9. 修改后的图片作为新版本插入画布，旧版本保留。
10. 每次生成、修改、标注解析、prompt、输入输出路径都可追溯。

### 1.2 参考体验

用户期望的参考体验如下：

1. 在 Codex 中说：“打开 AI 画布。”
2. Codex 调用本地工具，启动无限画布服务，并在右侧 in-app browser 打开画布。
3. 用户在画布中创建一个名为“AI 图片”的占位框。
4. 用户对 Codex 说：“生成一个拉面品牌广告。”
5. Codex 读取占位框尺寸，调用 image 2.0 生成广告图。
6. Codex 把图片保存到本地 canvas assets，并插入到占位框。
7. 用户在画布中画箭头，写文字：“这里用白汤”“碗小一点展示”。
8. 用户对 Codex 说：“根据标注修改。”
9. Codex 读取画布中的箭头和文字，判断它们指向图片的哪些区域。
10. Codex 将标注转换为修图 prompt，调用 image 2.0 生成新版。
11. 新版图片放回画布，旧版和标注保留，用户可以继续迭代。

---

## 2. 产品定位

### 2.1 一句话定位

一个 Codex 可调用的本地 AI 无限画布，用于多轮图片生成、视觉标注、AI 修图和版本管理。

### 2.2 核心用户

1. 运营人员：快速生成广告图、电商主图、公众号封面、小红书封面。
2. 设计师：用 AI 起草视觉方向，再通过标注迭代细节。
3. 创业者或独立开发者：快速制作产品宣传图、落地页视觉图、社交媒体素材。
4. AI 工作流开发者：将 Codex、MCP、image 2.0 和无限画布组合成可复用业务流程。

### 2.3 关键价值

1. 降低表达成本：用户直接在图片上标注，不需要用复杂语言描述位置。
2. 降低返工成本：每一版图片和 prompt 都保留，方便回退。
3. 提升视觉迭代效率：从“文字聊天式生图”变成“画布协作式创作”。
4. 提升自动化能力：Codex 可以理解画布状态，主动调用工具完成操作。
5. 易于扩展：可继续扩展品牌资产库、模板库、导出器、云同步、多人协作。

---

## 3. 系统形态

本系统推荐做成一个 Codex Plugin，而不是只做一个 Skill。

原因：

1. Skill 只适合承载“工作流说明”和“操作规程”。
2. 无限画布需要真实的 Web 前端，需要本地服务。
3. 读取选区、写入图片、保存素材、解析标注，需要可调用工具。
4. MCP Server 适合把这些本地工具暴露给 Codex。
5. Plugin 适合把 Skill、MCP Server、Canvas App、配置文件打包成一个完整可安装能力。

推荐分层如下：

```text
Codex
  |
  | 读取 Skill 说明，决定何时调用工具
  v
Codex Skill: ai-canvas-art-director
  |
  | 调用本地 MCP tools
  v
MCP Server: ai-canvas-mcp
  |
  | 读写画布状态、启动服务、管理资产
  v
Local Canvas Service
  |
  | React + tldraw
  v
Infinite Canvas UI
  |
  | 保存 snapshot、assets、runs
  v
Local Project Storage
  |
  | 通过 Codex image 2.0 adapter 生成或编辑图片
  v
Codex image 2.0
```

---

## 4. 推荐开源底层

### 4.1 首选：tldraw

推荐使用 tldraw 作为无限画布底层。

理由：

1. 支持无限画布。
2. 支持图片、文本、箭头、手绘、形状、选择框。
3. 数据模型清晰，shape、asset、page、bindings 等结构适合 AI 工具读取。
4. 适合做二次开发，可以增加自定义 shape、自定义 toolbar、自定义 side panel。
5. 视觉和交互与参考案例高度接近。
6. 支持保存和加载 editor snapshot。

注意：

1. tldraw 在生产环境使用时需要关注授权。
2. 如果只是本地个人开发或内部原型，tldraw 可以快速验证。
3. 如果要商业化分发，需要确认 tldraw license。

### 4.2 备选：Excalidraw

如果希望采用更自由的开源协议，可以考虑 Excalidraw。

优点：

1. 白板体验成熟。
2. React 嵌入方便。
3. 社区成熟。
4. 适合标注、草图和简单图片工作流。

缺点：

1. 对自定义业务 shape 的支持不如 tldraw 顺手。
2. 数据模型更偏通用白板，不如 tldraw 适合做精细的自动化画布读写。
3. 若要实现图片 holder、标注绑定、资产管理，需要更多自定义逻辑。

### 4.3 不推荐从零实现

不建议用 Canvas API、Fabric.js 或 Konva.js 从零实现完整无限画布，除非团队有足够前端图形编辑器经验。

从零实现会涉及：

1. 无限坐标系。
2. 缩放和平移。
3. 选择框和多选。
4. 文本编辑。
5. 箭头和绑定。
6. 图片拖拽和缩放。
7. 图层顺序。
8. 撤销/重做。
9. 快捷键。
10. 持久化。

这些工作量会显著拖慢业务验证。

---

## 5. 用户体验设计

### 5.1 首次打开画布

用户输入：

```text
打开 AI 画布
```

Codex 行为：

1. 读取当前工作区路径。
2. 判断本地 AI Canvas 服务是否已启动。
3. 如果未启动，调用 `open_canvas` 工具启动服务。
4. 创建或读取默认画布目录。
5. 在 Codex in-app browser 打开本地 URL。
6. 返回画布 URL、保存路径、当前 canvas id。

用户看到：

```text
已打开 AI Canvas：
http://127.0.0.1:43218/

当前画布数据保存于：
/path/to/project/.ai-canvas/canvases/<canvas-id>/
```

### 5.2 创建图片占位框

用户可以通过两种方式创建图片占位框。

方式一：画布 UI 创建

1. 用户点击工具栏中的“图片占位框”工具。
2. 在画布上拖拽出一个矩形区域。
3. 占位框默认标题为“AI 图片”。
4. 占位框有浅色边框、尺寸标签和可编辑名称。

方式二：Codex 创建

用户输入：

```text
创建一个竖版 5:7 的图片占位框，用于拉面广告
```

Codex 行为：

1. 调用 `create_image_holder`。
2. 传入比例、标题、页面位置。
3. 工具在画布中创建 holder shape。
4. 返回 holder shape id。

### 5.3 首次生成图片

用户操作：

1. 在画布中选中图片占位框。
2. 对 Codex 说：“生成一个拉面品牌广告，品牌名叫拉面一番。”

Codex 行为：

1. 调用 `get_selection`。
2. 确认当前选中对象是 image holder。
3. 读取 holder 的宽高、比例、标题、所在页面。
4. 根据用户需求和 holder 比例生成 image 2.0 prompt。
5. 调用 Codex image 2.0 生图能力。
6. 将图片保存到当前 canvas assets 目录。
7. 调用 `insert_image_into_holder`。
8. 图片填充 holder，保持比例和边界。
9. 写入生成记录。

生成记录示例：

```json
{
  "runId": "run_20260620_143000_001",
  "type": "generate",
  "model": "codex-image-2.0",
  "targetShapeId": "shape:holder_abc123",
  "outputAssetId": "asset:ramen_ad_001",
  "outputPath": "assets/ramen_ad_001.png",
  "prompt": "竖版 5:7 拉面品牌广告...",
  "createdAt": "2026-06-20T14:30:00+08:00"
}
```

### 5.4 用户标注修改

用户在画布上进行以下操作：

1. 用箭头指向图片中的某个区域。
2. 在箭头附近写文字，例如“这里改成白汤”。
3. 用圆圈圈出需要变小的碗。
4. 用手绘标记指出需要删除或增加的部分。

画布需要支持：

1. 箭头。
2. 文本。
3. 圆形、矩形、自由画笔。
4. 不同颜色。
5. 标注图层默认位于图片上方。
6. 标注可以被 Codex 读取。

### 5.5 根据标注修图

用户输入：

```text
根据标注修改这张图
```

Codex 行为：

1. 调用 `get_selection`。
2. 如果当前选中图片，则以该图片为目标。
3. 如果未选中图片，则调用 `find_target_image_from_annotations` 推断目标图片。
4. 调用 `collect_annotations`。
5. 读取目标图片附近或绑定到目标图片的标注。
6. 将标注转换成结构化修改请求。
7. 导出一张“图片 + 标注”的参考截图。
8. 调用 Codex image 2.0，对原图进行修改。
9. 新图片保存为新 asset。
10. 新图片插入到旧图右侧，或替换 holder 中的当前图。
11. 保留旧版本，并创建版本连线或版本组。

推荐默认行为：

1. 不直接覆盖旧图。
2. 新图放在旧图右侧，距离 80px。
3. 新图标题为“AI 图片 v2”。
4. 原始标注保留在旧图上。
5. 新图生成后自动选中。

---

## 6. 画布 UI 设计

### 6.1 主界面

画布主界面由以下区域组成：

```text
顶部栏:
  - 当前画布名称
  - 页面切换
  - 保存状态
  - 导出按钮

左侧:
  - 页面列表
  - 素材列表
  - 版本列表

中央:
  - 无限画布

右侧:
  - 选中对象属性
  - AI 操作面板
  - 生成历史

底部工具栏:
  - 选择
  - 手型移动
  - 图片占位框
  - 图片
  - 箭头
  - 画笔
  - 橡皮
  - 文本
  - 矩形/圆形
```

### 6.2 图片占位框样式

未填充状态：

1. 边框为蓝色虚线或浅蓝色实线。
2. 中心显示“AI 图片”。
3. 左上角显示比例，例如 `5:7`。
4. 右下角显示尺寸，例如 `1024 x 1434`。

填充状态：

1. 图片完整填入 holder。
2. 可以选择 contain 或 cover。
3. 默认保留 holder 标题。
4. 图片下方可显示版本号。

### 6.3 标注体验

标注应该尽量接近设计评审场景：

1. 箭头要容易画。
2. 文本输入要直接，不要弹复杂弹窗。
3. 默认标注颜色为红色。
4. 标注文字默认较大，方便 Codex 和用户识别。
5. 标注可以吸附或绑定到图片。
6. 当箭头终点落在图片内部时，系统记录其相对图片坐标。

### 6.4 AI 操作面板

右侧 AI 面板提供以下按钮：

1. 填充选中占位框。
2. 根据标注修改选中图片。
3. 创建新版本。
4. 导出选中图片。
5. 清理已使用标注。
6. 查看 prompt 和 run metadata。

注意：这些按钮只是 UI 入口，Codex 也可以通过 MCP 工具执行同样操作。

---

## 7. 本地存储设计

### 7.1 默认保存路径

默认路径建议为：

```text
<workspace>/.ai-canvas/
```

也可以通过环境变量修改：

```bash
AI_CANVAS_HOME=/path/to/AI-Canvas
AI_CANVAS_PORT=43218
```

如果用户指定项目目录，则保存到：

```text
<user-selected-root>/canvases/
```

### 7.2 目录结构

```text
.ai-canvas/
  config.json
  canvases/
    canvas_<id>/
      canvas.json
      metadata.json
      pages/
        page_<id>.json
      assets/
        images/
          img_<id>.png
        thumbnails/
          img_<id>.webp
      runs/
        run_<id>.json
      exports/
        export_<id>.png
      logs/
        mcp.log
```

### 7.3 config.json

```json
{
  "version": "0.1.0",
  "defaultPort": 43218,
  "storageMode": "local",
  "imageModel": "codex-image-2.0",
  "defaultCanvasName": "Untitled AI Canvas",
  "assetPolicy": {
    "copyExternalImages": true,
    "generateThumbnails": true,
    "keepAllVersions": true
  }
}
```

### 7.4 metadata.json

```json
{
  "canvasId": "canvas_abc123",
  "name": "拉面广告",
  "createdAt": "2026-06-20T14:00:00+08:00",
  "updatedAt": "2026-06-20T14:30:00+08:00",
  "workspaceRoot": "/path/to/workspace",
  "activePageId": "page_main",
  "appVersion": "0.1.0"
}
```

### 7.5 run 记录

每一次 AI 操作都写入 `runs/run_<id>.json`。

```json
{
  "runId": "run_20260620_143000_001",
  "type": "edit_from_annotations",
  "model": "codex-image-2.0",
  "input": {
    "targetShapeId": "shape:image_001",
    "inputAssetPath": "assets/images/img_001.png",
    "annotationShapeIds": [
      "shape:arrow_001",
      "shape:text_001"
    ]
  },
  "annotationPlan": [
    {
      "instruction": "将这一区域的汤底改成白汤",
      "region": {
        "x": 0.23,
        "y": 0.64,
        "w": 0.18,
        "h": 0.12
      },
      "sourceTextShapeId": "shape:text_001",
      "sourceArrowShapeId": "shape:arrow_001"
    }
  ],
  "prompt": "基于原图修改：保持整体构图、广告文字和拉面主体不变...",
  "output": {
    "assetId": "asset:img_002",
    "assetPath": "assets/images/img_002.png",
    "newShapeId": "shape:image_002"
  },
  "createdAt": "2026-06-20T14:30:00+08:00"
}
```

---

## 8. tldraw 二次开发设计

### 8.1 Shape 类型

系统至少需要以下 shape 类型：

1. `image_holder`：AI 图片占位框。
2. `ai_image`：由 image 2.0 生成或编辑后的图片。
3. `annotation_text`：用户修改文字。
4. `annotation_arrow`：用户箭头。
5. `annotation_mark`：圈选、画笔、矩形等标记。
6. `version_group`：图片版本关系，可选。

tldraw 原生已有 image、text、arrow、draw、geo 等 shape。MVP 可以不新增所有 shape，而是在原生 shape 的 meta 字段中写入业务标记。

示例：

```json
{
  "id": "shape:holder_001",
  "type": "geo",
  "props": {
    "w": 403,
    "h": 567,
    "geo": "rectangle",
    "label": "AI 图片"
  },
  "meta": {
    "aiCanvasRole": "image_holder",
    "aspectRatio": "5:7",
    "acceptsGeneratedImage": true
  }
}
```

图片 shape 示例：

```json
{
  "id": "shape:image_001",
  "type": "image",
  "props": {
    "assetId": "asset:img_001",
    "w": 403,
    "h": 567
  },
  "meta": {
    "aiCanvasRole": "ai_image",
    "sourceRunId": "run_20260620_143000_001",
    "version": 1
  }
}
```

### 8.2 图片插入逻辑

插入图片时必须完成两件事：

1. 创建 asset record。
2. 创建或更新 image shape。

伪代码：

```ts
async function insertImageIntoHolder(holderId: string, imagePath: string) {
  const holder = editor.getShape(holderId)
  if (!holder) throw new Error('Holder not found')

  const asset = await createImageAssetFromLocalFile(imagePath)

  const imageShape = {
    id: createShapeId(),
    type: 'image',
    x: holder.x,
    y: holder.y,
    props: {
      assetId: asset.id,
      w: holder.props.w,
      h: holder.props.h
    },
    meta: {
      aiCanvasRole: 'ai_image',
      holderId
    }
  }

  editor.createAssets([asset])
  editor.createShapes([imageShape])
  editor.deleteShape(holderId)
}
```

MVP 可选择不删除 holder，而是：

1. 保留 holder。
2. 在 holder 上方创建 image shape。
3. 将 image shape 的 meta.holderId 指向 holder。

这样可以保留占位框语义。

### 8.3 Snapshot 保存

需要定期保存 tldraw snapshot。

触发保存的时机：

1. shape 新增。
2. shape 删除。
3. shape 移动或缩放结束。
4. image 插入完成。
5. AI 生成或修图完成。
6. 用户切换页面。
7. 应用关闭前。

保存策略：

1. 防抖保存，默认 800ms。
2. 显示保存状态：保存中、已保存、保存失败。
3. 每次 AI 操作后强制保存。

---

## 9. MCP Server 设计

MCP Server 是 Codex 与本地画布沟通的核心。

### 9.1 MCP 工具列表

#### 9.1.1 open_canvas

用途：启动或打开本地画布服务。

输入：

```json
{
  "workspaceRoot": "/path/to/workspace",
  "canvasId": "optional",
  "port": 43218
}
```

输出：

```json
{
  "url": "http://127.0.0.1:43218/",
  "canvasId": "canvas_abc123",
  "storagePath": "/path/to/workspace/.ai-canvas/canvases/canvas_abc123"
}
```

行为：

1. 检查服务是否已运行。
2. 未运行则启动。
3. 创建默认 canvas。
4. 返回本地 URL 和保存路径。

#### 9.1.2 get_selection

用途：读取当前画布选区。

输出：

```json
{
  "canvasId": "canvas_abc123",
  "pageId": "page_main",
  "selectedShapeIds": ["shape:holder_001"],
  "shapes": [
    {
      "id": "shape:holder_001",
      "role": "image_holder",
      "type": "geo",
      "bounds": {
        "x": 120,
        "y": 80,
        "w": 403,
        "h": 567
      },
      "aspectRatio": "5:7"
    }
  ]
}
```

#### 9.1.3 create_image_holder

用途：创建 AI 图片占位框。

输入：

```json
{
  "label": "AI 图片",
  "aspectRatio": "5:7",
  "x": 100,
  "y": 100,
  "w": 403,
  "h": 567
}
```

输出：

```json
{
  "shapeId": "shape:holder_001",
  "bounds": {
    "x": 100,
    "y": 100,
    "w": 403,
    "h": 567
  }
}
```

#### 9.1.4 insert_image_into_holder

用途：将本地图片插入选中占位框。

输入：

```json
{
  "holderShapeId": "shape:holder_001",
  "imagePath": "/absolute/path/to/image.png",
  "mode": "contain",
  "title": "AI 图片"
}
```

输出：

```json
{
  "imageShapeId": "shape:image_001",
  "assetId": "asset:img_001",
  "assetPath": "assets/images/img_001.png"
}
```

#### 9.1.5 collect_annotations

用途：收集目标图片相关标注。

输入：

```json
{
  "targetShapeId": "shape:image_001",
  "radius": 300,
  "includeScreenshot": true
}
```

输出：

```json
{
  "targetShapeId": "shape:image_001",
  "targetAssetPath": "assets/images/img_001.png",
  "annotations": [
    {
      "kind": "arrow_text",
      "text": "这里用白汤",
      "region": {
        "x": 0.22,
        "y": 0.62,
        "w": 0.18,
        "h": 0.1
      },
      "shapeIds": ["shape:arrow_001", "shape:text_001"]
    }
  ],
  "screenshotPath": "exports/annotated_view_001.png"
}
```

#### 9.1.6 create_image_version

用途：将新图作为旧图的新版本插入画布。

输入：

```json
{
  "sourceShapeId": "shape:image_001",
  "imagePath": "/absolute/path/to/new.png",
  "placement": "right",
  "title": "AI 图片 v2",
  "runId": "run_20260620_143000_002"
}
```

输出：

```json
{
  "newShapeId": "shape:image_002",
  "assetId": "asset:img_002",
  "version": 2
}
```

#### 9.1.7 save_snapshot

用途：强制保存当前画布。

输出：

```json
{
  "ok": true,
  "savedAt": "2026-06-20T14:30:00+08:00",
  "snapshotPath": "canvas.json"
}
```

### 9.2 MCP Server 与 Canvas App 通信方式

推荐两种方式：

方式一：本地 HTTP API

```text
MCP Server -> HTTP -> Canvas App
```

Canvas App 提供本地 API：

```text
GET  /api/canvas/state
POST /api/canvas/shape
POST /api/canvas/asset
POST /api/canvas/selection
POST /api/canvas/export
```

方式二：共享文件 + WebSocket

```text
MCP Server -> 修改 snapshot 文件 -> WebSocket 通知 Canvas App 重新加载或应用 patch
```

推荐 MVP 使用 HTTP API，开发更直接。

### 9.3 服务安全限制

本地工具必须做路径限制：

1. 只允许写入当前 canvas storagePath。
2. 外部图片导入时必须复制到 assets 目录。
3. 不允许 MCP 工具写任意系统路径。
4. 不允许通过 URL 读取内网敏感资源，除非用户明确允许。
5. 所有工具调用写日志。

---

## 10. Codex Skill 设计

Skill 用于告诉 Codex 什么时候调用哪些工具，以及调用顺序。

### 10.1 Skill 名称

```text
ai-canvas-art-director
```

### 10.2 Skill 触发描述

```yaml
name: ai-canvas-art-director
description: Use when the user wants to open an AI infinite canvas, create image holders, generate images into a canvas, annotate images with arrows/text, or edit images based on canvas annotations using Codex image 2.0.
```

### 10.3 Skill 主流程

Skill 内容应包含以下规则：

1. 用户要求打开画布时，调用 `open_canvas`。
2. 用户要求生成图片时，先调用 `get_selection`。
3. 如果当前选中对象是 image holder，读取其尺寸和比例。
4. 如果没有选中 holder，主动创建一个默认 holder，或提醒用户选择。
5. 调用 Codex image 2.0 生成图片。
6. 将生成图片保存到 canvas assets。
7. 调用 `insert_image_into_holder`。
8. 输出保存路径、shape id、prompt 摘要。
9. 用户要求按标注修改时，调用 `collect_annotations`。
10. 标注不明确时，优先导出带标注截图辅助理解。
11. 修图时默认保留原图，新图作为新版本插入。
12. 不覆盖旧图，除非用户明确要求。

### 10.4 Skill 中的 prompt 规范

首次生成 prompt 应包含：

1. 用户原始需求。
2. 画布占位框比例。
3. 输出用途。
4. 风格关键词。
5. 构图要求。
6. 需要避免的问题。

修图 prompt 应包含：

1. 保留原图主体。
2. 保留整体构图。
3. 只修改标注区域。
4. 标注文字逐条转成修改指令。
5. 若图片里有文字，默认尽量保持原文字不变。
6. 输出与原图同尺寸或同视觉比例。

---

## 11. Codex image 2.0 接入设计

用户明确要求生图方面调用 Codex 里的 image 2.0 生图模型。因此系统中应设计一个 Image Adapter，而不是把模型调用散落在业务代码里。

### 11.1 Image Adapter 接口

```ts
export interface ImageGenerationRequest {
  prompt: string
  aspectRatio?: string
  width?: number
  height?: number
  referenceImages?: string[]
  outputDir: string
  outputName?: string
}

export interface ImageEditRequest {
  prompt: string
  inputImagePath: string
  annotatedScreenshotPath?: string
  annotations?: AnnotationInstruction[]
  maskPath?: string
  outputDir: string
  outputName?: string
}

export interface ImageResult {
  imagePath: string
  width: number
  height: number
  model: 'codex-image-2.0'
  raw?: unknown
}
```

### 11.2 首次生成

输入：

```json
{
  "prompt": "竖版 5:7 拉面品牌广告，品牌名「拉面一番」，蒸汽腾腾的豚骨拉面...",
  "aspectRatio": "5:7",
  "outputDir": "assets/images"
}
```

输出：

```json
{
  "imagePath": "assets/images/ramen_brand_ad_001.png",
  "width": 1024,
  "height": 1434,
  "model": "codex-image-2.0"
}
```

### 11.3 根据标注修图

输入：

```json
{
  "inputImagePath": "assets/images/ramen_brand_ad_001.png",
  "annotatedScreenshotPath": "exports/annotated_view_001.png",
  "annotations": [
    {
      "instruction": "这里用白汤",
      "region": {
        "x": 0.22,
        "y": 0.62,
        "w": 0.18,
        "h": 0.1
      }
    }
  ],
  "prompt": "基于原图修改。保持整体广告构图、品牌文字、拉面主体和灯光风格不变。根据标注，将箭头指向区域的汤底改为白汤。"
}
```

### 11.4 图片文字策略

AI 生图模型生成文字时可能出现错字、变形或不可控问题。为了获得更稳定的广告图，建议采用图层分离策略：

1. 图片模型负责生成背景、主体、氛围、产品。
2. 品牌名、主标题、副标题、价格、卖点文案尽量用画布 text shape 单独叠加。
3. 导出最终图时将图片层和文字层合成。
4. 如果用户明确要求“文字烘焙进图片”，再让 image 2.0 直接生成含文字图片。

默认推荐：

```text
首版快速生成可以允许图片内文字。
正式导出版本应尽量使用画布文字图层。
```

---

## 12. 标注解析算法

### 12.1 目标

将画布中的自由标注转换成机器可执行的修图指令。

输入：

1. 目标图片 shape。
2. 图片周围的箭头、文字、圈选、画笔。
3. 可选：画布截图。

输出：

1. 每条修改指令。
2. 每条指令对应的图片相对区域。
3. 对应的原始标注 shape id。
4. 置信度。

### 12.2 标注与图片关联规则

优先级从高到低：

1. 显式绑定：arrow binding 指向目标 image shape。
2. 选中上下文：用户当前选中某张图片。
3. 空间关系：标注离某张图片最近。
4. 包含关系：圈选区域覆盖某张图片的一部分。
5. 页面唯一性：当前页面只有一张 AI 图片。

### 12.3 箭头 + 文字解析

规则：

1. 箭头终点是目标区域。
2. 箭头起点附近最近的 text shape 是说明文字。
3. 如果文字不在起点附近，则取箭头两端附近 200px 内最近文字。
4. 如果多个文字都靠近，按距离和颜色匹配排序。
5. 如果箭头终点落在图片外但方向指向图片，则计算箭头延长线与图片 bbox 的交点。

伪代码：

```ts
function parseArrowTextAnnotation(arrow, texts, targetImage) {
  const arrowTip = getArrowTipPoint(arrow)
  const regionPoint = projectPointToImage(arrowTip, targetImage.bounds)
  const nearbyText = findNearestText(arrow.startPoint, texts, 240)

  return {
    kind: 'arrow_text',
    text: nearbyText?.plainText ?? '',
    region: makeRegionAroundPoint(regionPoint, 0.12, 0.1),
    shapeIds: [arrow.id, nearbyText?.id].filter(Boolean),
    confidence: nearbyText ? 0.86 : 0.58
  }
}
```

### 12.4 圈选解析

规则：

1. 如果圆形或矩形与图片相交，则相交区域是目标区域。
2. 如果圈选内部有文字，则该文字为修改说明。
3. 如果圈选附近有文字，则该文字为修改说明。
4. 如果圈选没有文字，Codex 需要结合用户最新消息推断。

### 12.5 手绘标记解析

手绘标记通常用于强调区域。

处理方式：

1. 计算 draw shape 的 bbox。
2. 将 bbox 与目标图片 bbox 相交。
3. 转为相对图片坐标。
4. 如果附近有文字，绑定文字。
5. 如果没有文字，只作为视觉参考区域。

### 12.6 相对坐标转换

所有区域都转换成图片内相对坐标：

```ts
function toRelativeRegion(region, imageBounds) {
  return {
    x: (region.x - imageBounds.x) / imageBounds.w,
    y: (region.y - imageBounds.y) / imageBounds.h,
    w: region.w / imageBounds.w,
    h: region.h / imageBounds.h
  }
}
```

相对坐标必须 clamp 到 `[0, 1]`。

### 12.7 标注解析输出

```json
{
  "targetShapeId": "shape:image_001",
  "targetImagePath": "assets/images/img_001.png",
  "annotationPlan": [
    {
      "id": "ann_001",
      "instruction": "这里用白汤",
      "region": {
        "x": 0.22,
        "y": 0.62,
        "w": 0.18,
        "h": 0.1
      },
      "sourceShapeIds": ["shape:arrow_001", "shape:text_001"],
      "confidence": 0.86
    }
  ],
  "needsClarification": false
}
```

### 12.8 低置信度处理

如果满足以下条件，应向用户确认：

1. 多张图片都可能是目标。
2. 箭头没有明确指向图片。
3. 标注文字过短，例如“改一下”。
4. 标注之间互相冲突。
5. 没有选中图片，也没有明显目标图。

确认话术示例：

```text
我看到两个可能的目标图片。你希望我修改左边这张原图，还是右边这张 v2？
```

---

## 13. AI 修图 Prompt 生成规则

### 13.1 Prompt 组成

修图 prompt 由以下部分组成：

1. 基础保护指令。
2. 用户原始要求。
3. 标注解析列表。
4. 保留项。
5. 输出要求。

模板：

```text
基于输入图片进行编辑。请保持整体构图、主体位置、光影风格、画面质感和品牌视觉风格不变。

请根据以下画布标注进行修改：
1. 在图片相对区域 x=0.22, y=0.62, w=0.18, h=0.10，将汤底改为白汤。
2. 在图片相对区域 x=0.70, y=0.50, w=0.20, h=0.18，让碗的展示比例略小一些。

不要改变：
- 品牌名和主要标题。
- 拉面主体的高级广告质感。
- 整体暖色灯光和餐厅氛围。

输出要求：
- 与原图相同比例。
- 修改自然，不要出现明显修补痕迹。
- 如果某个标注意图不明确，优先保持原样。
```

### 13.2 首次生成 Prompt 模板

```text
请生成一张用于 {用途} 的图片。

画面比例：{aspectRatio}
主题：{subject}
品牌或产品名：{brandName}
风格：{style}
构图要求：{composition}
画面元素：{elements}
文字要求：{textPolicy}
避免：{negativeNotes}
```

示例：

```text
请生成一张用于餐饮品牌广告的竖版图片。

画面比例：5:7。
主题：日式豚骨拉面品牌广告。
品牌名：拉面一番。
风格：高级食物摄影、暖金色灯光、深色餐台、蒸汽氛围、商业广告质感。
构图要求：拉面碗位于画面下半部分，面条被筷子夹起，背景有柔和灯笼虚化。
画面元素：溏心蛋、叉烧、葱花、海苔、浓郁汤底。
文字要求：如果生成文字，请尽量清晰；后续可用画布文字图层重排。
避免：低清晰度、脏乱背景、畸形餐具、错乱文字、水印。
```

---

## 14. 版本管理设计

### 14.1 版本原则

1. 不覆盖原图。
2. 每次 AI 修改都生成新版本。
3. 新版本与旧版本建立 parent-child 关系。
4. 用户可以在画布中直观看到版本链。
5. 任意版本都可继续作为新修改的输入。

### 14.2 版本 metadata

```json
{
  "shapeId": "shape:image_002",
  "version": 2,
  "parentShapeId": "shape:image_001",
  "sourceRunId": "run_20260620_143000_002",
  "assetPath": "assets/images/img_002.png",
  "createdAt": "2026-06-20T14:35:00+08:00"
}
```

### 14.3 画布展示

推荐布局：

```text
原图 v1  ->  修改版 v2  ->  修改版 v3
```

每个版本下方显示：

1. 版本号。
2. 生成时间。
3. 简短 prompt 摘要。
4. 是否为当前推荐版。

---

## 15. 导出设计

### 15.1 导出单图

用户选中某张 AI 图片后，可以导出：

1. 原始图片。
2. 图片 + 画布文字图层。
3. 图片 + 标注。
4. 透明背景 PNG，如果支持。

### 15.2 导出画布区域

用户可以框选一个区域导出为 PNG/PDF。

适合导出：

1. 多版本对比图。
2. 设计评审图。
3. 最终广告图。

### 15.3 导出 metadata

每个导出文件旁边保存 JSON：

```json
{
  "exportId": "export_001",
  "sourceShapeIds": ["shape:image_003", "shape:text_004"],
  "outputPath": "exports/final_ad.png",
  "createdAt": "2026-06-20T15:00:00+08:00"
}
```

---

## 16. 项目代码结构建议

```text
ai-canvas-codex-plugin/
  .codex-plugin/
    plugin.json
  .mcp.json
  package.json
  pnpm-workspace.yaml
  skills/
    ai-canvas-art-director/
      SKILL.md
      references/
        annotation-rules.md
        prompt-patterns.md
  packages/
    canvas-app/
      package.json
      src/
        main.tsx
        App.tsx
        canvas/
          TldrawCanvas.tsx
          tools/
            ImageHolderTool.ts
          shapes/
            imageHolderMeta.ts
        api/
          client.ts
        panels/
          AiPanel.tsx
          AssetPanel.tsx
          VersionPanel.tsx
        storage/
          snapshot.ts
          assets.ts
    mcp-server/
      package.json
      src/
        index.ts
        tools/
          openCanvas.ts
          getSelection.ts
          createImageHolder.ts
          insertImageIntoHolder.ts
          collectAnnotations.ts
          createImageVersion.ts
          saveSnapshot.ts
        canvas/
          client.ts
          storage.ts
        image/
          codexImage20Adapter.ts
        annotations/
          parseAnnotations.ts
          geometry.ts
        utils/
          paths.ts
          ids.ts
          logger.ts
    shared/
      package.json
      src/
        types.ts
        schemas.ts
```

---

## 17. Plugin 配置建议

### 17.1 plugin.json

示例：

```json
{
  "name": "ai-canvas",
  "version": "0.1.0",
  "displayName": "AI Canvas",
  "description": "Codex-integrated infinite canvas for image generation, annotation, and iterative editing.",
  "skills": [
    {
      "path": "skills/ai-canvas-art-director"
    }
  ],
  "mcpServers": [
    {
      "name": "ai-canvas-mcp",
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"]
    }
  ]
}
```

### 17.2 .mcp.json

示例：

```json
{
  "mcpServers": {
    "ai-canvas": {
      "command": "node",
      "args": ["packages/mcp-server/dist/index.js"],
      "env": {
        "AI_CANVAS_PORT": "43218"
      }
    }
  }
}
```

---

## 18. 开发里程碑

### 18.1 MVP：可用闭环

目标：跑通“打开画布 -> 创建占位框 -> 生图 -> 插入画布”。

任务：

1. 创建 React + tldraw 画布应用。
2. 实现本地保存目录。
3. 实现 image holder。
4. 实现图片 asset 导入。
5. 实现 MCP Server 基础框架。
6. 实现 `open_canvas`。
7. 实现 `get_selection`。
8. 实现 `insert_image_into_holder`。
9. 接入 Codex image 2.0 生图 adapter。
10. 编写 Skill 初版。

验收：

1. 用户可以从 Codex 打开画布。
2. 用户可以选中 holder 并请求生成图片。
3. 图片自动保存到 assets。
4. 图片自动出现在 holder 中。

### 18.2 V1：标注修图闭环

目标：跑通“用户标注 -> Codex 读取标注 -> image 2.0 修图 -> 新版本插入画布”。

任务：

1. 实现箭头、文字、圈选标注读取。
2. 实现 `collect_annotations`。
3. 实现标注到相对图片坐标的转换。
4. 实现带标注截图导出。
5. 实现 image edit adapter。
6. 实现 `create_image_version`。
7. 实现 run metadata。
8. 优化 Skill 中的修图流程。

验收：

1. 用户在图上画箭头和文字后，Codex 能识别。
2. 修图结果能反映标注意图。
3. 新图作为 v2 插入画布。
4. 旧图和标注不丢失。

### 18.3 V2：产品化

目标：让普通用户可以稳定使用。

任务：

1. 增加右侧 AI 操作面板。
2. 增加版本列表。
3. 增加 prompt 历史查看。
4. 增加导出单图和区域导出。
5. 增加模板库。
6. 增加错误提示和低置信度确认。
7. 增加自动保存状态。
8. 增加配置页。

### 18.4 V3：高级能力

目标：面向真实创作工作流扩展。

任务：

1. 品牌资产库。
2. 多图参考。
3. 文字图层自动排版。
4. 多版本对比。
5. 云同步。
6. 多人协作。
7. 批量生成。
8. 设计规范检查。

---

## 19. 关键验收用例

### 19.1 用例一：拉面广告

输入：

```text
打开 AI 画布，创建一个竖版 5:7 的图片占位框，生成一个拉面品牌广告，品牌名叫拉面一番。
```

期望：

1. 画布打开。
2. 生成 holder。
3. 生成图片。
4. 图片放入 holder。
5. 左侧或 Codex 输出保存路径。

### 19.2 用例二：按标注修改

用户在图上标注：

```text
箭头指向汤底：用白汤
箭头指向碗：碗小一点展示
```

输入：

```text
根据标注修改这张图
```

期望：

1. Codex 读取到两条标注。
2. Codex 输出简短修改计划。
3. 调用 image 2.0 修图。
4. 新图插入旧图右侧。
5. 新图保留原广告风格。

### 19.3 用例三：无明确选中图片

用户未选中图片，但画布上有两张图。

输入：

```text
根据标注修改
```

期望：

1. 系统判断标注更靠近哪张图。
2. 如果置信度低，Codex 询问用户。
3. 不应盲目修改错误图片。

### 19.4 用例四：导出最终图

输入：

```text
导出当前选中的最终广告图
```

期望：

1. 导出 PNG。
2. 如果有独立文字图层，合成文字图层。
3. 输出导出路径。
4. 保存 export metadata。

---

## 20. 错误处理

### 20.1 画布服务未启动

处理：

1. 自动尝试启动。
2. 如果端口被占用，自动换端口。
3. 返回新 URL。

### 20.2 没有选中 holder

处理：

1. 如果页面有唯一 holder，使用该 holder。
2. 如果没有 holder，询问是否创建。
3. 如果有多个 holder，要求用户选择。

### 20.3 image 2.0 生成失败

处理：

1. 保存失败记录。
2. 展示错误原因。
3. 允许重试。
4. 不修改画布状态。

### 20.4 标注无法解析

处理：

1. 导出带标注截图。
2. 尝试用视觉理解兜底。
3. 仍不明确时询问用户。

### 20.5 图片插入失败

处理：

1. 检查 asset 文件是否存在。
2. 检查 holder shape 是否存在。
3. 回滚已创建的 asset record。
4. 提示用户重试。

---

## 21. 安全与权限

本项目是本地工作流，但仍然需要安全边界。

规则：

1. 服务默认只监听 `127.0.0.1`。
2. 不监听公网地址。
3. 文件写入限制在 `AI_CANVAS_HOME` 或当前 workspace 下。
4. 所有外部导入图片复制到 assets，不直接引用任意路径。
5. MCP 工具禁止删除 canvas 根目录外的文件。
6. 日志不记录敏感 token。
7. 用户明确导出前，不上传本地画布到云端。

---

## 22. 开发注意事项

### 22.1 不要把所有逻辑放在前端

画布 UI 负责交互，但业务逻辑应该沉到 MCP Server 和 shared 包中。

原因：

1. Codex 调用的是 MCP tools。
2. 标注解析需要稳定、可测试。
3. 文件系统操作应该由 Node 后端处理。
4. 未来可替换前端画布库。

### 22.2 不要把模型调用写死

虽然当前使用 Codex image 2.0，但要通过 adapter 调用。

这样未来可以切换：

1. Codex image 2.0。
2. OpenAI Images API。
3. 本地模型。
4. 第三方图像模型。

### 22.3 不要默认覆盖图片

视觉创作需要回退。所有 AI 修改默认创建新版本。

### 22.4 不要过度依赖截图理解

截图理解适合作为兜底，但结构化标注解析更稳定。

推荐：

```text
结构化 shape 数据为主。
带标注截图为辅。
```

---

## 23. AI 开发提示词建议

如果后续让 AI 开发者从本文件开始实现，可以给它以下开发指令：

```text
请根据《AI 无限画布制图工作流产品开发文档》实现 MVP。

要求：
1. 使用 React + Vite + tldraw 实现本地无限画布。
2. 使用 Node.js 实现 MCP Server。
3. 默认保存路径为当前 workspace 下的 .ai-canvas。
4. 实现 open_canvas、get_selection、create_image_holder、insert_image_into_holder、save_snapshot 五个工具。
5. 图片生成通过 Codex image 2.0 adapter 抽象，不要把模型调用散落在业务代码中。
6. MVP 先跑通打开画布、创建 holder、生成图片、插入图片。
7. 保持代码结构清晰，前端画布、MCP 工具、共享类型分包。
8. 不要实现云同步、多人协作、模板库，这些留到 V2/V3。
```

V1 开发指令：

```text
请在 MVP 基础上实现标注修图闭环。

要求：
1. 支持读取箭头、文字、圈选、手绘标注。
2. 实现 collect_annotations 工具。
3. 将标注转换为目标图片内的相对坐标。
4. 导出带标注截图作为 image 2.0 修图参考。
5. 调用 Codex image 2.0 对原图进行编辑。
6. 新图作为新版本插入旧图右侧，不覆盖原图。
7. 保存 run metadata。
```

---

## 24. 最终推荐实现路径

推荐从以下顺序开始：

1. 用 tldraw 做画布原型。
2. 实现本地 snapshot 保存。
3. 实现 image holder。
4. 实现本地图片插入。
5. 实现 MCP Server。
6. 接通 Codex 打开画布。
7. 接通 Codex image 2.0 生图。
8. 接通生成图片写入画布。
9. 实现标注解析。
10. 实现按标注修图。
11. 增加版本管理。
12. 增加导出。

这套路线可以最短路径复刻参考案例的核心体验，同时为后续产品化保留足够扩展空间。

---

## 25. 成功标准

当以下流程可以无障碍完成时，认为产品核心闭环成立：

1. 用户在 Codex 中说“打开 AI 画布”。
2. 本地无限画布自动打开。
3. 用户创建或选中图片占位框。
4. 用户让 Codex 生成图片。
5. Codex 调用 image 2.0 生成图片并插入画布。
6. 用户在图片上画箭头和文字。
7. 用户让 Codex 根据标注修改。
8. Codex 读取标注，调用 image 2.0 修图。
9. 新图作为版本插入画布。
10. 所有素材、prompt、版本和运行记录都保存在本地。

如果做到以上 10 点，就已经实现了参考案例的核心业务逻辑。
