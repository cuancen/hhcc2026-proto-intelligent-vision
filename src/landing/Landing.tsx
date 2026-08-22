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
    idx: '01 · LOCAL DMS',
    title: 'Driver Evidence, Kept Local',
    desc: 'When selected, MediaPipe turns a live camera or local video into head pose, gaze duration, blink and PERCLOS evidence. The Full Demo starts with a clearly labelled replay and never requests camera access by itself.',
    tags: ['478 landmarks', 'Camera or local video', 'Replay by default'],
  },
  {
    idx: '02 · SEMANTIC OMS',
    title: 'Occupant Risk in Context',
    desc: 'A transparent simulated OMS event identifies who is at risk and where they are seated. EVA correlates the rear-right occupant event with available driver evidence instead of mislabelling every glance as fatigue.',
    tags: ['Seat-aware events', '23 test states', 'Source boundaries'],
  },
  {
    idx: '03 · MOMENTTRACE',
    title: 'Action That Can Be Explained',
    desc: 'EVA records the input, rule-based decision, executed protection and dual-sensor recovery as one MomentTrace. No fictional AI confidence score, and no release until the driver confirms safety.',
    tags: ['Input → verification', 'L2 guarded response', 'Driver confirmation'],
  },
];

const STATS = [
  { b: '478', span: 'Facial landmarks · on-device' },
  { b: '0', span: 'Frames uploaded · privacy first' },
  { b: '23', span: 'OMS semantic states · testable' },
  { b: '35 s', span: 'One risk moment · fully traced' },
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
            A local-first cabin agent that connects driver evidence with simulated occupant risk.
            EVA explains why attention moved, coordinates a guarded L2 response, and verifies that both
            people returned to safety — while driving responsibility stays with the human.
          </p>
          <div className="la-cta">
            <button type="button" className="la-btn primary" onClick={() => enterCockpit(true)}>
              Run Full Demo
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
          <h2 id="la-features">One moment, three evidence layers</h2>
          <p>Perception → reasoning → execution. Every claim remains attached to its source and outcome.</p>
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
          <h2 id="la-demo">Five experiences, one automatic tour</h2>
          <p>Daily Commute, Fatigue Guard, Complex Roads, Cabin Memory, and OMS MomentTrace run in one continuous presentation. Pause at any point to inspect the evidence.</p>
        </div>
        <div className="la-run">
          <div>
            <h3>From comfort to cabin safety</h3>
            <p>
              The tour first establishes personalization, fatigue care, and complex-road coordination. It then
              demonstrates spatial cabin memory before closing with an OMS risk moment that links perception,
              reasoning, action, recovery, and source boundaries in one explainable trace.
            </p>
            <div className="scenarios">
              <i>Commute + Fatigue</i>
              <i>Complex Roads + Memory</i>
              <i>OMS MomentTrace</i>
            </div>
          </div>
          <button type="button" className="la-btn primary" onClick={() => enterCockpit(true)}>
            Watch Full Demo
          </button>
        </div>
      </section>

      <section className="la-section" id="run" aria-labelledby="la-run">
        <div className="la-section-head">
          <h2 id="la-run">Let the numbers talk</h2>
          <p>DOM-free decision kernel · explicit source boundaries · graceful sensor fallback · no cloud dependency.</p>
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
          <p>Local-first DMS · Simulated semantic OMS · Driver remains responsible</p>
        </div>
        <div className="la-about">
          <p>
            <strong>EVA is a prototype L2 cabin safety agent, not an autonomous driver.</strong> The driver remains
            responsible, must supervise the road and be ready to take over. Vehicle actions in this demo are simulated.
          </p>
          <ul>
            <li>Camera and selected local-video frames are processed only in this browser and are never collected or uploaded.</li>
            <li>The Full Demo uses an explicit DMS replay by default. Live camera and local video are optional, user-selected evidence sources.</li>
            <li>OMS is a clearly labelled simulated semantic event source for prototype evaluation, not a production occupant model.</li>
            <li>All five experiences remain available individually after the automatic Full Demo.</li>
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
