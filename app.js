const D = window.REVIEW_DATA;
const app = document.querySelector('#app');
const modal = document.querySelector('#modal');

const store = {
  get(k, d) {
    try { return JSON.parse(localStorage.getItem(k)) ?? d; }
    catch { return d; }
  },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
};

let state = {
  route: 'home',
  quiz: null,
  plantEditMode: false,
  listFilters: { bird: '', insect: '', plant: '' },
  listIds: {
    bird: D.birds.map(x => x.id),
    insect: D.insects.map(x => x.id),
    plant: D.plants.map(x => x.id)
  },
  detail: null,
  restoring: false
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[m]));
const norm = s => String(s || '').replace(/[\s·，,。；;（）()]/g, '').toLowerCase();
const shuffle = a => [...a].sort(() => Math.random() - .5);
const imagesOfRaw = x => (Array.isArray(x?.images) && x.images.length ? x.images : [x?.image]).filter(Boolean);
const imagesOf = x => (Array.isArray(x?.images) && x.images.length ? x.images : [x?.image]).filter(Boolean);
const BASE_PLANTS = D.plants.map(x => ({
  ...x,
  images: imagesOfRaw(x),
  features: [...(x.features || [])],
  extra: x.extra ? [...x.extra] : x.extra
}));
const pickImage = x => {
  const imgs = imagesOf(x);
  return imgs[Math.floor(Math.random() * imgs.length)] || x.image;
};

function plantEdits() {
  const e = store.get('plantEdits', { hiddenImages: {}, updates: {}, customPlants: [] });
  e.hiddenImages ||= {};
  e.updates ||= {};
  e.customPlants ||= [];
  return e;
}
function cleanPlant(x) {
  const images = imagesOfRaw(x);
  return {
    id: String(x.id || `custom-${Date.now()}`),
    name: String(x.name || '未命名植物'),
    latin: String(x.latin || x.labelLatin || ''),
    labelLatin: String(x.labelLatin || x.latin || ''),
    family: String(x.family || ''),
    order: String(x.order || ''),
    image: images[0] || '',
    images,
    features: (x.features || []).filter(Boolean).slice(0, 4),
    description: String(x.description || ''),
    status: String(x.status || '本地新增')
  };
}
function syncPlantData() {
  const edits = plantEdits();
  const base = BASE_PLANTS.map(x => {
    const patch = edits.updates[x.id] || {};
    const merged = cleanPlant({ ...x, ...patch, images: patch.images || x.images });
    const hidden = new Set(edits.hiddenImages[x.id] || []);
    const imgs = imagesOfRaw(merged).filter(src => !hidden.has(src));
    return { ...merged, images: imgs, image: imgs[0] || merged.image };
  });
  const custom = edits.customPlants.map(cleanPlant);
  D.plants = [...base, ...custom];
  state.listIds.plant = state.listIds.plant.filter(id => D.plants.some(x => x.id === id));
  if (!state.listIds.plant.length) state.listIds.plant = D.plants.map(x => x.id);
}
function savePlantEdits(edits) {
  store.set('plantEdits', edits);
  syncPlantData();
}
syncPlantData();

function progress() {
  const p = store.get('progress', { birds: [], insects: [], sounds: [], plants: [] });
  p.birds ||= [];
  p.insects ||= [];
  p.plants ||= [];
  p.sounds ||= [];
  return p;
}
function mistakes() { return store.get('mistakes', []); }
function mark(bucket, id, correct) {
  const p = progress();
  let arr = p[bucket] || [];
  if (correct && !arr.includes(id)) arr.push(id);
  if (!correct) arr = arr.filter(x => x !== id);
  p[bucket] = arr;
  store.set('progress', p);
}
function addMistake(kind, id) {
  const m = mistakes();
  const key = kind + id;
  if (!m.some(x => x.kind + x.id === key)) m.push({ kind, id, time: Date.now() });
  store.set('mistakes', m);
}
function removeMistake(kind, id) {
  store.set('mistakes', mistakes().filter(x => !(x.kind === kind && x.id === id)));
}
function stopAudio() {
  document.querySelectorAll('audio').forEach(a => { a.pause(); a.currentTime = 0; });
}
function listFor(kind) {
  const all = kind === 'bird' ? D.birds : kind === 'plant' ? D.plants : D.insects;
  const ids = state.listIds?.[kind] || all.map(x => x.id);
  const byId = new Map(all.map(x => [x.id, x]));
  const list = ids.map(id => byId.get(id)).filter(Boolean);
  return list.length ? list : all;
}
function getItem(kind, id) {
  return (kind === 'bird' ? D.birds : kind === 'plant' ? D.plants : D.insects).find(v => v.id === id);
}
function detailHash(kind, id) {
  return `#${kind === 'bird' ? 'birds' : kind === 'plant' ? 'plants' : 'insects'}/${encodeURIComponent(id)}`;
}
function routeHash(r) {
  return r === 'home' ? '#home' : `#${r}`;
}
function pushLocation() {
  if (state.restoring) return;
  const hash = state.detail ? detailHash(state.detail.kind, state.detail.id) : routeHash(state.route);
  history.pushState({
    route: state.route,
    detail: state.detail,
    listFilters: state.listFilters,
    listIds: state.listIds
  }, '', hash);
}
function replaceLocation() {
  const hash = state.detail ? detailHash(state.detail.kind, state.detail.id) : routeHash(state.route);
  history.replaceState({
    route: state.route,
    detail: state.detail,
    listFilters: state.listFilters,
    listIds: state.listIds
  }, '', hash);
}
function restoreFromLocation() {
  const hash = decodeURIComponent(location.hash.replace(/^#/, ''));
  if (!hash) return;
  const [path] = hash.split('?');
  const [routeName, id] = path.split('/');
  const kind = routeName === 'birds' ? 'bird' : routeName === 'plants' ? 'plant' : routeName === 'insects' ? 'insect' : null;
  state.restoring = true;
  if (kind && id && getItem(kind, id)) {
    state.route = routeName;
    state.detail = { kind, id };
  } else if (['home', 'birds', 'insects', 'plants', 'sounds', 'quiz', 'mistakes'].includes(routeName)) {
    state.route = routeName;
    state.detail = null;
    state.quiz = null;
  }
  render();
  state.restoring = false;
}
function route(r, push = true) {
  stopAudio();
  state.route = r;
  state.quiz = null;
  state.detail = null;
  render();
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.route === r));
  if (push) pushLocation();
  scrollTo({ top: 0, behavior: 'smooth' });
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-route]');
  if (b) route(b.dataset.route);
});
window.addEventListener('popstate', e => {
  state.restoring = true;
  if (e.state) {
    state.route = e.state.route || 'home';
    state.detail = e.state.detail || null;
    state.listFilters = e.state.listFilters || state.listFilters;
    state.listIds = e.state.listIds || state.listIds;
    state.quiz = null;
    render();
  } else {
    restoreFromLocation();
  }
  state.restoring = false;
});

