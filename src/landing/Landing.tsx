import { useEffect } from 'react';
import CarModel from './CarModel';
import './landing.css';

/** 进入座舱：Landing → Digital Twin 的唯一入口（hash 路由，无路由库依赖） */
function enterCockpit(autoDemo: boolean) {
  if (autoDemo) {
    try { window.sessionStorage.setItem('eva.autodemo', '1'); } catch { /* 隐私模式 */ }
  }
  window.location.hash = '#/cockpit';
}

const FEATURES = [
  {
    idx: '01 · SEE',
    title: '人 / 物双通道感知',
    desc: '真实 DMS 在端侧理解眨眼、PERCLOS 与头姿；物品位置以透明标注的模拟视觉事件进入原型，两类输入边界清楚。',
    tags: ['端侧 DMS', '模拟物品事件', '零画面上传'],
  },
  {
    idx: '02 · UNDERSTAND',
    title: '动态情境记忆',
    desc: '把“谁的物品、在哪里、后来发生了什么”保存为可解释语义事件，并将视线偏离关联到真实意图，而不是长期录像。',
    tags: ['事件记忆', '原因关联', '语义而非视频'],
  },
  {
    idx: '03 · CLOSE LOOP',
    title: '行动与视觉确认',
    desc: '告知停车卡位置、点亮对应阅读灯，再由 DMS 确认视线回正；超过安全边界仍触发 L2 降级与接管提醒。',
    tags: ['精准协助', '结果确认', 'L2 安全边界'],
  },
];

const STATS = [
  { b: '4', span: '看见 / 理解 / 行动 / 确认' },
  { b: '0', span: '原始画面进入记忆' },
  { b: '1', span: '主故事 · 60 秒闭环' },
  { b: '55', span: '内核、视觉与界面回归测试' },
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
    document.title = 'EVA Vision Loop — 看见原因，闭环解决';
    return () => {
      document.body.classList.remove('landing-body');
      document.title = 'Eva · 智能座舱';
    };
  }, []);

  return (
    <div className="landing">
      <nav className="la-nav" aria-label="主导航">
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
          进入数字孪生
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
            视觉情境闭环座舱智能体——不只判断驾驶员是否疲劳或分心，
            更理解车内人、物、动作与时间的关系：找到原因、协助解决，并确认风险解除。
          </p>
          <div className="la-cta">
            <button type="button" className="la-btn primary" onClick={() => enterCockpit(true)}>
              观看 60 秒闭环
            </button>
            <button type="button" className="la-btn ghost" onClick={() => enterCockpit(false)}>
              进入数字孪生
            </button>
          </div>
        </div>
        <div className="la-hero-visual">
          <CarModel />
        </div>
      </header>

      <section className="la-section" id="features" aria-labelledby="la-features">
        <div className="la-section-head">
          <h2 id="la-features">检测不是终点</h2>
          <p>看见 → 理解 → 行动 → 确认，一条可解释的数据流闭合现实问题。</p>
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
          <h2 id="la-demo">一条 60 秒闭环</h2>
          <p>只讲清一个问题：驾驶员为什么分心，EVA 如何把原因真正解决。</p>
        </div>
        <div className="la-run">
          <div>
            <h3>从“请专心”到“不用找”</h3>
            <p>
              EVA 记住停车卡位置；驾驶员转头寻找时，DMS 发现注意力风险，情境内核识别原因，
              告知位置并点亮阅读灯，最后确认视线回正。离车时只提醒电脑包和手机等重要物品。
            </p>
            <div className="scenarios">
              <i>看见事件</i>
              <i>理解原因</i>
              <i>确认结果</i>
            </div>
          </div>
          <button type="button" className="la-btn primary" onClick={() => enterCockpit(true)}>
            自动开演
          </button>
        </div>
      </section>

      <section className="la-section" id="run" aria-labelledby="la-run">
        <div className="la-section-head">
          <h2 id="la-run">用边界建立可信度</h2>
          <p>真实 DMS 与模拟物品事件分层展示；零 DOM 内核让每一步都可测试、可解释。</p>
        </div>
        <div className="la-stats">
          {STATS.map((s) => (
            <div key={s.span} className="la-stat"><b>{s.b}</b><span>{s.span}</span></div>
          ))}
        </div>
      </section>

      <section className="la-section" id="about" aria-labelledby="la-about">
        <div className="la-section-head">
          <h2 id="la-about">关于 EVA</h2>
          <p>L2 组合辅助驾驶定位 · 语义记忆 · 本地优先 · 无外部服务依赖</p>
        </div>
        <div className="la-about">
          <p>
            <strong>EVA 定位于 L2 组合辅助驾驶</strong>（驾驶员监测 + 自适应巡航 + 车道居中）：
            系统在车道内辅助转向与加减速，驾驶员始终是驾驶责任的主体，需保持监管并随时准备接管。
          </p>
          <ul>
            <li>摄像头画面仅在本设备浏览器内推理，不采集、不上传任何影像；</li>
            <li>物品位置使用透明标注的模拟视觉事件；原型不宣称已实现通用物体识别或人物归属判断；</li>
            <li>视觉模型与 WASM 运行时自托管，断网可演示，多源容灾 + 模拟信号回退；</li>
            <li>前端组件、样式与渲染逻辑由本团队从零实现；首页 3D 车模型为 CC-BY 第三方资源（已署名致谢，见 AI_USAGE.md）。</li>
          </ul>
        </div>
      </section>

      <footer className="la-footer">
        EVA Vision Loop · 智能座舱 — 吉利黑客松原型开发赛道 · 官方开发期内从零搭建<br />
        Driver Monitoring runs fully on-device. L2 is assistance, not autonomy — the driver stays in charge.<br />
        Hero car model: “geelyblackglb” by{' '}
        <a href="https://sketchfab.com/3d-models/geelyblackglb-602e7f7cab6d435ab3c022ecaadceb56" target="_blank" rel="noreferrer noopener">crivero</a>{' '}
        (Sketchfab, CC-BY) — community fan model, not an official Geely asset; paint color modified at runtime.
      </footer>
    </div>
  );
}
