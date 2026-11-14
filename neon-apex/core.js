export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const mix=(a,b,t)=>a+(b-a)*t;
export const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const anchors=[[0,-190],[140,-170],[230,-90],[210,50],[280,160],[150,260],[-20,230],[-120,300],[-260,210],[-220,70],[-290,-40],[-190,-180]];
function cat(a,b,c,d,t){return .5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);}
export const track=[];let length=0;
for(let j=0;j<anchors.length;j++)for(let k=0;k<48;k++){
 const n=anchors.length,p=[-1,0,1,2].map(i=>anchors[(j+i+n)%n]);
 const t=k/48,x=cat(p[0][0],p[1][0],p[2][0],p[3][0],t),z=cat(p[0][1],p[1][1],p[2][1],p[3][1],t);
 if(track.length)length+=Math.hypot(x-track.at(-1).x,z-track.at(-1).z);
 track.push({x,z,s:length});
}
export const trackLength=length+Math.hypot(track[0].x-track.at(-1).x,track[0].z-track.at(-1).z);
track.forEach((p,i)=>{const q=track[(i+1)%track.length],dx=q.x-p.x,dz=q.z-p.z,d=Math.hypot(dx,dz);p.tx=dx/d;p.tz=dz/d;p.nx=-p.tz;p.nz=p.tx;p.yaw=Math.atan2(p.tx,p.tz);});
export function atDistance(s){s=((s%trackLength)+trackLength)%trackLength;let i=0;while(i<track.length-1&&track[i+1].s<s)i++;const a=track[i],b=track[(i+1)%track.length],end=i===track.length-1?trackLength:b.s,t=(s-a.s)/(end-a.s);return {...a,x:mix(a.x,b.x,t),z:mix(a.z,b.z,t),s};}
export function nearest(x,z){let best=null,d2=Infinity;for(let i=0;i<track.length;i++){const a=track[i],b=track[(i+1)%track.length],dx=b.x-a.x,dz=b.z-a.z,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1),px=a.x+dx*t,pz=a.z+dz*t,d=(x-px)**2+(z-pz)**2;if(d<d2){d2=d;best={...a,x:px,z:pz,s:a.s+t*Math.hypot(dx,dz),offset:(x-px)*a.nx+(z-pz)*a.nz,index:i};}}return {...best,distance:Math.sqrt(d2),progress:best.s/trackLength};}
export function makeCar(){const p=atDistance(2);return {x:p.x,z:p.z,yaw:p.yaw,vx:0,vz:0,speed:0,steer:0,nitro:1,slip:0,boost:false,impact:0};}
export function stepCar(c,input,dt){
 dt=clamp(dt,0,.025);let fwd=c.vx*Math.sin(c.yaw)+c.vz*Math.cos(c.yaw),side=c.vx*Math.cos(c.yaw)-c.vz*Math.sin(c.yaw);
 const gas=input.gas?1:0,brake=input.brake?1:0,drifting=input.drift&&Math.abs(fwd)>9;
 c.steer=mix(c.steer,input.turn,1-Math.exp(-dt*9));
 c.boost=!!input.boost&&c.nitro>.015&&gas>0&&fwd>0;
 c.nitro=clamp(c.nitro+(c.boost?-.24:.095)*dt,0,1);
 const force=gas*21-(brake?(fwd>1?43:12):0)+(c.boost?24:0);
 fwd+=force*dt;fwd*=Math.exp(-(.10+(drifting?.13:0))*dt);fwd=clamp(fwd,-11,c.boost?91:69);
 side*=Math.exp(-(drifting?1.25:6.5)*dt);
 c.vx=Math.sin(c.yaw)*fwd+Math.cos(c.yaw)*side;c.vz=Math.cos(c.yaw)*fwd-Math.sin(c.yaw)*side;
 c.yaw+=c.steer*(fwd/(15+Math.abs(fwd)*.7))*(drifting?1.15:.72)*dt;
 c.x+=c.vx*dt;c.z+=c.vz*dt;
 const road=nearest(c.x,c.z);
 c.impact=Math.max(0,c.impact-dt*3);
 if(road.distance>8.2){c.vx*=Math.exp(-dt*.9);c.vz*=Math.exp(-dt*.9);}
 if(road.distance>10.2){const sign=Math.sign(road.offset)||1;c.x=road.x+road.nx*10.1*sign;c.z=road.z+road.nz*10.1*sign;const outward=c.vx*road.nx*sign+c.vz*road.nz*sign;if(outward>0){c.vx-=road.nx*sign*outward*1.25;c.vz-=road.nz*sign*outward*1.25;c.vx*=.83;c.vz*=.83;c.impact=1;}}
 c.speed=Math.hypot(c.vx,c.vz);c.slip=Math.abs(angleDiff(Math.atan2(c.vx,c.vz),c.yaw))*(c.speed>7?1:0);return road;
}
export class LapTracker{
 constructor(){this.reset();}reset(){this.last=2/trackLength;this.checkpoint=0;this.covered=0;}
 update(progress){let d=progress-this.last;if(d<-.5)d++;if(d>.5)d--;this.last=progress;if(Math.abs(d)>.08)return false;this.covered+=d;
 if(d>0&&progress>=(this.checkpoint+1)*.25&&progress<(this.checkpoint+1)*.25+.08&&this.checkpoint<3)this.checkpoint++;
 if(d>0&&progress<.08&&this.checkpoint===3&&this.covered>.92){this.checkpoint=0;this.covered=progress;return true;}return false;
 }
}
export function formatTime(seconds){if(!Number.isFinite(seconds))return '—';const ms=Math.floor(Math.max(0,seconds)*1000);return `${String(Math.floor(ms/60000)).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;}
