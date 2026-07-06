# 地球雕刻师｜Geoform Evolution Lab

互动式河流地貌 3D 图鉴馆 —— 面向中学地理学习的 Three.js 互动教学网站。

第一版聚焦“河流地貌”，包含四个可交互的 GLB 模型：V 型谷、冲积扇、三角洲、牛轭湖。

## 技术栈

- [Vite](https://vitejs.dev/) 构建
- 原生 HTML / CSS / JavaScript（ES Module）
- [Three.js](https://threejs.org/) + `GLTFLoader` + `OrbitControls`
- 无 React / Vue、无后端、无数据库

## 运行项目

```bash
npm install   # 安装依赖
npm run dev   # 启动开发服务器（默认 http://localhost:5173）
```

其他命令：

```bash
npm run build     # 生产构建，输出到 dist/
npm run preview   # 本地预览生产构建结果
```

## 功能一览

- 左侧地貌列表点击切换，中间区域平滑加载对应 GLB 模型
- 鼠标拖拽旋转、滚轮缩放、右键平移（OrbitControls）
- 切换模型时自动计算包围盒，归一化尺寸并居中、相机自动适配
- 模型加载淡入动画、加载进度文字、加载失败友好提示
- 自动旋转 / 重置视角
- 画布右上角工具：旋转提示、缩放提示、全屏、截图导出 PNG
- 右侧知识详情（地貌档案、关键特征、形成过程、学习提示）随模型切换
- 左下角学习进度统计已探索地貌数量
- 底部多尺度观察栏（模型视图可用，其余为下一版本占位）
- 响应式：桌面三栏；中屏右栏下移；窄屏上下堆叠且左右栏可折叠

## 目录结构

```text
geoform-evolution-lab/
├─ index.html              # 页面结构
├─ package.json
├─ vite.config.js
├─ src/
│  ├─ main.js              # 入口：初始化、状态管理、事件绑定
│  ├─ scene.js             # Three.js 场景、相机、灯光、渲染器、控制器、resize
│  ├─ modelLoader.js       # GLB 加载、dispose、归一化、居中、相机适配、淡入
│  ├─ ui.js                # 菜单/详情渲染、Toast、加载与错误状态、按钮状态
│  ├─ data/
│  │  └─ landforms.js      # 四种地貌数据
│  └─ styles/
│     └─ main.css          # 全部布局与视觉样式
└─ public/
   └─ models/river/        # GLB 模型（站点根路径为 /models/river/...）
      ├─ v-valley.glb
      ├─ alluvial-fan.glb
      ├─ delta.glb
      └─ oxbow-lake.glb
```

## 如何放置模型

模型文件放在 `public/models/river/` 下。Vite 会将 `public/` 目录原样发布到站点根，
因此代码中通过 `/models/river/xxx.glb` 这样的绝对路径引用（注意路径中不含 `public`）。

若某个 GLB 缺失或路径写错，页面不会白屏，而是显示提示：

> 模型暂时无法加载，请检查 public/models/river/ 中的文件名与路径。

## 如何新增一个地貌

1. 把新的 GLB 放进 `public/models/river/`，例如 `canyon.glb`。
2. 打开 [src/data/landforms.js](src/data/landforms.js)，在 `landforms` 对象中追加一项：

   ```js
   "canyon": {
     name: "峡谷",
     englishName: "Canyon",
     subtitle: "……",
     category: "流水侵蚀地貌",      // 显示在左侧菜单的小分类
     modelPath: "/models/river/canyon.glb",
     type: "……",
     dominantForce: "……",
     environment: "……",
     locations: "……",
     features: ["……", "……"],
     formationSteps: ["……", "……"],
     hint: "……",                   // 右侧学习提示
   },
   ```

3. 在同文件的 `landformOrder` 数组中加入新 key（控制菜单顺序）：

   ```js
   export const landformOrder = ["v-valley", "alluvial-fan", "delta", "oxbow-lake", "canyon"];
   ```

左侧菜单、右侧详情、学习进度都会自动根据数据更新，无需改动其他文件。
（可选）在 `src/ui.js` 的 `dotColors` 中为新 key 指定一个图标配色。

## 后续扩展预留

第一版未实现物理模拟、演化动画、用户登录、地图 API、热点点击、答题系统。
代码中已为这些留出位置：

- 顶部“对比实验室 / 学习笔记”、底部“地形剖面 / 卫星视角 / 实景照片”当前为占位项，
  点击仅弹出 Toast 提示，可在此基础上接入对应页面或视图。
- `modelLoader.js` 的加载流程便于后续插入演化动画或时间轴控制。
