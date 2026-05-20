const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchStm32CsvFromMidiFile(file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/api/convert-midi-stm32`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "MIDI conversion failed");
  }
  return res.text();
}

export async function fetchStm32CsvFromMidiBlob(blob, filename = "song.mid") {
  const file = new File([blob], filename, { type: "audio/midi" });
  return fetchStm32CsvFromMidiFile(file);
}

export async function sendCsvToStm32(csvText, onStatus) {
  if (!("serial" in navigator)) {
    throw new Error("Web Serial API is not supported. Use Chrome or Edge.");
  }

  const lines = csvText.split("\n").filter((line) => line.trim() !== "");
  if (!lines.length) {
    throw new Error("No notes to send.");
  }

  onStatus?.("Select your STM32 port...");
  const port = await navigator.serial.requestPort();
  await port.open({ baudRate: 115200 });
  onStatus?.("Port opened. Sending data...");

  const encoder = new TextEncoder();
  const writer = port.writable.getWriter();

  await writer.write(encoder.encode("START\n"));
  await delay(100);

  for (const line of lines) {
    await writer.write(encoder.encode(line + "\n"));
    await delay(10);
  }

  await writer.write(encoder.encode("END\n"));
  writer.releaseLock();
  await delay(500);
  await port.close();
}
