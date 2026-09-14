import { isPostedStatus } from "@/lib/warehouse";
import type { ManagerMembership, Order, ScheduleArchive, ScheduleDay, ScheduleMark } from "@/lib/types";

export const SCHEDULE_MARK_LABELS: Record<ScheduleMark, string> = {
  work: "Смена",
  vacation: "Отпуск",
  sick: "Больничный",
  timeoff: "Отгул",
  absent: "Прогул",
};

export const MONTH_LABELS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

export function isoDate(year: number, monthIndex: number, day: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function weekdayOffset(year: number, monthIndex: number) {
  const day = new Date(year, monthIndex, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

export function orderSellVolume(order: Order) {
  return order.lines.reduce((sum, line) => sum + (line.snapshotSell ?? line.buyPrice) * line.qty, 0);
}

export function managerPostedOrders(orders: Order[], membership: ManagerMembership) {
  return orders.filter(
    (order) =>
      (Boolean(order.postedAt) || isPostedStatus(order.status)) &&
      order.createdByUserId === membership.userId &&
      order.organizationId === membership.organizationId,
  );
}

export type ManagerKpi = {
  userId: string;
  organizationId: string;
  orderCount: number;
  volume: number;
  percentPart: number;
  fixedPart: number;
  workDays: number;
  shiftPart: number;
  total: number;
};

export function computeManagerKpi(
  membership: ManagerMembership,
  orders: Order[],
  days: ScheduleDay[],
  year: number,
): ManagerKpi {
  const posted = orders.filter(
    (order) =>
      (Boolean(order.postedAt) || isPostedStatus(order.status)) &&
      order.createdByUserId === membership.userId &&
      order.organizationId === membership.organizationId,
  );
  const volume = posted.reduce((sum, order) => sum + orderSellVolume(order), 0);
  const prefix = `${year}-`;
  const workDays = days.filter(
    (day) =>
      day.userId === membership.userId &&
      day.organizationId === membership.organizationId &&
      day.mark === "work" &&
      day.date.startsWith(prefix),
  ).length;
  const percentPart = volume * ((membership.incomePercent || 0) / 100);
  const fixedPart = posted.length * (membership.incomeFixed || 0);
  const shiftPart = workDays * (membership.shiftRate || 0);
  return {
    userId: membership.userId,
    organizationId: membership.organizationId,
    orderCount: posted.length,
    volume,
    percentPart,
    fixedPart,
    workDays,
    shiftPart,
    total: percentPart + fixedPart + shiftPart,
  };
}

export function daysForYear(days: ScheduleDay[], year: number, userId?: string) {
  const prefix = `${year}-`;
  return days.filter(
    (day) => day.date.startsWith(prefix) && (!userId || day.userId === userId),
  );
}

export function archiveTitle(archive: ScheduleArchive) {
  return `Архив ${archive.year}`;
}