function home() {
  const p = progress();
  return `
    <section class="hero">
      <h1>看标本、听鸟声，练到会写为止</h1>
      <p>根据课程资料制作的鸟类、昆虫与植物识别训练。鸟类和植物集中展示全部标本图片，练习时随机抽图；昆虫练习所属目和主要特征；鸟声练习按考核要求填写种名、科名和目名。</p>
      <div class="actions">
        <button class="btn secondary" onclick="startQuiz('bird',10)">开始鸟类练习</button>
        <button class="btn secondary" onclick="startQuiz('plant',10)">开始植物练习</button>
        <button class="btn secondary" onclick="startQuiz('insect',10)">开始昆虫练习</button>
        <button class="btn secondary" onclick="startQuiz('sound',5)">开始鸟声练习</button>
        <button class="btn ghost" onclick="startQuiz('mock',20)">20题鸟类模拟</button>
      </div>
    </section>
    <div class="stats five">
      <div class="stat"><span>鸟类已掌握</span><strong>${p.birds.length} / ${D.birds.length}</strong></div>
      <div class="stat"><span>昆虫目已掌握</span><strong>${p.insects.length} / ${D.insects.length}</strong></div>
      <div class="stat"><span>植物已掌握</span><strong>${p.plants.length} / ${D.plants.length}</strong></div>
      <div class="stat"><span>鸟声已掌握</span><strong>${p.sounds.length} / ${D.sounds.length}</strong></div>
      <div class="stat"><span>错题</span><strong>${mistakes().length}</strong></div>
    </div>
    <section>
      <div class="section-head"><div><h2>建议复习顺序</h2><p>先熟悉知识卡和全部图片，再做看图、听声填空，最后进行模拟。</p></div></div>
      <div class="mode-grid">
        <div class="mode"><h3>① 鸟类知识卡</h3><p>查看每种鸟在PPT中的全部图片，并把两处识别特征对应到不同角度和状态。</p><button class="btn" data-route="birds">查看57种鸟</button></div>
        <div class="mode"><h3>② 昆虫目知识卡</h3><p>固定按翅、口器、足、触角、腹末的顺序观察。</p><button class="btn" data-route="insects">查看14个目</button></div>
        <div class="mode"><h3>③ 植物标本知识卡</h3><p>查看70个植物标本分组和139张标本图，重点记种名、科名与两处可见特征。</p><button class="btn" data-route="plants">查看植物标本</button></div>
        <div class="mode"><h3>④ 鸟声资料</h3><p>反复听课程提供的10段鸟声，并把声音和分类信息绑定。</p><button class="btn" data-route="sounds">听全部鸟声</button></div>
        <div class="mode"><h3>⑤ 模拟与错题</h3><p>随机抽题，答错后自动加入错题本，之后集中重练。</p><button class="btn" data-route="quiz">选择练习</button></div>
      </div>
    </section>`;
}

function cards(kind) {
  if (kind === 'plant') syncPlantData();
  const fullList = kind === 'bird' ? D.birds : kind === 'plant' ? D.plants : D.insects;
  const q = state.listFilters[kind] || '';
  const list = q ? fullList.filter(x => norm(JSON.stringify(x)).includes(norm(q))) : fullList;
  state.listIds[kind] = list.map(x => x.id);
  const title = kind === 'bird' ? '鸟类复习' : kind === 'plant' ? '植物标本复习' : '昆虫复习';
  const sub = kind === 'bird' ? '57种鸟：每种集中展示对应PPT页面的全部图片，练习时随机抽图' : kind === 'plant' ? '70个植物标本分组：看标本图，掌握种名、科名和两处可见特征' : '14个目：优先掌握标本上能直接看到的结构';
  return `<div class="section-head"><div><h2>${title}</h2><p>${sub}</p></div><input id="search" class="search" value="${esc(q)}" placeholder="搜索名称、科或目……"></div>${kind === 'plant' ? plantEditTools() : ''}<div class="grid" id="cardgrid">${list.map(x => card(kind, x)).join('')}</div>`;
}
function card(kind, x) {
  const count = (kind === 'bird' || kind === 'plant') ? imagesOf(x).length : 1;
  const badge = kind === 'bird' ? `${count}张PPT图` : kind === 'plant' ? `${count}张标本图` : '';
  const meta = kind === 'bird' ? `${x.order} · ${x.family}` : kind === 'plant' ? `${x.family} · ${x.latin}` : x.latin;
  return `<article class="card" onclick="openCard('${kind}','${x.id}')"><div class="card-media"><img loading="lazy" src="${x.image}" alt="${x.name}">${badge ? `<span class="image-count">${badge}</span>` : ''}</div><div class="card-body"><h3>${x.name}</h3><div class="meta">${meta}</div><div class="tags"><span class="tag">${esc(x.features[0])}</span></div></div></article>`;
}
function setupSearch(kind) {
  const input = document.querySelector('#search');
  if (!input) return;
  input.oninput = () => {
    const q = norm(input.value);
    const source = kind === 'bird' ? D.birds : kind === 'plant' ? D.plants : D.insects;
    const list = source.filter(x => norm(JSON.stringify(x)).includes(q));
    state.listFilters[kind] = input.value;
    state.listIds[kind] = list.map(x => x.id);
    document.querySelector('#cardgrid').innerHTML = list.map(x => card(kind, x)).join('') || '<div class="empty">没有找到匹配内容</div>';
  };
}

