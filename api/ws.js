'use strict';
const http=require('http'), {WebSocketServer}=require('ws'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.join(__dirname,'..','public');
const MAPS=Array.from({length:21},(_,i)=>JSON.parse(fs.readFileSync(path.join(ROOT,'maps',i+'.json'),'utf8')));
const FLOORS=MAPS.map(m=>new Set(m.floors));
const clients=new Map(),crateClaims=new Map(),drops=new Map(),entities=new Map();
const MAX=40,SPEED=170,COOLDOWN=100000,ACCOUNT_PREFIX='noclip:account:',SAVE_PREFIX='noclip:save:',SESSION_PREFIX='noclip:session:';
const scrypt=require('util').promisify(crypto.scrypt);
const LEVEL_EVENTS=[[["형광등 불안정","노란 조명이 연속해서 깜빡입니다.","flicker"],["복도에서 들리는 발자국","누군가 같은 속도로 걷는 듯한 소리가 납니다.","echo"],["젖은 카펫","카펫이 축축해지고 발걸음이 무거워집니다.","slow"]],[["멀리서 울리는 경보","거주 구역의 비상 경보가 잠깐 켜집니다.","ambush"],["공급품 발견","버려진 여행 가방에서 쓸만한 물건을 찾았습니다.","loot"],["낯선 목소리","복도 끝에서 친구의 목소리가 들립니다.","hallucination"]],[["배관의 압력 폭주","뜨거운 배관이 진동하며 증기를 내뿜습니다.","hazard"],["기계실 진동","바닥 아래에서 무거운 진동이 전해집니다.","echo"],["보급함 잔해","공구 상자에서 고철을 발견했습니다.","loot"]],[["전기 스파크","낡은 전선에서 스파크가 튑니다.","hazard"],["기계 경고음","정체 모를 장비가 경고음을 반복합니다.","ambush"],["정비 기록","문서에서 유용한 기록을 수집했습니다.","journal"]],[["불 꺼진 사무실","사무실의 조명이 순식간에 꺼집니다.","flicker"],["뒤바뀐 안내판","안내판의 글자가 잠시 바뀌어 보입니다.","hallucination"],["휴게실 물품","책상 서랍에서 소모품을 찾았습니다.","loot"]],[["호텔의 발소리","문 건너편에서 빠르게 뛰는 소리가 들립니다.","ambush"],["손님 없는 호출벨","호텔 벨이 혼자 울려 퍼집니다.","echo"],["복도 안개","침침한 안개가 잠시 시야를 흐립니다.","dark"]],[["어둠 속의 호흡","아무것도 보이지 않지만 바로 옆에서 숨소리가 납니다.","hallucination"],["발밑의 물소리","발이 차가운 물웅덩이에 닿습니다.","slow"],["갑작스러운 속삭임","어둠에서 속삭임이 가까워집니다.","ambush"]],[["복도 끝의 먼지","먼지 구름이 시야를 가립니다.","dark"],["끝없는 발자국","비어 있는 복도에서 수십 발자국이 겹쳐 들립니다.","echo"],["낡은 보급품","녹슨 철제 상자에서 물건을 찾았습니다.","loot"]],[["침수된 바닥","차가운 물이 신발 안으로 스며듭니다.","slow"],["불안한 물결","물이 움직이는데 아무것도 보이지 않습니다.","hallucination"],["물속 그림자","검은 형체가 수면 아래를 지나갑니다.","ambush"]],[["교외의 정전","거리에 있는 조명이 한 번에 꺼집니다.","dark"],["가짜 이정표","표지판이 순간 다른 방향을 가리킵니다.","hallucination"],["버려진 차","차 안에서 보급품을 발견했습니다.","loot"]],[["기묘한 들판의 바람","차가운 바람이 강하게 불어옵니다.","slow"],["누군가 부르는 소리","멀리서 내 이름을 부릅니다.","hallucination"],["위협적인 기척","보이지 않는 무언가가 가까워집니다.","ambush"]],[["창고 붕괴음","멀리서 선반이 무너지는 소리가 납니다.","echo"],["상자 속 부품","쌓인 상자 사이에서 재료를 찾았습니다.","loot"],["불안정한 조명","창고 조명이 갑자기 어두워집니다.","flicker"]],[["이상한 가로등","불빛 아래에 있던 그림자가 사라졌습니다.","hallucination"],["밤거리의 추격","어둠 속 무언가가 뛰어옵니다.","ambush"],["보도블록 균열","바닥이 흔들리며 균열이 생깁니다.","hazard"]],[["지나가는 열차","존재하지 않는 열차의 진동이 느껴집니다.","echo"],["터널 정전","주변이 갑자기 어두워집니다.","dark"],["차량 내 응급함","좌석 아래에서 의료 물품을 발견했습니다.","loot"]],[["달콤한 환청","어딘가에서 듣기 좋은 음악이 나옵니다.","hallucination"],["낙원의 유혹","갑자기 몸이 무거워지고 숨쉬기가 힘듭니다.","hazard"],["무너지는 평온","조용하던 공간에 위협적인 기척이 퍼집니다.","ambush"]],[["무너진 바닥","발 아래의 지반이 흔들립니다.","hazard"],["좁아지는 통로","통로가 잠시 좁아 보입니다.","hallucination"],["발견된 잔해","갈라진 틈에서 소모품을 찾았습니다.","loot"]],[["선반 사이의 그림자","마트 선반 뒤에 누군가 숨어 있는 듯합니다.","ambush"],["점멸하는 가격표","가격표의 숫자가 의미 없는 기호로 변합니다.","hallucination"],["버려진 진열대","진열대에서 보급품을 발견했습니다.","loot"]],[["지친 기계의 비명","장비가 큰 소리를 내며 멈춰 섭니다.","echo"],["전력 과부하","스파크가 튀며 가까운 바닥이 위험해집니다.","hazard"],["부품 더미","고장 난 기계에서 재료를 찾았습니다.","loot"]],[["낡은 유리 파편","바닥에 떨어진 유리가 발을 스칩니다.","hazard"],["거울 속 낯선 사람","거울 속 움직임이 나와 다르게 보입니다.","hallucination"],["복도의 비상등","비상등이 빠르게 깜빡입니다.","flicker"]],[["이상한 방송","스피커에서 알아들을 수 없는 말이 흘러나옵니다.","echo"],["붉은 경보","비상 경고등이 켜지고 무언가가 움직입니다.","ambush"],["폐쇄된 보관함","보관함에서 낡은 물건을 발견했습니다.","loot"]],[["정체불명의 메아리","벽 너머에서 내 발소리가 두 번 울립니다.","hallucination"],["최후의 경보","깊은 곳에서 위험을 알리는 경보가 들립니다.","ambush"],["찢어진 탐험 기록","바닥에서 오래된 탐험 기록을 발견했습니다.","journal"]]];


const INSTANCE=id(), remoteStates=new Map();
let redis=null, sub=null, redisReady=false;
if(process.env.REDIS_URL){
 try {
 const Redis=require('ioredis');
 redis=new Redis(process.env.REDIS_URL,{lazyConnect:true,maxRetriesPerRequest:1,connectTimeout:6000});
 sub=new Redis(process.env.REDIS_URL,{lazyConnect:true,maxRetriesPerRequest:null,connectTimeout:6000});
 redis.on('ready',()=>{redisReady=true;console.log('Redis commands ready')});
 redis.on('close',()=>{redisReady=false;});
 redis.on('error',e=>console.error('redis',e.message));
 sub.on('error',e=>console.error('redis subscribe',e.message));
 // Login and saves depend only on the command connection.
 // Subscriber initialization must never block account login.
 redis.connect().catch(e=>console.error('Redis commands connect',e.message));
 sub.on('ready',()=>{sub.subscribe('noclip:live').catch(e=>console.error('Redis subscribe',e.message));});
 sub.connect().catch(e=>console.error('Redis subscriber connect',e.message));
 sub.on('message',(_,raw)=>{let msg;try{msg=JSON.parse(raw)}catch{return}if(msg.instance===INSTANCE)return;
 if(msg.type==='snapshot')remoteStates.set(msg.instance,{at:Date.now(),players:msg.players||[]});
 if(msg.type==='relay')broadcast(msg.level,msg.payload,null,false);
 });
 }catch(e){console.error('Redis initialize',e.message)}
}
function publish(m){if(redisReady)redis.publish('noclip:live',JSON.stringify({...m,instance:INSTANCE})).catch(()=>{});}
const reserveScript="redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',ARGV[1]);if redis.call('ZCARD',KEYS[1])>=tonumber(ARGV[3]) then return 0 end;redis.call('ZADD',KEYS[1],ARGV[2],ARGV[4]);redis.call('EXPIRE',KEYS[1],60);return 1";
async function reserveSeat(uid){if(!redisReady)return false;try{return Number(await redis.eval(reserveScript,1,'noclip:presence',Date.now(),Date.now()+25000,MAX,uid))===1}catch(e){console.error('reserve seat',e.message);return clients.size<MAX}}
function releaseSeat(uid){if(redisReady)redis.zrem('noclip:presence',uid).catch(()=>{});}
function remotePeers(l){if(l===0)return[];let now=Date.now(),out=[];for(const [id,r] of remoteStates){if(now-r.at>3000){remoteStates.delete(id);continue}out.push(...r.players.filter(p=>p.level===l))}return out;}

function id(){return crypto.randomBytes(6).toString('hex')}
function send(ws,o){if(ws.readyState===1&&ws.bufferedAmount<256000)ws.send(JSON.stringify(o));}
function validUser(name){return typeof name==='string'&&/^[a-zA-Z0-9_]{3,20}$/.test(name)}
function accountKey(name){return ACCOUNT_PREFIX+name.toLowerCase()}
function secureSame(a,b){const x=Buffer.from(a,'hex'),y=Buffer.from(b,'hex');return x.length===y.length&&crypto.timingSafeEqual(x,y)}
async function hashPass(pass,salt){return (await scrypt(pass,salt,64)).toString('hex')}
function emptySave(){let m=MAPS[0];return {level:0,x:m.spawn.x,y:m.spawn.y,hp:100,san:100,inv:['인포머'],dead:false,discovered:[0],eventLog:[],visited:[0]}}
function normalizedSave(o){let t=emptySave();if(!o||typeof o!=='object')return t;const level=Number(o.level);if(!Number.isInteger(level)||level<0||level>20)return t;let x=Number(o.x),y=Number(o.y);if(!Number.isFinite(x)||!Number.isFinite(y)||!floor(level,x,y)){x=MAPS[level].spawn.x;y=MAPS[level].spawn.y;}return {level,x,y,hp:Math.max(0,Math.min(100,Number(o.hp)||0)),san:Math.max(0,Math.min(100,Number(o.san)||0)),inv:Array.isArray(o.inv)?['인포머',...o.inv.filter(v=>typeof v==='string'&&v!=='인포머').slice(0,11)]:['인포머'],dead:!!o.dead,discovered:Array.isArray(o.discovered)?o.discovered.filter(n=>Number.isInteger(n)&&n>=0&&n<=20).slice(0,21):[0],eventLog:Array.isArray(o.eventLog)?o.eventLog.slice(-30):[],visited:Array.isArray(o.visited)?o.visited.filter(n=>Number.isInteger(n)&&n>=0&&n<=20).slice(0,21):[0],nick:typeof o.nick==='string'?label(o.nick):'',color:/^#[0-9a-fA-F]{6}$/.test(o.color||'')?o.color:'#94c8da'};}
function serialize(p){return {level:p.level,x:p.x,y:p.y,hp:p.hp,san:p.san,inv:p.inv,dead:p.dead,discovered:p.discovered,eventLog:p.eventLog,visited:p.visited,nick:p.nick,color:p.color,savedAt:Date.now()}}
async function persist(p){if(!redisReady||!p.account)return;try{await redis.set(SAVE_PREFIX+p.account,JSON.stringify(serialize(p)))}catch(e){console.error('save failure',e.message)}}
async function authenticate(a){
 if(!redis)throw Error('Redis 연결 설정이 없습니다.');
 // Wait for the command connection itself instead of the independent pub/sub subscriber.
 try {
   await Promise.race([redis.ping(),new Promise((_,reject)=>setTimeout(()=>reject(new Error('timeout')),8500))]);
 }catch(e){throw Error('저장 서버 연결에 실패했습니다. 다시 시도해 주세요.');}
 if(a.type==='session'){
   let token=String(a.token||'');if(!/^[a-f0-9]{64}$/.test(token))throw Error('로그인 정보가 만료됐습니다.');
   let name=await redis.get(SESSION_PREFIX+token);if(!name)throw Error('자동 로그인 기간이 끝났습니다.');
   await redis.expire(SESSION_PREFIX+token,60*60*24*30);
   return {name,token};
 }
 const name=String(a.username||'').trim(),pass=String(a.password||'');
 if(!validUser(name))throw Error('아이디는 영문·숫자·밑줄 3~20자로 입력하세요.');
 if(pass.length<8||pass.length>128)throw Error('비밀번호는 8~128자로 입력하세요.');
 const key=accountKey(name),existing=await redis.get(key);
 if(a.type==='register'){
   if(existing)throw Error('이미 사용 중인 아이디입니다.');
   const salt=crypto.randomBytes(16).toString('hex'),hash=await hashPass(pass,salt);
   const inserted=await redis.set(key,JSON.stringify({salt,hash}), 'NX');
   if(inserted!=='OK')throw Error('이미 사용 중인 아이디입니다.');
 }else if(a.type==='login'){
   if(!existing)throw Error('아이디 또는 비밀번호가 잘못됐습니다.');
   let obj;try{obj=JSON.parse(existing)}catch{throw Error('계정 정보를 읽지 못했습니다.')}
   if(!secureSame(obj.hash,await hashPass(pass,obj.salt)))throw Error('아이디 또는 비밀번호가 잘못됐습니다.');
 }else throw Error('로그인 방식이 잘못됐습니다.');
 const token=crypto.randomBytes(32).toString('hex');
 await redis.set(SESSION_PREFIX+token,name.toLowerCase(),'EX',60*60*24*30);
 return {name:name.toLowerCase(),token};
}

function label(t){return String(t||'방랑자').replace(/[<>]/g,'').trim().slice(0,16)||'방랑자';}
function floor(l,x,y){return FLOORS[l].has(`${Math.floor(x/32)},${Math.floor(y/32)}`)}
function zone(l,x,y){const m=MAPS[l];let z=m.defaultZone||'caution';for(const a of m.zones||[]){if(x>=a.x&&y>=a.y&&x<a.x+a.w&&y<a.y+a.h)z=a.kind;}return z;}
function sprite(p){return {id:p.id,nick:p.nick,color:p.color,x:Math.round(p.x),y:Math.round(p.y),level:p.level,hp:Math.ceil(p.hp),san:Math.ceil(p.san),downed:!!p.downed};}
function broadcast(l,obj,exclude,relay=true){if(l===0)return;for(const p of clients.values())if(p.level===l&&p.ws!==exclude)send(p.ws,obj);if(relay)publish({type:'relay',level:l,payload:obj});}
function snapshot(){
 if(!clients.size)return;
 const local=[...clients.values()],now=Date.now(),online=local.length+[...remoteStates.values()].reduce((n,r)=>n+(now-r.at<3000?r.players.length:0),0);
 const grouped=new Map();
 for(const q of local){if(q.level===0)continue;let a=grouped.get(q.level);if(!a){a=remotePeers(q.level);grouped.set(q.level,a);}a.push(sprite(q));}
 for(const p of local){
  if(p.ws.readyState!==1||p.ws.bufferedAmount>128000)continue;
  const roomKey=room(p),all=grouped.get(p.level)||[];
  const peers=p.level===0?[]:all.filter(q=>q.id!==p.id);
  send(p.ws,{type:'state',you:sprite(p),peers,online,zone:zone(p.level,p.x,p.y),drops:drops.get(roomKey)||[],entities:entities.get(roomKey)||[]});
 }
}

const ENTITY_TYPES={
 smiler:{speed:94,damage:18,range:28,aggro:470},
 hound:{speed:151,damage:23,range:29,aggro:600},
 faceling:{speed:83,damage:12,range:30,aggro:380},
 skinstealer:{speed:112,damage:29,range:31,aggro:580}
};
function entityPool(level){
 if(level===6)return ['smiler','hound'];
 if(level===1)return ['faceling','hound'];
 if(level===2||level===3)return ['hound','smiler'];
 if(level===14)return ['faceling','skinstealer','smiler'];
 return ['hound','smiler','faceling','skinstealer'];
}
function spawnEntity(p,roomKey,list){
 const m=MAPS[p.level],danger=zone(p.level,p.x,p.y)==='danger';
 const pool=entityPool(p.level);
 for(let i=0;i<28;i++){
  const angle=Math.random()*Math.PI*2,dist=150+Math.random()*310;
  const x=p.x+Math.cos(angle)*dist,y=p.y+Math.sin(angle)*dist;
  if(x<16||y<16||x>m.width*32-16||y>m.height*32-16||!floor(p.level,x,y))continue;
  const region=zone(p.level,x,y);
  if(region==='safe'||region==='dead'||(region==='caution'&&Math.random()<(danger?.15:.35)))continue;
  if(list.some(e=>Math.hypot(e.x-x,e.y-y)<110))continue;
  const type=pool[Math.floor(Math.random()*pool.length)];
  list.push({id:id(),type,x,y,level:p.level,hp:100,heading:angle,lastHit:0,roamAt:0});
  return true;
 }
 return false;
}
function tickEntities(){
 const active=new Map();
 for(const p of clients.values()){
  if(p.dead||p.downed)continue;
  const z=zone(p.level,p.x,p.y);
  if(z==='safe'||z==='dead')continue;
  const key=room(p),arr=active.get(key)||[];
  arr.push(p);active.set(key,arr);
 }
 const now=Date.now();
 for(const [key,players] of active){
  const level=players[0].level;
  let list=entities.get(key);
  if(!list){list=[];entities.set(key,list);}
  const danger=players.some(p=>zone(p.level,p.x,p.y)==='danger');
  const limit=level===0?2:Math.min(12,players.length*(danger?4:2));
  // First entity spawns promptly; additional entities spawn gradually.
  const chance=level===0?.25:danger?.83:.40;
  if(list.length<limit&&(list.length===0||Math.random()<chance))spawnEntity(players[Math.floor(Math.random()*players.length)],key,list);
  for(const e of list){
   const cfg=ENTITY_TYPES[e.type]||ENTITY_TYPES.hound;
   let closest=null,closestD=Infinity;
   for(const p of players){
    if(zone(p.level,p.x,p.y)==='safe'||p.downed)continue;
    const d=Math.hypot(e.x-p.x,e.y-p.y);
    if(d<closestD){closestD=d;closest=p;}
   }
   if(closest&&closestD<cfg.aggro){
    const dx=closest.x-e.x,dy=closest.y-e.y,d=Math.max(1,closestD);
    e.heading=Math.atan2(dy,dx);
    const step=Math.min(cfg.speed*.25,Math.max(0,d-14));
    const nx=e.x+dx/d*step,ny=e.y+dy/d*step;
    if(floor(level,nx,ny)&&zone(level,nx,ny)!=='safe'&&zone(level,nx,ny)!=='dead'){e.x=nx;e.y=ny;}
    if(closestD<cfg.range&&now-e.lastHit>=850){
      e.lastHit=now;
      closest.hp=Math.max(0,closest.hp-cfg.damage);
      closest.san=Math.max(0,closest.san-(e.type==='smiler'?14:4));
      if(closest.hp<=0)downPlayer(closest,e.type+'에게 공격당했습니다.');
    }
   }else{
    if(now>e.roamAt){e.heading=Math.random()*Math.PI*2;e.roamAt=now+1400+Math.random()*2200;}
    const nx=e.x+Math.cos(e.heading)*cfg.speed*.06,ny=e.y+Math.sin(e.heading)*cfg.speed*.06;
    if(floor(level,nx,ny)&&zone(level,nx,ny)!=='safe'&&zone(level,nx,ny)!=='dead'){e.x=nx;e.y=ny;}
   }
  }
  // Unreachable monsters are recycled to avoid accumulation.
  for(let i=list.length-1;i>=0;i--){
   if(players.every(p=>Math.hypot(p.x-list[i].x,p.y-list[i].y)>800))list.splice(i,1);
  }
 }
 for(const key of entities.keys())if(!active.has(key))entities.delete(key);
}

function room(p){return p.level===0?'0:'+p.id:String(p.level)}
function near(p,obj,r=62){return Math.hypot(p.x-(obj.x+(obj.w||0)/2),p.y-(obj.y+(obj.h||0)/2))<r;}
function move(p,dx,dy,ms){let d=Math.hypot(dx,dy)||1,delta=Math.max(0,Math.min(0.2,ms/1000));let mx=dx/d*delta*SPEED,my=dy/d*delta*SPEED;const r=9;let X=p.x+mx,Y=p.y+my;if(floor(p.level,X-r,p.y-r)&&floor(p.level,X+r,p.y+r)&&floor(p.level,X-r,p.y+r)&&floor(p.level,X+r,p.y-r))p.x=X;if(floor(p.level,p.x-r,Y-r)&&floor(p.level,p.x+r,Y+r)&&floor(p.level,p.x-r,Y+r)&&floor(p.level,p.x+r,Y-r))p.y=Y;}
function dead(p,reason){if(p.dead)return;p.dead=true;p.downed=false;persist(p);send(p.ws,{type:'dead',reason});broadcast(p.level,{type:'event',text:p.nick+'이(가) 사망했습니다.'},p.ws);}
function switchLevel(p,t){const dest=+t.targetLevel;if(!Number.isInteger(dest)||dest<0||dest>20)return;const m=MAPS[dest];broadcast(p.level,{type:'leave',id:p.id});p.level=dest;p.x=Number(t.targetX)||m.spawn.x;p.y=Number(t.targetY)||m.spawn.y;if(!floor(dest,p.x,p.y)){p.x=m.spawn.x;p.y=m.spawn.y;}p.deadz=0;p.nextEvent=Date.now()+11000;p.eventEffect=null;
 if(!p.discovered.includes(dest))p.discovered.push(dest);
 if(!p.visited.includes(dest))p.visited.push(dest);
 send(p.ws,{type:'level',level:dest,x:p.x,y:p.y,trigger:t.condition||t.label});
 sendJournal(p);persist(p);broadcast(dest,{type:'join',player:sprite(p)},p.ws);}
function interact(p,msg){const m=MAPS[p.level];const target=m.objects.find(o=>o.id===msg.id);if(!target||!near(p,target,70))return;
 if(target.kind==='crate'){
  let key=room(p)+':'+target.id,now=Date.now();if(crateClaims.get(key)>now){send(p.ws,{type:'notice',text:'상자 재생성까지 '+Math.ceil((crateClaims.get(key)-now)/1000)+'초'});return;}
  crateClaims.set(key,now+COOLDOWN);let opts=String(target.items||'아몬드 워터, 붕대, 야광막대').split(',').map(x=>x.trim()).filter(Boolean);let item=opts[Math.floor(Math.random()*opts.length)]||'아몬드 워터';if(p.inv.length>=12){send(p.ws,{type:'notice',text:'인벤토리가 가득 찼습니다'});crateClaims.delete(key);return;}if(Math.random()<.38)item=RARE_LOOT[Math.floor(Math.random()*RARE_LOOT.length)];p.inv.push(item);send(p.ws,{type:'inventory',items:p.inv});send(p.ws,{type:'notice',text:'상자에서 '+item+' 획득! (100초 후 재생성)'});broadcast(p.level,{type:'crate',id:target.id,until:now+COOLDOWN});return;
 }
 if(target.kind==='trigger'){
  let r=target.requiresAction||'interact';if(r==='jump_10'){p.jumps=p.jumps||{};if((p.jumps[target.id]||0)<10){send(p.ws,{type:'notice',text:'소금물 위에서 점프 '+(p.jumps[target.id]||0)+'/10 (Space)'});return;}}
  if(target.chance<100&&Math.random()*100>=target.chance){send(p.ws,{type:'notice',text:'아직 이 통로는 열리지 않았습니다.'});return;}
  switchLevel(p,target);return;
 }
}

const RARE_LOOT=['고철','배터리','구리선','에너지 셀','응급 키트','소음 유인기','생명체 감지기'];
const RECIPES={
 '응급 키트':{'붕대':1,'아몬드 워터':1},
 '소음 유인기':{'고철':1,'배터리':1},
 '생명체 감지기':{'구리선':1,'배터리':1},
 '야광막대':{'고철':1,'에너지 셀':1}
};
function sendJournal(p){send(p.ws,{type:'journal',discovered:p.discovered||[0],eventLog:(p.eventLog||[]).slice(-30),recipes:Object.keys(RECIPES)});}
function gainItem(p,item){if(p.inv.length>=12)return false;p.inv.push(item);send(p.ws,{type:'inventory',items:p.inv});return true;}
function performEvent(p){
 if(p.dead||p.downed)return;
 const opts=LEVEL_EVENTS[p.level]||LEVEL_EVENTS[0],selected=opts[Math.floor(Math.random()*opts.length)];
 const [title,description,kind]=selected;
 if(kind==='hazard'){p.hp=Math.max(1,p.hp-(5+Math.round(Math.random()*11)));p.san=Math.max(0,p.san-5);}
 if(kind==='echo'||kind==='hallucination'){p.san=Math.max(0,p.san-(kind==='hallucination'?10:4));}
 if(kind==='slow'||kind==='dark'||kind==='flicker'){p.eventEffect={kind,until:Date.now()+8000};}
 if(kind==='ambush'&&zone(p.level,p.x,p.y)!=='safe'){
  const key=room(p),arr=entities.get(key)||[];if(arr.length<10){spawnEntity(p,key,arr);entities.set(key,arr);}
 }
 if(kind==='loot'&&Math.random()<.72){const item=RARE_LOOT[Math.floor(Math.random()*RARE_LOOT.length)];if(gainItem(p,item))send(p.ws,{type:'notice',text:'발견한 물품: '+item});}
 if(kind==='journal')p.san=Math.min(100,p.san+4);
 p.eventLog.push({level:p.level,title,at:Date.now()});p.eventLog=p.eventLog.slice(-30);
 send(p.ws,{type:'world_event',title,text:description,kind,duration:kind==='dark'||kind==='flicker'||kind==='hallucination'?8000:5000});
 sendJournal(p);
}
function tickWorld(){
 const now=Date.now();
 for(const p of clients.values()){
  if(p.dead)continue;
  if(p.downed){if(now>=p.downedUntil)dead(p,'동료가 구조하기 전에 의식을 잃었습니다.');continue;}
  const z=zone(p.level,p.x,p.y);
  if(z==='safe'){p.hp=Math.min(100,p.hp+.35);p.san=Math.min(100,p.san+.6);}
  else{p.san=Math.max(0,p.san-(z==='danger'?.20:.045)-(p.level===6?.13:0));}
  if(p.level===14){p.hp=Math.max(0,p.hp-.5);p.san=Math.max(0,p.san-1.2);if(p.hp<=0)dead(p,'Level 14에서 생명이 다했습니다.');}
  if(p.san<20&&Math.random()<.035)send(p.ws,{type:'hallucination',text:'누군가 바로 뒤에 서 있는 것 같습니다.'});
  if(!p.nextEvent)p.nextEvent=now+12000;
  if(now>=p.nextEvent){p.nextEvent=now+27000+Math.random()*27000;performEvent(p);}
 }
}
function downPlayer(p,reason){
 if(p.downed||p.dead)return;
 if(p.level===0){dead(p,reason);return;}
 p.hp=0;p.downed=true;p.downedUntil=Date.now()+18000;p.downedReason=reason;
 send(p.ws,{type:'downed',reason,remaining:18});
 broadcast(p.level,{type:'event',text:p.nick+'이(가) 쓰러졌습니다. 가까이에서 E키로 구조하세요.'});
}
function craft(p,item){
 const recipe=RECIPES[item];if(!recipe){send(p.ws,{type:'notice',text:'알 수 없는 제작법'});return;}
 if(p.inv.length>=12){send(p.ws,{type:'notice',text:'가방이 가득 찼습니다.'});return;}
 for(const [material,count] of Object.entries(recipe))if(p.inv.filter(x=>x===material).length<count){send(p.ws,{type:'notice',text:material+'이(가) 부족합니다.'});return;}
 for(const [material,count] of Object.entries(recipe))for(let i=0;i<count;i++)p.inv.splice(p.inv.indexOf(material),1);
 gainItem(p,item);send(p.ws,{type:'notice',text:item+' 제작 성공'});persist(p);
}
function tradeOffer(p,msg){
 if(p.level===0||p.downed)return;
 let target=clients.get(String(msg.target||''));
 if(!target||target===p||target.level!==p.level||target.dead||target.downed||Math.hypot(target.x-p.x,target.y-p.y)>85)return;
 const idx=Number(msg.index),item=p.inv[idx];if(idx<1||!Number.isInteger(idx)||!item)return;
 target.trade={from:p.id,item,until:Date.now()+20000};
 send(target.ws,{type:'trade_offer',from:p.nick,fromId:p.id,item});
 send(p.ws,{type:'notice',text:target.nick+'에게 '+item+' 교환 요청을 보냈습니다.'});
}
function tradeAccept(p,msg){
 const offer=p.trade;p.trade=null;if(!offer||offer.from!==String(msg.from||'')||Date.now()>offer.until)return;
 const giver=clients.get(offer.from);if(!giver||giver.level!==p.level||Math.hypot(giver.x-p.x,giver.y-p.y)>85||p.inv.length>=12)return;
 const n=giver.inv.indexOf(offer.item,1);if(n<1)return;
 giver.inv.splice(n,1);gainItem(p,offer.item);send(giver.ws,{type:'inventory',items:giver.inv});
 send(giver.ws,{type:'notice',text:p.nick+'에게 '+offer.item+'을(를) 전달했습니다.'});
 persist(p);persist(giver);
}
function revive(p,msg){
 if(p.downed||p.dead||p.level===0)return;
 let target=clients.get(String(msg.target||''));
 if(!target||!target.downed||target.level!==p.level||Math.hypot(target.x-p.x,target.y-p.y)>72)return;
 target.downed=false;target.hp=28;target.san=Math.max(15,target.san);
 send(target.ws,{type:'revived',text:p.nick+'이(가) 구조했습니다.'});send(p.ws,{type:'notice',text:target.nick+' 구조 성공!'});
 persist(target);
}
function onMessage(p,raw){if(raw.length>1500)return;let m;try{m=JSON.parse(raw)}catch{return}const now=Date.now();if(m.type==='move'&&!p.dead&&!p.downed){const delta=Math.max(0,Math.min(now-p.lastMove,120));p.lastMove=now;let dx=Math.max(-1,Math.min(1,+m.dx||0)),dy=Math.max(-1,Math.min(1,+m.dy||0));if(dx||dy){const mult=p.eventEffect?.kind==='slow'&&p.eventEffect.until>now?.62:1;move(p,dx,dy,delta*mult);}const z=zone(p.level,p.x,p.y);if(z==='dead'){p.deadz+=delta;if(p.deadz>=1000)dead(p,'데드존에 1초 동안 머물렀습니다.')}else p.deadz=0;return;}
 if(m.type==='interact'&&!p.dead&&!p.downed){interact(p,m);persist(p);}
 if(m.type==='jump'&&!p.dead){for(const o of MAPS[p.level].objects)if(o.kind==='trigger'&&o.requiresAction==='jump_10'&&near(p,o,60)){p.jumps=p.jumps||{};p.jumps[o.id]=(p.jumps[o.id]||0)+1;if(p.jumps[o.id]>=10)switchLevel(p,o);}}
 if(m.type==='chat'&&!p.dead&&p.level!==0&&now-p.lastChat>550){p.lastChat=now;let body=String(m.text||'').trim().slice(0,140);if(body)broadcast(p.level,{type:'chat',from:p.nick,text:body});}
 if(m.type==='journal')sendJournal(p);
 if(m.type==='craft'&&!p.dead&&!p.downed)craft(p,String(m.item||''));
 if(m.type==='trade_offer'&&!p.dead)tradeOffer(p,m);
 if(m.type==='trade_accept'&&!p.dead)tradeAccept(p,m);
 if(m.type==='revive'&&!p.dead)revive(p,m);
 if(m.type==='drop'&&!p.dead){let n=+m.index;if(!Number.isInteger(n)||n<1||n>=p.inv.length)return;let item=p.inv.splice(n,1)[0];let key=room(p),arr=drops.get(key)||[];if(arr.length>80)arr.shift();let itemDrop={id:id(),item,x:p.x+20,y:p.y+20,created:now};arr.push(itemDrop);drops.set(key,arr);send(p.ws,{type:'inventory',items:p.inv});}
 if(m.type==='pickup'&&!p.dead){let key=room(p),arr=drops.get(key)||[],o=arr.find(v=>v.id===m.id);if(!o||Math.hypot(p.x-o.x,p.y-o.y)>52||p.inv.length>=12)return;p.inv.push(o.item);drops.set(key,arr.filter(v=>v.id!==o.id));send(p.ws,{type:'inventory',items:p.inv});}
 if(m.type==='use'&&!p.dead){let n=+m.index;if(!Number.isInteger(n)||n<1||n>=p.inv.length)return;let item=p.inv[n];if(item.includes('아몬드')||item.includes('붕대')||item.includes('의료')||item.includes('응급')){p.hp=Math.min(100,p.hp+(item==='응급 키트'?55:25));p.san=Math.min(100,p.san+(item==='응급 키트'?25:10));p.inv.splice(n,1);send(p.ws,{type:'inventory',items:p.inv});}else if(item.includes('야광막대')){let key=room(p),arr=drops.get(key)||[];arr.push({id:id(),item:'발광 야광막대',x:p.x,y:p.y,light:true,created:now});drops.set(key,arr);p.inv.splice(n,1);send(p.ws,{type:'inventory',items:p.inv});}else if(item==='소음 유인기'){
  let key=room(p),arr=entities.get(key)||[];
  for(const e of arr)if(Math.hypot(e.x-p.x,e.y-p.y)<480){e.x+=Math.cos(Math.random()*6.28)*135;e.y+=Math.sin(Math.random()*6.28)*135;}
  p.inv.splice(n,1);send(p.ws,{type:'inventory',items:p.inv});send(p.ws,{type:'notice',text:'소음 유인기를 작동시켜 엔티티를 흩뜨렸습니다.'});
 }else if(item==='생명체 감지기'){
  p.san=Math.max(0,p.san-1);send(p.ws,{type:'notice',text:'반경 15m에 생명체 '+(entities.get(room(p))||[]).filter(e=>Math.hypot(e.x-p.x,e.y-p.y)<480).length+'개가 감지됩니다.'});
 }else send(p.ws,{type:'notice',text:item+' 사용 효과는 후속 업데이트 예정'});}
}
const server=http.createServer((req,res)=>{if(req.url==='/api/health'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,online:clients.size,version:'0.1-alpha',instance:'local'}));return;}res.writeHead(404);res.end('Not found')});
const wss=new WebSocketServer({server});
wss.on('connection',ws=>{
 let p=null,pending=false,attempts=0;
 const timeout=setTimeout(()=>{if(!p)ws.close()},20000);
 ws.on('message',async data=>{
  if(!p){
   if(pending)return;if(++attempts>6){ws.close();return;}
   let a;try{a=JSON.parse(data.toString())}catch{return}
   if(!['register','login','session'].includes(a.type))return;
   pending=true;
   try{
    const auth=await authenticate(a),old=await redis.get(SAVE_PREFIX+auth.name),saved=old?normalizedSave(JSON.parse(old)):emptySave();
    const uid=id();if(!await reserveSeat(uid))throw Error('서버 정원 40명입니다.');
    clearTimeout(timeout);
    p={id:uid,account:auth.name,ws,nick:label(a.nick||saved.nick||auth.name),color:/^#[0-9a-fA-F]{6}$/.test(a.color)?a.color:(saved.color||'#94c8da'),
      x:saved.x,y:saved.y,level:saved.level,hp:saved.hp,san:saved.san,inv:saved.inv,
      lastMove:Date.now(),lastChat:0,deadz:0,dead:false,downed:false,discovered:saved.discovered||[0],visited:saved.visited||[0],eventLog:saved.eventLog||[],nextEvent:Date.now()+12000,saveBusy:false};
    clients.set(uid,p);
    const priorZone=zone(p.level,p.x,p.y);
    let offlineDead=false;
    if(saved.dead||priorZone==='danger'||(priorZone==='caution'&&old&&Math.random()<.15)){offlineDead=true;}
    if(offlineDead){const history={discovered:[...p.discovered],visited:[...p.visited],eventLog:[...p.eventLog]};Object.assign(p,emptySave(),history);await persist(p);}
    send(ws,{type:'welcome',id:uid,level:p.level,mapCount:21,items:p.inv,token:auth.token,account:auth.name,
      restored:!!old,offlineDead});
    send(ws,{type:'level',level:p.level,x:p.x,y:p.y});sendJournal(p);
    if(offlineDead)send(ws,{type:'notice',text:'이전 탐험에서 사망했습니다. Level 0에서 새로 시작합니다.'});
    else if(p.level!==0)broadcast(p.level,{type:'join',player:sprite(p)},ws);
    return;
   }catch(e){send(ws,{type:'auth_error',text:e.message||'로그인에 실패했습니다.'});}
   finally{pending=false;}
   return;
  }
  onMessage(p,data.toString());
 });
 ws.on('close',()=>{clearTimeout(timeout);if(p){clients.delete(p.id);releaseSeat(p.id);broadcast(p.level,{type:'leave',id:p.id});persist(p);}});
 ws.on('error',()=>{});
});
setInterval(snapshot,120);
setInterval(tickEntities,250);
setInterval(tickWorld,1000);
setInterval(()=>{if(clients.size&&redisReady)publish({type:'snapshot',players:[...clients.values()].map(sprite)});},450);
setInterval(()=>{if(!clients.size||!redisReady)return;let args=[];for(const p of clients.values())args.push(Date.now()+25000,p.id);redis.zadd('noclip:presence',...args).catch(()=>{});},10000);
setInterval(()=>{for(const p of clients.values())persist(p);},15000);
setInterval(()=>{let cutoff=Date.now()-120000;for(const [key,arr] of drops){drops.set(key,arr.filter(d=>!d.light||d.created>cutoff));}for(const p of clients.values()){if(p.dead)continue;const delta=1000;if(zone(p.level,p.x,p.y)==='dead'){p.deadz+=delta;if(p.deadz>=1000)dead(p,'데드존에서 사망했습니다.')}/* Level 14 degeneration is handled once by tickWorld. */}},1000);
if(require.main===module){server.listen(process.env.PORT||3000,()=>console.log('NOCLIP ONLINE listening'));}
module.exports=server;
