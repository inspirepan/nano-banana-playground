Ask the user one or more multiple-choice questions and wait for their answers before continuing.

Use this tool when you need to gather user preferences, clarify ambiguous instructions, or confirm a creative direction before generating images. Prefer this tool over guessing when the user's intent is genuinely ambiguous.

Each question must have:

- A short `header` chip (max 12 characters), e.g. `风格`, `用途`, `比例`.
- A clear `question` ending with a question mark.
- At least 2 mutually exclusive (unless `multi_select` is true) `options`.

Option fields:

- `label`: required short text.
- `description`: optional short explanation. Omit it when the label is self-evident.
- `icon`: optional Lucide icon name in kebab-case, e.g. `palette`, `image`, `layout-template`, `sparkles`.
- `swatches`: optional array of hex colors for palette chips, usually 2-5 colors.

Do not include an "Other" option — the UI automatically lets the user type a free-text note for each question.
Do not create a question with only one option such as "我写在备注里". That is invalid. If you mainly need free-form text (story outline, dialogue, character appearance), either ask in normal chat or provide meaningful choices such as "自由发挥" / "我补充细节" / "沿用参考图" and let the user add details in the note field.

Notes:

- Use the same language the user is using.
- If you have a recommendation, list it first and add `（推荐）` at the end of its label.
- Prefer 2-6 options for quick decisions, but use more when the choices are a natural complete set such as aspect ratios, styles, use cases, counts, or model-supported values.
- Use `icon` or `swatches` when they make the choice easier to scan visually; do not decorate every option by default.
- Omit `description` when the label is self-evident, such as aspect ratios, counts, simple yes/no choices, or obvious style names.
- Add a `description` only when the label needs clarification or the trade-off is not obvious.
- Set `multi_select: true` only when the user can pick multiple options at the same time.
- Keep questions tight; ask 1-4 at once at most.
