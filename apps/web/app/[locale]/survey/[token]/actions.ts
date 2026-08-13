"use server";

import { database } from "@repo/database";

export interface SurveyEntryView {
  alreadyResponded: boolean;
  date: string;
  restaurantName: string;
  timeRange: string;
}

export async function getSurveyEntry(
  token: string
): Promise<SurveyEntryView | null> {
  const feedback = await database.feedback.findUnique({
    where: { token },
    include: { reservation: { include: { timeSlot: true } } },
  });
  if (!feedback) {
    return null;
  }
  return {
    alreadyResponded: feedback.respondedAt !== null,
    date: feedback.reservation.date.toISOString().slice(0, 10),
    restaurantName: "테이블GO",
    timeRange: feedback.reservation.timeSlot.displayName,
  };
}

export interface SubmitSurveyInput {
  comment?: string;
  foodRating: number;
  npsScore: number;
  serviceRating: number;
  token: string;
}

export type SubmitSurveyResult =
  | { success: true }
  | { success: false; error: string };

function inRange(value: number, min: number, max: number) {
  return Number.isInteger(value) && value >= min && value <= max;
}

export async function submitSurvey(
  input: SubmitSurveyInput
): Promise<SubmitSurveyResult> {
  const feedback = await database.feedback.findUnique({
    where: { token: input.token },
  });
  if (!feedback) {
    return { success: false, error: "설문 정보를 찾을 수 없습니다." };
  }
  if (feedback.respondedAt) {
    return { success: false, error: "이미 응답하신 설문입니다." };
  }
  if (!inRange(input.foodRating, 1, 5)) {
    return { success: false, error: "음식 별점을 선택해주세요." };
  }
  if (!inRange(input.serviceRating, 1, 5)) {
    return { success: false, error: "서비스 별점을 선택해주세요." };
  }
  if (!inRange(input.npsScore, 0, 10)) {
    return { success: false, error: "추천 점수를 선택해주세요." };
  }

  await database.feedback.update({
    where: { id: feedback.id },
    data: {
      comment: input.comment?.trim() || undefined,
      foodRating: input.foodRating,
      npsScore: input.npsScore,
      respondedAt: new Date(),
      serviceRating: input.serviceRating,
    },
  });

  return { success: true };
}
