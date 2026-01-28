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

// ============== NOISE FUNCTIONS ==============

// Simple hash function
float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

// 2D noise
float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f); // Smoothstep
    
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

// Fractal Brownian Motion for more organic fire
float fbm(vec2 p, int octaves) {
    float value = 0.0;
    float amplitude = 0.5;
    float frequency = 1.0;
    
    for (int i = 0; i < 6; i++) {
        if (i >= octaves) break;
        value += amplitude * noise(p * frequency);
        frequency *= 2.0;
        amplitude *= 0.5;
    }
    
    return value;
}

// ============== FLAME COLOR PALETTE ==============

vec3 fireColor(float t, float intensity) {
    // Fire gradient: black -> red -> orange -> yellow -> white
    vec3 black = vec3(0.0, 0.0, 0.0);
    vec3 darkRed = vec3(0.5, 0.0, 0.0);
    vec3 red = vec3(1.0, 0.1, 0.0);
    vec3 orange = vec3(1.0, 0.4, 0.0);
    vec3 yellow = vec3(1.0, 0.8, 0.2);
    vec3 white = vec3(1.0, 0.95, 0.8);
    
    // Boost colors with intensity
    t = pow(t, mix(1.2, 0.8, intensity));
    
    vec3 color;
    if (t < 0.2) {
        color = mix(black, darkRed, t / 0.2);
    } else if (t < 0.4) {
        color = mix(darkRed, red, (t - 0.2) / 0.2);
    } else if (t < 0.6) {
        color = mix(red, orange, (t - 0.4) / 0.2);
    } else if (t < 0.8) {
        color = mix(orange, yellow, (t - 0.6) / 0.2);
    } else {
        color = mix(yellow, white, (t - 0.8) / 0.2);
    }
    
    return color;
}

// Alternative: Electric/plasma flame colors
vec3 plasmaColor(float t, float intensity) {
    vec3 purple = vec3(0.3, 0.0, 0.5);
    vec3 magenta = vec3(0.8, 0.1, 0.5);
    vec3 pink = vec3(1.0, 0.3, 0.6);
    vec3 cyan = vec3(0.3, 0.8, 1.0);
    vec3 white = vec3(1.0, 0.95, 1.0);
    
    t = pow(t, mix(1.2, 0.7, intensity));
    
    vec3 color;
    if (t < 0.25) {
        color = mix(purple, magenta, t / 0.25);
    } else if (t < 0.5) {
        color = mix(magenta, pink, (t - 0.25) / 0.25);
    } else if (t < 0.75) {
        color = mix(pink, cyan, (t - 0.5) / 0.25);
    } else {
        color = mix(cyan, white, (t - 0.75) / 0.25);
    }
    
    return color;
}

// ============== GLOW SAMPLING ==============

