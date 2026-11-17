'use strict';
const http=require('http'), {WebSocketServer}=require('ws'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.join(__dirname,'..','public');
const MAPS=Array.from({length:21},(_,i)=>JSON.parse(fs.readFileSync(path.join(ROOT,'maps',i+'.json'),'utf8')));
const FLOORS=MAPS.map(m=>new Set(m.floors));
const clients=new Map(),crateClaims=new Map(),drops=new Map(),entities=new Map();
const MAX=40,SPEED=170,COOLDOWN=100000;

const INSTANCE=id(), remoteStates=new Map();
let redis=null, sub=null, redisReady=false;
if(process.env.REDIS_URL){
 try {
 const Redis=require('ioredis');
 redis=new Redis(process.env.REDIS_URL,{lazyConnect:true,maxRetriesPerRequest:1,connectTimeout:6000});
 sub=new Redis(process.env.REDIS_URL,{lazyConnect:true,maxRetriesPerRequest:null,connectTimeout:6000});
 redis.on('error',e=>console.error('redis',e.message));
 sub.on('error',e=>console.error('redis subscribe',e.message));
 Promise.all([redis.connect(),sub.connect()]).then(async()=>{await sub.subscribe('noclip:live');redisReady=true;}).catch(e=>console.error('Redis connect',e.message));
 sub.on('message',(_,raw)=>{let msg;try{msg=JSON.parse(raw)}catch{return}if(msg.instance===INSTANCE)return;
 if(msg.type==='snapshot')remoteStates.set(msg.instance,{at:Date.now(),players:msg.players||[]});
 if(msg.type==='relay')broadcast(msg.level,msg.payload,null,false);
 });
 }catch(e){console.error('Redis initialize',e.message)}
}
function publish(m){if(redisReady)redis.publish('noclip:live',JSON.stringify({...m,instance:INSTANCE})).catch(()=>{});}
const reserveScript="redis.call('ZREMRANGEBYSCORE',KEYS[1],'-inf',ARGV[1]);if redis.call('ZCARD',KEYS[1])>=tonumber(ARGV[3]) then return 0 end;redis.call('ZADD',KEYS[1],ARGV[2],ARGV[4]);redis.call('EXPIRE',KEYS[1],60);return 1";
async function reserveSeat(uid){if(!redisReady)return clients.size<MAX;try{return Number(await redis.eval(reserveScript,1,'noclip:presence',Date.now(),Date.now()+25000,MAX,uid))===1}catch(e){console.error('reserve seat',e.message);return clients.size<MAX}}
function releaseSeat(uid){if(redisReady)redis.zrem('noclip:presence',uid).catch(()=>{});}
function remotePeers(l){if(l===0)return[];let now=Date.now(),out=[];for(const [id,r] of remoteStates){if(now-r.at>3000){remoteStates.delete(id);continue}out.push(...r.players.filter(p=>p.level===l))}return out;}

function id(){return crypto.randomBytes(6).toString('hex')}
function send(ws,o){if(ws.readyState===1)ws.send(JSON.stringify(o));}
function label(t){return String(t||'방랑자').replace(/[<>]/g,'').trim().slice(0,16)||'방랑자';}
function floor(l,x,y){return FLOORS[l].has(`${Math.floor(x/32)},${Math.floor(y/32)}`)}
function zone(l,x,y){const m=MAPS[l];let z=m.defaultZone||'caution';for(const a of m.zones||[]){if(x>=a.x&&y>=a.y&&x<a.x+a.w&&y<a.y+a.h)z=a.kind;}return z;}
function sprite(p){return {id:p.id,nick:p.nick,color:p.color,x:Math.round(p.x),y:Math.round(p.y),level:p.level,hp:Math.ceil(p.hp),san:Math.ceil(p.san)};}
function broadcast(l,obj,exclude,relay=true){if(l===0)return;for(const p of clients.values())if(p.level===l&&p.ws!==exclude)send(p.ws,obj);if(relay)publish({type:'relay',level:l,payload:obj});}
function snapshot(){for(const p of clients.values()){if(p.ws.readyState!==1)continue;let peers=p.level===0?[]:[...clients.values()].filter(q=>q.level===p.level&&q!==p).map(sprite).concat(remotePeers(p.level));let roomDrops=p.level===0?(drops.get('0:'+p.id)||[]):(drops.get(String(p.level))||[]);let e=p.level===0?(entities.get('0:'+p.id)||[]):(entities.get(String(p.level))||[]);send(p.ws,{type:'state',you:sprite(p),peers,online:clients.size+[...remoteStates.values()].reduce((a,v)=>a+(Date.now()-v.at<3000?v.players.length:0),0),zone:zone(p.level,p.x,p.y),drops:roomDrops,entities:e});}}
function room(p){return p.level===0?'0:'+p.id:String(p.level)}
function near(p,obj,r=62){return Math.hypot(p.x-(obj.x+(obj.w||0)/2),p.y-(obj.y+(obj.h||0)/2))<r;}
function move(p,dx,dy,ms){let d=Math.hypot(dx,dy)||1,delta=Math.max(0,Math.min(0.2,ms/1000));let mx=dx/d*delta*SPEED,my=dy/d*delta*SPEED;const r=9;let X=p.x+mx,Y=p.y+my;if(floor(p.level,X-r,p.y-r)&&floor(p.level,X+r,p.y+r)&&floor(p.level,X-r,p.y+r)&&floor(p.level,X+r,p.y-r))p.x=X;if(floor(p.level,p.x-r,Y-r)&&floor(p.level,p.x+r,Y+r)&&floor(p.level,p.x-r,Y+r)&&floor(p.level,p.x+r,Y-r))p.y=Y;}
function dead(p,reason){if(p.dead)return;p.dead=true;send(p.ws,{type:'dead',reason});broadcast(p.level,{type:'event',text:p.nick+'이(가) 사망했습니다.'},p.ws);}
function switchLevel(p,t){const dest=+t.targetLevel;if(!Number.isInteger(dest)||dest<0||dest>20)return;const m=MAPS[dest];broadcast(p.level,{type:'leave',id:p.id});p.level=dest;p.x=Number(t.targetX)||m.spawn.x;p.y=Number(t.targetY)||m.spawn.y;if(!floor(dest,p.x,p.y)){p.x=m.spawn.x;p.y=m.spawn.y;}p.deadz=0;send(p.ws,{type:'level',level:dest,x:p.x,y:p.y,trigger:t.condition||t.label});broadcast(dest,{type:'join',player:sprite(p)},p.ws);}
function interact(p,msg){const m=MAPS[p.level];const target=m.objects.find(o=>o.id===msg.id);if(!target||!near(p,target,70))return;
 if(target.kind==='crate'){
  let key=room(p)+':'+target.id,now=Date.now();if(crateClaims.get(key)>now){send(p.ws,{type:'notice',text:'상자 재생성까지 '+Math.ceil((crateClaims.get(key)-now)/1000)+'초'});return;}
  crateClaims.set(key,now+COOLDOWN);let opts=String(target.items||'아몬드 워터, 붕대, 야광막대').split(',').map(x=>x.trim()).filter(Boolean);let item=opts[Math.floor(Math.random()*opts.length)]||'아몬드 워터';if(p.inv.length>=12){send(p.ws,{type:'notice',text:'인벤토리가 가득 찼습니다'});crateClaims.delete(key);return;}p.inv.push(item);send(p.ws,{type:'inventory',items:p.inv});send(p.ws,{type:'notice',text:'상자에서 '+item+' 획득! (100초 후 재생성)'});broadcast(p.level,{type:'crate',id:target.id,until:now+COOLDOWN});return;
 }
 if(target.kind==='trigger'){
  let r=target.requiresAction||'interact';if(r==='jump_10'){p.jumps=p.jumps||{};if((p.jumps[target.id]||0)<10){send(p.ws,{type:'notice',text:'소금물 위에서 점프 '+(p.jumps[target.id]||0)+'/10 (Space)'});return;}}
  if(target.chance<100&&Math.random()*100>=target.chance){send(p.ws,{type:'notice',text:'아직 이 통로는 열리지 않았습니다.'});return;}
  switchLevel(p,target);return;
 }
}
function onMessage(p,raw){if(raw.length>1500)return;let m;try{m=JSON.parse(raw)}catch{return}const now=Date.now();if(m.type==='move'&&!p.dead){const delta=Math.max(0,Math.min(now-p.lastMove,120));p.lastMove=now;let dx=Math.max(-1,Math.min(1,+m.dx||0)),dy=Math.max(-1,Math.min(1,+m.dy||0));if(dx||dy)move(p,dx,dy,delta);const z=zone(p.level,p.x,p.y);if(z==='dead'){p.deadz+=delta;if(p.deadz>=1000)dead(p,'데드존에 1초 동안 머물렀습니다.')}else p.deadz=0;if(p.level===14){p.hp-=delta/1000*.5;p.san-=delta/1000*1.2;if(p.hp<=0)dead(p,'Level 14에서 서서히 생명이 다했습니다.')}return;}
 if(m.type==='interact'&&!p.dead)interact(p,m);
 if(m.type==='jump'&&!p.dead){for(const o of MAPS[p.level].objects)if(o.kind==='trigger'&&o.requiresAction==='jump_10'&&near(p,o,60)){p.jumps=p.jumps||{};p.jumps[o.id]=(p.jumps[o.id]||0)+1;if(p.jumps[o.id]>=10)switchLevel(p,o);}}
 if(m.type==='chat'&&!p.dead&&p.level!==0&&now-p.lastChat>550){p.lastChat=now;let body=String(m.text||'').trim().slice(0,140);if(body)broadcast(p.level,{type:'chat',from:p.nick,text:body});}
 if(m.type==='drop'&&!p.dead){let n=+m.index;if(!Number.isInteger(n)||n<1||n>=p.inv.length)return;let item=p.inv.splice(n,1)[0];let key=room(p),arr=drops.get(key)||[];if(arr.length>80)arr.shift();let itemDrop={id:id(),item,x:p.x+20,y:p.y+20,created:now};arr.push(itemDrop);drops.set(key,arr);send(p.ws,{type:'inventory',items:p.inv});}
 if(m.type==='pickup'&&!p.dead){let key=room(p),arr=drops.get(key)||[],o=arr.find(v=>v.id===m.id);if(!o||Math.hypot(p.x-o.x,p.y-o.y)>52||p.inv.length>=12)return;p.inv.push(o.item);drops.set(key,arr.filter(v=>v.id!==o.id));send(p.ws,{type:'inventory',items:p.inv});}
 if(m.type==='use'&&!p.dead){let n=+m.index;if(!Number.isInteger(n)||n<1||n>=p.inv.length)return;let item=p.inv[n];if(item.includes('아몬드')||item.includes('붕대')||item.includes('의료')){p.hp=Math.min(100,p.hp+25);p.san=Math.min(100,p.san+10);p.inv.splice(n,1);send(p.ws,{type:'inventory',items:p.inv});}else if(item.includes('야광막대')){let key=room(p),arr=drops.get(key)||[];arr.push({id:id(),item:'발광 야광막대',x:p.x,y:p.y,light:true,created:now});drops.set(key,arr);p.inv.splice(n,1);send(p.ws,{type:'inventory',items:p.inv});}else send(p.ws,{type:'notice',text:item+' 사용 효과는 후속 업데이트 예정'});}
}
const server=http.createServer((req,res)=>{if(req.url==='/api/health'){res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({ok:true,online:clients.size,version:'0.1-alpha',instance:'local'}));return;}res.writeHead(404);res.end('Not found')});
const wss=new WebSocketServer({server});
wss.on('connection',ws=>{let p=null;if(clients.size>=MAX){send(ws,{type:'full',text:'서버 정원 40명입니다.'});ws.close();return}const timeout=setTimeout(()=>{if(!p)ws.close()},8000);
 ws.on('message',async data=>{if(!p){let a;try{a=JSON.parse(data.toString())}catch{return}if(a.type!=='join')return;clearTimeout(timeout);let uid=id(),m=MAPS[0];if(!await reserveSeat(uid)){send(ws,{type:'full',text:'서버 정원 40명입니다.'});ws.close();return;}p={id:uid,ws,nick:label(a.nick),color:/^#[0-9a-fA-F]{6}$/.test(a.color)?a.color:'#94c8da',x:m.spawn.x,y:m.spawn.y,level:0,hp:100,san:100,inv:['인포머'],lastMove:Date.now(),lastChat:0,deadz:0,dead:false};clients.set(uid,p);send(ws,{type:'welcome',id:uid,level:0,mapCount:21,items:p.inv});send(ws,{type:'level',level:0,x:p.x,y:p.y});return}onMessage(p,data.toString())});
 ws.on('close',()=>{clearTimeout(timeout);if(p){clients.delete(p.id);releaseSeat(p.id);broadcast(p.level,{type:'leave',id:p.id});}});ws.on('error',()=>{});
});
setInterval(snapshot,120);
setInterval(()=>{if(clients.size&&redisReady)publish({type:'snapshot',players:[...clients.values()].map(sprite)});},450);
setInterval(()=>{if(!clients.size||!redisReady)return;let args=[];for(const p of clients.values())args.push(Date.now()+25000,p.id);redis.zadd('noclip:presence',...args).catch(()=>{});},10000);
setInterval(()=>{let cutoff=Date.now()-120000;for(const [key,arr] of drops){drops.set(key,arr.filter(d=>!d.light||d.created>cutoff));}for(const p of clients.values()){if(p.dead)continue;const delta=1000;if(zone(p.level,p.x,p.y)==='dead'){p.deadz+=delta;if(p.deadz>=1000)dead(p,'데드존에서 사망했습니다.')}if(p.level===14){p.hp-=.5;p.san-=1.2;if(p.hp<=0)dead(p,'Level 14에서 서서히 사망했습니다.')}}},1000);
if(require.main===module){server.listen(process.env.PORT||3000,()=>console.log('NOCLIP ONLINE listening'));}
module.exports=server;
