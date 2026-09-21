# Fixo

دستیار هوش مصنوعی تعمیرات نرم‌افزاری موبایل برای مغازه‌های تعمیرات — فاز اول فقط **اندروید** و **خاموش/روشن کردن اینترنت گوشی**.

## فاز اول

1. گوشی را با USB به سیستم لینوکس وصل کن (USB debugging)
2. Agent وضعیت شبکه را می‌خواند
3. تعمیرکار به فارسی می‌گوید اینترنت را خاموش/روشن کند
4. بعد از تأیید، Wi‑Fi / دیتای موبایل / حالت هواپیما تغییر می‌کند

## ساختار

```
apps/desktop          UI + Agent محلی (OpenAI)
packages/mcp-network  MCP سرور و کتابخانه ADB شبکه
packages/shared       schemaهای مشترک
```

## پیش‌نیاز

- Node.js 22+
- pnpm 9+
- `adb` (Android platform-tools) روی PATH
- کلید OpenAI در فایل `.env` (از روی `.env.example`)

```bash
cp .env.example .env
# OPENAI_API_KEY=sk-...
# OPENAI_MODEL=gpt-4.1
```

## اجرا

```bash
pnpm install
pnpm --filter @fixo/shared build
pnpm --filter @fixo/mcp-network build
pnpm --filter @fixo/desktop dev
```

در ترمینال دیگر UI:

```bash
pnpm --filter @fixo/desktop exec vite --host 127.0.0.1
```

سپس باز کن: `http://127.0.0.1:5173`

API محلی: `http://127.0.0.1:8787`

### فقط MCP

```bash
pnpm --filter @fixo/mcp-network dev
```

## ابزارهای MCP

| Tool | کار |
|------|-----|
| `list_devices` | لیست دستگاه‌های ADB |
| `get_device_info` | مدل و نسخه اندروید |
| `get_network_status` | وضعیت Wi‑Fi / دیتا / هواپیما / SSID |
| `set_wifi` | روشن/خاموش Wi‑Fi (نیاز به تأیید) |
| `set_mobile_data` | روشن/خاموش دیتا (نیاز به تأیید) |
| `set_airplane_mode` | روشن/خاموش حالت هواپیما (نیاز به تأیید) |
| `connect_wifi` | وصل به SSID/رمز (Samsung + Xiaomi fallback) |
| `forget_wifi` | فراموش کردن شبکه ذخیره‌شده |

وای‌فای مغازه از UI یا Agent با تنظیمات محلی (`~/.config/fixo/settings.json` یا `SHOP_WIFI_*` در `.env`) کار می‌کند.

### اتصال خودکار مغازه
وقتی `AUTO_SHOP_WIFI=1` (پیش‌فرض) و رمز مغازه ست شده باشد:
1. با وصل USB، Wi‑Fi روشن و به SSID مغازه وصل می‌شود (بدون تأیید)
2. ADB بی‌سیم فعال می‌شود
3. با قطع کابل، همان شبکه از روی گوشی فراموش می‌شود

## امنیت

- فایل `.env` را commit نکن
- نصب اپ از Play و بقیه قابلیت‌ها در فازهای بعدی می‌آید
