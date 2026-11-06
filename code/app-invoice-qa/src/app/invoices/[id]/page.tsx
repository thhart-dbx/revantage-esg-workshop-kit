import { Suspense } from "react";
import { ReviewView } from "@/components/review-view";

export default function InvoicePage() {
  return (
    <Suspense>
      <ReviewView />
    </Suspense>
  );
}
