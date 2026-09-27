import type { ReactElement, ReactNode } from "react";

type IconProps = { size?: number; className?: string };

function Svg({
  size = 22,
  className,
  children,
}: IconProps & { children: ReactNode }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

const stroke = {
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconHome(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" {...stroke} />
    </Svg>
  );
}

export function IconAgent(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5V14a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 2.8c-.5.35-1.2.02-1.2-.55V6.5Z"
        {...stroke}
      />
    </Svg>
  );
}

export function IconBench(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7 4h10a1 1 0 0 1 1 1v3H6V5a1 1 0 0 1 1-1Z" {...stroke} />
      <path
        d="M6 10h12l-1.2 1.2v6.3a1 1 0 0 1-1 1H8.2a1 1 0 0 1-1-1v-6.3L6 10Z"
        {...stroke}
      />
    </Svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="3.2" {...stroke} />
      <path
        d="M12 3.5v2.2M12 18.3v2.2M4.9 6.4l1.6 1.6M17.5 16l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.6l1.6-1.6M17.5 8l1.6-1.6"
        {...stroke}
      />
    </Svg>
  );
}

export function IconNetwork(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 20v-6" {...stroke} />
      <path d="M5 14a9 9 0 0 1 14 0" {...stroke} />
      <path d="M2.5 10.5a13 13 0 0 1 19 0" {...stroke} />
      <circle cx="12" cy="20" r="1.2" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconBattery(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="7" width="15" height="10" rx="2" {...stroke} />
      <path d="M18.5 10.5h1.8v3H18.5" {...stroke} />
      <path d="M6.5 10h7v4h-7z" fill="currentColor" stroke="none" opacity="0.55" />
    </Svg>
  );
}

export function IconDisplay(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3" y="4.5" width="18" height="12" rx="2" {...stroke} />
      <path d="M8 20h8M12 16.5V20" {...stroke} />
    </Svg>
  );
}

export function IconAudio(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 10v4h3.5L12 18V6L7.5 10H4Z" {...stroke} />
      <path d="M15.5 9.5a3.2 3.2 0 0 1 0 5" {...stroke} />
      <path d="M17.8 7a6 6 0 0 1 0 10" {...stroke} />
    </Svg>
  );
}

export function IconApps(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" {...stroke} />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" {...stroke} />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" {...stroke} />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4" {...stroke} />
    </Svg>
  );
}

export function IconStorage(props: IconProps) {
  return (
    <Svg {...props}>
      <ellipse cx="12" cy="6.5" rx="7.5" ry="2.8" {...stroke} />
      <path d="M4.5 6.5v5c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8v-5" {...stroke} />
      <path d="M4.5 11.5v5c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8v-5" {...stroke} />
    </Svg>
  );
}

export function IconPerformance(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M13 3 5.5 13.5H12l-1 7.5L18.5 10H12l1-7Z" {...stroke} />
    </Svg>
  );
}

export function IconSecurity(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M12 3.5 19 6.5v5.2c0 4.3-2.9 7.3-7 8.8-4.1-1.5-7-4.5-7-8.8V6.5L12 3.5Z"
        {...stroke}
      />
      <path d="M9.5 12.2 11.2 14l3.5-3.8" {...stroke} />
    </Svg>
  );
}

export function IconUsb(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 4v9.5" {...stroke} />
      <circle cx="12" cy="16.5" r="2.2" {...stroke} />
      <path d="M8 8.5h8M9.5 8.5V6.2a.7.7 0 0 1 .7-.7h3.6a.7.7 0 0 1 .7.7V8.5" {...stroke} />
      <path d="M7 12.5h3M14 12.5h3" {...stroke} />
    </Svg>
  );
}

export function IconSim(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M7 4.5h7.2L19 9.3V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 7 19V4.5Z"
        {...stroke}
      />
      <rect x="9.2" y="11" width="5.6" height="5.2" rx="1" {...stroke} />
    </Svg>
  );
}

