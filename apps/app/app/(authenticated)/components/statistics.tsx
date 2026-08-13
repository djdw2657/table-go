"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@repo/design-system/components/ui/table";
import { cn } from "@repo/design-system/lib/utils";
import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import {
  type CancellationStats,
  getCancellationStats,
  getPopularTimeSlots,
  getRegularCustomers,
  getReservationTrend,
  type PopularSlot,
  type RegularCustomer,
  type TrendPoint,
} from "../statistics-actions";

function TrendChart() {
  const [period, setPeriod] = useState<"month" | "week">("week");
  const [data, setData] = useState<TrendPoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    getReservationTrend(period).then((result) => {
      if (!cancelled) {
        setData(result);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">예약 추이</CardTitle>
        <div className="flex gap-1">
          {(["week", "month"] as const).map((option) => (
            <button
              className={cn(
                "rounded-md px-2 py-1 text-xs",
                period === option
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
              key={option}
              onClick={() => setPeriod(option)}
              type="button"
            >
              {option === "week" ? "주간" : "월간"}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[220px] w-full text-xs">
          <ResponsiveContainer height="100%" width="100%">
            <BarChart data={data}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis
                axisLine={false}
                dataKey="label"
                stroke="var(--muted-foreground)"
                tickLine={false}
                tickMargin={8}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  color: "var(--popover-foreground)",
                }}
              />
              <Bar
                dataKey="count"
                fill="var(--primary)"
                name="예약 건수 (건)"
                radius={4}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function PopularSlots() {
  const [slots, setSlots] = useState<PopularSlot[]>([]);

  useEffect(() => {
    getPopularTimeSlots().then(setSlots);
  }, []);

  const max = Math.max(1, ...slots.map((slot) => slot.count));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">인기 타임슬롯</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {slots.length === 0 && (
          <p className="text-muted-foreground text-sm">데이터가 없습니다.</p>
        )}
        {slots.map((slot) => (
          <div className="flex items-center gap-3" key={slot.displayName}>
            <span className="w-24 shrink-0 text-sm">{slot.displayName}</span>
            <div className="h-2 flex-1 rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary"
                style={{ width: `${(slot.count / max) * 100}%` }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-muted-foreground text-sm">
              {slot.count}건
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CancellationRate() {
  const [stats, setStats] = useState<CancellationStats | null>(null);

  useEffect(() => {
    getCancellationStats().then(setStats);
  }, []);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-xl border p-6">
        <p className="text-muted-foreground text-sm">전체 취소율</p>
        <p className="mt-2 font-semibold text-3xl">
          {stats ? `${stats.totalRate}%` : "-"}
        </p>
        {stats && (
          <p className="mt-1 text-muted-foreground text-xs">
            {stats.totalCancelled} / {stats.totalReservations}건
          </p>
        )}
      </div>
      <div className="rounded-xl border p-6">
        <p className="text-muted-foreground text-sm">이번 달 취소율</p>
        <p className="mt-2 font-semibold text-3xl">
          {stats ? `${stats.thisMonthRate}%` : "-"}
        </p>
      </div>
    </div>
  );
}

function RegularCustomers() {
  const [customers, setCustomers] = useState<RegularCustomer[]>([]);

  useEffect(() => {
    getRegularCustomers().then(setCustomers);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">단골 고객</CardTitle>
      </CardHeader>
      <CardContent>
        {customers.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            2회 이상 방문한 고객이 없습니다.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>연락처</TableHead>
                <TableHead className="text-right">방문 횟수</TableHead>
                <TableHead className="text-right">마지막 방문</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.customerPhone}>
                  <TableCell>{customer.customerName}</TableCell>
                  <TableCell>{customer.customerPhone}</TableCell>
                  <TableCell className="text-right">
                    {customer.visitCount}회
                  </TableCell>
                  <TableCell className="text-right">
                    {customer.lastVisit}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function Statistics() {
  return (
    <div className="flex flex-col gap-4">
      <CancellationRate />
      <div className="grid gap-4 lg:grid-cols-2">
        <TrendChart />
        <PopularSlots />
      </div>
      <RegularCustomers />
    </div>
  );
}
