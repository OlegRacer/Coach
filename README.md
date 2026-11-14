# Тренування (PWA)

Веб-додаток для учнів: розклад, вправи (фітнес, МФР ролл, мобільність) з відео та анатомія тіла.
Працює офлайн, встановлюється на телефон.

## Запуск

```bash
npm install
npm run dev      # локально
npm run build    # збірка в dist/
```

## Деплой на GitHub Pages

1. Створіть репозиторій і залийте туди проєкт (гілка `main`).
2. Settings → Pages → Source: **GitHub Actions**.
3. Кожен push у `main` збирає й публікує сайт автоматично (`.github/workflows/deploy.yml`).

## Де міняти контент

Весь контент у `src/data/`:

- `exercises.json`: вправи (`category`: `fitness` | `mfr` | `mobility`, `muscles`, `sets`, `video`, `description`).
  Поле `video` це ID відео з YouTube (частина після `v=`). Відео відкриваються лише онлайн.
- `muscles.json`: список м'язів. `id` має збігатися з областями на схемі в `src/pages/Anatomy.jsx`.
- `schedule.json`: розклад (`day`: 1 = понеділок … 7 = неділя).

Усі сторінки беруть дані через `src/data/api.js`. Коли знадобиться Supabase або власний бекенд,
міняється лише цей файл.

## Мови (українська, English, 繁體中文)

Усі тексти лежать у трьох файлах, ключі в них однакові:

- `src/locales/uk.json`: українська (головна, її заповнюємо першою)
- `src/locales/en.json`: English
- `src/locales/zh-TW.json`: 繁體中文 (Тайвань)

Як це працює:
- Недописаний або порожній (`""`) переклад автоматично показується українською, тож додаток ніколи не ламається.
- Назви й описи вправ: ключі `ex.<id>.title`, `ex.<id>.description`, `ex.<id>.sets`, де `<id>` це `id` з `exercises.json`.
- М'язи: `muscle.<id>`. Дні тижня: `day.short.1…7`, `day.long.1…7`.
- У `schedule.json` поля `title` і `place` це ключі з перекладів (наприклад `session.strength`). Можна написати й просто текст, тоді він покажеться однаково всім.
- Нова вправа: додайте об'єкт в `exercises.json` (id, category, muscles, preview, video), потім три рядки `title` і `description` у кожному файлі перекладів. Для кожного нового ключа в uk.json шукайте той самий у en.json і zh-TW.json.
- Нова мова: файл у `src/locales/`, рядок у `src/i18n/index.jsx` (LANGS і DICTS).
- Мову обирають кнопки UA / EN / 繁中 на головній. Вибір запам'ятовується в телефоні. Перший раз мова береться з налаштувань телефона (zh, en, інакше українська).

Переклади англійською й китайською зараз чернеткові, їх варто перевірити носієм.

## Акаунти та учні (Supabase)

- Підключення: `src/lib/supabase.js` (Project URL і публічний ключ; вони публічні за задумом Supabase).
  Ключ `service_role` / `secret` у код і в репозиторій вставляти не можна.
- База: скрипт `supabase-schema.sql` виконується один раз у Supabase (SQL Editor).
- Вхід: `src/auth/index.jsx` (Google; LINE додамо наступним кроком).
- Тренер (адмін) визначається за email з таблиці `admin_emails`. Йому в панелі профілю з'являється розділ «Учні» (`src/pages/Students.jsx`).

## Анкета учня

- Показується автоматично після першого входу (`src/components/Onboarding.jsx`, `OnboardingGate.jsx`). Усе необов'язкове, крім згоди. Кнопка «Не зараз» ховає її до кінця сесії.
- Учень може відкрити її знову в профілі («Моя анкета») і видалити свої дані.
- Дані лежать у таблиці `student_details` (скрипт `supabase-onboarding.sql`, виконати один раз у SQL Editor). Бачать лише учень і тренер.
- Тренер бачить деталі в розділі «Учні» по тапу на картку.

## Адмінка (ізоляція)

Код тренера лежить окремо в `src/admin/`. Він вантажиться ліниво (окремий файл у збірці) і лише на адмінських маршрутах,
обгорнутих у `AdminBoundary`: якщо адмінка впаде, учні цього не відчують. Нові адмінські сторінки додавайте в `src/admin/`
і в `App.jsx` так само: `lazy(() => import(...))` + `<AdminBoundary>`.
Зламану збірку GitHub не публікує, тож учні лишаються на останній робочій версії. Експериментуйте в окремій гілці, а в `main` зливайте перевірене.

## Що далі

- Замінити схему-заготовку в `Anatomy.jsx` на повноцінний SVG м'язів.
- Додати свої відео та описи вправ.
- Етап 2: акаунти й прогрес (Supabase).


## Вхід через LINE

LINE при вході з браузера підписує ID-токен алгоритмом HS256, а власні OIDC-провайдери Supabase приймають лише ES256,
тому стандартне підключення (`custom:line`) не працює (помилка `unexpected signature algorithm "HS256"`).
Вхід іде через Edge Function `line-login` (`supabase/functions/line-login/index.ts`) і сторінку `public/line-callback.html`.

1. LINE Developers -> канал **LINE Login** (тип Web app). Запишіть Channel ID і Channel secret (Basic settings).
2. У каналі, вкладка **LINE Login**, Callback URL: `https://olegracer.github.io/Coach/line-callback.html`. Статус каналу: **Published**.
3. Supabase -> Edge Functions -> Deploy a new function -> назва `line-login`, код із `supabase/functions/line-login/index.ts`.
   Вимкніть **Verify JWT**.
4. Edge Functions -> Secrets: `LINE_CHANNEL_ID`, `LINE_CHANNEL_SECRET`. Для іншого сайту (власний домен) додайте
   `APP_ORIGINS` (адреси через кому, наприклад `https://olegracer.github.io,https://coach.example.com`).
5. Провайдер `custom:line` у Supabase (Authentication -> Providers) більше не потрібен, його можна видалити.

Як це працює: застосунок просить у функції адресу входу LINE, учень входить у LINE, LINE повертає код на `line-callback.html`,
функція обмінює код на токен, перевіряє його в LINE, створює (або знаходить) користувача `line_<id>@line.local` і віддає
одноразовий токен, яким застосунок відкриває звичайну сесію Supabase. Email у LINE-користувачів умовний.

## Пуш-сповіщення про оплату

1. Supabase → SQL Editor: виконайте `supabase-push.sql`, потім `supabase-storage.sql`.
2. Supabase → Edge Functions → **Deploy a new function** (через Dashboard) з назвою `push`; вставте код з `supabase/functions/push/index.ts`. У налаштуваннях функції **вимкніть Verify JWT**.
3. Edge Functions → Secrets додайте: `VAPID_PUBLIC` (ключ із `src/lib/push.js`), `VAPID_PRIVATE` (приватний ключ), `VAPID_SUBJECT` = `mailto:ваша@пошта`.
4. У додатку: Профіль → «Пуш-сповіщення» → дозволити → «Надіслати тест».
5. На iPhone додаток має бути доданий на екран «Додому» (iOS 16.4+).

Приватний VAPID-ключ не кладіть у код додатку. Якщо він потрапив у чат чи на показ, згенеруйте нову пару (`npx web-push generate-vapid-keys`), оновіть секрети й `VAPID_PUBLIC` у `src/lib/push.js`; усі повинні увімкнути сповіщення знову.
