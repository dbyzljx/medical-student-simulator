/* =========================================================
   医学生模拟器 · 序章
   人物创建 / 档案预览 / 本地存档 / 报到序章
   ========================================================= */
(function () {
  'use strict';

  const DATA = window.MEDSIM && window.MEDSIM.DATA;
  if (!DATA) {
    throw new Error('游戏数据未能载入。');
  }

  const SAVE_KEY = 'medsim.save.v1';
  const DRAFT_KEY = 'medsim.draft.v1';
  const STORAGE_VERSION = 1;
  const NAME_LIMIT = 16;

  const TALENTS = DATA.talents;
  const ATTRIBUTES = DATA.attributes;
  const FAMILIES = DATA.families;
  const ABILITIES = DATA.abilities;
  const SCHOOLS = DATA.schools;
  const STEPS = DATA.steps;
  const RULES = DATA.rules;

  const app = document.getElementById('app');
  const toastRegion = document.getElementById('toast-region');
  const confirmDialog = document.getElementById('confirm-dialog');
  const confirmTitle = document.getElementById('confirm-title');
  const confirmBody = document.getElementById('confirm-body');
  const confirmOk = document.getElementById('confirm-ok');

  let pendingConfirm = null;
  let draftTimer = 0;
  let toastTimer = 0;
  let storageWarningShown = false;

  const state = {
    screen: 'cover',
    step: 0,
    maxStep: 0,
    form: emptyForm(),
    error: '',
    save: null,
    hasDraft: false,
    admissionOpen: false,
    admissionMode: 'submit',
    admissionScrollY: 0,
    admissionReturnFocus: '',
    pendingStudentNo: ''
  };

  /* ---------------------------------------------------------
     General helpers
     --------------------------------------------------------- */

  function icon(name, extraClass) {
    return (
      '<svg class="icon' +
      (extraClass ? ' ' + extraClass : '') +
      '" aria-hidden="true" focusable="false"><use href="#i-' +
      name +
      '"></use></svg>'
    );
  }

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

  function iconOrFallback(iconName) {
    return icon(iconName || 'info');
  }

  function clamp(number, min, max) {
    return Math.min(max, Math.max(min, number));
  }

  function formatMoney(amount) {
    const value = Number.isFinite(Number(amount)) ? Number(amount) : 0;
    return '¥' + new Intl.NumberFormat('zh-CN').format(value);
  }

  function sanitizeName(value) {
    return String(value == null ? '' : value)
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .slice(0, NAME_LIMIT)
      .trim();
  }

  function formatStudentNo(number) {
    const raw = String(number == null ? '' : number).replace(/\s+/g, '');
    if (/^\d{10}$/.test(raw)) {
      return raw.slice(0, 4) + ' ' + raw.slice(4, 6) + ' ' + raw.slice(6);
    }
    return raw || '待编号';
  }

  function makeStudentNo(schoolKey, year) {
    const school = findSchool(schoolKey);
    const code = school ? school.admissionCode : '00';
    const enrollYear = Number(year) || DATA.year;
    const suffix = String(Math.floor(1000 + Math.random() * 9000));
    return String(enrollYear) + code + suffix;
  }

  function chineseYear(year) {
    const map = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
    return String(year)
      .split('')
      .map(function (digit) {
        return map[Number(digit)] || digit;
      })
      .join('');
  }

  function formatDate(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return (
      date.getFullYear() +
      '.' +
      String(date.getMonth() + 1).padStart(2, '0') +
      '.' +
      String(date.getDate()).padStart(2, '0')
    );
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

  function findAbility(key) {
    return ABILITIES.find(function (item) {
      return item.key === key;
    }) || null;
  }

  function canonicalSchoolKey(key) {
    // 兼容旧版“老八校”存档，展示层与后续逻辑统一使用清北。
    return key === 'elite8' ? 'qingbei' : key;
  }

  function findSchool(key) {
    const normalized = canonicalSchoolKey(key);
    return SCHOOLS.find(function (item) {
      return item.key === normalized;
    }) || null;
  }

  function emptyForm() {
    const attributes = {};
    ATTRIBUTES.forEach(function (attribute) {
      attributes[attribute.key] = RULES.attributeMin;
    });
    return {
      name: '',
      talent: null,
      attributes: attributes,
      family: null,
      abilities: [],
      school: null
    };
  }

  function attributesTotal(attributes) {
    return ATTRIBUTES.reduce(function (sum, attribute) {
      return sum + (Number(attributes && attributes[attribute.key]) || 0);
    }, 0);
  }

  function selectedAbilities(codes) {
    return (codes || [])
      .map(findAbility)
      .filter(Boolean);
  }

  function abilityCost(codes) {
    return selectedAbilities(codes).reduce(function (sum, ability) {
      return sum + ability.cost;
    }, 0);
  }

  function attrIsComplete() {
    const talent = findTalent(state.form.talent);
    if (!talent) {
      return false;
    }
    const total = attributesTotal(state.form.attributes);
    return (
      total === talent.attrPoints &&
      ATTRIBUTES.every(function (attribute) {
        const value = state.form.attributes[attribute.key];
        return value >= RULES.attributeMin && value <= RULES.attributeMax;
      })
    );
  }

  function isStepDone(index) {
    if (index === 0) {
      return Boolean(findTalent(state.form.talent));
    }
    if (index === 1) {
      return attrIsComplete();
    }
    if (index === 2) {
      return Boolean(findFamily(state.form.family));
    }
    if (index === 3) {
      return state.step > 3 || state.maxStep > 3;
    }
    if (index === 4) {
      return Boolean(findSchool(state.form.school));
    }
    return false;
  }

  function displayNameFrom(rawName) {
    return sanitizeName(rawName) || '你';
  }

  function periodicSupportText(family) {
    if (!family) {
      return '—';
    }
    if (family.key === 'poor') {
      return '申请后 ' + formatMoney(500) + ' / 4周';
    }
    if (family.support > 0) {
      return formatMoney(family.support) + ' / 4周';
    }
    return '无';
  }

  function periodicSupportCompact(family) {
    if (!family) {
      return '—';
    }
    if (family.key === 'poor') {
      return '待申请';
    }
    if (family.support > 0) {
      return formatMoney(family.support) + ' / 4周';
    }
    return '无';
  }

  function supportSourceLabel(family) {
    if (!family) {
      return '周期支持';
    }
    if (family.key === 'orphan') {
      return '政府补助';
    }
    if (family.key === 'poor') {
      return '助学金';
    }
    return '家庭供给';
  }

  function resolveStudentRecord(source) {
    if (!source) {
      return null;
    }
    const attributes = {};
    ATTRIBUTES.forEach(function (attribute) {
      const rawValue = source.attributes ? source.attributes[attribute.key] : RULES.attributeMin;
      const parsed = Number.parseInt(rawValue, 10);
      attributes[attribute.key] = clamp(
        Number.isFinite(parsed) ? parsed : RULES.attributeMin,
        RULES.attributeMin,
        RULES.attributeMax
      );
    });
    const talent = findTalent(source.talent);
    const family = findFamily(source.family);
    const school = findSchool(source.school);
    const abilities = selectedAbilities(source.abilities);
    const name = sanitizeName(source.name);
    return {
      name: name,
      displayName: name || '你',
      talent: talent,
      family: family,
      school: school,
      abilities: abilities,
      attributes: attributes,
      attributesTotal: attributesTotal(attributes),
      abilitySpent: abilities.reduce(function (sum, ability) {
        return sum + ability.cost;
      }, 0),
      studentNo: source.studentNo ? String(source.studentNo) : '',
      enrollYear: Number(source.enrollYear) || DATA.year
    };
  }

  function currentCoverView() {
    if (state.save) {
      return resolveStudentRecord(state.save.student);
    }
    if (state.hasDraft) {
      return resolveStudentRecord({
        name: state.form.name,
        talent: state.form.talent,
        attributes: state.form.attributes,
        family: state.form.family,
        abilities: state.form.abilities,
        school: state.form.school
      });
    }
    return null;
  }

  /* ---------------------------------------------------------
     Storage
     --------------------------------------------------------- */

  function readStoredJSON(key) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function writeStoredJSON(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      if (!storageWarningShown) {
        storageWarningShown = true;
        showToast('浏览器未能保存本地档案，刷新页面后进度可能丢失。');
      }
      return false;
    }
  }

  function removeStored(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      /* Storage being unavailable is non-fatal for the current session. */
    }
  }

  function parseDraft(raw) {
    if (!raw || raw.v !== STORAGE_VERSION || !raw.form) {
      return null;
    }
    const form = emptyForm();
    form.name = sanitizeName(raw.form.name);
    form.talent = findTalent(raw.form.talent) ? raw.form.talent : null;
    form.family = findFamily(raw.form.family) ? raw.form.family : null;
    form.school = findSchool(raw.form.school) ? findSchool(raw.form.school).key : null;
    ATTRIBUTES.forEach(function (attribute) {
      const parsed = Number.parseInt(raw.form.attributes && raw.form.attributes[attribute.key], 10);
      form.attributes[attribute.key] = Number.isFinite(parsed)
        ? clamp(parsed, RULES.attributeMin, RULES.attributeMax)
        : RULES.attributeMin;
    });
    if (Array.isArray(raw.form.abilities)) {
      raw.form.abilities.forEach(function (key) {
        if (findAbility(key) && form.abilities.indexOf(key) === -1) {
          form.abilities.push(key);
        }
      });
    }

    const talent = findTalent(form.talent);
    if (talent) {
      if (attributesTotal(form.attributes) > talent.attrPoints) {
        ATTRIBUTES.forEach(function (attribute) {
          form.attributes[attribute.key] = RULES.attributeMin;
        });
      }
      while (abilityCost(form.abilities) > talent.abilityPoints && form.abilities.length) {
        form.abilities.pop();
      }
    } else {
      form.abilities = [];
    }

    const step = clamp(Number.parseInt(raw.step, 10) || 0, 0, STEPS.length - 1);
    let maxStep = clamp(Number.parseInt(raw.maxStep, 10) || step, 0, STEPS.length - 1);
    maxStep = Math.max(maxStep, step);
    return {
      form: form,
      step: step,
      maxStep: maxStep,
      updatedAt: raw.updatedAt || null
    };
  }

  function parseSave(raw) {
    if (!raw || raw.v !== STORAGE_VERSION || !raw.student) {
      return null;
    }
    const student = raw.student;
    if (!findTalent(student.talent) || !findFamily(student.family) || !findSchool(student.school)) {
      return null;
    }
    const canonicalSchool = findSchool(student.school).key;
    const status = raw.status === 'arrival' ? 'arrival' : 'complete';
    const year = clamp(Number(student.enrollYear) || DATA.year, 2000, 2100);
    let studentNo = String(student.studentNo || '').replace(/\s+/g, '');
    if (!/^\d{10}$/.test(studentNo)) {
      studentNo = makeStudentNo(student.school, year);
    }
    const parsedStudent = {
      name: sanitizeName(student.name),
      talent: student.talent,
      attributes: {},
      family: student.family,
      abilities: [],
      school: canonicalSchool,
      studentNo: studentNo,
      enrollYear: year
    };
    ATTRIBUTES.forEach(function (attribute) {
      const parsed = Number.parseInt(student.attributes && student.attributes[attribute.key], 10);
      parsedStudent.attributes[attribute.key] = Number.isFinite(parsed)
        ? clamp(parsed, RULES.attributeMin, RULES.attributeMax)
        : RULES.attributeMin;
    });
    if (Array.isArray(student.abilities)) {
      student.abilities.forEach(function (key) {
        if (findAbility(key) && parsedStudent.abilities.indexOf(key) === -1) {
          parsedStudent.abilities.push(key);
        }
      });
    }
    const talent = findTalent(parsedStudent.talent);
    while (abilityCost(parsedStudent.abilities) > talent.abilityPoints && parsedStudent.abilities.length) {
      parsedStudent.abilities.pop();
    }
    return {
      v: STORAGE_VERSION,
      status: status,
      createdAt: raw.createdAt || new Date().toISOString(),
      updatedAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
      completedAt: raw.completedAt || null,
      student: parsedStudent
    };
  }

  function persistDraftNow() {
    if (state.screen !== 'creator') {
      return;
    }
    const payload = {
      v: STORAGE_VERSION,
      form: {
        name: state.form.name,
        talent: state.form.talent,
        attributes: Object.assign({}, state.form.attributes),
        family: state.form.family,
        abilities: state.form.abilities.slice(),
        school: state.form.school
      },
      step: state.step,
      maxStep: state.maxStep,
      updatedAt: new Date().toISOString()
    };
    const saved = writeStoredJSON(DRAFT_KEY, payload);
    if (saved) {
      state.hasDraft = true;
    }
  }

  function debouncePersistDraft() {
    window.clearTimeout(draftTimer);
    draftTimer = window.setTimeout(persistDraftNow, 320);
  }

  function clearDraft() {
    window.clearTimeout(draftTimer);
    removeStored(DRAFT_KEY);
    state.hasDraft = false;
  }

  function saveGame(status) {
    if (!state.form.school || !state.form.talent || !state.form.family) {
      return null;
    }
    const now = new Date().toISOString();
    const studentNo = state.pendingStudentNo || makeStudentNo(state.form.school, DATA.year);
    const student = {
      name: sanitizeName(state.form.name),
      talent: state.form.talent,
      attributes: Object.assign({}, state.form.attributes),
      family: state.form.family,
      abilities: state.form.abilities.slice(),
      school: state.form.school,
      studentNo: studentNo,
      enrollYear: DATA.year
    };
    const save = {
      v: STORAGE_VERSION,
      status: status,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      student: student
    };
    const persisted = writeStoredJSON(SAVE_KEY, save);
    if (!persisted) {
      showToast('存档写入失败，本次进度只保留在当前页面。');
    }
    clearDraft();
    state.save = save;
    return save;
  }

  function updateSavedStatus(status) {
    if (!state.save) {
      return;
    }
    const updated = Object.assign({}, state.save, {
      status: status,
      updatedAt: new Date().toISOString(),
      completedAt: status === 'complete' ? new Date().toISOString() : state.save.completedAt
    });
    writeStoredJSON(SAVE_KEY, updated);
    state.save = updated;
  }

  /* ---------------------------------------------------------
     Validation
     --------------------------------------------------------- */

  function validateStep(index) {
    if (index === 0) {
      if (!findTalent(state.form.talent)) {
        return '先选择一种天资，再继续。天资决定你的属性点、能力点与成长点。';
      }
      return '';
    }
    if (index === 1) {
      const talent = findTalent(state.form.talent);
      if (!talent) {
        return '还没有选择天资，无法分配属性点。';
      }
      const total = attributesTotal(state.form.attributes);
      if (total < talent.attrPoints) {
        return '还有 ' + (talent.attrPoints - total) + ' 点属性没有分配。请把所有点数投入六项属性。';
      }
      if (total > talent.attrPoints) {
        return '属性点超出了上限，请减少分配。';
      }
      const invalid = ATTRIBUTES.find(function (attribute) {
        const value = state.form.attributes[attribute.key];
        return value < RULES.attributeMin || value > RULES.attributeMax;
      });
      if (invalid) {
        return '「' + invalid.name + '」的投入必须在 3 到 10 点之间。';
      }
      return '';
    }
    if (index === 2) {
      if (!findFamily(state.form.family)) {
        return '请选择一种家庭背景。它会决定你的起步资金与周期支持。';
      }
      return '';
    }
    if (index === 3) {
      const talent = findTalent(state.form.talent);
      if (talent && abilityCost(state.form.abilities) > talent.abilityPoints) {
        return '已选择的初始能力超出了能力点上限。';
      }
      return '';
    }
    if (index === 4) {
      if (!findSchool(state.form.school)) {
        return '请选择一所院校。不同院校的竞争强度与年度排名压力不同。';
      }
      return '';
    }
    return '';
  }

  function validateAll() {
    for (let index = 0; index < STEPS.length - 1; index += 1) {
      const error = validateStep(index);
      if (error) {
        return { step: index, message: error };
      }
    }
    return null;
  }

  /* ---------------------------------------------------------
     Toasts & confirm dialog
     --------------------------------------------------------- */

  function showToast(message) {
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
    }, 3300);
  }

  function openConfirm(options) {
    if (confirmDialog.open) {
      return;
    }
    confirmTitle.textContent = options.title || '确认操作';
    confirmBody.textContent = options.body || '';
    confirmOk.textContent = options.confirmLabel || '确认';
    confirmOk.className = 'btn ' + (options.tone === 'primary' ? 'btn-primary' : 'btn-danger');
    pendingConfirm = typeof options.onConfirm === 'function' ? options.onConfirm : null;
    confirmDialog.returnValue = '';
    confirmDialog.showModal();
  }

  confirmDialog.addEventListener('close', function () {
    const callback = pendingConfirm;
    pendingConfirm = null;
    if (confirmDialog.returnValue === 'confirm' && callback) {
      callback();
    }
  });

  confirmDialog.addEventListener('click', function (event) {
    if (event.target === confirmDialog) {
      confirmDialog.close('cancel');
    }
  });

  /* ---------------------------------------------------------
     Shared view helpers
     --------------------------------------------------------- */

  function brandMarkup() {
    return (
      '<div class="brand" aria-label="医学生模拟器">' +
      '<span class="brand-mark" aria-hidden="true"><span></span></span>' +
      '<span class="brand-text"><strong>医学生模拟器</strong><small>MEDICAL STUDENT SIMULATOR</small></span>' +
      '</div>'
    );
  }

  function archiveStatusWord() {
    if (state.save && state.save.status === 'complete') {
      return '档案已归档';
    }
    if (state.save) {
      return '新生已报到';
    }
    if (state.hasDraft) {
      return '建档进行中';
    }
    return '等待建档';
  }

  function abilityTagsMarkup(abilities, withCost) {
    if (!abilities.length) {
      return '<p class="review-ability-empty">没有领取初始能力。未使用的能力点不会带入游戏。</p>';
    }
    return (
      '<div class="review-ability-list">' +
      abilities
        .map(function (ability) {
          return (
            '<span>' +
            escapeHTML(ability.name) +
            (withCost ? '<b>' + ability.cost + ' PTS</b>' : '') +
            '</span>'
          );
        })
        .join('') +
      '</div>'
    );
  }

  /* ---------------------------------------------------------
     Cover
     --------------------------------------------------------- */

  function renderCoverArchive(view) {
    const hasSave = Boolean(state.save);
    const hasDraft = state.hasDraft;
    const name = view ? view.name || view.displayName : '';
    const stampWord = hasSave
      ? state.save.status === 'complete'
        ? '已注册'
        : '已报到'
      : hasDraft
        ? '填写中'
        : '待建档';

    const rows = [];
    if (hasSave) {
      rows.push(['院校', view && view.school ? view.school.name : '—']);
      rows.push(['天资', view && view.talent ? view.talent.name : '—']);
      rows.push(['档案', state.save.status === 'complete' ? '序章 · 已完成' : '报到日 · 待续']);
    } else if (hasDraft) {
      rows.push(['天资', view && view.talent ? view.talent.name : '未选择']);
      rows.push(['院校', view && view.school ? view.school.name : '未选择']);
      rows.push(['阶段', '本科 · 新生建档']);
    } else {
      rows.push(['阶段', '本科 → 硕士 → 博士']);
      rows.push(['路径', '课程 / 科研 / 临床']);
      rows.push(['状态', '由你填写']);
    }

    const archiveNo = view && view.studentNo ? formatStudentNo(view.studentNo) : 'NO. 0001';

    return (
      '<aside class="cover-art" aria-label="新生档案预览">' +
      '<div class="art-orbit" aria-hidden="true"></div>' +
      '<svg class="art-pulse" viewBox="0 0 600 90" aria-hidden="true">' +
      '<path d="M0 48 H128 l15 -23 14 50 23 -70 16 42 12 -15 24 31 H330 l18 -31 16 42 23 -58 15 37 18 -23 H600"></path>' +
      '</svg>' +
      '<div class="paperclip" aria-hidden="true"></div>' +
      '<div class="archive-card">' +
      '<span class="archive-tab">' +
      (hasSave ? 'STUDENT RECORD' : 'NEW STUDENT FILE') +
      ' / 新生档案</span>' +
      '<div class="archive-top">' +
      '<span>MEDICAL SCHOOL<br>ADMISSION ' +
      escapeHTML(DATA.year) +
      '</span>' +
      '<span>' +
      escapeHTML(archiveNo) +
      '</span>' +
      '</div>' +
      '<p class="archive-label">NAME / 姓名</p>' +
      '<div class="archive-name">' +
      escapeHTML(name || '未命名') +
      '</div>' +
      '<div class="archive-rule"></div>' +
      '<div class="archive-rows">' +
      rows
        .map(function (row) {
          return (
            '<div class="archive-row"><span>' +
            escapeHTML(row[0]) +
            '</span><b>' +
            escapeHTML(row[1]) +
            '</b></div>'
          );
        })
        .join('') +
      '</div>' +
      '<p class="archive-quote">“在成为医生之前，先成为一个能撑住的人。”</p>' +
      '<div class="archive-stamp" aria-hidden="true">' +
      Array.from(stampWord)
        .map(function (char) {
          return escapeHTML(char);
        })
        .join('<br>') +
      '</div>' +
      '<div class="archive-footer">' +
      '<div class="barcode" aria-hidden="true"></div>' +
      '<small>MEDSIM · ' +
      escapeHTML(DATA.year) +
      ' · PROLOGUE</small>' +
      '</div>' +
      '</div>' +
      '<div class="archive-caption">' +
      '<span>FIG. 01</span>' +
      '<p>' +
      (hasSave
        ? state.save.status === 'complete'
          ? '一份已经归档的新生档案。'
          : '一份待续写的新生档案。'
        : hasDraft
          ? '一份正在填写的新生档案。'
          : '一份尚未完成的新生档案。') +
      '<br>姓名、天资与家庭，都由你决定。</p>' +
      '</div>' +
      '</aside>'
    );
  }

  function renderCover() {
    const view = currentCoverView();
    const hasSave = Boolean(state.save);
    const hasDraft = state.hasDraft;

    let primaryAction = 'start-new';
    let primaryLabel = '建立新生档案';
    if (hasSave) {
      primaryAction = 'resume-save';
      primaryLabel = state.save.status === 'arrival' ? '继续报到序章' : '查看学籍档案';
    } else if (hasDraft) {
      primaryAction = 'resume-draft';
      primaryLabel = '继续填写新生档案';
    }

    const secondary = [];
    if (hasSave && hasDraft) {
      secondary.push({
        action: 'resume-draft',
        label: '继续未完成的新生档案'
      });
      secondary.push({
        action: 'start-new',
        label: '建立新档案'
      });
    } else if (hasSave) {
      secondary.push({
        action: 'start-new',
        label: '建立新档案'
      });
    } else if (hasDraft) {
      secondary.push({
        action: 'start-new',
        label: '重新开始'
      });
    }

    return (
      '<div class="cover-screen">' +
      '<header class="cover-header">' +
      brandMarkup() +
      '<div class="cover-header-meta">' +
      '<span>PROLOGUE / 00</span><span class="meta-separator"></span>' +
      '<span class="meta-dot"></span><span>' +
      escapeHTML(archiveStatusWord()) +
      '</span>' +
      '</div>' +
      '</header>' +
      '<main class="cover-main" id="main-content">' +
      '<section class="cover-copy">' +
      '<p class="cover-kicker"><span>EPISODE 00</span><span>白袍之前</span></p>' +
      '<h1 class="cover-title" tabindex="-1">' +
      '<span class="cover-title-line">医学生</span>' +
      '<span class="cover-title-line">模拟器<span class="title-period">.</span></span>' +
      '</h1>' +
      '<div class="cover-intro">' +
      '<p class="cover-lede">从第一次走进解剖楼的紧张，到博士答辩后的沉默。<br>' +
      '<strong>一周一回合</strong>。在课程、科研、金钱与体力之间，<br>过完你的医学生时代。</p>' +
      '<div class="cover-actions">' +
      '<button class="btn btn-primary" type="button" data-action="' +
      primaryAction +
      '"><span>' +
      primaryLabel +
      '</span>' +
      icon('arrow-right', 'icon-arrow') +
      '</button>' +
      (secondary.length
        ? '<div class="cover-secondary-links">' +
          secondary
            .map(function (item) {
              return (
                '<button class="text-btn" type="button" data-action="' +
                item.action +
                '">' +
                escapeHTML(item.label) +
                '</button>'
              );
            })
            .join('') +
          '</div>'
        : '') +
      '</div>' +
      '</div>' +
      '<div class="cover-footnote"><span class="footnote-mark"></span> 当前开放：人物创建与序章</div>' +
      '<div class="cover-facts" aria-label="游戏信息">' +
      '<span class="fact"><b>一周</b><span>一回合</span></span>' +
      '<span class="fact-arrow">→</span>' +
      '<span class="fact"><b>本科</b><span>STAGE 01</span></span>' +
      '<span class="fact-arrow">→</span>' +
      '<span class="fact"><b>硕士</b><span>STAGE 02</span></span>' +
      '<span class="fact-arrow">→</span>' +
      '<span class="fact"><b>博士</b><span>STAGE 03</span></span>' +
      '</div>' +
      '</section>' +
      renderCoverArchive(view) +
      '</main>' +
      '<footer class="cover-footer">' +
      '<span>MEDSIM · PROLOGUE 00 · ' +
      escapeHTML(DATA.year) +
      '</span>' +
      '<span class="footer-chapters"><b>本科</b><span class="footer-slash">/</span><b>硕士</b><span class="footer-slash">/</span><b>博士</b></span>' +
      '</footer>' +
      '</div>'
    );
  }

  /* ---------------------------------------------------------
     Creator shell
     --------------------------------------------------------- */

  function renderMobileFilebar() {
    const talent = findTalent(state.form.talent);
    const school = findSchool(state.form.school);
    const descriptor = talent ? talent.name + '天资' : '天资未选';
    const second = school ? school.short : descriptor;
    return (
      '<div class="mobile-filebar">' +
      '<span class="filebar-mark" aria-hidden="true">' +
      icon('user') +
      '</span>' +
      '<div class="mobile-filebar-main">' +
      '<span>NEW STUDENT FILE / 新生档案</span>' +
      '<b><span data-live="mobile-name">' +
      escapeHTML(displayNameFrom(state.form.name)) +
      '</span> · ' +
      escapeHTML(second) +
      '</b>' +
      '</div>' +
      '<div class="mobile-filebar-meta">' +
      escapeHTML(STEPS[state.step].no) +
      '<br>/ 06</div>' +
      '</div>'
    );
  }

  function renderStepNav() {
    return (
      '<nav class="step-nav" aria-label="建档步骤">' +
      '<div class="step-nav-inner">' +
      STEPS.map(function (step, index) {
        const current = index === state.step;
        const done = isStepDone(index) && !current;
        const unavailable = index > state.maxStep;
        return (
          '<button type="button" class="step-tab' +
          (current ? ' is-current' : '') +
          (done ? ' is-done' : '') +
          '" data-action="jump-step" data-step="' +
          index +
          '"' +
          (current ? ' aria-current="step"' : '') +
          (unavailable ? ' disabled' : '') +
          ' aria-label="第 ' +
          (index + 1) +
          ' 步：' +
          escapeHTML(step.title) +
          '"><span class="step-tab-no">' +
          step.no +
          '</span><span class="step-tab-label">' +
          escapeHTML(step.nav) +
          '</span></button>'
        );
      }).join('') +
      '</div>' +
      '</nav>'
    );
  }

  function renderCreator() {
    const step = STEPS[state.step];
    const autosave = state.hasDraft ? '草稿已自动保存' : '草稿自动保存';
    return (
      '<div class="creator-screen">' +
      '<header class="creator-header">' +
      '<div class="creator-header-inner">' +
      brandMarkup() +
      '<div class="creator-header-tools">' +
      '<span class="autosave-note' +
      (state.hasDraft ? ' is-saved' : '') +
      '">' +
      autosave +
      '</span>' +
      '<button type="button" class="text-btn" data-action="exit-creator">' +
      icon('arrow-left') +
      '保存并离开</button>' +
      '</div>' +
      '</div>' +
      '</header>' +
      renderStepNav() +
      '<div class="creator-shell">' +
      '<main class="form-pane" id="main-content">' +
      renderMobileFilebar() +
      '<div class="step-heading">' +
      '<p class="step-eyebrow">STEP ' +
      step.no +
      ' / 06 — ' +
      escapeHTML(step.eyebrow) +
      '</p>' +
      '<div class="step-title-row">' +
      '<span class="step-number">' +
      step.no +
      '</span>' +
      '<h1 id="step-title" tabindex="-1">' +
      escapeHTML(step.title) +
      '</h1>' +
      '</div>' +
      '<p class="step-lead">' +
      escapeHTML(step.lead) +
      '</p>' +
      '</div>' +
      '<div class="step-body">' +
      renderStepContent() +
      '</div>' +
      (state.error
        ? '<div class="form-error" id="form-error" role="alert" tabindex="-1">' +
          icon('info') +
          '<span>' +
          escapeHTML(state.error) +
          '</span></div>'
        : '') +
      renderStepActions() +
      '</main>' +
      renderDossier() +
      '</div>' +
      '</div>'
    );
  }

  /* ---------------------------------------------------------
     Step 01 — identity
     --------------------------------------------------------- */

  function renderTalentOption(talent, index) {
    const selected = state.form.talent === talent.key;
    const level = index + 1;
    return (
      '<button type="button" class="talent-option' +
      (selected ? ' is-selected' : '') +
      '" data-action="select-talent" data-key="' +
      talent.key +
      '" aria-pressed="' +
      selected +
      '">' +
      '<span class="talent-ordinal"><span>天资 ' +
      String(index + 1).padStart(2, '0') +
      '</span><span>' +
      escapeHTML(talent.en) +
      '</span></span>' +
      '<span class="talent-select-mark" aria-hidden="true">' +
      icon('check') +
      '</span>' +
      '<span class="talent-level" aria-hidden="true">' +
      [1, 2, 3, 4]
        .map(function (value) {
          return '<i class="' + (value <= level ? 'is-on' : '') + '"></i>';
        })
        .join('') +
      '</span>' +
      '<span class="talent-name">' +
      escapeHTML(talent.name) +
      '</span>' +
      '<span class="talent-tagline">' +
      escapeHTML(talent.tagline) +
      '</span>' +
      '<span class="talent-desc">' +
      escapeHTML(talent.desc) +
      '</span>' +
      '<span class="talent-points">' +
      '<span><b>' +
      talent.attrPoints +
      '</b><small>属性点</small></span>' +
      '<span><b>' +
      talent.abilityPoints +
      '</b><small>能力点</small></span>' +
      '<span><b>+' +
      talent.growthPoints +
      '</b><small>成长 / 学年</small></span>' +
      '</span>' +
      '</button>'
    );
  }

  function renderIdentityStep() {
    const nameLength = state.form.name.length;
    return (
      '<section class="form-section" aria-labelledby="name-heading">' +
      '<div class="section-heading-row">' +
      '<h2 id="name-heading">写下你的名字</h2>' +
      '<span class="section-meta">NAME / OPTIONAL</span>' +
      '</div>' +
      '<div class="name-field">' +
      '<div class="name-label-row">' +
      '<label for="name-input">姓名<span class="optional-tag">选填</span></label>' +
      '</div>' +
      '<div class="name-input-shell">' +
      '<span class="name-prefix" aria-hidden="true">NAME</span>' +
      '<input id="name-input" type="text" name="student-name" maxlength="' +
      NAME_LIMIT +
      '" autocomplete="off" spellcheck="false" placeholder="例：林知远（可留空）" value="' +
      escapeHTML(state.form.name) +
      '" aria-describedby="name-hint">' +
      '<span class="name-counter"><span data-live="name-count">' +
      nameLength +
      '</span> / ' +
      NAME_LIMIT +
      '</span>' +
      '</div>' +
      '<p class="field-hint" id="name-hint">名字会出现在录取通知书、日后的奖项与证书上。留空的话，游戏会直接以「<strong>你</strong>」称呼你。</p>' +
      '</div>' +
      '</section>' +
      '<section class="form-section" aria-labelledby="talent-heading">' +
      '<div class="section-heading-row">' +
      '<h2 id="talent-heading">选择天资</h2>' +
      '<span class="section-meta">APTITUDE / STARTING POINTS</span>' +
      '</div>' +
      '<div class="talent-grid" role="group" aria-labelledby="talent-heading">' +
      TALENTS.map(renderTalentOption).join('') +
      '</div>' +
      '<div class="inline-note">' +
      icon('info') +
      '<span>天资决定开局属性点、可用能力点与每学年成长点。属性点越多，起点越高；成长点会在后续学年提供额外的可分配属性。</span>' +
      '</div>' +
      '</section>'
    );
  }

  /* ---------------------------------------------------------
     Step 02 — attributes
     --------------------------------------------------------- */

  function distributeEvenly() {
    const talent = findTalent(state.form.talent);
    if (!talent) {
      return;
    }
    let remaining = talent.attrPoints - attributesTotal(state.form.attributes);
    let guard = 0;
    while (remaining > 0 && guard < 100) {
      const available = ATTRIBUTES.filter(function (attribute) {
        return state.form.attributes[attribute.key] < RULES.attributeMax;
      }).sort(function (a, b) {
        return state.form.attributes[a.key] - state.form.attributes[b.key];
      });
      if (!available.length) {
        break;
      }
      state.form.attributes[available[0].key] += 1;
      remaining -= 1;
      guard += 1;
    }
  }

  function randomizeAttributes() {
    const talent = findTalent(state.form.talent);
    if (!talent) {
      return;
    }
    ATTRIBUTES.forEach(function (attribute) {
      state.form.attributes[attribute.key] = RULES.attributeMin;
    });
    let remaining = talent.attrPoints - attributesTotal(state.form.attributes);
    let guard = 0;
    while (remaining > 0 && guard < 200) {
      const available = ATTRIBUTES.filter(function (attribute) {
        return state.form.attributes[attribute.key] < RULES.attributeMax;
      });
      if (!available.length) {
        break;
      }
      const chosen = available[Math.floor(Math.random() * available.length)];
      state.form.attributes[chosen.key] += 1;
      remaining -= 1;
      guard += 1;
    }
  }

  function renderAttributeCard(attribute) {
    const value = state.form.attributes[attribute.key];
    const talent = findTalent(state.form.talent);
    const remaining = talent ? talent.attrPoints - attributesTotal(state.form.attributes) : 0;
    const atMin = value <= RULES.attributeMin;
    const atMax = value >= RULES.attributeMax;
    const cannotAdd = atMax || remaining <= 0;
    return (
      '<article class="attribute-card" style="--accent:' +
      attribute.color +
      '">' +
      '<div class="attribute-card-head">' +
      '<span class="attribute-icon" aria-hidden="true">' +
      icon(attribute.icon) +
      '</span>' +
      '<div class="attribute-name"><h3>' +
      escapeHTML(attribute.name) +
      '</h3><span>' +
      escapeHTML(attribute.en) +
      '</span></div>' +
      '<span class="attribute-value"><b>' +
      value +
      '</b><small>/ 10</small></span>' +
      '</div>' +
      '<div class="attribute-pips" aria-hidden="true">' +
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        .map(function (pip) {
          return '<i class="' + (pip <= value ? 'is-filled' : '') + '"></i>';
        })
        .join('') +
      '</div>' +
      '<p class="attribute-card-desc">' +
      escapeHTML(attribute.desc) +
      '</p>' +
      '<div class="attribute-controls">' +
      '<div class="stat-controls-pair">' +
      '<button type="button" class="stat-btn" data-action="stat-minus" data-key="' +
      attribute.key +
      '" aria-label="减少' +
      escapeHTML(attribute.name) +
      '"' +
      (atMin ? ' disabled' : '') +
      '>−</button>' +
      '<button type="button" class="stat-btn" data-action="stat-plus" data-key="' +
      attribute.key +
      '" aria-label="增加' +
      escapeHTML(attribute.name) +
      '"' +
      (cannotAdd ? ' disabled' : '') +
      '>+</button>' +
      '</div>' +
      '<span>' +
      (atMax
        ? '已达上限'
        : cannotAdd
          ? '点数已用尽'
          : '每次投入 1 点') +
      '</span>' +
      '</div>' +
      '</article>'
    );
  }

  function renderAttributesStep() {
    const talent = findTalent(state.form.talent);
    const cap = talent ? talent.attrPoints : 30;
    const used = attributesTotal(state.form.attributes);
    const remaining = cap - used;
    const percentage = clamp(Math.round((used / cap) * 100), 0, 100);
    return (
      '<div class="attribute-budget">' +
      '<div class="attribute-budget-main" aria-live="polite">' +
      '<span>剩余可分配</span><strong>' +
      remaining +
      '</strong><small>PTS</small></div>' +
      '<div class="attribute-budget-side">' +
      '<div class="budget-progress">' +
      '<div class="budget-progress-meta"><span>已投入</span><b>' +
      used +
      ' / ' +
      cap +
      '</b></div>' +
      '<div class="budget-track" aria-hidden="true"><i style="width:' +
      percentage +
      '%"></i></div>' +
      '</div>' +
      '<div class="allocation-tools">' +
      '<button type="button" class="tool-btn" data-action="distribute-even">均分余点</button>' +
      '<button type="button" class="tool-btn" data-action="randomize-attributes">随机分配</button>' +
      '<button type="button" class="tool-btn" data-action="reset-attributes">重置至 3</button>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="attribute-grid">' +
      ATTRIBUTES.map(renderAttributeCard).join('') +
      '</div>' +
      (remaining > 0
        ? '<div class="attribute-budget-warning">' +
          icon('info') +
          '<span>还有 ' +
          remaining +
          ' 点没有分配。必须把所有属性点用完，才能进入下一步。</span></div>'
        : '<div class="inline-note">' +
          icon('check') +
          '<span>六项属性已全部投入。开局分配在进入本科后不会再重置。</span></div>')
    );
  }

  /* ---------------------------------------------------------
     Step 03 — family
     --------------------------------------------------------- */

  function renderFamilyCard(family) {
    const selected = state.form.family === family.key;
    const periodicValue =
      family.key === 'poor'
        ? '需申请'
        : family.support
          ? formatMoney(family.support) + ' / 4周'
          : '无';
    return (
      '<button type="button" class="family-option' +
      (selected ? ' is-selected' : '') +
      '" data-action="select-family" data-key="' +
      family.key +
      '" aria-pressed="' +
      selected +
      '">' +
      '<span class="family-option-head">' +
      '<span class="family-icon" aria-hidden="true">' +
      icon(family.icon) +
      '</span>' +
      '<span class="family-name"><span class="family-cn">' +
      escapeHTML(family.name) +
      '</span><span class="family-en">' +
      escapeHTML(family.en) +
      '</span></span>' +
      '<span class="family-select-mark" aria-hidden="true">' +
      icon('check') +
      '</span>' +
      '</span>' +
      '<span class="family-desc">' +
      escapeHTML(family.desc) +
      '</span>' +
      '<span class="family-ledger">' +
      '<span><small>起步资金</small><b>' +
      formatMoney(family.money) +
      '</b></span>' +
      '<span><small>' +
      (family.key === 'orphan' ? '每 4 周补助' : '每 4 周支持') +
      '</small><b>' +
      periodicValue +
      '</b></span>' +
      '</span>' +
      '<span class="family-tags">' +
      family.tags
        .map(function (tag) {
          return '<span>' + escapeHTML(tag) + '</span>';
        })
        .join('') +
      '</span>' +
      '<span class="family-note">' +
      escapeHTML(family.note) +
      '</span>' +
      '</button>'
    );
  }

  function renderFamilyStep() {
    return (
      '<div class="family-grid">' +
      FAMILIES.map(renderFamilyCard).join('') +
      '</div>' +
      '<div class="inline-note">' +
      icon('info') +
      '<span>经济支持按每 4 周结算一次。孤儿与申请助学金的贫穷家庭可享受餐费全免；助学金带来的限制会在后续事件中体现。</span>' +
      '</div>'
    );
  }

  /* ---------------------------------------------------------
     Step 04 — abilities
     --------------------------------------------------------- */

  function renderAbilityCard(ability) {
    const selected = state.form.abilities.indexOf(ability.key) !== -1;
    const talent = findTalent(state.form.talent);
    const cap = talent ? talent.abilityPoints : 0;
    const remaining = cap - abilityCost(state.form.abilities);
    const unaffordable = !selected && ability.cost > remaining;
    return (
      '<button type="button" class="ability-option' +
      (selected ? ' is-selected' : '') +
      (unaffordable ? ' is-unaffordable' : '') +
      '" data-action="select-ability" data-key="' +
      ability.key +
      '" aria-pressed="' +
      selected +
      '">' +
      '<span class="ability-top">' +
      '<span class="ability-icon" aria-hidden="true">' +
      icon(ability.icon) +
      '</span>' +
      '<span class="ability-cost">' +
      ability.cost +
      ' PTS</span>' +
      '</span>' +
      '<span class="ability-option-head">' +
      '<span class="ability-name-block"><span class="ability-cn">' +
      escapeHTML(ability.name) +
      '</span><span class="ability-en">' +
      escapeHTML(ability.en) +
      '</span></span>' +
      '<span class="ability-select-mark" aria-hidden="true">' +
      icon('check') +
      '</span>' +
      '</span>' +
      '<span class="ability-effect">' +
      escapeHTML(ability.effect) +
      '</span>' +
      '<span class="ability-desc">' +
      escapeHTML(ability.desc) +
      '</span>' +
      '</button>'
    );
  }

  function renderAbilitiesStep() {
    const talent = findTalent(state.form.talent);
    const cap = talent ? talent.abilityPoints : 0;
    const spent = abilityCost(state.form.abilities);
    const remaining = cap - spent;
    return (
      '<div class="ability-budget">' +
      '<div class="ability-budget-main">' +
      '<span>可用能力点</span><strong>' +
      remaining +
      '</strong><small>/ ' +
      cap +
      ' PTS</small></div>' +
      '<div class="ability-budget-side">' +
      '<span>已选择 ' +
      state.form.abilities.length +
      ' 项 · 已用 ' +
      spent +
      ' 点</span>' +
      '<button type="button" class="tool-btn" data-action="clear-abilities"' +
      (state.form.abilities.length ? '' : ' disabled') +
      '>清空选择</button>' +
      '</div>' +
      '</div>' +
      '<div class="ability-grid">' +
      ABILITIES.map(renderAbilityCard).join('') +
      '</div>' +
      '<div class="inline-note">' +
      icon('info') +
      '<span>可以少选，甚至不选。未使用的能力点不会保留到游戏中。能力效果会从本科第一周开始生效。</span>' +
      '</div>'
    );
  }

  /* ---------------------------------------------------------
     Step 05 — school
     --------------------------------------------------------- */

  function renderSchoolCard(school) {
    const selected = state.form.school === school.key;
    return (
      '<button type="button" class="school-option' +
      (selected ? ' is-selected' : '') +
      '" data-action="select-school" data-key="' +
      school.key +
      '" aria-pressed="' +
      selected +
      '">' +
      '<span class="school-no" aria-hidden="true">' +
      school.no +
      '</span>' +
      '<span class="school-main">' +
      '<span class="school-en">' +
      escapeHTML(school.en) +
      '</span>' +
      '<span class="school-title-row"><span class="school-name">' +
      escapeHTML(school.name) +
      '</span><span class="school-level">' +
      escapeHTML(school.level) +
      '</span></span>' +
      '<span class="school-desc">' +
      escapeHTML(school.desc) +
      '</span>' +
      '<span class="school-facts">' +
      '<span>院校竞争 <b>' +
      escapeHTML(school.competition) +
      '</b></span>' +
      '<span>特殊事件 <b>' +
      escapeHTML(school.special) +
      '</b></span>' +
      '<span>难度 <b>' +
      escapeHTML(school.difficultyLabel) +
      '</b></span>' +
      '<span>保研线 <b>GPA ' +
      school.gpaExcellent.toFixed(1) +
      '</b></span>' +
      '</span>' +
      '</span>' +
      '<span class="school-side">' +
      '<span class="difficulty-bars" aria-hidden="true">' +
      [1, 2, 3, 4]
        .map(function (level) {
          return '<i class="' + (level <= school.difficulty ? 'is-on' : '') + '"></i>';
        })
        .join('') +
      '</span>' +
      '<span class="school-select-circle" aria-hidden="true">' +
      icon('check') +
      '</span>' +
      '</span>' +
      '</button>'
    );
  }

  function renderSchoolStep() {
    return (
      '<div class="school-note">' +
      icon('info') +
      '<span>GPA 采用 4 分制、按课程学分加权。各校优秀线同时是保研线：二本 3.0 / 一本 3.2 / 985 3.5 / 清北 3.8。</span>' +
      '</div>' +
      '<div class="school-list">' +
      SCHOOLS.map(renderSchoolCard).join('') +
      '</div>' +
      '<div class="scholarship-rule">' +
      '<p class="scholarship-rule-title">SCHOLARSHIP / 奖学金门槛</p>' +
      '<div class="scholarship-rule-grid">' +
      '<span><b>国家奖学金</b>达到优秀线</span>' +
      '<span><b>省级奖学金</b>优秀线 − 0.2</span>' +
      '<span><b>校级奖学金</b>优秀线 − 0.3</span>' +
      '<span><b>励志奖学金</b>孤儿 / 贫困 + 达到省级档</span>' +
      '</div>' +
      '</div>'
    );
  }

  /* ---------------------------------------------------------
     Step 06 — review
     --------------------------------------------------------- */

  function renderReviewStep() {
    const talent = findTalent(state.form.talent);
    const family = findFamily(state.form.family);
    const school = findSchool(state.form.school);
    const abilities = selectedAbilities(state.form.abilities);
    const displayName = displayNameFrom(state.form.name);
    const abilityCap = talent ? talent.abilityPoints : 0;
    return (
      '<div class="review-lead">' +
      icon('seal') +
      '<span>请核对以下信息。确认提交后，姓名与开局选择将写入学籍档案，并生成你的录取通知书。</span>' +
      '</div>' +
      '<div class="review-grid">' +
      '<article class="review-card">' +
      '<div class="review-card-head"><h2>身份 <span>IDENTITY</span></h2>' +
      '<button type="button" class="review-edit" data-action="jump-step" data-step="0">修改</button></div>' +
      '<dl class="review-dl">' +
      '<div><dt>姓名</dt><dd>' +
      escapeHTML(displayName) +
      (state.form.name ? '' : ' <span class="minor">（未填写）</span>') +
      '</dd></div>' +
      '<div><dt>天资</dt><dd>' +
      escapeHTML(talent ? talent.name : '未选择') +
      '</dd></div>' +
      '<div><dt>成长点</dt><dd>' +
      (talent ? '每学年 +' + talent.growthPoints : '—') +
      '</dd></div>' +
      '</dl>' +
      '</article>' +
      '<article class="review-card">' +
      '<div class="review-card-head"><h2>家庭 <span>FAMILY</span></h2>' +
      '<button type="button" class="review-edit" data-action="jump-step" data-step="2">修改</button></div>' +
      '<dl class="review-dl">' +
      '<div><dt>家庭背景</dt><dd>' +
      escapeHTML(family ? family.name : '未选择') +
      '</dd></div>' +
      '<div><dt>起步资金</dt><dd>' +
      (family ? formatMoney(family.money) : '—') +
      '</dd></div>' +
      '<div><dt>' +
      escapeHTML(supportSourceLabel(family)) +
      '</dt><dd>' +
      escapeHTML(periodicSupportText(family)) +
      '</dd></div>' +
      '</dl>' +
      '</article>' +
      '<article class="review-card review-card--wide">' +
      '<div class="review-card-head"><h2>属性 <span>ATTRIBUTES</span></h2>' +
      '<button type="button" class="review-edit" data-action="jump-step" data-step="1">修改</button></div>' +
      '<div class="review-stat-grid">' +
      ATTRIBUTES.map(function (attribute) {
        return (
          '<div class="review-stat"><span>' +
          escapeHTML(attribute.name) +
          '</span><b>' +
          state.form.attributes[attribute.key] +
          '</b></div>'
        );
      }).join('') +
      '</div>' +
      '</article>' +
      '<article class="review-card review-card--wide">' +
      '<div class="review-card-head"><h2>初始能力 <span>INNATE TRAITS</span></h2>' +
      '<button type="button" class="review-edit" data-action="jump-step" data-step="3">修改</button></div>' +
      abilityTagsMarkup(abilities, true) +
      '<p class="review-hint">' +
      icon('info') +
      '<span>已使用 ' +
      abilityCost(state.form.abilities) +
      ' / ' +
      abilityCap +
      ' 能力点。' +
      (abilities.length ? '' : ' 当前未领取任何能力。') +
      '</span></p>' +
      '</article>' +
      '</div>' +
      '<div class="review-bottom">' +
      '<div class="review-finance">' +
      '<h3>FINANCIAL START / 入学财务</h3>' +
      '<div class="review-finance-main"><b>' +
      (family ? formatMoney(family.money) : '—') +
      '</b><span>起步资金</span></div>' +
      '<div class="review-finance-row"><span>' +
      escapeHTML(supportSourceLabel(family)) +
      '</span><b>' +
      escapeHTML(periodicSupportText(family)) +
      '</b></div>' +
      '<div class="review-finance-row"><span>餐费</span><b>' +
      escapeHTML(family ? family.mealText : '—') +
      '</b></div>' +
      '</div>' +
      '<div class="review-school-block">' +
      '<div><span class="eyebrow">MEDICAL SCHOOL / 目标院校</span>' +
      '<h3>' +
      escapeHTML(school ? school.name : '未选择') +
      '</h3></div>' +
      '<p>' +
      escapeHTML(school ? school.desc : '请返回并选择一所院校。') +
      '</p>' +
      '<div class="school-mini-meta">' +
      (school
        ? '<span>竞争 <b>' +
          escapeHTML(school.competition) +
          '</b></span><span>特殊事件 <b>' +
          escapeHTML(school.special) +
          '</b></span><span>难度 <b>' +
          escapeHTML(school.difficultyLabel) +
          '</b></span><span>保研线 <b>GPA ' +
          school.gpaExcellent.toFixed(1) +
          '</b></span>'
        : '') +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="review-hint">' +
      icon('info') +
      '<span>提交后会先展示录取通知书，再进入报到序章。序章完成后，你的学籍档案才算正式归档。</span>' +
      '</div>'
    );
  }

  function renderStepContent() {
    switch (state.step) {
      case 0:
        return renderIdentityStep();
      case 1:
        return renderAttributesStep();
      case 2:
        return renderFamilyStep();
      case 3:
        return renderAbilitiesStep();
      case 4:
        return renderSchoolStep();
      case 5:
        return renderReviewStep();
      default:
        return '';
    }
  }

  /* ---------------------------------------------------------
     Creator actions bar
     --------------------------------------------------------- */

  function stepHint() {
    const talent = findTalent(state.form.talent);
    const family = findFamily(state.form.family);
    const school = findSchool(state.form.school);
    if (state.step === 0) {
      return talent ? '接下来分配 ' + talent.attrPoints + ' 点属性' : '请选择一种天资';
    }
    if (state.step === 1) {
      const remaining = talent ? talent.attrPoints - attributesTotal(state.form.attributes) : 0;
      return remaining > 0 ? '还需分配 ' + remaining + ' 点' : '属性点已分配完毕';
    }
    if (state.step === 2) {
      return family ? '接下来领取初始能力' : '请选择家庭背景';
    }
    if (state.step === 3) {
      return state.form.abilities.length
        ? '已选 ' + state.form.abilities.length + ' 项初始能力'
        : '也可以不领取，直接继续';
    }
    if (state.step === 4) {
      return school ? '接下来核对新生档案' : '请选择一所院校';
    }
    return '提交后生成录取通知书';
  }

  function renderStepActions() {
    const backButton =
      state.step === 0
        ? '<button type="button" class="btn btn-ghost" data-action="exit-creator">' +
          icon('arrow-left') +
          '保存并离开</button>'
        : '<button type="button" class="btn btn-ghost" data-action="step-prev">' +
          icon('arrow-left') +
          '上一步</button>';

    const nextLabels = [
      '下一步 · 分配属性',
      '下一步 · 选择家庭',
      '下一步 · 领取能力',
      '下一步 · 选择院校',
      '下一步 · 核对档案'
    ];

    if (state.step === STEPS.length - 1) {
      return (
        '<div class="step-actions">' +
        '<button type="button" class="btn btn-ghost" data-action="step-prev">' +
        icon('arrow-left') +
        '上一步</button>' +
        '<div class="step-actions-right">' +
        '<span class="step-action-hint">确认无误后提交档案</span>' +
        '<button type="button" class="btn btn-primary" data-action="submit">提交档案 · 领取录取通知书' +
        icon('arrow-right', 'icon-arrow') +
        '</button>' +
        '</div>' +
        '</div>'
      );
    }

    return (
      '<div class="step-actions">' +
      backButton +
      '<div class="step-actions-right">' +
      '<span class="step-action-hint">' +
      escapeHTML(stepHint()) +
      '</span>' +
      '<button type="button" class="btn btn-primary" data-action="step-next">' +
      escapeHTML(nextLabels[state.step]) +
      icon('arrow-right', 'icon-arrow') +
      '</button>' +
      '</div>' +
      '</div>'
    );
  }

  /* ---------------------------------------------------------
     Live dossier
     --------------------------------------------------------- */

  function renderDossier() {
    const talent = findTalent(state.form.talent);
    const family = findFamily(state.form.family);
    const school = findSchool(state.form.school);
    const abilities = selectedAbilities(state.form.abilities);
    const name = sanitizeName(state.form.name);
    const displayName = name || '你';
    const completedSteps = STEPS.filter(function (_, index) {
      return isStepDone(index);
    }).length;
    return (
      '<aside class="dossier" aria-label="新生档案实时预览">' +
      '<div class="dossier-inner">' +
      '<div class="dossier-tab"><span>STUDENT FILE / 新生档案</span><b class="dossier-register-mark">待注册</b></div>' +
      '<div class="dossier-name-block">' +
      '<p class="dossier-label">NAME / 姓名</p>' +
      '<p class="dossier-name' +
      (name ? '' : ' is-placeholder') +
      '" data-live="dossier-name">' +
      escapeHTML(displayName) +
      '</p>' +
      '<p class="dossier-subline" data-live="dossier-subline">' +
      (name
        ? '名字已记录 · 将用于录取通知书与证书'
        : '未填写姓名 · 游戏内将以「你」称呼') +
      '</p>' +
      '</div>' +
      '<dl class="dossier-meta">' +
      '<div><dt>天资</dt><dd' +
      (talent ? '' : ' class="is-muted"') +
      '>' +
      escapeHTML(talent ? talent.name : '未选择') +
      '</dd></div>' +
      '<div><dt>目标院校</dt><dd' +
      (school ? '' : ' class="is-muted"') +
      '>' +
      escapeHTML(school ? school.name : '未选择') +
      '</dd></div>' +
      '<div><dt>家庭背景</dt><dd' +
      (family ? '' : ' class="is-muted"') +
      '>' +
      escapeHTML(family ? family.name : '未选择') +
      '</dd></div>' +
      '<div><dt>初始能力</dt><dd' +
      (abilities.length ? '' : ' class="is-muted"') +
      '>' +
      (abilities.length ? abilities.length + ' 项' : '尚未领取') +
      '</dd></div>' +
      '</dl>' +
      '<div class="dossier-stats-head"><h3>ATTRIBUTES / 属性</h3><span>' +
      attributesTotal(state.form.attributes) +
      ' / ' +
      (talent ? talent.attrPoints : '—') +
      ' PTS</span></div>' +
      '<div class="dossier-stat-grid">' +
      ATTRIBUTES.map(function (attribute) {
        const value = state.form.attributes[attribute.key];
        return (
          '<div class="dossier-stat-line"><div class="dossier-stat-label"><span>' +
          escapeHTML(attribute.name) +
          '</span><b>' +
          value +
          '</b></div><div class="dossier-stat-track"><i style="width:' +
          value * 10 +
          '%"></i></div></div>'
        );
      }).join('') +
      '</div>' +
      '<div class="dossier-ability-block">' +
      '<p class="dossier-label">INNATE TRAITS / 初始能力</p>' +
      '<div class="dossier-ability-list">' +
      (abilities.length
        ? abilities
            .map(function (ability) {
              return '<span>' + escapeHTML(ability.name) + '</span>';
            })
            .join('')
        : '<span class="is-empty">尚未领取</span>') +
      '</div>' +
      '</div>' +
      '<div class="dossier-finance">' +
      '<div><span>起步资金</span><b>' +
      (family ? formatMoney(family.money) : '—') +
      '</b></div>' +
      '<div><span>' +
      escapeHTML(supportSourceLabel(family)) +
      '</span><b>' +
      escapeHTML(periodicSupportCompact(family)) +
      '</b></div>' +
      '</div>' +
      '<div class="dossier-completion" aria-label="建档进度"><span class="' +
      (isStepDone(0) ? 'is-done' : '') +
      '"></span><span class="' +
      (isStepDone(1) ? 'is-done' : '') +
      '"></span><span class="' +
      (isStepDone(2) ? 'is-done' : '') +
      '"></span><span class="' +
      (isStepDone(3) ? 'is-done' : '') +
      '"></span><span class="' +
      (isStepDone(4) ? 'is-done' : '') +
      '"></span><span class="' +
      (isStepDone(5) ? 'is-done' : '') +
      '"></span><small>' +
      completedSteps +
      ' / 6 已填写</small></div>' +
      '<div class="dossier-footer">' +
      '<div class="dossier-barcode" aria-hidden="true"></div>' +
      '<small>MEDSIM / ' +
      escapeHTML(DATA.year) +
      '<br>PROLOGUE FILE</small>' +
      '</div>' +
      '</div>' +
      '</aside>'
    );
  }

  /* ---------------------------------------------------------
     Admission letter
     --------------------------------------------------------- */

  function renderAdmission() {
    let source;
    let studentNo;
    if (state.admissionMode === 'view' && state.save) {
      source = resolveStudentRecord(state.save.student);
      studentNo = state.save.student.studentNo;
    } else {
      source = resolveStudentRecord({
        name: state.form.name,
        talent: state.form.talent,
        attributes: state.form.attributes,
        family: state.form.family,
        abilities: state.form.abilities,
        school: state.form.school
      });
      studentNo = state.pendingStudentNo;
    }
    if (!source || !source.school) {
      return '';
    }
    const name = source.name;
    const salutation = name
      ? escapeHTML(name) + ' 同学：'
      : '你：';
    const actions =
      state.admissionMode === 'view'
        ? '<button type="button" class="btn btn-primary" data-action="close-admission">收好通知书' +
          icon('check') +
          '</button>'
        : '<button type="button" class="btn btn-ghost" data-action="close-admission">再检查一遍</button>' +
          '<button type="button" class="btn btn-primary" data-action="go-report">收下通知书 · 去报到' +
          icon('arrow-right', 'icon-arrow') +
          '</button>';

    return (
      '<div class="admission-overlay" role="dialog" aria-modal="true" aria-labelledby="admission-title">' +
      '<article class="admission-letter">' +
      '<button type="button" class="letter-close" data-action="close-admission" aria-label="关闭录取通知书">' +
      icon('close') +
      '</button>' +
      '<p class="letter-kicker">MEDICAL SCHOOL ADMISSION OFFICE / ' +
      escapeHTML(DATA.year) +
      '</p>' +
      '<div class="letter-head">' +
      '<div class="letter-title-block" id="admission-title"><h2>录取通知书</h2>' +
      '<p>LETTER OF ADMISSION · 本科</p></div>' +
      '<div class="letter-crest" aria-hidden="true"><span></span></div>' +
      '</div>' +
      '<div class="letter-meta">' +
      '<span>ADMISSION NO. / ' +
      escapeHTML(formatStudentNo(studentNo || '待编号')) +
      '</span>' +
      '<span>专业 / 临床医学 · 本科</span>' +
      '<span>签发 / ' +
      escapeHTML(chineseYear(DATA.year)) +
      '年</span>' +
      '</div>' +
      '<p class="letter-salutation">' +
      salutation +
      '</p>' +
      '<p class="letter-body">经学校招生委员会审核，你已被<strong>' +
      escapeHTML(source.school.name) +
      '</strong>临床医学专业录取，即将在这里开始本科阶段的学习。</p>' +
      '<p class="letter-body">请于九月携带本通知书来校报到。医学的路很长，长到足以让一个普通人变得可靠；它也很短，短到你来不及敷衍任何一个学期。</p>' +
      '<p class="letter-body letter-emphasis">从今天起，你做的每一次选择，都会成为病历之外的另一份记录。</p>' +
      '<div class="letter-signature">' +
      '<div class="letter-seal" aria-hidden="true">医学院<br>招生办</div>' +
      '<div class="letter-signature-text"><b>医学院招生办公室</b><br>' +
      escapeHTML(chineseYear(source.enrollYear)) +
      '年 九月</div>' +
      '</div>' +
      '<div class="letter-footer">' +
      '<small>MEDSIM ADMISSION OFFICE · PROLOGUE 00<br>本文件为游戏内虚构档案</small>' +
      '<span class="stamp" style="padding:6px 9px;font-size:0.56rem;letter-spacing:0.1em;">ADMITTED</span>' +
      '</div>' +
      '<div class="letter-actions">' +
      actions +
      '</div>' +
      '<div class="letter-perforation" aria-hidden="true"></div>' +
      '</article>' +
      '</div>'
    );
  }

  /* ---------------------------------------------------------
     Arrival prologue
     --------------------------------------------------------- */

  const FAMILY_ARRIVAL_TEXT = {
    orphan:
      '报到处的老师看了看你的材料，在系统里勾选了「绿色通道」。校园卡里已经预存了第一笔补助。你说了声谢谢，声音比自己预想的轻。',
    poor:
      '系办门口的公告栏上，助学金申请通知贴在最显眼的位置。你停下来读了两遍，没有立刻进去。母亲塞在书包内层的生活费，还带着家里的味道。',
    working:
      '父亲在家庭群里发来一句「到了说一声」。你回了一个“到了”，又删掉，重新打成「都挺好」。你知道他其实也只会说这一句。',
    affluent:
      '你没有让家里送。宿舍楼下停着几辆比你全部行李都贵的车，你拖着箱子从旁边走过去，没有回头。',
    medical:
      '父亲的老同学在这所学院任教。报到结束后，他拍了拍你的肩，说实验室随时欢迎你来。你点头，却在想自己是否真的准备好了。',
    tycoon:
      '你本可以不必排队。但你还是站在新生队伍里，像一个普通得不能再普通的人。至少在医学院，钱不能替你背下第一块骨头。'
  };

  function arrivalSource() {
    if (state.save) {
      return resolveStudentRecord(state.save.student);
    }
    return resolveStudentRecord({
      name: state.form.name,
      talent: state.form.talent,
      attributes: state.form.attributes,
      family: state.form.family,
      abilities: state.form.abilities,
      school: state.form.school,
      studentNo: state.pendingStudentNo
    });
  }

  function renderArrival() {
    const source = arrivalSource();
    if (!source || !source.school || !source.family) {
      return renderCover();
    }
    const name = source.displayName;
    const familyText = FAMILY_ARRIVAL_TEXT[source.family.key] || '';
    const headline = source.name
      ? escapeHTML(source.name) + '，欢迎来到医学院。'
      : '欢迎来到医学院。';
    const firstNameLine = source.name
      ? '你在笔记本的扉页写下自己的名字：<strong>' + escapeHTML(source.name) + '</strong>。笔尖停了停，你没有写什么宏大的愿望，只写下了明天的第一节课。'
      : '你在笔记本的扉页停了一会儿，最后没有写名字。笔尖落下，只写下了明天的第一节课。';
    return (
      '<div class="arrival-screen">' +
      '<header class="arrival-header">' +
      brandMarkup() +
      '<div class="arrival-header-meta"><span>PROLOGUE / 00</span><span class="meta-line"></span><span>REPORTING DAY</span></div>' +
      '</header>' +
      '<main class="arrival-layout" id="main-content">' +
      '<section class="arrival-hero">' +
      '<span class="arrival-chapter-no" aria-hidden="true">00</span>' +
      '<p class="arrival-kicker">SEPTEMBER · REPORTING DAY</p>' +
      '<h1 class="arrival-title" id="arrival-title" tabindex="-1"><span>白袍</span><span>之前</span></h1>' +
      '<div class="arrival-hero-rule" aria-hidden="true"></div>' +
      '<p class="arrival-quote">“白袍不是穿上的，是一周一周熬出来的。”</p>' +
      '<div class="arrival-meta">' +
      '<span>DATE / ' +
      escapeHTML(source.enrollYear) +
      '.09</span>' +
      '<span>PLACE / <b>' +
      escapeHTML(source.school.short) +
      '</b></span>' +
      '<span>WEATHER / <b>晴</b></span>' +
      '<span>STUDENT / <b>已报到</b></span>' +
      '</div>' +
      '</section>' +
      '<article class="story-paper">' +
      '<div class="story-inner">' +
      '<div class="story-topline"><span>入学注册 · 第 1 日</span><span>' +
      escapeHTML(source.school.name) +
      '</span></div>' +
      '<h2 class="story-headline">' +
      headline +
      '</h2>' +
      '<div class="story-body">' +
      '<p><span class="story-drop">九月</span>。空气里还留着夏天的余温。你拖着行李箱，在' +
      escapeHTML(source.school.name) +
      '门口停了几秒。' +
      escapeHTML(source.school.line) +
      '</p>' +
      '<p>' +
      escapeHTML(familyText) +
      '</p>' +
      '<p>报到处的队伍移动得很慢。轮到你时，老师熟练地核对了姓名、专业和一份盖了钢印的纸。那声音很轻，却像某种正式的宣告。</p>' +
      '<blockquote class="story-aside">医学生的第一课，往往不是解剖，而是等待。</blockquote>' +
      '<p>晚上，宿舍熄灯之后，你躺在陌生的床上，听见走廊里有人低声背解剖学名词。你忽然意识到，从明天开始，你要学的不是“如何考上”，而是“如何成为一个可靠的人”。</p>' +
      '<p>' +
      firstNameLine +
      '</p>' +
      '</div>' +
      '<div class="story-profile">' +
      '<div><span>姓名 / NAME</span><b>' +
      escapeHTML(name) +
      (source.name ? '' : '（未填写）') +
      '</b></div>' +
      '<div><span>天资 / APTITUDE</span><b>' +
      escapeHTML(source.talent ? source.talent.name : '—') +
      '</b></div>' +
      '<div><span>家庭 / FAMILY</span><b>' +
      escapeHTML(source.family.name) +
      '</b></div>' +
      '<div><span>院校 / SCHOOL</span><b>' +
      escapeHTML(source.school.short) +
      '</b></div>' +
      '<div class="story-finance"><span>入学资金</span><b>' +
      formatMoney(source.family.money) +
      '</b></div>' +
      '</div>' +
      '<div class="story-actions">' +
      '<small>这一天将被写入你的学籍档案。<br>接下来，是一周又一周的本科生活。</small>' +
      '<button type="button" class="btn btn-primary" data-action="complete-prologue">把这一天收进档案' +
      icon('arrow-right', 'icon-arrow') +
      '</button>' +
      '</div>' +
      '</div>' +
      '<div class="story-stamp" aria-hidden="true">已报到</div>' +
      '</article>' +
      '</main>' +
      '</div>'
    );
  }

  /* ---------------------------------------------------------
     Completed archive
     --------------------------------------------------------- */

  function completedSource() {
    if (state.save) {
      return resolveStudentRecord(state.save.student);
    }
    return resolveStudentRecord({
      name: state.form.name,
      talent: state.form.talent,
      attributes: state.form.attributes,
      family: state.form.family,
      abilities: state.form.abilities,
      school: state.form.school,
      studentNo: state.pendingStudentNo
    });
  }

  function renderComplete() {
    const source = completedSource();
    if (!source || !source.school || !source.family || !source.talent) {
      return renderCover();
    }
    const studentNo = source.studentNo || (state.save && state.save.student.studentNo) || '';
    const createdAt = state.save ? state.save.createdAt : null;
    const completedAt = state.save && state.save.completedAt ? state.save.completedAt : new Date().toISOString();
    return (
      '<div class="complete-screen">' +
      '<header class="complete-header">' +
      brandMarkup() +
      '<div class="complete-header-meta"><i aria-hidden="true"></i><span>PROLOGUE 00 / 已完成</span></div>' +
      '</header>' +
      '<main class="complete-main" id="main-content">' +
      '<section class="result-hero">' +
      '<div class="result-hero-copy">' +
      '<p class="result-kicker">PROLOGUE COMPLETE · 白袍之前</p>' +
      '<h1 id="result-title" tabindex="-1">档案已归档<em>。</em></h1>' +
      '<p class="result-sub">' +
      (source.name
        ? escapeHTML(source.name) + '，从今天起，你的每一次出勤、每一场考试、每一个熬夜的晚上，都会被记进这本档案。'
        : '从今天起，你的每一次出勤、每一场考试、每一个熬夜的晚上，都会被记进这本档案。') +
      '</p>' +
      '</div>' +
      '<div class="result-stamp" aria-label="已注册"><b>已注册</b><span>REGISTERED</span></div>' +
      '</section>' +
      '<section class="archive-sheet" aria-label="学籍档案">' +
      '<div class="archive-sheet-inner">' +
      '<div class="sheet-top">' +
      '<div><p class="eyebrow">MEDICAL SCHOOL / STUDENT RECORD</p>' +
      '<p class="sheet-school">' +
      escapeHTML(source.school.name) +
      ' · 临床医学</p></div>' +
      '<div class="sheet-no">学号 / STUDENT NO.<b>' +
      escapeHTML(formatStudentNo(studentNo)) +
      '</b>建档 / ' +
      escapeHTML(formatDate(createdAt)) +
      '</div>' +
      '</div>' +
      '<div class="sheet-identity">' +
      '<div><p class="sheet-name-label">NAME / 姓名</p>' +
      '<p class="sheet-name">' +
      escapeHTML(source.displayName) +
      (source.name ? '' : '<small>未填写姓名 · 游戏内以「你」相称</small>') +
      '</p></div>' +
      '<div class="sheet-identity-meta">' +
      '<div><span>专业 / MAJOR</span><b>临床医学</b></div>' +
      '<div><span>层次 / LEVEL</span><b>本科</b></div>' +
      '<div><span>天资 / APTITUDE</span><b>' +
      escapeHTML(source.talent.name) +
      '</b></div>' +
      '<div><span>入学 / ENROLLED</span><b>' +
      escapeHTML(source.enrollYear) +
      ' 年</b></div>' +
      '</div>' +
      '</div>' +
      '<div class="sheet-columns">' +
      '<div>' +
      '<section class="sheet-section">' +
      '<h3 class="sheet-section-title">ATTRIBUTES / 开局属性</h3>' +
      '<div class="sheet-attribute-grid">' +
      ATTRIBUTES.map(function (attribute) {
        return (
          '<div class="sheet-attr"><div class="sheet-attr-label"><span>' +
          escapeHTML(attribute.name) +
          '</span><b>' +
          source.attributes[attribute.key] +
          '</b></div><div class="sheet-attr-track"><i style="width:' +
          source.attributes[attribute.key] * 10 +
          '%"></i></div></div>'
        );
      }).join('') +
      '</div>' +
      '</section>' +
      '<section class="sheet-section">' +
      '<h3 class="sheet-section-title">FAMILY / 家庭背景</h3>' +
      '<p class="sheet-note">' +
      escapeHTML(source.family.note) +
      '</p>' +
      '<div class="sheet-ability-tags">' +
      source.family.tags
        .map(function (tag) {
          return '<span>' + escapeHTML(tag) + '</span>';
        })
        .join('') +
      '</div>' +
      '</section>' +
      '</div>' +
      '<div>' +
      '<section class="sheet-section">' +
      '<h3 class="sheet-section-title">INNATE TRAITS / 初始能力</h3>' +
      (source.abilities.length
        ? '<div class="sheet-ability-tags">' +
          source.abilities
            .map(function (ability) {
              return '<span>' + escapeHTML(ability.name) + '<b>' + ability.cost + ' PTS</b></span>';
            })
            .join('') +
          '</div>'
        : '<p class="sheet-note">未领取初始能力。未使用的能力点没有带入游戏。</p>') +
      '</section>' +
      '<section class="sheet-section">' +
      '<h3 class="sheet-section-title">FINANCE / 入学财务</h3>' +
      '<div class="sheet-finance-grid">' +
      '<div class="sheet-finance-cell"><span>起步资金</span><b>' +
      formatMoney(source.family.money) +
      '</b></div>' +
      '<div class="sheet-finance-cell"><span>' +
      escapeHTML(supportSourceLabel(source.family)) +
      '</span><b>' +
      escapeHTML(periodicSupportCompact(source.family)) +
      '</b></div>' +
      '<div class="sheet-finance-cell"><span>餐费</span><b>' +
      escapeHTML(source.family.mealText) +
      '</b></div>' +
      '<div class="sheet-finance-cell"><span>成长点</span><b>+' +
      source.talent.growthPoints +
      ' / 学年</b></div>' +
      '</div>' +
      '</section>' +
      '</div>' +
      '</div>' +
      '<div class="sheet-foot">' +
      '<div class="barcode" aria-hidden="true"></div>' +
      '<small>档案生成于 ' +
      escapeHTML(formatDate(completedAt)) +
      '<br>MEDSIM · PROLOGUE 00 · ' +
      escapeHTML(DATA.year) +
      '</small>' +
      '</div>' +
      '</div>' +
      '</section>' +
      '<div class="result-actions">' +
      '<button type="button" class="btn btn-outline" data-action="view-letter">重看录取通知书' +
      icon('book') +
      '</button>' +
      '<button type="button" class="btn btn-ghost" data-action="return-cover">返回封面</button>' +
      '<span class="result-spacer"></span>' +
      '<button type="button" class="text-btn" data-action="start-new">重新建档' +
      icon('refresh') +
      '</button>' +
      '</div>' +
      '<section class="next-chapter" aria-label="下一阶段">' +
      '<div><p class="next-label">NEXT / CHAPTER 01</p>' +
      '<h2>本科第一周：课程、出勤与第一场随机事件</h2>' +
      '<p>序章到此结束。本科回合循环将在下一阶段接入，你的学籍档案与开局数值已经保存。</p></div>' +
      '<span class="next-state">本科阶段 · 待开放</span>' +
      '</section>' +
      '</main>' +
      '</div>'
    );
  }

  /* ---------------------------------------------------------
     Render lifecycle
     --------------------------------------------------------- */

  function render(options) {
    const opts = options || {};
    const currentScroll = window.scrollY;
    if (state.screen === 'arrival' || state.screen === 'complete') {
      if (!state.save) {
        state.screen = state.hasDraft ? 'creator' : 'cover';
      }
    }

    let markup;
    if (state.screen === 'creator') {
      markup = renderCreator();
    } else if (state.screen === 'arrival') {
      markup = renderArrival();
    } else if (state.screen === 'complete') {
      markup = renderComplete();
    } else {
      markup = renderCover();
    }

    const overlay = state.admissionOpen ? renderAdmission() : '';
    const inert = state.admissionOpen ? ' inert aria-hidden="true"' : '';
    app.innerHTML = '<div class="app-screen"' + inert + '>' + markup + '</div>' + overlay;
    document.body.classList.toggle('is-locked', state.admissionOpen);

    if (state.screen === 'cover') {
      document.title = DATA.title + ' · 序章：白袍之前';
    } else if (state.screen === 'creator') {
      document.title = '建档 · ' + STEPS[state.step].title + ' | ' + DATA.title;
    } else if (state.screen === 'arrival') {
      document.title = '报到日 · 序章 | ' + DATA.title;
    } else {
      document.title = '学籍档案 · 序章完成 | ' + DATA.title;
    }

    let focusTarget = null;
    if (opts.focus) {
      focusTarget = app.querySelector(opts.focus);
    }
    if (!focusTarget && opts.altFocus) {
      focusTarget = app.querySelector(opts.altFocus);
    }
    if (focusTarget && typeof focusTarget.focus === 'function') {
      focusTarget.focus({ preventScroll: true });
    }

    if (opts.scroll === 'top') {
      window.scrollTo(0, 0);
    } else if (typeof opts.scroll === 'number') {
      window.scrollTo(0, opts.scroll);
    } else if (opts.scrollTarget) {
      const target = app.querySelector(opts.scrollTarget);
      if (target) {
        const y = target.getBoundingClientRect().top + window.scrollY - 18;
        window.scrollTo(0, Math.max(0, y));
      }
    } else if (opts.preserveScroll !== false) {
      window.scrollTo(0, currentScroll);
    }

    if (state.admissionOpen && !opts.focus) {
      const first = app.querySelector('.admission-letter .letter-close');
      if (first) {
        first.focus({ preventScroll: true });
      }
    }
  }

  function openSave() {
    if (!state.save) {
      return;
    }
    state.admissionOpen = false;
    document.body.classList.remove('is-locked');
    state.screen = state.save.status === 'arrival' ? 'arrival' : 'complete';
    render({
      focus: state.screen === 'arrival' ? '#arrival-title' : '#result-title',
      scroll: 'top'
    });
  }

  function startNewCreation() {
    removeStored(SAVE_KEY);
    removeStored(DRAFT_KEY);
    state.save = null;
    state.hasDraft = false;
    state.form = emptyForm();
    state.step = 0;
    state.maxStep = 0;
    state.error = '';
    state.admissionOpen = false;
    state.admissionMode = 'submit';
    state.pendingStudentNo = '';
    state.screen = 'creator';
    document.body.classList.remove('is-locked');
    persistDraftNow();
    render({ focus: '#step-title', scroll: 'top' });
  }

  function requestNewCreation() {
    if (state.save || state.hasDraft) {
      openConfirm({
        title: '建立新的学籍档案？',
        body: '当前已归档的学籍档案或未完成草稿会被清空，且无法恢复。',
        confirmLabel: '清空并重新开始',
        onConfirm: startNewCreation
      });
      return;
    }
    startNewCreation();
  }

  function resumeDraft() {
    if (!state.hasDraft) {
      startNewCreation();
      return;
    }
    state.screen = 'creator';
    state.error = '';
    state.admissionOpen = false;
    document.body.classList.remove('is-locked');
    render({ focus: '#step-title', scroll: 'top' });
  }

  function exitCreator() {
    persistDraftNow();
    state.screen = 'cover';
    state.error = '';
    state.admissionOpen = false;
    document.body.classList.remove('is-locked');
    render({ focus: '.cover-title', scroll: 'top' });
  }

  function goToStep(nextStep) {
    state.step = clamp(nextStep, 0, STEPS.length - 1);
    state.maxStep = Math.max(state.maxStep, state.step);
    state.error = '';
    persistDraftNow();
    render({ focus: '#step-title', scroll: 'top' });
  }

  function handleNextStep() {
    const error = validateStep(state.step);
    if (error) {
      state.error = error;
      persistDraftNow();
      render({ focus: '#form-error', scrollTarget: '#form-error' });
      return;
    }
    goToStep(state.step + 1);
  }

  function handlePrevStep() {
    if (state.step > 0) {
      goToStep(state.step - 1);
    }
  }

  function adjustStat(key, direction) {
    const talent = findTalent(state.form.talent);
    if (!talent) {
      return;
    }
    const value = state.form.attributes[key];
    if (direction > 0) {
      if (value >= RULES.attributeMax) {
        return;
      }
      if (attributesTotal(state.form.attributes) >= talent.attrPoints) {
        showToast('没有剩余属性点了。');
        return;
      }
      state.form.attributes[key] = value + 1;
    } else {
      if (value <= RULES.attributeMin) {
        return;
      }
      state.form.attributes[key] = value - 1;
    }
    state.error = '';
    persistDraftNow();
    render({
      focus: '[data-action="stat-' + (direction > 0 ? 'plus' : 'minus') + '"][data-key="' + key + '"]',
      altFocus: '[data-action="stat-minus"][data-key="' + key + '"]',
      preserveScroll: true
    });
  }

  function openAdmission(mode) {
    state.admissionMode = mode;
    state.admissionReturnFocus =
      mode === 'view' ? '[data-action="view-letter"]' : '[data-action="submit"]';
    state.admissionScrollY = window.scrollY;
    if (mode === 'submit' && !state.pendingStudentNo) {
      state.pendingStudentNo = makeStudentNo(state.form.school, DATA.year);
    }
    state.admissionOpen = true;
    render({ focus: '[data-action="close-admission"]', preserveScroll: true });
  }

  function closeAdmission() {
    state.admissionOpen = false;
    state.admissionMode = 'submit';
    document.body.classList.remove('is-locked');
    render({
      focus: state.admissionReturnFocus || '#step-title',
      scroll: state.admissionScrollY
    });
  }

  function handleSubmit() {
    const invalid = validateAll();
    if (invalid) {
      state.step = invalid.step;
      state.maxStep = Math.max(state.maxStep, invalid.step);
      state.error = invalid.message;
      persistDraftNow();
      render({ focus: '#form-error', scrollTarget: '#form-error' });
      return;
    }
    const proceed = function () {
      openAdmission('submit');
    };
    if (state.save) {
      openConfirm({
        title: '替换现有学籍档案？',
        body: '完成这次注册后，当前浏览器中的旧档案会被新档案覆盖。',
        confirmLabel: '继续提交',
        tone: 'primary',
        onConfirm: proceed
      });
      return;
    }
    proceed();
  }

  function handleGoReport() {
    const save = saveGame('arrival');
    if (!save) {
      showToast('新生档案尚未完成，无法报到。');
      return;
    }
    state.pendingStudentNo = '';
    state.admissionOpen = false;
    state.admissionMode = 'submit';
    state.screen = 'arrival';
    document.body.classList.remove('is-locked');
    render({ focus: '#arrival-title', scroll: 'top' });
  }

  function handleCompletePrologue() {
    if (!state.save) {
      showToast('学籍档案未能写入，请刷新后重试。');
      return;
    }
    updateSavedStatus('complete');
    state.screen = 'complete';
    render({ focus: '#result-title', scroll: 'top' });
  }

  function handleSelectTalent(key) {
    const talent = findTalent(key);
    if (!talent) {
      return;
    }
    state.form.talent = key;
    let attributesReset = false;
    if (attributesTotal(state.form.attributes) > talent.attrPoints) {
      ATTRIBUTES.forEach(function (attribute) {
        state.form.attributes[attribute.key] = RULES.attributeMin;
      });
      attributesReset = true;
    }
    let abilitiesTrimmed = false;
    while (abilityCost(state.form.abilities) > talent.abilityPoints && state.form.abilities.length) {
      state.form.abilities.pop();
      abilitiesTrimmed = true;
    }
    state.error = '';
    persistDraftNow();
    render({
      focus: '[data-action="select-talent"][data-key="' + key + '"]',
      preserveScroll: true
    });
    if (attributesReset) {
      showToast('天资变更后属性点超出上限，已重置为每项 3 点。');
    } else if (abilitiesTrimmed) {
      showToast('能力点上限降低，已取消部分初始能力。');
    }
  }

  function handleSelectFamily(key) {
    if (!findFamily(key)) {
      return;
    }
    state.form.family = key;
    state.error = '';
    persistDraftNow();
    render({
      focus: '[data-action="select-family"][data-key="' + key + '"]',
      preserveScroll: true
    });
  }

  function handleSelectAbility(key) {
    const ability = findAbility(key);
    const talent = findTalent(state.form.talent);
    if (!ability || !talent) {
      return;
    }
    const index = state.form.abilities.indexOf(key);
    if (index !== -1) {
      state.form.abilities.splice(index, 1);
    } else {
      const remaining = talent.abilityPoints - abilityCost(state.form.abilities);
      if (ability.cost > remaining) {
        showToast('能力点不足，还需要 ' + (ability.cost - remaining) + ' 点。');
        return;
      }
      state.form.abilities.push(key);
    }
    state.error = '';
    persistDraftNow();
    render({
      focus: '[data-action="select-ability"][data-key="' + key + '"]',
      preserveScroll: true
    });
  }

  function handleSelectSchool(key) {
    if (!findSchool(key)) {
      return;
    }
    state.form.school = key;
    state.error = '';
    persistDraftNow();
    render({
      focus: '[data-action="select-school"][data-key="' + key + '"]',
      preserveScroll: true
    });
  }

  function handleClearAbilities() {
    state.form.abilities = [];
    state.error = '';
    persistDraftNow();
    render({ focus: '[data-action="clear-abilities"]', preserveScroll: true });
  }

  function applyAllocation(kind) {
    if (!findTalent(state.form.talent)) {
      return;
    }
    if (kind === 'even') {
      distributeEvenly();
    } else if (kind === 'random') {
      randomizeAttributes();
    } else {
      ATTRIBUTES.forEach(function (attribute) {
        state.form.attributes[attribute.key] = RULES.attributeMin;
      });
    }
    state.error = '';
    persistDraftNow();
    const focus =
      kind === 'even'
        ? '[data-action="distribute-even"]'
        : kind === 'random'
          ? '[data-action="randomize-attributes"]'
          : '[data-action="reset-attributes"]';
    render({ focus: focus, preserveScroll: true });
  }

  function updateNameUI() {
    const raw = state.form.name;
    const name = sanitizeName(raw);
    const displayName = name || '你';
    const dossierName = app.querySelector('[data-live="dossier-name"]');
    if (dossierName) {
      dossierName.textContent = displayName;
      dossierName.classList.toggle('is-placeholder', !name);
    }
    const subline = app.querySelector('[data-live="dossier-subline"]');
    if (subline) {
      subline.textContent = name
        ? '名字已记录 · 将用于录取通知书与证书'
        : '未填写姓名 · 游戏内将以「你」称呼';
    }
    const mobileName = app.querySelector('[data-live="mobile-name"]');
    if (mobileName) {
      mobileName.textContent = displayName;
    }
    const count = app.querySelector('[data-live="name-count"]');
    if (count) {
      count.textContent = String(state.form.name.length);
    }
  }

  /* ---------------------------------------------------------
     Events
     --------------------------------------------------------- */

  app.addEventListener('click', function (event) {
    if (
      state.admissionOpen &&
      event.target.classList &&
      event.target.classList.contains('admission-overlay')
    ) {
      closeAdmission();
      return;
    }

    const actionElement = event.target.closest('[data-action]');
    if (!actionElement) {
      return;
    }
    const action = actionElement.getAttribute('data-action');
    const key = actionElement.getAttribute('data-key');

    switch (action) {
      case 'start-new':
        requestNewCreation();
        break;
      case 'resume-draft':
        resumeDraft();
        break;
      case 'resume-save':
        openSave();
        break;
      case 'exit-creator':
        exitCreator();
        break;
      case 'jump-step': {
        const target = Number.parseInt(actionElement.getAttribute('data-step'), 10);
        if (Number.isFinite(target) && target <= state.maxStep && target !== state.step) {
          goToStep(target);
        }
        break;
      }
      case 'step-next':
        handleNextStep();
        break;
      case 'step-prev':
        handlePrevStep();
        break;
      case 'select-talent':
        handleSelectTalent(key);
        break;
      case 'stat-plus':
        adjustStat(key, 1);
        break;
      case 'stat-minus':
        adjustStat(key, -1);
        break;
      case 'distribute-even':
        applyAllocation('even');
        break;
      case 'randomize-attributes':
        applyAllocation('random');
        break;
      case 'reset-attributes':
        applyAllocation('reset');
        break;
      case 'select-family':
        handleSelectFamily(key);
        break;
      case 'select-ability':
        handleSelectAbility(key);
        break;
      case 'clear-abilities':
        handleClearAbilities();
        break;
      case 'select-school':
        handleSelectSchool(key);
        break;
      case 'submit':
        handleSubmit();
        break;
      case 'go-report':
        handleGoReport();
        break;
      case 'close-admission':
        closeAdmission();
        break;
      case 'complete-prologue':
        handleCompletePrologue();
        break;
      case 'return-cover':
        state.screen = 'cover';
        state.error = '';
        render({
          focus: '.cover-title',
          scroll: 'top'
        });
        break;
      case 'view-letter':
        openAdmission('view');
        break;
      default:
        break;
    }
  });

  app.addEventListener('input', function (event) {
    if (event.target && event.target.id === 'name-input') {
      const raw = event.target.value.replace(/[\u0000-\u001f\u007f]/g, '');
      const limited = raw.slice(0, NAME_LIMIT);
      if (limited !== event.target.value) {
        event.target.value = limited;
      }
      state.form.name = limited;
      updateNameUI();
      debouncePersistDraft();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (!state.admissionOpen || confirmDialog.open) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      closeAdmission();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const focusable = Array.from(
      app.querySelectorAll(
        '.admission-letter button:not([disabled]), .admission-letter [href], .admission-letter input:not([disabled]), .admission-letter [tabindex]:not([tabindex="-1"])'
      )
    ).filter(function (element) {
      return element.offsetParent !== null;
    });
    if (!focusable.length) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  window.addEventListener('beforeunload', function () {
    if (state.screen === 'creator') {
      persistDraftNow();
    }
  });

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && state.screen === 'creator') {
      persistDraftNow();
    }
  });

  /* ---------------------------------------------------------
     Init
     --------------------------------------------------------- */

  function init() {
    const storedSave = parseSave(readStoredJSON(SAVE_KEY));
    const storedDraft = parseDraft(readStoredJSON(DRAFT_KEY));
    state.save = storedSave;
    if (storedDraft) {
      state.form = storedDraft.form;
      state.step = storedDraft.step;
      state.maxStep = storedDraft.maxStep;
      state.hasDraft = true;
    }
    render({ focus: '.cover-title', scroll: 'top' });
  }

  init();
})();
