import { Button } from "@repo/design-system/components/ui/button";
import { cn } from "@repo/design-system/lib/utils";
import type { Metadata } from "next";
import { Cormorant_Garamond, Noto_Serif_KR } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { RESTAURANT_INFO } from "../reservations/restaurant-info";

const serifEn = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-serif-en",
  weight: ["400", "500"],
});

const serifKr = Noto_Serif_KR({
  subsets: ["latin"],
  variable: "--font-serif-kr",
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  title: "테이블GO — 예약",
  description: "셰프의 계절 코스 요리, 예약제로만 운영되는 테이블GO.",
};

const SIGNATURE_DISHES = [
  {
    alt: "제철 사시미",
    src: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&fit=crop&w=800&q=80",
  },
  {
    alt: "니기리",
    src: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=800&q=80",
  },
  {
    alt: "코스 플레이팅",
    src: "https://images.unsplash.com/photo-1611143669185-af224c5e3252?auto=format&fit=crop&w=800&q=80",
  },
];

const Home = () => {
  return (
    <div className={cn(serifEn.variable, serifKr.variable)}>
      <section className="relative flex h-[85dvh] min-h-[560px] items-center justify-center overflow-hidden">
        <Image
          alt=""
          className="object-cover object-bottom"
          fill
          priority
          src="https://images.unsplash.com/photo-1783192485621-b62485f37c19?auto=format&fit=crop&w=1920&q=80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40" />
        <div className="relative flex flex-col items-center gap-6 px-4 text-center text-white">
          <p className="font-[family-name:var(--font-serif-en)] text-sm tracking-[0.4em]">
            TABLE GO
          </p>
          <h1 className="font-[family-name:var(--font-serif-kr)] text-5xl tracking-tight md:text-6xl">
            {RESTAURANT_INFO.name}
          </h1>
          <p className="text-sm text-white/80 tracking-widest">
            예약제 코스 요리 전문
          </p>
          <Button
            asChild
            className="mt-4 rounded-none border-white/40 bg-transparent text-white hover:bg-white hover:text-black"
            size="lg"
            variant="outline"
          >
            <Link href="/reservations">예약하기</Link>
          </Button>
        </div>
      </section>

      <section className="container mx-auto max-w-2xl px-4 py-24 text-center">
        <p className="font-[family-name:var(--font-serif-kr)] text-2xl leading-relaxed md:text-3xl">
          제철 재료로 완성하는
          <br />
          셰프의 계절 코스
        </p>
        <p className="mt-6 text-muted-foreground text-sm leading-relaxed">
          테이블GO는 정해진 코스 요리만을 제공하는 예약제 다이닝입니다.
          <br />
          하루 한정된 좌석에서 정성스러운 한 끼를 경험해보세요.
        </p>
      </section>

      <section className="border-border border-y bg-muted/30 py-20">
        <div className="container mx-auto px-4">
          <p className="mb-10 text-center text-muted-foreground text-xs tracking-[0.3em]">
            SIGNATURE
          </p>
          <div className="grid gap-1 sm:grid-cols-3">
            {SIGNATURE_DISHES.map((dish) => (
              <figure className="flex flex-col gap-3" key={dish.src}>
                <div className="relative aspect-[3/4] overflow-hidden">
                  <Image
                    alt={dish.alt}
                    className="object-cover"
                    fill
                    sizes="(min-width: 640px) 33vw, 100vw"
                    src={dish.src}
                  />
                </div>
                <figcaption className="text-center text-muted-foreground text-xs tracking-widest">
                  {dish.alt}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="relative h-[60dvh] min-h-[420px] overflow-hidden">
        <Image
          alt=""
          className="object-cover object-top"
          fill
          sizes="100vw"
          src="https://images.unsplash.com/photo-1780805664802-dd796d5950c6?auto=format&fit=crop&w=1920&q=80"
        />
      </section>

      <section className="container mx-auto flex max-w-md flex-col items-center gap-8 px-4 py-24 text-center">
        <div className="flex flex-col gap-1 text-muted-foreground text-sm">
          <p>영업시간 10:00 - 22:00 · 2시간 단위 예약 · 토, 일 휴무</p>
          <p>{RESTAURANT_INFO.address}</p>
          <p>{RESTAURANT_INFO.phone}</p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <Button asChild size="lg">
            <Link href="/reservations">예약하기</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/check-reservation">예약 확인</Link>
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Home;
