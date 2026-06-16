import { NextRequest, NextResponse } from "next/server";
import { isApiError, requireUser, validationError } from "@/lib/api";
import { getEmployeePerformance } from "@/lib/employee-performance";

export async function GET(request: NextRequest) {
  const user = await requireUser(request, "reports.view");
  if (isApiError(user)) return user;
  try {
    const params = new URL(request.url).searchParams;
    const employees = await getEmployeePerformance(user, {
      storeId: params.get("storeId"),
      role: params.get("role"),
      dateFrom: params.get("dateFrom"),
      dateTo: params.get("dateTo"),
      search: params.get("search"),
    });
    return NextResponse.json({ employees });
  } catch (error) {
    return validationError(error);
  }
}
