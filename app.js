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

let state = { route: 'home', quiz: null };
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[m]));
const norm = s => String(s || '').replace(/[\s·，,。；;（）()]/g, '').toLowerCase();
const shuffle = a => [...a].sort(() => Math.random() - .5);
const imagesOf = x => (Array.isArray(x?.images) && x.images.length ? x.images : [x?.image]).filter(Boolean);
const pickImage = x => {
  const imgs = imagesOf(x);
  return imgs[Math.floor(Math.random() * imgs.length)] || x.image;
};

function progress() {
  const p = store.get('progress', { birds: [], insects: [], sounds: [] });
  p.birds ||= [];
  p.insects ||= [];
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
function route(r) {
  stopAudio();
  state.route = r;
  state.quiz = null;
  render();
  document.querySelectorAll('nav button').forEach(b => b.classList.toggle('active', b.dataset.route === r));
  scrollTo({ top: 0, behavior: 'smooth' });
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-route]');
  if (b) route(b.dataset.route);
});

function home() {
  const p = progress();
  return `
    <section class="hero">
      <h1>看标本、听鸟声，练到会写为止</h1>
      <p>根据课程资料制作的鸟类与昆虫识别训练。每种鸟集中展示其PPT页面中的全部图片，练习时会随机抽取其中一张；昆虫练习所属目和目的主要特征；鸟声练习按考核要求填写种名、科名和目名。</p>
      <div class="actions">
        <button class="btn secondary" onclick="startQuiz('bird',10)">开始鸟类练习</button>
        <button class="btn secondary" onclick="startQuiz('insect',10)">开始昆虫练习</button>
        <button class="btn secondary" onclick="startQuiz('sound',5)">开始鸟声练习</button>
        <button class="btn ghost" onclick="startQuiz('mock',20)">20题鸟类模拟</button>
      </div>
    </section>
    <div class="stats four">
      <div class="stat"><span>鸟类已掌握</span><strong>${p.birds.length} / ${D.birds.length}</strong></div>
      <div class="stat"><span>昆虫目已掌握</span><strong>${p.insects.length} / ${D.insects.length}</strong></div>
      <div class="stat"><span>鸟声已掌握</span><strong>${p.sounds.length} / ${D.sounds.length}</strong></div>
      <div class="stat"><span>错题</span><strong>${mistakes().length}</strong></div>
    </div>
    <section>
      <div class="section-head"><div><h2>建议复习顺序</h2><p>先熟悉知识卡和全部鸟声，再做看图、听声填空，最后进行模拟。</p></div></div>
      <div class="mode-grid">
        <div class="mode"><h3>① 鸟类知识卡</h3><p>查看每种鸟在PPT中的全部图片，并把两处识别特征对应到不同角度和状态。</p><button class="btn" data-route="birds">查看57种鸟</button></div>
        <div class="mode"><h3>② 昆虫目知识卡</h3><p>固定按翅、口器、足、触角、腹末的顺序观察。</p><button class="btn" data-route="insects">查看14个目</button></div>
        <div class="mode"><h3>③ 鸟声资料</h3><p>反复听课程提供的10段鸟声，并把声音和分类信息绑定。</p><button class="btn" data-route="sounds">听全部鸟声</button></div>
        <div class="mode"><h3>④ 模拟与错题</h3><p>随机抽题，答错后自动加入错题本，之后集中重练。</p><button class="btn" data-route="quiz">选择练习</button></div>
      </div>
    </section>`;
}

