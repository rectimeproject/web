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
precision mediump float;

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

// Soft glow sampling with variable kernel
vec4 sampleGlow(vec2 uv, float radius) {
    vec4 sum = vec4(0.0);
    float total = 0.0;
    
    // 13-tap blur for smoother glow
    for (float x = -2.0; x <= 2.0; x += 1.0) {
        for (float y = -2.0; y <= 2.0; y += 1.0) {
            vec2 offset = vec2(x, y) * radius / uCanvasSize;
            float dist = length(vec2(x, y));
            float weight = exp(-dist * dist * 0.15);
            sum += texture(uTexture, uv + offset) * weight;
            total += weight;
        }
    }
    
    return sum / total;
}

// HSV to RGB conversion for rainbow effects
vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec2 uv = vTextureCoord;
    
    // Sample original texture
    vec4 original = texture(uTexture, uv);
    
    // Create glow effect - radius increases with amplitude
    float dynamicRadius = uGlowRadius * (1.0 + uAmplitude * 1.5);
    vec4 glow = sampleGlow(uv, dynamicRadius);
    
    // Multi-frequency pulsing animation
    float pulse1 = sin(uTime * 2.5) * 0.5 + 0.5;
    float pulse2 = sin(uTime * 4.0 + 1.5) * 0.3 + 0.7;
    float pulse = mix(pulse1, pulse2, 0.5);
    float pulseIntensity = mix(0.85, 1.15, pulse * uAmplitude);
    
    // Dynamic color based on amplitude and time
    // Low amplitude: cool colors (cyan/blue)
    // High amplitude: warm colors (magenta/pink)
    float hueShift = uTime * 0.1 + uAmplitude * 0.3;
    vec3 dynamicColor = hsv2rgb(vec3(
        0.55 + uAmplitude * 0.25 + sin(hueShift) * 0.1, // Hue: cyan to magenta
        0.6 + uAmplitude * 0.3,                          // Saturation increases with amplitude
        0.8 + uAmplitude * 0.2                           // Value increases with amplitude
    ));
    
    // Blend base color with dynamic color
    vec3 colorMix = mix(uBaseColor, dynamicColor, 0.6 + uAmplitude * 0.4);
    
    // Apply color tint to the glow
    vec4 tintedGlow = vec4(glow.rgb * colorMix * pulseIntensity, glow.a);
    
    // Calculate glow mask with smoother falloff
    float glowStrength = smoothstep(0.0, 0.3, glow.a);
    float glowMask = glowStrength * uGlowIntensity * (0.6 + uAmplitude * 0.8);
    
    // Outer glow color (more saturated version of glow color)
    vec3 outerGlowColor = mix(uGlowColor, dynamicColor, 0.5);
    vec4 outerGlow = vec4(outerGlowColor * glowMask, glowMask * 0.7);
    
    // Start with original
    vec4 result = original;
    
    // Tint the bars based on amplitude
    result.rgb = mix(result.rgb, colorMix, original.a * (0.2 + uAmplitude * 0.5));
    
    // Add outer glow where original is transparent
    float outerGlowBlend = (1.0 - original.a) * glowMask;
    result = mix(result, outerGlow, outerGlowBlend);
    
    // Add bloom overlay
    result.rgb += tintedGlow.rgb * uGlowIntensity * 0.25 * (1.0 + uAmplitude * 0.5);
    
    // Chromatic aberration on high amplitude
    float aberrationStrength = smoothstep(0.4, 1.0, uAmplitude);
    if (aberrationStrength > 0.0) {
        float aberration = aberrationStrength * 0.004;
        float r = texture(uTexture, uv + vec2(aberration, 0.0)).r;
        float b = texture(uTexture, uv - vec2(aberration, 0.0)).b;
        result.r = mix(result.r, r * colorMix.r, aberrationStrength * 0.6);
        result.b = mix(result.b, b * colorMix.b, aberrationStrength * 0.6);
    }
    
    // Vignette effect - subtle darkening at edges
    vec2 vignetteUV = uv * 2.0 - 1.0;
    float vignette = 1.0 - dot(vignetteUV * 0.3, vignetteUV * 0.3);
    result.rgb *= mix(0.9, 1.0, vignette);
    
    finalColor = result;
}
`;

export interface TimelineGlowFilterOptions {
  canvasSize?: [number, number];
  glowIntensity?: number;
  glowRadius?: number;
  baseColor?: [number, number, number];
  glowColor?: [number, number, number];
}

/**
 * A custom PixiJS filter that adds glow, color shifting, and chromatic aberration
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
      glowColor = [0.9, 0.3, 0.7] // Magenta-ish
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
      uCanvasSize: {value: canvasSize, type: "vec2<f32>" as const}
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

  /**
   * Update the filter with current time and amplitude values
   */
  update(deltaTime: number, amplitude: number): void {
    this.time += deltaTime * 0.001; // Convert to seconds
    this.amplitude = amplitude;
  }
}
