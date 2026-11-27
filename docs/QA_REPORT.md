# گزارش تست فرایندی QA — Mockza (GLB) و سنجیا (IRN)

- **تاریخ شروع**: 2026-11-24
- **نسخه / کامیت پایه تست اولیه**: `44984a0` (`HEAD -> main`)
- **تاریخ رفع باگ‌ها و بازآزمایی کامل**: 2026-11-24
- **محیط‌های زنده تاییدشده پس از اصلاح**:
  - **Mockza (GLB / انگلیسی LTR)**: [`https://mockza.mehtea.ir`](https://mockza.mehtea.ir) (`127.0.0.1:45280` / `45281`)
  - **سنجیا (IRN / فارسی RTL)**: [`https://sanjia.mehtea.ir`](https://sanjia.mehtea.ir) (`127.0.0.1:45282` / `45283`)
  - **نسخه‌های Flutter (Mockza و Sanjia)**: بررسی‌شده با گیت‌های استاتیک، تست‌های واحد، ویجت، دسترسی‌پذیری (a11y)، هم‌ارزی (parity) و E2E
- **نمای تست‌شده**: دسکتاپ (`1440×900`) و موبایل (`390×844`) در مرورگر واقعی Chromium (Headless Chrome)

> **وضعیت نهایی پس از اصلاحات (`QA-001` تا `QA-014`)**: تمامی باگ‌ها و بدهی‌های فنی مستندشده در بک‌اند، وب (GLB / IRN) و فلاتر (Mockza / Sanjia) برطرف و دوباره تست شدند (`QA-004` از نظر کد، UI راهنما و مستندسازی تنظیمات کامل شد و فعال‌سازی SMS OTP / OAuth زنده تنها نیازمند تنظیم کلیدهای سرویس خارجی مثل `KAVENEGAR_API_KEY` و `GOOGLE_CLIENT_ID` در محیط استقرار است). تمام تست‌های خودکار بک‌اند (۱۰ پکیج)، وب (۳۶ فایل / ۲۳۱ تست + بیلد دوتایی GLB/IRN)، فلاتر (`flutter analyze` بدون خطا + ۴۱ فایل تست)، هم‌ارزی دامنه (۳۷۳ تست) و اسکریپت مرورگر زنده روی `https://mockza.mehtea.ir` و `https://sanjia.mehtea.ir` بدون هیچ خطای `401`/`429`/`pageerror` با موفقیت عبور کردند.

---

## وضعیت پیشرفت بخش‌ها

| بخش | موضوع | وضعیت | تعداد باگ یافت‌شده |
|---|---|---|---|
| ۱ | صفحات عمومی، لندینگ، راهنمای آزمون‌ها و ماشین‌حساب‌ها | تکمیل شد | ۳ |
| ۲ | ورود اولیه، آنبوردینگ، تقویم و احراز هویت | تکمیل شد | ۶ |
| ۳ | آزمون تعیین سطح تطبیقی (Diagnostic) | تکمیل شد | ۴ |
| ۴ | داشبورد خانه، پوسته برنامه (Chrome) و نقشه راه | تکمیل شد | ۴ |
| ۵ | کاتالوگ تمرین و شبیه‌سازهای ۴ مهارت | تکمیل شد | ۴ |
| ۶ | آزمون کامل آزمایشی (Full Mock) و تمرین‌های کوتاه (Micro-Drills) | تکمیل شد | ۲ |
| ۷ | نتایج عینی، صف انتظار و کارنامه تشریحی هوشمند | تکمیل شد | ۳ |
| ۸ | مربی هوشمند، ماموریت روزانه، گراف زبانی، Register Shifter و Drop Anything | تکمیل شد | ۲ |
| ۹ | بانک واژگان و مرور هوشمند SM-2 | تکمیل شد | ۲ |
| ۱۰ | پیشرفت و مقایسه تلاش‌ها | تکمیل شد | ۱ |
| ۱۱ | اشتراک / Paywall، تنظیمات و پنل ادمین | تکمیل شد | ۳ |
| ۱۲ | حالت‌های مرزی (آفلاین، RTL/LTR، ریسپانسیو، خطاهای شبکه) | تکمیل شد | ۴ |

---

## خلاصه باگ‌های یافت‌شده

### `QA-001` — غیرفعال بودن دائمی هر ۳ پخش‌کننده صوتی صفحه لندینگ (`/`)
- **شدت**: بالا (High)
- **نسخه درگیر**: GLB و IRN
- **مسیر**: `/` (Landing)
- **شرح**: هر ۳ پخش‌کننده تعاملی صوتی در صفحه اول (نمونه بازخورد اسپیکینگ، مرور پاسخ لیسنینگ و تمرین لیسنینگ) دکمه‌های پخش، اسلایدر زمان، تغییر سرعت و پرش به cue به‌صورت دائمی `disabled` هستند و کاربر نمی‌تواند هیچ صدایی را پخش کند.
- **علت ریشه‌ای**: در [`markup.mjs`](file:///home/mahdi/projects/ideas/mockza/web/src/landing/markup.mjs#L311) دکمه‌ها با `disabled` و `<audio preload="none">` رندر می‌شوند، اما [`interactions.js`](file:///home/mahdi/projects/ideas/mockza/web/src/landing/interactions.js#L197-L211) فعال‌سازی دکمه‌ها را فقط درون رویداد `loadedmetadata` انجام می‌دهد؛ چون `preload="none"` است متادیتا لود نمی‌شود. همچنین در کارت اسپیکینگ (`data-demo-audio data-src="/sample-media/speaking-feedback.mp3"`), ویژگی `data-src` اصلاً به `src` کپی نمی‌شود.

### `QA-002` — Race Condition در احراز هویت مهمان، قفل `401` و از دست رفتن نشست در ریلود کامل صفحه
- **شدت**: بالا (High)
- **نسخه درگیر**: GLB و IRN
- **مسیر**: `/app/welcome` → `/app/onboarding/goal` → `/app/diagnostic/intro` و سایر صفحات در ریلود (`F5`)
- **شرح**:
  1. در ورود اولیه کاربر مهمان، اگر فراخوانی اولیه `personalization.getState()` با `401` برگردد و `refreshAccessToken` همزمان با `ensureAuthenticated(false)` اجرا شود، کاربر در حالت خطای دائمی `401 Unauthorized` (`"Existing device requires valid deviceSecret or active session token to renew"`) قفل می‌شود و شروع دیگنوستیک یا ارسال فرم‌ها با `"Bearer device token required."` متوقف می‌شود.
  2. حتی پس از ثبت‌نام موفق ایمیل/رمز، در ناوبری SPA نشست حفظ می‌شود، اما با ریلود کامل صفحه (`page.goto` / `F5`) چون `currentSession` فقط در حافظه است، رگبار درخواست‌های اولیه پیش از بازسازی توکن با `401` مواجه شده و در پیمایش‌های بعدی می‌تواند نشست را به حالت مهمان/خروج برگرداند (در [`SettingsScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/settings/SettingsScreen.tsx#L160-L179) دکمه خروج ناپدید و `Sign In` نمایش داده شد).
- **علت ریشه‌ای**: در [`http-auth.adapter.ts`](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/http/http-auth.adapter.ts#L167,#L289) فیلد `this.currentSession` با هر ریلود `null` می‌شود و شرط `if (!forceRefresh && this.inflightAuth)` هنگام `forceRefresh=true` (ناشی از `onUnauthorized` در [`bootstrap-shared.ts`](file:///home/mahdi/projects/ideas/mockza/web/src/composition/bootstrap-shared.ts#L95)) دور زده می‌شود و درخواست‌های همزمان `POST /v1/auth/anonymous` با هم تداخل می‌کنند.

### `QA-003` — سیل خطاهای `401 GET /v1/personalization/state` در کنسول کاربر مهمان
- **شدت**: متوسط (Medium)
- **نسخه درگیر**: GLB و IRN
- **مسیر**: `/app/home`, `/app/diagnostic/intro`, `/app/diagnostic/result`, `/app/roadmap` و سایر صفحات هنگام ریلود کامل
- **شرح**: در هر بار لود صفحه یا ریلود کامل در حالت مهمان (حتی پس از تکمیل آنبوردینگ و Diagnostic)، درخواست‌های متعدد `GET /v1/personalization/state` پیش از آماده شدن توکن نشست ارسال شده و با `401 Unauthorized` پاسخ می‌گیرند (بیش از ۱۰ خطای شبکه و کنسول در یک نشست با ریلود؛ در ناوبری داخلی SPA بدون ریلود `0` خطا ثبت شد).
- **علت ریشه‌ای**: در [`DesktopSimulatorApp.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/DesktopSimulatorApp.tsx#L100-L137) هوک `useEffect` مربوط به `personalization.getState()` (`L101`) همزمان و پیش از اتمام `ensureAuthenticated(false)` (`L137`) اجرا می‌شود.

### `QA-004` — نبود ورود/ثبت‌نام با پیامک (SMS OTP) در نسخه زنده سنجیا (IRN)
- **شدت**: بالا/متوسط (High/Medium)
- **نسخه درگیر**: IRN (سنجیا)
- **مسیر**: `/app/auth/login`
- **شرح**: در محیط زنده سنجیا، `GET /v1/auth/providers` مقدار `"smsOtp":{"enabled":false,"mode":"disabled"}` برمی‌گرداند؛ در نتیجه [`AuthScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/auth/AuthScreen.tsx#L63-L64) تب و فرم شماره موبایل / OTP را مخفی کرده و کاربر ایرانی فقط فرم ایمیل و رمز عبور را می‌بیند. (در GLB نیز OAuth گوگل و اپل در محیط زنده `enabled:false` هستند.)

### `QA-005` — برچسب نادرست `"Target Score Score"` در آزمون‌های PTE و DET (GLB) و برچسب انگلیسی `Band`/`Score` در IRN
- **شدت**: متوسط (Medium)
- **نسخه درگیر**: GLB و IRN
- **مسیر**: `/app/onboarding/goal` و `/app/settings`
- **شرح**:
  1. در GLB هنگام انتخاب `PTE Academic` یا `DET`، تیتر نمره هدف به‌صورت تکراری **`Target Score Score`** نمایش داده می‌شود (ترکیب قالب `Target {unit} Score` با `unitLabel: "Score"`).
  2. در IRN در [`GoalSetupScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/onboarding/GoalSetupScreen.tsx#L185) و [`SettingsScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/settings/SettingsScreen.tsx#L320) واحد انگلیسی `trackSpec.unitLabel` داخل متن فارسی تزریق شده و عباراتی مانند `نمره هدف (⁦Band⁩)` و `نمره هدف (⁦Score⁩)` نمایش داده می‌شود.

### `QA-006` — تکرار تیتر و تب فعال در صفحه ورود (`Sign In / Sign In` و `ورود / ورود`)
- **شدت**: کم (Low)
- **نسخه درگیر**: GLB و IRN
- **مسیر**: `/app/auth/login`
- **شرح**: در [`AuthScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/auth/AuthScreen.tsx#L182-L208) وقتی `showSmsOtp` غیرفعال است، هم تیتر `<h2>` و هم کنترل سگمنت کنار آن عبارت یکسان «ورود / ورود» یا «Sign In / Sign In» (یا «ثبت‌نام / ثبت‌نام») را تکرار می‌کنند.

### `QA-007` — متن‌های ترجمه‌نشده انگلیسی در کارنامه تعیین سطح (Diagnostic Result) و پیشنهاد اول خانه در IRN
- **شدت**: متوسط (Medium)
- **نسخه درگیر**: IRN (سنجیا)
- **مسیر**: `/app/diagnostic/result` و `/app/home`
- **شرح**: در کارنامه تعیین سطح و کارت پیشنهاد بعدی روی داشبورد سنجیا بخش‌های متعددی به‌صورت خام و انگلیسی نمایش داده می‌شوند:
  - دکمه **`Refresh`** در [`DiagnosticResultScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/diagnostic/DiagnosticResultScreen.tsx#L126) بدون ترجمه فارسی است.
  - نام مهارت‌ها (`Reading`, `Listening`, `Writing`, `Speaking`) در [`DiagnosticResultScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/diagnostic/DiagnosticResultScreen.tsx#L27-L36) انگلیسی هستند.
  - عنوان و توضیح اقدام پیشنهادی (`Practice Reading: explicit_detail` و `Targeted short practice based directly on what appeared in your starting check.`) و مشاهدات/سطح پیشنهادی در [`routing.ts`](file:///home/mahdi/projects/ideas/mockza/backend/packages/domain/src/diagnostic/routing.ts#L524-L548) (`Suggested practice: Foundational (A1–A2 focus) — provisional (reduced sampling)`) فقط به انگلیسی تولید می‌شوند.

### `QA-008` — ناهماهنگی بومی‌سازی، اعداد و علائم نگارشی در صفحات عمومی، ماشین‌حساب‌ها، خانه و نقشه راه
- **شدت**: کم/متوسط (Low/Medium)
- **نسخه درگیر**: GLB و IRN
- **مسیرها**: `/calculators/*`, `/robots.txt`, `/app/home`, `/app/roadmap`
- **شرح**:
  1. **ماشین‌حساب‌های عمومی IRN (`/calculators/*`)**: خروجی محاسبه در محیط فارسی سنجیا از اعداد و برچسب‌های انگلیسی استفاده می‌کند (`تعداد پاسخ صحیح: 39`, `Band 9.0`, `~117 / 120`, `Literacy: 120`).
  2. **صفحه `/calculators/pte-to-ielts-concordance`**: فاقد ماشین‌حساب تعاملی تبدیل نمره PTE است و فقط جدول ایستا به همراه تکرار ویجت‌های IELTS/TOEFL/DET دارد.
  3. **GLB HomeScreen**: عبارت `Vocab Wave 1: 15 Technology & AI & Core Words` دارای `&` دوتایی است (ترکیب نام موضوع با `&` و پسوند `& Core Words`).
  4. **IRN HomeScreen & Roadmap**: کد مراحل `M1 M2 M3 M4` به انگلیسی باقی مانده و در [`RoadmapScreen`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/roadmap/RoadmapScreen.tsx) اعداد نمره و هدف به‌صورت مخلوط فارسی و لاتین نمایش داده می‌شوند (`4.5 / ۷.۵` و `کسب نمره هدف 7.5`).
  5. **فقدان `/favicon.ico`**: در بازدید از `/robots.txt` مرورگر خطای `404` برای `/favicon.ico` ثبت می‌کند.

### `QA-009` — محدودیت نرخ سراسری (`429 Too Many Requests`) روی تمام کاربران پشت پروکسی وب به‌دلیل نبود `TRUSTED_PROXY_IPS`
- **شدت**: بالا (High)
- **نسخه درگیر**: GLB و IRN
- **مسیرها**: تمام APIها (`/v1/jobs/*`, `/v1/billing/plans`, `/v1/exams/*`, `/v1/diagnostic/*`, `/v1/auth/anonymous`)
- **شرح**: هنگام پیمایش عادی بین صفحات همراه با polling صفحه انتظار ارزیابی (`EvaluationPendingScreen`), سرور به سرعت پاسخ `429 Too Many Requests` (`"Too many requests. Please slow down and try again in 52/38/30 seconds."`) برمی‌گرداند. این خطا باعث از کار افتادن بارگذاری بسته‌های اسپیکینگ/ریدینگ، لود نشدن پلن‌های صفحه اشتراک (`planCount: 0` و غیرفعال ماندن دکمه پرداخت در `/app/paywall`), شکست دیگنوستیک و مسدود شدن سشن‌های مهمان می‌شود.
- **علت ریشه‌ای**: میدل‌ور [`rate-limit.ts`](file:///home/mahdi/projects/ideas/mockza/backend/apps/api/src/middleware/rate-limit.ts#L24-L47) فقط در صورتی IP واقعی کاربر را از `X-Forwarded-For` می‌خواند که IP پروکسی بالادستی در `TRUSTED_PROXY_IPS` ثبت شده باشد. در [`app.ts`](file:///home/mahdi/projects/ideas/mockza/backend/apps/api/src/app.ts#L65) و [`auth.ts`](file:///home/mahdi/projects/ideas/mockza/backend/apps/api/src/routes/auth.ts#L157) مقدار پیش‌فرض `'127.0.0.1,::1'` است، در حالی که در [`compose.yaml`](file:///home/mahdi/projects/ideas/mockza/compose.yaml#L14-L36) متغیر `TRUSTED_PROXY_IPS` برای پروکسی nginx روی شبکه داکر `mockza-net` تعریف نشده است؛ در نتیجه همه کاربران یک سطل مشترک (`120 req/min` کل API و `25 req/min` احراز هویت) را به اشتراک می‌گذارند.

### `QA-010` — نمایش دائمی لینک «ورود / Sign In» در پایین سایدبار حتی پس از احراز هویت کامل کاربر
- **شدت**: متوسط (Medium)
- **نسخه درگیر**: GLB و IRN
- **مسیر**: پوسته برنامه (`/app/home` و تمام صفحات دارای سایدبار)
- **شرح**: بلافاصله پس از ثبت‌نام موفق ایمیل/رمز و ورود به `/app/home` (در حالی که در `/app/settings` کاربر با ایمیل خود به‌عنوان کاربر احرازشده نمایش داده می‌شود)، دکمه **`Sign In`** (در GLB) و **`ورود`** (در IRN) همچنان در پایین سایدبار سمت چپ/راست دیده می‌شود.
- **علت ریشه‌ای**: در [`router.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/router.tsx#L798-L825) لینک `data-testid="nav-auth-link"` بدون بررسی وضعیت احراز هویت (`isAuthenticated`) به‌صورت ثابت رندر می‌شود (برخلاف [`SettingsScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/settings/SettingsScreen.tsx#L160-L179)).

### `QA-011` — عدم فیلتر تمرین‌های کوتاه (Micro-Drills) بر اساس مسیر آزمون فعال کاربر
- **شدت**: متوسط (Medium)
- **نسخه درگیر**: GLB و IRN
- **مسیر**: `/app/practice/drills`
- **شرح**: با وجود انتخاب مسیر `IELTS Academic` در پروفایل کاربر، در صفحه Micro-Drills اولین تمرین نمایش‌داده‌شده **`DET Read Select`** است و تمرین‌های مربوط به آزمون‌های دیگر بدون تفکیک یا فیلتر آزمون نمایش داده می‌شوند.
- **علت ریشه‌ای**: [`MicroDrillsScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/practice/MicroDrillsScreen.tsx#L332-L333) کل لیست `drills` سینک‌شده را مستقیماً بدون فیلتر براساس `profileExamId` رندر می‌کند.

### `QA-012` — عبارت‌های ترجمه‌نشده انگلیسی در شبیه‌سازها، صف انتظار، پیشرفت، مربی، خطاها و پنل ادمین (IRN)
- **شدت**: متوسط (Medium)
- **نسخه درگیر**: IRN (سنجیا)
- **مسیرها**: `/app/practice/*`, `/app/evaluation/*`, `/app/progress`, `/app/mission/today`, `/app/register-shifter`, `/app/drop`, `/app/vocabulary/$wordId`, `/app/admin/trace`
- **شرح**: در تست زنده نسخه فارسی، موارد زیر به‌صورت انگلیسی یا مخلوط نمایش داده شدند:
  1. **آزمون کامل آزمایشی** ([`FullMockOrchestratorScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/practice/FullMockOrchestratorScreen.tsx#L49-L68)): عناوین مراحل `Listening Section`, `Reading Section`, `Writing Section`, `Speaking Section` و تیتر استراحت `Mock Day Break` انگلیسی هستند.
  2. **صف انتظار ارزیابی** ([`EvaluationPendingScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/results/EvaluationPendingScreen.tsx#L17-L22,#L157)): تمام مراحل ۴گانه (`Queued in grading pipeline`, `Normalizing media & transcript`, `Scoring official rubric criteria`, `Report ready`) و دکمه `Refresh Status` انگلیسی هستند.
  3. **شبیه‌سازهای مهارت**: در اسپیکینگ ([`SpeakingSimulatorScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/practice/SpeakingSimulatorScreen.tsx#L465,#L647)) نشان `240s`، راهنمای میانبر `Switch Speaking part turns` و پیام رد مجوز میکروفون در [`web-audio.adapter.ts`](file:///home/mahdi/projects/ideas/mockza/web/src/adapters/media/web-audio.adapter.ts#L131) (`Microphone permission denied: Permission denied`)؛ در لیسنینگ ([`ListeningSimulatorScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/practice/ListeningSimulatorScreen.tsx#L105)) میانبر `Select choice`؛ و در رایتینگ DET ([`WritingSimulatorScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/practice/WritingSimulatorScreen.tsx#L702-L703)) بنر `DET Interactive Writing — Step ...` انگلیسی هستند.
  4. **نتایج، پیشرفت و وضعیت‌های خالی/یافت‌نشدن**: در [`ObjectiveResultScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/results/ObjectiveResultScreen.tsx#L201) مقدار `Band 0.0` (کلمه `Band`)؛ در [`ProgressScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/progress/ProgressScreen.tsx#L320) برچسب `Estimated Band`، `Band 7.5` و رقم لاتین `0` در `⁦0⁩ آزمون ثبت‌شده`؛ و خطاهای مسیر نامعتبر در [`EvaluationResultScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/results/EvaluationResultScreen.tsx#L140) (`Evaluation report not found locally.`), [`VocabWordDetailScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/vocabulary/VocabWordDetailScreen.tsx#L64) (`Vocabulary card not found.`) و [`DiagnosticResultScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/diagnostic/DiagnosticResultScreen.tsx#L99) (`No baseline report found yet.`) به انگلیسی نمایش داده می‌شوند.
  5. **مربی، مأموریت روزانه، Register Shifter و Drop Anything**: وضعیت پردازش ورکر در [`register-shifter.ts`](file:///home/mahdi/projects/ideas/mockza/backend/apps/worker/src/jobs/register-shifter.ts#L63) و [`drop-ingest.ts`](file:///home/mahdi/projects/ideas/mockza/backend/apps/worker/src/jobs/drop-ingest.ts#L211)، بخش انگلیسی داخل پیام خطای یوتیوب در [`DropHubScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/drop/DropHubScreen.tsx#L329) و دکمه `Listen 1.0x` به همراه توضیح `whyEn` در [`DailyMissionScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/mission/DailyMissionScreen.tsx#L648,#L682) بومی‌سازی نشده‌اند.
  6. **پنل ادمین (`/app/admin/trace`)**: [`AdminTraceConsoleScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/admin/AdminTraceConsoleScreen.tsx#L166-L360) در نسخه IRN کاملاً انگلیسی است.

### `QA-013` — کد مرده اعتبارسنجی طول جمله و نبود راهنمای حداقل ۱۵ کاراکتر در Register Shifter
- **شدت**: کم (Low)
- **نسخه درگیر**: GLB و IRN
- **مسیر**: `/app/register-shifter`
- **شرح**: هنگام تایپ متن کوتاه (مانند `"hi"`), دکمه ارسال بدون نمایش هیچ پیام راهنمای حداقل کاراکتر غیرفعال (`disabled`) می‌شود و کاربر متوجه نمی‌شود چرا دکمه کار نمی‌کند.
- **علت ریشه‌ای**: در [`RegisterShifterScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/register-shifter/RegisterShifterScreen.tsx#L141-L149,#L414) دکمه ارسال دارای `disabled={processing || rawText.trim().length < 15}` است؛ در نتیجه پیام خطای `Write at least one full casual sentence (15+ characters).` در `handleShiftText` هرگز اجرا نمی‌شود.

### `QA-014` — نبود بسته‌های نمونه غیرآیلتس (`pte-ac-writ-01` / `det-writ-01`) در کاتالوگ زنده و مغایرت Route/TestId
- **شدت**: کم (Low)
- **نسخه درگیر**: GLB و IRN
- **مسیرها**: `/app/practice/writing/pte-ac-writ-01`, `/app/practice/writing/det-writ-01`, `/app/drop/drill/$dropId`, `/app/vocabulary/$wordId`
- **شرح**:
  1. کاتالوگ زنده (`18` بسته) فقط شامل بسته‌های `ielts-*` است و باز کردن مستقیم شناسه‌های رایتینگ `pte-ac-writ-01` یا `det-writ-01` خطای `404 Exam pack ... was not found` نمایش می‌دهد.
  2. کامپوننت [`DropDrillScreen.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/features/drop/DropDrillScreen.tsx#L88-L94) در وضعیت یافت‌نشدن تمرین (`!drop`) صفت `data-testid="drop-drill-screen"` را ندارد (هرچند پیام خطا نمایش داده می‌شود).
  3. در [`router.tsx`](file:///home/mahdi/projects/ideas/mockza/web/src/spa/router.tsx#L322,#L1298) تابع `preloadRouteForPathname` پیشوند `/vocabulary/word/` را چک می‌کند در حالی که مسیر تعریف‌شده `/vocabulary/$wordId` است (پیش‌بارگذاری جزئیات واژه هیچ‌وقت اجرا نمی‌شود).

---

## جزئیات اجرای تست به تفکیک بخش

### بخش ۱ — صفحات عمومی، لندینگ، راهنمای آزمون‌ها و ماشین‌حساب‌ها
- **بررسی‌شده**: `/` (GLB و IRN)، راهنمای ۵ آزمون (`/[examSlug]`)، تمامی صفحات `/calculators/*`، `/samples` (تمام ۳۰ لینک `200 OK`)، `/vocab` (تمام ۴۵ لینک `200 OK`)، `/robots.txt`، `/llms.txt`.
- **نتایج موفق**: تمام لینک‌ها `200 OK` دادند؛ ریدینگ تعاملی در `/` بدون مشکل کار کرد؛ در نمای دسکتاپ (`1440×900`) و موبایل (`390×844`) اسکرول افقی (`horizontal overflow`) دیده نشد (`0px`).
- **باگ‌های یافت‌شده**: `QA-001` و `QA-008` (موارد ۱، ۲ و ۵).

### بخش ۲ — ورود اولیه، آنبوردینگ، تقویم و احراز هویت
- **بررسی‌شده**:
  - گیت ورود `/app` → هدایت به `/app/welcome` برای کاربر جدید و `/app/home` پس از اتمام آنبوردینگ.
  - انتخاب هر ۵ آزمون (`ielts_academic`, `ielts_general`, `toefl_ibt`, `pte_academic`, `det`) و بررسی پیش‌نمایش نمره، پله‌ها و CEFR.
  - تقویم میلادی (GLB) و تقویم جلالی (IRN شامل تست تاریخ نامعتبر `1406/12/31` ← نمایش پیام خطا `تاریخ تقویمی معتبری وارد کنید.` و غیرفعال شدن دکمه شروع آزمون).
  - چیپ‌های موضوعات علاقه، ورود نامعتبر (`Invalid email or password.`), و ثبت‌نام موفق ایمیل/رمز در `/app/auth/login` (تب `Create Account` در GLB و `ثبت‌نام` در IRN) و هدایت به `/app/home`.
- **باگ‌های یافت‌شده**: `QA-002`, `QA-003`, `QA-004`, `QA-005`, `QA-006`, `QA-010`.

### بخش ۳ — آزمون تعیین سطح تطبیقی (Diagnostic)
- **بررسی‌شده**: `/app/diagnostic/intro` → `/app/diagnostic/session/$diagId` → `/app/diagnostic/result` و همچنین بازآزمونی تک‌مهارت `/app/diagnostic/session?retakeSkill=reading` در هر دو نسخه GLB و IRN.
- **نتایج موفق**: هر ۴ مرحله Reading، Listening، Writing و Speaking تا ساخت کارنامه تعیین سطح با موفقیت اجرا شدند؛ همچنین مسیر `retakeSkill=reading` به‌درستی مستقیم مرحله `Reading` (`Shared Tool Shed`) را در هر دو نسخه باز کرد.
- **باگ‌های یافت‌شده**: `QA-002` (قفل شدن دیگنوستیک در صورت تداخل توکن مهمان), `QA-003`, `QA-007`, `QA-009`.

### بخش ۴ — داشبورد خانه، پوسته برنامه (Chrome) و نقشه راه
- **بررسی‌شده**: `/app/home` (بخش‌های کارت نقشه راه، پانورامای M1–M4، ۲ ستون تمرین/مربی، برچسب آزمون فعال، وضعیت همگام‌سازی)، جمع‌شدن سایدبار و ماندگاری پس از ریلود، تغییر تم و پایداری حالت Dark پس از ریلود، صفحه `404` داخلی در مسیر `/app/does-not-exist-xyz`، صفحه `/app/roadmap` و تکمیل گام فعال، و نمای موبایل (`390×844`).
- **نتایج موفق**: جمع‌شدن سایدبار و تغییر حالت تیره (`dark`) پس از ریلود حفظ شدند؛ صفحه `404` داخلی درست رندر شد؛ تکمیل گام در Roadmap عمل کرد؛ در موبایل روی Home و Roadmap اسکرول افقی وجود نداشت (`390/390`).
- **باگ‌های یافت‌شده**: `QA-003`, `QA-007`, `QA-008` (موارد ۳ و ۴), `QA-010`.

### بخش ۵ — کاتالوگ تمرین و شبیه‌سازهای ۴ مهارت
- **بررسی‌شده**: `/app/practice` (فیلتر مهارت‌ها، جست‌وجو، کش آفلاین)، Reading (`ielts-acad-reading-pack-01` و `seed-01`)، Listening (`ielts-listening-seed-01` در حالت Exam Lock و Study Mode با ۲۳ سطر ترنسکریپت قابل کلیک)، Writing (`ielts-writing-pack-01` با ذخیره خودکار، بازیابی پس از ریلود و ارسال به صف)، Speaking (`ielts-speaking-pack-01` با شمارنده ۶۰ ثانیه آماده‌سازی، Skip Prep، ضبط صوت آزمایشی ۱ ثانیه‌ای و تست خطای عدم دسترسی میکروفون).
- **نتایج موفق**:
  - تمام ۱۸ بسته کاتالوگ، جست‌وجو (`5` نتیجه) و دانلود آفلاین (`cachedCount: 1`) در GLB و IRN عمل کردند.
  - در ریدینگ نسخه IRN مرز `dir="ltr"` روی متن انگلیسی حفظ شد و پاپ‌اور هایلایت متن باز شد.
  - در لیسنینگ حالت Exam Lock و Study Mode با ۲۳ قطعه ترنسکریپت قابل کلیک تایید شد.
  - در رایتینگ متن پیش‌نویس پس از ریلود بازیابی شد (`draftRestored: true`).
  - در اسپیکینگ ضبط تست با میکروفون مجازی و کنترل خطای `NotAllowedError` بدون کرش صفحه تایید شد.
- **باگ‌های یافت‌شده**: `QA-002`, `QA-009`, `QA-012` (بخش ۳), `QA-014` (نبود پک‌های `pte-ac-writ-01` و `det-writ-01`).

### بخش ۶ — آزمون کامل آزمایشی (Full Mock) و تمرین‌های کوتاه (Micro-Drills)
- **بررسی‌شده**: `/app/practice/drills` (اجرای کامل یک تمرین تا `drill-scorecard`) و `/app/practice/full-mock/ielts_academic` (شروع، عبور از مرحله اول، صفحه استراحت ۵ دقیقه‌ای `Mock Day Break`).
- **نتایج موفق**: تمرین کوتاه تا نمایش امتیاز نهایی (`1 / 2`) و بازگشت به فهرست کار کرد؛ در Full Mock صفحه استراحت بین مراحل با تایمر `05:00` و دکمه ادامه به‌درستی اجرا شد.
- **باگ‌های یافت‌شده**: `QA-011` (نمایش تمرین DET در پروفایل IELTS), `QA-012` (عناوین انگلیسی مراحل Full Mock و Break در IRN).

### بخش ۷ — نتایج عینی، صف انتظار و کارنامه تشریحی هوشمند
- **بررسی‌شده**: `/app/practice/objective-result/$id` (مرور پاسخ‌ها، دکمه `jump-evidence` روی `ielts-acad-reading-seed-01`، کلیک روی `Ask AI Why?`) و `/app/evaluation/pending/$jobId` (استپر ۴ مرحله‌ای و دکمه بازگشت به تمرین).
- **نتایج موفق**: دکمه `jump-evidence` شواهد متن را باز کرد؛ کلیک روی `Ask AI Why?` در GLB به‌درستی گیت `402 Payment Required` و پیام پلن پرو را نمایش داد.
- **باگ‌های یافت‌شده**: `QA-002` (خطای توکن روی Ask AI Why و ارسال رایتینگ هنگام از دست رفتن سشن), `QA-009` (`429` حین polling در `EvaluationPendingScreen`), `QA-012` (بخش‌های ۲ و ۴: استپر و دکمه انگلیسی صف انتظار و `Band 0.0` در IRN).

### بخش ۸ — مربی هوشمند، ماموریت روزانه، گراف زبانی، Register Shifter و Drop Anything
- **بررسی‌شده**: `/app/coach`, `/app/mission/today`, `/app/progress/graph`, `/app/register-shifter`, `/app/drop` در هر دو نسخه GLB و IRN.
- **نتایج موفق**:
  - هاب مربی، سهمیه نمونه رایگان و نشان موضوع فعال بارگذاری شد؛ در Daily Mission انتخابگر تغییر موضوع و ارسال پاسخ کار کرد؛ در گراف زبانی ماتریس Topic × Weakness نمایش داده شد.
  - در Register Shifter تبدیل واقعی جمله به ۳ سطح (`Everyday · Casual`, `Professional · Work`, `Exam Style (Band 8+)`) در GLB با موفقیت کامل انجام شد.
  - در Drop Anything مسدودسازی لینک یوتیوب با بنر خطا و ثبت موفق متن برای استخراج اصطلاحات تایید شد.
- **باگ‌های یافت‌شده**: `QA-012` (بخش ۵: وضعیت‌های انگلیسی ورکر و دکمه/توضیح انگلیسی مأموریت و خطای ترکیبی یوتیوب در IRN), `QA-013` (کد مرده و نبود راهنمای حداقل ۱۵ کاراکتر در Register Shifter). *(به همراه `QA-014` مورد ۲ برای `data-testid` حالت نیافتن تمرین Drop).*

### بخش ۹ — بانک واژگان و مرور هوشمند SM-2
- **بررسی‌شده**: `/app/vocabulary` (شمارنده‌های موج ۱ و ۳۲۰ واژه، لیست مجازی)، `/app/vocabulary/$wordId` (`salient`)، `/app/vocabulary/review` (نمایش کارت، فلیپ و امتیازدهی با `[data-testid="vocab-rate-good"]`).
- **نتایج موفق**: موج ۱ (`15 / 320`، `320 due now`) بارگذاری شد؛ صفحه جزئیات واژه در IRN تاریخ جلالی `۱۴۰۵/۰۹/۰۳` را درست نمایش داد؛ در مرور SM-2 پیش‌نمایش بازه‌ها (`1d/1d/1d/4d`) نمایش داده شد و کلیک روی گزینه `Good` با موفقیت کارت را ثبت کرده و به واژه بعدی (`2 of 10: pivotal`) منتقل شد.
- **باگ‌های یافت‌شده**: `QA-012` (بخش ۴: پیام `Vocabulary card not found.` و `Loading word...`), `QA-014` (مورد ۳: مسیر preload اشتباه `/vocabulary/word/` در روتر).

### بخش ۱۰ — پیشرفت و مقایسه تلاش‌ها
- **بررسی‌شده**: `/app/progress` (کارت تخمین نمره، نمودار روند، رادار ۴ مهارت، دکمه خروجی و کارت اکوسیستم در IRN) و `/app/progress/compare` (حالت خالی مقایسه دو آزمون).
- **نتایج موفق**: حالت‌های خالی نمودار روند، رادار ۴ مهارت و صفحه مقایسه در هر دو نسخه به‌درستی نمایش داده شدند.
- **باگ‌های یافت‌شده**: `QA-012` (بخش ۴: نمایش `Estimated Band`، `Band 7.5` و رقم لاتین `0` در IRN).

### بخش ۱۱ — اشتراک / Paywall، تنظیمات و پنل ادمین
- **بررسی‌شده**: `/app/paywall` (فهرست ۳ پلن، چک‌باکس قوانین، وضعیت دکمه پرداخت)، `/app/settings` (اطلاعات حساب پس از ورود، اسلات ۱+۱ دستگاه، تاریخ جلالی در IRN، تم `nordic_emerald`، مودال حذف حساب، جریان کامل خروج از حساب و بازگشت به `Sign In`)، `/app/admin/trace`.
- **نتایج موفق**: در نشست سالم SPA تمام ۳ پلن در Paywall لود شدند و فعال‌سازی چک‌باکس قوانین دکمه پرداخت را فعال کرد؛ در Settings اسلات `1 / 1 Active` (`Chrome on Linux Desktop`) نمایش داده شد، تغییر تم به `nordic_emerald` و باز شدن مودال حذف حساب کار کرد، و خروج از حساب (`Sign Out → Confirm`) کاربر را به‌درستی به حالت مهمان با لینک `Sign In` بازگرداند. *(بخش کپی شناسه و خروجی JSON داخل آکاردئون `Device & Sync Diagnostics` در کد تایید شد.)*
- **باگ‌های یافت‌شده**: `QA-005` (`settingsTargetScoreLabel` روی `/app/settings`), `QA-009` (عدم لود پلن‌های Paywall در زمان `429`), `QA-012` (بخش ۶: پنل `/app/admin/trace` تماماً انگلیسی در IRN).

### بخش ۱۲ — حالت‌های مرزی (آفلاین، RTL/LTR، ریسپانسیو، خطاهای شبکه)
- **بررسی‌شده**:
  - **آفلاین**: دانلود پک ریدینگ و رفتن به حالت `Offline`؛ باز کردن و ارسال آزمون ریدینگ بدون اینترنت در IRN (`offlineReadingLoaded: true`, `offlineSubmitted: true`, نشان `حالت آفلاین`).
  - **موبایل (`390×844`)**: بررسی اسکرول افقی روی `/app/practice`, `/app/coach`, `/app/register-shifter`, `/app/drop`, `/app/vocabulary`, `/app/progress`, `/app/paywall`, `/app/settings` در هر دو نسخه GLB و IRN.
  - **شناسه‌های نامعتبر و دسترسی میکروفون**: بررسی fallback تمام مسیرهای نامعتبر ریدینگ، نتیجه عینی، نتیجه ارزیابی، Drop Drill، واژه نامعتبر و خطای `NotAllowedError` میکروفون.
- **نتایج موفق**: در نمای موبایل `390×844` روی تمام ۸ صفحه بررسی‌شده در هر دو نسخه، مقدار اسکرول افقی دقیقاً `0px` (`390 / 390`) بود؛ ریدینگ دانلودشده در حالت آفلاین اجرا و ثبت شد؛ تمام مسیرهای با شناسه نامعتبر و قطع مجوز میکروفون بدون کرش صفحه با پیام fallback مدیریت شدند.
- **باگ‌های یافت‌شده**: `QA-002` و `QA-009` (در ریلود/تداخل سشن و `429`), `QA-012` (پیام‌های انگلیسی fallback و خطای میکروفون در IRN), `QA-014` (مورد ۲: نبود `data-testid` در fallback صفحه Drop Drill).