function plantEditTools() {
  const edits = plantEdits();
  const hiddenCount = Object.values(edits.hiddenImages).reduce((n, arr) => n + arr.length, 0);
  return `<section class="edit-panel ${state.plantEditMode ? 'active' : ''}">
    <div><b>植物资料编辑</b><p>当前本地新增 ${edits.customPlants.length} 个标本，隐藏 ${hiddenCount} 张图片。</p></div>
    <div class="edit-actions">
      <button class="btn small ${state.plantEditMode ? 'warn' : 'ghost'}" onclick="togglePlantEditMode()">${state.plantEditMode ? '退出编辑' : '进入编辑'}</button>
      <button class="btn small" onclick="openPlantForm()">新增标本</button>
      <button class="btn small ghost" onclick="exportPlantEdits()">导出修改</button>
      <label class="btn small ghost file-btn">导入修改<input type="file" accept="application/json" onchange="importPlantEdits(this.files[0])"></label>
      <button class="btn small warn" onclick="resetPlantEdits()">清空本地修改</button>
    </div>
  </section>`;
}

function soundCards() {
  return `<div class="section-head"><div><h2>鸟声复习</h2><p>共10段课程鸟声。考试从中选取5段，需填写鸟的种名、科名和目名。</p></div><input id="sound-search" class="search" placeholder="搜索鸟名、科或目……"></div>
  <div class="sound-tip">建议先不看名称播放一遍，再打开答案。练习页面中的音频文件均使用无提示编号，不会从文件名泄露答案。</div>
  <div class="grid" id="soundgrid">${D.sounds.map(soundCard).join('')}</div>`;
}
function soundCard(x) {
  return `<article class="card sound-card"><img loading="lazy" src="${x.image}" alt="${x.name}"><div class="card-body"><h3>${x.name}</h3><div class="meta">${x.order} · ${x.family}</div><audio controls preload="none" src="${x.audio}">浏览器不支持音频播放。</audio><div class="answer-row"><button class="btn small" onclick="startSingle('sound','${x.id}')">只练这一声</button><button class="btn ghost small" onclick="openSoundCard('${x.id}')">查看详情</button></div></div></article>`;
}
function setupSoundSearch() {
  const input = document.querySelector('#sound-search');
  if (!input) return;
  input.oninput = () => {
    const q = norm(input.value);
    const list = D.sounds.filter(x => norm(JSON.stringify(x)).includes(q));
    document.querySelector('#soundgrid').innerHTML = list.map(soundCard).join('') || '<div class="empty">没有找到匹配内容</div>';
  };
}

function imageGallery(x, label) {
  const imgs = imagesOf(x);
  const edit = state.plantEditMode && D.plants.some(p => p.id === x.id) && label.includes('植物');
  return `<section class="ppt-gallery"><div class="gallery-title"><div><b>${label}</b><span>共${imgs.length}张，点击可放大查看</span></div><span class="pill">${edit ? '编辑模式已开启' : '点击图片可放大'}</span></div><div class="ppt-image-grid">${imgs.map((src, i) => `<div class="ppt-image-wrap"><button class="ppt-image-item" onclick="zoomPptImage('${src}','${esc(x.name)} · ${label}${i + 1}')"><img loading="lazy" src="${src}" alt="${esc(x.name)} ${label}${i + 1}"><span>${i + 1} / ${imgs.length}</span></button>${edit ? `<button class="image-remove" onclick="removePlantImage('${x.id}', '${esc(src)}')">删除这张图</button>` : ''}</div>`).join('')}</div></section>`;
}
function birdGallery(x) {
  return imageGallery(x, `PPT第${x.slide}页全部图片`);
}
function plantGallery(x) {
  return imageGallery(x, '植物标本全部图片');
}
function plantDetailEditControls(x) {
  if (!state.plantEditMode) return '';
  const hidden = plantEdits().hiddenImages[x.id]?.length || 0;
  return `<div class="edit-detail-actions">
    <button class="btn small" onclick="openPlantForm('${x.id}')">编辑这个标本</button>
    <button class="btn small ghost" onclick="openPlantImageForm('${x.id}')">给这个标本加图片</button>
    ${hidden ? `<button class="btn small ghost" onclick="restorePlantImages('${x.id}')">恢复隐藏图片 ${hidden} 张</button>` : ''}
  </div>`;
}
window.zoomPptImage = (src, alt) => {
  const old = document.querySelector('#image-zoom');
  if (old) old.remove();
  document.body.insertAdjacentHTML('beforeend', `<div id="image-zoom" class="image-zoom" onclick="closeImageZoom(event)"><button aria-label="关闭" onclick="closeImageZoom(event,true)">×</button><img src="${src}" alt="${alt}"><div>${alt}</div></div>`);
};
window.closeImageZoom = (event, force = false) => {
  if (force || event.target.id === 'image-zoom') document.querySelector('#image-zoom')?.remove();
};

