import type { Router } from "expo-router";

type MaybeRouter = Router | any;

function safePush(router: MaybeRouter, path: string) {
  try {
    if (router?.push) return router.push(path as any);
  } catch {}
  return null;
}

function safeBack(router: MaybeRouter) {
  try {
    if (router?.back) return router.back();
  } catch {}
  return null;
}

export function navigateToProduct(routerOrProductId?: MaybeRouter | string | number, maybeProductId?: string | number) {
  const hasRouter = typeof routerOrProductId === "object" && routerOrProductId !== null;
  const router = hasRouter ? routerOrProductId : null;
  const productId = hasRouter ? maybeProductId : routerOrProductId;

  const id = productId == null ? "" : String(productId);
  const path = id ? `/product/${encodeURIComponent(id)}` : "/";

  if (router) return safePush(router, path);
  return path;
}

export function goBack(router?: MaybeRouter) {
  if (router) return safeBack(router);
  return null;
}

export function navigateToRoute(router: MaybeRouter, path: string) {
  return safePush(router, path);
}

export function navigateHome(router?: MaybeRouter) {
  if (router) return safePush(router, "/");
  return "/";
}
