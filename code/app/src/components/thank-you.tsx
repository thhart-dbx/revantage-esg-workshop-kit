"use client";

import { useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Leaf } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCampaign } from "@/lib/survey-types";

interface Thanks {
  name?: string;
  property?: string | null;
  campaign?: string;
  answers?: number;
}

const subscribe = () => () => {};
const readThanks = () => sessionStorage.getItem("survey-thanks");

export function ThankYou() {
  const params = useSearchParams();
  const raw = useSyncExternalStore(subscribe, readThanks, () => null);
  let info: Thanks = {};
  try {
    info = raw ? (JSON.parse(raw) as Thanks) : {};
  } catch {}
  const campaign = params.get("campaign") ?? info.campaign ?? "";
  const ref = params.get("ref");
  const firstName = info.name?.split(" ")[0];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-20">
      <Card className="text-center">
        <CardContent className="flex flex-col items-center px-6 py-10 sm:px-10">
          <span className="flex size-16 items-center justify-center rounded-full bg-accent">
            <CheckCircle2 className="size-9 text-brand-green" aria-hidden />
          </span>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-brand-navy sm:text-3xl" data-testid="thank-you-title">
            Thank you{firstName ? `, ${firstName}` : ""}!
          </h1>
          <p className="mt-3 max-w-md text-muted-foreground">
            Your {campaign ? `${formatCampaign(campaign)} ` : ""}survey response
            {info.property ? ` for ${info.property}` : ""} has been received. Our building and sustainability teams review
            every response, and we&apos;ll share what we&apos;re doing about it in next quarter&apos;s tenant update.
          </p>
          {ref && (
            <p className="mt-6 rounded-md bg-muted px-3 py-1.5 font-mono text-xs text-muted-foreground">
              Reference <span data-testid="response-ref">{ref}</span>
            </p>
          )}
          <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Leaf className="size-4 text-brand-green" aria-hidden /> You can close this page.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
