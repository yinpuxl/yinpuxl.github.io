import {clamp,mix,angleDiff,track,trackLength,atDistance,nearest,makeCar,stepCar,LapTracker,formatTime} from './core.js';
import {Renderer} from './render.js';
const $=id=>document.getElementById(id), show=(id,yes=true)=>$(id).classList.toggle('hidden',!yes);
let renderer;
try{renderer=new Renderer($('world'));}catch(e){show('error');console.error(e);throw e;}
let state='menu',car=makeCar(),tracker=new LapTracker(),keys=new Set(),count=3,lapTime=0,totalTime=0,lapTimes=[],sampleTime=0,samples=[],trails=[],elapsed=0,toastUntil=0;
let best=null,saveAvailable=true;
try{const b=JSON.parse(localStorage.getItem('neon-apex-best-v1'));if(b&&Number.isFinite(b.time)&&b.time>10&&Array.isArray(b.samples)&&b.samples.length>2&&b.samples.length<20000&&b.samples.every(p=>Array.isArray(p)&&p.length===4&&p.every(Number.isFinite))&&b.samples.every((p,i)=>i===0||p[0]>b.samples[i-1][0]))best=b;}catch{saveAvailable=false;}
const camera={eye:[0,5,0],target:[0,1,0],fov:1.03};let soundEnabled=false,audio=null,osc=null,gain=null,recordNew=false;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
function soundInit(){if(audio)return;const C=window.AudioContext||window.webkitAudioContext;if(!C)return;audio=new C();osc=audio.createOscillator();gain=audio.createGain();osc.type='sawtooth';gain.gain.value=0;const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=580;osc.connect(filter);filter.connect(gain);gain.connect(audio.destination);osc.start();}
function tone(f=600){if(!soundEnabled||!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.value=f;g.gain.setValueAtTime(.07,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.15);o.start();o.stop(audio.currentTime+.16);}
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');toastUntil=elapsed+3.3;}
function syncBest(){$('best').textContent=best?formatTime(best.time):'—';$('menuBest').textContent=best?formatTime(best.time):'—';$('ghostLabel').textContent=best?'CYAN GHOST / 个人最佳幽灵':'首个纪录，等你创造';}
syncBest();$('length').innerHTML=(trackLength/1000).toFixed(2)+'<span> KM</span>';
function menu(){for(const id of ['pauseDialog','finish','guide'])if($(id).open)$(id).close();state='menu';keys.clear();show('menu');show('trackCard');show('bottomMenu');show('hud',false);show('touch',false);show('pause',false);show('countdown',false);document.body.classList.remove('racing');syncBest();}
function start(){for(const id of ['finish','guide','pauseDialog'])if($(id).open)$(id).close();car=makeCar();tracker.reset();lapTime=0;totalTime=0;lapTimes=[];samples=[[0,car.x,car.z,car.yaw]];sampleTime=0;count=3;oldCount=3;state='countdown';trails=[];keys.clear();recordNew=false;show('menu',false);show('trackCard',false);show('bottomMenu',false);show('hud');show('pause');show('touch',matchMedia('(pointer:coarse)').matches||innerWidth<800);show('countdown');$('countdown').textContent='3';document.body.classList.add('racing');soundInit();if(audio&&soundEnabled)audio.resume();tone(440);syncBest();updateHud();}
function pause(){if(state!=='racing'&&state!=='countdown')return;stateBeforePause=state;state='paused';keys.clear();$('pauseDialog').showModal();}
let stateBeforePause='racing';
function resume(){if(state!=='paused')return;$('pauseDialog').close();state=stateBeforePause;keys.clear();}
function recover(){if(state!=='racing')return;const p=nearest(car.x,car.z);car.x=p.x;car.z=p.z;car.yaw=p.yaw;car.vx=0;car.vz=0;car.speed=0;car.steer=0;lapTime+=3;totalTime+=3;tracker.last=p.progress;toast('已回到赛道 · 当前圈 +3 秒');}
$('start').onclick=start;$('again').onclick=start;$('reset').onclick=()=>{if(state==='racing'||state==='countdown'){start();toast('挑战已重新开始');}};
$('pause').onclick=pause;$('resume').onclick=resume;$('quit').onclick=menu;$('finishMenu').onclick=menu;
$('help').onclick=()=>$('guide').showModal();$('closeGuide').onclick=()=>$('guide').close();$('guideGo').onclick=start;
document.querySelector('.brand').onclick=e=>{e.preventDefault();if(state==='menu')return;pause();};
$('pauseDialog').addEventListener('cancel',e=>{e.preventDefault();resume();});
$('sound').onclick=()=>{soundEnabled=!soundEnabled;soundInit();if(audio&&soundEnabled)audio.resume();$('sound').textContent=soundEnabled?'声音 ON':'声音 OFF';$('sound').setAttribute('aria-label',soundEnabled?'关闭声音':'开启声音');tone();};
$('quality').onclick=()=>{renderer.high=!renderer.high;$('quality').textContent=renderer.high?'画质 HIGH':'画质 LOW';};
const gameKeys=new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyS','KeyA','KeyD','Space','ShiftLeft','ShiftRight']);
window.addEventListener('keydown',e=>{if((state==='racing'||state==='countdown')&&gameKeys.has(e.code)){e.preventDefault();keys.add(e.code);}if(e.repeat)return;if(e.code==='Escape'&&['racing','countdown','paused'].includes(state)){e.preventDefault();if(state==='paused')resume();else pause();}if(e.code==='KeyR')recover();});
window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{keys.clear();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
document.addEventListener('renderlost',()=>{pause();toast('3D 上下文暂时丢失，请刷新后重新进入');});
for(const b of document.querySelectorAll('[data-key]')){const clear=()=>{keys.delete(b.dataset.key);b.classList.remove('pressed');};b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(b.dataset.key);b.classList.add('pressed');};b.onpointerup=clear;b.onpointercancel=clear;b.onlostpointercapture=clear;}
function finishLap(){const time=lapTime;lapTimes.push(time);if(time>10&&(!best||time<best.time)){best={time,samples:samples.at(-1)[0]<time?[...samples,[time,car.x,car.z,car.yaw]]:[...samples]};recordNew=true;try{localStorage.setItem('neon-apex-best-v1',JSON.stringify(best));}catch{saveAvailable=false;}syncBest();toast('NEW PERSONAL BEST · '+formatTime(time)+(saveAvailable?'':' · 本次纪录仅在当前页面有效'));tone(960);}else{toast('LAP '+lapTimes.length+' / '+formatTime(time));tone(720);}
 lapTime=0;sampleTime=0;samples=[[0,car.x,car.z,car.yaw]];
 if(lapTimes.length===3){state='finished';keys.clear();$('finishSubtitle').textContent=(recordNew?'创造了新的个人最佳。':'每一次入弯，都离极限更近。')+' 总用时 '+formatTime(totalTime);$('lapResults').replaceChildren();lapTimes.forEach((t,i)=>{const row=document.createElement('div');row.className='result-row';const label=document.createElement('b'),value=document.createElement('span');label.textContent='LAP 0'+(i+1);value.textContent=formatTime(t);row.append(label,value);$('lapResults').append(row);});show('touch',false);show('pause',false);$('finish').showModal();}
}
function ghostAt(time){if(!best||state==='menu'||state==='countdown'||time>best.time)return null;const s=best.samples;let i=0;while(i<s.length-2&&s[i+1][0]<time)i++;const a=s[i],b=s[i+1],t=clamp((time-a[0])/(b[0]-a[0]||1),0,1);return {x:mix(a[1],b[1],t),z:mix(a[2],b[2],t),yaw:a[3]+angleDiff(b[3],a[3])*t,boost:false};}
function updateHud(){const p=nearest(car.x,car.z);$('speed').textContent=String(Math.round(car.speed*3.6)).padStart(3,'0');$('speedFill').style.width=clamp(car.speed/91*100,0,100)+'%';$('nitroFill').style.width=car.nitro*100+'%';$('nitroText').textContent=Math.round(car.nitro*100)+'%';$('timer').textContent=formatTime(lapTime);$('lap').textContent=String(Math.min(3,lapTimes.length+1)).padStart(2,'0');const sector=Math.min(2,Math.floor(p.progress*3));$('sectorLabel').textContent='SECTOR 0'+(sector+1);document.querySelectorAll('.sectors i').forEach((e,i)=>e.classList.toggle('on',i<=sector));const drifting=car.slip>.12&&car.speed>9;$('drift').textContent=car.boost?'NITRO / 氮气释放':drifting?'DRIFT / 漂移中':'GRIP / 抓地';$('drift').classList.toggle('sliding',drifting);drawMap($('map'),true);}
const bounds={minX:Math.min(...track.map(p=>p.x)),maxX:Math.max(...track.map(p=>p.x)),minZ:Math.min(...track.map(p=>p.z)),maxZ:Math.max(...track.map(p=>p.z))};
function drawMap(canvas,live=false){const g=canvas.getContext('2d'),w=canvas.width,h=canvas.height;g.clearRect(0,0,w,h);const scale=Math.min((w-30)/(bounds.maxX-bounds.minX),(h-24)/(bounds.maxZ-bounds.minZ)),px=x=>w/2+(x-(bounds.maxX+bounds.minX)/2)*scale,py=z=>h/2+(z-(bounds.maxZ+bounds.minZ)/2)*scale;g.beginPath();track.forEach((p,i)=>i?g.lineTo(px(p.x),py(p.z)):g.moveTo(px(p.x),py(p.z)));g.closePath();g.strokeStyle='#254151';g.lineWidth=5;g.stroke();g.strokeStyle='#82dcce';g.lineWidth=1.4;g.stroke();const start=track[0];g.fillStyle='#ff68aa';g.fillRect(px(start.x)-2,py(start.z)-3,4,6);if(live){const ghost=ghostAt(lapTime);if(ghost){g.beginPath();g.arc(px(ghost.x),py(ghost.z),3,0,Math.PI*2);g.fillStyle='#56a5ac';g.fill();}g.beginPath();g.arc(px(car.x),py(car.z),4,0,Math.PI*2);g.fillStyle='#fff';g.shadowColor='#a1ffee';g.shadowBlur=10;g.fill();g.shadowBlur=0;}else{g.fillStyle='#a1ffee';g.font='9px sans-serif';g.fillText('START',px(start.x)+7,py(start.z)+3);}}
drawMap($('menuMap'));
let trailClock=0,autoS=trackLength*.12,oldCount=3;
function step(dt){elapsed+=dt;trails.forEach(t=>t.age+=dt);trails=trails.filter(t=>t.age<1.6);
 if(state==='menu'){autoS+=dt*13;const p=atDistance(autoS);Object.assign(car,{x:p.x,z:p.z,yaw:p.yaw,speed:13,boost:false});}
 if(state==='countdown'){count-=dt;if(count<=0){state='racing';show('countdown',false);tone(1000);toast('GO · 三圈计时挑战');}else if(Math.ceil(count)!==oldCount){oldCount=Math.ceil(count);tone(440);}$('countdown').textContent=Math.ceil(count);}
 if(state==='racing'){
 lapTime+=dt;totalTime+=dt;const input={gas:keys.has('KeyW')||keys.has('ArrowUp'),brake:keys.has('KeyS')||keys.has('ArrowDown'),turn:(keys.has('KeyA')||keys.has('ArrowLeft')?-1:0)+(keys.has('KeyD')||keys.has('ArrowRight')?1:0),drift:keys.has('Space'),boost:keys.has('ShiftLeft')||keys.has('ShiftRight')};const p=stepCar(car,input,dt);
 sampleTime+=dt;if(sampleTime>=.1){sampleTime=0;samples.push([lapTime,car.x,car.z,car.yaw]);if(samples.length>18000)samples.splice(1,1);}
 trailClock+=dt;if(trailClock>.035&&(car.slip>.1||car.boost)&&car.speed>8){trailClock=0;for(const x of [-.85,.85])trails.push({x:car.x+x*Math.cos(car.yaw)-1.5*Math.sin(car.yaw),z:car.z-x*Math.sin(car.yaw)-1.5*Math.cos(car.yaw),yaw:car.yaw,age:0,length:Math.max(.5,car.speed*.045)});}
 if(tracker.update(p.progress))finishLap();
 }
 if(toastUntil&&elapsed>toastUntil){$('toast').classList.remove('show');toastUntil=0;}
}
let last=performance.now(),accumulator=0,hudClock=0;
function animate(now){const dt=Math.min((now-last)/1000,.1);last=now;accumulator+=dt;while(accumulator>=1/100){step(1/100);accumulator-=1/100;}
 const inMenu=state==='menu',ahead=inMenu?atDistance(autoS+28):null;
 const desiredEye=inMenu?[car.x-15*Math.sin(car.yaw)+14*Math.cos(car.yaw),7,car.z-15*Math.cos(car.yaw)-14*Math.sin(car.yaw)]:[car.x-(10.5+car.speed*.035)*Math.sin(car.yaw),5.4,car.z-(10.5+car.speed*.035)*Math.cos(car.yaw)];
 const desiredTarget=inMenu?[car.x+5*Math.sin(car.yaw),.9,car.z+5*Math.cos(car.yaw)]:[car.x+8*Math.sin(car.yaw),1.15,car.z+8*Math.cos(car.yaw)];
 const blend=1-Math.exp(-dt*(inMenu?2:6));for(let i=0;i<3;i++){camera.eye[i]=mix(camera.eye[i],desiredEye[i],blend);camera.target[i]=mix(camera.target[i],desiredTarget[i],blend);}camera.fov=mix(camera.fov,1.03+(!reduced&&car.boost?.12:0),blend);
 renderer.render(camera,car,inMenu?null:ghostAt(lapTime),trails);hudClock+=dt;if(hudClock>.04){hudClock=0;if(!inMenu)updateHud();}
 if(audio&&gain){gain.gain.setTargetAtTime(soundEnabled&&state==='racing'?.016+car.speed*.00018:0,audio.currentTime,.08);osc.frequency.setTargetAtTime(38+car.speed*2.5+(car.boost?35:0),audio.currentTime,.07);}
 requestAnimationFrame(animate);
}
const initial=atDistance(autoS);camera.eye=[initial.x-15*Math.sin(initial.yaw)+14*Math.cos(initial.yaw),7,initial.z-15*Math.cos(initial.yaw)-14*Math.sin(initial.yaw)];camera.target=[initial.x,.9,initial.z];
requestAnimationFrame(animate);
