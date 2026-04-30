Ask the user one or more multiple-choice questions and wait for their answers before continuing.

Use this tool when you need to gather user preferences, clarify ambiguous instructions, or confirm a creative direction before generating images. Prefer this tool over guessing when the user's intent is genuinely ambiguous.

Each question must have:

- A short `header` chip (max 12 characters), e.g. `风格`, `用途`, `比例`.
- A clear `question` ending with a question mark.
- 2-4 mutually exclusive (unless `multi_select` is true) `options`, each with a concise `label` and a one-sentence `description`.

Do not include an "Other" option — the UI automatically lets the user type a free-text note for each question.

Notes:

- Use the same language the user is using.
- If you have a recommendation, list it first and add `（推荐）` at the end of its label.
- Set `multi_select: true` only when the user can pick multiple options at the same time.
- Keep questions tight; ask 1-4 at once at most.
