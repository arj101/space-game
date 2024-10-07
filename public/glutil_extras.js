/**
 * Creates and compiles a shader.
 *
 * @param {!WebGLRenderingContext} gl The WebGL Context.
 * @param {string} shaderSource The GLSL source code for the shader.
 * @param {number} shaderType The type of shader, VERTEX_SHADER or
 *     FRAGMENT_SHADER.
 * @return {!WebGLShader} The shader.
 */
function compileShader(gl, shaderSource, shaderType) {
  // Create the shader object
  var shader = gl.createShader(shaderType);

  // Set the shader source code.
  gl.shaderSource(shader, shaderSource);

  // Compile the shader
  gl.compileShader(shader);

  // Check if it compiled
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    // Something went wrong during compilation; get the error
    throw "could not compile shader:" + gl.getShaderInfoLog(shader);
  }

  return shader;
}

/**
 * Creates a program from 2 shaders.
 *
 * @param {!WebGLRenderingContext) gl The WebGL context.
 * @param {!WebGLShader} vertexShader A vertex shader.
 * @param {!WebGLShader} fragmentShader A fragment shader.
 * @return {!WebGLProgram} A program.
 */
function createProgram(gl, vertexShader, fragmentShader) {
  if (!vertexShader || !fragmentShader) {
    return null;
  }

  // create a program.
  var program = gl.createProgram();

  // attach the shaders.
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  // link the program.
  gl.linkProgram(program);

  // Check if it linked.
  var success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!success) {
    // something went wrong with the link
    throw "program failed to link:" + gl.getProgramInfoLog(program);
  }

  return program;
}

function createWebGLCanvas() {
  const canvas = document.createElement("canvas");

  const gl =
    canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
  if (!gl) {
    const paragraph = document.querySelector("p");
    paragraph.textContent =
      "Failed to get WebGL context. Your browser or device may not support WebGL.";
    document.body.appendChild(paragraph);
    return null;
  }

  document.body.appendChild(canvas);
  return { canvas, gl };
}

function createProgramFromSource(gl, vshaderSource, fshaderSource) {
  const vshader = compileShader(gl, vshaderSource, gl.VERTEX_SHADER);
  const fshader = compileShader(gl, fshaderSource, gl.FRAGMENT_SHADER);

  return createProgram(gl, vshader, fshader);
}

function createBasicProgram(gl) {
  const vshader = `
attribute vec3 a_position;
attribute vec3 a_color;
varying vec3 v_color;

void main() {
  gl_Position = vec4(a_position, 1.);
    v_color = a_color;
    gl_PointSize=10.0;
}
`;

  const fshader = `
precision mediump float;
varying vec3 v_color;

void main() {
  gl_FragColor = vec4(v_color, 1.);
}
`;
  const basicProgram = createProgram(
    gl,
    compileShader(gl, vshader, gl.VERTEX_SHADER),
    compileShader(gl, fshader, gl.FRAGMENT_SHADER)
  );

  if (!basicProgram) {
    return null;
  }
  return basicProgram;
}

function mulMat4(a, b) {
  const result = new Float32Array(16);

  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      result[i * 4 + j] =
        a[i * 4 + 0] * b[j + 0 * 4] +
        a[i * 4 + 1] * b[j + 1 * 4] +
        a[i * 4 + 2] * b[j + 2 * 4] +
        a[i * 4 + 3] * b[j + 3 * 4];
    }
  }

  return result;
}

function rotZMat4(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  // prettier-ignore
  return new Float32Array([
    c, -s, 0, 0, 
    s, c, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]);
}

function rotYMat4(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  // prettier-ignore
  return new Float32Array([
    c, 0, s, 0, 
    0, 1, 0, 0,
    -s, 0, c, 0,
    0, 0, 0, 1
  ]);
}

function rotXMat4(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  // prettier-ignore
  return new Float32Array([
    1, 0, 0, 0, 
    0, c, -s, 0,
    0, s, c, 0,
    0, 0, 0, 1
  ]);
}

function translateMat4(x, y, z) {
  // prettier-ignore
  return new Float32Array([
    1, 0, 0, x, 
    0, 1, 0, y,
    0, 0, 1, z,
    0, 0, 0, 1
  ]);
}

