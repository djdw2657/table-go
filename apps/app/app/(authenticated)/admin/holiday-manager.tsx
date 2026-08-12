"use client";

import type { Holiday } from "@repo/database";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { cn } from "@repo/design-system/lib/utils";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteHolidays, getHolidays, importHolidays } from "./actions";

function currentYear() {
  return new Date().getFullYear();
}

function todayDateOnly() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

interface HolidayManagerProps {
  initialHolidays: Holiday[];
}

export function HolidayManager({ initialHolidays }: HolidayManagerProps) {
  const [open, setOpen] = useState(false);
  const [holidays, setHolidays] = useState(initialHolidays);
  const [year, setYear] = useState(String(currentYear()));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isImporting, startImportTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const years = [
    currentYear() - 1,
    currentYear(),
    currentYear() + 1,
    currentYear() + 2,
  ];
  const today = todayDateOnly();

  const refresh = async () => {
    setHolidays(await getHolidays());
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      refresh();
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleImport = () => {
    startImportTransition(async () => {
      const result = await importHolidays(Number(year));
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${year}년 공휴일 ${result.imported}개 추가, ${result.skipped}개는 이미 등록되어 건너뛰었습니다.`
      );
      await refresh();
    });
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDeleteSelected = () => {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      return;
    }
    startDeleteTransition(async () => {
      await deleteHolidays(ids);
      toast.success(`휴무일 ${ids.length}개를 삭제했습니다.`);
      setSelectedIds(new Set());
      await refresh();
    });
  };

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          휴무일 관리
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>휴무일 관리</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Select onValueChange={setYear} value={year}>
              <SelectTrigger className="w-24" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}년
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              disabled={isImporting}
              onClick={handleImport}
              size="sm"
              variant="outline"
            >
              {isImporting ? "가져오는 중..." : "공휴일 가져오기"}
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <p className="font-medium text-sm">
              등록된 휴무일 ({holidays.length}개)
            </p>
            <Button
              disabled={selectedIds.size === 0 || isDeleting}
              onClick={handleDeleteSelected}
              size="sm"
              variant="destructive"
            >
              {isDeleting ? "삭제 중..." : `선택 삭제 (${selectedIds.size})`}
            </Button>
          </div>

          {holidays.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              등록된 휴무일이 없습니다.
            </p>
          ) : (
            <div className="flex flex-col gap-1">
              {holidays.map((holiday) => {
                const dateStr = holiday.date.toISOString().slice(0, 10);
                const isPast = holiday.date.getTime() < today.getTime();
                return (
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-md border p-2 text-sm",
                      isPast && "text-muted-foreground"
                    )}
                    key={holiday.id}
                  >
                    <Checkbox
                      checked={selectedIds.has(holiday.id)}
                      id={`holiday-${holiday.id}`}
                      onCheckedChange={() => toggleSelected(holiday.id)}
                    />
                    <label
                      className="flex flex-1 items-center gap-3"
                      htmlFor={`holiday-${holiday.id}`}
                    >
                      <span className={cn(isPast && "line-through")}>
                        {dateStr}
                      </span>
                      {holiday.reason && (
                        <span className="text-muted-foreground">
                          {holiday.reason}
                        </span>
                      )}
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
