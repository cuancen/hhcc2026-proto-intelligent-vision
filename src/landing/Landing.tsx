import { useEffect } from 'react';
import CarModel from './CarModel';
import './landing.css';

/** Landing → Digital Twin handoff (hash route, no routing dependency). */
function enterCockpit(autoDemo: boolean) {
  if (autoDemo) {
    try { window.sessionStorage.setItem('eva.autodemo', '1'); } catch { /* 隐私模式 */ }
  }
  window.location.hash = '#/cockpit';
}

const FEATURES = [
  {
    idx: '01 · SEE',
    title: 'Two-channel perception',
    desc: 'Live on-device DMS understands blinks, PERCLOS and head pose. Object locations enter as transparently labeled simulated vision events.',
    tags: ['On-device DMS', 'Simulated object events', 'No frame upload'],
  },
  {
    idx: '02 · UNDERSTAND',
    title: 'Dynamic context memory',
    desc: 'EVA keeps explainable semantic events — whose object, where it was, and what happened next — then links gaze deviation to intent, not to stored video.',
    tags: ['Event memory', 'Cause linking', 'Semantics, not video'],
  },
  {
    idx: '03 · CLOSE LOOP',
    title: 'Action and visual verification',
    desc: 'EVA gives the parking-card location and lights the right area. DMS then verifies eyes are back on road; L2 still degrades beyond the safety boundary.',
    tags: ['Precise assistance', 'Outcome verification', 'L2 safety boundary'],
  },
];

const STATS = [
  { b: '4', span: 'See / Understand / Act / Verify' },
  { b: '0', span: 'Raw frames stored in memory' },
  { b: '1', span: 'Focused 60-second story' },
  { b: '63', span: 'Core, vision and interaction tests' },
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
    document.title = 'EVA Vision Loop — See the cause. Close the loop.';
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
          Enter Digital Twin
        </button>
      </nav>

      <header className="la-hero">
        <div>
          <span className="la-kicker"><i aria-hidden="true" />EVA VISION LOOP · PROTOTYPE TRACK</span>
          <h1 className="la-title">
            <em>See the cause.</em><br />
            Close the loop.
          </h1>
          <p className="la-slogan">
            A vision-context cockpit agent that goes beyond fatigue and distraction detection.
            It understands how people, objects, actions and time relate — then resolves the cause and verifies the outcome.
          </p>
          <div className="la-cta">
            <button type="button" className="la-btn primary" onClick={() => enterCockpit(true)}>
              Watch the 60s Loop
            </button>
            <button type="button" className="la-btn ghost" onClick={() => enterCockpit(false)}>
              Enter Digital Twin
            </button>
          </div>
        </div>
        <div className="la-hero-visual">
          <CarModel />
        </div>
      </header>

      <section className="la-section" id="features" aria-labelledby="la-features">
        <div className="la-section-head">
          <h2 id="la-features">Detection is not the destination</h2>
          <p>See → Understand → Act → Verify. One explainable flow that closes a real-world loop.</p>
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
          <h2 id="la-demo">One 60-second loop</h2>
          <p>One focused question: why did the driver look away, and how does EVA resolve the actual cause?</p>
        </div>
        <div className="la-run">
          <div>
            <h3>From “pay attention” to “you do not need to search”</h3>
            <p>
              EVA remembers the parking card. When the driver looks for it, DMS detects the attention risk,
              the context engine links the cause, gives the location, lights the area and verifies eyes are back on road.
              At exit, only important items such as the laptop bag and phone trigger a reminder.
            </p>
            <div className="scenarios">
              <i>See the event</i>
              <i>Understand the cause</i>
              <i>Verify the outcome</i>
            </div>
          </div>
          <button type="button" className="la-btn primary" onClick={() => enterCockpit(true)}>
            Start the Story
          </button>
        </div>
      </section>

      <section className="la-section" id="run" aria-labelledby="la-run">
        <div className="la-section-head">
          <h2 id="la-run">Trust starts with clear boundaries</h2>
          <p>Live DMS and simulated object events are separated visibly; a zero-DOM core keeps every step testable and explainable.</p>
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
          <p>L2 combined assistance · Semantic memory · Local first · No runtime service dependency</p>
        </div>
        <div className="la-about">
          <p>
            <strong>EVA is positioned as an L2 combined-assistance system</strong> (driver monitoring, adaptive cruise and lane centering).
            The driver always remains responsible, must supervise the road and be ready to take over.
          </p>
          <ul>
            <li>Camera frames are processed only in this browser and are never collected or uploaded.</li>
            <li>Object locations use transparently labeled simulated vision events; the prototype does not claim general object recognition or ownership inference.</li>
            <li>The vision model and WASM runtime are self-hosted, with multi-source recovery and a simulated-signal fallback.</li>
            <li>Frontend components, styling and rendering were built by the team. The landing-page car is a credited CC-BY third-party asset; see AI_USAGE.md.</li>
          </ul>
        </div>
      </section>

      <footer className="la-footer">
        EVA Vision Loop · Smart Cockpit — Geely Hackathon Prototype Track · Built from scratch during the official development window<br />
        Driver Monitoring runs fully on-device. L2 is assistance, not autonomy — the driver stays in charge.<br />
        Hero car model: “geelyblackglb” by{' '}
        <a href="https://sketchfab.com/3d-models/geelyblackglb-602e7f7cab6d435ab3c022ecaadceb56" target="_blank" rel="noreferrer noopener">crivero</a>{' '}
        (Sketchfab, CC-BY) — community fan model, not an official Geely asset; paint color modified at runtime.
      </footer>
    </div>
  );
}
