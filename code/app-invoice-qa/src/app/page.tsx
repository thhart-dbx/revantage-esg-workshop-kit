import { Suspense } from "react";
import { QueueView } from "@/components/queue-view";

export default function Home() {
  return (
    <Suspense>
      <QueueView />
    </Suspense>
  );
}
