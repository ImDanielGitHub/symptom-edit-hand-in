import { describe, expect, it } from "vitest";

import {
  mergeStreams,
  selectCanonicalEdits,
  type SymptomEditEvent,
} from "../src/symptomEdits";

function makeEvent(overrides: Partial<SymptomEditEvent>): SymptomEditEvent {
  return {
    id: "event-1",
    userId: "user-1",
    symptomType: "headache",
    editedAt: "2024-01-01T00:00:00Z",
    deviceId: "device-1",
    ...overrides,
  };
}

describe("selectCanonicalEdits", () => {
  it("selects one winner per local calendar day using the provided timezone", () => {
    const events = [
      makeEvent({ id: "dec-early", editedAt: "2024-01-01T04:15:00Z" }),
      makeEvent({ id: "dec-late", editedAt: "2024-01-01T04:45:00Z" }),
      makeEvent({ id: "jan-early", editedAt: "2024-01-01T05:10:00Z" }),
      makeEvent({ id: "jan-late", editedAt: "2024-01-01T06:00:00Z" }),
    ];

    const result = selectCanonicalEdits(events, "America/New_York");

    expect(result.map((event) => event.id)).toEqual(["dec-late", "jan-late"]);
  });

  it("breaks ties on editedAt by lexicographically greater id", () => {
    const editedAt = "2024-02-10T12:00:00Z";
    const events = [
      makeEvent({ id: "id-a", editedAt }),
      makeEvent({ id: "id-b", editedAt }),
    ];

    const result = selectCanonicalEdits(events, "UTC");

    expect(result).toEqual([events[1]]);
  });

  it("treats duplicate ids as separate rows and keeps the first exact duplicate", () => {
    const editedAt = "2024-03-15T08:30:00Z";
    const first = makeEvent({
      id: "duplicate-id",
      editedAt,
      deviceId: "device-a",
    });
    const second = makeEvent({
      id: "duplicate-id",
      editedAt,
      deviceId: "device-b",
    });

    const result = selectCanonicalEdits([first, second], "UTC");

    expect(result).toEqual([first]);
  });

  it("keeps separate buckets for different users and symptom types", () => {
    const editedAt = "2024-04-01T09:00:00Z";
    const events = [
      makeEvent({ id: "user-1-headache", editedAt }),
      makeEvent({
        id: "user-1-nausea",
        editedAt,
        symptomType: "nausea",
      }),
      makeEvent({
        id: "user-2-headache",
        editedAt,
        userId: "user-2",
      }),
    ];

    const result = selectCanonicalEdits(events, "UTC");

    expect(result.map((event) => event.id)).toEqual([
      "user-1-headache",
      "user-1-nausea",
      "user-2-headache",
    ]);
  });
});

describe("mergeStreams", () => {
  it("merges interleaved timestamps and keeps a before b on ties", () => {
    const a = [
      makeEvent({ id: "a1", editedAt: "2024-01-01T10:00:00Z" }),
      makeEvent({ id: "a2", editedAt: "2024-01-01T12:00:00Z" }),
      makeEvent({ id: "a3", editedAt: "2024-01-01T12:00:00Z" }),
    ];
    const b = [
      makeEvent({ id: "b1", editedAt: "2024-01-01T11:00:00Z" }),
      makeEvent({ id: "b2", editedAt: "2024-01-01T12:00:00Z" }),
      makeEvent({ id: "b3", editedAt: "2024-01-01T13:00:00Z" }),
    ];

    const result = mergeStreams(a, b);

    expect(result.map((event) => event.id)).toEqual([
      "a1",
      "b1",
      "a2",
      "a3",
      "b2",
      "b3",
    ]);
    expect(result).toHaveLength(a.length + b.length);
  });

  it("handles an empty stream without changing the other stream", () => {
    const b = [
      makeEvent({ id: "b1", editedAt: "2024-01-01T11:00:00Z" }),
      makeEvent({ id: "b2", editedAt: "2024-01-01T12:00:00Z" }),
    ];

    const result = mergeStreams([], b);

    expect(result).toEqual(b);
  });
});