function routeForKind(kind) {
  return kind === 'bird' ? 'birds' : kind === 'plant' ? 'plants' : 'insects';
}
function detailNav(kind, id, position) {
  const list = listFor(kind);
  const index = list.findIndex(x => x.id === id);
  const prev = index > 0 ? list[index - 1] : null;
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null;
  const prevLabel = kind === 'bird' ? '上一种' : kind === 'plant' ? '上一种' : '上一目';
  const nextLabel = kind === 'bird' ? '下一种' : kind === 'plant' ? '下一种' : '下一目';
  const backLabel = kind === 'bird' ? '返回鸟类列表' : kind === 'plant' ? '返回植物列表' : '返回昆虫列表';
  const aria = kind === 'bird' ? '鸟类详情切换' : kind === 'plant' ? '植物详情切换' : '昆虫详情切换';
  return `<nav class="detail-nav detail-nav-${position}" aria-label="${aria}">
    <button class="detail-nav-btn prev" ${prev ? `onclick="switchDetail('${kind}','${prev.id}')"` : 'disabled'} title="${prev ? `${prevLabel}：${esc(prev.name)}` : `没有${prevLabel}`}">← <span>${prevLabel}：</span><b>${prev ? esc(prev.name) : '无'}</b></button>
    <button class="detail-nav-btn back" onclick="backToList('${kind}')">${backLabel}</button>
    <button class="detail-nav-btn next" ${next ? `onclick="switchDetail('${kind}','${next.id}')"` : 'disabled'} title="${next ? `${nextLabel}：${esc(next.name)}` : `没有${nextLabel}`}"><span>${nextLabel}：</span><b>${next ? esc(next.name) : '无'}</b> →</button>
  </nav>`;
}
function detailBody(kind, x) {
  const isBird = kind === 'bird';
  const isPlant = kind === 'plant';
  const gallery = isBird ? birdGallery(x) : isPlant ? plantGallery(x) : `<img class="modal-hero" src="${x.image}" alt="${x.name}">`;
  const meta = isBird ? `${x.order} · ${x.family}` : isPlant ? `${x.family} · ${x.latin}` : x.latin;
  const title = isBird ? 'PPT红字优先的两处特征' : isPlant ? '标本可见的两处识别特征' : '考试优先写的两处特征';
  const basis = isBird ? `<p class="meta feature-basis">特征依据：${esc(x.featureBasis || 'PPT红字优先')}</p>` : isPlant ? `<p class="meta feature-basis">特征依据：植物标本整理清单</p>` : '';
  const notes = isBird
    ? `<h3>资料说明</h3><p>${esc(x.description) || 'PPT未提供文字说明，可重点依据图片记忆。'}</p><p class="meta">以上${imagesOf(x).length}张图片全部提取自本种对应的PPT第${x.slide}页；二维码等非鸟类小图未纳入。</p>`
    : isPlant
      ? `<h3>资料说明</h3><p>${esc(x.description) || '重点观察标本照片中的叶形、叶序、叶缘、茎枝、花果或孢子囊等可见结构。'}</p><p class="meta">以上${imagesOf(x).length}张图片来自植物标本目录；规范学名：${esc(x.latin || x.labelLatin || '')}；识别状态：${esc(x.status || '已整理')}。</p>`
      : `<h3>进一步确认</h3><p>${x.extra.map(esc).join('；')}。</p>`;
  return `<button class="modal-close" onclick="closeModal()">×</button><div class="modal-card" id="detail-card">
    ${detailNav(kind, x.id, 'top')}
    ${gallery}
    <div class="modal-content"><div class="meta">${meta}</div><h2>${x.name}</h2>${isPlant ? plantDetailEditControls(x) : ''}<h3>${title}</h3><div class="feature-list">${x.features.map((f, i) => `<div class="feature">${i + 1}. ${esc(f)}</div>`).join('')}</div>${basis}${notes}<div class="answer-row"><button class="btn" onclick="startSingle('${kind}','${x.id}')">随机抽一张练习</button></div></div>
    ${detailNav(kind, x.id, 'bottom')}
    ${detailNav(kind, x.id, 'sticky')}
  </div>`;
}

