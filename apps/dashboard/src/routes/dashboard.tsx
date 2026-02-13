import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { trpc } from "@/utils/trpc";

const RouteComponent = () => {
  const privateData = useQuery(trpc.privateData.queryOptions());

  return (
    <div>
      <h1>Dashboard</h1>
      <p>API: {privateData.data?.message}</p>
    </div>
  );
};

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
});
