"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { WaitlistEntryView } from "./actions";
import { claimWaitlist } from "./actions";

const STATUS_LABELS: Record<string, string> = {
  CANCELLED: "취소됨",
  CONFIRMED: "확정됨",
  EXPIRED: "만료됨",
  NOTIFIED: "확정 대기",
  WAITING: "대기 중",
};

export function ClaimPanel({
  entry,
  token,
}: {
  entry: WaitlistEntryView;
  token: string;
}) {
  const [status, setStatus] = useState(entry.status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const expired =
    entry.notifyExpiresAt !== null &&
    new Date(entry.notifyExpiresAt).getTime() < Date.now();

  const canClaim = status === "NOTIFIED" && !expired;

  const handleClaim = () => {
    setError(null);
    startTransition(async () => {
      const result = await claimWaitlist(token);
      if (!result.success) {
        setError(result.error);
        setStatus((prev) => (prev === "NOTIFIED" ? "EXPIRED" : prev));
        return;
      }
      toast.success("예약이 확정되었습니다.");
      router.push(`/reservations/${result.reservationId}`);
    });
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">이름</span>
          <span className="font-medium">{entry.customerName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">날짜</span>
          <span className="font-medium">{entry.date}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">시간</span>
          <span className="font-medium">{entry.timeSlot.displayName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">상태</span>
          <span className="font-medium">{STATUS_LABELS[status] ?? status}</span>
        </div>

        {canClaim ? (
          <Button
            className="mt-2"
            disabled={isPending}
            onClick={handleClaim}
            size="lg"
          >
            {isPending ? "확정 중..." : "예약 확정하기"}
          </Button>
        ) : (
          <p className="pt-2 text-muted-foreground text-xs">
            {status === "CONFIRMED"
              ? "이미 예약이 확정되었습니다."
              : "지금은 이 대기를 확정할 수 없습니다. 확정 가능 시간이 지났거나 이미 처리된 대기입니다."}
          </p>
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}
      </CardContent>
    </Card>
  );
}
