import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWaitlistEntry } from "./actions";
import { ClaimPanel } from "./claim-panel";

export const metadata: Metadata = {
  title: "대기 확정 | 테이블GO",
};

// Entry status (WAITING/NOTIFIED/CONFIRMED/EXPIRED) changes over time and
// this page must always reflect the current state — never cache it.
export const dynamic = "force-dynamic";

interface WaitlistClaimPageProps {
  params: Promise<{ token: string }>;
}

const WaitlistClaimPage = async ({ params }: WaitlistClaimPageProps) => {
  const { token } = await params;
  const entry = await getWaitlistEntry(token);

  if (!entry) {
    notFound();
  }

  return (
    <div className="container mx-auto max-w-md py-16">
      <h1 className="mb-8 text-center font-regular text-3xl tracking-tighter">
        대기 확정
      </h1>
      <ClaimPanel entry={entry} token={token} />
    </div>
  );
};

export default WaitlistClaimPage;
