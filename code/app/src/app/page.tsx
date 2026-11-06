import { Suspense } from "react";
import { SurveyFlow } from "@/components/survey-flow";
import { SurveySkeleton } from "@/components/survey-skeleton";

// Landing page for the email link: /?campaign=2026-Q4 (no campaign → the open one).
// The flow is a client component that talks to the Route Handlers in src/app/api; all Databricks
// and Lakebase access stays on the server.
export default function Home() {
  return (
    <Suspense fallback={<SurveySkeleton />}>
      <SurveyFlow />
    </Suspense>
  );
}