function cards(kind) {
  const list = kind === 'bird' ? D.birds : D.insects;
  const title = kind === 'bird' ? '鸟类复习' : '昆虫复习';
  const sub = kind === 'bird' ? '57种鸟：每种集中展示对应PPT页面的全部图片，练习时随机抽图' : '14个目：优先掌握标本上能直接看到的结构';
  return `<div class="section-head"><div><h2>${title}</h2><p>${sub}</p></div><input id="search" class="search" placeholder="搜索名称、科或目……"></div><div class="grid" id="cardgrid">${list.map(x => card(kind, x)).join('')}</div>`;
}
function card(kind, x) {
  const count = kind === 'bird' ? imagesOf(x).length : 1;
  return `<article class="card" onclick="openCard('${kind}','${x.id}')"><div class="card-media"><img loading="lazy" src="${x.image}" alt="${x.name}">${kind === 'bird' ? `<span class="image-count">${count}张PPT图</span>` : ''}</div><div class="card-body"><h3>${x.name}</h3><div class="meta">${kind === 'bird' ? `${x.order} · ${x.family}` : x.latin}</div><div class="tags"><span class="tag">${esc(x.features[0])}</span></div></div></article>`;
}
function setupSearch(kind) {
  const input = document.querySelector('#search');
  if (!input) return;
  input.oninput = () => {
    const q = norm(input.value);
    const list = (kind === 'bird' ? D.birds : D.insects).filter(x => norm(JSON.stringify(x)).includes(q));
    document.querySelector('#cardgrid').innerHTML = list.map(x => card(kind, x)).join('') || '<div class="empty">没有找到匹配内容</div>';
  };
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

function birdGallery(x) {
  const imgs = imagesOf(x);
  return `<section class="ppt-gallery"><div class="gallery-title"><div><b>PPT第${x.slide}页全部图片</b><span>共${imgs.length}张，均来自课程PPT</span></div><span class="pill">点击图片可放大</span></div><div class="ppt-image-grid">${imgs.map((src, i) => `<button class="ppt-image-item" onclick="zoomPptImage('${src}','${esc(x.name)} · PPT图片${i + 1}')"><img loading="lazy" src="${src}" alt="${esc(x.name)} PPT图片${i + 1}"><span>${i + 1} / ${imgs.length}</span></button>`).join('')}</div></section>`;
}
window.zoomPptImage = (src, alt) => {
  const old = document.querySelector('#image-zoom');
  if (old) old.remove();
  document.body.insertAdjacentHTML('beforeend', `<div id="image-zoom" class="image-zoom" onclick="closeImageZoom(event)"><button aria-label="关闭" onclick="closeImageZoom(event,true)">×</button><img src="${src}" alt="${alt}"><div>${alt}</div></div>`);
};
window.closeImageZoom = (event, force = false) => {
  if (force || event.target.id === 'image-zoom') document.querySelector('#image-zoom')?.remove();
};

window.openCard = (kind, id) => {
  const x = (kind === 'bird' ? D.birds : D.insects).find(v => v.id === id);
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  modal.innerHTML = `<button class="modal-close" onclick="closeModal()">×</button><div class="modal-card">${kind === 'bird' ? birdGallery(x) : `<img class="modal-hero" src="${x.image}" alt="${x.name}">`}<div class="modal-content"><div class="meta">${kind === 'bird' ? `${x.order} · ${x.family}` : x.latin}</div><h2>${x.name}</h2><h3>${kind === 'bird' ? 'PPT红字优先的两处特征' : '考试优先写的两处特征'}</h3><div class="feature-list">${x.features.map((f, i) => `<div class="feature">${i + 1}. ${esc(f)}</div>`).join('')}</div>${kind === 'bird' ? `<p class="meta feature-basis">特征依据：${esc(x.featureBasis || 'PPT红字优先')}</p>` : ''}${kind === 'bird' ? `<h3>资料说明</h3><p>${esc(x.description) || 'PPT未提供文字说明，可重点依据图片记忆。'}</p><p class="meta">以上${imagesOf(x).length}张图片全部提取自本种对应的PPT第${x.slide}页；二维码等非鸟类小图未纳入。</p>` : `<h3>进一步确认</h3><p>${x.extra.map(esc).join('；')}。</p>`}<div class="answer-row"><button class="btn" onclick="startSingle('${kind}','${id}')">随机抽一张练习</button></div></div></div>`;
};
window.openSoundCard = id => {
  const x = D.sounds.find(v => v.id === id);
  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden', 'false');
  modal.innerHTML = `<button class="modal-close" onclick="closeModal()">×</button><div class="modal-card"><img class="modal-hero sound-photo" src="${x.image}" alt="${x.name}"><div class="modal-content"><div class="meta">${x.note}</div><h2>${x.name}</h2><p><b>${x.order}｜${x.family}</b></p><audio class="detail-audio" controls preload="metadata" src="${x.audio}">浏览器不支持音频播放。</audio><div class="answer-row"><button class="btn" onclick="startSingle('sound','${id}')">练这一声</button><button class="btn ghost" onclick="openCard('bird','${x.birdId}')">查看图片识别特征</button></div></div></div>`;
};
window.closeModal = () => {
  stopAudio();
  modal.classList.add('hidden');
  modal.innerHTML = '';
  document.querySelector('#image-zoom')?.remove();
};
modal.onclick = e => { if (e.target === modal) closeModal(); };

function quizMenu() {
  return `<div class="section-head"><div><h2>选择练习</h2><p>图片来自课程PPT/PDF，鸟声来自课程“卷用鸟声”文件夹。</p></div></div>
  <div class="mode-grid">
    <div class="mode"><h3>鸟类快速练习</h3><p>随机10题；每种鸟从其PPT全部图片中随机抽取一张。</p><button class="btn" onclick="startQuiz('bird',10)">开始</button></div>
    <div class="mode"><h3>昆虫看图练习</h3><p>随机10题，判断所属目并写两项特征。</p><button class="btn" onclick="startQuiz('insect',10)">开始</button></div>
    <div class="mode"><h3>鸟类模拟考试</h3><p>按考核形式随机抽20种鸟，并从各自PPT图片中随机抽一张。</p><button class="btn" onclick="startQuiz('mock',20)">开始20题</button></div>
    <div class="mode"><h3>鸟声模拟考试</h3><p>从10段课程音频中随机抽5段，填写种名、科名和目名。</p><button class="btn" onclick="startQuiz('sound',5)">开始5题</button></div>
  </div>`;
}
window.startQuiz = (mode, count) => {
  closeModal();
  let kind = 'bird';
  let source = D.birds;
  if (mode === 'insect') { kind = 'insect'; source = D.insects; }
  if (mode === 'sound') { kind = 'sound'; source = D.sounds; }
  state.route = 'quiz';
  const chosen = shuffle(source).slice(0, Math.min(count, source.length));
  state.quiz = {
    mode, kind,
    items: chosen.map(x => kind === 'bird' ? { ...x, _quizImage: pickImage(x) } : x),
    i: 0, score: 0, answered: false, plays: 0
  };
  render();
};
window.startSingle = (kind, id) => {
  let source = kind === 'bird' ? D.birds : kind === 'insect' ? D.insects : D.sounds;
  const x = source.find(v => v.id === id);
  closeModal();
  state.route = 'quiz';
  state.quiz = { mode: kind, kind, items: [kind === 'bird' ? { ...x, _quizImage: pickImage(x) } : x], i: 0, score: 0, answered: false, plays: 0 };
  render();
};

function quizView() {
  const q = state.quiz;
  if (!q) return quizMenu();
  if (q.i >= q.items.length) return results();
  if (q.kind === 'sound') return soundQuizView();
  const x = q.items[q.i];
  const bird = q.kind === 'bird';
  return `<div class="quiz-shell"><div class="quiz-top"><span>${bird ? '鸟类' : '昆虫'}练习</span><span>${q.i + 1} / ${q.items.length}</span></div><div class="progress"><i style="width:${(q.i / q.items.length) * 100}%"></i></div><section class="question"><img class="question-image" src="${bird ? (x._quizImage || x.image) : x.quizImage}" alt="待识别标本"><div class="form-grid">${bird ? `<div class="field"><label>种名</label><input id="a-name" autocomplete="off"></div><div class="field"><label>科名</label><input id="a-family" autocomplete="off"></div><div class="field"><label>目名</label><input id="a-order" autocomplete="off"></div>` : `<div class="field span3"><label>所属目</label><input id="a-name" autocomplete="off"></div>`}<div class="field span3"><label>识别特征一</label><textarea id="a-f1"></textarea></div><div class="field span3"><label>识别特征二</label><textarea id="a-f2"></textarea></div></div><div id="feedback"></div><div class="answer-row"><button class="btn" id="submit" onclick="submitAnswer()">提交答案</button><button class="btn ghost" onclick="skipQuestion()">不会，直接看答案</button></div></section></div>`;
}
function soundQuizView() {
  const q = state.quiz;
  const x = q.items[q.i];
  return `<div class="quiz-shell"><div class="quiz-top"><span>鸟声练习</span><span>${q.i + 1} / ${q.items.length}</span></div><div class="progress"><i style="width:${(q.i / q.items.length) * 100}%"></i></div><section class="question sound-question"><div class="sound-stage"><div class="sound-icon">♪</div><h2>请听鸟声并填写分类信息</h2><p id="play-count" class="meta">本题播放次数：${q.plays}</p><audio id="quiz-audio" class="quiz-audio" controls preload="metadata" src="${x.audio}" onplay="trackPlay()">浏览器不支持音频播放。</audio></div><div class="form-grid"><div class="field"><label>种名</label><input id="a-name" autocomplete="off"></div><div class="field"><label>科名</label><input id="a-family" autocomplete="off"></div><div class="field"><label>目名</label><input id="a-order" autocomplete="off"></div></div><div id="feedback"></div><div class="answer-row"><button class="btn" id="submit" onclick="submitSoundAnswer()">提交答案</button><button class="btn ghost" onclick="skipSoundQuestion()">不会，直接看答案</button></div></section></div>`;
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
  q.answered = true;
  const bucket = q.kind === 'bird' ? 'birds' : 'insects';
  if (correct) {
    q.score++;
    mark(bucket, x.id, true);
    removeMistake(q.kind, x.id);
  } else {
    mark(bucket, x.id, false);
    addMistake(q.kind, x.id);
  }
  const wrote = (f1.trim() ? 1 : 0) + (f2.trim() ? 1 : 0);
  document.querySelector('#feedback').innerHTML = `<div class="answer ${correct ? '' : 'bad'}"><h3>${correct ? '分类信息正确' : '分类信息需要订正'}</h3><p>${q.kind === 'bird' ? `<b>${x.name}</b>｜${x.order}｜${x.family}` : `正确答案：<b>${x.name}</b>（${x.latin}）`}</p><p>${q.kind === 'bird' ? 'PPT红字优先的两处识别特征：' : '推荐写出的两处识别特征：'}</p><ul>${x.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul><div class="self-check"><label><input type="checkbox"> 我的答案写到了特征一</label><label><input type="checkbox"> 我的答案写到了特征二</label></div><p class="meta">你填写了 ${wrote} 处特征。特征部分请对照推荐答案自行判断。</p>${q.kind === 'bird' ? `<div class="answer-row"><button class="btn ghost small" onclick="openCard('bird','${x.id}')">查看本种全部${imagesOf(x).length}张PPT图片</button></div>` : ''}</div>`;
  document.querySelector('#submit').textContent = q.i === q.items.length - 1 ? '查看成绩' : '下一题';
};
window.skipQuestion = () => {
  const q = state.quiz, x = q.items[q.i];
  addMistake(q.kind, x.id);
  q.answered = true;
  document.querySelector('#feedback').innerHTML = `<div class="answer bad"><h3>答案</h3><p>${q.kind === 'bird' ? `<b>${x.name}</b>｜${x.order}｜${x.family}` : `<b>${x.name}</b>（${x.latin}）`}</p><ul>${x.features.map(f => `<li>${esc(f)}</li>`).join('')}</ul>${q.kind === 'bird' ? `<div class="answer-row"><button class="btn ghost small" onclick="openCard('bird','${x.id}')">查看本种全部${imagesOf(x).length}张PPT图片</button></div>` : ''}</div>`;
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
  const label = q.kind === 'sound' ? '鸟声分类信息答对' : '分类信息答对';
  const extra = q.kind === 'sound'
    ? '答错或跳过的鸟声已经加入错题本，可以从错题卡重新播放。'
    : '识别特征请依据每题答案中的两个勾选项自行核对。答错或跳过的题目已经加入错题本。';
  return `<div class="quiz-shell"><section class="question"><h2>本轮完成</h2><div class="stat"><span>${label}</span><strong>${q.score} / ${q.items.length}</strong></div><p>${extra}</p><div class="answer-row"><button class="btn" onclick="startQuiz('${q.mode}',${q.items.length})">再练一轮</button><button class="btn ghost" data-route="mistakes">查看错题</button><button class="btn ghost" data-route="home">返回首页</button></div></section></div>`;
}

function mistakesView() {
  const ms = mistakes();
  const items = ms.map(m => {
    const list = m.kind === 'bird' ? D.birds : m.kind === 'insect' ? D.insects : D.sounds;
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
  else if (state.route === 'sounds') { app.innerHTML = soundCards(); setupSoundSearch(); }
  else if (state.route === 'quiz') app.innerHTML = quizView();
  else if (state.route === 'mistakes') app.innerHTML = mistakesView();
}
render();
