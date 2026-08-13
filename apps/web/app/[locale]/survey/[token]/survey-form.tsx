"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
import { Label } from "@repo/design-system/components/ui/label";
import { Slider } from "@repo/design-system/components/ui/slider";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { cn } from "@repo/design-system/lib/utils";
import { useState, useTransition } from "react";
import type { SurveyEntryView } from "./actions";
import { submitSurvey } from "./actions";

const NPS_SCORES = Array.from({ length: 11 }, (_, i) => i);

export function SurveyForm({
  entry,
  token,
}: {
  entry: SurveyEntryView;
  token: string;
}) {
  const [foodRating, setFoodRating] = useState(5);
  const [serviceRating, setServiceRating] = useState(5);
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(entry.alreadyResponded);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (npsScore === null) {
      setError("추천 점수를 선택해주세요.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await submitSurvey({
        comment,
        foodRating,
        npsScore,
        serviceRating,
        token,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setSubmitted(true);
    });
  };

  if (submitted) {
    return (
      <Card>
        <CardContent className="pt-6 text-center text-sm">
          소중한 의견 감사합니다. 다음에 또 뵙겠습니다!
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 pt-6">
        <div className="flex flex-col gap-1 text-sm">
          <p className="font-medium">{entry.restaurantName}</p>
          <p className="text-muted-foreground">
            {entry.date} {entry.timeRange} 방문
          </p>
        </div>

        <div className="grid gap-3">
          <Label>음식은 어떠셨나요? ({foodRating}점)</Label>
          <Slider
            max={5}
            min={1}
            onValueChange={([value]) => setFoodRating(value)}
            step={1}
            value={[foodRating]}
          />
        </div>

        <div className="grid gap-3">
          <Label>서비스는 어떠셨나요? ({serviceRating}점)</Label>
          <Slider
            max={5}
            min={1}
            onValueChange={([value]) => setServiceRating(value)}
            step={1}
            value={[serviceRating]}
          />
        </div>

        <div className="grid gap-3">
          <Label>
            테이블GO를 지인에게 추천하시겠어요? (0 = 전혀 아니다, 10 = 매우
            그렇다)
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {NPS_SCORES.map((score) => (
              <button
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-md border text-xs",
                  npsScore === score
                    ? "border-brand-red bg-brand-red text-white"
                    : "hover:border-brand-red"
                )}
                key={score}
                onClick={() => setNpsScore(score)}
                type="button"
              >
                {score}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="comment">남기고 싶은 말씀 (선택)</Label>
          <Textarea
            id="comment"
            onChange={(event) => setComment(event.target.value)}
            value={comment}
          />
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <Button disabled={isPending} onClick={handleSubmit} size="lg">
          {isPending ? "제출 중..." : "제출하기"}
        </Button>
      </CardContent>
    </Card>
  );
}
