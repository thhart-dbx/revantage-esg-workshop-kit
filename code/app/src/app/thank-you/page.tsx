import { Suspense } from "react";
import { ThankYou } from "@/components/thank-you";
import { SurveySkeleton } from "@/components/survey-skeleton";

export default function ThankYouPage() {
  return (
    <Suspense fallback={<SurveySkeleton />}>
      <ThankYou />
    </Suspense>
  );
}
