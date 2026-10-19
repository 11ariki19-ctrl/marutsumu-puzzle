import test from 'node:test';
import assert from 'node:assert/strict';
import {createMatch,stepMatch,act,settleCareer,trainCareer,normalizeSave,movePlayer} from '../engine.js';

test('match initializes valid positions, rules and deterministic seed',()=>{
 const a=createMatch(1),b=createMatch(1);
 assert.equal(a.status,'playing');assert.equal(a.time,90);assert.deepEqual(a.score,[0,0]);
 assert.equal(a.players.length,2);assert.equal(a.core.x,b.core.x);assert.equal(a.core.vx,b.core.vx);
 assert.ok(a.players.every(p=>p.x>=0&&p.x<=1000));
});
test('movement stays inside arena, normal movement regenerates energy and dash consumes it',()=>{
 const m=createMatch(2),p=m.players[0];p.x=990;movePlayer(p,1,0,.1,{speed:1},true);
 assert.ok(p.x<=972);assert.ok(p.energy<100);
 const e=p.energy;movePlayer(p,0,0,.1,{speed:1},false);assert.ok(p.energy>e);
});
test('break action does not consume energy out of range and launches core in range',()=>{
 const m=createMatch(3),p=m.players[0],before=p.energy;
 assert.equal(act(m,0,'break').ok,false);assert.equal(p.energy,before);
 p.x=m.core.x-10;p.y=m.core.y;
 assert.equal(act(m,0,'break',{power:1}).ok,true);assert.ok(Math.abs(m.core.vx)>0);assert.equal(p.energy,before-15);
});
test('claim action only succeeds within range',()=>{
 const m=createMatch(4);assert.equal(act(m,0,'claim').ok,false);
 m.players[0].x=m.core.x;m.players[0].y=m.core.y;
 assert.equal(act(m,0,'claim').ok,true);assert.equal(m.core.owner,0);
});
test('special action has both close-range shot and long-range movement',()=>{
 const m=createMatch(5),p=m.players[0];p.x=100;p.y=100;m.core.x=700;m.core.y=100;
 const x=p.x;assert.equal(act(m,0,'special',{control:1}).ok,true);assert.ok(p.x>x+80);
 m.core.x=p.x+20;m.core.y=p.y;const vx=m.core.vx;
 assert.equal(act(m,0,'special',{control:1}).ok,true);assert.notEqual(m.core.vx,vx);
});
test('match simulation advances time and ends at zero time',()=>{
 const m=createMatch(6);for(let i=0;i<1900;i++)stepMatch(m,.05,{x:0,y:0});
 assert.equal(m.status,'finished');assert.equal(m.time,0);
});
test('career rewards wins and training spends coins while raising stats',()=>{
 const c=normalizeSave(null),m=createMatch(7);m.score=[2,1];
 const r=settleCareer(c,m);assert.equal(r.won,true);assert.equal(c.wins,1);
 const before=c.stats.speed,coins=c.coins;
 assert.equal(trainCareer(c,'speed').ok,true);assert.ok(c.stats.speed>before);assert.equal(c.coins,coins-20);
});
test('training refuses to charge for a capped stat',()=>{
 const c=normalizeSave(null);c.stats.speed=1.8;const coins=c.coins;
 assert.deepEqual(trainCareer(c,'speed'),{ok:false,reason:'max'});assert.equal(c.coins,coins);
});
test('save normalization repairs invalid or legacy data',()=>{
 const c=normalizeSave({type:'???',level:-5,coins:-8,stats:{speed:1.2}});
 assert.equal(c.type,'sprinter');assert.equal(c.level,1);assert.equal(c.coins,0);
 assert.equal(c.stats.speed,1.2);assert.ok(Array.isArray(c.history));
});
test('a goal in the scoring lane increments score and resets the core',()=>{
 const m=createMatch(8);m.core.x=990;m.core.y=320;m.core.owner=-1;
 stepMatch(m,.01,{x:0,y:0});
 assert.equal(m.score[0],1);assert.equal(m.core.x,500);assert.equal(m.core.y,320);
});
test('finished matches reject actions',()=>{
 const m=createMatch(9);m.status='finished';assert.equal(act(m,0,'claim').ok,false);
});


test('CPU keeps advancing and remains in bounds during long matches',()=>{
 const m=createMatch(12345);
 let moved=false,prev={x:m.players[1].x,y:m.players[1].y};
 for(let i=0;i<1200;i++){
  stepMatch(m,.05,{x:0,y:0});
  const cpu=m.players[1];
  assert.ok(Number.isFinite(cpu.x)&&Number.isFinite(cpu.y));
  assert.ok(cpu.x>=28&&cpu.x<=972&&cpu.y>=28&&cpu.y<=612);
  if(Math.hypot(cpu.x-prev.x,cpu.y-prev.y)>.1)moved=true;
  prev={x:cpu.x,y:cpu.y};
  if(m.status==='finished')break;
 }
 assert.equal(moved,true);
});

test('CPU can recover from a boundary stall while pursuing the core',()=>{
 const m=createMatch(12346),cpu=m.players[1];
 cpu.x=972;cpu.y=320;m.core.x=990;m.core.y=320;m.core.owner=-1;
 for(let i=0;i<80;i++)stepMatch(m,.05,{x:0,y:0});
 assert.ok(Number.isFinite(cpu.x)&&Number.isFinite(cpu.y));
 assert.ok(cpu.x>=28&&cpu.x<=972&&cpu.y>=28&&cpu.y<=612);
});


test('CPU scores when carrying the core into its gate instead of stalling at the boundary',()=>{
 const m=createMatch(12347),cpu=m.players[1];
 cpu.x=40;cpu.y=320;cpu.vx=0;cpu.vy=0;
 m.core.owner=1;m.core.x=40;m.core.y=320;m.core.vx=0;m.core.vy=0;
 stepMatch(m,.05,{x:0,y:0});
 assert.equal(m.score[1],1);
 assert.equal(m.core.owner,-1);
 assert.equal(m.core.x,500);
});


test('CPU recovers when target progress stops',()=>{
 const m=createMatch(12348),cpu=m.players[1];
 // Force a near-wall pursuit state, then simulate enough frames for the watchdog.
 cpu.x=972;cpu.y=320;m.core.x=999;m.core.y=320;m.core.owner=-1;
 for(let i=0;i<50;i++)stepMatch(m,.05,{x:0,y:0});
 assert.ok(Number.isFinite(cpu.x)&&Number.isFinite(cpu.y));
 assert.ok(cpu.x>=28&&cpu.x<=972&&cpu.y>=28&&cpu.y<=612);
});
