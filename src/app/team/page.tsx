"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useAvtoPrice } from "@/hooks/use-avtoprice";
import {
  MONTH_LABELS,
  SCHEDULE_MARK_LABELS,
  computeManagerKpi,
  daysInMonth,
  isoDate,
  weekdayOffset,
} from "@/lib/hr";
import { formatMoney } from "@/lib/format";
import type { ManagerMembership, ScheduleArchive, ScheduleDay, ScheduleMark } from "@/lib/types";

const MARK_COLORS: Record<ScheduleMark, string> = {
  work: "bg-emerald-100 text-emerald-900",
  vacation: "bg-sky-100 text-sky-900",
  sick: "bg-amber-100 text-amber-900",
  timeoff: "bg-violet-100 text-violet-900",
  absent: "bg-red-100 text-red-900",
};

type StaffUser = { id: string; name: string; email: string; role: string };

function money(value: number) {
  return `${Math.round(value).toLocaleString("ru-RU")} ₽`;
}

export default function TeamPage() {
  return (
    <RoleGate allow={["organization", "manager"]}>
      <TeamInner />
    </RoleGate>
  );
}

function TeamInner() {
  const { user } = useAuth();
  const {
    ready,
    orders,
    managerMemberships,
    scheduleDays,
    scheduleArchives,
    upsertManagerMembership,
    upsertScheduleDay,
    archiveScheduleYear,
  } = useAvtoPrice();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const yearNow = new Date().getFullYear();
  const [year, setYear] = useState(yearNow);
  const [selectedUserId, setSelectedUserId] = useState(user?.id ?? "");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [archiveView, setArchiveView] = useState<ScheduleArchive | null>(null);
  const orgOnly = user?.role === "organization";

  useEffect(() => {
    void fetch("/api/auth/users")
      .then(async (response) => {
        const data = (await response.json()) as { users?: StaffUser[] };
        setUsers((data.users ?? []).filter((item) => item.role === "manager"));
      })
      .catch(() => undefined);
  }, []);

  const memberships = managerMemberships;
  const activeUserId = selectedUserId || memberships[0]?.userId || user?.id || "";

  const daysSource = archiveView?.days ?? scheduleDays;
  const kpis = useMemo(
    () =>
      memberships.map((membership) =>
        computeManagerKpi(membership, orders, scheduleDays, yearNow),
      ),
    [memberships, orders, scheduleDays, yearNow],
  );

  if (!ready) return <p className="text-sm text-muted-foreground">Загружаю команду…</p>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Команда</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          KPI с ключа менеджера (% от сделок, фикс за заказ и стоимость смен), график на год и архив
          прошлых лет. Администратора здесь нет.
        </p>
      </div>

      <Tabs defaultValue="kpi">
        <TabsList>
          <TabsTrigger value="kpi">KPI / доход</TabsTrigger>
          <TabsTrigger value="schedule">График</TabsTrigger>
          <TabsTrigger value="archive">Архив</TabsTrigger>
        </TabsList>

        <TabsContent value="kpi" className="mt-4 grid gap-4">
          {memberships.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Нет ключей менеджеров. Выдайте ключ в разделе «Ключи клиентов» и задайте % / фикс /
                ставку смены.
              </CardContent>
            </Card>
          ) : (
            memberships.map((membership) => {
              const kpi = kpis.find((item) => item.userId === membership.userId);
              const person = users.find((item) => item.id === membership.userId);
              return (
                <KpiCard
                  key={membership.id}
                  membership={membership}
                  kpi={kpi}
                  name={person?.name || person?.email || membership.userId}
                  editable={orgOnly}
                  onSave={(next) => {
                    void upsertManagerMembership(next)
                      .then(() => toast.success("Правила дохода сохранены"))
                      .catch((error: unknown) =>
                        toast.error(error instanceof Error ? error.message : "Ошибка"),
                      );
                  }}
                />
              );
            })
          )}
        </TabsContent>

        <TabsContent value="schedule" className="mt-4 grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Календарь {year}</CardTitle>
              <CardDescription>
                Отметки дня: смена, отпуск, больничный, отгул, прогул. Стоимость смен считается только
                по рабочим дням.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap items-end gap-3">
                {orgOnly && memberships.length > 1 ? (
                  <label className="grid gap-1 text-xs">
                    <Label>Менеджер</Label>
                    <select
                      className="h-9 rounded-lg border bg-transparent px-3 text-sm"
                      value={activeUserId}
                      onChange={(event) => setSelectedUserId(event.target.value)}
                    >
                      {memberships.map((item) => {
                        const person = users.find((row) => row.id === item.userId);
                        return (
                          <option key={item.userId} value={item.userId}>
                            {person?.name || item.userId}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                ) : null}
                <label className="grid gap-1 text-xs">
                  <Label>Год</Label>
                  <Input
                    type="number"
                    className="w-28"
                    value={year}
                    onChange={(event) => {
                      setArchiveView(null);
                      setYear(Number.parseInt(event.target.value, 10) || yearNow);
                    }}
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {(Object.keys(SCHEDULE_MARK_LABELS) as ScheduleMark[]).map((mark) => (
                  <span key={mark} className={`rounded px-2 py-0.5 ${MARK_COLORS[mark]}`}>
                    {SCHEDULE_MARK_LABELS[mark]}
                  </span>
                ))}
              </div>
              {selectedDate ? (
                <DayEditor
                  date={selectedDate}
                  userId={activeUserId}
                  organizationId={user?.organizationId || ""}
                  current={daysSource.find(
                    (item) => item.date === selectedDate && item.userId === activeUserId,
                  )}
                  readOnly={Boolean(archiveView)}
                  onClear={() => {
                    const current = daysSource.find(
                      (item) => item.date === selectedDate && item.userId === activeUserId,
                    );
                    if (!current) {
                      setSelectedDate(null);
                      return;
                    }
                    void upsertScheduleDay(current, true)
                      .then(() => toast.success("Отметка снята"))
                      .catch((error: unknown) =>
                        toast.error(error instanceof Error ? error.message : "Ошибка"),
                      );
                  }}
                  onSave={(day) => {
                    void upsertScheduleDay(day)
                      .then(() => toast.success("День отмечен"))
                      .catch((error: unknown) =>
                        toast.error(error instanceof Error ? error.message : "Ошибка"),
                      );
                  }}
                />
              ) : null}
              <YearGrid
                year={year}
                days={daysSource.filter((item) => item.userId === activeUserId)}
                selected={selectedDate}
                onSelect={setSelectedDate}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archive" className="mt-4 grid gap-4">
          {orgOnly ? (
            <Card>
              <CardHeader>
                <CardTitle>Снимок года</CardTitle>
                <CardDescription>
                  Архив не затирает текущий график — это копия на дату сохранения.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  onClick={() => {
                    void archiveScheduleYear(year)
                      .then(() => toast.success(`Год ${year} в архиве`))
                      .catch((error: unknown) =>
                        toast.error(error instanceof Error ? error.message : "Ошибка"),
                      );
                  }}
                >
                  Архивировать {year}
                </Button>
              </CardContent>
            </Card>
          ) : null}
          {scheduleArchives.length === 0 ? (
            <p className="text-sm text-muted-foreground">Архивов пока нет.</p>
          ) : (
            scheduleArchives.map((archive) => (
              <Card key={archive.id}>
                <CardHeader>
                  <CardTitle>Архив {archive.year}</CardTitle>
                  <CardDescription>
                    {new Date(archive.archivedAt).toLocaleString("ru-RU")} · {archive.days.length} отметок
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setArchiveView(archive);
                      setYear(archive.year);
                      toast.message("Открыт архивный график (только просмотр)");
                    }}
                  >
                    Показать в календаре
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({
  membership,
  kpi,
  name,
  editable,
  onSave,
}: {
  membership: ManagerMembership;
  kpi?: ReturnType<typeof computeManagerKpi>;
  name: string;
  editable: boolean;
  onSave: (next: ManagerMembership) => void;
}) {
  const [percent, setPercent] = useState(String(membership.incomePercent));
  const [fixed, setFixed] = useState(String(membership.incomeFixed));
  const [shift, setShift] = useState(String(membership.shiftRate));
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {name}
          <Badge variant="secondary">менеджер</Badge>
        </CardTitle>
        <CardDescription>
          Начисления: {kpi ? money(kpi.total) : "—"} за проведённые заказы и смены этого года.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 text-xs">
            <Label>% от сделок</Label>
            <Input
              value={percent}
              disabled={!editable}
              onChange={(event) => setPercent(event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs">
            <Label>Фикс за заказ, ₽</Label>
            <Input value={fixed} disabled={!editable} onChange={(event) => setFixed(event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs">
            <Label>Стоимость смены, ₽</Label>
            <Input value={shift} disabled={!editable} onChange={(event) => setShift(event.target.value)} />
          </label>
        </div>
        {editable ? (
          <Button
            className="w-fit"
            onClick={() =>
              onSave({
                ...membership,
                incomePercent: Number.parseFloat(percent.replace(",", ".")) || 0,
                incomeFixed: Number.parseFloat(fixed.replace(",", ".")) || 0,
                shiftRate: Number.parseFloat(shift.replace(",", ".")) || 0,
              })
            }
          >
            Сохранить правила
          </Button>
        ) : null}
        {kpi ? (
          <div className="grid gap-1 text-sm text-muted-foreground">
            <p>Проведено заказов: {kpi.orderCount}</p>
            <p>Оборот (продажа): {formatMoney(kpi.volume)}</p>
            <p>
              % от сделок: {money(kpi.percentPart)} · фикс: {money(kpi.fixedPart)} · смены (
              {kpi.workDays}): {money(kpi.shiftPart)}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DayEditor({
  date,
  userId,
  organizationId,
  current,
  readOnly,
  onSave,
  onClear,
}: {
  date: string;
  userId: string;
  organizationId: string;
  current?: ScheduleDay;
  readOnly: boolean;
  onSave: (day: ScheduleDay) => void;
  onClear: () => void;
}) {
  const [note, setNote] = useState(current?.note ?? "");
  return (
    <div className="rounded-lg border px-3 py-3">
      <p className="text-sm font-medium">{date}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        {(Object.keys(SCHEDULE_MARK_LABELS) as ScheduleMark[]).map((mark) => (
          <Button
            key={mark}
            size="sm"
            variant={current?.mark === mark ? "default" : "outline"}
            disabled={readOnly}
            onClick={() =>
              onSave({
                date,
                userId,
                organizationId,
                mark,
                note: note.trim() || undefined,
              })
            }
          >
            {SCHEDULE_MARK_LABELS[mark]}
          </Button>
        ))}
        <Button size="sm" variant="ghost" disabled={readOnly || !current} onClick={onClear}>
          Снять
        </Button>
      </div>
      <Input
        className="mt-2"
        placeholder="Комментарий"
        value={note}
        disabled={readOnly}
        onChange={(event) => setNote(event.target.value)}
      />
    </div>
  );
}

function YearGrid({
  year,
  days,
  selected,
  onSelect,
}: {
  year: number;
  days: ScheduleDay[];
  selected: string | null;
  onSelect: (date: string) => void;
}) {
  const byDate = new Map(days.map((item) => [item.date, item]));
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {MONTH_LABELS.map((label, month) => {
        const count = daysInMonth(year, month);
        const offset = weekdayOffset(year, month);
        const cells = Array.from({ length: offset + count }, (_, index) => {
          if (index < offset) return null;
          const day = index - offset + 1;
          const date = isoDate(year, month, day);
          const mark = byDate.get(date)?.mark;
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              className={`size-7 rounded text-[11px] ${
                mark ? MARK_COLORS[mark] : "hover:bg-muted"
              } ${selected === date ? "ring-2 ring-amber-500" : ""}`}
            >
              {day}
            </button>
          );
        });
        return (
          <div key={label} className="rounded-lg border p-3">
            <p className="mb-2 text-sm font-medium">{label}</p>
            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
              {["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">{cells}</div>
          </div>
        );
      })}
    </div>
  );
}
