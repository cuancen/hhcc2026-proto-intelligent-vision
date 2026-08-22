import { useEffect } from 'react';
import CarModel from './CarModel';
import './landing.css';

/** Landing → cockpit handoff (hash route, no routing dependency). */
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
    tags: ['478 landmarks', 'On-device WASM/GPU', 'Multi-source fallback'],
  },
  {
    idx: '02 · FUSION',
    title: 'Dual-Channel Fatigue Fusion',
    desc: 'Driving-workload fatigue and vision PERCLOS are fused by taking the stronger signal. A score of 60 triggers gentle care; 85 triggers urgent intervention with a rest choice.',
    tags: ['Dual threshold 60/85', 'Cooldown gates', 'Driver choice'],
  },
  {
    idx: '03 · SYNERGY',
    title: 'Cabin-Drive Synergy',
    desc: 'Rainy-night congestion automatically blocks entertainment and switches to cautious mode. Sustained distraction degrades L2 speed and headway.',
    tags: ['L2 degrade / recover', 'Entertainment block', 'Context restore'],
  },
];

const STATS = [
  { b: '478', span: 'Facial landmarks · on-device' },
  { b: '0', span: 'Frames uploaded · privacy first' },
  { b: '3', span: 'Demo scenes · 60 s auto tour' },
  { b: '68', span: 'Core, vision and interaction tests' },
];

/**
 * 品牌首页（Landing）：设计灵感参考 HackHarvard 2024 项目 Garuda 的
 * 视觉风格（深色底 + 红橙渐变光晕 + 悬浮 3D + 极简导航）；
 * 组件、样式与渲染逻辑由本团队从零手写。Hero 3D 车模型为 Sketchfab
 * CC-BY 第三方资源（作者 crivero，已署名，见页脚与 AI_USAGE.md），
 * 加载和异常状态由 EVA 头像承接，不再展示旧线框汽车。
 */
export default function Landing() {
  useEffect(() => {
    document.body.classList.add('landing-body');
    document.title = 'EVA · Smart Cockpit — Cabin Perception, Human Protection';
    return () => {
      document.body.classList.remove('landing-body');
      document.title = 'EVA · Smart Cockpit';
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
            An L2 cabin agent guarded by machine vision — a cockpit that can actually see the driver:
            blinks, gaze and fatigue understood in real time, care and intervention unfolding in graded
            levels, while driving responsibility always stays with the human.
          </p>
          <div className="la-cta">
            <button type="button" className="la-btn primary" onClick={() => enterCockpit(true)}>
              Run Live Demo
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
          <p>Perception → decision → cabin and drive control. One data stream runs through every feature.</p>
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
          <p>Three scenes in an automatic tour of about 60 seconds, narrated step by step. Pause anytime and explore by hand.</p>
        </div>
        <div className="la-run">
          <div>
            <h3>From ambient intelligence to urgent intervention</h3>
            <p>
              Face-ID greeting and invisible cabin setup on a daily commute. Graded dual-threshold intervention
              and a rest branch protect the driver during fatigue. Cabin-drive coordination adapts to complex roads,
              then restores normal services as conditions ease.
            </p>
            <div className="scenarios">
              <i>City Commute</i>
              <i>Fatigue Guard</i>
              <i>Complex Roads</i>
            </div>
          </div>
          <button type="button" className="la-btn primary" onClick={() => enterCockpit(true)}>
            Watch Auto Demo
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
          <p>L2 combined assistance · Local first · No external service dependency</p>
        </div>
        <div className="la-about">
          <p>
            <strong>EVA is positioned as an L2 combined-assistance system</strong> (driver monitoring, adaptive cruise and lane centering).
            The driver always remains responsible, must supervise the road and be ready to take over.
          </p>
          <ul>
            <li>Camera frames are processed only in this browser and are never collected or uploaded.</li>
            <li>The vision model and WASM runtime are self-hosted, with multi-source recovery and a simulated-signal fallback.</li>
            <li>Frontend components, styling and rendering were built by the team. The landing-page car is a credited CC-BY third-party asset; see AI_USAGE.md.</li>
          </ul>
        </div>
      </section>

      <footer className="la-footer">
        EVA · Smart Cockpit — Geely Hackathon Prototype Track · Built from scratch during the official development window<br />
        Driver Monitoring runs fully on-device. L2 is assistance, not autonomy — the driver stays in charge.<br />
        Hero car model: “geelyblackglb” by{' '}
        <a href="https://sketchfab.com/3d-models/geelyblackglb-602e7f7cab6d435ab3c022ecaadceb56" target="_blank" rel="noreferrer noopener">crivero</a>{' '}
        (Sketchfab, CC-BY) — community fan model, not an official Geely asset; paint color modified at runtime.
      </footer>
    </div>
  );
}
