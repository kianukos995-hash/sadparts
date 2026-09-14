"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileFields } from "@/components/profile-fields";
import { useAuth } from "@/hooks/use-auth";
import { ROLE_LABELS } from "@/lib/roles";

export default function ProfilePage() {
  const { user } = useAuth();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Профиль</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user ? ROLE_LABELS[user.role] : ""} · аватар и контакты видны в правом углу.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Личные данные</CardTitle>
          <CardDescription>
            ФИО, телефон, почта, автомобиль и фото. Закуп показывается только если администратор явно
            включил «видеть закуп».
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileFields />
        </CardContent>
      </Card>
    </div>
  );
}
