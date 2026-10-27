/*
 * 医学生模拟器 · 本科核心数据
 * 课程目录 / 校历 / NPC / 商店
 */
(function () {
  'use strict';

  const MAIN_COURSES = [
    // 第一学年
    { id: 'main-y1-organic', year: 1, term: 'full', name: '有机化学', credits: 4, weeks: 16 },
    { id: 'main-y1-math', year: 1, term: 'full', name: '高等数学', credits: 4, weeks: 16 },
    { id: 'main-y1-general-chem', year: 1, term: 'full', name: '普通化学', credits: 4, weeks: 16 },
    { id: 'main-y1-organic-lab', year: 1, term: 'full', name: '有机化学实验', credits: 2, weeks: 16, lab: true },
    { id: 'main-y1-general-lab', year: 1, term: 'full', name: '普通化学实验', credits: 2, weeks: 16, lab: true },
    { id: 'main-y1-biochem', year: 1, term: 'autumn', name: '生物化学', credits: 4, weeks: 16 },
    { id: 'main-y1-biochem-lab', year: 1, term: 'autumn', name: '生物化学实验', credits: 2, weeks: 16, lab: true },
    { id: 'main-y1-physics', year: 1, term: 'autumn', name: '大学物理', credits: 4, weeks: 16 },
    { id: 'main-y1-physics-lab', year: 1, term: 'autumn', name: '大学物理实验', credits: 2, weeks: 16, lab: true },
    { id: 'main-y1-cell', year: 1, term: 'spring', name: '细胞生物学', credits: 2, weeks: 16 },
    { id: 'main-y1-genetics', year: 1, term: 'spring', name: '遗传学', credits: 2, weeks: 16 },
    { id: 'main-y1-mol-lab', year: 1, term: 'spring', name: '分子生物学实验', credits: 1, weeks: 8, lab: true },

    // 第二学年
    { id: 'main-y2-anatomy', year: 2, term: 'autumn', name: '系统解剖学', credits: 4, weeks: 16 },
    { id: 'main-y2-physiology', year: 2, term: 'autumn', name: '生理学', credits: 5, weeks: 16 },
    { id: 'main-y2-pathology', year: 2, term: 'autumn', name: '病理学', credits: 3, weeks: 16 },
    { id: 'main-y2-pathophys', year: 2, term: 'autumn', name: '病理生理学', credits: 3, weeks: 16 },
    { id: 'main-y2-morph-lab-1', year: 2, term: 'autumn', name: '比较人体形态学实验 I', credits: 2, weeks: 16, lab: true },
    { id: 'main-y2-physio-lab', year: 2, term: 'spring', name: '生理学实验', credits: 2, weeks: 16, lab: true },
    { id: 'main-y2-regional', year: 2, term: 'spring', name: '局部解剖学', credits: 3, weeks: 16 },
    { id: 'main-y2-morph-lab-2', year: 2, term: 'spring', name: '比较人体形态学实验 II', credits: 2, weeks: 16, lab: true },
    { id: 'main-y2-pathogen', year: 2, term: 'spring', name: '病原生物学', credits: 3, weeks: 16 },
    { id: 'main-y2-pathogen-lab', year: 2, term: 'spring', name: '病原生物学与免疫学实验', credits: 3, weeks: 16, lab: true },

    // 第三学年
    { id: 'main-y3-pharm', year: 3, term: 'autumn', name: '药理学', credits: 4, weeks: 16 },
    { id: 'main-y3-diagnostics', year: 3, term: 'autumn', name: '诊断学', credits: 3, weeks: 16 },
    { id: 'main-y3-epidemiology', year: 3, term: 'autumn', name: '临床流行病学与循证医学', credits: 3, weeks: 16 },
    { id: 'main-y3-ethics', year: 3, term: 'autumn', name: '医学伦理学与卫生法学', credits: 3, weeks: 16 },
    { id: 'main-y3-surgery-basics', year: 3, term: 'autumn', name: '外科学总论', credits: 3, weeks: 16 },
    { id: 'main-y3-infectious', year: 3, term: 'spring', name: '传染病学', credits: 3, weeks: 16 },
    { id: 'main-y3-dermatology', year: 3, term: 'spring', name: '皮肤性病学', credits: 3, weeks: 16 },
    { id: 'main-y3-ophthalmology', year: 3, term: 'spring', name: '眼科学', credits: 3, weeks: 16 },
    { id: 'main-y3-psychiatry', year: 3, term: 'spring', name: '精神病学', credits: 3, weeks: 16 },
    { id: 'main-y3-neurology', year: 3, term: 'spring', name: '神经病学', credits: 3, weeks: 16 },
    { id: 'main-y3-radiology', year: 3, term: 'spring', name: '医学影像学', credits: 3, weeks: 16 },
    { id: 'main-y3-internal', year: 3, term: 'summer', name: '内科学', credits: 5, weeks: 8 },
    { id: 'main-y3-surgery', year: 3, term: 'summer', name: '外科学', credits: 5, weeks: 8 },
    { id: 'main-y3-pediatrics', year: 3, term: 'summer', name: '儿科学', credits: 5, weeks: 8 },
    { id: 'main-y3-obgyn', year: 3, term: 'summer', name: '妇产科学', credits: 5, weeks: 8 },
    { id: 'main-y3-tcm', year: 3, term: 'summer', name: '中医学', credits: 5, weeks: 8 },

    // 第四学年
    { id: 'main-y4-internal', year: 4, term: 'full', name: '内科见习', credits: 12, weeks: 8, rotation: true },
    { id: 'main-y4-surgery', year: 4, term: 'full', name: '外科见习', credits: 12, weeks: 8, rotation: true },
    { id: 'main-y4-pediatrics', year: 4, term: 'full', name: '儿科见习', credits: 12, weeks: 8, rotation: true },
    { id: 'main-y4-obgyn', year: 4, term: 'full', name: '妇产科见习', credits: 12, weeks: 8, rotation: true },

    // 第五学年
    { id: 'main-y5-internal', year: 5, term: 'full', name: '内科实习', credits: 12, weeks: 8, rotation: true },
    { id: 'main-y5-surgery', year: 5, term: 'full', name: '外科实习', credits: 12, weeks: 8, rotation: true },
    { id: 'main-y5-pediatrics', year: 5, term: 'full', name: '儿科实习', credits: 12, weeks: 8, rotation: true },
    { id: 'main-y5-obgyn', year: 5, term: 'full', name: '妇产科实习', credits: 12, weeks: 8, rotation: true }
  ];

  const IDEOLOGY_COURSES = [
    { id: 'ideo-sx', name: '思修', fullName: '思想道德与法治', credits: 3, weeks: 16 },
    { id: 'ideo-sg', name: '史纲', fullName: '中国近现代史纲要', credits: 3, weeks: 16 },
    { id: 'ideo-jl', name: '军理', fullName: '军事理论', credits: 2, weeks: 16 },
    { id: 'ideo-my', name: '马原', fullName: '马克思主义基本原理', credits: 3, weeks: 16 },
    { id: 'ideo-mg', name: '毛概', fullName: '毛泽东思想和中国特色社会主义理论体系概论', credits: 5, weeks: 16 },
    { id: 'ideo-xg', name: '习概', fullName: '习近平新时代中国特色社会主义思想概论', credits: 2, weeks: 16 }
  ];

  const WATER_COURSES = [
    { id: 'water-programming', name: '程序设计', credits: 3, weeks: 16 },
    { id: 'water-entrepreneur', name: '创业基础', credits: 2, weeks: 16, entrepreneurship: true },
    { id: 'water-solfege', name: '视唱练耳', credits: 2, weeks: 16 },
    { id: 'water-art', name: '打开艺术之门', credits: 3, weeks: 16 },
    { id: 'water-education', name: '当代社会中的教育', credits: 1.5, weeks: 8 },
    { id: 'water-qing-literature', name: '清代文学史', credits: 2, weeks: 16 },
    { id: 'water-selfmedia', name: '自媒体发展与实践', credits: 2, weeks: 16, entrepreneurship: true },
    { id: 'water-game-theory', name: '博弈论', credits: 3, weeks: 16 }
  ];

  // 选修课：均为 8 周；修满 10 学分即可。
  // 人类学同时出现在旧水课目录与本次选修目录中，按本次目录归入选修，避免重复课程。
  const ELECTIVE_COURSES = [
    { id: 'elective-anthropology', name: '人类学', credits: 1.5, weeks: 8 },
    { id: 'elective-global-health', name: '全球卫生', credits: 1.5, weeks: 8 },
    { id: 'elective-global-environment', name: '全球环境改变与人类健康', credits: 1.5, weeks: 8 },
    { id: 'elective-social-medicine', name: '社会医学（乙）', credits: 1.5, weeks: 8 },
    { id: 'elective-health-management', name: '卫生事业管理', credits: 1.5, weeks: 8 },
    { id: 'elective-pathology-progress', name: '病理学进展', credits: 1.5, weeks: 8 },
    { id: 'elective-genomic-medicine', name: '基因组医学', credits: 1.5, weeks: 8 },
    { id: 'elective-clinical-genetics', name: '临床遗传学', credits: 1.5, weeks: 8 },
    { id: 'elective-forensic-medicine', name: '法医学', credits: 1.5, weeks: 8 },
    { id: 'elective-clinical-anatomy', name: '临床应用解剖学', credits: 1.5, weeks: 8 },
    { id: 'elective-medical-informatics', name: '医学信息学', credits: 2, weeks: 8 },
    { id: 'elective-clinical-nutrition', name: '临床营养学', credits: 1.5, weeks: 8 },
    { id: 'elective-clinical-pharmacology', name: '临床药理学', credits: 1.5, weeks: 8 },
    { id: 'elective-rehabilitation', name: '临床康复医学', credits: 1.5, weeks: 8 },
    { id: 'elective-geriatrics', name: '老年医学', credits: 1.5, weeks: 8 },
    { id: 'elective-clinical-toxicology', name: '临床毒理学', credits: 1.5, weeks: 8 },
    { id: 'elective-communication', name: '医患沟通技巧', credits: 1.5, weeks: 8 },
    { id: 'elective-instruments', name: '医疗仪器的临床应用', credits: 1.5, weeks: 8 },
    { id: 'elective-oncology', name: '肿瘤学概论', credits: 1.5, weeks: 8 },
    { id: 'elective-clinical-immunology', name: '临床免疫学', credits: 1.5, weeks: 8 }
  ];

  const NPC_SEEDS = [
    {
      id: 'npc-chen',
      name: '陈望舒',
      role: '舍友',
      gender: 'male',
      orientation: 'heterosexual',
      orientationLabel: '异性恋',
      favor: 20,
      met: true,
      note: '临床一班的篮球队队长，睡得比你晚，起得比你早。'
    },
    {
      id: 'npc-zhou',
      name: '周雨桐',
      role: '舍友',
      gender: 'female',
      orientation: 'bisexual',
      orientationLabel: '双性恋',
      favor: 20,
      met: true,
      note: '本地人，熟悉学校周边所有便宜的夜宵摊。'
    },
    {
      id: 'npc-xu',
      name: '许嘉禾',
      role: '舍友',
      gender: 'female',
      orientation: 'heterosexual',
      orientationLabel: '异性恋',
      favor: 20,
      met: true,
      note: '话不多，笔记永远整齐，熄灯前会检查一次插排。'
    },
    {
      id: 'npc-lin',
      name: '林栀',
      role: '社团朋友',
      gender: 'female',
      orientation: 'homosexual',
      orientationLabel: '同性恋',
      favor: 10,
      met: false,
      note: '摄影社成员，总在校园里拍一些没人注意的角落。'
    }
  ];

  const SHOP_ITEMS = [
    {
      id: 'item-medicine',
      name: '对症药物',
      price: 200,
      icon: 'medicine',
      desc: '移除普通生病状态。重病状态下无法生效。',
      effect: 'cure-sick'
    },
    {
      id: 'item-energy-drink',
      name: '能量饮料',
      price: 30,
      icon: 'battery',
      desc: '体力 +15，压力 +3。',
      effect: 'stamina',
      stamina: 15,
      stress: 3
    },
    {
      id: 'item-aroma',
      name: '助眠香薰',
      price: 60,
      icon: 'moon',
      desc: '压力 −15。',
      effect: 'stress',
      stress: -15
    }
  ];

  const ACADEMIC = {
    gpaScale: 4,
    mainCreditTotal: MAIN_COURSES.reduce(function (sum, course) {
      return sum + course.credits;
    }, 0),
    ideologyCreditTotal: IDEOLOGY_COURSES.reduce(function (sum, course) {
      return sum + course.credits;
    }, 0),
    electiveCreditRequired: 10,
    waterCreditRequired: 10,
    terms: {
      autumn: {
        name: '秋冬',
        display: '第一学期 · 秋冬',
        weeks: 18,
        teachingWeeks: [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17],
        reviewWeeks: [9, 18]
      },
      spring: {
        name: '春夏',
        display: '第二学期 · 春夏',
        weeks: 18,
        teachingWeeks: [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17],
        reviewWeeks: [9, 18]
      }
    }
  };

  // 第一学年全年课程：本版采用的平衡分配。后续可扩展为玩家自选。
  const FIRST_YEAR_PLAN = {
    autumn: {
      fullYear: ['main-y1-organic', 'main-y1-organic-lab'],
      seasonal: [
        'main-y1-biochem',
        'main-y1-biochem-lab',
        'main-y1-physics',
        'main-y1-physics-lab'
      ]
    },
    spring: {
      fullYear: ['main-y1-general-chem', 'main-y1-general-lab', 'main-y1-math'],
      seasonal: ['main-y1-cell', 'main-y1-genetics', 'main-y1-mol-lab']
    }
  };

  window.MEDSIM_GAME_DATA = {
    version: 1,
    academic: ACADEMIC,
    mainCourses: MAIN_COURSES,
    ideologyCourses: IDEOLOGY_COURSES,
    waterCourses: WATER_COURSES,
    electiveCourses: ELECTIVE_COURSES,
    npcSeeds: NPC_SEEDS,
    shopItems: SHOP_ITEMS,
    firstYearPlan: FIRST_YEAR_PLAN,
    schoolRanks: {
      tier2: 1,
      tier1: 2,
      project985: 3,
      qingbei: 4
    },
    mentorLevels: {
      lecturer: { key: 'lecturer', name: '青年讲师', rank: 1, guidanceChance: 0.3, guidanceRange: [3, 5] },
      associate: { key: 'associate', name: '副教授', rank: 2, guidanceChance: 0.2, guidanceRange: [5, 10] },
      professor: { key: 'professor', name: '教授', rank: 3, guidanceChance: 0.1, guidanceRange: [10, 20] },
      academician: { key: 'academician', name: '院士', rank: 4, guidanceChance: 0.05, guidanceRange: [15, 30] }
    },
    articleLevels: [
      { key: 'normal', name: '普通文章', multiplier: 1, baseProgress: 100 },
      { key: 'q1', name: '一区文章', multiplier: 1.5, baseProgress: 150 },
      { key: 'q1-core', name: '一区核心', multiplier: 2.25, baseProgress: 225 },
      { key: 'top', name: '顶刊', multiplier: 3.375, baseProgress: 338 },
      { key: 'super-top', name: '超级顶刊', multiplier: 5.0625, baseProgress: 507 }
    ],
    topJournals: ['Cell', 'The Lancet', 'Science', 'Nature', 'NEJM'],
    meals: [
      {
        key: 'frugal',
        name: '少吃点',
        price: 50,
        stress: 10,
        stamina: -10,
        health: -5,
        desc: '省钱，但胃和情绪都不会感谢你。'
      },
      {
        key: 'canteen',
        name: '吃饭堂',
        price: 100,
        stress: 0,
        stamina: 10,
        health: 0,
        desc: '最普通的一餐，也最稳定。'
      },
      {
        key: 'nice',
        name: '偶尔吃点好的',
        price: 200,
        stress: -10,
        stamina: 30,
        health: 0,
        desc: '热气腾腾的一顿饭，能把人从低谷里捞回来一点。'
      },
      {
        key: 'feast',
        name: '食餐劲的',
        price: 500,
        stress: -30,
        stamina: 40,
        health: 0,
        desc: '今晚先不想以后。'
      }
    ],
    activities: [
      { key: 'review', name: '随堂复习', cost: 1, desc: '自选一门课，准备度 +1~5。', target: 'course' },
      { key: 'preview', name: '预习', cost: 3, desc: '自选一门课，准备度 +4~16。', target: 'course' },
      { key: 'library', name: '图书馆复习', cost: 5, desc: '自选课程，准备度 +7~30；也可平均分配。', target: 'course-or-all' },
      { key: 'club', name: '社团活动', cost: 5, stamina: -10, stress: -10, comprehensive: [1, 3], favor: [3, 5], desc: '综评 +1~3，社团朋友好感 +3~5。' },
      { key: 'work-study', name: '勤工俭学', cost: 1, stamina: -3, stress: 3, money: 18, desc: '收入 18 元。' },
      { key: 'rest', name: '休息', cost: 5, stamina: 15, stress: -20, desc: '什么都不做，也是一种安排。' },
      { key: 'social', name: '和朋友们社交', cost: 5, npc: true, moneyPerNpc: 20, stress: -10, favor: [3, 5], desc: '选择一位朋友，消耗 20 元，好感 +3~5；本周首次社交额外降低 10 点压力。' },
      { key: 'english', name: '学英语', cost: 5, stamina: -10, stress: 10, english: [10, 30], desc: '英语水平 +10~30。' },
      { key: 'sidebusiness', name: '发展副业', cost: 10, stamina: -10, sideBusiness: [5, 15], desc: '副业值增加 5~15；相关课程会提高收益。' },
      { key: 'lab', name: '实验室干活', cost: 5, stamina: -10, research: [5, 15], desc: '科研进度 +5~15，可能触发导师指导。' }
    ]
  };
})();
