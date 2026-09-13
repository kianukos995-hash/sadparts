import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function DownloadPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Скачать проект</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Весь SadParts Prices одним файлом ZIP. Его можно положить на флешку, Google Диск или
          отправить коллеге.
        </p>
      </div>

      <Card className="border-amber-300 bg-amber-50/70">
        <CardHeader>
          <CardTitle>sadparts-prices.zip</CardTitle>
          <CardDescription>
            Исходники, Docker, шаблоны накладных и демо-прайс. Папка node_modules не входит —
            её коллега ставит у себя командой npm install.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <a
            href="/sadparts-prices.zip"
            className={cn(buttonVariants({ size: "lg" }), "h-12 w-full justify-center text-base")}
          >
            <Download />
            Скачать ZIP
          </a>
          <p className="text-xs text-muted-foreground">
            Windows 11: файл окажется в «Загрузки» как sadparts-prices.zip. Если браузер
            ничего не спросил — проверьте папку Downloads и защиту SmartScreen.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Windows 11 — как открыть у себя</CardTitle>
          <CardDescription>
            Адрес превью Cursor — облако агента, не ваш ПК. На Win11 программа появится только
            после запуска файла в распакованной папке.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Поставьте Node.js 20 LTS, установщик Windows 64-bit с{" "}
              <a className="underline" href="https://nodejs.org" target="_blank" rel="noreferrer">
                nodejs.org
              </a>
              , галочка Add to PATH.
            </li>
            <li>
              Правый клик по zip → <strong>Извлечь всё</strong> в папку вроде{" "}
              <code>C:\SadParts</code>. Не запускайте файлы изнутри архива.
            </li>
            <li>
              Внутри папки дважды кликните <code>start-windows.bat</code>. Первая установка
              займёт несколько минут. Чёрное окно не закрывайте.
            </li>
            <li>
              Браузер откроет{" "}
              <a className="font-medium underline" href="http://127.0.0.1:43217">
                http://127.0.0.1:43217
              </a>{" "}
              уже на вашем компьютере. Если брандмауэр спросит — разрешите Node.js.
            </li>
          </ol>
          <p className="text-muted-foreground">
            Подробности — WINDOWS.md в архиве. Google Диск только передаёт файл, сам сайт он не
            запускает.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
