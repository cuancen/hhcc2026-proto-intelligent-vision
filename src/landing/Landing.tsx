import { useEffect } from 'react';
import CarModel from './CarModel';
import './landing.css';

/** 进入座舱：Landing → Dashboard 的唯一入口（hash 路由，无路由库依赖） */
function enterCockpit(autoDemo: boolean) {
  if (autoDemo) {
    try { window.sessionStorage.setItem('eva.autodemo', '1'); } catch { /* 隐私模式 */ }
  }
  window.location.hash = '#/cockpit';
}

const FEATURES = [
  {
    idx: '01 · VISION',
    title: 'Machine-Vision DMS',
    desc: 'MediaPipe 478-point facial landmarks, inferred locally in the browser: blink EAR, PERCLOS eye-closure ratio, head pose and driver presence — zero upload throughout.',
    tags: ['478 landmarks', 'on-device WASM/GPU', 'multi-source fallback'],
  },
  {
    idx: '02 · FUSION',
    title: 'Dual-Channel Fatigue Fusion',
    desc: 'Driving-workload fatigue and vision PERCLOS fused by take-the-stronger; 60 triggers gentle care, 85 urgent intervention with a rest choice — graded protection, never nagging.',
    tags: ['dual threshold 60/85', 'cooldown gates', 'user branches'],
  },
  {
    idx: '03 · SYNERGY',
    title: 'Cabin-Drive Synergy',
    desc: 'Rainy-night congestion factor ≥2 auto-blocks entertainment and switches to cautious mode; 4 s of distraction degrades L2 speed and headway — the cabin and assistance tell one story.',
    tags: ['L2 degrade/recover', 'entertainment block', 'context restore'],
  },
];

const STATS = [
  { b: '478', span: 'facial landmarks · on-device' },
  { b: '0', span: 'frames uploaded · privacy first' },
  { b: '3', span: 'demo scenes · 60 s auto tour' },
  { b: '51', span: 'regression tests · zero DOM kernel' },
];

/**
 * 品牌首页（Landing）：设计灵感参考 HackHarvard 2024 项目 Garuda 的
 * 视觉风格（深色底 + 红橙渐变光晕 + 悬浮 3D + 极简导航）；
 * 组件、样式与渲染逻辑由本团队从零手写。Hero 3D 车模型为 Sketchfab
 * CC-BY 第三方资源（作者 crivero，已署名，见页脚与 AI_USAGE.md），
 * 加载失败自动回退手写 Canvas 线框。
 */
