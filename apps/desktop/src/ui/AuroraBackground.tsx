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

    for(int i = 0; i < 4; i++) {
        value += amplitude * smoothNoise(p);
        p *= 2.0;
        amplitude *= 0.5;
    }

    return value;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord / iResolution.xy;
    float time = iTime * u_speed;

    float verticalGradient = 1.0 - abs(uv.y - 0.42) * 1.85;
    verticalGradient = pow(max(verticalGradient, 0.0), u_stretch);

    vec2 flowUV = vec2(uv.x + time * 0.08, uv.y * 0.95);

    float aurora1 = fractalNoise(flowUV * u_frequency * 3.0 + vec2(time * 0.18, 0.0));
    float aurora2 = fractalNoise(flowUV * u_frequency * 2.1 + vec2(time * 0.12, 1000.0));
    float aurora3 = fractalNoise(flowUV * u_frequency * 3.8 + vec2(time * 0.22, 2000.0));

    float wave1 = sin(uv.x * 7.0 + time * 1.7) * 0.09;
    float wave2 = sin(uv.x * 11.0 + time * 1.2) * 0.045;

    float distortedY = uv.y + wave1 + wave2;

    aurora1 *= smoothstep(0.22, 0.62, distortedY) * smoothstep(0.92, 0.55, distortedY);
    aurora2 *= smoothstep(0.3, 0.55, distortedY) * smoothstep(0.85, 0.48, distortedY);
    aurora3 *= smoothstep(0.28, 0.58, distortedY) * smoothstep(0.88, 0.5, distortedY);

    float combinedAurora = (aurora1 * 0.55 + aurora2 * 0.85 + aurora3 * 0.45) * verticalGradient;
    combinedAurora *= u_intensity;

    // Electric violet / blue — matches Fixo Galaxy reference
    vec3 color1 = vec3(0.48, 0.36, 1.0);
    vec3 color2 = vec3(0.31, 0.55, 1.0);
    vec3 color3 = vec3(0.78, 0.49, 1.0);
    vec3 color4 = vec3(1.0, 0.42, 0.62);

    float colorMix1 = smoothstep(0.15, 0.4, uv.y);
    float colorMix2 = smoothstep(0.38, 0.58, uv.y);
    float colorMix3 = smoothstep(0.55, 0.82, uv.y);

    vec3 finalColor = mix(color1, color2, colorMix1);
    finalColor = mix(finalColor, color3, colorMix2);
    finalColor = mix(finalColor, color4, colorMix3);

    vec3 desaturated = vec3(dot(finalColor, vec3(0.299, 0.587, 0.114)));
    finalColor = mix(desaturated, finalColor, u_vibrancy);

    finalColor *= combinedAurora;

    float horizonGlow = exp(-abs(uv.y - 0.45) * 7.0) * 0.14;
    finalColor += finalColor * horizonGlow;

    // Cosmic base #0B0B1A
    vec3 space = vec3(0.043, 0.043, 0.102);
    finalColor = space + finalColor * 0.9;

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
  speed = 0.5,
  intensity = 1.2,
  vibrancy = 1.25,
  frequency = 0.85,
  stretch = 1.05,
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
