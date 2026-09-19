import { beforeEach, describe, expect, it } from "vitest";
import { exportAllData, importAllData, saveSettings, validateExport } from "./indexedDb";

describe("data serialization", () => {
  beforeEach(async () => { await new Promise<void>((resolve) => { const request = indexedDB.deleteDatabase("tracertext"); request.onsuccess = () => resolve(); request.onerror = () => resolve() }) });
  it("round trips settings without information loss", async () => {
    await saveSettings({ burstThresholdMs: 3_000, checkpointInterval: 10, syncSummaries: false });
    const exported = await exportAllData();
    expect(validateExport(JSON.parse(JSON.stringify(exported)))).toBe(true);
    await importAllData(exported);
    expect(await exportAllData()).toMatchObject({ settings: exported.settings, sessions: [], profiles: [] });
  });
});
