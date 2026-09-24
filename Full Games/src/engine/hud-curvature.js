// Отдельный прозрачный слой HUD: цилиндрическая проекция и мягкая бочкообразная дисторсия.
(function () {
  'use strict';
  const STYLE={bend:.32,curve:.10,barrel:.008};
  let surface=null, context=null, output=null, gl=null, program=null, texture=null, size=null;
  let attempted=false, lost=false;
  const VERTEX=`attribute vec2 position;
    varying vec2 uv;
    void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
  const FRAGMENT=`precision mediump float;
    uniform sampler2D hud;
    uniform vec3 shape;
    varying vec2 uv;
    void main(){
      vec2 target=uv*2.-1.;
      vec2 p=target;
      // Обратное преобразование лёгкой радиальной дисторсии.
      for(int i=0;i<3;i++) p=target/max(.8,1.-shape.z*dot(p,p));
      float sx=sin(shape.x);
      float x=asin(clamp(p.x*sx,-1.,1.))/shape.x;
      // Края выгибаются наружу; нормализация удерживает весь интерфейс в кадре.
      float y=p.y*(1.+shape.y)/(1.+shape.y*x*x);
      vec2 source=vec2(x,y)*.5+.5;
      if(source.x<0.||source.x>1.||source.y<0.||source.y>1.){gl_FragColor=vec4(0.);return;}
      gl_FragColor=texture2D(hud,source);
    }`;
  /** Компилирует шейдер и освобождает объект при ошибке драйвера. */
  function shader(type,source) {
    const item=gl.createShader(type); gl.shaderSource(item,source);gl.compileShader(item);
    if(!gl.getShaderParameter(item,gl.COMPILE_STATUS)){gl.deleteShader(item);return null;}
    return item;
  }
  /** Создаёт единственный повторно используемый композитор; при отсутствии WebGL остаётся обычный HUD. */
  function initialize() {
    if(attempted)return !!program&&!lost;
    attempted=true;
    size=null;
    surface=document.createElement('canvas');context=surface.getContext('2d');
    output=document.createElement('canvas');
    gl=output.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,depth:false,stencil:false});
    if(!gl||!context)return false;
    const vertex=shader(gl.VERTEX_SHADER,VERTEX),fragment=shader(gl.FRAGMENT_SHADER,FRAGMENT);
    if(!vertex||!fragment){if(vertex)gl.deleteShader(vertex);if(fragment)gl.deleteShader(fragment);return false;}
    const linked=gl.createProgram();gl.attachShader(linked,vertex);gl.attachShader(linked,fragment);gl.linkProgram(linked);
    gl.deleteShader(vertex);gl.deleteShader(fragment);
    if(!gl.getProgramParameter(linked,gl.LINK_STATUS)){gl.deleteProgram(linked);return false;}
    program=linked;gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const attr=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
    texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
    gl.uniform1i(gl.getUniformLocation(program,'hud'),0);
    gl.uniform3f(gl.getUniformLocation(program,'shape'),STYLE.bend,STYLE.curve,STYLE.barrel);
    gl.disable(gl.BLEND);gl.clearColor(0,0,0,0);
    output.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;});
    output.addEventListener('webglcontextrestored',()=>{program=null;attempted=false;lost=false;});
    return true;
  }
  /** Проецирует точку макета: используется для проверки границ и симметрии эффекта. */
  function project(x,y) {
    const px=Math.sin(x*STYLE.bend)/Math.sin(STYLE.bend),py=y*(1+STYLE.curve*x*x)/(1+STYLE.curve);
    const factor=1-STYLE.barrel*(px*px+py*py);
    return {x:px*factor,y:py*factor};
  }
  /** Рисует HUD в прозрачную текстуру и накладывает результат одним проходом на игровой холст. */
  function render(destination,paint) {
    if(!initialize()){paint(destination);return;}
    const width=destination.canvas.width,height=destination.canvas.height;
    const resized=!size||size.width!==width||size.height!==height;
    if(resized){surface.width=output.width=width;surface.height=output.height=height;size={width,height};}
    context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,width,height);paint(context);
    gl.viewport(0,0,width,height);gl.bindTexture(gl.TEXTURE_2D,texture);
    if(resized)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,surface);
    else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,surface);
    gl.drawArrays(gl.TRIANGLES,0,6);
    destination.save();destination.setTransform(1,0,0,1,0,0);destination.drawImage(output,0,0);destination.restore();
  }
  DiVANEngine.hudCurvature={render,project,style:STYLE,status:()=>({active:!!program&&!lost,width:size&&size.width,height:size&&size.height})};
})();
