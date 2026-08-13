import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSurveyEntry } from "./actions";
import { SurveyForm } from "./survey-form";

export const metadata: Metadata = {
  title: "만족도 설문 | 테이블GO",
};

interface SurveyPageProps {
  params: Promise<{ token: string }>;
}

const SurveyPage = async ({ params }: SurveyPageProps) => {
  const { token } = await params;
  const entry = await getSurveyEntry(token);

  if (!entry) {
    notFound();
  }

  return (
    <div className="container mx-auto max-w-md py-16">
      <h1 className="mb-8 text-center font-regular text-3xl tracking-tighter">
        방문 만족도 설문
      </h1>
      <SurveyForm entry={entry} token={token} />
    </div>
  );
};

export default SurveyPage;
