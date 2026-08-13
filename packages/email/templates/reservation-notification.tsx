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

interface ReservationNotificationEmailProps {
  readonly adminUrl: string;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly date: string;
  readonly partySize: number;
  readonly request: string | null;
  readonly reservationNumber: string;
  readonly restaurantName: string;
  readonly timeRange: string;
}

const colors = {
  accent: "#c23b2e",
  background: "#f7f2e7",
  border: "#ddd3be",
  ink: "#2b2622",
  muted: "#6b6560",
};

export const ReservationNotificationEmail = ({
  adminUrl,
  customerName,
  customerPhone,
  date,
  partySize,
  request,
  reservationNumber,
  restaurantName,
  timeRange,
}: ReservationNotificationEmailProps) => (
  <Html>
    <Head />
    <Preview>{`새 예약 1건 — ${date} ${timeRange} · ${customerName} ${partySize}명`}</Preview>
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
            color: colors.accent,
            fontSize: "12px",
            letterSpacing: "4px",
            margin: "0 0 8px",
            textAlign: "center",
          }}
        >
          {restaurantName}
        </Text>
        <Heading
          style={{
            fontSize: "22px",
            margin: "0 0 24px",
            textAlign: "center",
          }}
        >
          새 예약 1건
        </Heading>

        <Section
          style={{
            backgroundColor: "#fff",
            border: `1px solid ${colors.border}`,
            padding: "24px",
          }}
        >
          <Row label="예약번호" value={reservationNumber} />
          <Row label="날짜" value={date} />
          <Row label="시간" value={timeRange} />
          <Row label="인원" value={`${partySize}명`} />
          <Row label="예약자" value={customerName} />
          <Row label="연락처" value={customerPhone} />
          {request && <Row label="요청사항" value={request} />}
        </Section>

        <Section style={{ padding: "20px 4px", textAlign: "center" }}>
          <Button
            href={adminUrl}
            style={{
              backgroundColor: colors.accent,
              borderRadius: "0",
              color: "#fff",
              fontSize: "14px",
              padding: "12px 32px",
            }}
          >
            관리자 대시보드에서 보기
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
          테이블GO 예약 시스템이 자동으로 보낸 메일입니다.
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

ReservationNotificationEmail.PreviewProps = {
  adminUrl: "https://example.com",
  customerName: "홍길동",
  customerPhone: "010-1234-5678",
  date: "2026-08-20",
  partySize: 2,
  request: "창가석 부탁드립니다",
  reservationNumber: "R-20260820-001",
  restaurantName: "테이블GO",
  timeRange: "16:00 - 18:00",
} satisfies ReservationNotificationEmailProps;

export default ReservationNotificationEmail;
