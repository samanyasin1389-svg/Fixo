import { Shader } from "react-shaders";

const auroraShader = `
float noise(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);

    float a = noise(i);
    float b = noise(i + vec2(1.0, 0.0));
    float c = noise(i + vec2(0.0, 1.0));
    float d = noise(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

float fractalNoise(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for(int i = 0; i < 5; i++) {
        value += amplitude * smoothNoise(p);
        p *= 2.05;
        amplitude *= 0.5;
    }

    return value;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.xy;
    float time = iTime * u_speed;

    // Soft vertical band across the whole sky
    float verticalGradient = 1.0 - abs(uv.y - 0.48) * 1.55;
    verticalGradient = pow(max(verticalGradient, 0.0), u_stretch);

    vec2 flowUV = vec2(uv.x * 1.05 + time * 0.07, uv.y * 0.9);

    float aurora1 = fractalNoise(flowUV * u_frequency * 2.8 + vec2(time * 0.16, 0.0));
    float aurora2 = fractalNoise(flowUV * u_frequency * 2.0 + vec2(time * 0.11, 900.0));
    float aurora3 = fractalNoise(flowUV * u_frequency * 3.6 + vec2(time * 0.2, 1900.0));

    float wave1 = sin(uv.x * 6.5 + time * 1.5) * 0.1;
    float wave2 = sin(uv.x * 10.5 + time * 1.05) * 0.05;
    float distortedY = uv.y + wave1 + wave2;

    aurora1 *= smoothstep(0.08, 0.55, distortedY) * smoothstep(0.98, 0.42, distortedY);
    aurora2 *= smoothstep(0.15, 0.5, distortedY) * smoothstep(0.92, 0.38, distortedY);
    aurora3 *= smoothstep(0.12, 0.52, distortedY) * smoothstep(0.95, 0.4, distortedY);

    float combinedAurora = (aurora1 * 0.7 + aurora2 * 1.0 + aurora3 * 0.55) * verticalGradient;
    combinedAurora *= u_intensity;

    // Neon violet / electric blue / magenta — reference galaxy
    vec3 color1 = vec3(0.55, 0.28, 1.0);
    vec3 color2 = vec3(0.22, 0.48, 1.0);
    vec3 color3 = vec3(0.75, 0.35, 0.98);
    vec3 color4 = vec3(0.2, 0.85, 0.95);

    float colorMix1 = smoothstep(0.1, 0.38, uv.y);
    float colorMix2 = smoothstep(0.32, 0.58, uv.y);
    float colorMix3 = smoothstep(0.5, 0.85, uv.y);

    vec3 finalColor = mix(color1, color2, colorMix1);
    finalColor = mix(finalColor, color3, colorMix2);
    finalColor = mix(finalColor, color4, colorMix3);

    vec3 desaturated = vec3(dot(finalColor, vec3(0.299, 0.587, 0.114)));
    finalColor = mix(desaturated, finalColor, u_vibrancy);

    finalColor *= combinedAurora;

    float horizonGlow = exp(-abs(uv.y - 0.42) * 5.5) * 0.22;
    finalColor += finalColor * horizonGlow;

    // Corner nebula blooms
    float cornerL = exp(-length(uv - vec2(0.05, 0.15)) * 3.2) * 0.35;
    float cornerR = exp(-length(uv - vec2(0.95, 0.2)) * 2.8) * 0.28;
    finalColor += vec3(0.45, 0.2, 0.9) * cornerL;
    finalColor += vec3(0.15, 0.45, 1.0) * cornerR;

    // Cosmic base #050510
    vec3 space = vec3(0.02, 0.02, 0.063);
    finalColor = space + finalColor * 1.15;

    finalColor = clamp(finalColor, 0.0, 1.0);
    fragColor = vec4(finalColor, 1.0);
}
`;

type Props = {
  speed?: number;
  intensity?: number;
  vibrancy?: number;
  frequency?: number;
  stretch?: number;
};

export function AuroraBackground({
  speed = 0.42,
  intensity = 1.45,
  vibrancy = 1.35,
  frequency = 0.78,
  stretch = 0.95,
}: Props) {
  return (
    <div className="aurora-bg" aria-hidden="true">
      <Shader
        fs={auroraShader}
        style={{ width: "100%", height: "100%" } as CSSStyleDeclaration}
        uniforms={{
          u_speed: { type: "1f", value: speed },
          u_intensity: { type: "1f", value: intensity },
          u_vibrancy: { type: "1f", value: vibrancy },
          u_frequency: { type: "1f", value: frequency },
          u_stretch: { type: "1f", value: stretch },
        }}
      />
    </div>
  );
}
