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

void main() {
   vec4 color = texture2D(texture, texcoord);
  gl_FragColor = vec4(color);
  gl_FragColor.xyz =gl_FragColor.xyz;

  gl_FragColor.a = gl_FragColor.x;
}
`,
};
