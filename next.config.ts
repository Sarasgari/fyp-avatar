import type { NextConfig } from "next";

const contentSecurityPolicy = [
	"default-src 'self'",
	"base-uri 'self'",
	"frame-ancestors 'none'",
	"form-action 'self'",
	"object-src 'none'",
	// The assistant runtime and avatar bundle still rely on eval-backed code paths
	// in production, so keep the CSP strict elsewhere and allow this one escape hatch.
	"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
	"style-src 'self' 'unsafe-inline'",
	"img-src 'self' data: blob:",
	"font-src 'self' data:",
	"connect-src 'self' blob:",
	"media-src 'self' blob:",
	"worker-src 'self' blob:",
].join("; ");

const securityHeaders = [
	{
		key: "Content-Security-Policy",
		value: contentSecurityPolicy,
	},
	{
		key: "Referrer-Policy",
		value: "strict-origin-when-cross-origin",
	},
	{
		key: "X-Content-Type-Options",
		value: "nosniff",
	},
	{
		key: "X-Frame-Options",
		value: "DENY",
	},
	{
		key: "Permissions-Policy",
		value: "camera=(), geolocation=(), microphone=()",
	},
	{
		key: "Cross-Origin-Opener-Policy",
		value: "same-origin",
	},
	{
		key: "Cross-Origin-Resource-Policy",
		value: "same-origin",
	},
	{
		key: "X-DNS-Prefetch-Control",
		value: "off",
	},
];

const nextConfig: NextConfig = {
	poweredByHeader: false,
	reactStrictMode: true,
	async headers() {
		return [
			{
				source: "/:path*",
				headers: securityHeaders,
			},
		];
	},
};

export default nextConfig;
