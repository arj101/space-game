function createShader(gl, type, source) {
  var shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  console.log(gl.getShaderInfoLog(shader)); // eslint-disable-line
  gl.deleteShader(shader);
  return undefined;
}
function createProgram(gl, vertexShader, fragmentShader) {
  var program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  var success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.log(gl.getProgramInfoLog(program)); // eslint-disable-line
  gl.deleteProgram(program);
  return undefined;
}

function loadText(url) {
  return new Promise(async (resolve, reject) => {
    let req = await fetch(url).catch(reject);
    let text = await req.text();

    resolve(text);
  });
}

function loadJSON(url) {
  return new Promise(async (resolve, reject) => {
    let req = await fetch(url).catch(reject);
    let json = await req.json();

    resolve(json);
  });
}

function loadImage(url) {
  return new Promise(async (resolve, reject) => {
    let image = new Image();
    image.onload = () => {
      resolve(image);
    };
    image.src = url;
  });
}

function loadAudio(url) {
  return new Promise(async (resolve, reject) => {
    let audio = new Audio();
    audio.pause();
    audio.oncanplaythrough = () => {
      resolve(audio);
    };
    audio.src = url;
  });
}

function parseOBJCollissionData(source) {
  let lines = source.split("\n");
  let vs = [];
  let shapeI = -1;
  let shapes = [];

  let sx = 0;
  let sy = 0;

  let n = 0;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    if (line.startsWith("v ")) {
      let [_, x, __, z] = line.split(" ");
      vs.push([parseFloat(x), parseFloat(z)]);
      n++;
      sx += parseFloat(x);
      sy += parseFloat(z);
    } else if (line.startsWith("l ")) {
      let [_, a, b] = line.split(" ");
      shapes[shapeI].vertices.push(vs[parseInt(a) - 1]);
      if (i == lines.length - 1)
        shapes[shapeI].vertices.push(vs[parseInt(b) - 1]);
    } else if (line.startsWith("f ")) {
      let fvs = line.split(" ").slice(1);
      for (let j = 0; j < fvs.length; j += 1) {
        let a = parseInt(fvs[j]) - 1;
        // let b = parseInt(fvs[j + 1]) - 1;
        shapes[shapeI].vertices.push(vs[a]);
        // shapes[shapeI].vertices.push(vs[b]);
        // sx += parseFloat(vs[a]);
        // sy += parseFloat(vs[b]);
        // n++;
      }
    } else if (line.startsWith("o ")) {
      let [_, name] = line.split(" ");
      console.log(`Parsing ${name}`);
      shapeI++;

      if (shapeI > 0) {
        shapes[shapeI - 1].center = { x: sx / n, y: sy / n };
      }
      (n = 0), (sx = 0), (sy = 0);
      shapes.push({ name, vertices: [], center: { x: 0, y: 0 } });
    }
  }
  if (shapeI >= 0) {
    shapes[shapeI].center = { x: sx / n, y: sy / n };
  }

  console.log("Collission Data parsed: ", shapes);

  return shapes;
}

function bodyFromCollissionRects(collissionRects) {
  const body = Matter.Body.create({
    parts: collissionRects,
  });

  return body;
}

