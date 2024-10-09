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
    Matter.Body.applyForce(this.body, this.body.position, this.force);
    //   this.body.position.y += 0.5;
  }
}

class ParticleSystem {
  constructor(gl, physicsWorld) {
    this.gl = gl;
    this.physicsWorld = physicsWorld;
    this.particles = [];

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

    this.gl_program = createProgramFromSource(this.gl, vertShader, fragShader);

    this.drawable = new Drawable(this.gl, this.gl_program, attribs, verts, 6);

    this.center_loc = this.gl.getUniformLocation(this.gl_program, "center");
    this.decay_loc = this.gl.getUniformLocation(this.gl_program, "decay");
    this.size_loc = this.gl.getUniformLocation(this.gl_program, "psize");
    this.x_scale_loc = this.gl.getUniformLocation(this.gl_program, "x_scale");
  }

  addParticle(pos, force) {
    this.particles.push(new Particle(pos.x, pos.y, force));
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
      if (this.particles[i].size < 0.01) {
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
