import { AdbError, type AdbRunner, getprop, shell } from "./adb.js";
import { setWifi } from "./network.js";

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function redactEvidence(line: string, password?: string): string {
  if (!password) return line;
  return line.split(password).join("***");
}

export async function detectOem(
  adb: AdbRunner,
  serial: string,
): Promise<{ manufacturer: string; brand: string; evidence: string[] }> {
  const evidence: string[] = [];
  const manufacturer = (await getprop(adb, serial, "ro.product.manufacturer")) ?? "";
  const brand = (await getprop(adb, serial, "ro.product.brand")) ?? "";
  evidence.push(`oem manufacturer=${manufacturer} brand=${brand}`);
  return { manufacturer, brand, evidence };
}

export async function readWifiSsid(
  adb: AdbRunner,
  serial: string,
): Promise<{ ssid: string | null; evidence: string[] }> {
  const evidence: string[] = [];

  const status = await shell(adb, serial, "cmd wifi status");
  evidence.push(status.evidence);
  const fromStatus = status.stdout.match(/Wifi is connected to "([^"]+)"/i);
  if (fromStatus?.[1] && fromStatus[1] !== "<unknown ssid>") {
    return { ssid: fromStatus[1], evidence };
  }

  const dump = await shell(
    adb,
    serial,
    "dumpsys wifi | grep -E 'mWifiInfo|SSID:|Supplicant state:' | head -n 20",
  );
  evidence.push(dump.evidence);
  const matches = [...dump.stdout.matchAll(/SSID:\s*"?([^,"\n]+)"?/gi)];
  for (const m of matches) {
    const ssid = m[1]?.trim();
    if (ssid && ssid !== "<unknown ssid>" && ssid !== "0x") {
      return { ssid, evidence };
    }
  }

  return { ssid: null, evidence };
}

export async function connectWifi(
  adb: AdbRunner,
  serial: string,
  ssid: string,
  password: string,
): Promise<{ strategy: string; evidence: string[]; connected: boolean; wifiSsid: string | null }> {
  const evidence: string[] = [];
  const oem = await detectOem(adb, serial);
  evidence.push(...oem.evidence);

  const enable = await setWifi(adb, serial, true);
  evidence.push(...enable.evidence.map((e) => redactEvidence(e, password)));
  await sleep(1200);

  const quotedSsid = shellQuote(ssid);
  const quotedPass = shellQuote(password);

  const strategies: Array<{ name: string; command: string }> = [
    {
      name: "cmd_wifi_connect_wpa2",
      command: `cmd wifi connect-network ${quotedSsid} wpa2 ${quotedPass}`,
    },
    {
      name: "cmd_wifi_connect_wpa3",
      command: `cmd wifi connect-network ${quotedSsid} wpa3 ${quotedPass}`,
    },
    // Some Samsung/Xiaomi builds accept security type differently
    {
      name: "cmd_wifi_connect_wpa2_unquoted_type",
      command: `cmd wifi connect-network ${quotedSsid} wpa2 ${quotedPass}`,
    },
  ];

  // Xiaomi sometimes needs an explicit save/connect via cmd wifi help probing
  const help = await shell(adb, serial, "cmd wifi help");
  evidence.push(redactEvidence(help.evidence, password));

  let lastStrategy = "none";
  for (const strategy of strategies) {
    lastStrategy = strategy.name;
    const result = await shell(adb, serial, strategy.command, 20_000);
    evidence.push(redactEvidence(result.evidence, password));
    await sleep(2500);
    const ssidRead = await readWifiSsid(adb, serial);
    evidence.push(...ssidRead.evidence);
    const connected =
      ssidRead.ssid !== null &&
      ssidRead.ssid.toLowerCase() === ssid.toLowerCase();
    if (connected) {
      return {
        strategy: strategy.name,
        evidence,
        connected: true,
        wifiSsid: ssidRead.ssid,
      };
    }
    // Treat empty error + later connection as soft success on some OEMs
    if (
      result.code === 0 &&
      !/error|fail|denied|exception/i.test(`${result.stdout}\n${result.stderr}`)
    ) {
      // keep trying verify once more
      await sleep(2000);
      const again = await readWifiSsid(adb, serial);
      evidence.push(...again.evidence);
      if (again.ssid && again.ssid.toLowerCase() === ssid.toLowerCase()) {
        return {
          strategy: strategy.name,
          evidence,
          connected: true,
          wifiSsid: again.ssid,
        };
      }
    }
  }

  // Open settings wifi as last-resort assistive path (no password typing automation here)
  const openSettings = await shell(
    adb,
    serial,
    "am start -a android.settings.WIFI_SETTINGS",
  );
  evidence.push(openSettings.evidence);

  throw new AdbError(
    `Could not connect to Wi-Fi "${ssid}" on ${oem.manufacturer || "device"} via ADB. Tried cmd wifi connect-network (wpa2/wpa3). Opened Wi-Fi settings on phone as fallback. Last strategy: ${lastStrategy}`,
    evidence,
  );
}

export async function forgetWifi(
  adb: AdbRunner,
  serial: string,
  ssid: string,
): Promise<{ strategy: string; evidence: string[]; forgotten: boolean }> {
  const evidence: string[] = [];
  const oem = await detectOem(adb, serial);
  evidence.push(...oem.evidence);

  const list = await shell(adb, serial, "cmd wifi list-networks");
  evidence.push(list.evidence);

  const lines = list.stdout.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const matches: string[] = [];
  for (const line of lines) {
    // Typical: Network Id: 1 SSID: "nibero" ...
    if (line.toLowerCase().includes(ssid.toLowerCase())) {
      const idMatch = line.match(/(?:NetworkId|Network Id|id)[:=\s]+(\d+)/i) || line.match(/^(\d+)\b/);
      if (idMatch?.[1]) matches.push(idMatch[1]);
    }
  }

  // Alternate parse: "1\tnibero\t..." styles
  if (matches.length === 0) {
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 2 && parts.slice(1).join(" ").toLowerCase().includes(ssid.toLowerCase())) {
        if (/^\d+$/.test(parts[0]!)) matches.push(parts[0]!);
      }
    }
  }

  if (matches.length === 0) {
    return {
      strategy: "list_networks_no_match",
      evidence,
      forgotten: true, // already not saved
    };
  }

  let forgottenAny = false;
  for (const id of matches) {
    const forget = await shell(adb, serial, `cmd wifi forget-network ${id}`);
    evidence.push(forget.evidence);
    if (forget.code === 0 || /success|ok/i.test(forget.stdout + forget.stderr)) {
      forgottenAny = true;
    }
  }

  if (!forgottenAny) {
    throw new AdbError(
      `Found network "${ssid}" but forget-network failed on ${oem.manufacturer || "device"}.`,
      evidence,
    );
  }

  return {
    strategy: "cmd_wifi_forget_network",
    evidence,
    forgotten: true,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