function isBasePlant(id) {
  return BASE_PLANTS.some(x => x.id === id);
}
function refreshPlantView(id = state.detail?.id) {
  syncPlantData();
  if (state.route === 'plants') {
    const q = state.listFilters.plant || '';
    const list = q ? D.plants.filter(x => norm(JSON.stringify(x)).includes(norm(q))) : D.plants;
    state.listIds.plant = list.map(x => x.id);
  }
  if (id && state.detail?.kind === 'plant' && getItem('plant', id)) {
    state.detail = { kind: 'plant', id };
    modal.innerHTML = detailBody('plant', getItem('plant', id));
  } else {
    render();
  }
}
window.togglePlantEditMode = () => {
  state.plantEditMode = !state.plantEditMode;
  render();
};
window.removePlantImage = (id, src) => {
  const plant = getItem('plant', id);
  if (!plant) return;
  const imgs = imagesOf(plant);
  if (imgs.length <= 1) {
    alert('至少保留一张图片。');
    return;
  }
  if (!confirm(`确定删除“${plant.name}”的这张图片吗？`)) return;
  const edits = plantEdits();
  if (isBasePlant(id)) {
    edits.hiddenImages[id] ||= [];
    if (!edits.hiddenImages[id].includes(src)) edits.hiddenImages[id].push(src);
  } else {
    const item = edits.customPlants.find(x => x.id === id);
    if (item) {
      item.images = imagesOfRaw(item).filter(x => x !== src);
      item.image = item.images[0] || '';
    }
  }
  savePlantEdits(edits);
  refreshPlantView(id);
};
window.restorePlantImages = id => {
  const edits = plantEdits();
  delete edits.hiddenImages[id];
  savePlantEdits(edits);
  refreshPlantView(id);
};
function plantFormHtml(x = null) {
  const editing = !!x;
  return `<button class="modal-close" onclick="closeModal()">×</button><div class="modal-card editor-card"><form class="plant-form" onsubmit="savePlantForm(event,'${x ? x.id : ''}')">
    <h2>${editing ? '编辑植物标本' : '新增植物标本'}</h2>
    <div class="form-grid">
      <div class="field"><label>种名</label><input id="plant-name" required value="${esc(x?.name || '')}"></div>
      <div class="field"><label>科名</label><input id="plant-family" required value="${esc(x?.family || '')}"></div>
      <div class="field"><label>规范学名</label><input id="plant-latin" value="${esc(x?.latin || '')}"></div>
      <div class="field span3"><label>识别特征，每行一条</label><textarea id="plant-features" required>${esc((x?.features || []).join('\n'))}</textarea></div>
      <div class="field span3"><label>资料说明</label><textarea id="plant-description">${esc(x?.description || '')}</textarea></div>
      <div class="field span3"><label>${editing ? '追加图片文件，可不选' : '标本图片文件'}</label><input id="plant-files" type="file" accept="image/*" multiple ${editing ? '' : 'required'}></div>
      <div class="field span3"><label>图片网址，每行一个，可选</label><textarea id="plant-image-urls" placeholder="https://..."></textarea></div>
    </div>
    <p class="meta">图片文件会压缩后保存在当前浏览器；导出修改后可用于正式合并。</p>
    <div class="answer-row"><button class="btn" type="submit">保存</button><button class="btn ghost" type="button" onclick="closeModal()">取消</button></div>
  </form></div>`;
}
window.openPlantForm = (id = '') => {
  const x = id ? getItem('plant', id) : null;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  modal.innerHTML = plantFormHtml(x);
};
function plantImageFormHtml(x) {
  return `<button class="modal-close" onclick="closeModal()">×</button><div class="modal-card editor-card"><form class="plant-form" onsubmit="savePlantImages(event,'${x.id}')">
    <h2>给“${esc(x.name)}”添加图片</h2>
    <div class="form-grid">
      <div class="field span3"><label>图片文件</label><input id="plant-files" type="file" accept="image/*" multiple></div>
      <div class="field span3"><label>图片网址，每行一个，可选</label><textarea id="plant-image-urls" placeholder="https://..."></textarea></div>
    </div>
    <p class="meta">至少选择图片文件或填写一个图片网址。</p>
    <div class="answer-row"><button class="btn" type="submit">保存图片</button><button class="btn ghost" type="button" onclick="closeModal()">取消</button></div>
  </form></div>`;
}
window.openPlantImageForm = id => {
  const x = getItem('plant', id);
  if (!x) return;
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  modal.innerHTML = plantImageFormHtml(x);
};
async function fileToImageData(file) {
  const bitmap = await createImageBitmap(file);
  const max = 1400;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', .78);
}
async function collectPlantImages() {
  const files = [...(document.querySelector('#plant-files')?.files || [])];
  const fileImages = [];
  for (const file of files) fileImages.push(await fileToImageData(file));
  const urls = String(document.querySelector('#plant-image-urls')?.value || '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  return [...fileImages, ...urls];
}
window.savePlantForm = async (event, id) => {
  event.preventDefault();
  const edits = plantEdits();
  const existing = id ? getItem('plant', id) : null;
  const addedImages = await collectPlantImages();
  const baseImages = existing ? imagesOf(existing) : [];
  const images = [...baseImages, ...addedImages];
  if (!images.length) {
    alert('请至少添加一张标本图片。');
    return;
  }
  const item = cleanPlant({
    id: id || `custom-${Date.now()}`,
    name: document.querySelector('#plant-name').value.trim(),
    family: document.querySelector('#plant-family').value.trim(),
    latin: document.querySelector('#plant-latin').value.trim(),
    features: document.querySelector('#plant-features').value.split(/\n+/).map(s => s.trim()).filter(Boolean),
    description: document.querySelector('#plant-description').value.trim(),
    images
  });
  if (id && isBasePlant(id)) {
    edits.updates[id] = { ...edits.updates[id], ...item };
  } else if (id) {
    const i = edits.customPlants.findIndex(x => x.id === id);
    if (i >= 0) edits.customPlants[i] = item;
  } else {
    edits.customPlants.push(item);
  }
  savePlantEdits(edits);
  state.plantEditMode = true;
  closeModal(false);
  route('plants', false);
};
window.savePlantImages = async (event, id) => {
  event.preventDefault();
  const addedImages = await collectPlantImages();
  if (!addedImages.length) {
    alert('请先选择图片文件或填写图片网址。');
    return;
  }
  const edits = plantEdits();
  const existing = getItem('plant', id);
  const images = [...imagesOf(existing), ...addedImages];
  if (isBasePlant(id)) edits.updates[id] = { ...edits.updates[id], images, image: images[0] };
  else {
    const item = edits.customPlants.find(x => x.id === id);
    if (item) { item.images = images; item.image = images[0]; }
  }
  savePlantEdits(edits);
  state.plantEditMode = true;
  refreshPlantView(id);
};
window.exportPlantEdits = () => {
  const blob = new Blob([JSON.stringify(plantEdits(), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `plant-edits-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
};
window.importPlantEdits = file => {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed !== 'object') throw new Error('bad json');
      savePlantEdits({
        hiddenImages: parsed.hiddenImages || {},
        updates: parsed.updates || {},
        customPlants: parsed.customPlants || []
      });
      state.plantEditMode = true;
      render();
    } catch {
      alert('导入失败，请选择植物修改 JSON 文件。');
    }
  };
  reader.readAsText(file);
};
window.resetPlantEdits = () => {
  if (!confirm('确定清空当前浏览器里的植物编辑记录吗？')) return;
  store.set('plantEdits', { hiddenImages: {}, updates: {}, customPlants: [] });
  syncPlantData();
  render();
};
window.openCard = (kind, id, push = true) => {
  const x = getItem(kind, id);
  if (!x) return;
  state.route = routeForKind(kind);
  state.detail = { kind, id };
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  modal.innerHTML = detailBody(kind, x);
  document.querySelector('#detail-card')?.scrollTo({ top: 0, behavior: 'smooth' });
  if (push) pushLocation();
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.route === state.route));
};
window.switchDetail = (kind, id, push = true) => {
  const x = getItem(kind, id);
  if (!x || !state.detail || state.detail.kind !== kind) return;
  state.detail = { kind, id };
  modal.innerHTML = detailBody(kind, x);
  document.querySelector('#detail-card')?.scrollTo({ top: 0, behavior: 'smooth' });
  if (push) pushLocation();
};
window.backToList = kind => {
  closeModal(false);
  route(routeForKind(kind));
};
window.openSoundCard = id => {
  const x = D.sounds.find(v => v.id === id);
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  modal.innerHTML = `<button class="modal-close" onclick="closeModal()">×</button><div class="modal-card"><img class="modal-hero sound-photo" src="${x.image}" alt="${x.name}"><div class="modal-content"><div class="meta">${x.note}</div><h2>${x.name}</h2><p><b>${x.order}｜${x.family}</b></p><audio class="detail-audio" controls preload="metadata" src="${x.audio}">浏览器不支持音频播放。</audio><div class="answer-row"><button class="btn" onclick="startSingle('sound','${id}')">练这一声</button><button class="btn ghost" onclick="openCard('bird','${x.birdId}')">查看图片识别特征</button></div></div></div>`;
};
window.closeModal = (push = true) => {
  stopAudio();
  modal.classList.add('hidden');
  modal.innerHTML = '';
  document.querySelector('#image-zoom')?.remove();
  if (state.detail) {
    const r = routeForKind(state.detail.kind);
    state.detail = null;
    state.route = r;
    if (push) pushLocation();
  }
};
modal.onclick = e => { if (e.target === modal) closeModal(); };
document.addEventListener('keydown', e => {
  if (!state.detail || modal.classList.contains('hidden')) return;
  if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
  const tag = document.activeElement?.tagName?.toLowerCase();
  if (['input', 'textarea', 'select'].includes(tag) || document.activeElement?.isContentEditable) return;
  const list = listFor(state.detail.kind);
  const index = list.findIndex(x => x.id === state.detail.id);
  const target = e.key === 'ArrowLeft' ? list[index - 1] : list[index + 1];
  if (!target) return;
  e.preventDefault();
  switchDetail(state.detail.kind, target.id);
});

function quizMenu() {
  return `<div class="section-head"><div><h2>练习与考试</h2><p>看图、听声或抽题复习，错题会自动进入错题本。</p></div></div>
  <div class="mode-grid">
    <div class="mode"><h3>鸟类看图练习</h3><p>随机10题，根据PPT原图填写种名、科名和目名。</p><button class="btn" onclick="startQuiz('bird',10)">开始</button></div>
    <div class="mode"><h3>植物标本练习</h3><p>随机10题，根据标本照片填写种名、科名和识别特征。</p><button class="btn" onclick="startQuiz('plant',10)">开始</button></div>
    <div class="mode"><h3>昆虫看图练习</h3><p>随机10题，填写对应类群名称和主要特征。</p><button class="btn" onclick="startQuiz('insect',10)">开始</button></div>
    <div class="mode"><h3>鸟类模拟考试</h3><p>一次完成20题，覆盖更多PPT图片和识别特征。</p><button class="btn" onclick="startQuiz('mock',20)">开始20题</button></div>
    <div class="mode"><h3>鸟声学习考试</h3><p>从10段鸟声中随机抽5题，听声填写分类信息。</p><button class="btn" onclick="startQuiz('sound',5)">开始5题</button></div>
  </div>`;
}
window.startQuiz = (mode, count) => {
  closeModal();
  let kind = 'bird';
  let source = D.birds;
  if (mode === 'plant') { kind = 'plant'; source = D.plants; }
  if (mode === 'insect') { kind = 'insect'; source = D.insects; }
  if (mode === 'sound') { kind = 'sound'; source = D.sounds; }
  state.route = 'quiz';
  const chosen = shuffle(source).slice(0, Math.min(count, source.length));
  state.quiz = {
    mode, kind,
    items: chosen.map(x => (kind === 'bird' || kind === 'plant') ? { ...x, _quizImage: pickImage(x) } : x),
    i: 0, score: 0, answered: false, plays: 0
  };
  render();
};
window.startSingle = (kind, id) => {
  let source = kind === 'bird' ? D.birds : kind === 'plant' ? D.plants : kind === 'insect' ? D.insects : D.sounds;
  const x = source.find(v => v.id === id);
  closeModal();
  state.route = 'quiz';
  state.quiz = { mode: kind, kind, items: [(kind === 'bird' || kind === 'plant') ? { ...x, _quizImage: pickImage(x) } : x], i: 0, score: 0, answered: false, plays: 0 };
  render();
};

function quizView() {
  const q = state.quiz;
  if (!q) return quizMenu();
  if (q.i >= q.items.length) return results();
  if (q.kind === 'sound') return soundQuizView();
  const x = q.items[q.i];
  const bird = q.kind === 'bird';
  const plant = q.kind === 'plant';
  const label = bird ? '鸟类看图' : plant ? '植物标本' : '昆虫看图';
  const image = (bird || plant) ? (x._quizImage || x.image) : x.quizImage;
  const fields = (bird || plant)
    ? `<div class="field"><label>种名</label><input id="a-name" autocomplete="off"></div><div class="field"><label>科名</label><input id="a-family" autocomplete="off"></div>${bird ? `<div class="field"><label>目名</label><input id="a-order" autocomplete="off"></div>` : `<div class="field"><label>规范学名</label><input id="a-latin" autocomplete="off"></div>`}`
    : `<div class="field span3"><label>类群名称</label><input id="a-name" autocomplete="off"></div>`;
  return `<div class="quiz-shell"><div class="quiz-top"><span>${label}</span><span>${q.i + 1} / ${q.items.length}</span></div><div class="progress"><i style="width:${(q.i / q.items.length) * 100}%"></i></div><section class="question"><img class="question-image" src="${image}" alt="练习图片"><div class="form-grid">${fields}<div class="field span3"><label>识别特征1</label><textarea id="a-f1"></textarea></div><div class="field span3"><label>识别特征2</label><textarea id="a-f2"></textarea></div></div><div id="feedback"></div><div class="answer-row"><button class="btn" id="submit" onclick="submitAnswer()">提交答案</button><button class="btn ghost" onclick="skipQuestion()">不会，直接看答案</button></div></section></div>`;
}

function soundQuizView() {
  const q = state.quiz;
  const x = q.items[q.i];
  return `<div class="quiz-shell"><div class="quiz-top"><span>鸟声练习</span><span>${q.i + 1} / ${q.items.length}</span></div><div class="progress"><i style="width:${(q.i / q.items.length) * 100}%"></i></div><section class="question sound-question"><div class="sound-stage"><div class="sound-icon">&#9834;</div><h2>请听鸟声并填写分类信息</h2><p id="play-count" class="meta">本题播放次数：${q.plays}</p><audio id="quiz-audio" class="quiz-audio" controls preload="metadata" src="${x.audio}" onplay="trackPlay()">浏览器不支持音频播放。</audio></div><div class="form-grid"><div class="field"><label>种名</label><input id="a-name" autocomplete="off"></div><div class="field"><label>科名</label><input id="a-family" autocomplete="off"></div><div class="field"><label>目名</label><input id="a-order" autocomplete="off"></div></div><div id="feedback"></div><div class="answer-row"><button class="btn" id="submit" onclick="submitSoundAnswer()">提交答案</button><button class="btn ghost" onclick="skipSoundQuestion()">不会，直接看答案</button></div></section></div>`;
}
window.trackPlay = () => {
  if (!state.quiz || state.quiz.kind !== 'sound' || state.quiz.answered) return;
  state.quiz.plays++;
  const el = document.querySelector('#play-count');
  if (el) el.textContent = `本题播放次数：${state.quiz.plays}`;
};

window.submitAnswer = () => {
  const q = state.quiz, x = q.items[q.i];
  if (q.answered) return nextQuestion();
  const name = document.querySelector('#a-name').value;
  const f1 = document.querySelector('#a-f1').value;
  const f2 = document.querySelector('#a-f2').value;
  let correct = norm(name) === norm(x.name);
  if (q.kind === 'bird') {
    correct = correct && norm(document.querySelector('#a-family').value) === norm(x.family) && norm(document.querySelector('#a-order').value) === norm(x.order);
  }
  if (q.kind === 'plant') {
    correct = correct && norm(document.querySelector('#a-family').value) === norm(x.family);
  }
  q.answered = true;
  const bucket = q.kind === 'bird' ? 'birds' : q.kind === 'plant' ? 'plants' : 'insects';
  if (correct) {
    q.score++;
    mark(bucket, x.id, true);
    removeMistake(q.kind, x.id);
  } else {
    mark(bucket, x.id, false);
    addMistake(q.kind, x.id);
  }
  const wrote = (f1.trim() ? 1 : 0) + (f2.trim() ? 1 : 0);
  const title = correct ? '回答正确' : '需要订正';
  const classLine = q.kind === 'bird'
    ? `<b>${x.name}</b> ｜ ${x.order} ｜ ${x.family}`
    : q.kind === 'plant'
      ? `<b>${x.name}</b> ｜ ${x.family} ｜ ${x.latin}`
      : `类群：<b>${x.name}</b>｜${x.latin}`;
  const featureLabel = q.kind === 'bird' ? 'PPT红字优先识别特征' : q.kind === 'plant' ? '标本可见识别特征' : '主要识别特征';
  const detailButton = (q.kind === 'bird' || q.kind === 'plant') ? `<div class="answer-row"><button class="btn ghost small" onclick="openCard('${q.kind}','${x.id}')">查看全部${imagesOf(x).length}张图片</button></div>` : '';
  document.querySelector('#feedback').innerHTML = `<div class="answer ${correct ? '' : 'bad'}"><h3>${title}</h3><p>${classLine}</p><p>${featureLabel}</p><ul>${x.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul><div class="self-check"><label><input type="checkbox"> 特征描述基本准确</label><label><input type="checkbox"> 分类信息已经记住</label></div><p class="meta">本题已填写 ${wrote} 条特征，可对照上方要点自行订正。</p>${detailButton}</div>`;
  document.querySelector('#submit').textContent = q.i === q.items.length - 1 ? '查看成绩' : '下一题';
};
window.skipQuestion = () => {
  const q = state.quiz, x = q.items[q.i];
  addMistake(q.kind, x.id);
  q.answered = true;
  const classLine = q.kind === 'bird'
    ? `<b>${x.name}</b> ｜ ${x.order} ｜ ${x.family}`
    : q.kind === 'plant'
      ? `<b>${x.name}</b> ｜ ${x.family} ｜ ${x.latin}`
      : `<b>${x.name}</b>｜${x.latin}`;
  const detailButton = (q.kind === 'bird' || q.kind === 'plant') ? `<div class="answer-row"><button class="btn ghost small" onclick="openCard('${q.kind}','${x.id}')">查看全部${imagesOf(x).length}张图片</button></div>` : '';
  document.querySelector('#feedback').innerHTML = `<div class="answer bad"><h3>??</h3><p>${classLine}</p><ul>${x.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>${detailButton}</div>`;
  document.querySelector('#submit').textContent = q.i === q.items.length - 1 ? '查看成绩' : '下一题';
};
window.submitSoundAnswer = () => {
  const q = state.quiz, x = q.items[q.i];
  if (q.answered) return nextQuestion();
  const correct = norm(document.querySelector('#a-name').value) === norm(x.name)
    && norm(document.querySelector('#a-family').value) === norm(x.family)
    && norm(document.querySelector('#a-order').value) === norm(x.order);
  q.answered = true;
  stopAudio();
  if (correct) {
    q.score++;
    mark('sounds', x.id, true);
    removeMistake('sound', x.id);
  } else {
    mark('sounds', x.id, false);
    addMistake('sound', x.id);
  }
  document.querySelector('#feedback').innerHTML = `<div class="answer ${correct ? '' : 'bad'}"><h3>${correct ? '回答正确' : '需要订正'}</h3><p><b>${x.name}</b>｜${x.order}｜${x.family}</p><div class="sound-answer"><img src="${x.image}" alt="${x.name}"><div><p class="meta">${x.note}</p><audio controls preload="none" src="${x.audio}"></audio></div></div></div>`;
  document.querySelector('#submit').textContent = q.i === q.items.length - 1 ? '查看成绩' : '下一题';
};
window.skipSoundQuestion = () => {
  const q = state.quiz, x = q.items[q.i];
  addMistake('sound', x.id);
  mark('sounds', x.id, false);
  q.answered = true;
  stopAudio();
  document.querySelector('#feedback').innerHTML = `<div class="answer bad"><h3>答案</h3><p><b>${x.name}</b>｜${x.order}｜${x.family}</p><div class="sound-answer"><img src="${x.image}" alt="${x.name}"><div><p class="meta">${x.note}</p><audio controls preload="none" src="${x.audio}"></audio></div></div></div>`;
  document.querySelector('#submit').textContent = q.i === q.items.length - 1 ? '查看成绩' : '下一题';
};
window.nextQuestion = () => {
  stopAudio();
  state.quiz.i++;
  state.quiz.answered = false;
  state.quiz.plays = 0;
  render();
};

function results() {
  const q = state.quiz;
  const label = q.kind === 'sound' ? '鸟声分类正确' : '分类答对';
  const extra = q.kind === 'sound'
    ? '答错或跳过的鸟声题已加入错题本，可以重复听辨。'
    : '对照推荐特征检查自己的描述，答错或跳过的题目已加入错题本。';
  return `<div class="quiz-shell"><section class="question"><h2>本轮完成</h2><div class="stat"><span>${label}</span><strong>${q.score} / ${q.items.length}</strong></div><p>${extra}</p><div class="answer-row"><button class="btn" onclick="startQuiz('${q.mode}',${q.items.length})">再练一次</button><button class="btn ghost" data-route="mistakes">错题本</button><button class="btn ghost" data-route="home">返回首页</button></div></section></div>`;
}

function mistakesView() {
  const ms = mistakes();
  const items = ms.map(m => {
    const list = m.kind === 'bird' ? D.birds : m.kind === 'plant' ? D.plants : m.kind === 'insect' ? D.insects : D.sounds;
    const x = list.find(v => v.id === m.id);
    return x ? { ...x, kind: m.kind } : null;
  }).filter(Boolean);
  return `<div class="section-head"><div><h2>错题本</h2><p>答错或点击“不会”的图片题和鸟声题都会自动收集到这里。</p></div>${items.length ? '<button class="btn warn" onclick="clearMistakes()">清空错题</button>' : ''}</div>${items.length ? `<div class="grid">${items.map(x => x.kind === 'sound' ? `<article class="card mistake-sound"><img src="${x.image}" alt="${x.name}"><div class="card-body"><h3>鸟声错题：${x.name}</h3><div class="meta">${x.order} · ${x.family}</div><audio controls preload="none" src="${x.audio}"></audio><div class="answer-row"><button class="btn small" onclick="startSingle('sound','${x.id}')">重新练习</button></div></div></article>` : `<article class="card" onclick="openCard('${x.kind}','${x.id}')"><img src="${x.image}" alt="${x.name}"><div class="card-body"><h3>${x.name}</h3><div class="meta">点击查看答案并重新练习</div></div></article>`).join('')}</div>` : '<div class="empty">目前没有错题。完成一轮练习后再来看。</div>'}`;
}
window.clearMistakes = () => {
  if (confirm('确定清空错题本吗？')) {
    store.set('mistakes', []);
    render();
  }
};

function render() {
  stopAudio();
  if (state.route === 'home') app.innerHTML = home();
  else if (state.route === 'birds') { app.innerHTML = cards('bird'); setupSearch('bird'); }
  else if (state.route === 'insects') { app.innerHTML = cards('insect'); setupSearch('insect'); }
  else if (state.route === 'plants') { app.innerHTML = cards('plant'); setupSearch('plant'); }
  else if (state.route === 'sounds') { app.innerHTML = soundCards(); setupSoundSearch(); }
  else if (state.route === 'quiz') app.innerHTML = quizView();
  else if (state.route === 'mistakes') app.innerHTML = mistakesView();
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.route === state.route));
  if (state.detail) openCard(state.detail.kind, state.detail.id, false);
  else if (modal.querySelector('#detail-card')) {
    stopAudio();
    modal.classList.add('hidden');
    modal.innerHTML = '';
    document.querySelector('#image-zoom')?.remove();
  }
}
if (location.hash) restoreFromLocation();
else {
  render();
  replaceLocation();
}