function buildCollissionRects(
  collissionObjs,
  width,
  height,
  { isStatic = true } = { isStatic: true },
) {
  const cvs = collissionObjs.map((collissionObj) => {
    let s = collissionObj.center;
    let sx = (s.x + 1.0) * 0.5 * width;
    let sy = (1.0 - s.y) * 0.5 * height;

    // sx = 0;
    // sy = 0;

    return {
      center: { x: sx, y: sy },
      name: collissionObj.name,
      vertices: collissionObj.vertices.map(([x, y]) => {
        return {
          x: (x + 1.0) * 0.5 * width,
          y: (1.0 - y) * 0.5 * height,
        };
      }),
    };
  });

  const Vector = Matter.Vector,
    Bodies = Matter.Bodies;

  let finishPlatform;

  let collissionTries = [];
  cvs.forEach((cv) => {
    let bodies = [];

    for (let i = 0; i < cv.vertices.length; i += 3) {
      let v1 = cv.vertices[i + 0];
      let v2 = cv.vertices[i + 1];
      let v3 = cv.vertices[i + 2];

      let centerx = (v1.x + v2.x + v3.x) / 3;
      let centery = (v1.y + v2.y + v3.y) / 3;

      let b = Bodies.fromVertices(centerx, centery, [[v1, v2, v3]], {
        isStatic,
      });

      bodies.push(b);
    }

    const b = Matter.Body.create({
      parts: bodies,
      isStatic,
    });

    if (cv.name == "finish") {
      finishPlatform = b;
    } else {
      collissionTries.push(b);
    }
  });

  // const collissionBodies = cvs.map((cv) => {
  //   let v1 = cv.vertices[0];
  //   let v2 = cv.vertices[1];
  //   let v3 = cv.vertices[2];
  //   let v4 = cv.vertices[3];

  //   let width = Vector.magnitude(Vector.sub(v1, v2));
  //   let height = Vector.magnitude(Vector.sub(v2, v3));

  //   let angle = Math.atan2(-(v2.y - v1.y), v2.x - v1.x);

  //   let centerx = (v1.x + v2.x + v3.x + v4.x) / 4;
  //   let centery = (v1.y + v2.y + v3.y + v4.y) / 4;

  //   // return Bodies.fromVertices(centerx, centery, [cv.vertices], {
  //   //   isStatic: true,
  //   // });

  //   let b = Bodies.rectangle(centerx, centery, width, height, {
  //     isStatic,
  //     angle: -angle,
  //   });

  //   if (cv.name == "finish") {
  //     finishPlatform = b;
  //     console.log("Found finish platform in collission data");
  //   }

  //   return b;
  // });
  //
  console.log("Triangles", collissionTries);

  return { finishPlatform, collissionTries };
}

function parseOBJ(source) {
  let lines = source.split("\n");
  let vs = [];
  let ts = [];

  let vertices = [];
  let texcoords = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();

    if (line.startsWith("v ")) {
      let [_, x, __, z] = line.split(" ");
      vs.push([parseFloat(x), parseFloat(z)]);
      //we dont need the height because its a 2D game :) (shouldve used x and y instead)
    } else if (line.startsWith("vt ")) {
      let [_, u, v] = line.split(" ");
      ts.push([parseFloat(u), parseFloat(v)]);
    } else if (line.startsWith("f ")) {
      let [_, a, b, c] = line.split(" ");

      let [av, at] = a.split("/");
      let [bv, bt] = b.split("/");
      let [cv, ct] = c.split("/");

      vertices.push(vs[parseInt(av) - 1]);
      vertices.push(vs[parseInt(bv) - 1]);
      vertices.push(vs[parseInt(cv) - 1]);

      texcoords.push(ts[parseInt(at) - 1]);
      texcoords.push(ts[parseInt(bt) - 1]);
      texcoords.push(ts[parseInt(ct) - 1]);
    } else if (line.startsWith("o ")) {
      let [_, name] = line.split(" ");
      console.log(`Parsing ${name}`);
    }
  }

  return { vertices, texcoords };
}

function scaleOBJ(scaleX, scaleY, obj) {
  let { vertices, texcoords } = obj;

  let scaledVertices = vertices.map((v) => {
    return [v[0] * scaleX, v[1] * scaleY];
  });

  return {
    vertices: scaledVertices,
    texcoords,
    name: obj.name,
    center: obj.center,
  };
}

function objToVAttributes(obj) {
  let va = [];

  for (let i = 0; i < obj.vertices.length; i++) {
    va.push(obj.vertices[i][0]);
    va.push(obj.vertices[i][1]);
    va.push(obj.texcoords[i][0]);
    va.push(obj.texcoords[i][1]);
  }

  return va;
}

function flatternOBJ(obj) {
  let { vertices, texcoords } = obj;

  let flatternedVertices = vertices.flat();
  let flatternedTexcoords = texcoords.flat();

  return {
    vertices: flatternedVertices,
    texcoords: flatternedTexcoords,
    name: obj.name,
    center: obj.center,
  };
}

function setUniform(gl, pg, name, value) {
  const location = gl.getUniformLocation(pg, name);
  if (location === null) {
    console.warn(`Uniform ${name} not found`);
    return;
  }

  if (typeof value === "number") {
    gl.uniform1f(location, value);
  } else if (value.length === 2) {
    gl.uniform2fv(location, value);
  } else if (value.length === 3) {
    gl.uniform3fv(location, value);
  }
}
