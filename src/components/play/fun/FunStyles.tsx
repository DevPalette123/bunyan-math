/** حركات ألعاب «ألعب» — تتوقف كلها إن فضّلت الطالبة تقليل الحركة. */
export default function FunStyles() {
  return (
    <style>{`
      @keyframes fun-float { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-12px) rotate(2deg); } }
      @keyframes fun-shake { 0%,100% { transform: translateX(0); } 20% { transform: translateX(-7px); } 40% { transform: translateX(7px); } 60% { transform: translateX(-5px); } 80% { transform: translateX(5px); } }
      @keyframes fun-pop { 0% { transform: scale(1); opacity: 1; } 40% { transform: scale(1.35); opacity: .9; } 100% { transform: scale(0); opacity: 0; } }
      @keyframes fun-bounce-in { 0% { transform: scale(.6); opacity: 0; } 70% { transform: scale(1.12); } 100% { transform: scale(1); opacity: 1; } }
      @keyframes fun-bob { 0%,100% { transform: translateY(0) scale(1,1); } 50% { transform: translateY(-5px) scale(1.015,.985); } }
      @keyframes fun-hop { 0%,100% { transform: translateY(0) scale(1,1); } 20% { transform: translateY(0) scale(1.1,.88); } 45% { transform: translateY(-26px) scale(.95,1.08); } 70% { transform: translateY(0) scale(1.08,.92); } 85% { transform: translateY(-8px); } }
      @keyframes fun-wobble { 0%,100% { transform: rotate(0); } 20% { transform: rotate(-7deg); } 45% { transform: rotate(6deg); } 70% { transform: rotate(-4deg); } }
      @keyframes fun-blink { 0%,92%,100% { transform: scaleY(1); } 96% { transform: scaleY(.08); } }
      @keyframes fun-arc { 0% { transform: translateY(0) scale(1.1,.9); } 15% { transform: translateY(0) scale(.92,1.1); } 50% { transform: translateY(-78px) scale(.95,1.08) rotate(-6deg); } 85% { transform: translateY(0) scale(1.12,.88); } 100% { transform: translateY(0) scale(1,1); } }
      @keyframes fun-sink { 0% { transform: scale(1); opacity: 1; } 35% { transform: scale(1.05) translateY(-4px); } 100% { transform: scale(.82) translateY(10px); opacity: .32; } }
      @keyframes fun-confetti { 0% { transform: translate(0,0) scale(.4) rotate(0); opacity: 1; } 65% { opacity: 1; } 100% { transform: translate(var(--dx), var(--dy)) scale(1) rotate(var(--rot)); opacity: 0; } }
      @keyframes fun-eaten { 0% { transform: translate(0,0) scale(1); opacity: 1; } 35% { transform: translate(0,-14px) scale(1.2); } 100% { transform: translate(var(--ex, 40px), -30px) scale(0); opacity: 0; } }
      @keyframes fun-steam { 0% { transform: translate(0,0) scale(.4); opacity: .0; } 20% { opacity: .85; } 100% { transform: translate(-10px,-30px) scale(1.5); opacity: 0; } }
      @keyframes fun-wave { 0%,100% { transform: skewY(0); } 50% { transform: skewY(-9deg); } }
      @keyframes fun-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.06); } }
      @keyframes fun-ripple { 0% { transform: scale(.3); opacity: .7; } 100% { transform: scale(1.7); opacity: 0; } }
      @keyframes fun-drift { 0% { transform: translateX(0); } 100% { transform: translateX(-30px); } }
      .fun-float { animation: fun-float 3.2s ease-in-out infinite; }
      .fun-shake { animation: fun-shake .45s ease-in-out; }
      .fun-pop { animation: fun-pop .35s ease-out forwards; }
      .fun-bounce-in { animation: fun-bounce-in .5s cubic-bezier(.16,1,.3,1) both; }
      .fun-bob { animation: fun-bob 2.4s ease-in-out infinite; transform-origin: 50% 90%; }
      .fun-hop { animation: fun-hop .9s ease-in-out 2; transform-origin: 50% 90%; }
      .fun-wobble { animation: fun-wobble .6s ease-in-out; transform-origin: 50% 90%; }
      .fun-blink { transform-box: fill-box; transform-origin: center; animation: fun-blink 4.2s ease-in-out infinite; }
      .fun-arc { animation: fun-arc .8s cubic-bezier(.3,.7,.4,1) both; transform-origin: 50% 90%; }
      .fun-sink { animation: fun-sink .6s ease-in forwards; }
      .fun-eaten { animation: fun-eaten .8s ease-in forwards; }
      .fun-steam { animation: fun-steam 1.8s ease-out infinite; transform-box: fill-box; transform-origin: center; }
      .fun-wave { animation: fun-wave 1.1s ease-in-out infinite; transform-origin: 0% 50%; }
      .fun-pulse { animation: fun-pulse 1.2s ease-in-out infinite; }
      .fun-ripple { animation: fun-ripple .8s ease-out forwards; }
      .fun-confetti { animation: fun-confetti 1.3s cubic-bezier(.2,.7,.3,1) forwards; }
      @media (prefers-reduced-motion: reduce) {
        .fun-float, .fun-shake, .fun-pop, .fun-bounce-in, .fun-bob, .fun-hop, .fun-wobble, .fun-blink,
        .fun-arc, .fun-sink, .fun-eaten, .fun-steam, .fun-wave, .fun-pulse, .fun-ripple, .fun-confetti { animation: none !important; }
      }
    `}</style>
  );
}
