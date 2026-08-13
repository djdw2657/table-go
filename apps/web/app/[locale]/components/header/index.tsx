import { ModeToggle } from "@repo/design-system/components/mode-toggle";
import { Button } from "@repo/design-system/components/ui/button";
import Link from "next/link";

export const Header = () => {
  return (
    <header className="sticky top-0 left-0 z-40 w-full border-b bg-background">
      <div className="container mx-auto flex min-h-20 items-center justify-between gap-4">
        <Link href="/">
          <p className="whitespace-nowrap font-semibold text-lg tracking-tight">
            테이블GO
          </p>
        </Link>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/check-reservation">예약 확인</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/reservations">예약하기</Link>
          </Button>
          <ModeToggle />
        </div>
      </div>
    </header>
  );
};
