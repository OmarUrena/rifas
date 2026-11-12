import { checkoutProxy } from "@/features/checkout/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const GET = checkoutProxy;
export const POST = checkoutProxy;
export const DELETE = checkoutProxy;
