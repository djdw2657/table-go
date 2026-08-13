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

interface WaitlistNotificationEmailProps {
  readonly claimUrl: string;
  readonly customerName: string;
  readonly date: string;
  readonly expiresInHours: number;
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

export const WaitlistNotificationEmail = ({
  claimUrl,
  customerName,
  date,
  expiresInHours,
  restaurantName,
  timeRange,
}: WaitlistNotificationEmailProps) => (
  <Html>
    <Head />
    <Preview>{`대기하신 자리가 났습니다 — ${date} ${timeRange}`}</Preview>
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
        <Logo />
        <Heading
          style={{
            fontSize: "22px",
            margin: "0 0 24px",
            textAlign: "center",
          }}
        >
          대기하신 자리가 났습니다!
        </Heading>

        <Section
          style={{
            backgroundColor: "#fff",
            border: `1px solid ${colors.border}`,
            padding: "24px",
          }}
        >
          <Text style={{ fontSize: "15px", margin: "0 0 16px" }}>
            {customerName}님, 대기 등록하신 시간대에 자리가 났습니다.
          </Text>
          <Row label="날짜" value={date} />
          <Row label="시간" value={timeRange} />
        </Section>

        <Section style={{ padding: "20px 4px", textAlign: "center" }}>
          <Button
            href={claimUrl}
            style={{
              backgroundColor: colors.accent,
              borderRadius: "0",
              color: "#fff",
              fontSize: "14px",
              padding: "12px 32px",
            }}
          >
            지금 예약 확정하기
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
          {restaurantName}
          <br />
          {expiresInHours}시간 이내에 확정하지 않으시면 다음 대기자에게 자리가
          넘어갑니다.
        </Text>
      </Container>
    </Body>
  </Html>
);

function Logo() {
  return (
    <table style={{ margin: "0 auto 20px" }}>
      <tr>
        <td style={{ padding: "0 8px 0 0", verticalAlign: "middle" }}>
          <table
            style={{
              backgroundColor: colors.accent,
              borderCollapse: "collapse",
              width: "32px",
            }}
          >
            <tr>
              <td
                height={32}
                style={{
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 700,
                  textAlign: "center",
                }}
                width={32}
              >
                GO
              </td>
            </tr>
          </table>
        </td>
        <td style={{ verticalAlign: "middle" }}>
          <Text
            style={{
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "2px",
              margin: 0,
            }}
          >
            TABLE GO
          </Text>
        </td>
      </tr>
    </table>
  );
}

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

WaitlistNotificationEmail.PreviewProps = {
  claimUrl: "https://example.com/waitlist/abc123",
  customerName: "홍길동",
  date: "2026-08-20",
  expiresInHours: 24,
  restaurantName: "테이블GO",
  timeRange: "16:00 - 18:00",
} satisfies WaitlistNotificationEmailProps;

export default WaitlistNotificationEmail;