export default function Landing() {
  useEffect(() => {
    document.body.classList.add('landing-body');
    document.title = 'Eva · Smart Cockpit — Cabin Perception, Human Protection';
    return () => {
      document.body.classList.remove('landing-body');
      document.title = 'Eva · Smart Cockpit';
    };
  }, []);

  return (
    <div className="landing">
      <nav className="la-nav" aria-label="Main navigation">
        <a className="la-logo" href="#/" onClick={(e) => { e.preventDefault(); window.location.hash = ''; }}>
          <b>EVA</b>
          <span>SMART COCKPIT</span>
        </a>
        <div className="la-links">
          <a href="#features">Features</a>
          <a href="#demo">Demo</a>
          <a href="#run">Run</a>
          <a href="#about">About</a>
        </div>
        <button type="button" className="la-btn primary small" onClick={() => enterCockpit(false)}>
          Dashboard →
        </button>
      </nav>

      <header className="la-hero">
        <div>
          <span className="la-kicker"><i aria-hidden="true" />GEELY HACKATHON · PROTOTYPE TRACK</span>
          <h1 className="la-title">
            <em>Cabin Perception,</em><br />
            Human Protection.
          </h1>
          <p className="la-slogan">
            An L2 cabin agent guarded by machine vision — a cockpit that can actually “see” the driver:
            blinks, gaze and fatigue understood in real time, care and intervention unfolding in graded
            levels, while driving responsibility always stays with the human.
          </p>
          <div className="la-cta">
            <button type="button" className="la-btn primary" onClick={() => enterCockpit(true)}>
              ▶ Run Live Demo
            </button>
            <button type="button" className="la-btn ghost" onClick={() => enterCockpit(false)}>
              Enter Dashboard
            </button>
          </div>
        </div>
        <div className="la-hero-visual">
          <CarModel />
        </div>
      </header>

      <section className="la-section" id="features" aria-labelledby="la-features">
        <div className="la-section-head">
          <h2 id="la-features">One kernel, three layers of protection</h2>
          <p>Perception → decision → cabin & drive control: a single data stream runs through every feature.</p>
        </div>
        <div className="la-cards">
          {FEATURES.map((f) => (
            <article key={f.idx} className="la-card">
              <span className="idx">{f.idx}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <div className="tags">{f.tags.map((t) => <i key={t}>{t}</i>)}</div>
            </article>
          ))}
        </div>
      </section>

      <section className="la-section" id="demo" aria-labelledby="la-demo">
        <div className="la-section-head">
          <h2 id="la-demo">A three-act demo script</h2>
          <p>All three scenes in an auto tour of about 60 seconds, narrated step by step — pause anytime and explore by hand.</p>
        </div>
        <div className="la-run">
          <div>
            <h3>From ambient intelligence to urgent intervention</h3>
            <p>
              Face-ID greeting and invisible cabin setup on a daily commute · graded dual-threshold intervention
              and the rest branch under fatigue guard · cabin-drive synergy and auto-recovery on complex roads.
              Or turn on the camera and drive the whole vision pipeline with your own face.
            </p>
            <div className="scenarios">
              <i>☀ City commute</i>
              <i>😮‍💨 Fatigue guard</i>
              <i>⛈ Complex roads</i>
            </div>
          </div>
          <button type="button" className="la-btn primary" onClick={() => enterCockpit(true)}>
            ▶ Watch auto demo
          </button>
        </div>
      </section>

      <section className="la-section" id="run" aria-labelledby="la-run">
        <div className="la-section-head">
          <h2 id="la-run">Let the numbers talk</h2>
          <p>Zero-DOM kernel · single source of parameters · simulated-signal fallback — the demo never breaks.</p>
        </div>
        <div className="la-stats">
          {STATS.map((s) => (
            <div key={s.span} className="la-stat"><b>{s.b}</b><span>{s.span}</span></div>
          ))}
        </div>
      </section>

      <section className="la-section" id="about" aria-labelledby="la-about">
        <div className="la-section-head">
          <h2 id="la-about">About EVA</h2>
          <p>L2 combined assistance positioning · local-first · no external service dependency</p>
        </div>
        <div className="la-about">
          <p>
            <strong>EVA targets L2 combined driving assistance</strong> (driver monitoring + adaptive cruise +
            lane centering): the system assists steering and speed within the lane, while the driver remains
            the responsible party — supervising and ready to take over at any moment.
          </p>
          <ul>
            <li>Camera frames are inferred only inside this device's browser — nothing is collected or uploaded;</li>
            <li>Vision model and WASM runtime are self-hosted: the demo runs offline, with multi-source fallback + simulated signals;</li>
            <li>Frontend components, styling and rendering logic are implemented from scratch by our team; the homepage 3D car model is a CC-BY third-party asset (attributed — see AI_USAGE.md).</li>
          </ul>
        </div>
      </section>

      <footer className="la-footer">
        EVA · Smart Cockpit — Geely Hackathon Prototype Track · built from scratch within the official window<br />
        Driver Monitoring runs fully on-device. L2 is assistance, not autonomy — the driver stays in charge.<br />
        Hero car model: “geelyblackglb” by{' '}
        <a href="https://sketchfab.com/3d-models/geelyblackglb-602e7f7cab6d435ab3c022ecaadceb56" target="_blank" rel="noreferrer noopener">crivero</a>{' '}
        (Sketchfab, CC-BY) — community fan model, not an official Geely asset; paint color modified at runtime.
      </footer>
    </div>
  );
}
