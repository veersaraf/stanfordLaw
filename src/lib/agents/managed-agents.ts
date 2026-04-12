const ANTHROPIC_VERSION = "2023-06-01";
const MANAGED_AGENTS_BETA = "managed-agents-2026-04-01";

interface AnthropicSession {
  id: string;
  title?: string;
}

function hasManagedAgentsConfig() {
  return Boolean(
    process.env.ANTHROPIC_API_KEY &&
      process.env.ANTHROPIC_MANAGED_AGENT_ID &&
      process.env.ANTHROPIC_ENVIRONMENT_ID,
  );
}

async function anthropicRequest<T>(pathname: string, init: RequestInit) {
  const response = await fetch(`https://api.anthropic.com${pathname}`, {
    ...init,
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": ANTHROPIC_VERSION,
      "anthropic-beta": MANAGED_AGENTS_BETA,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic request failed (${response.status}): ${errorText}`);
  }

  return (await response.json()) as T;
}

export async function startManagedCheckSession({
  title,
  prompt,
}: {
  title: string;
  prompt: string;
}) {
  if (!hasManagedAgentsConfig()) {
    return null;
  }

  const session = await anthropicRequest<AnthropicSession>("/v1/sessions", {
    method: "POST",
    body: JSON.stringify({
      agent: process.env.ANTHROPIC_MANAGED_AGENT_ID,
      environment_id: process.env.ANTHROPIC_ENVIRONMENT_ID,
      title,
    }),
  });

  await anthropicRequest<{ success: boolean }>(`/v1/sessions/${session.id}/events`, {
    method: "POST",
    body: JSON.stringify({
      events: [
        {
          type: "user.message",
          content: [{ type: "text", text: prompt }],
        },
      ],
    }),
  });

  return {
    provider: "anthropic-managed-agents" as const,
    sessionId: session.id,
    note: "Anthropic Managed Agents session created and seeded with the intake payload.",
  };
}
