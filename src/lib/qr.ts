import QRCode from "qrcode";

/** Render a value as an inline SVG QR code (string). Server-side only. */
export async function qrSvg(value: string): Promise<string> {
  return QRCode.toString(value, {
    type: "svg",
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0a0a0a", light: "#ffffff" },
  });
}
