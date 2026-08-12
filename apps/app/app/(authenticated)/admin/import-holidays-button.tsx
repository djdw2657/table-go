"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { importHolidays } from "./actions";

function currentYear() {
  return new Date().getFullYear();
}

export function ImportHolidaysButton() {
  const [year, setYear] = useState(String(currentYear()));
  const [isPending, startTransition] = useTransition();
  const years = [
    currentYear() - 1,
    currentYear(),
    currentYear() + 1,
    currentYear() + 2,
  ];

  const handleImport = () => {
    startTransition(async () => {
      const result = await importHolidays(Number(year));
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `${year}년 공휴일 ${result.imported}개 추가, ${result.skipped}개는 이미 등록되어 건너뛰었습니다.`
      );
    });
  };

  return (
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
        disabled={isPending}
        onClick={handleImport}
        size="sm"
        variant="outline"
      >
        {isPending ? "가져오는 중..." : "공휴일 가져오기"}
      </Button>
    </div>
  );
}
