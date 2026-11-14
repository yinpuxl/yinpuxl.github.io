import {track,nearest,atDistance,trackLength} from './core.js';
const fog=[.022,.029,.075];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const d=Math.hypot(...a);return a.map(x=>x/d);};const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
export function viewMatrix(eye,target){const z=unit(eye.map((v,i)=>v-target[i])),x=unit(cross([0,1,0],z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-dot(x,eye),-dot(y,eye),-dot(z,eye),1]);}
function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);}
function tri(out,a,b,c,color,glow=0){const normal=unit(cross(b.map((v,i)=>v-a[i]),c.map((v,i)=>v-a[i])));for(const p of [a,b,c])out.push(...p,...normal,...color,glow);}
function quad(out,a,b,c,d,color,glow=0){tri(out,a,b,c,color,glow);tri(out,a,c,d,color,glow);}
export function box(out,x,y,z,w,h,l,color,glow=0,yaw=0){const pts=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c])=>[x+a*w/2*Math.cos(yaw)+c*l/2*Math.sin(yaw),y+b*h/2,z-a*w/2*Math.sin(yaw)+c*l/2*Math.cos(yaw)]);for(const face of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]])quad(out,...face.map(i=>pts[i]),color,glow);}
let randomSeed=17;function random(){randomSeed=(randomSeed*1664525+1013904223)>>>0;return randomSeed/4294967296;}
function ribbon(out,a,b,inner,outer,y,color,glow=0){quad(out,[a.x+a.nx*inner,y,a.z+a.nz*inner],[b.x+b.nx*inner,y,b.z+b.nz*inner],[b.x+b.nx*outer,y,b.z+b.nz*outer],[a.x+a.nx*outer,y,a.z+a.nz*outer],color,glow);}
function makeWorld(){const g=[];
 box(g,0,-.55,0,2200,1,2200,[.018,.025,.048]);
 track.forEach((a,i)=>{const b=track[(i+1)%track.length];ribbon(g,a,b,-10.8,10.8,.008,[.035,.045,.07]);ribbon(g,a,b,-8,8,.02,[.055,.065,.09]);
 for(const sign of [-1,1]){ribbon(g,a,b,8*sign,8.35*sign,.035,i%8<4?[.4,.48,.52]:[.08,.11,.14]);ribbon(g,a,b,10.4*sign,10.58*sign,.15,sign===1?[.15,.85,.8]:[.95,.13,.47],1);ribbon(g,a,b,10.2*sign,10.7*sign,.025,sign===1?[.02,.13,.14]:[.15,.02,.07],.3);}
 if(i%7<3)ribbon(g,a,b,-.055,.055,.045,[.35,.48,.52],.2);
 if(i%24===0){for(const sign of [-1,1]){const x=a.x+a.nx*12*sign,z=a.z+a.nz*12*sign;box(g,x,4,z,.18,8,.18,[.12,.16,.22]);box(g,x,8,z,2,.1,.6,[.5,.95,1],1);box(g,x,.04,z,4,.02,8,[.05,.11,.14],.3,a.yaw);}}
 });
 // Start/finish gantry and checkerboard.
 const p=track[0];for(let row=0;row<2;row++)for(let j=0;j<12;j++){const s=(j-5.5)*1.3;box(g,p.x+p.nx*s+p.tx*row*.9,.055,p.z+p.nz*s+p.tz*row*.9,1.3,.02,.9,(j+row)%2?[.7,.85,.86]:[.045,.06,.1],.3,p.yaw);}
 for(const sign of [-1,1])box(g,p.x+p.nx*11*sign,5,p.z+p.nz*11*sign,.6,10,.6,[.1,.17,.23]);box(g,p.x,10,p.z,23,.7,.7,[.15,.85,.8],1,p.yaw+Math.PI/2);
 // Buildings are deliberately kept clear of the track.
 for(let i=0;i<420;i++){const x=(random()-.5)*1250,z=(random()-.5)*1250;if(nearest(x,z).distance<31)continue;const w=10+random()*24,l=10+random()*24,h=12+random()**2*150;box(g,x,h/2,z,w,h,l,[.025+random()*.025,.035+random()*.028,.075+random()*.05]);const tint=random()>.45?[.1,.55,.65]:[.62,.1,.37];
 if(i%3===0){box(g,x-w/2-.02,h/2,z,.12,h,l*.9,tint,.8);box(g,x,h+.05,z,w+.3,.12,l+.3,tint,.8);}
 for(let k=4;k<h-2;k+=5+random()*5){if(random()<.25)continue;box(g,x,k,z-l/2-.03,w*.7,.22,.04,[.2,.36,.45],.7);box(g,x+w/2+.03,k,z,.04,.2,l*.6,[.16,.28,.4],.65);}
 }
 // Hanging chevron boards at the bends.
 for(let s=70;s<trackLength;s+=125){const a=atDistance(s),b=atDistance(s+16),curve=Math.sin(b.yaw-a.yaw),side=curve>0?-1:1,x=a.x+a.nx*13*side,z=a.z+a.nz*13*side;box(g,x,2.2,z,3.8,1.25,.25,[.05,.11,.18],.1,a.yaw);for(let j=-1;j<=1;j++)box(g,x+Math.cos(a.yaw)*j*.8,2.2,z-Math.sin(a.yaw)*j*.8,.15,.7,.31,[.5,1,.82],1,a.yaw+.6*side);}
 return new Float32Array(g);
}
export function carMesh(c,ghost=false){const g=[],cy=ghost?[.12,.62,.65]:[.14,.21,.31],pink=ghost?[.12,.9,.85]:[.96,.12,.43],y=.55;
 const local=(x,z)=>[c.x+x*Math.cos(c.yaw)+z*Math.sin(c.yaw),c.z-x*Math.sin(c.yaw)+z*Math.cos(c.yaw)];
 const part=(x,h,z,w,hh,l,col,glow=0)=>{const p=local(x,z);box(g,p[0],h,p[1],w,hh,l,col,glow,c.yaw);};
 part(0,y,0,1.95,.55,4.35,cy);part(0,.43,.15,2.08,.2,4.15,[.045,.07,.12]);part(0,.91,-.35,1.65,.5,1.95,[.065,.12,.18]);part(0,1.17,-.45,1.5,.08,1.1,cy);
 part(0,.42,1.8,2.08,.1,.6,pink,.6);part(0,.34,-1.45,2.02,.06,1.25,pink,.9);
 part(0,.88,-1.84,2.28,.12,.42,[.05,.08,.13]);for(const x of [-.72,.72]){part(x,.71,-1.94,.12,.42,.12,cy);part(x,.72,2.17,.49,.1,.04,[.55,.95,1],1);part(x,.7,-2.18,.61,.09,.04,[1,.07,.2],1);}
 for(const x of [-1,1])for(const z of [-1.25,1.25]){part(x,.35,z,.3,.66,.82,[.015,.018,.03]);part(x*1.155,.35,z,.025,.32,.42,[.18,.44,.5],.4);}
 if(c.boost)for(const x of [-.55,.55])part(x,.39,-2.5-Math.random()*.4,.22,.2,.8+Math.random()*.8,[.15,.8,1],1);
 return g;
}
export class Renderer{
 constructor(canvas){this.canvas=canvas;const gl=canvas.getContext('webgl',{antialias:true,alpha:false,powerPreference:'high-performance'});if(!gl)throw Error('WebGL unavailable');this.gl=gl;
 const vs=`attribute vec3 aPos;attribute vec3 aNormal;attribute vec3 aColor;attribute float aGlow;uniform mat4 uView;uniform mat4 uProjection;varying vec3 vColor;varying float vDepth;void main(){vec4 p=uView*vec4(aPos,1.);float light=.48+.52*max(0.,dot(normalize(aNormal),normalize(vec3(-.4,1.,.3))));vColor=aColor*mix(light,1.35,aGlow);vDepth=-p.z;gl_Position=uProjection*p;}`;
 const fs=`precision mediump float;varying vec3 vColor;varying float vDepth;void main(){float f=1.-exp(-max(vDepth,0.)*.0029);vec3 color=mix(vColor,vec3(.022,.029,.075),clamp(f,0.,.96));gl_FragColor=vec4(pow(color,vec3(.84)),1.);}`;
 const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
 const program=gl.createProgram();gl.attachShader(program,shader(gl.VERTEX_SHADER,vs));gl.attachShader(program,shader(gl.FRAGMENT_SHADER,fs));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);this.program=program;
 this.attributes=['aPos','aNormal','aColor','aGlow'].map(n=>gl.getAttribLocation(program,n));this.uView=gl.getUniformLocation(program,'uView');this.uProjection=gl.getUniformLocation(program,'uProjection');
 this.staticBuffer=gl.createBuffer();const world=makeWorld();this.staticCount=world.length/10;gl.bindBuffer(gl.ARRAY_BUFFER,this.staticBuffer);gl.bufferData(gl.ARRAY_BUFFER,world,gl.STATIC_DRAW);this.dynamicBuffer=gl.createBuffer();gl.enable(gl.DEPTH_TEST);this.high=true;
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();document.dispatchEvent(new Event('renderlost'));});canvas.addEventListener('webglcontextrestored',()=>location.reload());
 }
 draw(buffer,count){const g=this.gl;g.bindBuffer(g.ARRAY_BUFFER,buffer);[3,3,3,1].forEach((n,i)=>{g.enableVertexAttribArray(this.attributes[i]);g.vertexAttribPointer(this.attributes[i],n,g.FLOAT,false,40,[0,12,24,36][i]);});g.drawArrays(g.TRIANGLES,0,count);}
 render(camera,car,ghost,trails){const g=this.gl,c=this.canvas,dpr=Math.min(devicePixelRatio,this.high?1.8:1);const w=Math.round(innerWidth*dpr),h=Math.round(innerHeight*dpr);if(c.width!==w||c.height!==h){c.width=w;c.height=h;}g.viewport(0,0,w,h);g.clearColor(...fog,1);g.clear(g.COLOR_BUFFER_BIT|g.DEPTH_BUFFER_BIT);g.uniformMatrix4fv(this.uView,false,viewMatrix(camera.eye,camera.target));g.uniformMatrix4fv(this.uProjection,false,perspective(camera.fov,w/h,.2,1300));this.draw(this.staticBuffer,this.staticCount);
 const dynamic=carMesh(car);if(ghost)dynamic.push(...carMesh(ghost,true));for(const t of trails){const age=t.age/1.6;box(dynamic,t.x,.07,t.z,.12,.018,t.length,[.08*(1-age),.35*(1-age),.38*(1-age)],.8,t.yaw);}const arr=new Float32Array(dynamic);g.bindBuffer(g.ARRAY_BUFFER,this.dynamicBuffer);g.bufferData(g.ARRAY_BUFFER,arr,g.DYNAMIC_DRAW);this.draw(this.dynamicBuffer,arr.length/10);}
}
