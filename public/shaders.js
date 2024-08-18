const terrainShader = {
  vertex: `
attribute vec2 position;
attribute vec2 uv;
varying vec2 texcoord;
varying vec2 vpos;
uniform vec2 center;

void main() {
  gl_Position = vec4(position - center, 0., 1.);
  texcoord = uv.xy;
  vpos = position.xy;
}

`,

  fragment: `
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

  fragmentProc: `
  precision highp float;
varying vec2 texcoord;
varying vec2 vpos;
uniform sampler2D texture;

mat2 rot(float a) {
    return mat2(
        cos(a), -sin(a),
        sin(a), cos(a)
    );
}

float noise(vec2 p) {
  return fract(3.3365334653 * abs(dot(p, vec2(235626.35, 0.46447))));
}


float noise2(vec2 p) {
     return fract(abs(dot(p, vec2(4648.35, 2926.464))));
}
float noise3(vec2 p) {
     return fract(0.736477 * abs(dot(p, vec2(4648.35, 2926.464))));
}


vec2 noisev(vec2 p) {
  return normalize(rot(noise3(p) * 6324636.14) * vec2(noise2(p), noise(p) + 0.05));
}


vec2 voronoi_center(vec2 id) {
 return vec2(0.5, 0.5) - (rot(noise(id) * 3.14)*vec2(0.3, 0.)).xy;
}

vec3 voronoi(vec2 id, vec2 f) {
  vec2 sp = voronoi_center(id);
  vec2 c = sp - f;

  vec3 color = vec3(1.);

  vec2 res = vec2(4.);

  float min_dist = 6.;

  float f1, f2;
  for (int x = -1; x <= 1; x++) {
      for (int y = -1; y <=1; y++) {
          vec2 offset = vec2(x, y);
          vec2 sp_other = offset  + voronoi_center(id + offset);

          vec2 r = f - sp_other;
          float d = dot(r, r);

          if (length(r) < min_dist) {
              min_dist = length(r);
          }

          if (d < res.x) {
              res.x = d;
          }

          else if (d < res.y) {
              res.y = d;
          }
      }
  }

  // res += (noisev(f) - 0.5) *0.1;

  // min_dist = floor( * abs(3. * sin(49.856 * atan(res.y, res.x)))) / 4.0;


 vec2 voronoi_p = (sqrt(res));

  float intensity = abs(voronoi_p.y - voronoi_p.x);

  intensity = floor(intensity * 10.0);
  // intensity += floor(length(voronoi_p) * 40000.);

  intensity =  smoothstep(0., 0.5, 0.001/intensity);
  intensity += max(0., 1.0 - 0.22/pow(min_dist, 2.));
  // intensity = smoothstep(0.1, 0., intensity);
  // intensity = 0.004/dot(res, res);

  intensity *= 1./distance(voronoi_p, f);
  color *= clamp(0.,1., intensity);


  return color;
}


//	Classic Perlin 2D Noise 
//	by Stefan Gustavson (https://github.com/stegu/webgl-noise)
//
vec2 fade(vec2 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
float cnoise(vec2 P){
  vec4 Pi = floor(P.xyxy) + vec4(0.0, 0.0, 1.0, 1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0, 0.0, 1.0, 1.0);
  Pi = mod(Pi, 289.0); // To avoid truncation effects in permutation
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = 2.0 * fract(i * 0.0243902439) - 1.0; // 1/41 = 0.024...
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x,gy.x);
  vec2 g10 = vec2(gx.y,gy.y);
  vec2 g01 = vec2(gx.z,gy.z);
  vec2 g11 = vec2(gx.w,gy.w);
  vec4 norm = 1.79284291400159 - 0.85373472095314 * 
    vec4(dot(g00, g00), dot(g01, g01), dot(g10, g10), dot(g11, g11));
  g00 *= norm.x;
  g01 *= norm.y;
  g10 *= norm.z;
  g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  float n_xy = mix(n_x.x, n_x.y, fade_xy.y);
  return 2.3 * n_xy;
}

// Cellular noise ("Worley noise") in 2D in GLSL.
// Copyright (c) Stefan Gustavson 2011-04-19. All rights reserved.
// This code is released under the conditions of the MIT license.
// See LICENSE file for details.
// https://github.com/stegu/webgl-noise

// Modulo 289 without a division (only multiplications)
vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

// Modulo 7 without a division
vec3 mod7(vec3 x) {
  return x - floor(x * (1.0 / 7.0)) * 7.0;
}

// Permutation polynomial: (34x^2 + 6x) mod 289
vec3 permute(vec3 x) {
  return mod289((34.0 * x + 10.0) * x);
}


// Modulo 7 without a division
vec4 mod7(vec4 x) {
  return x - floor(x * (1.0 / 7.0)) * 7.0;
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

 
   float scale = 6.0;

  vec2 st = texcoord * scale;
  st *= 20.0;
  float cn = cnoise(st);
  vec2 offset = rot(cn) * vec2(0., 0.290);

  vec2 f1f2 = cellular2x2(st + offset);
  float intensity = f1f2.y - f1f2.x;

  intensity = smoothstep(0.01, 0.1, intensity) - smoothstep(0.1, 0.2, intensity);
   intensity += (cn - 0.5) ;
    
    intensity +=  (cnoise(st*19.0)) ;

    	
    // color /= 9.0;
    // color = clamp(color, 0., 1.);
    // color.x = color.y = color.z = color.y;


    intensity = clamp(intensity, 0., 1.);

    intensity += smoothstep(0.95, 1., texColor.x);

    color *= intensity;

 

  gl_FragColor = vec4(color.xyz, 1.0);

}
`,
};
