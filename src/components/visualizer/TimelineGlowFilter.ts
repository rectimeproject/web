import {Filter, GlProgram} from "pixi.js";

const vertex = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition( void )
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord( void )
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`;

const fragment = `
precision highp float;

in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uTime;
uniform float uAmplitude;
uniform float uGlowIntensity;
uniform float uGlowRadius;
uniform vec3 uBaseColor;
uniform vec3 uGlowColor;
uniform vec2 uCanvasSize;
uniform float uFlameIntensity;

// ============== NOISE ==============

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// ============== SOFT GLOW ==============

vec4 sampleGlow(vec2 uv, float radius) {
    vec4 sum = vec4(0.0);
    float total = 0.0;
    
    for (float x = -2.0; x <= 2.0; x += 1.0) {
        for (float y = -2.0; y <= 2.0; y += 1.0) {
            vec2 offset = vec2(x, y) * radius / uCanvasSize;
            float dist = length(vec2(x, y));
            float weight = exp(-dist * dist * 0.2);
            sum += texture(uTexture, uv + offset) * weight;
            total += weight;
        }
    }
    
    return sum / total;
}

// ============== MAIN ==============

void main() {
    vec2 uv = vTextureCoord;
    vec2 pixelCoord = uv * uCanvasSize;
    
    vec4 original = texture(uTexture, uv);
    
    // ============== ATMOSPHERIC GLOW FOR EMPTY AREAS ==============
    
    if (original.a < 0.01) {
        float glowRadius = uGlowRadius * (1.0 + uAmplitude * 0.5);
        vec4 glow = sampleGlow(uv, glowRadius);
        
        if (glow.a > 0.01) {
            // Soft, diffused glow
            float glowStrength = smoothstep(0.0, 0.5, glow.a) * uGlowIntensity * 0.6;
            
            // Gentle breathing motion
            float breath = sin(uTime * 1.5) * 0.5 + 0.5;
            glowStrength *= (0.85 + breath * 0.15 * uAmplitude);
            
            // Subtle floating particles
            float particleNoise = noise(pixelCoord * 0.03 + vec2(uTime * 8.0, uTime * 5.0));
            float particles = pow(particleNoise, 6.0) * uAmplitude * 0.4;
            
            // Use the glow color directly - no gradient
            vec3 glowCol = uGlowColor * glowStrength;
            glowCol += uBaseColor * particles;
            
            finalColor = vec4(glowCol, glowStrength * 0.5);
        } else {
            finalColor = vec4(0.0);
        }
        return;
    }
    
    // ============== BAR EFFECTS ==============
    
    // Gentle shimmer across the bars
    float shimmerSpeed = 2.0;
    float shimmer = noise(vec2(pixelCoord.x * 0.02 + uTime * shimmerSpeed, pixelCoord.y * 0.05));
    shimmer = smoothstep(0.4, 0.6, shimmer);
    
    // Soft edge glow - bars glow slightly at edges
    vec2 texelSize = 1.0 / uCanvasSize;
    float edgeL = texture(uTexture, uv - vec2(texelSize.x * 2.0, 0.0)).a;
    float edgeR = texture(uTexture, uv + vec2(texelSize.x * 2.0, 0.0)).a;
    float edgeT = texture(uTexture, uv - vec2(0.0, texelSize.y * 2.0)).a;
    float edgeB = texture(uTexture, uv + vec2(0.0, texelSize.y * 2.0)).a;
    float edge = (4.0 - edgeL - edgeR - edgeT - edgeB) * 0.25;
    edge = max(0.0, edge);
    
    // Breathing pulse synced to amplitude
    float pulse = sin(uTime * 2.5 + pixelCoord.x * 0.01) * 0.5 + 0.5;
    float breathIntensity = 0.92 + pulse * 0.08 * (0.5 + uAmplitude * 0.5);
    
    // Start with the base color
    vec3 barColor = uBaseColor;
    
    // Add subtle shimmer highlights
    barColor += uGlowColor * shimmer * 0.15 * uFlameIntensity;
    
    // Soft inner glow at edges
    barColor += uGlowColor * edge * 0.3 * (0.5 + uAmplitude * 0.5) * uFlameIntensity;
    
    // Apply breathing
    barColor *= breathIntensity;
    
    // Subtle luminosity variation based on amplitude
    float luminosity = 1.0 + uAmplitude * 0.2;
    barColor *= luminosity;
    
    // ============== FLOATING LIGHT MOTES ==============
    
    // Tiny floating particles that drift across bars
    float moteNoise1 = noise(pixelCoord * 0.015 + vec2(uTime * 12.0, uTime * 8.0));
    float moteNoise2 = noise(pixelCoord * 0.025 + vec2(-uTime * 10.0, uTime * 6.0));
    float motes = pow(moteNoise1 * moteNoise2, 4.0) * uAmplitude * 2.0;
    
    // Add motes as bright spots (use glow color)
    barColor += uGlowColor * motes * uFlameIntensity;
    
    // ============== SOFT AMBIENT OCCLUSION ==============
    
    // Darken slightly toward bar edges for depth
    float centerY = uCanvasSize.y * 0.5;
    float distFromCenter = abs(pixelCoord.y - centerY) / (uCanvasSize.y * 0.4);
    float ao = 1.0 - distFromCenter * 0.1;
    barColor *= ao;
    
    finalColor = vec4(barColor, original.a);
}
`;

export interface TimelineGlowFilterOptions {
  canvasSize?: [number, number];
  glowIntensity?: number;
  glowRadius?: number;
  baseColor?: [number, number, number];
  glowColor?: [number, number, number];
  flameIntensity?: number;
}

/**
 * A custom PixiJS filter that adds flame effects, glow, color shifting, and chromatic aberration
 * effects to the timeline visualizer based on audio amplitude.
 */
export class TimelineGlowFilter extends Filter {
  #uniforms;

  constructor(options: TimelineGlowFilterOptions = {}) {
    const {
      canvasSize = [800, 200],
      glowIntensity = 0.8,
      glowRadius = 8.0,
      baseColor = [0.2, 0.6, 0.9], // Cyan-ish
      glowColor = [0.9, 0.3, 0.7], // Magenta-ish
      flameIntensity = 1.0
    } = options;

    const glProgram = GlProgram.from({
      vertex,
      fragment,
      name: "timeline-glow-filter"
    });

    const uniforms = {
      uTime: {value: 0, type: "f32" as const},
      uAmplitude: {value: 0, type: "f32" as const},
      uGlowIntensity: {value: glowIntensity, type: "f32" as const},
      uGlowRadius: {value: glowRadius, type: "f32" as const},
      uBaseColor: {value: baseColor, type: "vec3<f32>" as const},
      uGlowColor: {value: glowColor, type: "vec3<f32>" as const},
      uCanvasSize: {value: canvasSize, type: "vec2<f32>" as const},
      uFlameIntensity: {value: flameIntensity, type: "f32" as const}
    };

    super({
      glProgram,
      resources: {
        timelineGlowUniforms: uniforms
      }
    });

    this.#uniforms = uniforms;
  }

  get time(): number {
    return this.#uniforms.uTime.value;
  }

  set time(value: number) {
    this.#uniforms.uTime.value = value;
  }

  get amplitude(): number {
    return this.#uniforms.uAmplitude.value;
  }

  set amplitude(value: number) {
    this.#uniforms.uAmplitude.value = value;
  }

  get glowIntensity(): number {
    return this.#uniforms.uGlowIntensity.value;
  }

  set glowIntensity(value: number) {
    this.#uniforms.uGlowIntensity.value = value;
  }

  get glowRadius(): number {
    return this.#uniforms.uGlowRadius.value;
  }

  set glowRadius(value: number) {
    this.#uniforms.uGlowRadius.value = value;
  }

  get canvasSize(): [number, number] {
    return this.#uniforms.uCanvasSize.value;
  }

  set canvasSize(value: [number, number]) {
    this.#uniforms.uCanvasSize.value = value;
  }

  get baseColor(): [number, number, number] {
    return this.#uniforms.uBaseColor.value;
  }

  set baseColor(value: [number, number, number]) {
    this.#uniforms.uBaseColor.value = value;
  }

  get glowColor(): [number, number, number] {
    return this.#uniforms.uGlowColor.value;
  }

  set glowColor(value: [number, number, number]) {
    this.#uniforms.uGlowColor.value = value;
  }

  get flameIntensity(): number {
    return this.#uniforms.uFlameIntensity.value;
  }

  set flameIntensity(value: number) {
    this.#uniforms.uFlameIntensity.value = value;
  }

  /**
   * Update the filter with current time and amplitude values
   */
  update(deltaTime: number, amplitude: number): void {
    this.time += deltaTime * 0.001; // Convert to seconds
    this.amplitude = amplitude;
  }
}
