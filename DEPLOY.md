# Как запустить и поделиться SadParts Prices

Проект — это Node.js-приложение (Next.js). Одного HTML-файла недостаточно: нужны прайсы, API и запись заказов. Готовый пакет — **один ZIP**.

Архив собирается так:

```bash
npm run pack
```

Файл появится в `dist/sadparts-prices.zip`. Его можно положить на Google Диск, Яндекс Диск, почту или флешку.

## Что внутри ZIP

Исходники, `Dockerfile`, шаблоны накладных, демо-прайс. `node_modules` в архив не входит — коллега ставит зависимости у себя (или собирает Docker-образ).

Нужны **Node.js 20+** и npm. Порт по умолчанию **43217**. Для облака можно задать `PORT`.

---

## 1. У себя на компьютере (Windows / Mac / Linux)

1. Распакуйте ZIP.
2. В папке проекта:

```bash
npm install
npm run build
npm start
```

3. Откройте http://127.0.0.1:43217

Режим разработки (без `build`): `npm run dev`.

Как отдельное окно Chrome: `npm run build` затем `npm run desktop`.

---

## 2. Свой сервер (VPS: Timeweb, Selectel, Beget, любой Ubuntu)

Самый прямой путь — Docker.

```bash
docker compose up -d --build
```

Сайт: `http://IP-сервера:43217`. Папка `data/` на диске — прайсы, заказы, фото.

Без Docker:

```bash
sudo apt update
sudo apt install -y nodejs npm
# лучше Node 20 с https://github.com/nodesource/distributions
npm install
npm run build
PORT=43217 npm start
```

Чтобы не падало после выхода из SSH, используйте systemd или `pm2 start scripts/start.mjs --name sadparts`.

Пробросьте порт 43217 в файрволе или поставьте nginx:

```nginx
server {
  listen 80;
  server_name parts.example.ru;
  location / {
    proxy_pass http://127.0.0.1:43217;
    proxy_set_header Host $host;
    client_max_body_size 80m;
  }
}
```

Потом HTTPS через Certbot (`certbot --nginx`).

---

## 3. Google — два рабочих варианта

### A. Поделиться файлом (самый простой)

1. Загрузите `sadparts-prices.zip` на **Google Диск**.
2. Правый клик → Открыть доступ → «Все, у кого есть ссылка».
3. Коллега скачивает ZIP и запускает как в пункте 1.

Это не «сайт в облаке», а передача программы. Google Sites / Google Drive **не хостят** Node.js.

### B. Сайт в Google Cloud Run (ссылка для коллег)

Нужен аккаунт Google Cloud (есть бесплатный пробный кредит).

1. Установите [Google Cloud SDK](https://cloud.google.com/sdk/docs/install).
2. В папке проекта:

```bash
gcloud auth login
gcloud config set project ВАШ_PROJECT_ID
gcloud run deploy sadparts-prices \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 43217 \
  --memory 1Gi \
  --cpu 1
```

Cloud Run соберёт Docker и выдаст URL вида `https://sadparts-prices-xxxxx.run.app`. Эту ссылку можно кинуть коллегам.

Ограничение: диск Cloud Run временный. После «засыпания» сервиса загруженные прайсы могут пропасть. Для постоянной работы лучше свой VPS с томом `data/` или Cloud Run + бакет/диск. Для демо коллегам Cloud Run обычно хватает.

---

## 4. Другие облака

| Куда | Как | Заметка |
|------|-----|---------|
| **Свой VPS + Docker** | `docker compose up -d` | Лучший вариант «навсегда» |
| **Google Cloud Run** | команда выше | Удобная https-ссылка |
| **Render / Fly.io / Railway** | Dockerfile, порт `PORT` | Как Cloud Run |
| **Vercel** | не рекомендуется | Нет постоянного диска под jsonl-прайсы |
| **Cloudflare Tunnel** | см. ниже | Быстро показать свой ПК без белого IP |
| **ngrok** | `ngrok http 43217` | То же, нужна регистрация |

Быстрый туннель с вашего компьютера, пока программа запущена:

```bash
npx --yes cloudflared tunnel --url http://127.0.0.1:43217
```

В терминале появится `https://….trycloudflare.com` — её можно скинуть коллеге. Работает, пока открыт туннель и запущен `npm start`.

---

## 5. Что сказать коллеге

> Скачай ZIP, поставь Node 20, в папке: `npm install && npm run build && npm start`, открой http://127.0.0.1:43217  
> Либо: `docker compose up --build` и тот же адрес.

Ключи Росско и Telegram каждый вставляет в **Настройки** у себя. Боевые ключи в ZIP не кладите.
