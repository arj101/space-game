class Particle {
  constructor(x, y, force) {
    this.body = Matter.Bodies.circle(x, y, 1, {
      collisionFilter: {
        category: 0b10,
        mask: 0b111,
      },
    });
    this.size = 1;
    this.decay = 0;
    this.force = force;
  }

  update() {
    this.size *= 0.99;
    this.decay = 1.0 - this.size;
    Matter.Body.applyForce(
      this.body,
      this.body.position,
      Matter.Vector.rotate(this.force, Math.random() * 0.6 - 0.3)
    );
    //   this.body.position.y += 0.5;
  }
}

class DamageParticle extends Particle {
  constructor(x, y, force, color = [1, 0, 0]) {
    super(x, y, force);
    this.body = Matter.Bodies.circle(x, y, 1, {
      collisionFilter: {
        category: 0b0001,
        mask: 0b11111,
      },
    });
    this.size = 1.0;
    this.sizeScale = Math.random() * 0.5 + 0.5;
    this.decayFactor = 0.98 + Math.random() * 0.019;
    this.decay = 0;
    this.force = force;
    this.color = color;
  }

  update() {
    this.size *= this.decayFactor;
    this.decay = 1.0 - this.size;
    Matter.Body.applyForce(
      this.body,
      this.body.position,
      Matter.Vector.rotate(this.force, Math.random() - 0.5)
    );
  }
}

class ParticleSystem {
  shaderSources() {
    const vertShader = `
    attribute vec2 v_position;  
    varying vec2 v_pos;
    uniform vec2 center;
    uniform float psize;
    uniform float x_scale;

    void main() {
        v_pos = v_position ;
        gl_Position = vec4(v_position *  vec2(x_scale, 1.) * psize + center, 0.0, 1.0);
    }
    `;

    const fragShader = `
    precision highp float;
    varying vec2 v_pos;
    uniform float decay;
    uniform float psize;

    void main() {
        float f = 0.0;
        f = 1.0 - smoothstep(0.0, 1.0, length(v_pos));
        float decay_alpha = (1.0 - decay);
        decay_alpha = sin(pow(1.0 - decay_alpha, 2.0)*decay_alpha)*6.7;

        gl_FragColor = vec4(1., 1., 1., decay_alpha*f);
    }
    `;
    return { vertShader, fragShader };
  }

  constructor(gl, physicsWorld) {
    this.gl = gl;
    this.physicsWorld = physicsWorld;
    this.particles = [];

    const verts = [
      -1, -1, 0, -1, 1, 0, 1, 1, 0,

      1, 1, 0, 1, -1, 0, -1, -1, 0,
    ];

    const attribs = [
      {
        name: "v_position",
        size: 3,
        stride: 3 * 4,
        offset: 0,
      },
    ];

    const { vertShader, fragShader } = this.shaderSources();

    this.gl_program = createProgramFromSource(this.gl, vertShader, fragShader);

    this.drawable = new Drawable(this.gl, this.gl_program, attribs, verts, 6);

    this.center_loc = this.gl.getUniformLocation(this.gl_program, "center");
    this.decay_loc = this.gl.getUniformLocation(this.gl_program, "decay");
    this.size_loc = this.gl.getUniformLocation(this.gl_program, "psize");
    this.x_scale_loc = this.gl.getUniformLocation(this.gl_program, "x_scale");
  }

  createParticle(pos, force) {
    return new Particle(pos.x, pos.y, force);
  }

  addParticle(pos, force) {
    this.particles.push(this.createParticle(pos, force));
    Matter.Composite.add(this.physicsWorld, [
      this.particles[this.particles.length - 1].body,
    ]);
  }

  addParticles(x, y, n, force) {
    for (let i = 0; i < n; i++) {
      this.addParticle(x, y, force);
    }
  }

