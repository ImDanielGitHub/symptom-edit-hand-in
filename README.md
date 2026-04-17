# Symptom Edit Stream Exercise

This solution implements two functions over `SymptomEditEvent` records:

- `selectCanonicalEdits(events, dayTimezone)` chooses one canonical edit per `(userId, local calendar day, symptomType)`.
- `mergeStreams(a, b)` merges two already-sorted edit streams without concatenating and sorting the full list.

## How to run

1. Install dependencies:

   ```bash
   npm install
   ```

2. Run the test suite:

   ```bash
   npm test
   ```

3. Optional type-check:

   ```bash
   npm run check
   ```

## Approach

### `selectCanonicalEdits`

- Each event is grouped by:
  - `userId`
  - local calendar day in the provided IANA timezone
  - `symptomType`
- Local day extraction uses `Intl.DateTimeFormat` with the passed timezone, so grouping is based on the requested calendar day rather than the machine timezone or UTC date.
- Within each group:
  - later `editedAt` wins
  - if `editedAt` is tied, lexicographically greater `id` wins
  - if both `editedAt` and `id` are tied, the first occurrence in the input is retained
- The returned winners preserve input order. I chose that because the prompt defines how to pick winners, but not how to order the final result.

### `mergeStreams`

- This is a standard two-pointer merge over two inputs that are already sorted by `editedAt` ascending.
- On equal timestamps, items from `a` are emitted before items from `b`.
- Using `<=` for the `a` side preserves:
  - stable ordering within `a`
  - stable ordering within `b`
  - the required cross-stream rule that `a` comes before `b` on ties

## Assumptions

- `editedAt` is a valid ISO 8601 timestamp representing a real instant.
- `dayTimezone` is a valid IANA timezone string understood by `Intl.DateTimeFormat`.
- `mergeStreams` assumes both inputs are already sorted by `editedAt` ascending.
- Lexicographic `id` comparison uses normal JavaScript string comparison.
- `selectCanonicalEdits` should work regardless of input order.

## Duplicate-id policy

This solution does not perform global deduplication by `id`. Duplicate `id` values are accepted as input and processed using the same grouping and winner rules as any other rows. If two records have the same `id`, same `editedAt`, and land in the same canonical group, the first occurrence is retained because replacement only happens when a strictly better candidate is found.

## Complexity

### `mergeStreams`

- Time complexity: `O(n)`, where `n = a.length + b.length`
- Space complexity: `O(n)` for the returned merged array
- Auxiliary space excluding the output array: `O(1)`

## Test coverage

The automated tests cover:

- local midnight boundaries using a fixed IANA timezone
- latest-edit selection within the same canonical bucket
- tie-breaking on `editedAt` using lexicographic `id`
- duplicate-id handling
- separate buckets for different users and symptom types
- interleaved merge behavior
- stable tie behavior where `a` comes before `b`
- empty-stream merge behavior

## AI usage

AI was used to sanity-check edge cases, pressure-test the documented assumptions, and tighten the README wording. I verified the final behavior by hand with manual traces and automated tests, especially around local-day grouping, duplicate-id handling, and merge stability. In a real PR, I would still want a teammate to review the timezone assumptions and confirm that the duplicate-id policy matches the intended product semantics.
