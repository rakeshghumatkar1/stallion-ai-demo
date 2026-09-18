/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The widget is embedded via an iframe on third-party award sites, so we must
  // NOT send X-Frame-Options: DENY. There is no per-request edition — only the
  // pinned event: the deployment serves one event (ACTIVE_EVENT_ID), so the
  // frame-ancestors policy is the only per-site knob. Tighten it in production.
  async headers() {
    return [
      {
        source: "/widget",
        headers: [
          // Allow embedding. Tighten to specific ancestors in production if desired.
          { key: "Content-Security-Policy", value: "frame-ancestors *;" },
        ],
      },
      {
        source: "/embed.js",
        headers: [{ key: "Cache-Control", value: "public, max-age=300" }],
      },
    ];
  },
};

export default nextConfig;