vec4 sampleGlow(vec2 uv, float radius) {
    vec4 sum = vec4(0.0);
    float total = 0.0;
    
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

// ============== MAIN SHADER ==============

void main() {
    vec2 uv = vTextureCoord;
    vec2 pixelCoord = uv * uCanvasSize;
    
    // Sample original texture
    vec4 original = texture(uTexture, uv);
    
    // If no bar content, handle glow/background
    if (original.a < 0.01) {
        // Sample glow from nearby bars
        float glowRadius = uGlowRadius * (1.0 + uAmplitude * 2.0);
        vec4 glow = sampleGlow(uv, glowRadius);
        
        if (glow.a > 0.01) {
            // Add fire glow in transparent areas
            float glowStrength = smoothstep(0.0, 0.4, glow.a) * uGlowIntensity;
            
            // Animated glow noise
            float glowNoise = fbm(pixelCoord * 0.02 + vec2(0.0, -uTime * 60.0), 3);
            glowStrength *= (0.7 + glowNoise * 0.6);
            
            vec3 glowColor = fireColor(glowStrength * (0.3 + uAmplitude * 0.5), uAmplitude);
            
            // Mix with plasma colors based on amplitude for variety
            vec3 plasmaGlow = plasmaColor(glowStrength * 0.5, uAmplitude);
            glowColor = mix(glowColor, plasmaGlow, uAmplitude * 0.3);
            
            finalColor = vec4(glowColor * glowStrength * 1.5, glowStrength * 0.8);
        } else {
            finalColor = vec4(0.0);
        }
        return;
    }
    
    // ============== FLAME EFFECT ON BARS ==============
    
    // Get position relative to bar (0 = bottom, 1 = top of bar content)
    // We need to figure out local Y position within the bar
    // Since bars are centered, we work with screen coordinates
    
    float centerY = uCanvasSize.y * 0.5;
    float distFromCenter = abs(pixelCoord.y - centerY);
    float maxBarHeight = uCanvasSize.y * 0.4; // 80% total, so 40% each direction
    
    // Normalized height (0 at center/base, 1 at tips)
    float normalizedHeight = clamp(distFromCenter / maxBarHeight, 0.0, 1.0);
    
    // Flip so flames rise upward (or both directions from center)
    float flameProgress = normalizedHeight;
    
    // ============== PROCEDURAL FLAME NOISE ==============
    
    // Multiple noise layers for turbulent flames
    float timeScale = uTime * (1.5 + uAmplitude * 2.0);
    
    // Base turbulence - large scale movement
    vec2 turbulenceCoord = pixelCoord * 0.015;
    turbulenceCoord.y -= timeScale * 40.0; // Flames rise upward
    float turbulence1 = fbm(turbulenceCoord, 4);
    
    // Fine detail - small flickering
    vec2 detailCoord = pixelCoord * 0.04;
    detailCoord.y -= timeScale * 80.0;
    float turbulence2 = fbm(detailCoord + vec2(uTime * 10.0, 0.0), 3);
    
    // Edge distortion - makes flame edges wavy
    vec2 edgeCoord = pixelCoord * 0.025;
    edgeCoord.y -= timeScale * 50.0;
    float edgeNoise = fbm(edgeCoord, 5);
    
    // Combine turbulence
    float combinedTurbulence = turbulence1 * 0.6 + turbulence2 * 0.4;
    
    // ============== FLAME SHAPE ==============
    
    // Flame intensity decreases toward tips
    float flameBase = 1.0 - pow(flameProgress, 1.5);
    
    // Add turbulence to create flickering edges
    float flameMask = flameBase + (combinedTurbulence - 0.5) * 0.4 * (1.0 + uAmplitude);
    
    // Sharpen the flame edges
    flameMask = smoothstep(0.1, 0.5, flameMask);
    
    // Boost flame with amplitude
    flameMask *= (0.7 + uAmplitude * 0.6);
    
    // ============== FLAME COLORING ==============
    
    // Color based on position and turbulence
    float colorIndex = flameBase * 0.7 + combinedTurbulence * 0.3;
    colorIndex = clamp(colorIndex, 0.0, 1.0);
    
    // Hot core at center, cooler at edges
    float coreHeat = 1.0 - normalizedHeight * 0.5;
    colorIndex *= coreHeat;
    
    // Get flame color
    vec3 flameCol = fireColor(colorIndex, uAmplitude);
    
    // Add electric/plasma tints at high amplitude
    if (uAmplitude > 0.3) {
        vec3 plasmaCol = plasmaColor(colorIndex * 0.8 + turbulence2 * 0.2, uAmplitude);
        float plasmaBlend = (uAmplitude - 0.3) / 0.7;
        // Subtle plasma hints
        flameCol = mix(flameCol, plasmaCol, plasmaBlend * 0.25 * turbulence1);
    }
    
    // ============== EMBERS / SPARKS ==============
    
    float sparkNoise = noise(pixelCoord * 0.1 + vec2(uTime * 20.0, -uTime * 100.0));
    float sparks = pow(sparkNoise, 8.0) * flameProgress * uAmplitude * 3.0;
    vec3 sparkColor = vec3(1.0, 0.9, 0.5); // Bright yellow-white sparks
    
    // ============== COMBINE EFFECTS ==============
    
    // Base bar with flame overlay
    vec3 result = original.rgb;
    
    // Apply flame color
    result = mix(result, flameCol, flameMask * uFlameIntensity);
    
    // Add bright core
    float coreIntensity = pow(1.0 - normalizedHeight, 3.0) * (0.5 + uAmplitude * 0.5);
    result += vec3(1.0, 0.8, 0.3) * coreIntensity * 0.3 * uFlameIntensity;
    
    // Add sparks
    result += sparkColor * sparks * uFlameIntensity;
    
    // Add subtle pulsing glow
    float pulse = sin(uTime * 4.0 + pixelCoord.x * 0.05) * 0.5 + 0.5;
    result *= 1.0 + pulse * 0.1 * uAmplitude;
    
    // ============== CHROMATIC ABERRATION ==============
    
    if (uAmplitude > 0.5) {
        float aberration = (uAmplitude - 0.5) * 0.005;
        float r = texture(uTexture, uv + vec2(aberration, 0.0)).a;
        float b = texture(uTexture, uv - vec2(aberration, 0.0)).a;
        result.r += r * 0.1 * (uAmplitude - 0.5);
        result.b += b * 0.05 * (uAmplitude - 0.5);
    }
    
    // ============== OUTPUT ==============
    
    // Ensure we preserve alpha for proper blending
    finalColor = vec4(result, original.a);
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
