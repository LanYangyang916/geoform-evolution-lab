// challenges.js
// 地貌挑战实验室 — 答题数据。所有题目由挑战引擎动态渲染，
// 不要将题目内容硬编码在页面组件中。后续新增题目只需追加即可。

/**
 * 每道题结构：
 * {
 *   id:         唯一标识
 *   category:  "river" | "karst"
 *   level:      关卡序号 (1-4)
 *   type:      "identification" | "feature" | "mechanism" | "comparison"
 *   title:     关卡名称
 *   question:  题目描述
 *   relatedLandforms: [关联地貌 key ...]
 *   options:   ["选项A","选项B","选项C"]
 *   correctAnswer: 正确选项索引 (0-based)
 *   landformKey:   正确答案对应的地貌 key（用于解析、对比表）
 *   compareLandformKey: 对比题中第二个地貌 key
 *   explanation: 正确解答
 *   hint:      观察提示（使用提示后星数降为2）
 *   rewardStars: 最高星数 (3)
 * }
 */

export const challengeCategories = {
  river: { label: "河流地貌", icon: "🌊", color: "#7eaec6" },
  karst: { label: "喀斯特地貌", icon: "🪨", color: "#7ea67e" },
  aeolian: { label: "风力地貌", icon: "🌬️", color: "#c8a87e" },
};

export const challengeLevels = [
  { key: "id", label: "地貌识别", emoji: "🔍" },
  { key: "feature", label: "特征判断", emoji: "🔎" },
  { key: "mechanism", label: "形成机制", emoji: "⚙️" },
  { key: "comparison", label: "对比挑战", emoji: "⚖️" },
];

