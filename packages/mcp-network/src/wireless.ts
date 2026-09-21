import { AdbError, type AdbRunner, shell } from "./adb.js";

export async function getWifiIpv4(
  adb: AdbRunner,
  serial: string,
): Promise<{ ip: string | null; evidence: string[] }> {
  const evidence: string[] = [];
  const candidates = [
    "ip -f inet addr show wlan0",
    "ip -f inet addr show wlan1",
    "ip route get 8.8.8.8",
  ];

  for (const command of candidates) {
    const result = await shell(adb, serial, command);
    evidence.push(result.evidence);
    const inet = result.stdout.match(/inet\s+(\d+\.\d+\.\d+\.\d+)/);
    if (inet?.[1] && !inet[1].startsWith("127.")) {
      return { ip: inet[1], evidence };
    }
    const src = result.stdout.match(/src\s+(\d+\.\d+\.\d+\.\d+)/);
    if (src?.[1] && !src[1].startsWith("127.")) {
      return { ip: src[1], evidence };
    }
  }

  return { ip: null, evidence };
}

export async function enableWirelessAdb(
  adb: AdbRunner,
  serial: string,
  port = 5555,
): Promise<{ wirelessSerial: string; ip: string; evidence: string[] }> {
  const evidence: string[] = [];
  const ipInfo = await getWifiIpv4(adb, serial);
  evidence.push(...ipInfo.evidence);
  if (!ipInfo.ip) {
    throw new AdbError(
      "Wi-Fi IP not found after connecting. Cannot keep wireless ADB for forget-on-unplug.",
      evidence,
    );
  }

  const tcpip = await adb.run(["-s", serial, "tcpip", String(port)], {
    timeoutMs: 10_000,
  });
  evidence.push(
    `adb -s ${serial} tcpip ${port}\nexit=${tcpip.code}\nstdout=${tcpip.stdout.trim()}\nstderr=${tcpip.stderr.trim()}`,
  );
  await sleep(1200);

  const wirelessSerial = `${ipInfo.ip}:${port}`;
  const connect = await adb.run(["connect", wirelessSerial], { timeoutMs: 10_000 });
  evidence.push(
    `adb connect ${wirelessSerial}\nexit=${connect.code}\nstdout=${connect.stdout.trim()}\nstderr=${connect.stderr.trim()}`,
  );

  if (
    connect.code !== 0 &&
    !/connected|already connected/i.test(connect.stdout + connect.stderr)
  ) {
    throw new AdbError(
      `Wireless ADB connect failed for ${wirelessSerial}`,
      evidence,
    );
  }

  return { wirelessSerial, ip: ipInfo.ip, evidence };
}

export async function disconnectWirelessAdb(
  adb: AdbRunner,
  wirelessSerial: string,
): Promise<{ evidence: string[] }> {
  const result = await adb.run(["disconnect", wirelessSerial], { timeoutMs: 8_000 });
  return {
    evidence: [
      `adb disconnect ${wirelessSerial}\nexit=${result.code}\nstdout=${result.stdout.trim()}\nstderr=${result.stderr.trim()}`,
    ],
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
