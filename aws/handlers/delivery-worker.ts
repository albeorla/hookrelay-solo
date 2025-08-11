type SQSEvent = { Records: { body: string }[] };

export async function handler(event: SQSEvent) {
  for (const r of event.Records) {
    try {
      const msg = JSON.parse(r.body);
      const url: string = msg.dest_url;
      const payload = msg.payload ?? {};
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      throw err;
    }
  }
}

