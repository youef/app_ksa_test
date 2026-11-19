import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import KingdomWorld3D, { type AvatarKey, type WorldPosition } from '../../components/game/KingdomWorld3D.web';
const initialZ = Number(new URLSearchParams(window.location.search).get('z') || 6);
function Review() {
  const [key, setKey] = useState<AvatarKey>('knight');
  const [position, setPosition] = useState<WorldPosition>();
  return <div style={{position:'fixed',inset:0}}>
    <KingdomWorld3D avatarKey={key} paused={false} initialZ={initialZ} onPosition={p=>{setPosition(p); (window as any).__position=p;}} />
    <div style={{position:'absolute',top:10,left:10,color:'white',background:'#123',padding:12}}>
      <select aria-label="Character" value={key} onChange={e=>setKey(e.target.value as AvatarKey)}>{['knight','ranger','warrior','desert','mage'].map(k=><option key={k}>{k}</option>)}</select>
      <div>{position?.x.toFixed(2)}, {position?.z.toFixed(2)}</div>
    </div>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Review />);