export function IconNotifications(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M6.5 16.5h11l-1.2-1.4V11a4.3 4.3 0 1 0-8.6 0v4.1L6.5 16.5Z"
        {...stroke}
      />
      <path d="M10.2 18.2a1.8 1.8 0 0 0 3.6 0" {...stroke} />
    </Svg>
  );
}

export function IconCamera(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M4.5 8.5h3l1.4-2h6.2l1.4 2H19.5A1.5 1.5 0 0 1 21 10v7.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5V10a1.5 1.5 0 0 1 1.5-1.5Z"
        {...stroke}
      />
      <circle cx="12" cy="13.5" r="3" {...stroke} />
    </Svg>
  );
}

export function IconLocation(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M12 21s6.5-5.2 6.5-10.2A6.5 6.5 0 0 0 5.5 10.8C5.5 15.8 12 21 12 21Z"
        {...stroke}
      />
      <circle cx="12" cy="10.5" r="2.2" {...stroke} />
    </Svg>
  );
}

export function IconSystem(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4" y="4" width="16" height="16" rx="3" {...stroke} />
      <path d="M8 12h8M12 8v8" {...stroke} />
    </Svg>
  );
}

export function IconDiagnostics(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M9 4h6v3.5H9V4Z" {...stroke} />
      <path d="M10.5 7.5h3v3.2l2.8 5.3a2.4 2.4 0 0 1-2.1 3.5h-4.4a2.4 2.4 0 0 1-2.1-3.5l2.8-5.3V7.5Z" {...stroke} />
    </Svg>
  );
}

export function IconDateTime(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="8" {...stroke} />
      <path d="M12 7.5V12l3.2 2" {...stroke} />
    </Svg>
  );
}

export function IconDashboard(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 13.5a8 8 0 1 1 16 0" {...stroke} />
      <path d="M12 13.5 16.2 8.8" {...stroke} />
      <circle cx="12" cy="13.5" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconChevron({
  size = 18,
  className,
  direction = "end",
}: IconProps & { direction?: "end" | "down" | "start" }) {
  const rot =
    direction === "down" ? "90" : direction === "start" ? "180" : "0";
  return (
    <Svg size={size} className={className}>
      <g transform={`rotate(${rot} 12 12)`}>
        <path d="M9 5.5 15.5 12 9 18.5" {...stroke} />
      </g>
    </Svg>
  );
}

export function IconPalette(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M12 4a8 8 0 1 0 0 16h1.6a2.4 2.4 0 0 0 0-4.8H12a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 3.1 2.4"
        {...stroke}
      />
      <circle cx="8.2" cy="10.2" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10.2" cy="7.4" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.2" cy="7.4" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="16.2" cy="10.2" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconShield(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M12 3.5 19 6.5v5.2c0 4.3-2.9 7.3-7 8.8-4.1-1.5-7-4.5-7-8.8V6.5L12 3.5Z"
        {...stroke}
      />
    </Svg>
  );
}

export function IconMail(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="3.5" y="6" width="17" height="12" rx="2" {...stroke} />
      <path d="m4.5 7.5 7.5 5.5 7.5-5.5" {...stroke} />
    </Svg>
  );
}

export function IconWrench(props: IconProps) {
  return (
    <Svg {...props}>
      <path
        d="M14.5 5.2a3.8 3.8 0 0 0-4.8 4.8L4.5 15.2v4.3H8.8l5.2-5.2a3.8 3.8 0 0 0 4.8-4.8l-2.3 2.3-2.1-2.1 2.3-2.3Z"
        {...stroke}
      />
    </Svg>
  );
}

export const CATEGORY_ICONS: Record<string, (props: IconProps) => ReactElement> = {
  dashboard: IconDashboard,
  battery: IconBattery,
  display: IconDisplay,
  network: IconNetwork,
  audio: IconAudio,
  apps: IconApps,
  storage: IconStorage,
  performance: IconPerformance,
  security: IconSecurity,
  usb: IconUsb,
  sim: IconSim,
  notifications: IconNotifications,
  camera: IconCamera,
  location: IconLocation,
  system: IconSystem,
  diagnostics: IconDiagnostics,
  datetime: IconDateTime,
};