function scaleMat4(x, y, z) {
  // prettier-ignore
  return new Float32Array([
    x, 0, 0, 0, 
    0, y, 0, 0,
    0, 0, z, 0,
    0, 0, 0, 1
  ]);
}

function transposeMat4(m) {
  // prettier-ignore
  return new Float32Array([
    m[0], m[4], m[8], m[12],
    m[1], m[5], m[9], m[13],
    m[2], m[6], m[10], m[14],
    m[3], m[7], m[11], m[15]
  ])
}

function identityMat4() {
  // prettier-ignore
  return new Float32Array([
    1, 0, 0, 0, 
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1
  ]);
}

function persepctiveProj(near, far, fov = Math.PI / 2) {
  const s = 1.0 / Math.tan(fov * 0.5);
  const invD = 1.0 / (far - near);

  // prettier-ignore
  return new Float32Array([
    s, 0, 0, 0, 
    0, s, 0, 0, 
    0, 0, -far*invD, -far*near*invD, 
    0, 0, -1, 0
  ])
}

function rotAtMat4(x, y, z, ax, ay, az) {
  return mulMat4(
    translateMat4(x, y, z),
    mulMat4(
      rotZMat4(az),
      mulMat4(rotYMat4(ay), mulMat4(rotXMat4(ax), translateMat4(-x, -y, -z)))
    )
  );
}

function transform(...mats) {
  return transposeMat4(
    mats.reduce((acc, mat) => mulMat4(mat, acc), identityMat4())
  );
}

function crossPVec3(a, b) {
  return new Float32Array([
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]);
}

function normalizeVec3(a) {
  const mag = Math.sqrt(a[0] ** 2 + a[1] ** 2 + a[2] ** 2);
  if (mag === 0) {
    return new Float32Array([0, 0, 0]);
  }

  return new Float32Array([a[0] / mag, a[1] / mag, a[2] / mag]);
}

function subVec3(a, b) {
  return new Float32Array([a[0] - b[0], a[1] - b[1], a[2] - b[2]]);
}

function addVec3(a, b) {
  return new Float32Array([a[0] + b[0], a[1] + b[1], a[2] + b[2]]);
}

function invertVec3(a) {
  return new Float32Array([-a[0], -a[1], -a[2]]);
}

function genNormals(
  vertexCount,
  getVertex = (idx) => {},
  setNormal = (idx, normal) => {},
  ccw = true
) {
  for (let i = 1; i < vertexCount - 1; i += 1) {
    const normal = normalizeVec3(
      crossPVec3(
        subVec3(getVertex(i), getVertex(i - 1)),
        subVec3(getVertex(i + 1), getVertex(i))
      )
    );
    if (!ccw) {
      normal[0] *= -1;
      normal[1] *= -1;
      normal[2] *= -1;
    }
    setNormal(i, normal);
  }
}

class Drawable {
  /**
   *
   * @param {WebGLRenderingContext} gl
   * @param {WebGLProgram} program
   * @param {{name:string,stride:number,offset:number}[]} vertexAttrs
   * @param {number[]} dataBuffer
   */
  constructor(gl, program, vertexAttrs, dataBuffer, vertexCount) {
    this.gl = gl;

    this.dataBuffer = dataBuffer;
    this.vertexCount = vertexCount;

    this.vAttrBuff = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vAttrBuff);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(dataBuffer),
      gl.STATIC_DRAW
    );

    this.vAttrLocs = new Map();

    for (const attrMetadata of vertexAttrs) {
      const attrLocation = gl.getAttribLocation(program, attrMetadata.name);
      this.vAttrLocs.set(attrMetadata.name, {
        attrLocation,
        attrSize: attrMetadata.size,
        attrStride: attrMetadata.stride,
        attrOffset: attrMetadata.offset,
      });
      gl.enableVertexAttribArray(attrLocation);

      gl.vertexAttribPointer(
        attrLocation,
        attrMetadata.size,
        gl.FLOAT,
        false,
        attrMetadata.stride,
        attrMetadata.offset
      );
    }
  }

  bindBuffersAndVAs() {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vAttrBuff);
    for (const {
      attrLocation,
      attrSize,
      attrStride,
      attrOffset,
    } of this.vAttrLocs.values()) {
      this.gl.vertexAttribPointer(
        attrLocation,
        attrSize,
        this.gl.FLOAT,
        false,
        attrStride,
        attrOffset
      );
    }
  }

  justDraw(drawMode) {
    this.gl.drawArrays(drawMode, 0, this.vertexCount);
  }

  draw(drawMode) {
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vAttrBuff);
    for (const {
      attrLocation,
      attrSize,
      attrStride,
      attrOffset,
    } of this.vAttrLocs.values()) {
      this.gl.vertexAttribPointer(
        attrLocation,
        attrSize,
        this.gl.FLOAT,
        false,
        attrStride,
        attrOffset
      );
    }

    this.gl.drawArrays(drawMode, 0, this.vertexCount);
  }
}

