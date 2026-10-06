# TICKET FILTER — AGENT RULES
## React Addendum

> Add a new **Ticket Filter** page/selector to the existing app.
>
> Input is a batch of 6-digit ticket codes separated by commas:
>
> ```text
> 110294,890504,291160,223907,...
> ```
>
> Processing is client-side only.
> No backend.

---

# 1. Core Filter Order

The filter order is mandatory:

```text
1. Validate 6-digit ticket
2. Read LAST 2 DIGITS only
3. Check tail against ALLOWED_TAILS
4. If tail fails => REJECT immediately
5. Split ticket into AB / CD / EF
6. Calculate AB + CD + EF
7. Require sum >= 50
8. Calculate digital root of the sum
9. Require root in {1,3,5,8}
10. Calculate even/odd using all 6 individual digits
11. Require parity 3/3 or 4/2
12. Rank accepted tickets
```

Important:

```text
ALLOWED_TAILS applies ONLY to the last 2 digits.
Do NOT require AB and CD to belong to ALLOWED_TAILS.
```

---

# 2. Allowed Tail Pool

```ts
const ALLOWED_TAILS = new Set([
  2,3,4,5,6,7,8,9,10,11,
  13,14,15,16,18,21,22,23,24,26,29,
  34,35,36,37,39,42,47,
  55,56,57,58,60,63,68,76,
  89,90,91,92,94,97
]);
```

Formatted:

```text
02,03,04,05,06,07,08,09,10,11,
13,14,15,16,18,21,22,23,24,26,29,
34,35,36,37,39,42,47,
55,56,57,58,60,63,68,76,
89,90,91,92,94,97
```

---

# 3. Ticket Format

Every ticket must contain exactly 6 digits.

Valid:

```text
110294
890504
021855
059255
```

Invalid:

```text
11029
1102947
11-0294
abc123
```

Use:

```ts
/^\d{6}$/
```

Keep ticket codes as strings.

Leading zeros must be preserved.

---

# 4. Parse Input

Accepted input:

```text
110294,890504,291160,223907
```

Also accept spaces/newlines:

```text
110294,
890504,
291160
```

Parser:

```ts
function parseTicketInput(input: string): string[] {
  return input
    .replace(/\r?\n/g, ",")
    .split(",")
    .map(v => v.trim())
    .filter(Boolean);
}
```

Do NOT silently remove invalid internal characters.

---

# 5. Step 1 — Tail Filter

Read only the last 2 digits:

```ts
function getTicketTail(code: string): number {
  return Number(code.slice(-2));
}
```

Examples:

```text
110294 => tail 94
890504 => tail 04 => numeric 4
653805 => tail 05 => numeric 5
426012 => tail 12
```

Check:

```ts
const tailAllowed =
  ALLOWED_TAILS.has(getTicketTail(code));
```

If false:

```text
REJECT immediately
```

Do not continue to sum/root/parity unless needed for debug mode.

---

# 6. Step 2 — Split AB / CD / EF

After tail passes:

```ts
function splitTicket(code: string): [number, number, number] {
  return [
    Number(code.slice(0,2)),
    Number(code.slice(2,4)),
    Number(code.slice(4,6)),
  ];
}
```

Example:

```text
110294
=> 11 / 02 / 94
```

Important:

```text
Only EF was checked against ALLOWED_TAILS.
AB and CD can be any valid 00..99 value.
```

---

# 7. Step 3 — Sum Rule

```ts
pairSum = AB + CD + EF;
```

Hard rule:

```text
pairSum >= 50
```

Example:

```text
110294
11 + 02 + 94
= 107
PASS
```

Example:

```text
020304
02 + 03 + 04
= 9
REJECT
```

---

# 8. Step 4 — Digital Root

Calculate digital root from `pairSum`.

```ts
function digitalRoot(n: number): number {
  if (n === 0) return 0;
  return 1 + ((n - 1) % 9);
}
```

Allowed roots:

```text
1
3
5
8
```

Hard rule:

```ts
[1,3,5,8].includes(root)
```

Priority:

```text
8 > 5 > 3 > 1
```

Examples:

```text
107 => 1+0+7 = 8
98  => 9+8=17 => 1+7=8
100 => 1
68  => 6+8=14 => 1+4=5
```

---

# 9. Step 5 — Digit Parity

Parity is calculated from all 6 individual digits.

Example:

```text
110294
digits = 1,1,0,2,9,4
```

Even:

```text
0,2,4
= 3
```

