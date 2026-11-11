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

Кнопка «Увійти через LINE» у профілі викликає `supabase.auth.signInWithOAuth({ provider: 'custom:line' })`.
Для цього в Supabase має бути власний OIDC-провайдер з ідентифікатором `custom:line` (безкоштовний тариф дозволяє до 3 власних провайдерів).

1. LINE Developers Console (developers.line.biz): Provider -> Create channel -> **LINE Login**, тип **Web app**.
2. У каналі, вкладка **LINE Login**: додайте Callback URL з Supabase (див. п. 3).
3. Supabase -> Authentication -> Auth Providers -> **New Provider** -> **Auto-discovery (OIDC)**:
   - Identifier: `custom:line`
   - Client ID: Channel ID каналу LINE; Client Secret: Channel secret
   - Issuer URL: `https://access.line.me`
   - Scopes: `openid profile email`
   - Увімкніть дозвіл на користувачів без email (`email_optional`), доки LINE не схвалив доступ до email.
   Callback URL береться з форми створення провайдера (його треба вписати в LINE, п. 2).
4. Щоб LINE віддавав email: у каналі LINE, Basic settings -> OpenID Connect -> **Apply** (потрібен скріншот, як ви використовуєте email). Без схвалення вхід працює, але email буде порожнім.
5. Статус каналу LINE переведіть з Developing у **Published**, інакше увійти зможуть лише адміни каналу й тестувальники.

## Пуш-сповіщення про оплату

1. Supabase → SQL Editor: виконайте `supabase-push.sql`, потім `supabase-storage.sql`.
2. Supabase → Edge Functions → **Deploy a new function** (через Dashboard) з назвою `push`; вставте код з `supabase/functions/push/index.ts`. У налаштуваннях функції **вимкніть Verify JWT**.
3. Edge Functions → Secrets додайте: `VAPID_PUBLIC` (ключ із `src/lib/push.js`), `VAPID_PRIVATE` (приватний ключ), `VAPID_SUBJECT` = `mailto:ваша@пошта`.
4. У додатку: Профіль → «Пуш-сповіщення» → дозволити → «Надіслати тест».
5. На iPhone додаток має бути доданий на екран «Додому» (iOS 16.4+).

Приватний VAPID-ключ не кладіть у код додатку. Якщо він потрапив у чат чи на показ, згенеруйте нову пару (`npx web-push generate-vapid-keys`), оновіть секрети й `VAPID_PUBLIC` у `src/lib/push.js`; усі повинні увімкнути сповіщення знову.
