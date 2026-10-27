/* =========================================================
   医学生模拟器 · 本科核心回合
   ========================================================= */
(function () {
  'use strict';

  const DATA = window.MEDSIM && window.MEDSIM.DATA;
  const GD = window.MEDSIM_GAME_DATA;
  if (!DATA || !GD) {
    throw new Error('本科数据未载入。');
  }

  const SAVE_KEY = 'medsim.save.v1';
  const GAME_VERSION = 1;
  const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六'];
  const TABS = [
    { key: 'courses', label: '课程表', icon: 'book' },
    { key: 'week', label: '本周安排', icon: 'calendar' },
    { key: 'research', label: '科研', icon: 'flask' },
    { key: 'relations', label: '人际关系', icon: 'users' },
    { key: 'grades', label: '成绩', icon: 'chart' },
    { key: 'attributes', label: '人物属性', icon: 'user' }
  ];

  const TALENTS = DATA.talents || [];
  const FAMILIES = DATA.families || [];
  const SCHOOLS = DATA.schools || [];
  const ABILITIES = DATA.abilities || [];
  const MAIN = GD.mainCourses || [];
  const IDEOLOGY = GD.ideologyCourses || [];
  const WATER = GD.waterCourses || [];
  const ELECTIVES = GD.electiveCourses || [];
  const NPCS = GD.npcSeeds || [];

  const app = document.getElementById('game-app');
  const toastRegion = document.getElementById('game-toast-region');
  const modalRoot = document.getElementById('game-modal-root');

  let save = readSave();
  let game = normalizeGame(save && save.game);
  let toastTimer = 0;

  const ui = {
    tab: 'courses',
    modal: null,
    registration: {
      gender: null,
      ideology: ['ideo-sx'],
      water: ['water-education'],
      elective: ['elective-anthropology']
    },
    targets: {},
    socialTarget: null,
    lastFocused: null
  };

  /* ---------------------------------------------------------
     Helpers
     --------------------------------------------------------- */

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char];
    });
  }

  function icon(name, extraClass) {
    return (
      '<svg class="icon' +
      (extraClass ? ' ' + extraClass : '') +
      '" aria-hidden="true" focusable="false"><use href="#i-' +
      name +
      '"></use></svg>'
    );
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function pickRandom(list) {
    return list[Math.floor(Math.random() * list.length)];
  }

  function formatMoney(value) {
    return '¥' + new Intl.NumberFormat('zh-CN').format(Math.round(Number(value) || 0));
  }

  function signed(value, suffix) {
    const number = Math.round(Number(value) || 0);
    return (number > 0 ? '+' : '') + number + (suffix || '');
  }

  function findTalent(key) {
    return TALENTS.find(function (item) {
      return item.key === key;
    }) || null;
  }

  function findFamily(key) {
    return FAMILIES.find(function (item) {
      return item.key === key;
    }) || null;
  }

  function findSchool(key) {
    const normalized = key === 'elite8' ? 'qingbei' : key;
    return SCHOOLS.find(function (item) {
      return item.key === normalized;
    }) || null;
  }

  function findAbility(key) {
    return ABILITIES.find(function (item) {
      return item.key === key;
    }) || null;
  }

  function findSpec(id) {
    return (
      MAIN.find(function (item) { return item.id === id; }) ||
      IDEOLOGY.find(function (item) { return item.id === id; }) ||
      WATER.find(function (item) { return item.id === id; }) ||
      ELECTIVES.find(function (item) { return item.id === id; }) ||
      null
    );
  }

  function findMeal(key) {
    return GD.meals.find(function (item) {
      return item.key === key;
    }) || GD.meals[1];
  }

  function findActivityDef(key) {
    return GD.activities.find(function (item) {
      return item.key === key;
    }) || null;
  }

  function abilityKeys() {
    return save && save.student && Array.isArray(save.student.abilities)
      ? save.student.abilities
      : [];
  }

  function hasAbility(key) {
    return abilityKeys().indexOf(key) !== -1;
  }

  function studentAttributes() {
    const attrs = save && save.student && save.student.attributes ? save.student.attributes : {};
    return {
      memory: Number(attrs.memory) || 3,
      comprehension: Number(attrs.comprehension) || 3,
      creativity: Number(attrs.creativity) || 3,
      resilience: Number(attrs.resilience) || 3,
      stamina: Number(attrs.stamina) || 3,
      appearance: Number(attrs.appearance) || 3
    };
  }

  function maxStaminaFor(attributes) {
    return 100 + (attributes.stamina - 5) * 5 + (hasAbility('energetic') ? 20 : 0);
  }

  function maxStressFor(attributes) {
    return 100 + (attributes.resilience - 5) * 5 + (hasAbility('optimist') ? 10 : 0);
  }

  function currentTermDef() {
    return GD.academic.terms[game && game.time ? game.time.term : 'autumn'] || GD.academic.terms.autumn;
  }

  function isReviewWeek(g) {
    const term = GD.academic.terms[g.time.term] || GD.academic.terms.autumn;
    return term.reviewWeeks.indexOf(g.time.week) !== -1;
  }

  function isTeachingWeek(g) {
    const term = GD.academic.terms[g.time.term] || GD.academic.terms.autumn;
    return term.teachingWeeks.indexOf(g.time.week) !== -1;
  }

  function categoryLabel(category) {
    return {
      main: '主修',
      ideology: '思政',
      elective: '选修',
      water: '水课'
    }[category] || '课程';
  }

  function categoryCreditTotal(category) {
    return (game && game.credits ? game.credits[category] : 0) || 0;
  }

  function courseStaminaRate(course) {
    if (course.lab) {
      return 0.25;
    }
    if (course.category === 'main') {
      return 0.5;
    }
    if (course.category === 'water') {
      return 0.2;
    }
    return 0.25;
  }

  function courseWeeklyPeriods(spec) {
    if (!spec || !spec.credits || !spec.weeks) {
      return 0;
    }
    const factor = spec.lab ? 32 : 16;
    return (spec.credits * factor) / spec.weeks;
  }

  function courseIsTeachingThisWeek(course, g) {
    if (!course || course.completed || course.status !== 'active') {
      return false;
    }
    if (!isTeachingWeek(g)) {
      return false;
    }
    return g.time.week >= course.startWeek && g.time.week <= course.endWeek;
  }

  function activeCourses() {
    return game.courses.filter(function (course) {
      return courseIsTeachingThisWeek(course, game);
    });
  }

  function openCoursesForStudy() {
    return game.courses.filter(function (course) {
      return !course.completed && course.status === 'active';
    });
  }

  function attendanceScore(course) {
    return Math.max(0, 20 - (course.caughtAbsences || 0) * 10);
  }

  function sessionText(course) {
    if (!course.sessions || !course.sessions.length) {
      return '时间待排';
    }
    return course.sessions
      .map(function (session) {
        return DAY_NAMES[session.day] + ' ' + session.start + '–' + (session.start + session.length - 1) + '节';
      })
      .join(' · ');
  }

  function currentExamCountdown() {
    if (!game) {
      return null;
    }
    const candidates = game.courses
      .filter(function (course) {
        return !course.completed && course.examWeek >= game.time.week;
      })
      .map(function (course) {
        return course.examWeek;
      });
    if (!candidates.length) {
      return null;
    }
    const next = Math.min.apply(null, candidates);
    return Math.max(0, next - game.time.week);
  }

  function saveLabel() {
    return game ? '本科 · 第 ' + game.time.week + ' 周' : '本科';
  }

  function getFamilyMealPrice(meal) {
    const family = game && game.flags ? game.flags.family : null;
    if (family === 'orphan') {
      return 0;
    }
    return meal.price;
  }

  function sideBusinessMultiplier() {
    if (!game) {
      return 1;
    }
    const entrepreneurship = game.courses.some(function (course) {
      return (
        course.specId === 'water-entrepreneur' &&
        course.completed &&
        course.grade &&
        course.grade.passed
      );
    });
    const selfmedia = game.courses.some(function (course) {
      return (
        course.specId === 'water-selfmedia' &&
        course.completed &&
        course.grade &&
        course.grade.passed
      );
    });
    if (entrepreneurship && selfmedia) {
      return 1.5;
    }
    if (entrepreneurship || selfmedia) {
      return 1.2;
    }
    return 1;
  }

  function describeHealth() {
    if (!game) {
      return { key: 'normal', label: '正常' };
    }
    if (game.resources.severe) {
      return { key: 'severe', label: '重病' };
    }
    if (game.resources.sick) {
      return { key: 'sick', label: '生病' };
    }
    return { key: 'normal', label: '正常' };
  }

  function describeRelationship(favor) {
    if (favor < 20) {
      return '陌生人';
    }
    if (favor <= 40) {
      return '熟人';
    }
    if (favor <= 80) {
      return '朋友';
    }
    return '至交好友';
  }

  function findNpc(id) {
    return game && game.npcs ? game.npcs.find(function (npc) { return npc.id === id; }) || null : null;
  }

  function planItemLabel(item) {
    const def = findActivityDef(item.activityKey);
    if (!def) {
      return '未知安排';
    }
    if (item.activityKey === 'social') {
      const npc = findNpc(item.npcId);
      return def.name + (npc ? ' · ' + npc.name : '');
    }
    if (item.courseId) {
      const course = game.courses.find(function (entry) { return entry.id === item.courseId; });
      if (course) {
        return def.name + ' · ' + course.name;
      }
    }
    if (item.allCourses) {
      return def.name + ' · 平均分配';
    }
    return def.name;
  }

  function planCost(item) {
    const def = findActivityDef(item.activityKey);
    return def ? def.cost : 0;
  }

  function planStamina(item) {
    const def = findActivityDef(item.activityKey);
    return def && def.stamina ? def.stamina : 0;
  }

  function planStress(item) {
    const def = findActivityDef(item.activityKey);
    if (!def) {
      return 0;
    }
    // 一次社交无论选择几个人，只降低一次压力。
    if (item.activityKey === 'social') {
      return 0;
    }
    return def.stress || 0;
  }

  function planMoney(item) {
    const def = findActivityDef(item.activityKey);
    if (!def) {
      return 0;
    }
    let total = def.money || 0;
    if (def.moneyPerNpc) {
      total -= def.moneyPerNpc;
    }
    return total;
  }

  function projectWeek() {
    if (!game) {
      return null;
    }
    const attendedCourses = activeCourses().filter(function (course) {
      return course.attended;
    });
    const attendedPeriods = attendedCourses.reduce(function (sum, course) {
      return sum + course.weeklyPeriods;
    }, 0);
    const courseStamina = attendedCourses.reduce(function (sum, course) {
      return sum + course.weeklyPeriods * courseStaminaRate(course);
    }, 0);
    const courseStress = courseStamina;
    const meal = findMeal(game.weekPlan.meal);
    const mealPrice = getFamilyMealPrice(meal);
    const planStaminaTotal = game.weekPlan.activities.reduce(function (sum, item) {
      return sum + planStamina(item);
    }, 0);
    let planStressTotal = game.weekPlan.activities.reduce(function (sum, item) {
      return sum + planStress(item);
    }, 0);
    if (
      game.weekPlan.activities.some(function (item) {
        return item.activityKey === 'social';
      })
    ) {
      planStressTotal -= 10;
    }
    const planMoneyTotal = game.weekPlan.activities.reduce(function (sum, item) {
      return sum + planMoney(item);
    }, 0);
    const planTime = game.weekPlan.activities.reduce(function (sum, item) {
      return sum + planCost(item);
    }, 0);
    const freeTime = 30 + Math.max(0, 78 - attendedPeriods);
    const staminaDelta =
      Number(meal.stamina || 0) +
      planStaminaTotal -
      courseStamina +
      (hasAbility('energetic') ? 10 : 0);
    const stressDelta =
      Number(meal.stress || 0) +
      planStressTotal +
      courseStress +
      (hasAbility('optimist') ? -5 : 0);
    const moneyDelta = planMoneyTotal - mealPrice;
    return {
      meal: meal,
      mealPrice: mealPrice,
      attendedPeriods: attendedPeriods,
      courseStamina: courseStamina,
      courseStress: courseStress,
      planTime: planTime,
      freeTime: freeTime,
      planStamina: planStaminaTotal,
      planStress: planStressTotal,
      planMoney: planMoneyTotal,
      staminaDelta: staminaDelta,
      stressDelta: stressDelta,
      moneyDelta: moneyDelta,
      staminaAfter: game.resources.stamina + staminaDelta,
      stressAfter: game.resources.stress + stressDelta,
      moneyAfter: game.resources.money + moneyDelta
    };
  }

  function weekValidation() {
    if (!game) {
      return '未找到本科档案。';
    }
    if (game.ending) {
      return '本科阶段已经结束。';
    }
    if (game.termComplete) {
      return '本学期已经结束。';
    }
    if (game.pendingReport) {
      return '请先处理本周结算。';
    }
    const projection = projectWeek();
    if (projection.planTime > projection.freeTime) {
      return '本周空闲课时不足：已安排 ' + projection.planTime + ' / ' + projection.freeTime + '。';
    }
    if (projection.moneyAfter < 0) {
      return '现有资金不足，无法完成本周安排。';
    }
    return '';
  }

  /* ---------------------------------------------------------
     Save state
     --------------------------------------------------------- */

  function readSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function persist() {
    if (!save || !game) {
      return;
    }
    save.game = game;
    save.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    } catch (error) {
      showToast('存档写入失败，当前进度只保留在页面中。');
    }
  }

  function normalizeGame(raw) {
    if (!raw || raw.version !== GAME_VERSION) {
      return null;
    }
    const normalized = raw;
    normalized.resources = normalized.resources || {};
    normalized.resources.stamina = Number(normalized.resources.stamina);
    normalized.resources.stress = Number(normalized.resources.stress);
    normalized.resources.money = Number(normalized.resources.money) || 0;
    normalized.resources.health = Number(normalized.resources.health) || 100;
    normalized.resources.healthMax = Number(normalized.resources.healthMax) || 100;
    normalized.resources.sideBusiness = Number(normalized.resources.sideBusiness) || 0;
    normalized.resources.sideBusinessMissWeeks = Number(normalized.resources.sideBusinessMissWeeks) || 0;
    normalized.resources.english = Number(normalized.resources.english) || 0;
    normalized.resources.comprehensive = Number(normalized.resources.comprehensive) || 0;
    normalized.resources.sick = Boolean(normalized.resources.sick);
    normalized.resources.severe = Boolean(normalized.resources.severe);
    normalized.resources.medicated = Boolean(normalized.resources.medicated);
    if (!Number.isFinite(normalized.resources.staminaMax)) {
      normalized.resources.staminaMax = 100 + (studentAttributes().stamina - 5) * 5;
    }
    if (!Number.isFinite(normalized.resources.stressMax)) {
      normalized.resources.stressMax = 100 + (studentAttributes().resilience - 5) * 5;
    }
    normalized.weekPlan = normalized.weekPlan || { meal: 'canteen', activities: [] };
    normalized.weekPlan.activities = Array.isArray(normalized.weekPlan.activities)
      ? normalized.weekPlan.activities
      : [];
    normalized.courses = Array.isArray(normalized.courses) ? normalized.courses : [];
    normalized.courses.forEach(function (course) {
      course.attended = course.attended !== false;
      course.prep = Number(course.prep) || 0;
      course.progress = Number(course.progress) || 0;
      course.caughtAbsences = Number(course.caughtAbsences) || 0;
      course.quizCount = Number(course.quizCount);
      if (!Number.isFinite(course.quizCount)) {
        course.quizCount = randInt(0, 8);
      }
      course.sessions = Array.isArray(course.sessions) ? course.sessions : [];
    });
    normalized.npcs = Array.isArray(normalized.npcs) ? normalized.npcs : [];
    normalized.research = normalized.research || { mentor: null, project: null, articles: [] };
    normalized.research.articles = Array.isArray(normalized.research.articles) ? normalized.research.articles : [];
    normalized.credits = normalized.credits || { main: 0, ideology: 0, elective: 0, water: 0 };
    normalized.credits = Object.assign(
      { main: 0, ideology: 0, elective: 0, water: 0 },
      normalized.credits
    );
    normalized.flags = normalized.flags || {};
    normalized.time = normalized.time || { year: 1, term: 'autumn', week: 1 };
    normalized.time.week = clamp(Number(normalized.time.week) || 1, 1, 18);
    normalized.pendingEvent = normalized.pendingEvent || null;
    if (normalized.ending) {
      normalized.ending = normalized.ending;
    }
    return normalized;
  }

  function showToast(message) {
    if (!toastRegion) {
      return;
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = icon('info') + '<span></span>';
    toast.querySelector('span').textContent = message;
    toastRegion.innerHTML = '';
    toastRegion.appendChild(toast);
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.classList.add('is-leaving');
      window.setTimeout(function () {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 200);
    }, 3200);
  }

  /* ---------------------------------------------------------
     Registration
     --------------------------------------------------------- */

  function selectedRegistrationSpecs() {
    return IDEOLOGY.filter(function (course) {
      return ui.registration.ideology.indexOf(course.id) !== -1;
    }).concat(
      WATER.filter(function (course) {
        return ui.registration.water.indexOf(course.id) !== -1;
      }),
      ELECTIVES.filter(function (course) {
        return ui.registration.elective.indexOf(course.id) !== -1;
      })
    );
  }

  function registrationMainSpecs() {
    return GD.firstYearPlan.autumn.fullYear
      .concat(GD.firstYearPlan.autumn.seasonal)
      .map(function (id) { return findSpec(id); })
      .filter(Boolean);
  }

  function registrationPeriodCount() {
    return registrationMainSpecs()
      .concat(selectedRegistrationSpecs())
      .reduce(function (sum, spec) {
        return sum + courseWeeklyPeriods(spec);
      }, 0);
  }

  function renderRegistration() {
    const mainSpecs = registrationMainSpecs();
    const selectedStudy = selectedRegistrationSpecs();
    const periods = registrationPeriodCount();
    const freeTime = 30 + Math.max(0, 78 - periods);
    const student = save.student;
    const family = findFamily(student.family);
    const school = findSchool(student.school);
    const talent = findTalent(student.talent);
    const genderButtons = [
      { key: 'male', label: '男' },
      { key: 'female', label: '女' }
    ]
      .map(function (option) {
        return (
          '<button type="button" class="mg-genre-btn' +
          (ui.registration.gender === option.key ? ' is-selected' : '') +
          '" data-action="reg-gender" data-gender="' +
          option.key +
          '" aria-pressed="' +
          (ui.registration.gender === option.key) +
          '">' +
          option.label +
          '</button>'
        );
      })
      .join('');

    function renderChoice(spec, kind) {
      const chosen =
        kind === 'ideology'
          ? ui.registration.ideology
          : kind === 'elective'
            ? ui.registration.elective
            : ui.registration.water;
      const selected = chosen.indexOf(spec.id) !== -1;
      const unavailable = !spec.credits;
      const periodsFor = courseWeeklyPeriods(spec);
      return (
        '<button type="button" class="mg-choice' +
        (selected ? ' is-selected' : '') +
        (unavailable ? ' is-unavailable' : '') +
        '" data-action="reg-toggle-' +
        kind +
        '" data-id="' +
        spec.id +
        '" aria-pressed="' +
        selected +
        '"' +
        (unavailable ? ' disabled' : '') +
        '>' +
        '<span class="mg-choice-check">' +
        icon('check') +
        '</span>' +
        '<span class="mg-choice-copy"><b>' +
        escapeHTML(spec.fullName || spec.name) +
        '</b><span>' +
        (unavailable
          ? '学分待定 · 暂不可选'
          : spec.credits + ' 学分 · ' + spec.weeks + ' 周 · 每周 ' + periodsFor + ' 课时') +
        '</span></span>' +
        '</button>'
      );
    }

    return (
      '<div class="mg-registration">' +
      '<header class="mg-registration-header"><div class="mg-registration-header-inner">' +
      '<a class="mg-brand" href="index.html">' +
      '<span class="brand-mark" aria-hidden="true"><span></span></span>' +
      '<span class="brand-text"><strong>医学生模拟器</strong><small>UNDERGRADUATE REGISTRATION</small></span>' +
      '</a>' +
      '<span class="mg-kicker" style="color:var(--red-soft);">FORMAL ENTRY / 正式开局</span>' +
      '</div></header>' +
      '<main id="game-main" class="mg-registration-main">' +
      '<div class="mg-registration-head">' +
      '<span class="mg-kicker">ACADEMIC YEAR 01 · AUTUMN / WINTER</span>' +
      '<h1>第一张课表。</h1>' +
      '<p>主修课已经由学院排定。思政、水课与选修课，需要你根据本学期的课时容量自己决定。选修课均为 8 周，第 9 周考试；修满 10 学分即可。</p>' +
      '</div>' +
      '<div class="mg-registration-body">' +
      '<div>' +
      '<section class="mg-registration-section">' +
      '<div class="mg-registration-section-head"><h2>' +
      icon('book') +
      '主修课 · 学院已排</h2><span>WEEKLY PERIODS / 16 TEACHING WEEKS</span></div>' +
      '<div class="mg-fixed-course-list">' +
      mainSpecs
        .map(function (spec) {
          return (
            '<span class="mg-fixed-course">' +
            escapeHTML(spec.name) +
            '<span>' +
            courseWeeklyPeriods(spec) +
            ' 课时/周</span></span>'
          );
        })
        .join('') +
      '</div>' +
      '<div class="mg-inline-note">' +
      icon('info') +
      '<span>实验课按标注学分计算学时：2 学分实验课占 4 课时/周。秋冬学期的 16 周课程从第 1 周开始。</span>' +
      '</div>' +
      '</section>' +
      '<section class="mg-registration-section">' +
      '<div class="mg-registration-section-head"><h2>' +
      icon('book') +
      '思政课</h2><span>IDEOLOGICAL COURSES / 全年可修</span></div>' +
      '<div class="mg-choice-grid">' +
      IDEOLOGY.map(function (spec) { return renderChoice(spec, 'ideology'); }).join('') +
      '</div>' +
      '</section>' +
      '<section class="mg-registration-section">' +
      '<div class="mg-registration-section-head"><h2>' +
      icon('book') +
      '水课</h2><span>WATER COURSES / 全年可修</span></div>' +
      '<div class="mg-choice-grid">' +
      WATER.map(function (spec) { return renderChoice(spec, 'water'); }).join('') +
      '</div>' +
      '<div class="mg-inline-note">' +
      icon('info') +
      '<span>《自媒体发展与实践》2 学分 / 16 周，《博弈论》3 学分 / 16 周，已可正常选课。</span>' +
      '</div>' +
      '</section>' +
      '<section class="mg-registration-section">' +
      '<div class="mg-registration-section-head"><h2>' +
      icon('book') +
      '选修课</h2><span>ELECTIVE COURSES / 均为 8 周</span></div>' +
      '<div class="mg-choice-grid is-scrollable">' +
      ELECTIVES.map(function (spec) { return renderChoice(spec, 'elective'); }).join('') +
      '</div>' +
      '<div class="mg-inline-note">' +
      icon('info') +
      '<span>选修课修满 10 学分即可。8 周课程在第 9 周结束并考试；列表中可上下滚动。</span>' +
      '</div>' +
      '</section>' +
      '<section class="mg-registration-section">' +
      '<div class="mg-registration-section-head"><h2>' +
      icon('users') +
      '登记信息</h2><span>用于人际与恋爱判定</span></div>' +
      '<div class="mg-genre-row">' +
      genderButtons +
      '</div>' +
      '<div class="mg-inline-note">' +
      icon('info') +
      '<span>性别只影响 NPC 表白概率与恋爱事件，不会改变课程数值。</span>' +
      '</div>' +
      '</section>' +
      '</div>' +
      '<aside class="mg-registration-aside"><div class="mg-registration-aside-inner">' +
      '<span class="mg-kicker">NEW STUDENT FILE / 选课预览</span>' +
      '<h2>' +
      escapeHTML(student.name || '你') +
      '</h2>' +
      '<div class="mg-registration-profile">' +
      '<div><span>天资</span><b>' + escapeHTML(talent ? talent.name : '—') + '</b></div>' +
      '<div><span>院校</span><b>' + escapeHTML(school ? school.name : '—') + '</b></div>' +
      '<div><span>家庭</span><b>' + escapeHTML(family ? family.name : '—') + '</b></div>' +
      '<div><span>专业</span><b>临床医学 · 本科</b></div>' +
      '</div>' +
      '<div class="mg-registration-budget"><strong>' +
      periods +
      '</strong><span>课时 / 周<br>主修 + 已选课程</span></div>' +
      '<p class="mg-registration-budget-sub">本学期空闲课时：<b style="color:var(--ink-soft);font-weight:500;">' +
      freeTime +
      '</b>（30 + 未被课程占用的课时）</p>' +
      '<div class="mg-registration-actions">' +
      '<button type="button" class="btn btn-primary" data-action="confirm-registration">确认课表 · 开始第 1 周' +
      icon('arrow-right', 'icon-arrow') +
      '</button>' +
      '</div>' +
      '<p class="mg-registration-note">确认后进入秋冬学期第 1 周。' +
      (periods > 78 ? '<br><span style="color:var(--red-soft);">已超过每周 78 课时容量。</span>' : '') +
      '</p>' +
      '</div></aside>' +
      '</div>' +
      '</main>' +
      '</div>'
    );
  }

  function createInitialGame() {
    const attributes = studentAttributes();
    const maxStamina = maxStaminaFor(attributes);
    const maxStress = maxStressFor(attributes);
    const family = findFamily(save.student.family);
    const school = findSchool(save.student.school);
    const familyKey = family ? family.key : null;
    const startMoney = family ? family.money : 0;
    const selectedIdeology = IDEOLOGY.filter(function (spec) {
      return ui.registration.ideology.indexOf(spec.id) !== -1;
    });
    const selectedWater = WATER.filter(function (spec) {
      return ui.registration.water.indexOf(spec.id) !== -1;
    });
    const selectedElectives = ELECTIVES.filter(function (spec) {
      return ui.registration.elective.indexOf(spec.id) !== -1;
    });
    const mainSpecs = registrationMainSpecs();

    const courses = [];
    mainSpecs.forEach(function (spec) {
      courses.push(buildCourse(spec, 'main', 1));
    });
    selectedIdeology.forEach(function (spec) {
      courses.push(buildCourse(spec, 'ideology', 1));
    });
    selectedWater.forEach(function (spec) {
      courses.push(buildCourse(spec, 'water', 1));
    });
    selectedElectives.forEach(function (spec) {
      courses.push(buildCourse(spec, 'elective', 1));
    });
    layoutCourseSessions(courses);

    const npcList = NPCS.filter(function (npc) {
      return npc.met;
    }).map(function (npc) {
      return Object.assign({}, npc, {
        favor: clamp(npc.favor + (hasAbility('dreamer') ? 10 : 0), 0, 100),
        lover: false
      });
    });

    let mentor = null;
    let research = {
      mentor: null,
      project: null,
      articles: []
    };

    if (familyKey === 'medical') {
      const mentorLevel = GD.mentorLevels.professor;
      const mentorNpc = {
        id: 'npc-mentor',
        name: '顾衡',
        role: '导师',
        gender: 'male',
        orientation: 'heterosexual',
        orientationLabel: '异性恋',
        favor: clamp(40 + (hasAbility('dreamer') ? 10 : 0), 0, 100),
        met: true,
        mentor: true,
        level: mentorLevel.key,
        levelName: mentorLevel.name,
        note: '医学院教授，父亲当年的同门。说话很慢，提问却总在你答完之后。'
      };
      npcList.push(mentorNpc);
      mentor = {
        npcId: mentorNpc.id,
        name: mentorNpc.name,
        level: mentorLevel.key,
        levelName: mentorLevel.name,
        rank: mentorLevel.rank,
        guidanceChance: mentorLevel.guidanceChance,
        guidanceRange: mentorLevel.guidanceRange,
        favor: mentorNpc.favor
      };
      research.mentor = mentor;
      research.project = createResearchProject(school, mentor, attributes);
    }

    const playerName = save.student.name || '你';
    game = {
      version: GAME_VERSION,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      time: { year: 1, term: 'autumn', week: 1 },
      player: {
        gender: ui.registration.gender,
        name: playerName
      },
      flags: {
        family: familyKey,
        school: school ? school.key : null
      },
      resources: {
        stamina: maxStamina,
        stress: 0,
        staminaMax: maxStamina,
        stressMax: maxStress,
        money: startMoney,
        health: 100,
        healthMax: 100,
        sideBusiness: 0,
        sideBusinessMissWeeks: 0,
        english: 0,
        comprehensive: 0,
        sick: false,
        severe: false,
        medicated: false,
        overStressCount: 0
      },
      courses: courses,
      credits: { main: 0, ideology: 0, elective: 0, water: 0 },
      failedCourses: [],
      weekPlan: {
        meal: 'canteen',
        activities: []
      },
      npcs: npcList,
      research: research,
      history: [],
      pendingReport: null,
      pendingEvent: null,
      termComplete: false,
      ending: null,
      nextActivityId: 1
    };

    save.game = game;
    persist();
    ui.tab = 'courses';
    showToast('课表已生成。第 1 周开始。');
    render({ scroll: 'top' });
  }

  /* ---------------------------------------------------------
     Course construction & timetable layout
     --------------------------------------------------------- */

  function buildCourse(spec, category, startBlock) {
    const weeklyPeriods = courseWeeklyPeriods(spec);
    const weeks = Number(spec.weeks) || 16;
    const examWeek = weeks <= 8 ? 9 : 18;
    return {
      id: spec.id,
      specId: spec.id,
      name: spec.name,
      fullName: spec.fullName || spec.name,
      category: category,
      lab: Boolean(spec.lab),
      credits: Number(spec.credits) || 0,
      weeks: weeks,
      weeklyPeriods: weeklyPeriods,
      startWeek: startBlock === 2 ? 10 : 1,
      endWeek: weeks <= 8 ? 8 : 17,
      examWeek: examWeek,
      block: startBlock || 1,
      attended: true,
      prep: 0,
      progress: 0,
      caughtAbsences: 0,
      attendanceFail: false,
      quizCount: randInt(0, 8),
      sessions: [],
      status: 'active',
      completed: false,
      completedWeek: null,
      grade: null
    };
  }

  function layoutCourseSessions(courses) {
    const grid = Array.from({ length: 6 }, function () {
      return new Array(13).fill(null);
    });
    const ordered = courses.slice().sort(function (a, b) {
      return b.weeklyPeriods - a.weeklyPeriods;
    });
    const preferredStarts = {
      2: [1, 3, 6, 8],
      3: [3, 8, 11]
    };

    function findOpening(length) {
      const days = [0, 1, 2, 3, 4, 5];
      const starts = preferredStarts[length] || [1, 3, 6, 8, 11];
      for (let di = 0; di < days.length; di += 1) {
        const day = days[(di + courses.length) % days.length];
        for (let si = 0; si < starts.length; si += 1) {
          const start = starts[si];
          let free = true;
          for (let p = 0; p < length; p += 1) {
            if (start + p > 13 || grid[day][start + p - 1]) {
              free = false;
              break;
            }
          }
          if (free) {
            return { day: day, start: start, length: length };
          }
        }
      }
      for (let day = 0; day < 6; day += 1) {
        for (let start = 1; start <= 14 - length; start += 1) {
          let free = true;
          for (let p = 0; p < length; p += 1) {
            if (grid[day][start + p - 1]) {
              free = false;
              break;
            }
          }
          if (free) {
            return { day: day, start: start, length: length };
          }
        }
      }
      return { day: 0, start: 1, length: length };
    }

    ordered.forEach(function (course, courseIndex) {
      let remaining = Math.round(course.weeklyPeriods);
      const chunks = [];
      while (remaining > 0) {
        if (remaining === 1) {
          chunks.push(1);
          remaining -= 1;
        } else if (remaining % 2 === 1) {
          chunks.push(3);
          remaining -= 3;
        } else {
          chunks.push(2);
          remaining -= 2;
        }
      }
      course.sessions = [];
      chunks.forEach(function (length, chunkIndex) {
        const opening = findOpening(length);
        const shift = (courseIndex + chunkIndex + courses.length) % 6;
        const day = (opening.day + shift) % 6;
        let actual = null;
        for (let offsetDay = 0; offsetDay < 6; offsetDay += 1) {
          const tryDay = (day + offsetDay) % 6;
          let free = true;
          for (let p = 0; p < length; p += 1) {
            if (tryDay < 0 || opening.start + p > 13 || grid[tryDay][opening.start + p - 1]) {
              free = false;
              break;
            }
          }
          if (free) {
            actual = { day: tryDay, start: opening.start, length: length };
            break;
          }
        }
        if (!actual) {
          actual = findOpening(length);
        }
        for (let p = 0; p < length; p += 1) {
          grid[actual.day][actual.start + p - 1] = course.id;
        }
        course.sessions.push(actual);
      });
    });
  }

  /* ---------------------------------------------------------
     Research helpers
     --------------------------------------------------------- */

  function articleLevelFromScore(score, attributes) {
    let index = 0;
    if (score >= 8) {
      index = 3;
    } else if (score >= 6) {
      index = 2;
    } else if (score >= 4) {
      index = 1;
    } else {
      index = 0;
    }
    const wisdom = Number(attributes.comprehension) || 3;
    for (let point = 6; point <= wisdom; point += 1) {
      if (Math.random() < 0.1) {
        index = Math.min(index + 1, GD.articleLevels.length - 1);
      }
    }
    const level = GD.articleLevels[index];
    return {
      key: level.key,
      name: level.name,
      requirement: level.baseProgress,
      journal:
        level.key === 'super-top'
          ? pickRandom(GD.topJournals)
          : level.key === 'top'
            ? '顶刊'
            : level.name
    };
  }

  function createResearchProject(school, mentor, attributes) {
    const schoolRank = GD.schoolRanks[school ? school.key : 'tier2'] || 1;
    const mentorRank = mentor ? mentor.rank : 1;
    const level = articleLevelFromScore(schoolRank + mentorRank, attributes);
    return {
      title: level.name + '课题',
      articleLevel: level.name,
      articleKey: level.key,
      journal: level.journal,
      requirement: level.requirement,
      progress: 0
    };
  }

  /* ---------------------------------------------------------
     Rendering root
     --------------------------------------------------------- */

  function render(options) {
    const opts = options || {};
    const previousScroll = window.scrollY;
    let mainMarkup = '';

    if (!save) {
      mainMarkup = renderFatal(
        '没有找到新生档案',
        '请先回到封面完成人物创建与序章，再进入本科阶段。'
      );
    } else if (game && game.ending) {
      mainMarkup = renderEndingScreen();
    } else if (game) {
      mainMarkup = renderDashboard();
    } else {
      mainMarkup = renderRegistration();
    }

    app.innerHTML = mainMarkup;
    const showModal = Boolean(ui.modal) && !(game && game.ending);
    modalRoot.innerHTML = showModal ? renderModal() : '';
    document.body.classList.toggle('is-locked', showModal);

    if (game) {
      document.title =
        '本科 · 第 ' + game.time.week + ' 周 | 医学生模拟器';
    } else if (save) {
      document.title = '本科选课 · 第一学期 | 医学生模拟器';
    } else {
      document.title = '未找到学籍档案 | 医学生模拟器';
    }

    if (opts.focus) {
      const focusTarget = document.querySelector(opts.focus);
      if (focusTarget) {
        focusTarget.focus({ preventScroll: true });
      }
    }
    if (opts.scroll === 'top') {
      window.scrollTo(0, 0);
    } else if (typeof opts.scroll === 'number') {
      window.scrollTo(0, opts.scroll);
    } else {
      window.scrollTo(0, previousScroll);
    }
  }

  function renderFatal(title, message) {
    return (
      '<main class="mg-fatal" id="game-main">' +
      '<h1>' + escapeHTML(title) + '</h1>' +
      '<p>' + escapeHTML(message) + '</p>' +
      '<a class="btn btn-primary" href="index.html">返回封面' + icon('arrow-right') + '</a>' +
      '</main>'
    );
  }

  function renderTabs() {
    return (
      '<nav class="mg-tabs" aria-label="本科阶段内容">' +
      TABS.map(function (tab) {
        return (
          '<button type="button" class="mg-tab' +
          (ui.tab === tab.key ? ' is-current' : '') +
          '" data-action="switch-tab" data-tab="' +
          tab.key +
          '" aria-current="' +
          (ui.tab === tab.key ? 'page' : 'false') +
          '">' +
          icon(tab.icon) +
          '<span>' +
          tab.label +
          '</span>' +
          (tab.key === 'research' && game.research.project
            ? '<span class="mg-tab-badge">' + Math.floor((game.research.project.progress / game.research.project.requirement) * 100) + '%</span>'
            : '') +
          '</button>'
        );
      }).join('') +
      '</nav>'
    );
  }

  function renderDashboard() {
    const projection = projectWeek();
    const attributes = studentAttributes();
    const health = describeHealth();
    const countdown = currentExamCountdown();
    const validation = weekValidation();
    const staminaPct = clamp((game.resources.stamina / game.resources.staminaMax) * 100, 0, 100);
    const stressPct = clamp((game.resources.stress / game.resources.stressMax) * 100, 0, 100);
    const stressOver = game.resources.stress >= game.resources.stressMax;
    const startLabel = game.termComplete
      ? '本学期已结束'
      : isReviewWeek(game)
        ? '结束复习周 · 参加考试'
        : '开始本周 · 提交安排';
    const view = (function () {
      switch (ui.tab) {
        case 'week':
          return renderWeekView(projection);
        case 'research':
          return renderResearchView();
        case 'relations':
          return renderRelationsView();
        case 'grades':
          return renderGradesView();
        case 'attributes':
          return renderAttributesView();
        default:
          return renderCoursesView();
      }
    })();

    const healthChip = health.key !== 'normal'
      ? '<span class="mg-health-chip">' + icon('heart') + health.label + '</span>'
      : '';

    return (
      '<div class="mg-shell">' +
      '<header class="mg-header"><div class="mg-header-inner">' +
      '<a class="mg-brand" href="index.html">' +
      '<span class="brand-mark" aria-hidden="true"><span></span></span>' +
      '<span class="brand-text"><strong>医学生模拟器</strong><small>UNDERGRADUATE FILE</small></span>' +
      '</a>' +
      '<div class="mg-term-block">' +
      '<span class="mg-kicker">ACADEMIC YEAR 01 / ' + escapeHTML(currentTermDef().name) + '</span>' +
      '<div class="mg-term-line"><h1>第一学年 · ' + escapeHTML(currentTermDef().name) + '</h1><span>第 ' +
      game.time.week +
      ' 周 / 18</span></div>' +
      '<span class="mg-exam-clock">' +
      (countdown === null
        ? '暂无待考课程'
        : countdown === 0
          ? '本周有考试'
          : '距下次考试 ' + countdown + ' 周') +
      '</span>' +
      '</div>' +
      '<div class="mg-header-tools">' +
      healthChip +
      '<button type="button" class="mg-money-btn" data-action="open-shop" aria-label="打开商店">' +
      '<span class="mg-money-copy"><span>可用资金</span><strong>' +
      formatMoney(game.resources.money) +
      '</strong></span>' +
      icon('coin') +
      '</button>' +
      '</div>' +
      '</div></header>' +
      '<div class="mg-vitals">' +
      '<div class="mg-meter stamina' + (projection.staminaAfter < 0 ? ' is-over' : '') + '">' +
      '<div class="mg-meter-head"><span class="mg-meter-label">' + icon('bolt') + '体力</span>' +
      '<span class="mg-meter-numbers"><b>' + Math.round(game.resources.stamina) + '</b><small> / ' +
      Math.round(game.resources.staminaMax) +
      '</small><span class="mg-meter-delta ' +
      (projection.staminaDelta < 0 ? 'is-down' : projection.staminaDelta > 0 ? 'is-up' : '') +
      '">本周 ' + signed(projection.staminaDelta) + '</span></span></div>' +
      '<div class="mg-meter-track"><i style="width:' + staminaPct + '%"></i></div>' +
      '</div>' +
      '<div class="mg-meter stress' + (stressOver || projection.stressAfter > game.resources.stressMax ? ' is-over' : '') + '">' +
      '<div class="mg-meter-head"><span class="mg-meter-label">' + icon('shield') + '压力</span>' +
      '<span class="mg-meter-numbers"><b>' + Math.round(game.resources.stress) + '</b><small> / ' +
      Math.round(game.resources.stressMax) +
      '</small><span class="mg-meter-delta ' +
      (projection.stressDelta > 0 ? 'is-down' : projection.stressDelta < 0 ? 'is-up' : '') +
      '">本周 ' + signed(projection.stressDelta) + '</span></span></div>' +
      '<div class="mg-meter-track"><i style="width:' + stressPct + '%"></i></div>' +
      '</div>' +
      '<div class="mg-vital-side">' +
      '<div class="mg-week-status"><span>' + (isReviewWeek(game) ? 'REVIEW WEEK' : 'EDUCATION WEEK') + '</span><b>' +
      (isReviewWeek(game) ? '复习与考试' : '第 ' + game.time.week + ' 教学周') +
      '</b></div>' +
      '<button type="button" class="mg-header-return" data-action="return-cover">' + icon('arrow-left') + '保存并离开</button>' +
      '</div>' +
      '</div>' +
      '<main class="mg-main" id="game-main">' +
      renderTabs() +
      '<div class="mg-week-summary">' +
      '<div class="mg-summary-cell"><span class="mg-summary-label">体力变化</span><b class="' +
      (projection.staminaDelta < 0 ? 'is-negative' : projection.staminaDelta > 0 ? 'is-positive' : '') +
      '">' + signed(projection.staminaDelta) + '</b><small>本周预计</small></div>' +
      '<div class="mg-summary-cell"><span class="mg-summary-label">压力变化</span><b class="' +
      (projection.stressDelta > 0 ? 'is-negative' : projection.stressDelta < 0 ? 'is-positive' : '') +
      '">' + signed(projection.stressDelta) + '</b><small>本周预计</small></div>' +
      '<div class="mg-summary-cell"><span class="mg-summary-label">金钱变化</span><b class="' +
      (projection.moneyDelta < 0 ? 'is-negative' : projection.moneyDelta > 0 ? 'is-positive' : '') +
      '">' + signed(Math.round(projection.moneyDelta), ' 元') + '</b><small>不含家庭支持</small></div>' +
      '<div class="mg-summary-cell"><span class="mg-summary-label">空闲课时</span><b>' +
      projection.freeTime +
      '</b><small>已排 ' + projection.planTime + '</small></div>' +
      '</div>' +
      '<section class="mg-view">' +
      (game.termComplete
        ? '<div class="mg-week-note" style="margin-bottom:18px;">' +
          icon('info') +
          '秋冬学期已经结束。成绩、GPA 与学分已经写入档案；春夏学期将在下一阶段接入。</div>'
        : '') +
      view +
      '</section>' +
      '</main>' +
      '<footer class="mg-footer"><div class="mg-footer-inner">' +
      '<div class="mg-footer-left">' +
      '<button type="button" class="mg-dropout" data-action="dropout">退学</button>' +
      '<span class="mg-footer-hint">' +
      (validation
        ? '<strong style="color:var(--mg-red);">' + escapeHTML(validation) + '</strong>'
        : '<strong>' + (isReviewWeek(game) ? '复习周无课程，考试已就绪' : '课程与安排已就绪') + '</strong>') +
      '</span>' +
      '</div>' +
      '<button type="button" class="mg-start-week" data-action="start-week"' +
      (validation || game.pendingReport || game.termComplete ? ' disabled' : '') +
      '>' + startLabel + icon('arrow-right') + '</button>' +
      '</div></footer>' +
      '</div>'
    );
  }

  /* ---------------------------------------------------------
     Course view
     --------------------------------------------------------- */

  function renderCourseRow(course) {
    const active = courseIsTeachingThisWeek(course, game);
    const completed = course.completed;
    const canToggle = active && !completed;
    const lag = course.progress - course.prep;
    const prepPct = clamp(course.prep, 0, 100);
    const progressPct = clamp(course.progress, 0, 100);
    const category = categoryLabel(course.category);
    return (
      '<article class="mg-course' +
      (!course.attended && canToggle ? ' is-skipped' : '') +
      '">' +
      '<button type="button" class="mg-attend ' +
      (completed ? 'is-off' : course.attended ? 'is-on' : 'is-off') +
      '" data-action="toggle-course" data-id="' +
      course.id +
      '"' +
      (canToggle ? '' : ' disabled') +
      ' aria-pressed="' +
      Boolean(course.attended && !completed) +
      '">' +
      '<span class="mg-attend-top"><span class="mg-attend-dot"></span>' +
      (completed
        ? '已结课'
        : !active
          ? isReviewWeek(game)
            ? '考试周'
            : '已结束'
          : course.attended
            ? '出勤'
            : '翘课') +
      '</span>' +
      '<small>' +
      (completed
        ? '成绩 ' + (course.grade ? course.grade.score : '—')
        : canToggle
          ? '点击切换'
          : '—') +
      '</small></button>' +
      '<div class="mg-course-main">' +
      '<div class="mg-course-top"><span class="mg-course-name">' +
      escapeHTML(course.name) +
      '</span><span class="mg-cat ' +
      course.category +
      '">' +
      category +
      '</span>' +
      (course.lab ? '<span class="mg-cat lab">实验</span>' : '') +
      (course.caughtAbsences ? '<span class="mg-cat ideology">缺勤记录 ' + course.caughtAbsences + '/3</span>' : '') +
      '</div>' +
      '<div class="mg-course-meta"><span>' +
      course.credits +
      ' 学分</span><span>' +
      course.weeks +
      ' 周</span><span>' +
      course.weeklyPeriods +
      ' 课时/周</span><span>第 ' +
      course.examWeek +
      ' 周考试</span></div>' +
      '<div class="mg-course-sessions">' + icon('clock') + ' <b>' +
      escapeHTML(sessionText(course)) +
      '</b></div>' +
      '</div>' +
      '<div class="mg-course-side">' +
      '<div class="mg-course-progress-label"><span>课程进度</span><b>' +
      Math.round(progressPct) +
      '%</b></div>' +
      '<div class="mg-course-progress-track"><i style="width:' +
      progressPct +
      '%"></i></div>' +
      '<div class="mg-course-progress-label"><span>我的准备度</span><b>' +
      Math.round(prepPct) +
      '%</b></div>' +
      '<div class="mg-course-progress-track health"><i style="width:' +
      prepPct +
      '%"></i></div>' +
      '<div class="mg-course-lag ' +
      (lag > 8 ? 'is-behind' : '') +
      '">' +
      (completed
        ? '课程已结束'
        : lag > 0
          ? '落后进度 <b>' + Math.round(lag) + '</b> 点'
          : '准备度与进度同步') +
      '</div>' +
      '</div>' +
      '</article>'
    );
  }

  function renderCoursesView() {
    const allCourses = game.courses;
    const prepCourses = allCourses.filter(function (course) {
      return !course.completed;
    });
    return (
      '<div class="mg-section-head">' +
      '<div><span class="mg-kicker">COURSE REGISTRY / ' +
      escapeHTML(currentTermDef().name) +
      '</span><h2>本学期课程表</h2><p>点击每门课的出勤状态切换本周是否上课。出勤会按记忆力与悟性增加课程准备度；缺勤会随机触发点名。</p></div>' +
      '<div class="mg-head-aside"><span>COURSES / 学分</span><b>' +
      allCourses.length +
      ' 门 · ' +
      allCourses.reduce(function (sum, course) { return sum + course.credits; }, 0) +
      ' 学分</b></div>' +
      '</div>' +
      (isReviewWeek(game)
        ? '<div class="mg-week-note" style="margin-bottom:14px;">' + icon('info') + '本周是复习与考试周，没有课程出勤。可以在「本周安排」里把空闲时间投入复习。</div>'
        : '') +
      '<div class="mg-course-layout">' +
      '<aside class="mg-prep-rail"><div class="mg-prep-rail-head"><span>COURSE READINESS</span><b>准备度总览</b></div>' +
      '<div class="mg-prep-list">' +
      prepCourses
        .map(function (course) {
          const lag = course.progress - course.prep;
          return (
            '<div class="mg-prep-item' +
            (lag > 8 ? ' is-lagging' : '') +
            '"><div class="mg-prep-line"><span>' +
            escapeHTML(course.name) +
            '</span><b>' +
            Math.round(course.prep) +
            '%</b></div><div class="mg-prep-track"><i style="width:' +
            clamp(course.prep, 0, 100) +
            '%"></i></div></div>'
          );
        })
        .join('') +
      '</div></aside>' +
      '<div class="mg-course-list">' +
      allCourses.map(renderCourseRow).join('') +
      '</div>' +
      '</div>' +
      '<div class="mg-inline-note">' + icon('info') + '<span>课程进度按教学周自动推进；准备度来自出勤与复习。两者之间的差距会影响小测、作业和考试。</span></div>'
    );
  }

  /* ---------------------------------------------------------
     Week view
     --------------------------------------------------------- */

  function courseOptions(selectedId, allowAll) {
    return (
      (allowAll ? '<option value="all"' + (selectedId === 'all' ? ' selected' : '') + '>平均分配到所有课程</option>' : '') +
      openCoursesForStudy()
        .map(function (course) {
          return (
            '<option value="' +
            course.id +
            '"' +
            (selectedId === course.id ? ' selected' : '') +
            '>' +
            escapeHTML(course.name) +
            '</option>'
          );
        })
        .join('')
    );
  }

  function npcOptions(selectedId) {
    return game.npcs
      .map(function (npc) {
        return (
          '<option value="' +
          npc.id +
          '"' +
          (selectedId === npc.id ? ' selected' : '') +
          '>' +
          escapeHTML(npc.name) +
          ' · ' +
          describeRelationship(npc.favor) +
          '</option>'
        );
      })
      .join('');
  }

  function activityAvailability(activityKey, projection) {
    const def = findActivityDef(activityKey);
    if (!def) {
      return '活动不存在';
    }
    if (activityKey === 'lab' && (!game.research.mentor || !game.research.project)) {
      return '尚未加入实验室';
    }
    if (projection.planTime + def.cost > projection.freeTime) {
      return '空闲课时不足';
    }
    if (def.moneyPerNpc && game.resources.money < def.moneyPerNpc) {
      return '资金不足';
    }
    if ((def.target === 'course' || def.target === 'course-or-all') && !openCoursesForStudy().length) {
      return '暂无可复习课程';
    }
    return '';
  }

  function renderMealCard(meal, projection) {
    const current = game.weekPlan.meal === meal.key;
    const price = getFamilyMealPrice(meal);
    return (
      '<button type="button" class="mg-meal' +
      (current ? ' is-current' : '') +
      '" data-action="choose-meal" data-key="' +
      meal.key +
      '" aria-pressed="' +
      current +
      '">' +
      '<span class="mg-meal-top"><h4>' +
      escapeHTML(meal.name) +
      '</h4><span class="mg-meal-price">' +
      (price === 0 ? '免费' : formatMoney(price)) +
      '</span></span>' +
      '<p>' +
      escapeHTML(meal.desc) +
      '</p>' +
      '<span class="mg-meal-effects">' +
      (meal.stamina
        ? '<span class="' + (meal.stamina < 0 ? 'neg' : 'pos') + '">体力 ' + signed(meal.stamina) + '</span>'
        : '') +
      (meal.stress
        ? '<span class="' + (meal.stress > 0 ? 'neg' : 'pos') + '">压力 ' + signed(meal.stress) + '</span>'
        : '') +
      (meal.health < 0 ? '<span class="neg">身体透支</span>' : '') +
      '</span>' +
      '</button>'
    );
  }

  function activityTargetControl(def) {
    if (def.target === 'course' || def.target === 'course-or-all') {
      const selected = ui.targets[def.key] || (def.target === 'course-or-all' ? 'all' : (openCoursesForStudy()[0] || {}).id) || '';
      return (
        '<select class="mg-activity-target" data-plan-target="' +
        def.key +
        '" aria-label="选择' +
        escapeHTML(def.name) +
        '课程">' +
        courseOptions(selected, def.target === 'course-or-all') +
        '</select>'
      );
    }
    if (def.npc) {
      const selected = ui.targets[def.key] || (game.npcs[0] || {}).id || '';
      return (
        '<select class="mg-activity-target" data-plan-target="' +
        def.key +
        '" aria-label="选择社交对象">' +
        npcOptions(selected) +
        '</select>'
      );
    }
    return '';
  }

  function renderActivityCard(def, projection) {
    if (def.key === 'lab' && !game.research.mentor) {
      return '';
    }
    const reason = activityAvailability(def.key, projection);
    return (
      '<article class="mg-activity">' +
      '<div class="mg-activity-top"><div class="mg-activity-name"><h4>' +
      escapeHTML(def.name) +
      '</h4><span>' +
      (def.target === 'course' || def.target === 'course-or-all' ? 'COURSE STUDY' : def.npc ? 'SOCIAL' : 'FREE TIME') +
      '</span></div><span class="mg-activity-cost">' +
      def.cost +
      ' 点</span></div>' +
      '<p>' +
      escapeHTML(def.desc) +
      '</p>' +
      activityTargetControl(def) +
      '<button type="button" class="mg-add-btn" data-action="add-activity" data-key="' +
      def.key +
      '"' +
      (reason ? ' disabled' : '') +
      '>' +
      (reason || '加入本周安排') +
      icon('plus') +
      '</button>' +
      '</article>'
    );
  }

  function renderPlanAside(projection) {
    const over = projection.planTime > projection.freeTime;
    const list = game.weekPlan.activities;
    return (
      '<aside class="mg-plan-aside">' +
      '<div class="mg-plan-aside-head"><span>WEEK PLAN / 已安排</span><b>' +
      list.length +
      ' 项</b></div>' +
      '<div class="mg-free-budget"><div class="mg-free-budget-main"><strong>' +
      Math.max(0, projection.freeTime - projection.planTime) +
      '</strong><span>剩余空闲课时 / 共 ' +
      projection.freeTime +
      ' 点</span></div><div class="mg-free-budget-track"><i class="' +
      (over ? 'is-over' : '') +
      '" style="width:' +
      clamp(projection.freeTime ? (projection.planTime / projection.freeTime) * 100 : 0, 0, 100) +
      '%"></i></div><small>已用 ' +
      projection.planTime +
      ' 点' +
      (over ? ' · 超出 ' + (projection.planTime - projection.freeTime) + ' 点' : '') +
      '</small></div>' +
      '<div class="mg-plan-items">' +
      (list.length
        ? list
            .map(function (item) {
              return (
                '<div class="mg-plan-item"><div class="mg-plan-item-main"><b>' +
                escapeHTML(planItemLabel(item)) +
                '</b><span>' +
                planCost(item) +
                ' 点空闲' +
                (planStamina(item) ? ' · 体力 ' + signed(planStamina(item)) : '') +
                (planStress(item) ? ' · 压力 ' + signed(planStress(item)) : '') +
                (planMoney(item) ? ' · 金钱 ' + signed(planMoney(item), ' 元') : '') +
                '</span></div><button type="button" class="mg-plan-remove" data-action="remove-activity" data-id="' +
                item.id +
                '" aria-label="移除这项安排">' +
                icon('close') +
                '</button></div>'
              );
            })
            .join('')
        : '<div class="mg-plan-empty">还没有安排本周的空余时间。</div>') +
      '</div>' +
      '<div class="mg-plan-totals">' +
      '<div class="mg-plan-total-line"><span>安排消耗空闲</span><b>' +
      projection.planTime +
      ' / ' +
      projection.freeTime +
      '</b></div>' +
      '<div class="mg-plan-total-line"><span>本周金钱变化</span><b class="' +
      (projection.moneyDelta < 0 ? 'neg' : projection.moneyDelta > 0 ? 'pos' : '') +
      '">' +
      signed(Math.round(projection.moneyDelta), ' 元') +
      '</b></div>' +
      (over
        ? '<div class="mg-warning">' + icon('warning') + '<span>空闲课时不足，请移除部分安排，或翘掉更多课程来腾出时间。</span></div>'
        : '') +
      '</div>' +
      '</aside>'
    );
  }

  function renderTermCompleteSummary() {
    const gpa = currentGpa();
    const graded = game.courses.filter(function (course) { return course.completed; });
    return (
      '<div class="mg-section-head"><div><span class="mg-kicker">TERM COMPLETE / 秋冬学期</span><h2>这一学期结束了。</h2><p>18 周的教学、复习和考试已经结束。成绩与学分写入档案；春夏学期将在下一阶段接入。</p></div><div class="mg-head-aside"><span>GPA / 4.0</span><b>' +
      (graded.length ? gpa.toFixed(2) : '—') +
      '</b></div></div>' +
      '<div class="mg-gpa-hero">' +
      '<section class="mg-gpa-card"><span class="mg-kicker">FINAL RECORD</span><div class="mg-gpa-main"><strong>' +
      (graded.length ? gpa.toFixed(2) : '—') +
      '</strong><span>学分加权<br>' +
      graded.length +
      ' 门课程已结算</span></div><p class="mg-gpa-sub">主修 ' +
      (game.credits.main || 0) +
      ' 学分 · 思政 ' +
      (game.credits.ideology || 0) +
      ' 学分 · 水课 ' +
      (game.credits.water || 0) +
      ' 学分</p><div style="margin-top:18px;"><button type="button" class="btn btn-outline" data-action="switch-tab" data-tab="grades">查看完整成绩单' +
      icon('arrow-right') +
      '</button></div></section>' +
      '<section class="mg-info-card"><span class="mg-kicker">NEXT TERM</span><h3>春夏学期</h3><p>新的课表、新的教学块与新的考试安排将在下一阶段接入。你可以先回到封面保存这份存档，或留在成绩页检查本学期结果。</p><div class="mg-inline-note">' +
      icon('info') +
      '<span>当前版本完成到第一学年秋冬学期末，覆盖主修、思政、水课和期末考试结算。</span></div></section>' +
      '</div>'
    );
  }

  function renderWeekView(projection) {
    if (game.termComplete) {
      return renderTermCompleteSummary();
    }
    return (
      '<div class="mg-section-head">' +
      '<div><span class="mg-kicker">WEEKLY ARRANGEMENT / 第 ' +
      game.time.week +
      ' 周</span><h2>这一周怎么过</h2><p>先选这一周吃什么，再把 30 + 空闲课时安排掉。体力可以透支，但成绩、压力和隐藏的健康不会替你兜底。</p></div>' +
      '<div class="mg-head-aside"><span>FREE PERIODS / 空闲</span><b>' +
      projection.freeTime +
      ' 课时</b></div>' +
      '</div>' +
      '<div class="mg-plan-layout">' +
      '<div>' +
      '<section class="mg-block"><div class="mg-block-head"><h3>这周吃什么</h3><span>MEAL / 影响体力、压力与健康</span></div>' +
      '<div class="mg-meal-grid">' +
      GD.meals
        .map(function (meal) { return renderMealCard(meal, projection); })
        .join('') +
      '</div></section>' +
      '<section class="mg-block"><div class="mg-block-head"><h3>空余时间安排</h3><span>每项可重复安排</span></div>' +
      '<div class="mg-activity-grid">' +
      GD.activities
        .map(function (def) { return renderActivityCard(def, projection); })
        .join('') +
      '</div>' +
      (game.research.mentor
        ? '<div class="mg-inline-note">' + icon('info') + '<span>实验室干活已解锁。每次安排会推进导师当前课题，并可能触发导师指导事件。</span></div>'
        : '<div class="mg-inline-note">' + icon('info') + '<span>尚未加入实验室。取得优秀课程成绩后，有机会收到导师招募；医学世家开局已直接解锁。</span></div>') +
      '</section>' +
      '</div>' +
      renderPlanAside(projection) +
      '</div>'
    );
  }

  /* ---------------------------------------------------------
     Research view
     --------------------------------------------------------- */

  function renderResearchView() {
    const research = game.research;
    if (!research.mentor) {
      return (
        '<div class="mg-section-head"><div><span class="mg-kicker">RESEARCH OFFICE / 科研</span><h2>还没有自己的工位。</h2><p>课程成绩达到优秀线后，有概率收到导师招募。开局选择医学世家则会直接获得教授导师与课题。</p></div><div class="mg-head-aside"><span>LAB ACCESS</span><b>未解锁</b></div></div>' +
        '<div class="mg-empty-state"><strong>实验室的门还关着。</strong>先把眼前的课读好，或者等一条来自导师的消息。<br>当前没有可以推进的科研项目。</div>'
      );
    }
    const project = research.project;
    const progress = project ? clamp((project.progress / project.requirement) * 100, 0, 100) : 0;
    const articles = research.articles || [];
    return (
      '<div class="mg-section-head"><div><span class="mg-kicker">RESEARCH OFFICE / 科研</span><h2>课题、进度与署名。</h2><p>每周安排中选择「实验室干活」推进进度。进度达到课题要求后发表文章，导师会给出下一项课题。</p></div><div class="mg-head-aside"><span>MENTOR / 导师</span><b>' +
      escapeHTML(research.mentor.levelName) +
      '</b></div></div>' +
      '<div class="mg-research-grid">' +
      '<section class="mg-lab-card">' +
      '<div class="mg-lab-top"><div><span class="mg-kicker">CURRENT PROJECT</span><h3>' +
      escapeHTML(project ? project.title : '导师正在准备新课题') +
      '</h3><p>' +
      (project
        ? '目标：' +
          escapeHTML(project.articleLevel) +
          (project.journal && project.journal !== project.articleLevel
            ? ' · ' + escapeHTML(project.journal)
            : '') +
          '。完成后署名将进入你的科研成果。'
        : '上一篇文章已经完成。导师正在准备下一项课题。') +
      '</p></div><span class="mg-lab-emblem">' +
      icon('flask') +
      '</span></div>' +
      (project
        ? '<div class="mg-research-progress"><div class="mg-research-progress-head"><span>科研进度</span><span><b>' +
          Math.round(project.progress) +
          '</b> / ' +
          project.requirement +
          '</span></div><div class="mg-research-track"><i style="width:' +
          progress +
          '%"></i></div></div>'
        : '') +
      '<div class="mg-research-meta">' +
      '<div><span>导师</span><b>' + escapeHTML(research.mentor.name) + '</b></div>' +
      '<div><span>导师等级</span><b>' + escapeHTML(research.mentor.levelName) + '</b></div>' +
      '<div><span>好感度</span><b>' + Math.round(research.mentor.favor) + ' / 100</b></div>' +
      '</div>' +
      '<div class="mg-inline-note">' + icon('info') + '<span>导师指导概率：' +
      Math.round(research.mentor.guidanceChance * 100) +
      '%；触发后额外获得 ' +
      research.mentor.guidanceRange[0] +
      '–' +
      research.mentor.guidanceRange[1] +
      ' 点科研进度。</span></div>' +
      '</section>' +
      '<div class="mg-research-side">' +
      '<section class="mg-info-card"><span class="mg-kicker">LAB NOTE</span><h3>导师的话</h3><p>“先把问题问清楚。医学研究最怕的不是慢，是不知道自己在追什么。”</p><div class="mg-mentor-line">' +
      icon('user') +
      '<span><b>顾衡</b> · 每周实验室见</span></div></section>' +
      '<section class="mg-info-card"><span class="mg-kicker">PUBLICATIONS</span><h3>科研成果</h3>' +
      (articles.length
        ? '<div class="mg-article-list">' +
          articles
            .map(function (article) {
              return '<div class="mg-article">' + icon('book') + '<div><b>' + escapeHTML(article.title) + '</b><span>第 ' + article.week + ' 周 · 已发表</span></div></div>';
            })
            .join('') +
          '</div>'
        : '<p>还没有发表文章。第一项课题的要求是 ' + (project ? project.requirement : '—') + ' 点科研进度。</p>') +
      '</section>' +
      '</div>' +
      '</div>'
    );
  }

  /* ---------------------------------------------------------
     Relationships view
     --------------------------------------------------------- */

  function renderRelationsView() {
    const npcs = game.npcs.slice().sort(function (a, b) {
      return Number(Boolean(b.lover)) - Number(Boolean(a.lover));
    });
    return (
      '<div class="mg-section-head"><div><span class="mg-kicker">RELATIONSHIPS / 人际</span><h2>在医院之外，认识的人。</h2><p>好感度决定关系层级。超过 80 可以尝试表白；性取向与你的性别会影响成功率。</p></div><div class="mg-head-aside"><span>KNOWN / 已认识</span><b>' +
      npcs.length +
      ' 人</b></div></div>' +
      '<div class="mg-npc-grid">' +
      npcs
        .map(function (npc) {
          const lover = npc.lover;
          const compatible = npc.orientation === 'bisexual' ||
            (npc.orientation === 'heterosexual' && game.player.gender && game.player.gender !== npc.gender) ||
            (npc.orientation === 'homosexual' && game.player.gender && game.player.gender === npc.gender);
          return (
            '<article class="mg-npc' + (lover ? ' is-lover' : '') + '">' +
            '<div class="mg-npc-avatar">' + escapeHTML(npc.name.slice(0, 1)) + '</div>' +
            '<div class="mg-npc-main">' +
            '<div class="mg-npc-top"><span class="mg-npc-name">' + escapeHTML(npc.name) + '</span><span class="mg-npc-role">' + escapeHTML(npc.role) + '</span></div>' +
            '<p class="mg-npc-note">' + escapeHTML(npc.note) + '</p>' +
            '<div class="mg-favor-head"><span>' + (lover ? '恋人' : describeRelationship(npc.favor)) + '</span><b>' + Math.round(npc.favor) + ' / 100</b></div>' +
            '<div class="mg-favor-track"><i style="width:' + clamp(npc.favor, 0, 100) + '%"></i></div>' +
            '<div class="mg-npc-foot"><span class="mg-npc-tag">' + escapeHTML(npc.orientationLabel || '未公开') + ' · ' + escapeHTML(npc.gender === 'male' ? '男' : npc.gender === 'female' ? '女' : '未知') + '</span>' +
            (lover
              ? '<span class="mg-npc-tag mg-lover-tag">恋人</span>'
              : npc.favor >= 80
                ? '<button type="button" class="mg-add-btn" style="width:auto;margin-top:0;padding:3px 7px;" data-action="confess" data-id="' + npc.id + '">表白 · ' + (compatible ? Math.round(npc.favor) : Math.round(npc.favor * 0.1)) + '%</button>'
                : '<span class="mg-npc-tag">好感 80 后可表白</span>') +
            '</div>' +
            '</div></article>'
          );
        })
        .join('') +
      '</div>' +
      '<div class="mg-inline-note">' + icon('info') + '<span>已接入熟人 / 朋友 / 至交的每周随机事件，以及恋人每周事件与恋爱矛盾。当前可以通过「和朋友们社交」「社团活动」提高好感度；社团扩展与更多恋爱剧情继续补充。</span></div>'
    );
  }

  /* ---------------------------------------------------------
     Grades view
     --------------------------------------------------------- */

  function gradePointForScore(score) {
    if (score >= 90) return 4.0;
    if (score >= 85) return 3.7;
    if (score >= 80) return 3.3;
    if (score >= 75) return 3.0;
    if (score >= 70) return 2.7;
    if (score >= 65) return 2.3;
    if (score >= 60) return 2.0;
    return 0;
  }

  function currentGpa() {
    const graded = (game.courses || []).filter(function (course) {
      return course.completed && course.grade;
    });
    const credits = graded.reduce(function (sum, course) {
      return sum + course.credits;
    }, 0);
    if (!credits) {
      return 0;
    }
    return graded.reduce(function (sum, course) {
      return sum + course.grade.gpaPoint * course.credits;
    }, 0) / credits;
  }

  function renderGradesView() {
    const gpa = currentGpa();
    const gradedCount = game.courses.filter(function (course) {
      return course.completed;
    }).length;
    const totalCredits = game.courses.reduce(function (sum, course) {
      return sum + course.credits;
    }, 0);
    const categories = [
      { key: 'main', label: '主修', total: GD.academic.mainCreditTotal },
      { key: 'ideology', label: '思政', total: GD.academic.ideologyCreditTotal },
      { key: 'elective', label: '选修', total: GD.academic.electiveCreditRequired },
      { key: 'water', label: '水课', total: GD.academic.waterCreditRequired }
    ];
    return (
      '<div class="mg-section-head"><div><span class="mg-kicker">ACADEMIC RECORD / 成绩</span><h2>成绩单与学分进度。</h2><p>GPA 按课程学分加权。本版首学期考试会在复习周结束时结算。</p></div><div class="mg-head-aside"><span>GPA / 4.0</span><b>' +
      (gradedCount ? gpa.toFixed(2) : '—') +
      '</b></div></div>' +
      '<div class="mg-gpa-hero">' +
      '<section class="mg-gpa-card"><span class="mg-kicker">CURRENT GPA</span><div class="mg-gpa-main"><strong>' +
      (gradedCount ? gpa.toFixed(2) : '—') +
      '</strong><span>学分加权<br>' +
      gradedCount +
      ' 门课程已结算</span></div><p class="mg-gpa-sub">本学期共 ' +
      game.courses.length +
      ' 门课程、' +
      totalCredits +
      ' 学分。成绩、平时分与 GPA 规则将在完整考试系统中继续细化。</p></section>' +
      '<section class="mg-info-card"><span class="mg-kicker">CREDIT PROGRESS</span><h3>学分地图</h3><div class="mg-credit-list">' +
      categories
        .map(function (category) {
          const earned = game.credits[category.key] || 0;
          const pct = clamp((earned / Math.max(category.total, 1)) * 100, 0, 100);
          return (
            '<div class="mg-credit-row"><span>' +
            category.label +
            '</span><div class="mg-credit-track"><i style="width:' +
            pct +
            '%"></i></div><b>' +
            earned +
            ' / ' +
            category.total +
            '</b></div>'
          );
        })
        .join('') +
      '</div></section>' +
      '</div>' +
      '<div class="mg-grade-table"><div class="mg-grade-head"><span>课程</span><span>学分</span><span>得分</span><span>状态</span></div>' +
      (game.courses.length
        ? game.courses
            .map(function (course) {
              return (
                '<div class="mg-grade-row"><span>' +
                escapeHTML(course.name) +
                '</span><span>' +
                course.credits +
                '</span><span>' +
                (course.grade ? course.grade.score : '—') +
                '</span><span class="mg-grade-state">' +
                (course.grade
                  ? course.grade.passed
                    ? '通过'
                    : '挂科'
                  : course.completed
                    ? '已结课'
                    : '在修') +
                '</span></div>'
              );
            })
            .join('')
        : '<div class="mg-grade-empty">还没有课程成绩。</div>') +
      '</div>'
    );
  }

  /* ---------------------------------------------------------
     Attributes view
     --------------------------------------------------------- */

  function renderAttributesView() {
    const attrs = studentAttributes();
    const health = describeHealth();
    const abilities = abilityKeys()
      .map(function (key) {
        const ability = findAbility(key);
        return ability
          ? '<span class="mg-tag"><b>' + escapeHTML(ability.name) + '</b> · ' + escapeHTML(ability.effect) + '</span>'
          : '';
      })
      .join('');
    const statItems = [
      ['记忆力', attrs.memory, 'Memory'],
      ['悟性', attrs.comprehension, 'Comprehension'],
      ['创造力', attrs.creativity, 'Creativity'],
      ['抗压能力', attrs.resilience, 'Resilience'],
      ['体力', attrs.stamina, 'Stamina'],
      ['颜值', attrs.appearance, 'Charisma']
    ];
    return (
      '<div class="mg-section-head"><div><span class="mg-kicker">PERSONAL ATTRIBUTES / 属性</span><h2>你带着什么走进医学院。</h2><p>健康与副业是隐藏数值，只在状态变化和结算结果里出现。</p></div><div class="mg-head-aside"><span>HEALTH / 状态</span><b>' + health.label + '</b></div></div>' +
      '<div class="mg-attribute-layout">' +
      '<div>' +
      '<div class="mg-stat-grid">' +
      statItems
        .map(function (item) {
          return (
            '<div class="mg-stat"><div class="mg-stat-head"><span>' +
            item[0] +
            '</span><b>' +
            item[1] +
            ' / 10</b></div><div class="mg-stat-track"><i style="width:' +
            item[1] * 10 +
            '%"></i></div></div>'
          );
        })
        .join('') +
      '</div>' +
      '<div class="mg-extra-grid">' +
      '<div class="mg-extra"><span>体力上限</span><b>' + Math.round(game.resources.staminaMax) + '</b></div>' +
      '<div class="mg-extra"><span>压力上限</span><b>' + Math.round(game.resources.stressMax) + '</b></div>' +
      '<div class="mg-extra"><span>英语水平</span><b>' + Math.round(game.resources.english) + '</b></div>' +
      '<div class="mg-extra"><span>综评</span><b>' + Math.round(game.resources.comprehensive) + '</b></div>' +
      '</div>' +
      '</div>' +
      '<div class="mg-attribute-aside">' +
      '<section class="mg-info-card"><span class="mg-kicker">HEALTH / 隐藏数值</span><h3>身体状态</h3><div class="mg-health-state ' +
      (health.key === 'normal' ? '' : 'is-sick') +
      '">' +
      (health.key === 'normal'
        ? '没有明显的身体问题。保持吃饭和休息。'
        : health.key === 'sick'
          ? '你正在生病。课程与科研进度获取会降低；药店可能有对症药物。'
          : '重病。普通药物无法解决，需要认真对待（休学系统下一阶段接入）。') +
      '</div></section>' +
      '<section class="mg-info-card"><span class="mg-kicker">INNATE TRAITS / 初始能力</span><h3>能力</h3><div class="mg-tag-list">' +
      (abilities || '<span class="mg-npc-tag">没有初始能力</span>') +
      '</div></section>' +
      '<section class="mg-info-card"><span class="mg-kicker">HIDDEN / 副业</span><h3>副业状态</h3><p>副业是隐藏累计值。持续投入会积累经验；当它足够大，会开始每周带来收入，也会在长期中断后回落。</p></section>' +
      '</div>' +
      '</div>'
    );
  }

  /* ---------------------------------------------------------
     Endings & term complete
     --------------------------------------------------------- */

  function renderEndingScreen() {
    const ending = game.ending || {};
    const isDropout = ending.type === 'dropout' || ending.type === 'stress';
    return (
      '<div class="mg-ending-screen"><section class="mg-ending">' +
      '<span class="mg-kicker">UNDERGRADUATE FILE · ' + escapeHTML(ending.kicker || 'CLOSED') + '</span>' +
      '<h1>' + escapeHTML(ending.title || '本科阶段结束') + '</h1>' +
      '<p>' + escapeHTML(ending.text || '你离开了医学院。') + '</p>' +
      '<div class="mg-ending-quote">“' + escapeHTML(ending.quote || (isDropout ? '人生是旷野，有时候往回走，也是一种活法。' : '道路万千，你若不喜，便是歧途。')) + '”</div>' +
      '<div class="mg-ending-actions">' +
      '<button type="button" class="btn btn-outline" data-action="return-cover">返回封面' + icon('arrow-left') + '</button>' +
      '<button type="button" class="btn btn-ghost" data-action="back-to-archive">查看学籍档案</button>' +
      '</div>' +
      '</section></div>'
    );
  }

  function renderTermCompleteOverlay() {
    const gpa = currentGpa();
    return (
      '<div class="mg-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="term-complete-title">' +
      '<section class="mg-modal is-narrow"><div class="mg-modal-inner">' +
      '<div class="mg-modal-head"><div><span class="mg-kicker">TERM COMPLETE / 秋冬学期</span><h2 id="term-complete-title">这一学期结束了。</h2></div></div>' +
      '<div class="mg-modal-body"><p>18 周的秋冬学期已经走完。课程、考试与成绩已经写入档案。GPA：<b>' +
      (gpa ? gpa.toFixed(2) : '—') +
      '</b>。</p><p>春夏学期、假期与完整的五年升学路线将在下一阶段接入。你可以先返回封面保存这份本科阶段性存档。</p></div>' +
      '<div class="mg-modal-actions"><button type="button" class="btn btn-outline" data-action="return-cover">返回封面</button><button type="button" class="btn btn-primary" data-action="close-term">继续查看档案' + icon('arrow-right') + '</button></div>' +
      '</div></section></div>'
    );
  }

  /* ---------------------------------------------------------
     Modal renderers
     --------------------------------------------------------- */

  function renderModal() {
    if (!ui.modal) {
      return '';
    }
    if (ui.modal.type === 'shop') {
      return renderShopModal();
    }
    if (ui.modal.type === 'report') {
      return renderReportModal();
    }
    if (ui.modal.type === 'dropout-confirm') {
      return renderDropoutConfirm();
    }
    if (ui.modal.type === 'confess') {
      return renderConfessModal(ui.modal.npcId, ui.modal.result);
    }
    if (ui.modal.type === 'event') {
      return renderEventModal();
    }
    return '';
  }

  function renderShopModal() {
    return (
      '<div class="mg-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="shop-title">' +
      '<section class="mg-modal is-narrow"><div class="mg-modal-inner">' +
      '<div class="mg-modal-head"><div><span class="mg-kicker">CAMPUS STORE / 校内商店</span><h2 id="shop-title">买点能撑住的东西。</h2></div><button type="button" class="mg-modal-close" data-action="close-modal" aria-label="关闭商店">' + icon('close') + '</button></div>' +
      '<div class="mg-modal-body">' +
      '<div class="mg-shop-money"><span>当前可用资金</span><b>' + formatMoney(game.resources.money) + '</b></div>' +
      '<div class="mg-shop-grid">' +
      GD.shopItems
        .map(function (item) {
          let disabled = game.resources.money < item.price;
          if (item.effect === 'cure-sick') {
            disabled = disabled || !game.resources.sick || game.resources.severe;
          }
          return (
            '<div class="mg-shop-item"><div class="mg-shop-icon">' + icon(item.icon) + '</div><div class="mg-shop-copy"><b>' +
            escapeHTML(item.name) +
            '</b><span>' +
            escapeHTML(item.desc) +
            '</span></div><button type="button" class="mg-shop-buy" data-action="buy-item" data-id="' +
            item.id +
            '"' +
            (disabled ? ' disabled' : '') +
            '>' +
            formatMoney(item.price) +
            '</button></div>'
          );
        })
        .join('') +
      '</div>' +
      '</div>' +
      '<div class="mg-modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">收起</button></div>' +
      '</div></section></div>'
    );
  }

  function renderReportModal() {
    const report = game.pendingReport;
    if (!report) {
      return '';
    }
    return (
      '<div class="mg-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="report-title">' +
      '<section class="mg-modal"><div class="mg-modal-inner">' +
      '<div class="mg-modal-head"><div><span class="mg-kicker">WEEK ' +
      report.week +
      ' / ' +
      escapeHTML(report.termName || currentTermDef().name) +
      '</span><h2 id="report-title">' +
      escapeHTML(report.title || '这一周结束了。') +
      '</h2></div></div>' +
      '<div class="mg-modal-body">' +
      '<div class="mg-report-summary">' +
      '<div class="mg-report-metric"><span>体力</span><b class="' +
      (report.metrics.staminaDelta < 0 ? 'neg' : 'pos') +
      '">' + signed(report.metrics.staminaDelta) + '</b></div>' +
      '<div class="mg-report-metric"><span>压力</span><b class="' +
      (report.metrics.stressDelta > 0 ? 'neg' : 'pos') +
      '">' + signed(report.metrics.stressDelta) + '</b></div>' +
      '<div class="mg-report-metric"><span>金钱</span><b class="' +
      (report.metrics.moneyDelta < 0 ? 'neg' : 'pos') +
      '">' + signed(Math.round(report.metrics.moneyDelta), ' 元') + '</b></div>' +
      '<div class="mg-report-metric"><span>当前体力</span><b>' +
      Math.round(game.resources.stamina) +
      '</b></div>' +
      '</div>' +
      '<div class="mg-report-list">' +
      report.lines
        .map(function (line) {
          return '<div class="mg-report-line ' + (line.tone || '') + '">' + icon(line.tone === 'is-good' ? 'check' : line.tone === 'is-bad' ? 'warning' : 'info') + '<div>' + line.html + '</div></div>';
        })
        .join('') +
      '</div>' +
      '</div>' +
      '<div class="mg-modal-actions"><button type="button" class="btn btn-primary" data-action="continue-week">' +
      (report.nextLabel || '继续下一周') + icon('arrow-right') +
      '</button></div>' +
      '</div></section></div>'
    );
  }

  function renderDropoutConfirm() {
    return (
      '<div class="mg-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dropout-title">' +
      '<section class="mg-modal is-narrow"><div class="mg-modal-inner">' +
      '<div class="mg-modal-head"><div><span class="mg-kicker">DROPOUT / 退学确认</span><h2 id="dropout-title">现在离开医学院？</h2></div><button type="button" class="mg-modal-close" data-action="close-modal" aria-label="取消退学">' + icon('close') + '</button></div>' +
      '<div class="mg-modal-body"><p>退学会立即结束本局本科阶段。已经走过的课表、成绩与关系不会作为毕业学分保留。</p><p>有时候及时停下，比继续假装自己还能撑住更难。</p></div>' +
      '<div class="mg-modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">再想想</button><button type="button" class="btn btn-danger" data-action="confirm-dropout">确认退学</button></div>' +
      '</div></section></div>'
    );
  }

  function renderConfessModal(npcId, result) {
    const npc = findNpc(npcId);
    if (!npc) {
      return '';
    }
    const compatible =
      npc.orientation === 'bisexual' ||
      (npc.orientation === 'heterosexual' && game.player.gender && game.player.gender !== npc.gender) ||
      (npc.orientation === 'homosexual' && game.player.gender && game.player.gender === npc.gender);
    const chance = compatible ? npc.favor / 100 : (npc.favor / 100) * 0.1;
    return (
      '<div class="mg-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="confess-title">' +
      '<section class="mg-modal is-narrow"><div class="mg-modal-inner">' +
      '<div class="mg-modal-head"><div><span class="mg-kicker">CONFESSION / 表白</span><h2 id="confess-title">向' +
      escapeHTML(npc.name) +
      '表白？</h2></div><button type="button" class="mg-modal-close" data-action="close-modal" aria-label="关闭">' + icon('close') + '</button></div>' +
      '<div class="mg-modal-body"><p>当前好感度：<b>' +
      Math.round(npc.favor) +
      ' / 100</b>。成功率：<b>' +
      Math.round(chance * 100) +
      '%</b>。</p>' +
      (result
        ? '<p style="margin-top:12px;color:' + (result.success ? 'var(--mg-green)' : 'var(--mg-red)') + ';">' + escapeHTML(result.text) + '</p>'
        : '') +
      '</div>' +
      '<div class="mg-modal-actions"><button type="button" class="btn btn-ghost" data-action="close-modal">先不说</button>' +
      (result
        ? '<button type="button" class="btn btn-outline" data-action="close-modal">收好这句话</button>'
        : '<button type="button" class="btn btn-primary" data-action="do-confess" data-id="' + npc.id + '">说出来</button>') +
      '</div>' +
      '</div></section></div>'
    );
  }

  function renderEventModal() {
    const pending = game.pendingEvent;
    if (!pending) {
      return '';
    }
    const npc = findNpc(pending.npcId);
    if (!npc) {
      return '';
    }
    const isDinner = pending.type === 'npc-dinner';
    const isScript = pending.type === 'npc-script';
    const title = isDinner
      ? npc.name + '想约你吃顿饭。'
      : npc.name + '问你要不要一起去玩剧本杀。';
    const text = isDinner
      ? '“学校旁边新开了一家店，听说还不错。你今晚有空吗？”'
      : '“周末那家剧本杀店缺两个人，我第一个想到你。”';
    const cost = isDinner ? 50 : 100;
    const stamina = isDinner ? 10 : -10;
    const stress = isDinner ? -10 : -20;
    const acceptDisabled = game.resources.money < cost;
    return (
      '<div class="mg-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="event-title">' +
      '<section class="mg-modal is-narrow"><div class="mg-modal-inner">' +
      '<div class="mg-modal-head"><div><span class="mg-kicker">WEEK EVENT / 人际事件</span><h2 id="event-title">' +
      escapeHTML(title) +
      '</h2></div></div>' +
      '<div class="mg-modal-body">' +
      '<div class="mg-event-person"><div class="mg-npc-avatar">' +
      escapeHTML(npc.name.slice(0, 1)) +
      '</div><div><b>' +
      escapeHTML(npc.name) +
      ' · ' +
      escapeHTML(npc.role) +
      '</b><span>' +
      describeRelationship(npc.favor) +
      ' · 好感 ' +
      Math.round(npc.favor) +
      '</span></div></div>' +
      '<p style="margin-top:13px;">' +
      escapeHTML(text) +
      '</p>' +
      '<div class="mg-event-options">' +
      '<button type="button" class="mg-event-option" data-action="resolve-event" data-choice="accept"' +
      (acceptDisabled ? ' disabled' : '') +
      '><span class="mg-event-option-mark">' +
      icon('check') +
      '</span><span><b>' +
      (isDinner ? '一起去吃饭' : '一起去') +
      '</b><span>' +
      (isDinner ? '这顿饭让自己放松一下。' : '把今晚交给一个虚构的案件。') +
      '</span><small>' +
      formatMoney(cost) +
      ' · 体力 ' +
      signed(stamina) +
      ' · 压力 ' +
      signed(stress) +
      ' · 好感 +3~5</small></span></button>' +
      '<button type="button" class="mg-event-option" data-action="resolve-event" data-choice="decline">' +
      '<span class="mg-event-option-mark">' +
      icon('close') +
      '</span><span><b>这次不了</b><span>你还有别的事要做。拒绝不会立刻带来后果。</span><small>好感不变 · 金钱不变</small></span></button>' +
      '</div>' +
      (acceptDisabled
        ? '<div class="mg-warning">' + icon('warning') + '<span>现有资金不足，无法参加这次邀请。</span></div>'
        : '') +
      '</div>' +
      '</div></section></div>'
    );
  }

  function resolvePendingEvent(choice) {
    const pending = game.pendingEvent;
    if (!pending) {
      return;
    }
    const npc = findNpc(pending.npcId);
    if (!npc) {
      game.pendingEvent = null;
      ui.modal = { type: 'report' };
      persist();
      render();
      return;
    }
    const before = {
      stamina: game.resources.stamina,
      stress: game.resources.stress,
      money: game.resources.money
    };
    const isDinner = pending.type === 'npc-dinner';
    const cost = isDinner ? 50 : 100;
    if (choice === 'accept') {
      if (game.resources.money < cost) {
        showToast('资金不足。');
        return;
      }
      const favorGain = randInt(3, 5);
      game.resources.money -= cost;
      game.resources.stamina = clamp(
        game.resources.stamina + (isDinner ? 10 : -10),
        0,
        game.resources.staminaMax
      );
      game.resources.stress = clamp(
        game.resources.stress + (isDinner ? -10 : -20),
        0,
        game.resources.stressMax
      );
      npc.favor = clamp(npc.favor + favorGain, 0, 100);
      if (game.pendingReport) {
        addReportLine(
          game.pendingReport.lines,
          'is-good',
          (isDinner
            ? '你和' + escapeHTML(npc.name) + '去吃了顿饭。'
            : '你和' + escapeHTML(npc.name) + '玩了一晚剧本杀。') +
            '金钱 −' +
            cost +
            '，好感 +' +
            favorGain +
            '。'
        );
      }
    } else if (game.pendingReport) {
      addReportLine(
        game.pendingReport.lines,
        '',
        '你婉拒了' + escapeHTML(npc.name) + '的邀请。' + (isDinner ? '晚饭在食堂解决。' : '今晚照常回宿舍。')
      );
    }
    game.resources.money = Math.max(0, Math.round(game.resources.money));
    if (game.pendingReport) {
      game.pendingReport.metrics.staminaDelta += Math.round(game.resources.stamina - before.stamina);
      game.pendingReport.metrics.stressDelta += Math.round(game.resources.stress - before.stress);
      game.pendingReport.metrics.moneyDelta += Math.round(game.resources.money - before.money);
    }
    game.pendingEvent = null;
    persist();
    ui.modal = { type: 'report' };
    render({ scroll: 'top' });
  }

  /* ---------------------------------------------------------
     Actions
     --------------------------------------------------------- */

  document.addEventListener('click', function (event) {
    const actionElement = event.target.closest('[data-action]');
    if (!actionElement) {
      if (
        event.target.classList &&
        event.target.classList.contains('mg-modal-overlay') &&
        ui.modal &&
        ['shop', 'dropout-confirm', 'confess'].indexOf(ui.modal.type) !== -1
      ) {
        closeModal();
      }
      return;
    }
    const action = actionElement.getAttribute('data-action');

    switch (action) {
      case 'reg-gender':
        ui.registration.gender = actionElement.getAttribute('data-gender');
        render();
        break;
      case 'reg-toggle-ideology':
      case 'reg-toggle-water':
      case 'reg-toggle-elective': {
        const kind =
          action === 'reg-toggle-ideology'
            ? 'ideology'
            : action === 'reg-toggle-water'
              ? 'water'
              : 'elective';
        const id = actionElement.getAttribute('data-id');
        const list = ui.registration[kind];
        const index = list.indexOf(id);
        if (index !== -1) {
          list.splice(index, 1);
        } else {
          list.push(id);
        }
        render();
        break;
      }
      case 'confirm-registration':
        confirmRegistration();
        break;
      case 'switch-tab':
        ui.tab = actionElement.getAttribute('data-tab') || 'courses';
        render({ scroll: 'top' });
        break;
      case 'choose-meal':
        game.weekPlan.meal = actionElement.getAttribute('data-key');
        persist();
        render();
        break;
      case 'toggle-course':
        toggleCourse(actionElement.getAttribute('data-id'));
        break;
      case 'add-activity':
        addActivity(actionElement.getAttribute('data-key'));
        break;
      case 'remove-activity':
        removeActivity(actionElement.getAttribute('data-id'));
        break;
      case 'start-week':
        startWeek();
        break;
      case 'open-shop':
        ui.modal = { type: 'shop' };
        render();
        break;
      case 'close-modal':
        closeModal();
        break;
      case 'buy-item':
        buyItem(actionElement.getAttribute('data-id'));
        break;
      case 'continue-week':
        continueAfterReport();
        break;
      case 'resolve-event':
        resolvePendingEvent(actionElement.getAttribute('data-choice'));
        break;
      case 'return-cover':
        window.location.href = 'index.html';
        break;
      case 'back-to-archive':
        window.location.href = 'index.html';
        break;
      case 'dropout':
        openDropoutConfirm();
        break;
      case 'confirm-dropout':
        confirmDropout();
        break;
      case 'confess':
        ui.modal = {
          type: 'confess',
          npcId: actionElement.getAttribute('data-id'),
          result: null
        };
        render();
        break;
      case 'do-confess':
        doConfess(actionElement.getAttribute('data-id'));
        break;
      case 'close-term':
        closeModal();
        render({ scroll: 'top' });
        break;
      default:
        break;
    }
  });

  document.addEventListener('change', function (event) {
    const target = event.target;
    if (target && target.getAttribute && target.getAttribute('data-plan-target')) {
      const key = target.getAttribute('data-plan-target');
      if (key === 'social') {
        ui.socialTarget = target.value;
      } else {
        ui.targets[key] = target.value;
      }
    }
  });

  function confirmRegistration() {
    if (!ui.registration.gender) {
      showToast('先登记性别，后续好感与恋爱判定需要它。');
      return;
    }
    const periods = registrationPeriodCount();
    if (periods > 78) {
      showToast('课程超过每周 78 课时容量，请减少选课。');
      return;
    }
    createInitialGame();
  }

  function closeModal() {
    ui.modal = null;
    render();
  }

  function openDropoutConfirm() {
    ui.modal = { type: 'dropout-confirm' };
    render();
  }

  function confirmDropout() {
    game.pendingEvent = null;
    game.ending = {
      type: 'dropout',
      title: '退学',
      kicker: 'WITHDRAWAL',
      text: '你在一个普通的下午交回了学生证。教务处的人没有多问，只让你在最后一栏签字。走廊里还有人在背名词，你没有回头。',
      quote: '人生是旷野，有时候往回走，也是一种活法。',
      atWeek: game.time.week
    };
    game.pendingReport = null;
    persist();
    ui.modal = null;
    render({ scroll: 'top' });
  }

  function doConfess(npcId) {
    const npc = findNpc(npcId);
    if (!npc) {
      return;
    }
    if (game.npcs.some(function (entry) { return entry.lover; })) {
      showToast('你已经在一段恋爱关系中。');
      return;
    }
    const compatible =
      npc.orientation === 'bisexual' ||
      (npc.orientation === 'heterosexual' && game.player.gender && game.player.gender !== npc.gender) ||
      (npc.orientation === 'homosexual' && game.player.gender && game.player.gender === npc.gender);
    const chance = compatible ? npc.favor / 100 : (npc.favor / 100) * 0.1;
    const success = Math.random() < chance;
    if (success) {
      npc.lover = true;
      ui.modal = {
        type: 'confess',
        npcId: npcId,
        result: {
          success: true,
          text: '对方沉默了一会儿，然后说：“好。”\n你们正式在一起了。此后所有 NPC 列表里，' + npc.name + ' 会被置顶。'
        }
      };
    } else {
      npc.favor = clamp(npc.favor - 3, 0, 100);
      ui.modal = {
        type: 'confess',
        npcId: npcId,
        result: {
          success: false,
          text: '对方移开了视线。你们还是朋友，但有一句话被留在了那个下午。好感度下降 3 点。'
        }
      };
    }
    persist();
    render();
  }

  /* ---------------------------------------------------------
     Weekly plan actions
     --------------------------------------------------------- */

  function toggleCourse(courseId) {
    const course = game.courses.find(function (entry) { return entry.id === courseId; });
    if (!course || course.completed) {
      return;
    }
    if (!courseIsTeachingThisWeek(course, game)) {
      showToast('这门课本周不上课。');
      return;
    }
    course.attended = !course.attended;
    persist();
    render();
  }

  function addActivity(key) {
    const def = findActivityDef(key);
    if (!def) {
      return;
    }
    const projection = projectWeek();
    const reason = activityAvailability(key, projection);
    if (reason) {
      showToast(reason);
      return;
    }
    let courseId = null;
    let allCourses = false;
    let npcId = null;
    if (def.target === 'course' || def.target === 'course-or-all') {
      const target = ui.targets[key] || (def.target === 'course-or-all' ? 'all' : (openCoursesForStudy()[0] || {}).id);
      if (!target) {
        showToast('没有可选择的课程。');
        return;
      }
      if (target === 'all') {
        allCourses = true;
      } else {
        courseId = target;
      }
    }
    if (def.npc) {
      npcId = ui.targets[key] || ui.socialTarget || (game.npcs[0] || {}).id;
      if (!npcId) {
        showToast('还没有可以社交的人。');
        return;
      }
    }
    const item = {
      id: 'plan-' + game.nextActivityId++,
      activityKey: key,
      courseId: courseId,
      allCourses: allCourses,
      npcId: npcId
    };
    game.weekPlan.activities.push(item);
    persist();
    render();
  }

  function removeActivity(id) {
    game.weekPlan.activities = game.weekPlan.activities.filter(function (item) {
      return item.id !== id;
    });
    persist();
    render();
  }

  function buyItem(itemId) {
    const item = GD.shopItems.find(function (entry) { return entry.id === itemId; });
    if (!item) {
      return;
    }
    if (game.resources.money < item.price) {
      showToast('资金不足。');
      return;
    }
    if (item.effect === 'cure-sick') {
      if (!game.resources.sick) {
        showToast('你现在没有生病。');
        return;
      }
      if (game.resources.severe) {
        showToast('重病状态下普通药物无效。');
        return;
      }
      game.resources.sick = false;
      game.resources.medicated = true;
      game.resources.money -= item.price;
      persist();
      ui.modal = { type: 'shop' };
      render();
      showToast('你按说明服了药。普通生病状态已解除。');
      return;
    }
    game.resources.money -= item.price;
    if (item.effect === 'stamina') {
      game.resources.stamina = clamp(
        game.resources.stamina + item.stamina,
        0,
        game.resources.staminaMax
      );
      game.resources.stress = clamp(
        game.resources.stress + (item.stress || 0),
        0,
        game.resources.stressMax
      );
    }
    if (item.effect === 'stress') {
      game.resources.stress = clamp(
        game.resources.stress + item.stress,
        0,
        game.resources.stressMax
      );
    }
    persist();
    ui.modal = { type: 'shop' };
    render();
    showToast('已购买「' + item.name + '」。');
  }

  /* ---------------------------------------------------------
     Weekly settlement
     --------------------------------------------------------- */

  function addReportLine(lines, tone, html) {
    lines.push({ tone: tone || '', html: html });
  }

  function rollNpcWeeklyEvents(reportLines) {
    const lover = game.npcs.find(function (npc) {
      return npc.lover;
    });
    if (lover) {
      game.resources.stress = Math.max(0, game.resources.stress - 10);
      addReportLine(
        reportLines,
        'is-good',
        '你和' + escapeHTML(lover.name) + '在宿舍楼下待了一会儿。压力 −10。'
      );
      const ratio = game.resources.stress / Math.max(1, game.resources.stressMax);
      if (ratio > 0.8 && Math.random() < Math.min(0.6, ratio - 0.8)) {
        lover.favor = clamp(lover.favor - 3, 0, 100);
        addReportLine(
          reportLines,
          'is-bad',
          '你和' + escapeHTML(lover.name) + '因为一点小事争执起来。恋人好感 −3。'
        );
        if (lover.favor < 60) {
          lover.lover = false;
          game.resources.stress += 10;
          addReportLine(
            reportLines,
            'is-bad',
            '你们的恋爱关系结束了。压力 +10。'
          );
        }
      }
      return null;
    }

    const candidates = game.npcs.filter(function (npc) {
      return npc.favor >= 20;
    });
    for (let index = 0; index < candidates.length; index += 1) {
      const npc = candidates[index];
      const chance = npc.favor <= 40 ? 0.05 : npc.favor <= 80 ? 0.1 : 0.2;
      if (Math.random() >= chance) {
        continue;
      }
      const pool =
        npc.favor <= 40
          ? ['note', 'discussion', 'chat']
          : ['note', 'discussion', 'chat', 'dinner', 'script'];
      const eventType = pickRandom(pool);
      if (eventType === 'dinner' || eventType === 'script') {
        return {
          type: eventType === 'dinner' ? 'npc-dinner' : 'npc-script',
          npcId: npc.id
        };
      }
      if (eventType === 'chat' || !openCoursesForStudy().length) {
        game.resources.stress = Math.max(0, game.resources.stress - 5);
        addReportLine(
          reportLines,
          'is-good',
          '你和' + escapeHTML(npc.name) + '聊了一会儿。压力 −5。'
        );
      } else {
        const target = openCoursesForStudy().slice().sort(function (a, b) {
          return a.prep - b.prep;
        })[0];
        const baseGain =
          eventType === 'note'
            ? randInt(3, 5)
            : randInt(5, 10);
        const gain = Math.max(
          1,
          Math.round(baseGain * (game.resources.sick ? 0.8 : 1))
        );
        target.prep = clamp(target.prep + gain, 0, 100);
        addReportLine(
          reportLines,
          'is-good',
          (eventType === 'note'
            ? escapeHTML(npc.name) + '把整理好的笔记发给了你。'
            : escapeHTML(npc.name) + '和你讨论了一会儿课程。') +
            '《' +
            escapeHTML(target.name) +
            '》准备度 +' +
            gain +
            '。'
        );
      }
      return null;
    }
    return null;
  }

  function startWeek() {
    const validation = weekValidation();
    if (validation) {
      showToast(validation);
      return;
    }
    const projection = projectWeek();
    const startingStamina = game.resources.stamina;
    const startingStress = game.resources.stress;
    const startingMoney = game.resources.money;
    const lines = [];
    const review = isReviewWeek(game);
    const attributes = studentAttributes();
    const active = activeCourses();
    const medicalEffect = game.resources.sick ? 0.8 : 1;
    const timeBonus = hasAbility('timekeeper') ? 1.1 : 1;
    const learningFactor = 0.62 + 0.033 * (attributes.memory + attributes.comprehension);
    const courseChanges = [];
    let rollCallFailures = 0;

    // Course attendance, preparation, and roll-call
    active.forEach(function (course) {
      if (!review) {
        if (course.attended) {
          const multiplier = medicalEffect * timeBonus;
          const gain = (100 / course.weeks) * learningFactor * multiplier;
          const before = course.prep;
          course.prep = clamp(course.prep + gain, 0, 100);
          if (course.prep - before > 0.1) {
            courseChanges.push(
              escapeHTML(course.name) +
              ' <b>+' + (Math.round((course.prep - before) * 10) / 10) + '</b>'
            );
          }
        } else {
          const caughtChance = Math.min(0.75, 0.2 + course.credits * 0.04);
          if (Math.random() < caughtChance) {
            course.caughtAbsences += 1;
            const remaining = Math.max(0, 3 - course.caughtAbsences);
            if (course.caughtAbsences >= 3) {
              course.attendanceFail = true;
              addReportLine(
                lines,
                'is-bad',
                '《' + escapeHTML(course.name) + '》第三次点名缺勤：课程直接挂科。'
              );
              rollCallFailures += 1;
            } else {
              addReportLine(
                lines,
                'is-bad',
                '《' + escapeHTML(course.name) + '》点名抓到你翘课。出勤分 −10，累计缺勤 ' +
                  course.caughtAbsences +
                  ' 次，还剩 ' + remaining + ' 次机会。'
              );
            }
          }
        }
        course.progress = clamp(course.progress + 100 / course.weeks, 0, 100);
      }
    });

    if (!review && courseChanges.length) {
      addReportLine(
        lines,
        'is-good',
        '课程准备度提升：' + courseChanges.slice(0, 5).join('；') + (courseChanges.length > 5 ? ' 等。' : '。')
      );
    }

    // Meal and activities
    const meal = findMeal(game.weekPlan.meal);
    const mealPrice = getFamilyMealPrice(meal);
    game.resources.stamina += Number(meal.stamina) || 0;
    game.resources.stress = Number(game.resources.stress) + (Number(meal.stress) || 0);
    game.resources.money -= mealPrice;
    game.resources.health = clamp(
      game.resources.health + (Number(meal.health) || 0),
      0,
      game.resources.healthMax
    );

    const sideBusinessBefore = game.resources.sideBusiness;
    let didSideBusiness = false;
    let researchGainTotal = 0;
    let socialStressApplied = false;

    game.weekPlan.activities.forEach(function (item) {
      const def = findActivityDef(item.activityKey);
      if (!def) {
        return;
      }
      const activityCourse =
        item.courseId &&
        game.courses.find(function (course) { return course.id === item.courseId; });
      game.resources.stamina += Number(def.stamina) || 0;
      if (item.activityKey === 'social') {
        if (!socialStressApplied) {
          game.resources.stress -= 10;
          socialStressApplied = true;
        }
      } else {
        game.resources.stress += Number(def.stress) || 0;
      }
      if (def.money) {
        game.resources.money += def.money;
      }
      if (def.moneyPerNpc) {
        game.resources.money -= def.moneyPerNpc;
      }
      if (item.activityKey === 'review' || item.activityKey === 'preview' || item.activityKey === 'library') {
        const rangeBase =
          item.activityKey === 'review' ? [1, 5] : item.activityKey === 'preview' ? [4, 16] : [7, 30];
        if (item.allCourses) {
          const targets = openCoursesForStudy();
          if (targets.length) {
            let total = Math.max(
              1,
              Math.round(randInt(rangeBase[0], rangeBase[1]) * medicalEffect)
            );
            let per = Math.floor(total / targets.length);
            let remainder = total % targets.length;
            targets.forEach(function (course, index) {
              course.prep = clamp(course.prep + per + (index < remainder ? 1 : 0), 0, 100);
            });
            addReportLine(lines, 'is-good', '你在图书馆把复习时间平均分给了 ' + targets.length + ' 门课程。');
          }
        } else if (activityCourse) {
          const gain = Math.max(
            1,
            Math.round(randInt(rangeBase[0], rangeBase[1]) * medicalEffect)
          );
          activityCourse.prep = clamp(activityCourse.prep + gain, 0, 100);
          addReportLine(lines, 'is-good', '《' + escapeHTML(activityCourse.name) + '》准备度 +' + gain + '。');
        }
      }
      if (item.activityKey === 'club') {
        const comp = randInt(def.comprehensive[0], def.comprehensive[1]);
        game.resources.comprehensive += comp;
        let club = game.npcs.find(function (npc) { return npc.id === 'npc-lin'; });
        if (!club) {
          const seed = NPCS.find(function (npc) { return npc.id === 'npc-lin'; });
          if (seed) {
            club = Object.assign({}, seed, {
              met: true,
              favor: clamp(seed.favor + (hasAbility('dreamer') ? 10 : 0), 0, 100),
              lover: false
            });
            game.npcs.push(club);
          }
        }
        if (club) {
          club.favor = clamp(club.favor + randInt(def.favor[0], def.favor[1]), 0, 100);
        }
        addReportLine(lines, 'is-good', '社团活动。综评 +' + comp + '，你认识了一些新的面孔。');
      }
      if (item.activityKey === 'work-study') {
        addReportLine(lines, 'is-good', '勤工俭学，收入 18 元。');
      }
      if (item.activityKey === 'social') {
        const npc = findNpc(item.npcId);
        if (npc) {
          npc.favor = clamp(npc.favor + randInt(def.favor[0], def.favor[1]), 0, 100);
          addReportLine(lines, 'is-good', '和' + escapeHTML(npc.name) + '聊了一会儿，好感度上升。');
        }
      }
      if (item.activityKey === 'english') {
        const gain = randInt(def.english[0], def.english[1]);
        game.resources.english += gain;
        addReportLine(lines, 'is-good', '英语水平 +' + gain + '。');
      }
      if (item.activityKey === 'sidebusiness') {
        const gain = Math.round(
          randInt(def.sideBusiness[0], def.sideBusiness[1]) *
            sideBusinessMultiplier() *
            timeBonus
        );
        game.resources.sideBusiness += gain;
        didSideBusiness = true;
        addReportLine(lines, 'is-good', '你把一些时间投进了副业。进展被记进了那本不公开的账。');
      }
      if (item.activityKey === 'lab' && game.research.mentor && game.research.project) {
        const gain = Math.round(
          randInt(def.research[0], def.research[1]) * timeBonus * medicalEffect
        );
        game.research.project.progress += gain;
        researchGainTotal += gain;
        addReportLine(lines, 'is-good', '实验室干活，科研进度 +' + gain + '。');
        if (Math.random() < game.research.mentor.guidanceChance) {
          const guidance = Math.max(
            1,
            Math.round(
              randInt(
                game.research.mentor.guidanceRange[0],
                game.research.mentor.guidanceRange[1]
              ) * medicalEffect
            )
          );
          game.research.project.progress += guidance;
          researchGainTotal += guidance;
          addReportLine(
            lines,
            'is-good',
            game.research.mentor.name + '在实验记录本上圈出几个问题，又给你补了 ' + guidance + ' 点科研进度。'
          );
          const mentorNpc = game.npcs.find(function (npc) { return npc.id === 'npc-mentor'; });
          if (mentorNpc) {
            mentorNpc.favor = clamp(mentorNpc.favor + randInt(1, 3), 0, 100);
            if (game.research.mentor) {
              game.research.mentor.favor = mentorNpc.favor;
            }
          }
        }
      }
    });

    // Course stamina / stress
    if (!review) {
      game.resources.stamina -= projection.courseStamina;
      game.resources.stress += projection.courseStress;
      if (projection.courseStamina > 0) {
        addReportLine(
          lines,
          '',
          '课程消耗：体力 −' + Math.round(projection.courseStamina) + '，压力 +' + Math.round(projection.courseStress) + '。'
        );
      }
    }

    if (hasAbility('energetic')) {
      game.resources.stamina += 10;
      addReportLine(lines, 'is-good', '高精力人士：每周额外恢复 10 点体力。');
    }
    if (hasAbility('optimist')) {
      game.resources.stress -= 5;
      addReportLine(lines, 'is-good', '乐天派：每周额外降低 5 点压力。');
    }

    // Health / hidden state
    const baseHealthRecovery = attributes.stamina - 5;
    let health = game.resources.health + baseHealthRecovery;
    if (health >= 50) {
      game.resources.medicated = false;
    }
    if (health < 50 && !game.resources.medicated) {
      health -= 3;
      game.resources.sick = true;
    }
    if (health < 20) {
      health -= 5;
      game.resources.severe = true;
      game.resources.sick = true;
      game.resources.healthMax = Math.max(50, game.resources.healthMax - 2);
    } else {
      game.resources.severe = false;
    }
    if (health >= 50) {
      game.resources.sick = false;
      game.resources.medicated = false;
    }
    health = clamp(health, 0, game.resources.healthMax);
    game.resources.health = health;
    if (health < 20) {
      addReportLine(lines, 'is-bad', '你的身体已经到了极限。重病状态下，普通药物无法让你恢复。');
    } else if (health < 50 && !game.resources.medicated) {
      addReportLine(lines, 'is-bad', '你开始频繁咳嗽，身体在提醒你：课程和科研的进度都慢了下来。');
    }

    // Side business income / decay
    if (game.resources.sideBusiness >= 100) {
      const base = game.resources.sideBusiness - 100;
      const income = randInt(base * 5, base * 10);
      game.resources.money += income;
      if (income > 0) {
        addReportLine(lines, 'is-good', '副业带来了 <b>' + formatMoney(income) + '</b> 的收入。');
      }
    }
    if (!didSideBusiness) {
      game.resources.sideBusinessMissWeeks += 1;
      if (game.resources.sideBusinessMissWeeks >= 4 && game.resources.sideBusiness > 0) {
        const decay = randInt(10, 30);
        game.resources.sideBusiness = Math.max(0, game.resources.sideBusiness - decay);
        addReportLine(lines, 'is-bad', '你已经连续四周没有碰副业，原来的积累正在慢慢流失。');
      }
    } else {
      game.resources.sideBusinessMissWeeks = 0;
    }

    // Quarterly family support
    if (game.time.week % 4 === 0) {
      const family = findFamily(game.flags.family);
      if (family && family.support > 0) {
        game.resources.money += family.support;
        addReportLine(
          lines,
          'is-good',
          (family.key === 'orphan' ? '政府补助' : '家庭支持') + '到账：<b>' + formatMoney(family.support) + '</b>。'
        );
      }
    }

    // Research project completion
    if (game.research.project && game.research.project.progress >= game.research.project.requirement) {
      const project = game.research.project;
      game.research.articles.push({
        title: project.articleLevel,
        journal: project.journal,
        level: project.articleLevel,
        week: game.time.week
      });
      game.research.project = null;
      addReportLine(lines, 'is-good', '课题完成，你的名字出现在了一篇<b>' + escapeHTML(project.articleLevel) + '</b>文章里。');
      if (game.research.mentor) {
        game.research.project = createResearchProject(
          findSchool(game.flags.school),
          game.research.mentor,
          attributes
        );
        addReportLine(lines, 'is-good', '导师给了你新的课题：<b>' + escapeHTML(game.research.project.title) + '</b>。');
      }
    }

    const pendingNpcEvent = rollNpcWeeklyEvents(lines);

    // Exams at review weeks
    let examCount = 0;
    if (review) {
      const examCourses = game.courses.filter(function (course) {
        return !course.completed && course.examWeek === game.time.week;
      });
      examCourses.forEach(function (course) {
        const exam = settleCourseGrade(course, lines, attributes);
        examCount += 1;
        if (exam && exam.passed) {
          course.completed = true;
          course.completedWeek = game.time.week;
          course.grade = exam;
          game.credits[course.category] = (game.credits[course.category] || 0) + course.credits;
        } else if (exam) {
          course.completed = true;
          course.completedWeek = game.time.week;
          course.grade = exam;
          game.failedCourses.push({
            id: course.id,
            name: course.name,
            week: game.time.week,
            score: exam.score
          });
        }
      });
    }

    // Stress overflow
    const stressOver = game.resources.stress > game.resources.stressMax;
    if (stressOver) {
      game.resources.overStressCount += 1;
      addReportLine(
        lines,
        'is-bad',
        '压力越过了上限。这是第 <b>' + game.resources.overStressCount + '</b> 次；超过 2 次将触发退学。'
      );
    }

    // Clamp resources
    game.resources.stamina = clamp(game.resources.stamina, 0, game.resources.staminaMax);
    game.resources.stress = clamp(game.resources.stress, 0, game.resources.stressMax);
    game.resources.money = Math.max(0, Math.round(game.resources.money));

    const nextWeek = game.time.week + 1;
    const willCompleteTerm = review && game.time.week === 18;
    const doDropout = game.resources.overStressCount >= 2 && !game.ending;

    if (doDropout) {
      game.ending = {
        type: 'stress',
        title: '压力把你留在了原地。',
        kicker: 'BREAKDOWN',
        text: '第二次越过压力上限之后，你在一个本该去上课的早晨没有起床。后来辅导员来了，系主任也来了。你签了一份文件，离开那栋总是亮着白光的楼。',
        quote: '人生是旷野，有时候往回走，也是一种活法。',
        atWeek: game.time.week
      };
    }

    if (review) {
      addReportLine(
        lines,
        'is-good',
        examCount
          ? '考试周结束，共结算 ' + examCount + ' 门课程。'
          : '复习周结束，本周没有需要结算的考试。'
      );
    }

    const report = {
      week: game.time.week,
      termName: currentTermDef().name,
      title: review
        ? game.ending
          ? '这一周的重量'
          : '考试周结束。'
        : '这一周走完了。',
      metrics: {
        staminaDelta: game.resources.stamina - startingStamina,
        stressDelta: game.resources.stress - startingStress,
        moneyDelta: game.resources.money - startingMoney
      },
      lines: lines,
      nextLabel: game.ending
        ? '查看结局'
        : willCompleteTerm
          ? '查看学期总结'
          : nextWeek === 10
            ? '进入第 10 周 · 春夏前的第二教学块'
            : nextWeek === 9
              ? '进入第 9 周 · 复习考试周'
              : nextWeek === 18
                ? '进入第 18 周 · 复习考试周'
                : '进入第 ' + nextWeek + ' 周'
    };

    if (willCompleteTerm) {
      game.termComplete = true;
    }
    if (game.ending) {
      game.pendingEvent = null;
      game.pendingReport = null;
      persist();
      ui.modal = null;
      render({ scroll: 'top' });
      return;
    }
    game.pendingEvent = pendingNpcEvent;
    game.pendingReport = report;
    persist();
    ui.modal = pendingNpcEvent ? { type: 'event' } : { type: 'report' };
    render({ scroll: 'top' });
  }

  function settleCourseGrade(course, reportLines, attributes) {
    if (course.attendanceFail) {
      const grade = {
        score: 0,
        usualScore: 0,
        examScore: 0,
        quizAverage: 0,
        homeworkAverage: 0,
        passed: false,
        gpaPoint: 0,
        absenceFail: true
      };
      addReportLine(reportLines, 'is-bad', '《' + escapeHTML(course.name) + '》因三次点名缺勤直接挂科。');
      return grade;
    }
    const ratio = course.progress > 0 ? clamp(course.prep / course.progress, 0, 1.1) : 0;
    const quizAverage = clamp(Math.round(100 * ratio + randInt(-6, 6)), 0, 100);
    const homeworkAverage = clamp(Math.round(100 * ratio + randInt(-5, 5)), 0, 100);
    const attendance = attendanceScore(course);
    const quizWeight = course.quizCount * 10;
    const homeworkWeight = Math.max(0, 80 - quizWeight);
    const usual = clamp(
      attendance + (quizAverage / 100) * quizWeight + (homeworkAverage / 100) * homeworkWeight,
      0,
      100
    );
    let exam = clamp(Math.round(30 + course.prep * 0.55 + randInt(-5, 5)), 0, 100);
    let penaltyApplied = false;
    if (
      game.resources.stamina < 0 ||
      game.resources.stress > game.resources.stressMax
    ) {
      if (Math.random() < 0.5) {
        exam = Math.round(exam * 0.8);
        penaltyApplied = true;
      }
    }
    const score = Math.round(usual * 0.5 + exam * 0.5);
    const main = course.category === 'main';
    const passed = score >= 60 && (!main || exam >= 60);
    const grade = {
      score: score,
      usualScore: Math.round(usual),
      examScore: exam,
      quizAverage: quizAverage,
      homeworkAverage: homeworkAverage,
      attendanceScore: attendance,
      passed: passed,
      gpaPoint: passed ? gradePointForScore(score) : 0,
      penaltyApplied: penaltyApplied
    };
    addReportLine(
      reportLines,
      passed ? 'is-good' : 'is-bad',
      '《' + escapeHTML(course.name) + '》成绩 <b>' + score + '</b>（平时 ' + grade.usualScore + ' / 考试 ' + grade.examScore + '）' + (passed ? ' 通过。' : ' 未通过。') +
        (penaltyApplied ? ' 考前状态不佳，考试发挥受到了影响。' : '')
    );
    if (main && !passed && exam < 60) {
      addReportLine(reportLines, 'is-bad', '主修课考试分低于 60，按双通过规则直接挂科。');
    }
    if (main && passed) {
      addReportLine(reportLines, 'is-good', '主修课双通过，课程学分已计入成绩单。');
    }
    return grade;
  }

  function continueAfterReport() {
    if (game.ending) {
      game.pendingReport = null;
      game.pendingEvent = null;
      persist();
      ui.modal = null;
      render({ scroll: 'top' });
      return;
    }
    if (game.termComplete) {
      game.pendingReport = null;
      game.pendingEvent = null;
      ui.tab = 'week';
      persist();
      ui.modal = null;
      render({ scroll: 'top' });
      return;
    }
    game.time.week = clamp(game.time.week + 1, 1, 18);
    game.weekPlan = { meal: 'canteen', activities: [] };
    game.courses.forEach(function (course) {
      if (!course.completed) {
        course.attended = true;
      }
    });
    game.pendingReport = null;
    game.pendingEvent = null;
    persist();
    ui.modal = null;
    render({ scroll: 'top' });
  }

  /* ---------------------------------------------------------
     Keyboard & init
     --------------------------------------------------------- */

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && ui.modal) {
      if (ui.modal.type === 'report' || ui.modal.type === 'event') {
        return;
      }
      closeModal();
    }
  });

  if (game && game.pendingEvent && !game.ending) {
    ui.modal = { type: 'event' };
  } else if (game && game.pendingReport && !game.ending) {
    ui.modal = { type: 'report' };
  }
  if (game && game.ending) {
    ui.modal = null;
  }

  render({ scroll: 'top' });
})();