Odd:

```text
1,1,9
= 3
```

Result:

```text
3/3
```

Accepted:

```text
3/3
4/2
```

Meaning:

```text
3 even / 3 odd
4 even / 2 odd
```

Reject:

```text
2/4
5/1
1/5
6/0
0/6
```

Digit `0` is EVEN.

Implementation:

```ts
function getDigitParity(code: string) {
  const digits = [...code].map(Number);

  const even =
    digits.filter(d => d % 2 === 0).length;

  const odd = 6 - even;

  return {
    even,
    odd,
    key: `${even}/${odd}`,
  };
}
```

---

# 10. Final Acceptance Rule

```ts
accepted =
  validFormat &&
  tailAllowed &&
  pairSum >= 50 &&
  [1,3,5,8].includes(root) &&
  ["3/3","4/2"].includes(parity);
```

---

# 11. Ranking

Default sort:

```text
1. Root priority:
   8 > 5 > 3 > 1

2. Parity priority:
   3/3 > 4/2

3. Sum descending

4. Ticket ascending
```

```ts
const ROOT_PRIORITY = {
  8: 4,
  5: 3,
  3: 2,
  1: 1,
};

const PARITY_PRIORITY = {
  "3/3": 2,
  "4/2": 1,
};
```

---

# 12. UI

Add a new page/selector:

```text
Ticket Filter
```

Recommended route:

```text
/ticket-filter
```

Desktop:

```text
┌──────────────────────────────┬───────────────────────────────┐
│ INPUT                        │ OUTPUT                        │
│                              │                               │
│ textarea                     │ Accepted / Rejected / All     │
│                              │                               │
│ [Filter] [Clear]             │ table                         │
├──────────────────────────────┴───────────────────────────────┤
│ PROCESS LOG                                                  │
└──────────────────────────────────────────────────────────────┘
```

Recommended:

```text
Input 40%
Output 60%
```

---

# 13. Input Box

Placeholder:

```text
110294,890504,291160,223907,...
```

Buttons:

```text
Filter
Clear
Paste Example
```

Optional:

```text
Detected: 120 tickets
```

---

# 14. Output Tabs

```text
Accepted
Rejected
All
```

Default:

```text
Accepted
```

---

# 15. Accepted Table

Columns:

```text
Rank
Ticket
Tail
Split
Sum
Root
Parity
Status
```

Example:

```text
1 | 110294 | 94 | 11+02+94 | 107 | 8 | 3/3 | PASS
```

---

# 16. Rejected Table

Columns:

```text
Ticket
Tail
Reason
Split
Sum
Root
Parity
```

Only show values that were actually calculated.

If ticket fails Tail Filter, later fields may show:

```text
—
```

---

# 17. Reject Reasons

```ts
type TicketRejectReason =
  | "INVALID_FORMAT"
  | "DUPLICATE"
  | "TAIL_NOT_ALLOWED"
  | "SUM_TOO_LOW"
  | "ROOT_NOT_ALLOWED"
  | "PARITY_NOT_ALLOWED";
```

---

# 18. Processing Log

Add:

```text
PROCESS LOG
```

Levels:

```text
INFO
WARN
ERROR
```

Example:

```text
[INFO] Parsed 9 tickets.
[WARN] 426012 rejected at Tail Filter: tail 12 not allowed.
[WARN] 020304 rejected: sum 9 < 50.
[WARN] 653805 rejected: digital root 9 not allowed.
[WARN] 971108 rejected: parity 2/4 not allowed.
[ERROR] abc123 invalid format.
[INFO] 5 tickets accepted.
```

Invalid entries must NOT stop processing the remaining batch.

---

# 19. Result Model

```ts
type TicketFilterResult = {
  code: string;

  tail?: number;
  tailAllowed?: boolean;

  parts?: [
    number,
    number,
    number
  ];

  pairSum?: number;
  digitalRoot?: number;

  evenDigits?: number;
  oddDigits?: number;
  parity?: string;

  accepted: boolean;

  rejectReasons: TicketRejectReason[];

  inputIndex: number;
};
```

---

# 20. Main Function

```ts
filterTickets(
  input: string,
  settings?: TicketFilterSettings
): {
  accepted: TicketFilterResult[];
  rejected: TicketFilterResult[];
  logs: TicketLog[];
  summary: TicketFilterSummary;
}
```

---

# 21. Processing Pipeline

