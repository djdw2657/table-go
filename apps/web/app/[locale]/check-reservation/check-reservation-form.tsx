"use client";

import type { TimeSlot } from "@repo/database";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@repo/design-system/components/ui/alert-dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { Calendar } from "@repo/design-system/components/ui/calendar";
import { Card, CardContent } from "@repo/design-system/components/ui/card";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { type FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";
import { getAvailability } from "../reservations/actions";
import { FullDayButton } from "../reservations/full-day-button";
import { isWithinEditWindow } from "../reservations/reservation-time";
import { RESTAURANT_INFO } from "../reservations/restaurant-info";
import { TimeSlotGrid } from "../reservations/time-slot-button";
import { formatPhoneNumber } from "../reservations/validation";
import {
  cancelReservationByCustomer,
  type LookupData,
  lookupReservation,
  updateReservationByCustomer,
} from "./actions";

interface CheckReservationFormProps {
  timeSlots: TimeSlot[];
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "대기 중",
  CONFIRMED: "확정됨",
  CANCELLED: "취소됨",
};

function isWeekend(date: Date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function toDateStr(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function CheckReservationForm({ timeSlots }: CheckReservationFormProps) {
  const [mode, setMode] = useState<"lookup" | "result" | "edit">("lookup");
  const [reservationNumber, setReservationNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [reservation, setReservation] = useState<LookupData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [editDate, setEditDate] = useState<Date | undefined>();
  const [editSlot, setEditSlot] = useState<string | null>(null);
  const [editPartySize, setEditPartySize] = useState(2);
  const [editRequest, setEditRequest] = useState("");
  const [editBookedSlotIds, setEditBookedSlotIds] = useState<string[]>([]);

  const handleLookup = (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await lookupReservation({ reservationNumber, phone });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setReservation(result.reservation);
      setMode("result");
    });
  };

  const canModify =
    reservation &&
    reservation.status !== "CANCELLED" &&
    isWithinEditWindow(
      new Date(`${reservation.date}T00:00:00.000Z`),
      reservation.timeSlot.startTime
    );

  const handleCancel = () => {
    if (!reservation) {
      return;
    }
    startTransition(async () => {
      const result = await cancelReservationByCustomer({
        id: reservation.id,
        phone,
        reservationNumber,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("예약이 취소되었습니다.");
      setReservation({ ...reservation, status: "CANCELLED" });
    });
  };

  const startEdit = () => {
    if (!reservation) {
      return;
    }
    const date = new Date(`${reservation.date}T00:00:00.000Z`);
    setEditDate(
      new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );
    setEditSlot(reservation.timeSlot.id);
    setEditPartySize(reservation.partySize);
    setEditRequest(reservation.request ?? "");
    setMode("edit");
  };

  const handleSelectEditDate = (date: Date | undefined) => {
    setEditDate(date);
    setEditSlot(null);
    if (!(date && reservation)) {
      return;
    }
    startTransition(async () => {
      const result = await getAvailability(toDateStr(date), reservation.id);
      setEditBookedSlotIds(result.bookedSlotIds);
    });
  };

  const handleSaveEdit = () => {
    if (!(reservation && editDate && editSlot)) {
      toast.error("날짜와 시간을 선택해주세요.");
      return;
    }
    startTransition(async () => {
      const result = await updateReservationByCustomer({
        date: toDateStr(editDate),
        id: reservation.id,
        partySize: editPartySize,
        phone,
        request: editRequest,
        reservationNumber,
        slotId: editSlot,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("예약이 변경되었습니다.");
      const slot = timeSlots.find((s) => s.id === editSlot);
      setReservation({
        ...reservation,
        date: toDateStr(editDate),
        partySize: editPartySize,
        request: editRequest || null,
        timeSlot: slot
          ? {
              displayName: slot.displayName,
              id: slot.id,
              startTime: slot.startTime,
            }
          : reservation.timeSlot,
      });
      setMode("result");
    });
  };

  if (mode === "lookup") {
    return (
      <form className="flex flex-col gap-4" onSubmit={handleLookup}>
        <div className="grid gap-2">
          <Label htmlFor="reservationNumber">예약번호</Label>
          <Input
            id="reservationNumber"
            onChange={(event) => setReservationNumber(event.target.value)}
            placeholder="R-20260817-001"
            required
            value={reservationNumber}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="phone">연락처</Label>
          <Input
            id="phone"
            onChange={(event) =>
              setPhone(formatPhoneNumber(event.target.value))
            }
            placeholder="010-1234-5678"
            required
            value={phone}
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
        <Button disabled={isPending} size="lg" type="submit">
          {isPending ? "조회 중..." : "예약 조회"}
        </Button>
      </form>
    );
  }

  if (mode === "result" && reservation) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">예약번호</span>
            <span className="font-medium">{reservation.reservationNumber}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">날짜</span>
            <span className="font-medium">{reservation.date}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">시간</span>
            <span className="font-medium">
              {reservation.timeSlot.displayName}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">인원</span>
            <span className="font-medium">{reservation.partySize}명</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">상태</span>
            <span className="font-medium">
              {STATUS_LABELS[reservation.status] ?? reservation.status}
            </span>
          </div>
          {reservation.request && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">요청사항</span>
              <span className="font-medium">{reservation.request}</span>
            </div>
          )}

          <div className="flex flex-col gap-1 border-t pt-3">
            <p className="font-medium">{RESTAURANT_INFO.name}</p>
            <p className="text-muted-foreground">{RESTAURANT_INFO.address}</p>
            <p className="text-muted-foreground">{RESTAURANT_INFO.phone}</p>
          </div>

          {canModify ? (
            <div className="flex gap-2 pt-2">
              <Button
                className="flex-1"
                onClick={startEdit}
                type="button"
                variant="outline"
              >
                예약 수정
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    className="flex-1"
                    type="button"
                    variant="destructive"
                  >
                    예약 취소
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      예약을 취소하시겠습니까?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {reservation.date} {reservation.timeSlot.displayName}{" "}
                      예약이 취소됩니다. 이 작업은 되돌릴 수 없습니다.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>닫기</AlertDialogCancel>
                    <AlertDialogAction
                      disabled={isPending}
                      onClick={handleCancel}
                    >
                      취소 확정
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : (
            reservation.status !== "CANCELLED" && (
              <p className="pt-2 text-muted-foreground text-xs">
                예약 24시간 전까지만 취소/변경할 수 있습니다.
              </p>
            )
          )}
        </CardContent>
      </Card>
    );
  }

  if (mode === "edit" && reservation) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <Calendar
            className="[--cell-size:2.75rem]"
            classNames={{
              today: "rounded-none ring-1 ring-inset ring-brand-red",
            }}
            components={{ DayButton: FullDayButton }}
            disabled={(date) => isWeekend(date) || date < startOfToday()}
            mode="single"
            onSelect={handleSelectEditDate}
            selected={editDate}
          />
          <TimeSlotGrid
            bookedSlotIds={editBookedSlotIds}
            onSelect={setEditSlot}
            selectedSlot={editSlot}
            timeSlots={timeSlots}
          />
          <div className="grid gap-2">
            <Label htmlFor="editPartySize">인원</Label>
            <Input
              id="editPartySize"
              max={20}
              min={1}
              onChange={(event) => setEditPartySize(Number(event.target.value))}
              type="number"
              value={editPartySize}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="editRequest">요청사항</Label>
            <Input
              id="editRequest"
              onChange={(event) => setEditRequest(event.target.value)}
              value={editRequest}
            />
          </div>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() => setMode("result")}
              type="button"
              variant="outline"
            >
              취소
            </Button>
            <Button
              className="flex-1"
              disabled={isPending}
              onClick={handleSaveEdit}
              type="button"
            >
              {isPending ? "저장 중..." : "저장"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
