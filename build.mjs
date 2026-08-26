#!/usr/bin/env node
/**
 * wzy-portfolio 静态构建：读取 data/projects.json + content/projects/*.md，
 * 生成 dist/index.html（自包含单页），并复制 media 到 dist/media。
 * 零依赖：node build.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, cpSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const dist = join(root, 'dist')
const data = JSON.parse(readFileSync(join(root, 'data/projects.json'), 'utf8'))

function mdInline(s) {
  return s
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
      const p = src.replace(/\/portfolio\//g, 'media/')
      return /\.(mp4|webm|mov)$/i.test(p)
        ? `<video controls muted playsinline preload="metadata" src="${p}"></video>`
        : `<img src="${p}" alt="${alt}" loading="lazy">`
    })
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
}
function mdToHtml(md) {
  md = md.replace(/\/portfolio\//g, 'media/')
  const lines = md.split('\n')
  let html = ''
  let i = 0
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  while (i < lines.length) {
    const line = lines[i]
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim()
      const buf = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) { buf.push(lines[i]); i++ }
      i++
      html += lang === 'mermaid'
        ? `<div class="mermaid">${esc(buf.join('\n'))}</div>\n`
        : `<pre><code>${esc(buf.join('\n'))}</code></pre>\n`
      continue
    }
    if (/^#{1,4}\s/.test(line)) {
      const level = line.match(/^(#+)/)[1].length
      html += `<h${Math.min(level + 1, 3)}>${mdInline(line.replace(/^#+\s*/, ''))}</h${Math.min(level + 1, 3)}>\n`
      i++
      continue
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = []
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${mdInline(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`)
        i++
      }
      html += `<ul>${items.join('')}</ul>\n`
      continue
    }
    if (/^!\[([^\]]*)\]\(([^)]+)\)\s*$/.test(line)) {
      const m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/)
      const alt = m[1]
      const src = m[2].replace(/\/portfolio\//g, 'media/')
      const media = /\.(mp4|webm|mov)$/i.test(src)
        ? `<video controls muted playsinline preload="metadata" src="${src}"></video>`
        : `<img src="${src}" alt="${alt}" loading="lazy">`
      html += `<figure>${media}<figcaption>${alt}</figcaption></figure>\n`
      i++
      continue
    }
    if (/^\s*$/.test(line)) { i++; continue }
    const buf = []
    while (i < lines.length && !/^\s*$/.test(lines[i]) && !lines[i].startsWith('```') && !/^#{1,4}\s/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i])) {
      buf.push(lines[i]); i++
    }
    html += `<p>${mdInline(buf.join(' '))}</p>\n`
  }
  return html
}

const hero = data.hero
const projects = data.projects.map(p => ({
  ...p,
  detailHtml: existsSync(join(root, `content/projects/${p.id}.md`))
    ? mdToHtml(readFileSync(join(root, `content/projects/${p.id}.md`), 'utf8'))
    : ''
}))

const heroButtons = [
  { label: hero.viewProjectsLabel || 'View Projects', href: '#projects', primary: true },
  { label: hero.githubLabel || 'GitHub', href: hero.githubHref, primary: false, icon: 'gh' },
  { label: 'LinkedIn', href: hero.linkedinHref, primary: false },
  { label: 'Resume', href: hero.resumeHref, primary: false },
].filter(b => b.href)

const cardMedia = p => /\.(gif|png|jpe?g|webp)$/i.test(p.video)
  ? `<img class="card-gif" src="${p.video}" alt="${p.title}">`
  : `<video muted playsinline preload="metadata" poster="${p.poster}" src="${p.video}"></video>
     <button class="card-play" type="button" aria-label="播放视频"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.14v13.72L19 12z"/></svg></button>`
const cards = projects.map(p => `
  <article class="card" id="card-${p.id}">
    <div class="card-media">
      ${cardMedia(p)}
    </div>
    <div class="card-body">
      <p class="kicker">${p.number} · ${p.kicker}</p>
      <h3 class="card-title">${p.title}</h3>
      <div class="tags">${p.tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>
      <p class="card-desc">${p.description}</p>
      <a class="detail-link" href="#project-${p.id}">查看项目详情 →</a>
    </div>
  </article>`).join('\n')

