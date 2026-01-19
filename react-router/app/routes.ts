import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("games", "routes/games.tsx"),
  route("games/:slug", "routes/games.$slug.tsx"),
  route("sets/:slug", "routes/sets.$slug.tsx"),
  route("cards/:id", "routes/cards.$id.tsx"),
  route("search", "routes/search.tsx"),
  route("sellers", "routes/sellers.tsx"),
  route("sellers/:slug", "routes/sellers.$slug.tsx"),
  route("cart", "routes/cart.tsx"),
] satisfies RouteConfig;
