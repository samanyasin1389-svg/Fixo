# Fixo

چت‌بات محلی روی سیستم خودت — مدل هوش مصنوعی با **Ollama** اجرا می‌شود و پاسخ‌ها از اینترنت نمی‌آیند.

## سخت‌افزار پیشنهادی

- CPU چند‌هسته‌ای
- حداقل ۸ گیگ RAM (۱۶ گیگ بهتر است)
- مدل پیش‌فرض: `qwen2.5:3b` (مناسب CPU بدون GPU)

## نصب و اجرا

```bash
# ۱) نصب Ollama (یک‌بار)
curl -fsSL https://ollama.com/install.sh | sh

# ۲) اجرای Fixo
chmod +x start.sh
./start.sh
```

بعد برو به: [http://127.0.0.1:7860](http://127.0.0.1:7860)

اولین اجرا مدل را دانلود می‌کند (~۲ گیگ).

### تغییر مدل

```bash
FIXO_MODEL=llama3.2:3b ./start.sh
```

مدل‌های سبک پیشنهادی: `qwen2.5:3b`، `llama3.2:3b`، `phi3:mini`، `gemma2:2b`

## ساختار

- `app/main.py` — سرور FastAPI و اتصال به Ollama
- `static/` — رابط چت فارسی (RTL)
- `start.sh` — روشن کردن Ollama، دانلود مدل، اجرای وب‌اپ

## API

- `GET /api/health` — وضعیت Ollama و مدل
- `POST /api/chat` — گفتگو با استریم NDJSON
