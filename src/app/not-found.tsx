import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-20 text-center">
      <h1 className="text-2xl font-semibold">Страница не найдена</h1>
      <p className="text-sm text-muted-foreground">
        Такой страницы в АвтоПрайсе нет. Вернитесь к каталогу или списку поставщиков.
      </p>
      <Link href="/" className={cn(buttonVariants())}>
        На обзор
      </Link>
    </div>
  );
}
