import type { Context } from 'hono';

export const handleRobotsTxt = async (c: Context) => {
    return c.text(`# AI Data scrapers

User-agent: anthropic-ai
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Diffbot
Disallow: /

User-agent: FacebookBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: GPTBot
Disallow: /

User-agent: Meta-ExternalAgent
Disallow: /

User-agent: omgili
Disallow: /

User-agent: Timpibot
Disallow: /

User-agent: Webzio-Extended
Disallow: /

User-agent: *
Disallow:`);
};
