function getShaders(width, height) {
  const noiseShader = {
    vertex: `
   attribute vec3 a_position;
   varying vec2 st;
   void main() {
    gl_Position = vec4(a_position, 1.0);
    st = a_position.xy;
   }
   `,
    fragment: `
   precision mediump float;
   varying vec2 st;
   uniform float u_time;
   uniform float u_alpha;

   float noise1(float seed1,float seed2){
    return(
    fract(seed1+12.34567*
    fract(100.*(abs(seed1*0.91)+seed2+94.68)*
    fract((abs(seed2*0.41)+45.46)*
    fract((abs(seed2)+757.21)*
    fract(seed1*0.0171))))))
    * 1.0038 - 0.00185;
    }

    void main() {
      float f = noise1(st.x, st.y + sin(u_time));
      
      if (noise1(u_time*3., floor(st.y  * 20.0 * noise1(st.y, 0.0))) > 0.2) {
          f = 0.0;
      }
      gl_FragColor = vec4(vec3(f), f * u_alpha);
    }
   `,
  };
  const finishPlatformShader = {
    vertex: `
attribute vec2 position;
attribute vec2 uv;
varying vec2 texcoord;
varying vec2 vpos;
uniform vec2 center;
uniform float scale;

void main() {
  gl_Position = vec4((position - center) * scale, 0., 1.);
  texcoord = uv.xy;
  vpos = position.xy;
}

`,

    fragment: `
  precision highp float;
varying vec2 texcoord;
varying vec2 vpos;
uniform sampler2D texture;

void main() {
   vec4 color = texture2D(texture, texcoord);

  gl_FragColor = color * color;
}
`,
  };
  const terrainShader = {
    vertex: `
attribute vec2 position;
attribute vec2 uv;
varying vec2 texcoord;
varying vec2 vpos;
uniform vec2 center;
uniform float scale;

void main() {
  gl_Position = vec4((position - center) * scale, 0., 1.);
  texcoord = uv.xy;
  vpos = position.xy;
}

`,

    fragment_old: `
  precision highp float;
varying vec2 texcoord;
varying vec2 vpos;
uniform sampler2D texture;

float rand(float n){return fract(sin(n) * 43758.5453123);}
float rand(vec2 n) {
	return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
}
float noise(float p){
	float fl = floor(p);
  float fc = fract(p);
	return mix(rand(fl), rand(fl + 1.0), fc);
}
float noise(vec2 n) {
	const vec2 d = vec2(0.0, 1.0);
  vec2 b = floor(n), f = smoothstep(vec2(0.0), vec2(1.0), fract(n));
	return mix(mix(rand(b), rand(b + d.yx), f.x), mix(rand(b + d.xy), rand(b + d.yy), f.x), f.y);
}

void main() {
   vec4 color = texture2D(texture, texcoord);
   color *= color;

  gl_FragColor = vec4(color);
  gl_FragColor.xyz = mix(gl_FragColor.xyz, vec3(noise(texcoord * 500.0)), color.x * 0.05);

  gl_FragColor.xyz += smoothstep( 0.95, 1.0, color.x) ;

  gl_FragColor.a = gl_FragColor.a;
}
`,

    fragment: `
  precision highp float;
varying vec2 texcoord;
varying vec2 vpos;
uniform sampler2D texture;
uniform vec2 center;

mat2 rot(float a) {
    return mat2(
        cos(a), -sin(a),
        sin(a), cos(a)
    );
}
//
// Description : Array and textureless GLSL 2D simplex noise function.
//      Author : Ian McEwan, Ashima Arts.
//  Maintainer : stegu
//     Lastmod : 20110822 (ijm)
//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//               Distributed under the MIT License. See LICENSE file.
//               https://github.com/ashima/webgl-noise
//               https://github.com/stegu/webgl-noise
//

vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec3 permute(vec3 x) {
  return mod289(((x*34.0)+10.0)*x);
}


vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

// Modulo 7 without a division
vec4 mod7(vec4 x) {
  return x - floor(x * (1.0 / 7.0)) * 7.0;
}

// Permutation polynomial: (34x^2 + 6x) mod 289
vec4 permute(vec4 x) {
  return mod289((34.0 * x + 10.0) * x);
}

float snoise(vec2 v)
  {
  const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                      0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                     -0.577350269189626,  // -1.0 + 2.0 * C.x
                      0.024390243902439); // 1.0 / 41.0
// First corner
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);

// Other corners
  vec2 i1;
  //i1.x = step( x0.y, x0.x ); // x0.x > x0.y ? 1.0 : 0.0
  //i1.y = 1.0 - i1.x;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  // x0 = x0 - 0.0 + 0.0 * C.xx ;
  // x1 = x0 - i1 + 1.0 * C.xx ;
  // x2 = x0 - 1.0 + 2.0 * C.xx ;
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

// Permutations
  i = mod289(i); // Avoid truncation effects in permutation
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
		+ i.x + vec3(0.0, i1.x, 1.0 ));

  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;

// Gradients: 41 points uniformly over a line, mapped onto a diamond.
// The ring size 17*17 = 289 is close to a multiple of 41 (41*7 = 287)

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

// Normalise gradients implicitly by scaling m
// Approximation of: m *= inversesqrt( a0*a0 + h*h );
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );

// Compute final noise value at P
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Cellular noise, returning F1 and F2 in a vec2.
// Speeded up by using 2x2 search window instead of 3x3,
// at the expense of some strong pattern artifacts.
// F2 is often wrong and has sharp discontinuities.
// If you need a smooth F2, use the slower 3x3 version.
// F1 is sometimes wrong, too, but OK for most purposes.
vec2 cellular2x2(vec2 P) {
#define K 0.142857142857 // 1/7
#define K2 0.0714285714285 // K/2
#define jitter 0.74 // jitter 1.0 makes F1 wrong more often
	vec2 Pi = mod289(floor(P));
 	vec2 Pf = fract(P);
	vec4 Pfx = Pf.x + vec4(-0.5, -1.5, -0.5, -1.5);
	vec4 Pfy = Pf.y + vec4(-0.5, -0.5, -1.5, -1.5);
	vec4 p = permute(Pi.x + vec4(0.0, 1.0, 0.0, 1.0));
	p = permute(p + Pi.y + vec4(0.0, 0.0, 1.0, 1.0));
	vec4 ox = mod7(p)*K+K2;
	vec4 oy = mod7(floor(p*K))*K+K2;
	vec4 dx = Pfx + jitter*ox;
	vec4 dy = Pfy + jitter*oy;
	vec4 d = dx * dx + dy * dy; // d11, d12, d21 and d22, squared
	// Sort out the two smallest distances
#if 0
	// Cheat and pick only F1
	d.xy = min(d.xy, d.zw);
	d.x = min(d.x, d.y);
	return vec2(sqrt(d.x)); // F1 duplicated, F2 not computed
#else
	// Do it right and find both F1 and F2
	d.xy = (d.x < d.y) ? d.xy : d.yx; // Swap if smaller
	d.xz = (d.x < d.z) ? d.xz : d.zx;
	d.xw = (d.x < d.w) ? d.xw : d.wx;
	d.y = min(d.y, d.z);
	d.y = min(d.y, d.w);
	return sqrt(d.xy);
#endif
}


void main() {
  vec4 texColor = texture2D(texture, texcoord);
   vec4 color = texture2D(texture, texcoord);
   color *= color;


   vec2 spos = vpos - center;
   float sposMag = length(spos);

  vec2 st = vpos;
  st *= 20.0;
  st.x *= ${width.toFixed(0) / height.toFixed(0)};
  float cn = snoise(st);
  vec2 offset = rot(cn) * vec2(0., 0.290);

  vec2 f1f2 = cellular2x2(st + offset);
  float intensity = f1f2.y - f1f2.x;

  intensity = smoothstep(0.01, 0.1, intensity) - smoothstep(0.1, 0.2, intensity);
   intensity += (cn - 0.5) + snoise(st*10.0);



    intensity = clamp(intensity, 0., 1.);

    intensity += smoothstep(0.92, 1., texColor.x);

    color *= intensity;

    color *= 1.0 - clamp(pow(sposMag*0.7, 2.0), 0., 1.);



  gl_FragColor = vec4(color.xyz, 1.0);

}
`,
  };

  const shipShader = {
    vertex: `

    attribute vec4 v_position;
    attribute vec4 texcoord;
    uniform vec2 center;
    varying vec4 position;
    varying vec4 f_texcoord;
    uniform float angle;
    uniform vec2 shipCenter;
    uniform float scale;


    void main() {
       vec2 ppos = v_position.xy;
       ppos.y *= ${height.toFixed(1)}/${width.toFixed(1)};
      vec2 pos = mat2(cos(angle), -sin(angle), sin(angle) , cos(angle)) * ppos.xy;
      pos.y *= ${width.toFixed(1)}/${height.toFixed(1)};
      gl_Position = vec4((pos.xy + shipCenter - center) * scale, 0., 1.);

      position = v_position;
      f_texcoord = texcoord;
    }
    `,
    fragment: `


    precision highp float;
    varying vec4 position;
    varying vec4 f_texcoord;
    uniform vec2 shipCenter;
    uniform vec2 center;
    uniform vec2 shipSize;

    uniform float u_time;
    uniform sampler2D img;
    uniform sampler2D flame;

    uniform vec2 lr;


    mat2 rot(float angle) {
      return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
    }

    void main() {

    vec2 pos = position.xy;
    vec2 texPos = (pos.xy/shipSize.xy * 0.5 + 1.0) * 0.5;
    vec4 color = texture2D(img, f_texcoord.xy);

    gl_FragColor = color;

    const vec2 t1 = vec2(0.00, 0.1 );
    const vec2 t2 = vec2(1.-0.09, 0.1);

    vec2 ft1 = texPos - t1;
    vec2 ft2 = texPos - t2;

    mat2 r = rot(sin(u_time * 70.) * 0.02);

    ft1 *= r;
    ft2 *= r;

    ft1.y /= abs(sin(u_time * 70. * (20. * lr.x))* (0.2 + lr.x * 0.2) + 1.);
    ft2.y /= abs(sin(u_time * 70. * (20. * lr.y))* (0.2 + lr.y * 0.2) + 1.);


    const float divp1 = 1./0.1;
    ft1 *= divp1 ;
    ft2 *= divp1;

    ft1.y *= lr.x * 0.2444;
    ft2.y *= lr.y * 0.2444;

    ft1.y = 0.5 +  ft1.y;
    ft2.y = 0.5  + ft2.y;

    ft1.y *= lr.x;
    ft2.y *= lr.y;

    ft1.x *= 0.8;
    ft2.x *= 0.8;

    ft1.x += 0.04;
    ft2.x += 0.11;



    vec4 ft1c = texture2D(flame, ft1);
    vec4 ft2c = texture2D(flame, ft2);

    float thrustFrac = 1.0 - smoothstep(0.0, 0.1, gl_FragColor.w);


    gl_FragColor += ft1c * pow(ft1.y , 2.) * 3. * thrustFrac;
    gl_FragColor += ft2c * pow(ft2.y , 2.) * 3. * thrustFrac;
    // gl_FragColor.xw += 0.6;V

    }


    `,
  };

  const bgShader = {
    vertex: `
    attribute vec4 v_position;
    uniform vec3 center;
    varying vec4 position;
    uniform float u_time;
    uniform float scale;

    void main() {
      gl_Position = v_position * scale;
      position = v_position;
    }
    `,
    fragment: `
    precision highp float;
    varying vec4 position;
    uniform vec3 center;
    uniform sampler2D img;



mat2 rot(float a) {
  return mat2(
      cos(a), -sin(a),
      sin(a), cos(a)
  );
}

    float noise(vec2 p) {
      return fract(0.35353 * abs(dot(p, vec2(235658.35, 544646.464))));
  }

  float noise2(vec2 p) {
       return fract(abs(dot(p, vec2(4648.35, 2926.464))));
  }

  float noise3(vec2 p) {
       return fract(0.136477 * abs(dot(p, vec2(4648.35, 2926.464))));
  }

    vec3 star(vec2 id, vec2 f) {
      vec2 sp = vec2(0.5, 0.5) - rot(noise(id) * 3.14)*vec2(0.6, 0.);
      vec2 c = sp - f;

      float size = noise3(id);

      float intensity = (0.1 * size)/distance(sp, f);


      float invlength = 0.3/length(c);
      intensity += min(0.8, 0.002/(abs(c.y * c.x))) *  invlength;

      const mat2 sr = mat2(0.7, -0.7, 0.7, 0.7);
      vec2 cr = c * sr;

      intensity += min(0.4, 0.002/(abs(cr.y * cr.x))) * invlength;

      float red = smoothstep(0.6, 0.9, size) * size;
      float green = smoothstep(0.2, 0.3, size) * size;
      float blue = smoothstep(0., 0.01, size) * size;


      vec3 sc = vec3(red,  green, blue) * intensity;


      float blink = fract(center.z *0.05  + 353663.0 * noise3(id));
      sc *= 1.0 - step(0.98, blink);

      return sc;
  }

    void main() {
       vec2 st = position.xy + center.xy  * 0.01 ;
      st.y *= ${height.toFixed(1)}/${width.toFixed(1)};

      vec3 color = vec3(0.);

      const int cutoff = 1;
      const float scale = 6.;
      st *= scale;

      for (int x = -cutoff; x <= cutoff; x++) {
          for (int y = -cutoff; y <= cutoff; y++) {
              vec2 offset = vec2(x, y);
              vec2 id = floor(st) + offset;

              vec2 f = fract(st) - offset  ;
              color += star(id , f);
          }
      }

      color *= 0.01;

      gl_FragColor.xyz = color;
      gl_FragColor.w = 1.;
    }
    `,
  };

  const menuBg = {
    vertex: `

    attribute vec4 v_position;
    uniform vec3 center;
    varying vec4 position;
    uniform float u_time;
    uniform float scale;

    void main() {
      gl_Position = v_position * scale;
      position = v_position;
    }
    `,
    fragment: `
    
    precision highp float;
    varying vec4 position;
    uniform vec3 center;
    uniform float u_time;
    uniform sampler2D img;



mat2 rot(float a) {
  return mat2(
      cos(a), -sin(a),
      sin(a), cos(a)
  );
}

    float noise(vec2 p) {
      return fract(0.35353 * abs(dot(p, vec2(235658.35, 544646.464))));
  }

  float noise2(vec2 p) {
       return fract(abs(dot(p, vec2(4648.35, 2926.464))));
  }

  float noise3(vec2 p) {
       return fract(0.136477 * abs(dot(p, vec2(4648.35, 2926.464))));
  }

    vec3 star(vec2 id, vec2 f) {
      vec2 sp = vec2(0.5, 0.5) - rot(noise(id) * 3.14)*vec2(0.6, 0.);
      vec2 c = sp - f;

      float size = noise3(id);

      float intensity = (0.1 * size)/distance(sp, f);


      float invlength = 0.9/length(c);
      intensity += min(0.8, 0.002/(abs(c.y * c.x))) *  invlength;

      const mat2 sr = mat2(0.7, -0.7, 0.7, 0.7);
      vec2 cr = c * sr;

      intensity += min(0.4, 0.002/(abs(cr.y * cr.x))) * invlength;

      float red = smoothstep(0.6, 0.9, size) * size;
      float green = smoothstep(0.2, 0.3, size) * size;
      float blue = smoothstep(0., 0.01, size) * size;


      vec3 sc = vec3(red,  green, blue) * intensity;


      float blink = fract(center.z *0.05  + 353663.0 * noise3(id));
      sc *= 1.0 - step(0.98, blink);

      return sc;
  }

    void main() {
       vec2 st = position.xy + center.xy  * 0.01 ;
      st.y *= ${height.toFixed(1)}/${width.toFixed(1)};

      vec3 color = vec3(0.);

      const int cutoff = 1;
      const float scale = 8.0;
      st *= scale ;

      for (int x = -cutoff; x <= cutoff; x++) {
          for (int y = -cutoff; y <= cutoff; y++) {
              vec2 offset = vec2(x, y);
              vec2 id = floor(st) + offset;

              vec2 f = fract(st) - offset  ;
              color += star(id , f);
          }
      }

      color *= 0.01;

      gl_FragColor.xyz = clamp(color, 0., 1.) * 0.7;
      gl_FragColor.w = 1.;
    }
    `,
  };

  return {
    terrainShader,
    shipShader,
    bgShader,
    finishPlatformShader,
    noiseShader,
    menuBg,
  };
}

function compileShaders(gl, shaders) {
  let failcount = 0;

  const programs = {};

  for (const shaderName in shaders) {
    const vert = shaders[shaderName].vertex;
    const frag = shaders[shaderName].fragment;

    console.log("Compiling program: ", shaderName);

    const vertCompiled = createShader(gl, gl.VERTEX_SHADER, vert);
    const fragCompiled = createShader(gl, gl.FRAGMENT_SHADER, frag);

    if (!vertCompiled || !fragCompiled) {
      failcount++;
      continue;
    }

    const program = createProgram(gl, vertCompiled, fragCompiled);
    programs[shaderName] = program;
  }

  if (failcount > 0) return undefined;

  return programs;
}
