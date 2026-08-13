"use client";

import type { TimeSlot } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { joinWaitlist } from "./waitlist-actions";

function toDateStr(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

interface WaitlistDialogSlotProps {
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  onClose: () => void;
  partySize: number;
  request: string;
  selectedDate: Date | undefined;
  timeSlots: TimeSlot[];
  waitlistSlotId: string | null;
}

// Thin wrapper around WaitlistDialog that derives its props from the
// booking form's raw state — kept separate so that derivation doesn't add
// to ReservationForm's own cognitive-complexity budget.
export function WaitlistDialogSlot({
  customerEmail,
  customerName,
  customerPhone,
  onClose,
  partySize,
  request,
  selectedDate,
  timeSlots,
  waitlistSlotId,
}: WaitlistDialogSlotProps) {
  const waitlistTimeSlot = timeSlots.find((slot) => slot.id === waitlistSlotId);

  return (
    <WaitlistDialog
      date={selectedDate ? toDateStr(selectedDate) : ""}
      defaultEmail={customerEmail}
      defaultName={customerName}
      defaultPartySize={partySize}
      defaultPhone={customerPhone}
      onOpenChange={onClose}
      open={Boolean(selectedDate && waitlistSlotId)}
      request={request}
      slotDisplayName={waitlistTimeSlot?.displayName ?? ""}
      slotId={waitlistSlotId ?? ""}
    />
  );
}

interface WaitlistDialogProps {
  date: string;
  defaultEmail: string;
  defaultName: string;
  defaultPartySize: number;
  defaultPhone: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  request: string;
  slotDisplayName: string;
  slotId: string;
}

export function WaitlistDialog({
  date,
  defaultEmail,
  defaultName,
  defaultPartySize,
  defaultPhone,
  onOpenChange,
  open,
  request,
  slotDisplayName,
  slotId,
}: WaitlistDialogProps) {
  const [name, setName] = useState(defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [email, setEmail] = useState(defaultEmail);
  const [partySize, setPartySize] = useState(defaultPartySize);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Re-seed from the main form whenever the dialog is (re)opened, so edits
  // made there after a previous waitlist attempt are picked up.
  useEffect(() => {
    if (open) {
      setName(defaultName);
      setPhone(defaultPhone);
      setEmail(defaultEmail);
      setPartySize(defaultPartySize);
      setError(null);
    }
  }, [open, defaultName, defaultPhone, defaultEmail, defaultPartySize]);

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      const result = await joinWaitlist({
        customerEmail: email,
        customerName: name,
        customerPhone: phone,
        date,
        partySize,
        request: request || undefined,
        slotId,
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      toast.success("대기 등록되었습니다. 자리가 나면 이메일로 알려드립니다.");
      onOpenChange(false);
    });
  };

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>대기 등록</DialogTitle>
          <DialogDescription>
            {date} {slotDisplayName} 시간대는 마감되었습니다. 취소가 생기면
            이메일로 안내해드립니다.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="grid gap-2">
            <Label htmlFor="waitlistName">이름</Label>
            <Input
              id="waitlistName"
              onChange={(event) => setName(event.target.value)}
              value={name}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="waitlistPhone">연락처</Label>
            <Input
              id="waitlistPhone"
              onChange={(event) => setPhone(event.target.value)}
              value={phone}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="waitlistEmail">이메일</Label>
            <Input
              id="waitlistEmail"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              type="email"
              value={email}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="waitlistPartySize">인원</Label>
            <Input
              id="waitlistPartySize"
              max={20}
              min={1}
              onChange={(event) => setPartySize(Number(event.target.value))}
              type="number"
              value={partySize}
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        <DialogFooter>
          <Button disabled={isPending} onClick={handleSubmit}>
            {isPending ? "등록 중..." : "대기 등록"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
