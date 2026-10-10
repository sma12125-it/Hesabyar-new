# راهنمای جامع استقرار سرور حسابیار روی Render (Render Deployment Guide)

این راهنما مراحل دقیق استقرار سرویس یکپارچه **Express + REST API + MCP Server** حسابیار روی پلتفرم ابری **Render** را توضیح می‌دهد، در حالی که فرانت‌اند بدون تغییر روی **GitHub Pages** باقی می‌ماند.

---

## ۱. معماری استقرار (Deployment Architecture)

```
[ کلاینت‌های هوش مصنوعی / ChatGPT ] ──(HTTPS Streamable HTTP/SSE)──┐
                                                                    │
[ فرانت‌اند در GitHub Pages ] ──────(HTTPS REST اختیاری)──────────┼──> [ سرویس وب Render ]
(آفلاین-فرست در مرورگر کاربر)                                      │     ├── GET /health
                                                                    │     ├── /api/v1/* (REST API)
                                                                    │     └── /mcp (MCP Gateway)
                                                                    │                │
                                                                    └──────> [ دیتابیس Supabase ]
                                                                             (احراز هویت + جدول snapshots)
```

- **فرانت‌اند:** کاملاً آفلاین-فرست مبتنی بر IndexedDB در مرورگر کاربر و میزبانی‌شده روی GitHub Pages.
- **بک‌اند:** یک سرویس واحد Node.js روی Render که هم REST API (`/api/v1`) و هم سرور MCP (`/mcp`) را روی یک پورت میزبانی می‌کند.
- **داده‌ها:** سرور هیچ وابستگی به فایل‌سیستم محلی ندارد و تمام اطلاعات مالی کاربر در جدول `snapshots` در Supabase با تفکیک سطحی RLS و شناسه کاربر نگهداری می‌شوند.

---

## ۲. تنظیمات اولیه در Render Dashboard

