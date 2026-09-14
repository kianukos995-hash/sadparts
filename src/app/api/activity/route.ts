import { readActivity } from "@/lib/activity";
import { fail, requireUser } from "@/lib/session";
import { listAccessKeys, listStaffUsers } from "@/lib/auth-store";
import { activityVisibleTo, canSeeCost, canSeeHistory, keyedUserIdsFor } from "@/lib/scope";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    if (!canSeeHistory(user.role)) {
      return Response.json({ error: "Недостаточно прав" }, { status: 403 });
    }
    const [events, keys, staff] = await Promise.all([
      readActivity(500),
      listAccessKeys(),
      listStaffUsers(user),
    ]);
    const keyed = keyedUserIdsFor(user, keys, staff.users);
    const visible = events.filter((event) => activityVisibleTo(user, event, keyed)).map((event) => {
      if (canSeeCost(user.role)) return event;
      return { ...event, buyPrice: undefined };
    });
    return Response.json({ events: visible });
  } catch (error) {
    return fail(error);
  }
}
