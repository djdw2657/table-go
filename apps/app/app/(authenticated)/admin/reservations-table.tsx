"use client";

import type { Reservation, ReservationStatus, TimeSlot } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  getFilteredReservations,
  type ReservationFilters,
  updateReservationStatus,
} from "./actions";

type ReservationWithSlot = Reservation & { timeSlot: TimeSlot };

interface ReservationsTableProps {
  initialReservations: ReservationWithSlot[];
}

// Polled as fast as reasonably possible so staff see new/cancelled
// reservations from the public site without refreshing.
const POLL_INTERVAL_MS = 2000;

const STATUS_LABELS: Record<ReservationStatus, string> = {
  PENDING: "대기중",
  CONFIRMED: "확정",
  CANCELLED: "취소",
};

const STATUS_BADGE_VARIANT: Record<
  ReservationStatus,
  "default" | "secondary" | "destructive"
> = {
  PENDING: "secondary",
  CONFIRMED: "default",
  CANCELLED: "destructive",
};

function toDateStr(date: Date) {
  return date.toISOString().slice(0, 10);
}

export const ReservationsTable = ({
  initialReservations,
}: ReservationsTableProps) => {
  const [reservations, setReservations] = useState(initialReservations);
  const [startDate, setStartDate] = useState(() => toDateStr(new Date()));
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] =
    useState<NonNullable<ReservationFilters["status"]>>("ALL");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [selected, setSelected] = useState<ReservationWithSlot | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const result = await getFilteredReservations({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        status,
        sortOrder,
      });
      if (!cancelled) {
        setReservations(result);
      }
    };

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [startDate, endDate, status, sortOrder]);

  const refresh = async () => {
    const result = await getFilteredReservations({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      status,
      sortOrder,
    });
    setReservations(result);
  };

  const openDetail = (reservation: ReservationWithSlot) => {
    setSelected(reservation);
    setCancelReason("");
  };

  const handleConfirm = (id: string) => {
    startTransition(async () => {
      const result = await updateReservationStatus({
        id,
        status: "CONFIRMED",
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("예약을 확정했습니다.");
      setSelected(null);
      await refresh();
    });
  };

  const handleCancel = (id: string) => {
    startTransition(async () => {
      const result = await updateReservationStatus({
        id,
        status: "CANCELLED",
        cancelReason,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("예약을 취소했습니다.");
      setSelected(null);
      await refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="startDate">시작일</Label>
          <Input
            id="startDate"
            onChange={(event) => setStartDate(event.target.value)}
            type="date"
            value={startDate}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="endDate">종료일</Label>
          <Input
            id="endDate"
            onChange={(event) => setEndDate(event.target.value)}
            type="date"
            value={endDate}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="status">상태</Label>
          <Select
            onValueChange={(value) =>
              setStatus(value as NonNullable<ReservationFilters["status"]>)
            }
            value={status}
          >
            <SelectTrigger className="w-28" id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">전체</SelectItem>
              <SelectItem value="PENDING">대기중</SelectItem>
              <SelectItem value="CONFIRMED">확정</SelectItem>
              <SelectItem value="CANCELLED">취소</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={() =>
            setSortOrder((previous) => (previous === "asc" ? "desc" : "asc"))
          }
          size="sm"
          variant="outline"
        >
          날짜 {sortOrder === "asc" ? "과거순" : "최신순"}
        </Button>
      </div>

      {reservations.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          해당하는 예약이 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>날짜</TableHead>
                <TableHead>시간</TableHead>
                <TableHead>예약자명</TableHead>
                <TableHead>인원</TableHead>
                <TableHead>연락처</TableHead>
                <TableHead>상태</TableHead>
                <TableHead className="text-right">액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.map((reservation) => (
                <TableRow
                  className="cursor-pointer"
                  key={reservation.id}
                  onClick={() => openDetail(reservation)}
                >
                  <TableCell>{toDateStr(reservation.date)}</TableCell>
                  <TableCell>{reservation.timeSlot.displayName}</TableCell>
                  <TableCell>{reservation.customerName}</TableCell>
                  <TableCell>{reservation.partySize}명</TableCell>
                  <TableCell>{reservation.customerPhone}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE_VARIANT[reservation.status]}>
                      {STATUS_LABELS[reservation.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      onClick={(event) => {
                        event.stopPropagation();
                        openDetail(reservation);
                      }}
                      size="sm"
                      variant="outline"
                    >
                      상세
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setSelected(null);
          }
        }}
        open={Boolean(selected)}
      >
        <DialogContent>
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.reservationNumber}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-2 text-sm">
                <p>날짜: {toDateStr(selected.date)}</p>
                <p>시간: {selected.timeSlot.displayName}</p>
                <p>인원: {selected.partySize}명</p>
                <p>예약자: {selected.customerName}</p>
                <p>연락처: {selected.customerPhone}</p>
                {selected.customerEmail && (
                  <p>이메일: {selected.customerEmail}</p>
                )}
                {selected.request && <p>요청사항: {selected.request}</p>}
                <p className="flex items-center gap-2">
                  상태:{" "}
                  <Badge variant={STATUS_BADGE_VARIANT[selected.status]}>
                    {STATUS_LABELS[selected.status]}
                  </Badge>
                </p>
                {selected.status === "CANCELLED" && selected.cancelReason && (
                  <p className="text-muted-foreground">
                    취소 사유: {selected.cancelReason}
                  </p>
                )}
              </div>

              {selected.status === "PENDING" && (
                <Button
                  disabled={isPending}
                  onClick={() => handleConfirm(selected.id)}
                >
                  확인 (확정으로 변경)
                </Button>
              )}

              {selected.status === "CONFIRMED" && (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cancelReason">취소 사유 (선택)</Label>
                  <Textarea
                    id="cancelReason"
                    onChange={(event) => setCancelReason(event.target.value)}
                    value={cancelReason}
                  />
                  <Button
                    disabled={isPending}
                    onClick={() => handleCancel(selected.id)}
                    variant="destructive"
                  >
                    예약 취소
                  </Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