```text
INPUT
↓
Parse comma/newline-separated values
↓
Trim
↓
Remove empty entries
↓
Detect duplicates
↓
Validate 6 digits
↓
READ LAST 2 DIGITS
↓
TAIL FILTER
↓
Reject immediately if tail not allowed
↓
Split AB/CD/EF
↓
Calculate AB+CD+EF
↓
Require sum >= 50
↓
Calculate digital root
↓
Require root 1/3/5/8
↓
Calculate parity from 6 digits
↓
Require 3/3 or 4/2
↓
Rank accepted
↓
OUTPUT + LOG
```

---

# 22. Example Input

```text
110294,890504,291160,223907,607658,021855,653805,971108,020304,426012,abc123
```

---

# 23. Example Processing

## 110294

```text
Tail = 94
94 allowed => PASS step 1

Split:
11 + 02 + 94 = 107

Sum >= 50 => PASS

Root:
107 => 8

Root allowed => PASS

Digits:
1,1,0,2,9,4

Parity:
3 even / 3 odd
= 3/3

FINAL => PASS
```

## 890504

```text
Tail = 04 => 4
4 allowed

89 + 05 + 04 = 98

Root = 8

Digits:
8,9,0,5,0,4

Even = 4
Odd = 2

Parity = 4/2

FINAL => PASS
```

## 291160

```text
Tail = 60
60 allowed

29 + 11 + 60 = 100

Root = 1

Parity = 3/3

FINAL => PASS
```

## 223907

```text
Tail = 07 => 7
7 allowed

22 + 39 + 07 = 68

Root = 5

Parity = 3/3

FINAL => PASS
```

## 607658

```text
Tail = 58
58 allowed

60 + 76 + 58 = 194

Root = 5

Parity = 4/2

FINAL => PASS
```

## 021855

```text
Tail = 55
55 allowed

02 + 18 + 55 = 75

Root = 3

Parity = 3/3

FINAL => PASS
```

## 653805

```text
Tail = 05 => 5
5 allowed

65 + 38 + 05 = 108

Root:
108 => 9

9 not allowed

FINAL => REJECT
Reason:
ROOT_NOT_ALLOWED
```

## 971108

```text
Tail = 08 => 8
8 allowed

97 + 11 + 08 = 116

Root = 8

Digits:
9,7,1,1,0,8

Even = 2
Odd = 4

Parity = 2/4

FINAL => REJECT
Reason:
PARITY_NOT_ALLOWED
```

## 020304

```text
Tail = 04 => 4
4 allowed

02 + 03 + 04 = 9

9 < 50

FINAL => REJECT
Reason:
SUM_TOO_LOW
```

## 426012

```text
Tail = 12

12 is not in ALLOWED_TAILS

FINAL => REJECT IMMEDIATELY
Reason:
TAIL_NOT_ALLOWED
```

## abc123

```text
Not exactly 6 digits

FINAL => ERROR / REJECT
Reason:
INVALID_FORMAT
```

---

# 24. Example Accepted Output

Default ranking:

```text
Root 8 > 5 > 3 > 1
then 3/3 > 4/2
then Sum DESC
```

| Rank | Ticket | Tail | Split | Sum | Root | Parity | Status |
|---:|---|---:|---|---:|---:|---:|---|
| 1 | 110294 | 94 | 11+02+94 | 107 | 8 | 3/3 | PASS |
| 2 | 890504 | 04 | 89+05+04 | 98 | 8 | 4/2 | PASS |
| 3 | 223907 | 07 | 22+39+07 | 68 | 5 | 3/3 | PASS |
| 4 | 607658 | 58 | 60+76+58 | 194 | 5 | 4/2 | PASS |
| 5 | 021855 | 55 | 02+18+55 | 75 | 3 | 3/3 | PASS |
| 6 | 291160 | 60 | 29+11+60 | 100 | 1 | 3/3 | PASS |

---

# 25. Example Rejected Output

| Ticket | Tail | Reason | Sum | Root | Parity |
|---|---:|---|---:|---:|---:|
| 653805 | 05 | ROOT_NOT_ALLOWED | 108 | 9 | — |
| 971108 | 08 | PARITY_NOT_ALLOWED | 116 | 8 | 2/4 |
| 020304 | 04 | SUM_TOO_LOW | 9 | — | — |
| 426012 | 12 | TAIL_NOT_ALLOWED | — | — | — |
| abc123 | — | INVALID_FORMAT | — | — | — |

---

# 26. Example Process Log

