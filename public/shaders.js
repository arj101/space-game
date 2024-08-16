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
};
