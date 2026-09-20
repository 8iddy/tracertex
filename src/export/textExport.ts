import { Document, Packer, Paragraph } from "docx";

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadText(text: string, extension: "txt" | "md") {
  download(new Blob([text], { type: "text/plain;charset=utf-8" }), `tracertext-result.${extension}`);
}

export async function downloadDocx(text: string) {
  const paragraphs = text.split(/\n{2,}/).map((value) => new Paragraph({ text: value.replace(/\n/g, " ") }));
  const blob = await Packer.toBlob(new Document({ sections: [{ children: paragraphs }] }));
  download(blob, "tracertext-result.docx");
}