```text
[INFO] Parsed 11 input values.
[INFO] 110294 accepted.
[INFO] 890504 accepted.
[INFO] 291160 accepted.
[INFO] 223907 accepted.
[INFO] 607658 accepted.
[INFO] 021855 accepted.

[WARN] 653805 rejected: digital root 9 is not allowed.
[WARN] 971108 rejected: parity 2/4 is not allowed.
[WARN] 020304 rejected: sum 9 is below 50.
[WARN] 426012 rejected at Tail Filter: tail 12 is not allowed.
[ERROR] abc123 rejected: ticket must contain exactly 6 digits.

[INFO] Accepted: 6
[INFO] Rejected: 5
```

---

# 27. Summary Cards

Example:

```text
Input        11
Accepted      6
Rejected      5
Tail Failed   1
Errors        1
```

Optional additional counters:

```text
Sum Failed
Root Failed
Parity Failed
Duplicates
```

---

# 28. Copy / Export

Buttons:

```text
Copy Accepted
Copy Detailed
Export CSV
```

`Copy Accepted`:

```text
110294,890504,223907,607658,021855,291160
```

CSV:

```text
rank,ticket,tail,a,b,c,sum,root,parity,status
1,110294,94,11,02,94,107,8,3/3,PASS
2,890504,04,89,05,04,98,8,4/2,PASS
```

---

# 29. Duplicate Handling

Default:

```text
remove duplicate ticket codes
```

Keep first occurrence.

Log:

```text
[WARN] Duplicate ignored: 110294
```

Do not count duplicate as a normal reject unless UI explicitly wants it.

---

# 30. Performance

Target:

```text
1–10,000 ticket codes
```

Use:

```ts
Set
Map
single-pass filtering
```

Allowed tails must be a `Set`, not an array search inside large loops.

---

# 31. Required Tests

Test:

```text
6-digit validation
leading-zero preservation
comma parsing
newline parsing
tail extraction
04 => 4
05 => 5
tail allowed
tail rejected before later rules
AB/CD/EF split
sum >= 50
digital root
root 1/3/5/8
root priority 8>5>3>1
0 counts as even
3/3 parity
4/2 parity
2/4 rejection
duplicate handling
ranking
logs
batch continues after invalid entries
```

---

# 32. Non-Negotiable Rules

1. ALLOWED_TAILS applies ONLY to the last two digits.
2. Do not require AB or CD to be in the tail pool.
3. Tail Filter is the first business filter.
4. A failed tail is rejected immediately.
5. Sum is calculated from AB + CD + EF.
6. Sum must be >= 50.
7. Root must be 1,3,5,8.
8. Root priority is 8 > 5 > 3 > 1.
9. Parity uses all 6 individual digits.
10. Zero is even.
11. Only 3/3 and 4/2 pass.
12. Prefer 3/3 over 4/2.
13. Preserve leading zeros.
14. Invalid tickets must not stop batch processing.
15. Output must show clear reject reasons.
16. UI must include Input, Output, and Process Log.
17. No backend.

---

# 33. Final Agent Prompt

```text
Update the existing Ticket Filter module.

IMPORTANT CHANGE:

The allowed number pool applies ONLY to the final two digits of each 6-digit ticket.

Example:
110294 => tail 94

Do NOT validate the first two pairs (11 and 02) against the allowed tail pool.

Processing order:

1. Validate exactly 6 digits.
2. Extract final two digits.
3. Reject immediately if tail is not in ALLOWED_TAILS.
4. Split ticket into AB/CD/EF.
5. Calculate AB + CD + EF.
6. Require sum >= 50.
7. Calculate digital root from the sum.
8. Accept only roots 1,3,5,8.
9. Rank roots 8 > 5 > 3 > 1.
10. Calculate parity from all six individual digits.
11. Treat 0 as even.
12. Accept only 3/3 or 4/2.
13. Prefer 3/3 over 4/2.
14. Rank accepted tickets.
15. Show Accepted, Rejected, All, Summary, and Process Log.
16. Continue processing after invalid tickets.
17. Preserve leading zeros.
18. Add Copy Accepted and CSV export.
19. No backend.

Input example:
110294,890504,291160,223907,607658,021855,653805,971108,020304,426012,abc123

Expected accepted:
110294
890504
223907
607658
021855
291160

Expected rejected:
653805 => ROOT_NOT_ALLOWED
971108 => PARITY_NOT_ALLOWED
020304 => SUM_TOO_LOW
426012 => TAIL_NOT_ALLOWED
abc123 => INVALID_FORMAT
```

# END
