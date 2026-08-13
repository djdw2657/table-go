import { Button } from "@repo/design-system/components/ui/button";
import type { Metadata } from "next";
import Link from "next/link";
import { RESTAURANT_INFO } from "../reservations/restaurant-info";

export const metadata: Metadata = {
  title: "테이블GO — 예약",
  description: "정갈한 한 끼, 편안한 예약. 테이블GO에서 자리를 예약하세요.",
};

const Home = () => {
  return (
    <div className="container mx-auto flex min-h-[calc(100dvh-5rem)] max-w-2xl flex-col items-center justify-center gap-10 px-4 py-24 text-center">
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm tracking-widest">
          TABLE GO
        </p>
        <h1 className="font-regular text-5xl tracking-tighter md:text-6xl">
          {RESTAURANT_INFO.name}
        </h1>
        <p className="text-lg text-muted-foreground">
          정갈한 한 끼, 편안한 예약.
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2 border-border border-y py-6 text-sm">
        <p className="text-muted-foreground">
          영업시간 10:00 - 22:00 · 2시간 단위 예약 · 토, 일 휴무
        </p>
        <p className="text-muted-foreground">{RESTAURANT_INFO.address}</p>
        <p className="text-muted-foreground">{RESTAURANT_INFO.phone}</p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <Button asChild size="lg">
          <Link href="/reservations">예약하기</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/check-reservation">예약 확인</Link>
        </Button>
      </div>
    </div>
  );
};

export default Home;