function defaultAttrs(attrLength = 9) {
  return [
    {
      name: "a_position",
      size: 3,
      stride: attrLength * 4,
      offset: 0,
    },
    {
      name: "a_color",
      size: 3,
      stride: attrLength * 4,
      offset: 3 * 4,
    },
    {
      name: "a_normal",
      size: 3,
      stride: attrLength * 4,
      offset: 6 * 4,
    },
  ];
}

function sprite2DAttrs() {
  return [
    {
      name: "a_position",
      size: 2,
      stride: 4 * 4,
      offset: 0,
    },
    {
      name: "a_texcoord",
      size: 2,
      stride: 4 * 4,
      offset: 2 * 4,
    },
  ];
}

function createSprite2DProgram(gl) {
  const vshader = `
attribute vec2 a_position;
attribute vec2 a_texcoord;
uniform mat4 u_modelview;
varying vec2 v_texcoord;

void main() {
  gl_Position = u_modelview * vec4(a_position, 0., 1.);
    gl_PointSize=10.0;
    v_texcoord = a_texcoord;
}
`;

  const fshader = `
precision mediump float;
varying vec2 v_texcoord;
uniform sampler2D texture;

void main() {
  gl_FragColor = texture2D(texture, v_texcoord);
}
`;
  const basicProgram = createProgram(
    gl,
    compileShader(gl, vshader, gl.VERTEX_SHADER),
    compileShader(gl, fshader, gl.FRAGMENT_SHADER)
  );

  if (!basicProgram) {
    return null;
  }
  return basicProgram;
}

/**
 * @param {WebGLRenderingContext} gl
 * @param {HTMLImageElement} image
 */
function createTexture(gl, textureUnit, image) {
  const tex = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0 + textureUnit);

  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  return tex;
}

function pixelXToClip(canvas, x) {
  return (x / canvas.width) * 2.0 - 1.0;
}

function pixelYToClip(canvas, y) {
  return (1.0 - y / canvas.height) * 2.0 - 1.0;
}

function clipXToPixel(canvas, x) {
  return (canvas.width / 2) * (1 + x);
}

function clipYToPixel(canvas, y) {
  return canvas.height - (canvas.height / 2) * (1 + y);
}

function pixelWToClip(canvas, w) {
  return (w / canvas.width) * 2.0;
}

function pixelHToClip(canvas, h) {
  return (h / canvas.height) * 2.0;
}

async function loadImage(src) {
  return new Promise((resolve, _) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = src;
  });
}

function createRectVertices(x, y, w, h) {
  // prettier-ignore
  return { vertices: new Float32Array([
    //triangle 1
    x, y, 0, 0,
    x + w, y, 1, 0,
    x, y + h, 0, 1,

    //triangle 2
    x, y + h, 0, 1, 
    x + w, y, 1, 0, 
    x + w, y + h, 1, 1
  ]), vertexCount: 6}
}

class Texture {
  constructor(gl, textureUnit, image) {
    this.gl = gl;
    this.textureUnit = textureUnit;
    this.image = image;

    this.texture = createTexture(gl, textureUnit, image);
  }

  loadImage(image) {
    this.image = image;
    this.texture = createTexture(this.gl, this.textureUnit, image);
  }

  setTextureUnit(textureUnit) {
    this.textureUnit = textureUnit;
  }

  bindTexture(loc) {
    this.gl.activeTexture(this.gl.TEXTURE0 + this.textureUnit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.uniform1i(loc, this.textureUnit);
  }
}

async function drawableFromObj(
  gl,
  program,
  attributes,
  objPath,
  fillColor = [1, 1, 1]
) {
  const { vertexCount, dataBuffer } = await loadObj(objPath, fillColor);

  return new Drawable(gl, program, attributes, dataBuffer, vertexCount);
}