  update() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update();
      if (this.particles[i].size < 0.05) {
        Matter.Composite.remove(this.physicsWorld, this.particles[i].body);
        this.particles.splice(i, 1);
      }
    }
  }

  draw(width, height, camPos, scale) {
    this.gl.useProgram(this.gl_program);
    this.drawable.bindBuffersAndVAs();
    this.gl.uniform1f(this.x_scale_loc, height / width);

    for (const particle of this.particles) {
      this.gl.uniform1f(
        this.size_loc,
        0.08 * (1.0 - Math.min(1, particle.decay))
      );
      const px = particle.body.position.x - camPos.x + width / 2;
      const py = particle.body.position.y - camPos.y + height / 2;
      const x = (px / width) * 2 - 1;
      const y = 1 - (py / height) * 2;

      this.gl.uniform1f(this.decay_loc, Math.min(1, particle.decay));
      this.gl.uniform2f(this.center_loc, x * scale, y * scale);

      this.drawable.justDraw(this.gl.TRIANGLES);
    }
  }
}
/* accepts parameters
 * h  Object = {h:x, s:y, v:z}
 * OR
 * h, s, v
 */
function HSVtoRGB(h, s, v) {
  var r, g, b, i, f, p, q, t;
  if (arguments.length === 1) {
    (s = h.s), (v = h.v), (h = h.h);
  }
  i = Math.floor(h * 6);
  f = h * 6 - i;
  p = v * (1 - s);
  q = v * (1 - f * s);
  t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0:
      (r = v), (g = t), (b = p);
      break;
    case 1:
      (r = q), (g = v), (b = p);
      break;
    case 2:
      (r = p), (g = v), (b = t);
      break;
    case 3:
      (r = p), (g = q), (b = v);
      break;
    case 4:
      (r = t), (g = p), (b = v);
      break;
    case 5:
      (r = v), (g = p), (b = q);
      break;
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

class DamageParticleSystem extends ParticleSystem {
  shaderSources() {
    const vertShader = `
    attribute vec2 v_position;  
    varying vec2 v_pos;
    uniform vec2 center;
    uniform float psize;
    uniform float x_scale;

    void main() {
        v_pos = v_position ;
        gl_Position = vec4(v_position *  vec2(x_scale, 1.) * psize + center, 0.0, 1.0);
    }
    `;

    const fragShader = `
    precision highp float;
    varying vec2 v_pos;
    uniform float decay;
    uniform float psize;
    uniform vec3 color;

    void main() {
        float f = 0.0;
        f = 1.0 - smoothstep(0.0, 1.0, length(v_pos));
        float decay_alpha = (1.0 - decay);
        decay_alpha = sin(pow(1.0 - decay_alpha, 2.0)*decay_alpha)*6.7;

        gl_FragColor = vec4(color, decay_alpha*f);
    }
    `;
    return { vertShader, fragShader };
  }
  createParticle(pos, force) {
    const hmin = 250 / 360;
    const hmax = 300 / 360;
    const s = 66 / 100;
    const v = 1;
    const rgb = HSVtoRGB(Math.random() * (hmax - hmin) + hmin, s, v);
    return new DamageParticle(pos.x, pos.y, force, [
      rgb.r / 255,
      rgb.g / 255,
      rgb.b / 255,
    ]);
  }
  constructor(gl, physicsWorld) {
    super(gl, physicsWorld);
    this.color_loc = this.gl.getUniformLocation(this.gl_program, "color");
  }

  draw(width, height, camPos, scale) {
    this.gl.useProgram(this.gl_program);
    this.drawable.bindBuffersAndVAs();
    this.gl.uniform1f(this.x_scale_loc, height / width);

    for (const particle of this.particles) {
      this.gl.uniform1f(
        this.size_loc,
        0.08 * (1.0 - Math.min(1, particle.decay)) * particle.sizeScale
      );
      this.gl.uniform3fv(this.color_loc, particle.color);
      const px = particle.body.position.x - camPos.x + width / 2;
      const py = particle.body.position.y - camPos.y + height / 2;
      const x = (px / width) * 2 - 1;
      const y = 1 - (py / height) * 2;

      this.gl.uniform1f(this.decay_loc, Math.min(1, particle.decay));
      this.gl.uniform2f(this.center_loc, x * scale, y * scale);

      this.drawable.justDraw(this.gl.TRIANGLES);
    }
  }
}