1. وارد حساب کاربری خود در [Render](https://render.com) شوید.
2. روی دکمه **New +** کلیک کرده و گزینه **Web Service** را انتخاب کنید.
3. مخزن گیت‌هاب پروژه حسابیار را متصل کنید:
   - **Repository:** `sma12125-it/hesabyar-new` (یا مخزن فورک‌شده شما)
   - **Branch:** `main` (یا شاخه اصلی پروژه)

---

## ۳. پیکربندی سرویس (Service Configuration)

تنظیمات فیلدهای Render را به شرح زیر وارد کنید:

| نام فیلد در Render | مقدار پیشنهادی | توضیحات |
| :--- | :--- | :--- |
| **Name** | `hesabyar-backend` | نام سرویس در داشبورد Render |
| **Region** | Frankfurt (EU Central) یا نزدیک‌ترین ریجن | انتخاب ریجن ترجیحی |
| **Runtime** | `Node` | محیط اجرای جاوااسکریپت / تایپ‌اسکریپت |
| **Build Command** | `npm install && npm run build` | نصب پکیج‌ها و کامپایل بیلد تایپ‌اسکریپت |
| **Start Command** | `npm start` | اجرای `tsx server.ts` روی پورت تعیین‌شده |
| **Instance Type** | `Free` یا `Starter` | پلن رایگان یا اقتصادی |

---

## ۴. متغیرهای محیطی (Environment Variables)

در بخش **Environment Variables** در Render، متغیرهای زیر را تنظیم کنید:

| نام متغیر | مقدار الزامی / نمونه | توضیحات امنیتی |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | فعال‌سازی حالت پروداکشن و غیرفعال‌سازی توکن‌های آزمایشی |
| `PORT` | `10000` (توسط Render خودکار تنظیم می‌شود) | سرور حسابیار به `0.0.0.0:$PORT` متصل می‌شود |
| `SUPABASE_URL` | `https://<YOUR-PROJECT-ID>.supabase.co` | آدرس پروژه اختصاصی Supabase شما |
| `SUPABASE_ANON_KEY` | `<YOUR-SUPABASE-ANON-KEY>` | کلید عمومی (Anon/Publishable) پروژه Supabase |
| `ALLOW_DEV_TOKENS` | `false` | جلوگیری قطعی از دور زدن احراز هویت |
| `HESABYAR_API_URL` | *خالی بگذارید (اختیاری)* | به‌طور خودکار آدرس لوپ‌بک `http://127.0.0.1:${PORT}/api/v1` تنظیم می‌شود |

> ⚠️ **هشدار امنیتی بسیار مهم:**
> - هیچ‌گاه مقادیر واقعی `SUPABASE_URL` یا `SUPABASE_ANON_KEY` را در فایل‌های گیت، پیام‌های کامیت یا پول‌ریکوئست‌ها قرار ندهید.
> - این متغیرها صرفاً باید از طریق داشبورد امن Render وارد شوند.
> - متغیرهای محرمانه سرور نباید با پیشوند `VITE_` تعریف شوند تا وارد باندل‌های کلاینت فرانت‌اند نشوند.

---

## ۵. تنظیم بررسی سلامت (Health Check Path)

در بخش **Advanced Settings** در Render:

- فیلد **Health Check Path** را برابر با:
  ```text
  /health
  ```
  قرار دهید.
- ارکستریتور Render این آدرس را مرتباً بررسی کرده و در صورت دریافت پاسخ `200 OK` وضعیت سرویس را `Live` اعلام می‌کند.

---

## ۶. بررسی و اعتبارسنجی پس از استقرار (Verification Steps)

پس از آنکه وضعیت سرویس در Render به **Live** تغییر یافت، با جایگزینی دامنه اختصاصی Render خود (`https://hesabyar-backend.onrender.com`) دستورات زیر را تست کنید:

### ۱. تست سلامت کلی سرور
```bash
curl -s -i https://hesabyar-backend.onrender.com/health
```
**پاسخ مورد انتظار (HTTP 200 OK):**
```json
{
  "status": "ok",
  "service": "HesabYar Server",
  "version": "0.2.0",
  "mode": "production",
  "endpoints": {
    "health": "/health",
    "restApi": "/api/v1",
    "apiHealth": "/api/v1/health",
    "openapi": "/api/v1/openapi.json",
    "mcp": "/mcp",
    "mcpHealth": "/mcp/health"
  }
}
```

### ۲. تست سلامت REST API
```bash
curl -s -i https://hesabyar-backend.onrender.com/api/v1/health
```
**پاسخ مورد انتظار (HTTP 200 OK):**
```json
{
  "status": "ok",
  "app": "HesabYar API Backend",
  "version": "0.2.0",
  "features": ["MCP_READY", "REST_API", "MULTI_USER", "SUPABASE_SYNC", "CONFIRMATION_FLOW"]
}
```

### ۳. تست سلامت سرور MCP و ابزارها
```bash
curl -s -i https://hesabyar-backend.onrender.com/mcp/health
```
**پاسخ مورد انتظار (HTTP 200 OK):**
```json
{
  "status": "ok",
  "mcp": "HesabYar MCP Server",
  "version": "1.0.0",
  "transport": "Streamable HTTP / SSE",
  "apiConnection": "ok",
  "toolsCount": 56
}
```

### ۴. تست امنیت احراز هویت (رد درخواست‌های ناشناس)
```bash
curl -s -i https://hesabyar-backend.onrender.com/api/v1/accounts
```
**پاسخ مورد انتظار:**
`HTTP 401 Unauthorized` با پیام خطای مربوط به عدم وجود توکن احراز هویت. هیچ دیتای مالی بدون توکن معتبر Supabase بازگردانده نمی‌شود.

### ۵. تست دست‌تکانی پروتکل MCP (JSON-RPC 2.0 Initialization)
```bash
curl -s -X POST https://hesabyar-backend.onrender.com/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": { "name": "mcp-test-client", "version": "1.0.0" }
    }
  }'
```
**پاسخ مورد انتظار:**
یک پیام رویداد SSE معتبر حاوی قابلیت‌های سرور حسابیار (`capabilities`) و نسخه پروتکل.

---

## ۷. اتصال ChatGPT به سرور MCP در Render

برای اتصال کلاینت هوش مصنوعی (مانند Custom GPT یا دستیار دارای MCP Client):
- **URL پایانه MCP:**
  ```text
  https://hesabyar-backend.onrender.com/mcp
  ```
- **نوع انتقال (Transport):** `Streamable HTTP / SSE`
- **احراز هویت:** هدر استاندارد `Authorization: Bearer <SUPABASE_JWT_TOKEN>` که هویت کاربر را مشخص کرده و داده‌های آن کاربر را از جدول snapshots بازیابی می‌کند.
