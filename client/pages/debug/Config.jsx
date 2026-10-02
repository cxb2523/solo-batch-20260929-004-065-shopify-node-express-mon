import {
  Badge,
  Banner,
  BlockStack,
  Card,
  InlineStack,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";
import { navigate } from "raviger";
import { useEffect, useState } from "react";

const statusTone = (status) => {
  if (status === "ok") return "success";
  if (status === "degraded") return "warning";
  return "critical";
};

const IssueCard = ({ issue }) => (
  <Card>
    <BlockStack gap="200">
      <InlineStack gap="200" blockAlign="center">
        <Badge tone={issue.severity === "error" ? "critical" : "warning"}>
          {issue.severity}
        </Badge>
        <Text as="h3" variant="headingSm">
          {issue.code}
        </Text>
      </InlineStack>
      <Text as="p">{issue.message}</Text>
      {issue.expected !== null && (
        <Text as="p" tone="subdued">
          expected: <code>{issue.expected}</code>
        </Text>
      )}
      {issue.actual !== null && (
        <Text as="p" tone="subdued">
          actual: <code>{issue.actual}</code>
        </Text>
      )}
      {issue.sources.map((source, index) => (
        <Text as="p" tone="subdued" key={index}>
          source:{" "}
          <code>
            {source.file}
            {source.line ? `:${source.line}` : ""}
          </code>
        </Text>
      ))}
    </BlockStack>
  </Card>
);

const ConfigDebug = () => {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/debug/config-report.json")
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        return response.json();
      })
      .then(setReport)
      .catch((fetchError) => setError(fetchError.message));
  }, []);

  return (
    <Page
      title="Config Pipeline Report"
      subtitle="Sanitized verification report shared with the CLI (same JSON source)"
      backAction={{ content: "Debug", onAction: () => navigate("/debug") }}
    >
      <Layout>
        {error && (
          <Layout.Section>
            <Banner tone="warning">
              <p>
                No report available yet ({error}). Run{" "}
                <code>npm run config:verify</code> to generate one.
              </p>
            </Banner>
          </Layout.Section>
        )}
        {report && (
          <>
            <Layout.Section>
              <Banner tone={statusTone(report.status)}>
                <p>
                  status: <strong>{report.status}</strong> | mode: {report.mode}{" "}
                  | strict: {String(report.strict)} | errors:{" "}
                  {report.summary.errors} | warnings: {report.summary.warnings}{" "}
                  | generatedAt: {report.generatedAt}
                </p>
              </Banner>
            </Layout.Section>
            <Layout.Section variant="oneHalf">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Env facts (.env)
                  </Text>
                  {!report.facts.env.exists && (
                    <Text as="p">.env not found (degraded run)</Text>
                  )}
                  {report.facts.env.exists && (
                    <>
                      <Text as="p">
                        SCOPES:{" "}
                        <code>
                          {report.facts.env.scopes
                            .map((scope) => scope.value)
                            .join(", ")}
                        </code>
                      </Text>
                      <Text as="p">
                        APP_URL: <code>{report.facts.env.appUrl.value}</code>
                      </Text>
                      <Text as="p">
                        API_KEY: <code>{report.facts.env.apiKey.value}</code>
                      </Text>
                      <Text as="p">
                        API_SECRET:{" "}
                        <code>{report.facts.env.apiSecret.masked}</code>{" "}
                        (masked)
                      </Text>
                    </>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>
            <Layout.Section variant="oneHalf">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Code facts
                  </Text>
                  <Text as="p">
                    routes registered: {report.facts.routes.length}
                  </Text>
                  {report.facts.webhooks.registered.map((entry, index) => (
                    <Text as="p" key={index}>
                      webhook: <code>{entry.topics.join(", ")}</code> {"->"}{" "}
                      <code>{entry.url}</code> ({entry.file}:{entry.line})
                    </Text>
                  ))}
                  <Text as="p">
                    whitelist: {report.whitelist.count} topics (
                    {report.whitelist.file})
                  </Text>
                </BlockStack>
              </Card>
            </Layout.Section>
            <Layout.Section>
              <BlockStack gap="200">
                <Text as="h2" variant="headingMd">
                  Issues ({report.issues.length})
                </Text>
                {report.issues.length === 0 && (
                  <Card>
                    <Text as="p">No drift detected.</Text>
                  </Card>
                )}
                {report.issues.map((issue, index) => (
                  <IssueCard issue={issue} key={index} />
                ))}
              </BlockStack>
            </Layout.Section>
            <Layout.Section>
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Raw report (evidence/config-report.json)
                  </Text>
                  <pre style={{ overflowX: "auto", fontSize: "12px" }}>
                    {JSON.stringify(report, null, 2)}
                  </pre>
                </BlockStack>
              </Card>
            </Layout.Section>
          </>
        )}
      </Layout>
    </Page>
  );
};

export default ConfigDebug;
