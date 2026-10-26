/*
 * 医学生模拟器 — 开局数据
 * 所有数值集中在此，方便后续平衡与扩展。
 */
(function () {
  'use strict';

  const STEP_DEFS = [
    {
      key: 'identity',
      no: '01',
      nav: '身份',
      title: '姓名与天资',
      eyebrow: 'IDENTITY & APTITUDE',
      lead: '先写下名字，再决定你从怎样的起点出发。'
    },
    {
      key: 'attributes',
      no: '02',
      nav: '属性',
      title: '分配开局属性',
      eyebrow: 'STARTING ATTRIBUTES',
      lead: '六项能力，十点上限。每一项至少投入三点。'
    },
    {
      key: 'family',
      no: '03',
      nav: '家庭',
      title: '选择家庭背景',
      eyebrow: 'FAMILY BACKGROUND',
      lead: '有人替你兜底，有人只能自己撑伞。经济只是开局的一层底色。'
    },
    {
      key: 'abilities',
      no: '04',
      nav: '能力',
      title: '领取初始能力',
      eyebrow: 'INNATE TRAITS',
      lead: '能力点花在天赋上，也可能留一点给未来的自己。'
    },
    {
      key: 'school',
      no: '05',
      nav: '院校',
      title: '填写目标院校',
      eyebrow: 'MEDICAL SCHOOL',
      lead: '四座校门，四种风浪。院校决定起跑线，不决定终点。'
    },
    {
      key: 'review',
      no: '06',
      nav: '确认',
      title: '核对新生档案',
      eyebrow: 'FINAL REVIEW',
      lead: '看看清楚，这是未来几年里别人认识你的方式。'
    }
  ];

  const TALENTS = [
    {
      key: 'ordinary',
      name: '普通',
      en: 'ORDINARY',
      attrPoints: 30,
      abilityPoints: 5,
      growthPoints: 2,
      tagline: '没有光环，只有一步一步。',
      desc: '你大概不是老师最先记住的那个人，但你清楚，医学是一场长跑。'
    },
    {
      key: 'excellent',
      name: '优秀',
      en: 'EXCELLENT',
      attrPoints: 35,
      abilityPoints: 8,
      growthPoints: 3,
      tagline: '底子不错，偶尔也被期待。',
      desc: '你总能比别人更快抓住重点。这让你走得更稳，也让你不敢松劲。'
    },
    {
      key: 'elite',
      name: '精英',
      en: 'ELITE',
      attrPoints: 40,
      abilityPoints: 12,
      growthPoints: 4,
      tagline: '在人群里，你总是靠前。',
      desc: '优秀对你而言不是意外。你习惯被看见，也习惯把标准抬得更高。'
    },
    {
      key: 'genius',
      name: '天才',
      en: 'GENIUS',
      attrPoints: 50,
      abilityPoints: 16,
      growthPoints: 6,
      tagline: '理解得太快，也是一种孤独。',
      desc: '有些课本翻一遍就够了。但医学不只需要聪明，还需要忍耐与笨功夫。'
    }
  ];

  const ATTRIBUTES = [
    {
      key: 'memory',
      name: '记忆力',
      en: 'MEMORY',
      icon: 'brain',
      color: '#4b7168',
      desc: '把机制、药名与图谱收进脑子。它直接影响每周理论学习的进度。'
    },
    {
      key: 'comprehension',
      name: '悟性',
      en: 'COMPREHENSION',
      icon: 'lamp',
      color: '#a57a45',
      desc: '听懂老师没有讲完的半句话。它影响理解知识、举一反三的速度。'
    },
    {
      key: 'creativity',
      name: '创造力',
      en: 'CREATIVITY',
      icon: 'spark',
      color: '#ae5a43',
      desc: '从文献的缝隙里找到新问题。它决定科研成果能够抵达的上限。'
    },
    {
      key: 'resilience',
      name: '抗压能力',
      en: 'RESILIENCE',
      icon: 'shield',
      color: '#315d56',
      desc: '在考试、值班与深夜里不倒下的能力。它提高压力上限，也加快每周的压力回落。'
    },
    {
      key: 'stamina',
      name: '体力',
      en: 'STAMINA',
      icon: 'bolt',
      color: '#78834e',
      desc: '支撑你上完课、打完工、再学一会儿的本钱。透支会带来麻烦。'
    },
    {
      key: 'appearance',
      name: '颜值',
      en: 'CHARISMA',
      icon: 'eye',
      color: '#a65f5d',
      desc: '别人对你的第一印象。它影响初始好感，也影响每次交往的收获。'
    }
  ];

  const FAMILIES = [
    {
      key: 'orphan',
      name: '孤儿',
      en: 'ORPHAN',
      icon: 'home',
      money: 200,
      support: 500,
      interval: 4,
      supportLabel: '政府补助',
      supportText: '每 4 周 +¥500',
      mealText: '每周餐费全免',
      tags: ['餐费全免', '政府补助', '无家庭供给'],
      desc: '没有能替你兜底的人，你比同龄人更早学会安排生活。学校与政府提供基本保障。',
      note: '开局资金 200 元；餐费全免；每 4 周自动获得 500 元政府补助。'
    },
    {
      key: 'poor',
      name: '贫穷家庭',
      en: 'LOW INCOME',
      icon: 'coin',
      money: 1000,
      support: 0,
      interval: 4,
      supportLabel: '待申请助学金',
      supportText: '申请后每 4 周 +¥500',
      mealText: '申请前正常餐费',
      tags: ['学期初可申请助学金', '申请后餐费全免'],
      desc: '家里把能拿出的都拿出来了。每学期开学，你都要决定是否递出那张补助申请表。',
      note: '开局资金 1,000 元；每次开学触发助学金申请事件。获批后餐费全免、每 4 周获得 500 元，但部分事件选项会被禁用。'
    },
    {
      key: 'working',
      name: '工薪阶层',
      en: 'WORKING CLASS',
      icon: 'briefcase',
      money: 5000,
      support: 2000,
      interval: 4,
      supportLabel: '家庭供给',
      supportText: '每 4 周 +¥2,000',
      mealText: '正常餐费',
      tags: ['稳定支持', '无特殊限制'],
      desc: '不宽裕，也不至于断炊。父母的支持稳定而克制，偶尔附上一句“钱够不够”。',
      note: '开局资金 5,000 元；每 4 周获得 2,000 元家庭支持。'
    },
    {
      key: 'affluent',
      name: '富裕家庭',
      en: 'AFFLUENT',
      icon: 'house',
      money: 10000,
      support: 3000,
      interval: 4,
      supportLabel: '家庭供给',
      supportText: '每 4 周 +¥3,000',
      mealText: '正常餐费',
      tags: ['经济宽裕', '无特殊限制'],
      desc: '学费和生活费都不是你需要最先担心的事。你可以把更多注意力留给课程与科研。',
      note: '开局资金 10,000 元；每 4 周获得 3,000 元家庭支持。'
    },
    {
      key: 'medical',
      name: '医学世家',
      en: 'MEDICAL FAMILY',
      icon: 'caduceus',
      money: 5000,
      support: 2000,
      interval: 4,
      supportLabel: '家庭供给',
      supportText: '每 4 周 +¥2,000',
      mealText: '正常餐费',
      tags: ['导师系统解锁', '科研系统解锁', '开局有门路'],
      desc: '饭桌上聊的是病例，书架上摆着旧版教材。你比别人更早接触到导师、实验室和医院。',
      note: '开局资金 5,000 元；每 4 周获得 2,000 元家庭支持；开局解锁导师与科研选项。',
      unlocksMentor: true,
      unlocksResearch: true
    },
    {
      key: 'tycoon',
      name: '家财万贯',
      en: 'TYCOON',
      icon: 'gem',
      money: 100000,
      support: 50000,
      interval: 4,
      supportLabel: '家庭供给',
      supportText: '每 4 周 +¥50,000',
      mealText: '正常餐费',
      tags: ['财务自由', '无特殊限制'],
      desc: '你完全可以不学医。但你还是来了。钱能解决很多问题，却解决不了考场和病房里的问题。',
      note: '开局资金 100,000 元；每 4 周获得 50,000 元家庭支持。'
    }
  ];

  const ABILITIES = [
    {
      key: 'optimist',
      name: '乐天派',
      en: 'OPTIMIST',
      icon: 'sun',
      cost: 2,
      effect: '压力上限 +10；每周额外降低 5 点压力。',
      desc: '你总能找到一点值得高兴的事，哪怕是在连续值完两个夜班之后。'
    },
    {
      key: 'energetic',
      name: '高精力人士',
      en: 'HIGH ENERGY',
      icon: 'battery',
      cost: 3,
      effect: '体力上限 +20；每周额外恢复 10 点体力。',
      desc: '睡四小时也能撑过一上午。你的身体像一块不太讲道理的新电池。'
    },
    {
      key: 'dreamer',
      name: '梦境中人',
      en: 'DREAMER',
      icon: 'moon',
      cost: 2,
      effect: '与每个人的初始好感度 +10。',
      desc: '你有一种让人愿意多说两句的亲和力。第一次见面，别人就记住了你。'
    },
    {
      key: 'timekeeper',
      name: '时间管理大师',
      en: 'TIME KEEPER',
      icon: 'clock',
      cost: 4,
      effect: '学习、科研与副业的效率提高 10%。',
      desc: '把一天掰成两天用。你总有办法在熄灯前，把计划表上的最后一项划掉。'
    }
  ];

  const SCHOOLS = [
    {
      key: 'tier2',
      no: '01',
      name: '二本院校',
      short: '二本',
      en: 'TIER-2 MEDICAL COLLEGE',
      level: '普通本科',
      difficulty: 1,
      difficultyLabel: '轻松',
      competition: '较低',
      special: '标准',
      gpaExcellent: 3.0,
      admissionCode: '02',
      desc: '你可能是这里最会考试的人。没有那么多聚光灯，也少有人催你跑。',
      line: '校门不算气派，但“医学院”三个字在阳光下很亮。'
    },
    {
      key: 'tier1',
      no: '02',
      name: '一本院校',
      short: '一本',
      en: 'FIRST-TIER MEDICAL UNIVERSITY',
      level: '省属重点',
      difficulty: 2,
      difficultyLabel: '标准',
      competition: '中等',
      special: '较多',
      gpaExcellent: 3.2,
      admissionCode: '01',
      desc: '不显眼，也不垫底。你身边有一群和你差不多努力的人，谁也不肯先停。',
      line: '校园比想象中大。你跟着指示牌绕过两栋教学楼，才找到报到处。'
    },
    {
      key: 'project985',
      no: '03',
      name: '985 高校',
      short: '985',
      en: 'PROJECT 985 UNIVERSITY',
      level: '双一流 · 985',
      difficulty: 3,
      difficultyLabel: '困难',
      competition: '激烈',
      special: '频繁',
      gpaExcellent: 3.5,
      admissionCode: '98',
      desc: '录取通知书很好看，课程表和排名同样不好看。这里最不缺聪明人。',
      line: '迎新的横幅铺了一整条路，每个人看起来都像曾经的第一名。'
    },
    {
      key: 'qingbei',
      no: '04',
      name: '清北',
      short: '清北',
      en: 'QINGBEI MEDICAL SCHOOLS',
      level: '顶尖医学院',
      difficulty: 4,
      difficultyLabel: '极难',
      competition: '顶尖',
      special: '最高',
      gpaExcellent: 3.8,
      admissionCode: '99',
      desc: '你走进了一间几乎所有人都曾考过第一名的教室。这里聚着全国最聪明的一批人，也聚着最难承认的疲惫。',
      line: '你抬头看向那座闻名已久的校门，忽然意识到，这里走出过很多你背过名字的人。'
    }
  ];

  window.MEDSIM = window.MEDSIM || {};
  window.MEDSIM.DATA = {
    version: 1,
    title: '医学生模拟器',
    chapter: '序章 · 白袍之前',
    year: new Date().getFullYear(),
    steps: STEP_DEFS,
    talents: TALENTS,
    attributes: ATTRIBUTES,
    families: FAMILIES,
    abilities: ABILITIES,
    schools: SCHOOLS,
    rules: {
      attributeMin: 3,
      attributeMax: 10,
      intervalWeeks: 4
    },
    academicRules: {
      gpaScale: 4,
      gpaWeighting: 'credit-weighted',
      excellentIsPostgraduateLine: true,
      nationalScholarship: {
        label: '国家奖学金',
        minOffset: 0
      },
      provincialScholarship: {
        label: '省级奖学金',
        minOffset: -0.2,
        maxOffset: 0
      },
      schoolScholarship: {
        label: '校级奖学金',
        minOffset: -0.3,
        maxOffset: -0.2
      },
      inspirationalScholarship: {
        label: '励志奖学金',
        minOffset: -0.2,
        families: ['orphan', 'poor'],
        bonus: true
      },
      graduation: {
        requiredElectiveCredits: 10,
        requiredWaterCredits: 10,
        requiresAllMainCourses: true,
        requiresAllIdeologyCourses: true
      }
    }
  };
})();
