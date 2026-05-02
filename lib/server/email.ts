import { Resend } from "resend";

const getResendClient = () => {
	const apiKey = process.env.RESEND_API_KEY?.trim();
	return apiKey ? new Resend(apiKey) : null;
};

const getEmailFromAddress = () =>
	process.env.EMAIL_FROM?.trim() || "Mango <onboarding@resend.dev>";

export const isEmailConfigured = () =>
	Boolean(process.env.RESEND_API_KEY?.trim());

export const sendPasswordResetEmail = async ({
	code,
	email,
}: {
	code: string;
	email: string;
}) => {
	const resend = getResendClient();
	if (!resend) {
		return false;
	}

	await resend.emails.send({
		from: getEmailFromAddress(),
		to: email,
		subject: "Reset your Mango password",
		html: `
			<div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
				<h1 style="font-size: 20px;">Reset your password</h1>
				<p>Your Mango reset code is:</p>
				<p style="font-size: 28px; font-weight: 700; letter-spacing: 0.12em;">${code}</p>
				<p>This code expires in about 15 minutes.</p>
				<p>If you did not request this, you can ignore this email.</p>
			</div>
		`.trim(),
		text: `Your Mango reset code is ${code}. It expires in about 15 minutes.`,
	});

	return true;
};
