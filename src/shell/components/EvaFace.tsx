import { eyeShapeOf } from '../evaAvatar';
import type { EvaMood } from '../evaFace';

/**
 * Eva 数字人头像（SVG）：四态眼形 + 情绪描边/发光 + 说话嘴部开合动画。
 * 样式全部挂在 theme.css 的 .eva-face-svg 系列类上（眼形/嘴形随 mood 切换）。
 */

const EYE_X = [-13.5, 13.5];

function Eyes({ shape }: { shape: ReturnType<typeof eyeShapeOf> }) {
  if (shape === 'arc') {
    // 关怀：弯月笑眼
    return (
      <>
        {EYE_X.map((x) => (
          <path key={x} className="eye-arc" d={`M ${29 + x - 5.5} 30.5 q 5.5 -6.5 11 0`} />
        ))}
      </>
    );
  }
  if (shape === 'round' || shape === 'max') {
    // 警示：圆睁；紧急：瞪大
    const r = shape === 'max' ? 4.4 : 3.4;
    return (
      <>
        {EYE_X.map((x) => (
          <circle key={x} className="eye-round" cx={29 + x} cy={29} r={r} />
        ))}
      </>
    );
  }
  // 平静：横杆
  return (
    <>
      {EYE_X.map((x) => (
        <rect key={x} className="eye-bar" x={29 + x - 4.5} y={26.5} width={9} height={5} rx={2.5} />
      ))}
    </>
  );
}

function Mouth({ mood, speaking }: { mood: EvaMood; speaking: boolean }) {
  if (speaking) {
    return <rect className={`mouth-talk${mood === 'urgent' ? ' urg' : ''}`} x={24} y={37} width={10} height={6} rx={3} />;
  }
  if (mood === 'urgent') {
    return <rect className="mouth urg" x={24} y={36.5} width={10} height={7} rx={2} />;
  }
  if (mood === 'warn') {
    return <path className="mouth" d="M 23.5 38.5 h 11" />;
  }
  // calm / care：浅笑
  return <path className="mouth" d="M 23 37.5 q 6 4.5 12 0" />;
}

export default function EvaFace({ mood, speaking }: { mood: EvaMood; speaking: boolean }) {
  return (
    <svg className={`eva-face-svg ${mood}`} viewBox="0 0 58 58" focusable="false">
      <circle className="ring" cx="29" cy="29" r="26.5" fill="none" strokeWidth="1.6" />
      <Eyes shape={eyeShapeOf(mood)} />
      <Mouth mood={mood} speaking={speaking} />
    </svg>
  );
}
