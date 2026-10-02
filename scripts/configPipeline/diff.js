const issue = (severity, code, message, expected, actual, sources) => ({
  severity,
  code,
  message,
  expected: expected ?? null,
  actual: actual ?? null,
  sources: sources.filter((source) => source && source.file),
});

export const diffConfig = ({ env, code, toml, whitelist, strict }) => {
  const issues = [];
  const extraSeverity = strict ? "error" : "warning";

  if (!toml.exists) {
    issues.push(
      issue(
        "error",
        "toml.missing",
        "shopify.app.toml does not exist while .env facts are complete",
        "shopify.app.toml generated from .env + server code",
        "file missing",
        [{ file: ".env", line: env.facts.scopes.line }]
      )
    );
    return issues;
  }

  if (toml.parseError) {
    issues.push(
      issue(
        "error",
        "toml.parse_error",
        `shopify.app.toml failed to parse: ${toml.parseError}`,
        "valid TOML",
        toml.parseError,
        [{ file: toml.file, line: null }]
      )
    );
    return issues;
  }

  const envScopes = env.facts.scopes.list;
  const tomlScopes = toml.scopes.list;
  for (const scope of envScopes) {
    if (!tomlScopes.includes(scope)) {
      issues.push(
        issue(
          "error",
          "scope.missing",
          `expected scope "${scope}" from .env is not present in shopify.app.toml`,
          scope,
          tomlScopes.join(","),
          [
            { file: ".env", line: env.facts.scopes.line },
            { file: toml.file, line: toml.scopes.line },
          ]
        )
      );
    }
  }
  for (const scope of tomlScopes) {
    if (!envScopes.includes(scope)) {
      issues.push(
        issue(
          extraSeverity,
          "scope.extra",
          `shopify.app.toml contains scope "${scope}" that is not declared in .env`,
          envScopes.join(","),
          scope,
          [
            { file: toml.file, line: toml.scopes.line },
            { file: ".env", line: env.facts.scopes.line },
          ]
        )
      );
    }
  }

  if (env.facts.appUrl.value !== toml.applicationUrl.value) {
    issues.push(
      issue(
        "error",
        "url.mismatch",
        "application_url in shopify.app.toml does not match SHOPIFY_APP_URL from .env",
        env.facts.appUrl.value,
        toml.applicationUrl.value,
        [
          { file: ".env", line: env.facts.appUrl.line },
          { file: toml.file, line: toml.applicationUrl.line },
        ]
      )
    );
  }

  if (env.facts.apiKey.value !== toml.clientId.value) {
    issues.push(
      issue(
        "error",
        "client_id.mismatch",
        "client_id in shopify.app.toml does not match SHOPIFY_API_KEY from .env",
        env.facts.apiKey.value,
        toml.clientId.value,
        [
          { file: ".env", line: env.facts.apiKey.line },
          { file: toml.file, line: toml.clientId.line },
        ]
      )
    );
  }

  const codeTopics = [
    ...new Set(code.webhooks.registered.flatMap((entry) => entry.topics)),
  ];
  const tomlTopics = [
    ...new Set(toml.subscriptions.flatMap((entry) => entry.topics)),
  ];
  const firstRegistration = code.webhooks.registered[0];
  const firstSubscription = toml.subscriptions[0];

  for (const topic of codeTopics) {
    if (!tomlTopics.includes(topic)) {
      issues.push(
        issue(
          "error",
          "webhook.missing",
          `webhook topic "${topic}" registered in server code is not present in shopify.app.toml`,
          topic,
          tomlTopics.join(","),
          [
            firstRegistration && {
              file: firstRegistration.file,
              line: firstRegistration.line,
            },
            firstSubscription && {
              file: toml.file,
              line: firstSubscription.line,
            },
          ]
        )
      );
    }
  }
  for (const topic of tomlTopics) {
    if (!codeTopics.includes(topic)) {
      issues.push(
        issue(
          extraSeverity,
          "webhook.extra",
          `shopify.app.toml subscribes to webhook topic "${topic}" that is not registered in server code`,
          codeTopics.join(","),
          topic,
          [
            firstSubscription && {
              file: toml.file,
              line: firstSubscription.line,
            },
            firstRegistration && {
              file: firstRegistration.file,
              line: firstRegistration.line,
            },
          ]
        )
      );
    }
  }

  if (whitelist.exists) {
    const unknownSources = [
      ...codeTopics.map((topic) => ({
        topic,
        file: firstRegistration?.file,
        line: firstRegistration?.line,
      })),
      ...tomlTopics.map((topic) => ({
        topic,
        file: toml.file,
        line: firstSubscription?.line || null,
      })),
    ];
    const seen = new Set();
    for (const source of unknownSources) {
      if (seen.has(source.topic) || whitelist.topics.has(source.topic)) {
        continue;
      }
      seen.add(source.topic);
      issues.push(
        issue(
          "error",
          "webhook.unknown_topic",
          `webhook topic "${source.topic}" is not in the ${whitelist.file} whitelist; treated as drift`,
          `one of ${whitelist.topics.size} whitelisted topics`,
          source.topic,
          [
            { file: source.file, line: source.line },
            { file: whitelist.file, line: null },
          ]
        )
      );
    }
  }

  return issues;
};
