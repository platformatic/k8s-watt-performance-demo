import type { Route } from "./+types/home";
import { Welcome } from "../welcome/welcome";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  return { pid: process.pid };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const { pid } = loaderData;
  return <div>
    <Welcome />
    <div className="flex items-center justify-center pt-16 pb-4">
      <div className="flex-1 flex flex-col items-center gap-16 min-h-0">
        <p>pid is: {pid}</p>
      </div>
    </div>
  </div>;
}
