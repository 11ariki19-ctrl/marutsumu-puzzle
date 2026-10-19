export const W=1000,H=640, MATCH_SECONDS=90;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const createPlayer=(type='sprinter',level=1)=>({type,level,xp:0,stamina:100,score:0,wins:0,losses:0,matches:0,skills:['dash'],coins:0,stats:{speed:type==='sprinter'?1.12:1,power:type==='impact'?1.18:1,control:type==='technique'?1.2:1,energy:1}});
export function createMatch(seed=Date.now()){
 const rand=(()=>{let s=(seed>>>0)||1;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}})();
 const p={x:170,y:320,vx:0,vy:0,r:19,energy:100,team:0,stun:0,trail:[]};
 const cpu={x:830,y:320,vx:0,vy:0,r:19,energy:100,team:1,stun:0,trail:[],stuckTime:0,lastX:830,lastY:320};
 return {time:MATCH_SECONDS,score:[0,0],players:[p,cpu],core:{x:500,y:320,vx:(rand()-.5)*80,vy:(rand()-.5)*80,r:12,owner:-1},arena:{phase:0,changeAt:14,lanes:[]},status:'playing',events:[],seed,elapsed:0,randomState:(seed>>>0)||1,stats:{shots:0,steals:0,dashes:0}};
}
export function movePlayer(p,dx,dy,dt,stats,boost=false){
 const len=Math.hypot(dx,dy); if(len>1){dx/=len;dy/=len}
 const speed=245*(stats?.speed||1)*(boost&&p.energy>0?1.65:1);
 if(boost&&p.energy>0){p.energy=Math.max(0,p.energy-38*dt)}
 else p.energy=Math.min(100,p.energy+18*dt);
 p.vx=dx*speed;p.vy=dy*speed;p.x=clamp(p.x+p.vx*dt,28,W-28);p.y=clamp(p.y+p.vy*dt,28,H-28);
 if(boost){p.trail.push({x:p.x,y:p.y,life:.65});if(p.trail.length>24)p.trail.shift()}
 p.trail=p.trail.filter(t=>(t.life-=dt)>0);
}
export function act(m,who,kind,playerStats={power:1,control:1}){
 if(m.status!=='playing')return {ok:false,reason:'finished'};
 const p=m.players[who],c=m.core,other=m.players[1-who],d=distance(p,c);
 if(kind==='break'){
  if(p.energy<15)return {ok:false,reason:'energy'};
  if(d>=82)return {ok:false,reason:'range'};
  p.energy-=15;
  if(d<82){
   const dx=c.x-p.x,dy=c.y-p.y,l=Math.max(1,Math.hypot(dx,dy));
   c.vx+=dx/l*430*(playerStats.power||1);c.vy+=dy/l*430*(playerStats.power||1);
   if(c.owner===1-who){c.owner=-1;m.stats.steals++}
   m.events.unshift(who===0?'コアを弾き出した！':'CPUがコアを弾いた');return {ok:true};
  }
  return {ok:false,reason:'range'};
 }
 if(kind==='special'){
  if(p.energy<35)return {ok:false,reason:'energy'};
  p.energy-=35;
  const dx=c.x-p.x,dy=c.y-p.y,l=Math.max(1,Math.hypot(dx,dy));
  if(d<150){c.vx+=dx/l*620*(playerStats.control||1);c.vy+=dy/l*620*(playerStats.control||1);c.owner=-1;m.events.unshift('リフトバースト！');return {ok:true}}
  p.x=clamp(p.x+dx/l*90,28,W-28);p.y=clamp(p.y+dy/l*90,28,H-28);m.events.unshift('リフトステップ！');return {ok:true};
 }
 if(kind==='claim'&&d<42){c.owner=who;c.vx=p.vx*.35;c.vy=p.vy*.35;m.events.unshift(who===0?'コアを確保！':'CPUがコアを確保');return {ok:true}}
 return {ok:false,reason:'range'};
}
export function stepMatch(m,dt,input={x:0,y:0,dash:false},stats={speed:1,power:1,control:1}){
 if(m.status!=='playing')return m;
 dt=clamp(dt,0,.05);m.elapsed+=dt;m.time=Math.max(0,m.time-dt);
 const [p,cpu]=m.players,c=m.core;
 movePlayer(p,input.x||0,input.y||0,dt,stats,!!input.dash);
 // CPU AI: pursue the loose/player-held core, or carry it toward the left goal.
 // A watchdog detects a CPU pinned against a boundary and gives it a safe recovery route.
 let target=c.owner===1?{x:52,y:320}:c;
 let dx=target.x-cpu.x,dy=target.y-cpu.y,l=Math.hypot(dx,dy)||1;
 const cpuDash=l>200&&cpu.energy>30;
 const oldX=cpu.x,oldY=cpu.y;
 movePlayer(cpu,dx/l,dy/l,dt,{speed:1.02},cpuDash);
 const moved=Math.hypot(cpu.x-oldX,cpu.y-oldY);
 if(moved<0.05&&l>42)cpu.stuckTime=(cpu.stuckTime||0)+dt;else cpu.stuckTime=0;
 if(cpu.stuckTime>1.0){
  // Detour away from the wall/obstacle instead of repeating the same blocked movement.
  const detourX=clamp(target.x+(cpu.x<=32?95:cpu.x>=W-32?-95:0),55,W-55);
  const detourY=clamp(target.y+(cpu.y<=32?95:cpu.y>=H-32?-95:0),55,H-55);
  const ax=detourX-cpu.x,ay=detourY-cpu.y,al=Math.hypot(ax,ay)||1;
  movePlayer(cpu,ax/al,ay/al,dt,{speed:1.08},false);
  if(Math.hypot(cpu.x-oldX,cpu.y-oldY)>0.05)cpu.stuckTime=0;
 }
 // Repair invalid state defensively so one bad frame cannot freeze the whole match.
 if(!Number.isFinite(cpu.x)||!Number.isFinite(cpu.y)){cpu.x=830;cpu.y=320;cpu.vx=0;cpu.vy=0;cpu.stuckTime=0;}
 cpu.x=clamp(cpu.x,28,W-28);cpu.y=clamp(cpu.y,28,H-28);
 if(distance(cpu,c)<35&&c.owner!==1){c.owner=1;c.vx=cpu.vx*.35;c.vy=cpu.vy*.35}
 if(distance(p,c)<35&&c.owner!==0&&input.claim){c.owner=0;c.vx=p.vx*.35;c.vy=p.vy*.35}
 // Owner carries core unless the opponent contests it.
 if(c.owner>=0){const owner=m.players[c.owner];c.x=owner.x+owner.vx*.035;c.y=owner.y+owner.vy*.035;c.vx=owner.vx*.35;c.vy=owner.vy*.35}
 else {c.x+=c.vx*dt;c.y+=c.vy*dt;c.vx*=Math.pow(.982,dt*60);c.vy*=Math.pow(.982,dt*60)}
 if(c.y<c.r||c.y>H-c.r){c.y=clamp(c.y,c.r,H-c.r);c.vy*=-.82}
 if(c.x<c.r||c.x>W-c.r){c.x=clamp(c.x,c.r,W-c.r);c.vx*=-.82}
 // A goal scores when the core crosses the opponent's gate.
 if((c.x>W-24||(c.owner===0&&p.x>W-60))&&Math.abs(c.y-H/2)<105){m.score[0]++;m.events.unshift('RIFT GOAL！ +1');resetAfterGoal(m,0)}
 else if((c.x<24||(c.owner===1&&cpu.x<60))&&Math.abs(c.y-H/2)<105){m.score[1]++;m.events.unshift('CPU GOAL +1');resetAfterGoal(m,1)}
 // Rotating arena modifiers create moving acceleration lanes every 14 seconds.
 if(m.elapsed>=m.arena.changeAt){m.arena.phase=(m.arena.phase+1)%3;m.arena.changeAt+=14;m.events.unshift(['フィールド変化：加速レーン','フィールド変化：反発ゾーン','フィールド変化：コア加速'][m.arena.phase]);}
 if(m.arena.phase===0&&Math.abs(c.y-170)<25)c.vx+=Math.sign(c.vx||1)*22*dt;
 if(m.arena.phase===1&&Math.abs(c.x-W/2)<35){c.vx+=Math.sign(c.x-W/2||1)*50*dt}
 if(m.time<=0||m.score[0]>=5||m.score[1]>=5)m.status='finished';
 return m;
}
function resetAfterGoal(m,scorer){m.core.x=500;m.core.y=320;m.core.vx=0;m.core.vy=0;m.core.owner=-1;m.players[0].x=170;m.players[0].y=320;m.players[1].x=830;m.players[1].y=320;m.players.forEach(p=>{p.vx=0;p.vy=0})}
export function settleCareer(career,match){
 const won=match.score[0]>match.score[1],draw=match.score[0]===match.score[1];
 career.matches=(career.matches||0)+1;career.xp=(career.xp||0)+(won?45:draw?28:20);career.coins=(career.coins||0)+(won?35:draw?22:15);
 if(won)career.wins=(career.wins||0)+1;else if(!draw)career.losses=(career.losses||0)+1;
 while(career.xp>=career.level*100){career.xp-=career.level*100;career.level++;career.stats.speed=Math.min(1.8,career.stats.speed+.025);career.stats.power=Math.min(1.8,career.stats.power+.02);career.stats.control=Math.min(1.8,career.stats.control+.025);career.skills=career.skills||['dash'];if(career.level===3&&!career.skills.includes('burst'))career.skills.push('burst')}
 return {won,draw,xp:won?45:draw?28:20,coins:won?35:draw?22:15,level:career.level};
}
export function trainCareer(career,focus){
 if(career.coins<20)return {ok:false,reason:'coins'};
 career.stats=career.stats||{speed:1,power:1,control:1,energy:1};
 const key={speed:'speed',power:'power',control:'control'}[focus]||'speed';
 if((Number(career.stats[key])||1)>=1.8)return {ok:false,reason:'max'};
 career.coins-=20;career.stats[key]=Math.min(1.8,(Number(career.stats[key])||1)+.06);return {ok:true,key,value:career.stats[key]};
}
export function normalizeSave(raw){
 const base={type:'sprinter',level:1,xp:0,coins:60,wins:0,losses:0,matches:0,skills:['dash'],stats:{speed:1,power:1,control:1,energy:1},history:[]};
 if(!raw||typeof raw!=='object')return base;
 const out={...base,...raw};out.level=clamp(Number(out.level)||1,1,99);out.xp=Math.max(0,Number(out.xp)||0);out.coins=Math.max(0,Number(out.coins)||0);
 out.stats={...base.stats,...(raw.stats||{})};out.skills=Array.isArray(out.skills)?out.skills:['dash'];out.history=Array.isArray(out.history)?out.history.slice(0,20):[];
 if(!['sprinter','impact','technique'].includes(out.type))out.type='sprinter';
 return out;
}