// ======================== 河流地貌 ========================
export const challenges = [
  // ---- 关卡 1：地貌识别 ----
  {
    id: "river-1",
    category: "river",
    level: 1,
    type: "identification",
    title: "地貌识别",
    question:
      "河流在山区持续下切，谷底狭窄、两侧谷坡陡峭。这最可能是哪种地貌？",
    relatedLandforms: ["v-valley", "alluvial-fan", "delta"],
    options: ["V 型谷", "冲积扇", "三角洲"],
    correctAnswer: 0,
    landformKey: "v-valley",
    explanation:
      "V 型谷是河流在山区长期下切侵蚀形成的典型侵蚀地貌，谷底窄、谷坡陡、横剖面呈 V 字形。",
    hint: "观察谷底宽度和两侧坡度，思考山区河流的侵蚀作用。",
    rewardStars: 3,
  },

  // ---- 关卡 2：特征判断 ----
  {
    id: "river-2",
    category: "river",
    level: 2,
    type: "feature",
    title: "特征判断",
    question:
      "河流流出山口后，坡度减小、流速下降，泥沙逐渐沉积形成扇状地貌。这最可能是哪种地貌？",
    relatedLandforms: ["alluvial-fan", "delta", "oxbow-lake"],
    options: ["冲积扇", "三角洲", "牛轭湖"],
    correctAnswer: 0,
    landformKey: "alluvial-fan",
    explanation:
      "冲积扇是河流从山区进入平原时坡度骤减、流速下降，搬运能力减弱后在山前堆积形成的扇形沉积体。",
    hint: "注意形成位置——是在山口还是河口？",
    rewardStars: 3,
  },

  // ---- 关卡 3：形成机制 ----
  {
    id: "river-3",
    category: "river",
    level: 3,
    type: "mechanism",
    title: "形成机制",
    question:
      "V 型谷与冲积扇最核心的形成差异是什么？",
    relatedLandforms: ["v-valley", "alluvial-fan"],
    options: [
      "V 型谷以流水下切侵蚀为主；冲积扇以流水搬运和沉积为主",
      "V 型谷在河口形成；冲积扇在山区形成",
      "两者形成机制完全相同，只是位置不同",
    ],
    correctAnswer: 0,
    landformKey: "v-valley",
    compareLandformKey: "alluvial-fan",
    explanation:
      "V 型谷是流水下切侵蚀的结果，物质被带走、谷地加深；冲积扇是流水搬运能力减弱后沉积的结果，物质在山前堆积。",
    hint: "侵蚀是搬走物质，沉积是留下物质。",
    rewardStars: 3,
  },

  // ---- 关卡 4：对比挑战 ----
  {
    id: "river-4",
    category: "river",
    level: 4,
    type: "comparison",
    title: "对比挑战",
    question:
      "以下关于三角洲与冲积扇的比较，哪一项是正确的？",
    relatedLandforms: ["delta", "alluvial-fan"],
    options: [
      "三角洲在河口形成，冲积扇在山前形成",
      "两者都在河口形成",
      "冲积扇的沉积物颗粒比三角洲更细",
    ],
    correctAnswer: 0,
    landformKey: "delta",
    compareLandformKey: "alluvial-fan",
    explanation:
      "三角洲在河流入海口/入湖口因流速骤降而堆积；冲积扇在山前因坡度骤减而堆积。两者位置不同，但都是流水沉积地貌。",
    hint: "一个在海边，一个在山脚下。",
    rewardStars: 3,
  },

  // ======================== 喀斯特地貌 ========================
  // ---- 关卡 1：地貌识别 ----
  {
    id: "karst-1",
    category: "karst",
    level: 1,
    type: "identification",
    title: "地貌识别",
    question:
      "石灰岩长期受含二氧化碳的水溶蚀，形成塔状、锥状山体群。这最可能是哪种地貌？",
    relatedLandforms: ["peak-forest", "karst-cave", "sinkhole"],
    options: ["峰林", "喀斯特溶洞", "天坑 / 溶蚀洼地"],
    correctAnswer: 0,
    landformKey: "peak-forest",
    explanation:
      "峰林是石灰岩在流水长期溶蚀作用下形成的塔状、锥状山体群，是地表岩溶的典型形态，以广西桂林最为著名。",
    hint: "想想桂林山水中的那些孤立山峰。",
    rewardStars: 3,
  },

  // ---- 关卡 2：特征判断 ----
  {
    id: "karst-2",
    category: "karst",
    level: 2,
    type: "feature",
    title: "特征判断",
    question:
      "地下洞穴持续扩大，顶部岩层局部失稳塌陷，形成深大洼地。这最可能是哪种地貌？",
    relatedLandforms: ["sinkhole", "peak-forest", "karst-cave"],
    options: ["天坑 / 溶蚀洼地", "峰林", "喀斯特溶洞"],
    correctAnswer: 0,
    landformKey: "sinkhole",
    explanation:
      "天坑是地下溶洞顶部岩层失稳塌陷后形成的地表深坑或封闭洼地，坑壁陡峭，底部常有落水洞连通地下。",
    hint: "观察陡峭的坑壁和底部的落水洞。",
    rewardStars: 3,
  },

  // ---- 关卡 3：形成机制 ----
  {
    id: "karst-3",
    category: "karst",
    level: 3,
    type: "mechanism",
    title: "形成机制",
    question:
      "峰林与喀斯特溶洞在形成机制上，最根本的共同驱动力是什么？",
    relatedLandforms: ["peak-forest", "karst-cave"],
    options: [
      "含CO₂的水对石灰岩的溶蚀作用",
      "河流的机械冲刷作用",
      "风力的搬运和沉积",
    ],
    correctAnswer: 0,
    landformKey: "peak-forest",
    compareLandformKey: "karst-cave",
    explanation:
      "峰林（地表）和溶洞（地下）都由含CO₂的水对石灰岩进行化学溶蚀形成。地表水沿裂隙下渗塑造峰林，地下水持续溶蚀形成洞穴。",
    hint: "喀斯特地貌的共同驱动力是什么？想想化学溶蚀。",
    rewardStars: 3,
  },

  // ---- 关卡 4：对比挑战 ----
  {
    id: "karst-4",
    category: "karst",
    level: 4,
    type: "comparison",
    title: "对比挑战",
    question:
      "天坑与峰林在形成过程中的关键区别是什么？",
    relatedLandforms: ["sinkhole", "peak-forest"],
    options: [
      "天坑以塌陷为主，峰林以溶蚀残留为主",
      "两者都由风力侵蚀形成",
      "峰林是地下地貌，天坑是地表地貌",
    ],
    correctAnswer: 0,
    landformKey: "sinkhole",
    compareLandformKey: "peak-forest",
    explanation:
      "峰林是溶蚀后残留的塔状山体（溶蚀残留），天坑是地下洞穴顶部塌陷形成的深坑（塌陷作用）。一个向上凸起，一个向下凹陷。",
    hint: "一个向上凸起，一个向下凹陷——思考为什么。",
    rewardStars: 3,
  },
  // ======================== 风力地貌 ========================
  // ---- 关卡 1：地貌识别 ----
  {
    id: "aeolian-1",
    category: "aeolian",
    level: 1,
    type: "identification",
    title: "地貌识别",
    question:
      "风力搬运沙粒并在风速减弱处堆积，形成迎风坡缓、背风坡陡的沙质堆积体。这最可能是哪种地貌？",
    relatedLandforms: ["dune", "yardang", "wind-eroded-mushroom"],
    options: ["沙丘", "雅丹", "风蚀蘑菇"],
    correctAnswer: 0,
    landformKey: "dune",
    explanation:
      "沙丘是风力搬运松散沙粒、在风速减弱处堆积形成的地貌，迎风坡缓、背风坡陡，常见于沙漠和海岸沙地。",
    hint: "观察两侧坡度差异——哪一侧更缓？",
    rewardStars: 3,
  },

  // ---- 关卡 2：特征判断 ----
  {
    id: "aeolian-2",
    category: "aeolian",
    level: 2,
    type: "feature",
    title: "特征判断",
    question:
      "风力对软硬相间岩层差异侵蚀，形成长条形垄岗与槽谷沿主导风向排列。这最可能是哪种地貌？",
    relatedLandforms: ["yardang", "dune", "wind-eroded-mushroom"],
    options: ["雅丹", "沙丘", "风蚀蘑菇"],
    correctAnswer: 0,
    landformKey: "yardang",
    explanation:
      "雅丹是风力对软硬相间岩层差异侵蚀形成的，垄岗与槽谷相间排列且方向性明显，常见于干旱地区的湖相沉积层。",
    hint: "注意垄岗和槽谷的排列方向与风向的关系。",
    rewardStars: 3,
  },

  // ---- 关卡 3：形成机制 ----
  {
    id: "aeolian-3",
    category: "aeolian",
    level: 3,
    type: "mechanism",
    title: "形成机制",
    question:
      "沙丘（堆积）与雅丹（侵蚀）在形成机制上的根本区别是什么？",
    relatedLandforms: ["dune", "yardang"],
    options: [
      "沙丘以风力搬运堆积为主；雅丹以风力侵蚀磨蚀为主",
      "两者都由风力堆积形成",
      "沙丘是侵蚀地貌，雅丹是堆积地貌",
    ],
    correctAnswer: 0,
    landformKey: "dune",
    compareLandformKey: "yardang",
    explanation:
      "沙丘是风力减弱后沙粒沉积堆积形成的；雅丹是风力对软硬岩层持续侵蚀、磨蚀形成的。一个在堆积，一个在削蚀。",
    hint: "一个是'沙子被留下'，一个是'岩石被削掉'。",
    rewardStars: 3,
  },

  // ---- 关卡 4：对比挑战 ----
  {
    id: "aeolian-4",
    category: "aeolian",
    level: 4,
    type: "comparison",
    title: "对比挑战",
    question:
      "风蚀蘑菇与雅丹在形态上的关键区别是什么？",
    relatedLandforms: ["wind-eroded-mushroom", "yardang"],
    options: [
      "风蚀蘑菇呈上宽下窄的蘑菇状；雅丹呈长条形垄槽相间排列",
      "两者形态完全相同",
      "风蚀蘑菇是堆积地貌，雅丹是侵蚀地貌",
    ],
    correctAnswer: 0,
    landformKey: "wind-eroded-mushroom",
    compareLandformKey: "yardang",
    explanation:
      "风蚀蘑菇是孤立的上宽下窄蘑菇状岩体，受近地面强风沙磨蚀形成；雅丹是成片分布的长条形垄岗与槽谷，受区域性风力差异侵蚀形成。",
    hint: "一个是单独的，一个是成片的。",
    rewardStars: 3,
  },
];

// 按分类和关卡获取题目
export function getChallenge(category, level) {
  return challenges.find((c) => c.category === category && c.level === level) || null;
}

// 获取某分类的关卡总数
export function getLevelCount(category) {
  return challenges.filter((c) => c.category === category).length;
}
