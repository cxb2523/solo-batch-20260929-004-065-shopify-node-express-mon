import {
  Badge,
  Banner,
  BlockStack,
  Card,
  DataTable,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";
import { useNavigate } from "raviger";
import { useEffect, useState } from "react";

const statusTone = {
  ok: "success",
  drift: "warning",
  fail: "critical",
};

const ConfigReport = () => {
  const navigate = useNavigate();
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/config-report.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(setReport)
      .catch((e) => setError(e.message));
  }, []);

  const driftRows = (report?.drift ?? []).map((item) => [
    item.kind,
    item.expected,
    item.actual,
    (item.sources ?? [])
      .map((src) => (src.line ? `${src.file}:${src.line}` : src.file))
      .join("\n"),
  ]);

  return (
    <Page
      title="Config Pipeline Report"
      subtitle="Sanitized verification report shared with the CLI (config-report.json)"
      backAction={{ onAction: () => navigate("/debug") }}
    >
      <Layout>
        <Layout.Section>
          {error && (
            <Banner tone="critical">
              <Text>
                Could not load /config-report.json ({error}). Run `npm run
                config:verify` (or `npm run dev` / `npm run build`, which run
                the pipeline automatically) to generate it.
              </Text>
            </Banner>
          )}
          {report && (
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Status{" "}
                    <Badge tone={statusTone[report.status] ?? "info"}>
                      {report.status.toUpperCase()}
                    </Badge>
                  </Text>
                  <Text>
                    Generated {report.generatedAt} · mode {report.mode}
                    {report.strict ? " (strict)" : ""} · drift{" "}
                    {report.summary.driftCount} · warnings{" "}
                    {report.summary.warningCount}
                  </Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Env facts (secrets masked)
                  </Text>
                  <DataTable
                    columnContentTypes={["text", "text", "text"]}
                    headings={["Field", "Value", "Source"]}
                    rows={Object.entries(report.env.fields).map(
                      ([field, info]) => [
                        field,
                        info.present ? info.value : "MISSING",
                        info.present
                          ? `${info.source.file}:${info.source.line}`
                          : info.keys.join(" / "),
                      ]
                    )}
                  />
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Drift ({report.drift.length})
                  </Text>
                  {driftRows.length === 0 ? (
                    <Text>No drift detected.</Text>
                  ) : (
                    <DataTable
                      columnContentTypes={["text", "text", "text", "text"]}
                      headings={["Kind", "Expected", "Actual", "Source"]}
                      rows={driftRows}
                    />
                  )}
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Human-readable report
                  </Text>
                  <pre style={{ overflowX: "auto", fontSize: 12, margin: 0 }}>
                    {report.human.join("\n")}
                  </pre>
                </BlockStack>
              </Card>
            </BlockStack>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
};

export default ConfigReport;
