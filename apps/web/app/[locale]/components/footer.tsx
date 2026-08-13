import { Status } from "@repo/observability/status";
import Link from "next/link";

const links = [
  { title: "예약하기", href: "/reservations" },
  { title: "예약 확인", href: "/check-reservation" },
];

export const Footer = () => {
  return (
    <section className="dark border-foreground/10 border-t">
      <div className="w-full bg-background py-20 text-foreground lg:py-40">
        <div className="container mx-auto">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="flex flex-col items-start gap-8">
              <div className="flex flex-col gap-2">
                <h2 className="max-w-xl text-left font-regular text-3xl tracking-tighter md:text-5xl">
                  테이블GO
                </h2>
                <p className="max-w-lg text-left text-foreground/75 text-lg leading-relaxed tracking-tight">
                  간편하게 예약하고, 편하게 이용하세요.
                </p>
              </div>
              <Status />
            </div>
            <div className="flex flex-col items-start gap-2 lg:items-end">
              {links.map((link) => (
                <Link
                  className="text-xl hover:text-foreground/75"
                  href={link.href}
                  key={link.href}
                >
                  {link.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
