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

void main() {
  vec4 texColor = texture2D(texture, texcoord);
   vec4 color = texture2D(texture, texcoord);
   color *= color;

  
  // gl_FragColor.xyz = mix(gl_FragColor.xyz, vec3(noise(texcoord * 500.0)), color.x * 0.05);

  vec2 tileCoord = fract(texcoord *20.);
  vec2 tileCoord2 = fract(texcoord *100.);

  const float scale = 4.0;

  vec2 id = floor(tileCoord * scale);
  vec2 f = fract(tileCoord * scale);
  vec3 voronoi_color = voronoi(id, f);
  voronoi_color = 1.0 - voronoi_color;
  color.xyz *= voronoi_color ;

  vec2 id2 = floor(tileCoord2 * scale);
  vec2 f2 = fract(tileCoord2 * scale);
  vec3 voronoi_color2 = voronoi(id2, f2);
  voronoi_color2 = 1.0 - voronoi_color2;
  color.xyz *= voronoi_color2 ;

  // gl_FragColor.xyz += smoothstep( 0.95, 1.0, color.x) ;

  gl_FragColor = color;

  gl_FragColor.x = max(0., gl_FragColor.x);
  gl_FragColor.y = max(0., gl_FragColor.y);
  gl_FragColor.z = max(0., gl_FragColor.z);

  gl_FragColor.xyz += vec3(smoothstep(0.95, 0.95, texColor.x));


}
`,
};