const projectData = JSON.stringify(projects).replace(/</g, '\\u003c')
const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${hero.name} | ${hero.role}</title>
<meta name="description" content="${hero.about}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🤖</text></svg>">
<style>
:root{--bg:#ffffff;--ink:#171717;--muted:#6b7280;--accent:#b45309;--accent-soft:#fef3e2;--line:#e7e5e4;--card:#ffffff;}
*{box-sizing:border-box;margin:0;padding:0} html{scroll-behavior:smooth}
body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif;background:var(--bg);color:var(--ink);line-height:1.7;-webkit-font-smoothing:antialiased}
.wrap{max-width:1060px;margin:0 auto;padding:0 24px} h1,h2,h3,.serif{font-family:Georgia,"Songti SC","Noto Serif SC",serif;font-weight:600;letter-spacing:.01em}
header.hero{display:flex;align-items:center;gap:56px;padding:88px 0 72px;border-bottom:1px solid var(--line)} .hero-copy{flex:1}.hero-role{font-size:17px;letter-spacing:.08em;color:var(--accent);margin-bottom:14px;font-weight:600}.hero-name{font-size:60px;line-height:1.12}.hero-about{color:var(--muted);font-size:18px;margin-top:18px;max-width:560px}.hero-btns{display:flex;flex-wrap:wrap;gap:12px;margin-top:28px}.btn{display:inline-flex;align-items:center;gap:8px;padding:11px 22px;border-radius:999px;font-size:14px;text-decoration:none;border:1px solid var(--line);color:var(--ink);background:#fff;transition:.15s}.btn:hover{border-color:var(--ink)}.btn.primary{background:var(--ink);border-color:var(--ink);color:#fff}.btn.primary:hover{background:#000}.btn svg{width:15px;height:15px}.hero-photo{flex-shrink:0}.hero-photo img{width:208px;height:208px;border-radius:50%;object-fit:cover;border:5px solid #fff;box-shadow:0 0 0 1px var(--line),0 18px 40px rgba(0,0,0,.08)}
main{padding:64px 0 40px}.section-title{font-size:36px}.section-intro{color:var(--muted);font-size:17px;margin-top:12px;max-width:680px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:40px}.card{background:var(--card);border:1px solid var(--line);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;transition:.18s}.card:hover{box-shadow:0 16px 40px rgba(0,0,0,.07);transform:translateY(-2px)}.card-media{position:relative;display:block;aspect-ratio:16/9;background:#0c0c0c}.card-media video{width:100%;height:100%;object-fit:contain}.card-media img.card-gif{width:100%;height:100%;object-fit:contain;display:block}video::-webkit-media-controls-start-playback-button{display:none!important}.card-play{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:64px;height:64px;border-radius:50%;border:0;background:rgba(0,0,0,.55);backdrop-filter:blur(4px);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:opacity .18s,transform .18s,background .18s;z-index:2}.card-play svg{width:26px;height:26px;margin-left:3px;fill:#fff}.card-play:hover{background:rgba(0,0,0,.75)}.card-play.hidden{opacity:0;pointer-events:none}.card-body{padding:20px 22px 24px;display:flex;flex-direction:column;gap:10px;flex:1}.kicker{color:var(--accent);font-size:13.5px;letter-spacing:.06em}.card-title{font-size:24px}.tags{display:flex;flex-wrap:wrap;gap:6px}.tag{font-size:13px;color:#444;background:var(--accent-soft);border:1px solid #f3d9b3;border-radius:999px;padding:3px 10px}.card-desc{color:var(--muted);font-size:15.5px}.detail-link{color:var(--accent);font-size:14px;text-decoration:none;margin-top:auto;font-weight:600}.detail-link:hover{text-decoration:underline}
.detail{display:none}.detail.open{display:block}.back{display:inline-flex;align-items:center;gap:6px;color:var(--muted);text-decoration:none;font-size:14px;margin-bottom:18px}.back:hover{color:var(--ink)}.detail-head .kicker{font-size:14px}.detail-title{font-size:42px;margin-top:4px}.detail-tags{margin:14px 0 6px}.detail-body{margin-top:22px;max-width:760px;color:#333;font-size:17px}.detail-body p{margin:16px 0;font-size:17px;line-height:1.8}.detail-body h2{font-size:26px;margin:34px 0 6px;padding-top:8px}.detail-body h3{font-size:20px;margin:24px 0 4px}.detail-body ul{margin:10px 0 14px;padding-left:22px}.detail-body li{margin:5px 0;font-size:17px}.detail-body img{max-width:100%;border-radius:12px;border:1px solid var(--line);display:block;margin:16px 0}.detail-body video{width:100%;border-radius:12px;background:#000;margin:14px 0}.detail-body figure{margin:18px 0}.detail-body figcaption{font-size:14px;color:var(--muted);margin-top:8px}.detail-body pre{background:#fafaf9;border:1px solid var(--line);border-radius:10px;padding:14px;overflow-x:auto;font-size:13px;margin:14px 0}.detail-body .mermaid{background:#fafaf9;border:1px solid var(--line);border-radius:10px;padding:16px;margin:14px 0;overflow-x:auto;text-align:center}
footer{padding:36px 0 56px;border-top:1px solid var(--line);color:var(--muted);font-size:13px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap}
@media (max-width:760px){header.hero{flex-direction:column-reverse;text-align:center;padding:56px 0 48px;gap:28px}.hero-about{max-width:none}.hero-btns{justify-content:center}.hero-photo img{width:156px;height:156px}.hero-name{font-size:44px}.grid{grid-template-columns:1fr}.detail-title{font-size:32px}}
</style>
</head>
<body>
<div class="wrap">
<header class="hero"><div class="hero-copy"><p class="hero-role">${hero.role}</p><h1 class="hero-name">${hero.name}</h1><p class="hero-about">${hero.about}</p><div class="hero-btns">${heroButtons.map(b => b.href.startsWith('#') ? `<a class="btn ${b.primary ? 'primary' : ''}" href="${b.href}">${b.icon ? githubSvg() : ''}${b.label}</a>` : `<a class="btn ${b.primary ? 'primary' : ''}" href="${b.href}" target="_blank" rel="noopener">${b.icon ? githubSvg() : ''}${b.label}</a>`).join('\n')}</div></div><div class="hero-photo"><img src="${hero.profileImage}" alt="${hero.name}"></div></header>
<main id="projects"><h2 class="section-title">${data.projectHeading || '项目'}</h2><p class="section-intro">${data.projectIntro || ''}</p><section class="grid" id="project-grid">${cards}</section></main>
<section class="detail" id="detail"></section>
<footer><span>© ${new Date().getFullYear()} ${hero.name}</span><span>${projects.length} 个项目 · 视频来自真实项目素材</span></footer>
</div>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>
const PROJECTS = ${projectData};
function openDetail(id){const p=PROJECTS.find(x=>x.id===id);if(!p)return;document.getElementById('project-grid').style.display='none';const h=document.querySelector('header.hero');if(h)h.style.display='none';const ft=document.querySelector('footer');if(ft)ft.style.display='none';document.querySelectorAll('.section-title,.section-intro').forEach(e=>e.style.display='none');const d=document.getElementById('detail');d.className='detail open';d.innerHTML='<a class="back" href="#projects">← 返回项目</a><div class="detail-head"><p class="kicker">'+p.number+' · '+p.kicker+'</p><h1 class="detail-title serif">'+p.title+'</h1><div class="tags detail-tags">'+p.tags.map(t=>'<span class="tag">'+t+'</span>').join('')+'</div></div><div class="detail-body">'+(p.detailHtml||'<p>详情整理中。</p>')+'</div>';window.scrollTo({top:0,behavior:'smooth'});if(window.mermaid){try{mermaid.run({querySelector:'.detail .mermaid'})}catch(e){}}}
function closeDetail(){document.getElementById('detail').className='detail';document.getElementById('project-grid').style.display='';const h=document.querySelector('header.hero');if(h)h.style.display='';const ft=document.querySelector('footer');if(ft)ft.style.display='';document.querySelectorAll('.section-title,.section-intro').forEach(e=>e.style.display='');window.scrollTo({top:0,behavior:'smooth'})}
window.addEventListener('hashchange',()=>{const m=location.hash.match(/^#project-(.+)$/);if(m)openDetail(m[1]);else if(location.hash==='#projects')closeDetail()})
if(location.hash.match(/^#project-/))openDetail(location.hash.match(/^#project-(.+)$/)[1])
document.querySelectorAll('.card').forEach(c=>{const v=c.querySelector('video'),pb=c.querySelector('.card-play'),m=c.querySelector('.card-media');if(!v){if(m)m.addEventListener('click',()=>{location.hash='#project-'+c.id.replace('card-','')});return}const sync=()=>{if(!v)return;const p=v.paused;if(pb)pb.classList.toggle('hidden',!p);v.controls=!p};v.addEventListener('play',sync);v.addEventListener('pause',sync);v.addEventListener('ended',sync);sync();if(m)m.addEventListener('click',e=>{if(v.paused)v.play().catch(()=>{})});c.addEventListener('click',e=>{if(e.target.closest('a')||e.target.closest('.card-media'))return;location.hash='#project-'+c.id.replace('card-','')})})
</script>
</body>
</html>`
function githubSvg(){return '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>'}
mkdirSync(dist,{recursive:true})
writeFileSync(join(dist,'index.html'),html,'utf8')
cpSync(join(root,'media'),join(dist,'media'),{recursive:true})
console.log(`built dist/index.html (${projects.length} projects, ${(html.length/1024).toFixed(0)} KB html, media copied)`)
