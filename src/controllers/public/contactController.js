import ContactMessage from "../../models/ContactMessage.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function trimStr(v, max) {
  const s = String(v ?? "").trim();
  if (s.length > max) return s.slice(0, max);
  return s;
}

/**
 * Public contact form — no auth. Persists to ContactMessage collection.
 */
export const submitContactMessage = async (req, res) => {
  try {
    const name = trimStr(req.body?.name, 120);
    const email = trimStr(req.body?.email, 254).toLowerCase();
    const subject = trimStr(req.body?.subject, 200);
    const message = trimStr(req.body?.message, 5000);

    if (!name || !email || !subject || !message) {
      return res.status(200).json({
        success: false,
        message: "Name, email, subject, and message are required",
        data: null,
      });
    }

    if (!EMAIL_RE.test(email)) {
      return res.status(200).json({
        success: false,
        message: "Please enter a valid email address",
        data: null,
      });
    }

    const forwarded = req.headers["x-forwarded-for"];
    const sourceIp =
      typeof forwarded === "string"
        ? forwarded.split(",")[0].trim().slice(0, 45)
        : String(req.socket?.remoteAddress || "").slice(0, 45) || undefined;

    const userAgent = String(req.headers["user-agent"] || "").slice(0, 512);

    const doc = await ContactMessage.create({
      name,
      email,
      subject,
      message,
      sourceIp,
      userAgent,
    });

    return res.status(201).json({
      success: true,
      message: "Thank you — we have received your message.",
      data: { id: String(doc._id) },
    });
  } catch (error) {
    console.error("submitContactMessage", error);
    return res.status(500).json({
      success: false,
      message: "Could not send your message. Please try again later.",
      data: null,
    });
  }
};
