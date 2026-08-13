import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface ReservationConfirmationEmailProps {
  readonly customerName: string;
  readonly date: string;
  readonly manageUrl: string;
  readonly partySize: number;
  readonly reservationNumber: string;
  readonly restaurantAddress: string;
  readonly restaurantName: string;
  readonly restaurantPhone: string;
  readonly timeRange: string;
}

const colors = {
  accent: "#c23b2e",
  background: "#f7f2e7",
  border: "#ddd3be",
  ink: "#2b2622",
  muted: "#6b6560",
};

export const ReservationConfirmationEmail = ({
  customerName,
  date,
  manageUrl,
  partySize,
  reservationNumber,
  restaurantAddress,
  restaurantName,
  restaurantPhone,
  timeRange,
}: ReservationConfirmationEmailProps) => (
  <Html>
    <Head />
    <Preview>{`${restaurantName} 예약이 확정되었습니다 — ${date} ${timeRange}`}</Preview>
    <Body
      style={{
        backgroundColor: colors.background,
        color: colors.ink,
        fontFamily: "'Noto Sans KR', Malgun Gothic, sans-serif",
        margin: 0,
        padding: "32px 16px",
      }}
    >
      <Container style={{ maxWidth: "480px" }}>
        <Text
          style={{
            fontSize: "12px",
            letterSpacing: "4px",
            margin: "0 0 8px",
            textAlign: "center",
          }}
        >
          TABLE GO
        </Text>
        <Heading
          style={{
            fontSize: "24px",
            margin: "0 0 24px",
            textAlign: "center",
          }}
        >
          {restaurantName}
        </Heading>

        <Section
          style={{
            backgroundColor: "#fff",
            border: `1px solid ${colors.border}`,
            padding: "24px",
          }}
        >
          <Text style={{ fontSize: "15px", margin: "0 0 16px" }}>
            {customerName}님, 예약이 확정되었습니다.
          </Text>
          <Row label="예약번호" value={reservationNumber} />
          <Row label="날짜" value={date} />
          <Row label="시간" value={timeRange} />
          <Row label="인원" value={`${partySize}명`} />
        </Section>

        <Section style={{ padding: "20px 4px", textAlign: "center" }}>
          <Button
            href={manageUrl}
            style={{
              backgroundColor: colors.ink,
              borderRadius: "0",
              color: "#fff",
              fontSize: "14px",
              padding: "12px 32px",
            }}
          >
            예약 확인 · 변경 · 취소
          </Button>
        </Section>

        <Hr style={{ borderColor: colors.border, margin: "24px 0" }} />

        <Text
          style={{
            color: colors.muted,
            fontSize: "12px",
            lineHeight: "20px",
            textAlign: "center",
          }}
        >
          {restaurantName} · {restaurantAddress} · {restaurantPhone}
          <br />
          예약 변경·취소는 예약 24시간 전까지 가능합니다.
        </Text>
      </Container>
    </Body>
  </Html>
);

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Section style={{ marginBottom: "8px" }}>
      <Text
        style={{
          color: colors.muted,
          display: "inline-block",
          fontSize: "13px",
          margin: 0,
          width: "80px",
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          display: "inline-block",
          fontSize: "13px",
          fontWeight: 600,
          margin: 0,
        }}
      >
        {value}
      </Text>
    </Section>
  );
}

ReservationConfirmationEmail.PreviewProps = {
  customerName: "홍길동",
  date: "2026-08-20",
  manageUrl: "https://example.com/check-reservation",
  partySize: 2,
  reservationNumber: "R-20260820-001",
  restaurantAddress: "서울특별시 강남구 테헤란로 123",
  restaurantName: "테이블GO",
  restaurantPhone: "02-1234-5678",
  timeRange: "16:00 - 18:00",
} satisfies ReservationConfirmationEmailProps;

export default ReservationConfirmationEmail;
