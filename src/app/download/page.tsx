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
            href="/api/download"
            className={cn(buttonVariants({ size: "lg" }), "h-12 w-full justify-center text-base")}
          >
            <Download />
            Скачать ZIP
          </a>
          <p className="text-xs text-muted-foreground">
            Если браузер ничего не спросил — проверьте папку «Загрузки». Имя файла:
            sadparts-prices.zip
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Как открыть у себя или у коллеги</CardTitle>
          <CardDescription>Нужны Node.js 20+ и npm</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <ol className="list-decimal space-y-2 pl-5">
            <li>Распакуйте ZIP в любую папку.</li>
            <li>
              В этой папке выполните:
              <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-950 p-3 text-xs text-zinc-100">
                npm install{"\n"}npm run build{"\n"}npm start
              </pre>
            </li>
            <li>
              Откройте{" "}
              <a className="font-medium underline" href="http://127.0.0.1:43217">
                http://127.0.0.1:43217
              </a>
            </li>
          </ol>
          <p className="text-muted-foreground">
            Свой сервер и Google Cloud — в файле DEPLOY.md внутри архива. Google Диск только
            передаёт файл, сам сайт он не запускает.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
