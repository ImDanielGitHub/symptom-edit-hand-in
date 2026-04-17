export type SymptomEditEvent = {
  id: string;
  userId: string;
  symptomType: string;
  editedAt: string;
  deviceId: string;
};

function getEditedAtMillis(editedAt: string): number {
  const millis = Date.parse(editedAt);

  if (Number.isNaN(millis)) {
    throw new Error(`Invalid editedAt timestamp "${editedAt}".`);
  }

  return millis;
}

function getLocalDayKey(editedAt: string, dayFormatter: Intl.DateTimeFormat): string {
  const parts = dayFormatter.formatToParts(new Date(getEditedAtMillis(editedAt)));
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error(`Could not derive local day key for editedAt "${editedAt}".`);
  }

  return `${year}-${month}-${day}`;
}

function getGroupKey(event: SymptomEditEvent, localDayKey: string): string {
  return JSON.stringify([event.userId, localDayKey, event.symptomType]);
}

function compareCanonicalPriority(
  candidate: SymptomEditEvent,
  current: SymptomEditEvent,
): number {
  const candidateMillis = getEditedAtMillis(candidate.editedAt);
  const currentMillis = getEditedAtMillis(current.editedAt);

  if (candidateMillis > currentMillis) {
    return 1;
  }

  if (candidateMillis < currentMillis) {
    return -1;
  }

  if (candidate.id > current.id) {
    return 1;
  }

  if (candidate.id < current.id) {
    return -1;
  }

  return 0;
}

export function selectCanonicalEdits(
  events: SymptomEditEvent[],
  dayTimezone: string,
): SymptomEditEvent[] {
  const dayFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: dayTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const winners = new Map<string, SymptomEditEvent>();

  for (const event of events) {
    const localDayKey = getLocalDayKey(event.editedAt, dayFormatter);
    const groupKey = getGroupKey(event, localDayKey);
    const currentWinner = winners.get(groupKey);

    if (!currentWinner || compareCanonicalPriority(event, currentWinner) > 0) {
      winners.set(groupKey, event);
    }
  }

  const canonicalEdits: SymptomEditEvent[] = [];

  for (const event of events) {
    const localDayKey = getLocalDayKey(event.editedAt, dayFormatter);
    const groupKey = getGroupKey(event, localDayKey);

    if (winners.get(groupKey) === event) {
      canonicalEdits.push(event);
    }
  }

  return canonicalEdits;
}

export function mergeStreams(
  a: SymptomEditEvent[],
  b: SymptomEditEvent[],
): SymptomEditEvent[] {
  const merged: SymptomEditEvent[] = [];
  let aIndex = 0;
  let bIndex = 0;

  while (aIndex < a.length && bIndex < b.length) {
    if (getEditedAtMillis(a[aIndex].editedAt) <= getEditedAtMillis(b[bIndex].editedAt)) {
      merged.push(a[aIndex]);
      aIndex += 1;
    } else {
      merged.push(b[bIndex]);
      bIndex += 1;
    }
  }

  while (aIndex < a.length) {
    merged.push(a[aIndex]);
    aIndex += 1;
  }

  while (bIndex < b.length) {
    merged.push(b[bIndex]);
    bIndex += 1;
  }

  return merged;
}
