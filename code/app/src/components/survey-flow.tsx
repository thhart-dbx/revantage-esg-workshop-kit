"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  Loader2,
  Lock,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { cn } from "cn";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { LikertQuestion } from "@/components/likert-question";
import { SurveySkeleton } from "@/components/survey-skeleton";
import {
  TEXT_MAX_LENGTH,
  formatCampaign,
  type Campaign,
  type LookupResult,
  type Question,
  type SubmitResult,
} from "@/lib/survey-types";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso.replace(" ", "T")).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : null;

export function SurveyFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const requestedCampaign = params.get("campaign");

  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadError, setLoadError] = useState<string>("");
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  const [step, setStep] = useState<"identify" | "survey">("identify");
  const [email, setEmail] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [lookup, setLookup] = useState<LookupResult[] | null>(null);
  const [selected, setSelected] = useState(0);

  const [likert, setLikert] = useState<Record<number, number>>({});
  const [texts, setTexts] = useState<Record<number, string>>({});
  const [showErrors, setShowErrors] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Fetch campaign + questions; state is set only in the promise callbacks.
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const qs = requestedCampaign ? `?campaign=${encodeURIComponent(requestedCampaign)}` : "";
    fetch(`/api/survey${qs}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "The survey could not be loaded.");
        if (cancelled) return;
        setCampaign(body.campaign);
        setQuestions(body.questions);
        setLoadState("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e instanceof Error ? e.message : "The survey could not be loaded.");
        setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [requestedCampaign, reloadKey]);

  const likertQs = useMemo(() => questions.filter((q) => q.question_type === "likert"), [questions]);
  const textQs = useMemo(() => questions.filter((q) => q.question_type === "text"), [questions]);
  const themes = useMemo(() => {
    const m = new Map<string, Question[]>();
    for (const q of likertQs) m.set(q.theme, [...(m.get(q.theme) ?? []), q]);
    return [...m.entries()];
  }, [likertQs]);
  const answered = likertQs.filter((q) => likert[q.question_id] !== undefined).length;
  const missing = likertQs.filter((q) => likert[q.question_id] === undefined);

  const match = lookup?.[selected] ?? null;

  useEffect(() => {
    if (step === "survey") document.getElementById("survey-body")?.scrollIntoView({ block: "start" });
  }, [step]);

  async function onLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!campaign) return;
    setLookupError("");
    setLookup(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setLookupError("Please enter a valid work email address.");
      return;
    }
    setLookupBusy(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), campaign_id: campaign.campaign_id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong. Please try again.");
      setLookup(body.results);
      setSelected(0);
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLookupBusy(false);
    }
  }

  async function onSubmit() {
    if (!campaign || !match) return;
    setSubmitError("");
    if (missing.length) {
      setShowErrors(true);
      document.getElementById(`q-${missing[0].question_id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitBusy(true);
    try {
      const answers = [
        ...likertQs.map((q) => ({ question_id: q.question_id, likert_value: likert[q.question_id] })),
        ...textQs.map((q) => ({ question_id: q.question_id, text_value: texts[q.question_id] ?? "" })),
      ];
      const res = await fetch("/api/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaign.campaign_id,
          email: match.contact.contact_email,
          contact_id: match.contact.contact_id,
          answers,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Your answers could not be saved. Please try again.");
      const result = body as SubmitResult;
      sessionStorage.setItem(
        "survey-thanks",
        JSON.stringify({
          name: match.contact.contact_name,
          property: match.contact.property_name,
          campaign: campaign.campaign_id,
          answers: result.answers_saved,
        }),
      );
      router.push(`/thank-you?campaign=${encodeURIComponent(campaign.campaign_id)}&ref=${result.response_id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Your answers could not be saved. Please try again.");
      setSubmitBusy(false);
    }
  }

  if (loadState === "loading") return <SurveySkeleton />;
  if (loadState === "error" || !campaign) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 sm:px-6">
        <Alert variant="destructive" data-testid="load-error">
          <AlertCircle />
          <AlertTitle>Survey unavailable</AlertTitle>
          <AlertDescription>
            <p>{loadError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => {
                setLoadState("loading");
                setReloadKey((k) => k + 1);
              }}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const closesOn = fmtDate(campaign.closes_at);

  return (
    <div className="w-full">
      {/* Hero */}
      <section className="border-b bg-gradient-to-b from-white to-background">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-brand-green text-white" data-testid="campaign-badge">
              {formatCampaign(campaign.campaign_id)} survey
            </Badge>
            {campaign.is_open ? (
              closesOn && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <CalendarClock className="size-3.5" /> Open until {closesOn}
                </span>
              )
            ) : (
              <Badge variant="outline">Closed</Badge>
            )}
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-brand-navy sm:text-4xl">
            Tenant ESG &amp; Satisfaction Survey
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Tell us how your building performs on comfort, energy, water, waste and wellbeing. Your feedback
            shapes our sustainability investments and our GRESB and CSRD reporting for your property.
          </p>
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Clock className="size-4 text-brand-green" /> About 5 minutes
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="size-4 text-brand-green" /> {likertQs.length} statements · {textQs.length} open questions
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-4 text-brand-green" /> Used only to improve your building
            </span>
          </div>
        </div>
      </section>

      <div id="survey-body" className="mx-auto w-full max-w-4xl scroll-mt-0 px-4 py-8 sm:px-6 sm:py-10">
        {!campaign.is_open && (
          <Alert className="mb-6" data-testid="closed-notice">
            <Lock />
            <AlertTitle>This survey is closed</AlertTitle>
            <AlertDescription>
              The {formatCampaign(campaign.campaign_id)} survey is no longer accepting responses. Thank you for your interest;
              look out for next quarter&apos;s invitation.
            </AlertDescription>
          </Alert>
        )}

        {step === "identify" && (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-lg">Start with your work email</CardTitle>
              <CardDescription>
                We use it to find your company and property, so your answers go to the right building team.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onLookup} className="flex flex-col gap-3 sm:flex-row sm:items-end" noValidate>
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="email">Work email</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setLookup(null);
                      setLookupError("");
                    }}
                    disabled={!campaign.is_open}
                    aria-invalid={!!lookupError || undefined}
                    className="h-10"
                  />
                </div>
                <Button type="submit" className="h-10 px-5" disabled={lookupBusy || !campaign.is_open || !email.trim()}>
                  {lookupBusy ? <Loader2 className="animate-spin" /> : null}
                  Find my building
                </Button>
              </form>

              {lookupError && (
                <Alert variant="destructive" className="mt-4" data-testid="lookup-error">
                  <AlertCircle />
                  <AlertTitle>We couldn&apos;t verify that email</AlertTitle>
                  <AlertDescription>{lookupError}</AlertDescription>
                </Alert>
              )}

              {lookup && match && (
                <div className="mt-5 space-y-4" data-testid="contact-match">
                  {lookup.length > 1 && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Your email is registered at more than one property. Which building is this response for?</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {lookup.map((r, i) => (
                          <button
                            key={r.contact.contact_id}
                            type="button"
                            onClick={() => setSelected(i)}
                            className={cn(
                              "rounded-lg border p-3 text-left text-sm transition-colors hover:bg-accent/60",
                              i === selected && "border-brand-green bg-accent ring-1 ring-brand-green",
                            )}
                          >
                            <span className="font-medium">{r.contact.property_name}</span>
                            <span className="block text-muted-foreground">{r.contact.city}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="rounded-xl border bg-muted/40 p-4">
                    <p className="text-sm text-muted-foreground">Welcome,</p>
                    <p className="text-lg font-semibold text-brand-navy" data-testid="contact-name">
                      {match.contact.contact_name}
                    </p>
                    <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                      <span className="flex items-center gap-2">
                        <Building2 className="size-4 text-brand-green" />
                        <span data-testid="contact-company">{match.contact.tenant_name ?? "Tenant"}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <MapPin className="size-4 text-brand-green" />
                        <span data-testid="contact-property">
                          {match.contact.property_name}
                          {match.contact.city ? `, ${match.contact.city}` : ""}
                        </span>
                      </span>
                    </div>
                  </div>
                  {match.alreadyResponded ? (
                    <Alert data-testid="already-responded">
                      <CheckCircle2 className="text-brand-green" />
                      <AlertTitle>You&apos;ve already completed this survey</AlertTitle>
                      <AlertDescription>
                        We received your {formatCampaign(campaign.campaign_id)} response on {fmtDate(match.alreadyResponded.submitted_at)}.
                        Thank you! Each contact can respond once per quarter.
                      </AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              )}
            </CardContent>
            {lookup && match && !match.alreadyResponded && (
              <CardFooter className="justify-end">
                <Button onClick={() => setStep("survey")} className="px-5" data-testid="start-survey">
                  Start the survey <ArrowRight />
                </Button>
              </CardFooter>
            )}
          </Card>
        )}

        {step === "survey" && match && (
          <div className="space-y-8">
            <div className="sticky top-0 z-10 -mx-4 border-b bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
              <div className="flex items-center justify-between gap-4 text-sm">
                <button
                  type="button"
                  onClick={() => setStep("identify")}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="size-4" /> Back
                </button>
                <span className="truncate text-muted-foreground">
                  {match.contact.tenant_name} · {match.contact.property_name}
                </span>
                <span className="shrink-0 font-medium tabular-nums" data-testid="progress-count">
                  {answered} / {likertQs.length}
                </span>
              </div>
              <Progress value={likertQs.length ? (answered / likertQs.length) * 100 : 0} className="mt-2" aria-label="Survey progress" />
            </div>

            <p className="text-sm text-muted-foreground">
              For each statement, choose how much you agree, from <strong>1 Strongly disagree</strong> to{" "}
              <strong>5 Strongly agree</strong>.
            </p>

            <section className="space-y-3" aria-labelledby="rate-heading">
              <h2 id="rate-heading" className="text-base font-semibold text-brand-navy">
                Rate your building
              </h2>
              {themes.flatMap(([, qs]) => qs).map((q, i) => (
                <LikertQuestion
                  key={q.question_id}
                  question={q}
                  number={i + 1}
                  value={likert[q.question_id]}
                  invalid={showErrors && likert[q.question_id] === undefined}
                  onChange={(v) => setLikert((s) => ({ ...s, [q.question_id]: v }))}
                />
              ))}
            </section>

            {textQs.length > 0 && (
              <section className="space-y-3">
                <Separator />
                <h2 className="pt-2 text-base font-semibold text-brand-navy">In your own words</h2>
                <p className="text-sm text-muted-foreground">Optional, but this is where we learn the most.</p>
                {textQs.map((q) => {
                  const v = texts[q.question_id] ?? "";
                  return (
                    <div key={q.question_id} className="rounded-xl border bg-white p-4 sm:p-5">
                      <p className="mb-1.5 text-xs font-medium tracking-wide text-brand-green uppercase">{q.theme}</p>
                      <Label htmlFor={`t-${q.question_id}`} className="text-[0.95rem] leading-relaxed font-medium">
                        {q.question_text}
                      </Label>
                      <Textarea
                        id={`t-${q.question_id}`}
                        className="mt-3 min-h-24"
                        maxLength={TEXT_MAX_LENGTH}
                        value={v}
                        placeholder="Type your answer…"
                        onChange={(e) => setTexts((s) => ({ ...s, [q.question_id]: e.target.value }))}
                      />
                      <p className="mt-1 text-right text-xs text-muted-foreground tabular-nums">
                        {v.length} / {TEXT_MAX_LENGTH}
                      </p>
                    </div>
                  );
                })}
              </section>
            )}

            {showErrors && missing.length > 0 && (
              <Alert variant="destructive" data-testid="validation-error">
                <AlertCircle />
                <AlertTitle>
                  {missing.length === 1 ? "1 statement still needs an answer" : `${missing.length} statements still need an answer`}
                </AlertTitle>
                <AlertDescription>They are highlighted above.</AlertDescription>
              </Alert>
            )}
            {submitError && (
              <Alert variant="destructive" data-testid="submit-error">
                <AlertCircle />
                <AlertTitle>Not submitted</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col-reverse gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Responding as {match.contact.contact_email} for {match.contact.property_name}.
              </p>
              <Button size="lg" className="h-11 px-6" onClick={onSubmit} disabled={submitBusy} data-testid="submit-survey">
                {submitBusy ? <Loader2 className="animate-spin" /> : null}
                Submit my answers
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
