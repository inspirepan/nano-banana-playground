---
name: skill-creator
description: Guide for creating effective browser-local virtual skills in this app. This skill should be used when users want to create a new skill (or update an existing skill) that extends the Agent's capabilities with specialized knowledge, workflows, AskUserQuestion dimension systems, prompt templates, or tool integrations. Use whenever the user mentions "create a skill", "make a skill", "turn this into a skill", "skill for X", or wants to capture a workflow as reusable instructions. Do NOT use for one-off reminders, editing real repository skill files, installing external tools, or creating scripts/assets/binary bundles.
icon: badge-plus
display_name:
  zh-CN: Skill 创建器
  en: Skill Creator
display_description:
  zh-CN: 帮助 Agent 把可复用流程沉淀成精简 Skill。
  en: Helps the agent turn reusable workflows into concise skills.
metadata:
  short-description: Create or update a skill
---

# Skill Creator

This skill provides guidance for creating and improving effective skills inside this app's browser-local virtual skill library. Skills here are text-only virtual packages persisted through `CreateSkill`, not files on the user's machine: no real directories, no bundled scripts, no binary assets, no shell commands, no absolute local paths. Built-in system skills ship with the app and cannot be overwritten; user skills are implicitly saved with `source: user`. Every skill also needs a Lucide `icon` name in kebab-case for the settings UI and starter cards.

## Agent capability boundaries

Design skills around the tools this app actually exposes:

| Tool                      | Use it for                                                                                        | Boundary                                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `AskUserQuestion`         | Ask a compact form before running a workflow; collect style / layout / source / output dimensions | 1-4 questions, each with at least 2 real options; use notes for optional details, not as the only input path |
| `GenImage`                | Create approved, resumable image generation tasks                                                 | Use real existing `image_id` values only; do not invent paths or local files                          |
| `ReadImage`               | Inspect current session, history, reference, or generated images                                  | Requires a known image ID                                                                             |
| `WebSearch` / `WebFetch`  | Search and fetch web material when provider settings allow it                                     | Long fetched content may be saved as `agent://...` virtual files                                      |
| `ReadAgentFile`           | Page through long virtual tool outputs                                                            | Reads current-session `agent://...` files, not local filesystem paths                                 |
| `Skill` / `ReadSkillFile` | Load or inspect existing virtual skills                                                           | Read markdown skill files only                                                                        |
| `CreateSkill`             | Create or update a user skill in the browser's virtual library                                    | Cannot overwrite built-in system skills; creates text-only virtual files                              |

## Preferred skill pattern

Most built-in creative skills in this project use the same pattern: **capability boundary -> dimension matrix -> one `AskUserQuestion` form -> prompt/workflow template -> verification checklist**.

For a new skill, prefer defining 3-5 orthogonal dimensions such as:

| Dimension   | Example values                                 | Purpose                                                      |
| ----------- | ---------------------------------------------- | ------------------------------------------------------------ |
| `mode`      | create / edit / review / diagnose              | Selects the primary workflow                                 |
| `style`     | minimal / editorial / playful / enterprise     | Selects tone or visual treatment                             |
| `structure` | dense / list / flow / comparison / report      | Selects layout or information architecture                   |
| `source`    | user-notes / web / image-id / prior-output     | Selects where evidence comes from and which tools are needed |
| `output`    | markdown / image / outline / table / checklist | Selects final shape                                          |

Keep dimensions orthogonal. Do not make `style` secretly control layout, palette, and output count at the same time. If a value can be inferred from the user's topic, put it in an auto-recommendation table instead of asking another question.

## About Skills

Skills are modular, self-contained packages that extend the agent's capabilities by providing
specialized knowledge, workflows, and tools. Think of them as "onboarding guides" for specific
domains or tasks - they transform the agent from a general-purpose assistant into a specialized
agent equipped with procedural knowledge.

### What Skills Provide

1. Specialized workflows - Multi-step procedures for specific domains
2. Tool integrations - Instructions for working with specific file formats or APIs
3. Domain expertise - Company-specific knowledge, schemas, business logic
4. Bundled resources - Markdown reference files used for progressive disclosure. The virtual skill library does not support executable scripts, binary assets, image files, or absolute local paths.

## Core Principles

### Concise is Key

The context window is a public good. Skills share the context window with everything else:
system prompt, conversation history, other Skills' metadata, and the actual user request.

**Default assumption: The agent is already very smart.** Only add context the agent doesn't
already have. Challenge each piece of information: "Does the agent really need this explanation?"
and "Does this paragraph justify its token cost?"

Prefer concise examples over verbose explanations.

### Explain the Why

Prefer explaining **why** something matters over rigid MUST/NEVER directives. Today's LLMs
have strong theory of mind -- when given reasoning, they generalize beyond rote instructions.
If you find yourself writing ALWAYS or NEVER in all caps, reframe: explain the reasoning so
the model understands the importance and can apply judgment in edge cases.

### Anatomy of a Skill

Treat this anatomy as conceptual. `CreateSkill` persists a virtual package made of markdown files: `SKILL.md` is required, and additional markdown files such as `references/style-matrix.md` are allowed. `scripts/` and `assets/` directories are not supported.

```txt
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter metadata (required)
│   │   ├── name: (required)
│   │   ├── description: (required)
│   │   ├── icon: (required, Lucide kebab-case name)
│   │   └── display_name / display_description: (recommended, zh-CN + en)
│   └── Markdown instructions (required)
└── Bundled Resources (optional)
    └── references/       - Markdown documentation loaded into context as needed
```

#### SKILL.md (required)

Every SKILL.md consists of:

- **Frontmatter** (YAML): Contains `name` and `description` fields. These are the only fields
  that determine when the skill gets used, thus it is very important to be clear and comprehensive
  in describing what the skill is, and when it should be used. Also include localized UI metadata so the skill renders correctly in settings and starter cards:

  ```yaml
  display_name:
    zh-CN: 中文名
    en: English Name
  display_description:
    zh-CN: 一句中文 UI 描述
    en: One-line English UI description
  icon: lucide-kebab-icon
  ```

- **Body** (Markdown): Instructions and guidance for using the skill. Only loaded AFTER the
  skill triggers (if at all).

#### Bundled Resources (optional)

Use bundled resources to keep SKILL.md lean via **progressive disclosure**: load information
only when the agent needs it. In this app, bundled resources must be markdown text files -- the browser cannot run scripts or consume binary assets from a skill package.

Key rules:

- Keep files focused and easy to load just in time.
- Always use **relative paths** with forward slashes (`/`), regardless of OS.
- Use **Just-in-Time loading** -- explicitly instruct the agent in SKILL.md when to read a
  file, using `ReadSkillFile`. The agent will not see these resources unless directed to. Example: _"Read `references/auth-flow.md` for the complete error code table."_

##### References (`references/`)

References are the only supported bundled resource type. Use them for long matrices, style dictionaries, API notes, example prompts, or domain glossaries that the agent should read only when needed.

- **When to include**: For documentation that the agent should reference while working.
- **Examples**: `references/schema.md` for database schemas, `references/api_docs.md` for
  API specifications, `references/style-matrix.md` for a style/layout lookup table.
- **Loading**: Mention explicitly when to call `ReadSkillFile` for each reference.

##### Unsupported: Scripts and Assets

Skills in this library are text-only. Do not create `scripts/` (executable Python/Bash/etc.) or `assets/` (binary files, images, HTML templates) -- neither survives `CreateSkill` persistence.

- If deterministic logic is necessary, describe the algorithm as numbered workflow steps or decision tables in markdown. If that's not enough, propose implementing real code inside the app itself instead of inside a virtual skill package.
- For output templates, place concrete fenced text templates directly in `SKILL.md` or in a markdown reference file. Agents pattern-match exceptionally well from a template shown inline.

## Skill Creation Process

### Step 1: Capture Intent

Start by understanding the user's intent. The current conversation might already contain a
workflow the user wants to capture (e.g., "turn this into a skill"). If so, extract answers
from the conversation history first -- the tools used, the sequence of steps, corrections
the user made, input/output formats observed.

Ask these questions (skip any already answered):

1. What should this skill enable the agent to do?
2. When should this skill trigger? (what user phrases/contexts)
3. What is the expected output format?
4. Which Agent tools will the skill drive? (`AskUserQuestion`, `GenImage`, `ReadImage`, `WebSearch`, `WebFetch`, `ReadAgentFile`, `ReadSkillFile`, or plain conversation only)

### Step 2: Interview and Research

Proactively ask about edge cases, input/output formats, example files, success criteria,
and dependencies. Wait to write the skill until this is ironed out.

Check available MCPs -- if useful for research (searching docs, finding similar skills,
looking up best practices), research in parallel via subagents if available.

### Step 3: Plan Reusable Contents

Identify what belongs in the skill body versus a markdown reference, keeping everything text-only:

- Repetitive logic -> numbered workflow steps, decision tables, or pseudo-code in `SKILL.md`.
- Long reference documentation -> markdown files under `references/...`, loaded via `ReadSkillFile`.
- Output templates -> fenced text templates inside `SKILL.md` or a markdown reference file.

### Step 4: Write SKILL.md

Prepare the `SKILL.md` content (plus any markdown reference files) in memory; do not create real directories on disk. Follow the writing guidelines below, then call `CreateSkill` when the user wants to save it.

A good skill usually contains:

1. Trigger / non-trigger boundary.
2. Capability overview and tool boundary.
3. Dimension matrix (style / structure / source / output or domain-specific equivalents).
4. One `AskUserQuestion` template when decisions are categorical.
5. Auto-recommendation table for defaults.
6. Prompt / outline / report template.
7. Tool invocation notes (`GenImage`, `WebSearch`, `ReadImage`, etc.).
8. Common revision mappings.
9. Verification checklist.

### Step 5: Add Bundled Resources

Add markdown reference files under `references/...` as needed. Do not add scripts, assets, binary files, shell commands, or absolute paths -- `CreateSkill` only persists text.

### Step 6: Verification Suggestions

After creating or updating a skill, generate a short list of **concrete, actionable
verification suggestions** tailored to the specific skill, so the user can test it themselves.
Cover three angles:

1. **Discovery** -- suggest 2-3 example prompts the user can try to confirm the skill
   triggers correctly, and 1-2 similar-but-different prompts that should NOT trigger it.
   Negative test prompts should be **near-misses** that share keywords or concepts with the
   skill but need something different. Avoid obviously irrelevant prompts -- they don't
   test anything.
2. **Logic** -- suggest a realistic end-to-end task the user can run to check whether the
   agent follows each step without getting stuck or hallucinating missing information.
3. **Edge cases** -- name 1-2 tricky scenarios specific to this skill's domain that the user
   should try to make sure the skill handles them (or fails gracefully).

Present these as a checklist the user can walk through.

## Writing Guidelines

### Skill Naming

- Use lowercase letters, digits, and hyphens only.
- Prefer short, verb-led phrases that describe the action.
- Name the skill folder exactly after the skill name; this is also the value passed to `CreateSkill.name`.

### Frontmatter

Write the YAML frontmatter with `name` and `description`:

- `name`: The skill name (required)
- `description`: This is the primary triggering mechanism for your skill. The agent sees
  **only** this field when deciding whether to load the skill. Include:
  - What the skill does
  - Specific trigger phrases and contexts
  - "Negative triggers" to prevent false matches on similar-sounding requests

  **Important: Models tend to undertrigger skills** -- they err on the side of not using
  skills, even when a skill would clearly help. To counter this, write descriptions that are
  somewhat "pushy": enumerate concrete trigger scenarios generously.
  - **Bad:** `"React skills."` -- too vague, triggers on everything React-adjacent.
  - **Bad:** `"How to build dashboards."` -- too narrow, misses related queries.
  - **Good:** `"Creates and builds React components using Tailwind CSS. Use when the user
wants to update component styles or UI logic. Do not use for Vue, Svelte, or vanilla
CSS projects."` -- states capability, trigger context, and exclusions.
  - **Good:** `"How to build a simple fast dashboard to display internal data. Use this skill
whenever the user mentions dashboards, data visualization, metrics, or wants to display
any kind of data, even if they don't explicitly ask for a 'dashboard'."` -- pushes for
    broader triggering on related contexts.

Also include the UI fields so the skill renders correctly in settings and starter cards:

```yaml
icon: badge-plus
display_name:
  zh-CN: Skill 创建器
  en: Skill Creator
display_description:
  zh-CN: 帮助 Agent 把可复用流程沉淀成精简 Skill。
  en: Helps the agent turn reusable workflows into concise skills.
```

#### How Skill Triggering Works

Understanding the triggering mechanism helps write better descriptions. Skills appear in the
agent's `available_skills` list with their name + description only. The agent decides whether
to consult a skill based on that description.

Key insight: **the agent only consults skills for tasks it can't easily handle on its own.**
Simple, one-step queries (e.g., "read this PDF") may not trigger a skill even if the
description matches perfectly, because the agent can handle them directly. Complex, multi-step,
or specialized queries reliably trigger skills when the description matches.

### Body

Write instructions for using the skill and its bundled resources. Keep SKILL.md body to the
essentials and under 500 lines to minimize context bloat. If approaching this limit, add a
layer of hierarchy with clear pointers to reference files.

Skills are instructions for agents, not documentation for humans. Follow these writing rules:

- **Use numbered steps, not prose.** Define workflows as strict chronological sequences. For
  decision trees, map branches explicitly (e.g., _"Step 2: If source maps are needed, run
  `ng build --source-map`. Otherwise, skip to Step 3."_).
- **Write in third-person imperative.** Frame instructions as direct commands: _"Extract the
  text..."_ rather than _"I will extract..."_ or _"You should extract..."_.
- **Prefer templates over descriptions.** Place concrete output templates in fenced markdown blocks or markdown reference files and instruct the agent to copy the structure, instead of describing the format in paragraphs. (Binary `assets/` are not supported here.)
- **Use consistent terminology.** Pick one term per concept and use it everywhere. Prefer
  domain-native terms (e.g., Angular "template" instead of "html" or "markup").
- **For large reference files (>300 lines)**, include a table of contents.

**Domain organization**: When a skill supports multiple domains/frameworks, organize by variant. These paths are virtual markdown files passed to `CreateSkill.files`, not real directories:

```txt
cloud-deploy/
├── SKILL.md (workflow + selection)
└── references/
    ├── aws.md
    ├── gcp.md
    └── azure.md
```

The agent reads only the relevant reference file.

### Dimension and AskUserQuestion style

When a skill supports multiple creative or procedural variants, model it like the built-in image skills:

1. Define the dimensions first: `style × layout × palette × output`, or domain equivalents.
2. Keep the choices independent enough that users can combine them freely.
3. Provide an auto-recommendation table keyed by user topic or intent.
4. Use one `AskUserQuestion` call to collect missing dimensions before execution.
5. Treat the free-text note as the user's escape hatch for exact wording, custom style names, source URLs, or constraints.
6. Let downstream tools do their own approval when available. For example, do not add a separate "confirm before generation" step when `GenImage` already creates an approval card.

AskUserQuestion constraints:

- Use 1-4 questions per call.
- Use at least 2 options per question. Prefer 2-6 for quick decisions, but use more when the choices form a natural complete set.
- Keep `header` at 12 characters or fewer.
- Use `multi_select: true` only when the selected options can genuinely combine.
- Do not use a single "I will write details in notes" option; options must be real choices.

### What NOT to Create

Do not create files that waste tokens, duplicate what the agent already knows, or violate this app's virtual-skill boundaries:

- **Documentation files** (`README.md`, `CHANGELOG.md`) -- skills are not human-facing docs.
- **Redundant instructions** -- if the agent handles a task reliably without guidance, omit it.
- **Library code or executable scripts** -- long-lived library code belongs in the actual repo, not in a skill package; executable scripts, shell commands, and binary files cannot be persisted through `CreateSkill` anyway.
- **Real directories or files on the user's machine** -- skills live only in the browser-local virtual skill library.
- **Skills for one-off facts, temporary preferences, or project state** -- those belong in conversation, memory, or the actual codebase.

## CreateSkill tool call

When the user confirms they want to save the skill, call `CreateSkill` with the virtual package content:

```json
{
  "name": "example-skill",
  "agent_description": "Create [task] with [dimension] combinations. Use when the user says ... Do NOT use for ...",
  "display_name_zh": "示例 Skill",
  "display_name_en": "Example Skill",
  "display_description_zh": "一句中文 UI 描述。",
  "display_description_en": "One-line English UI description.",
  "icon": "sparkles",
  "files": [
    {
      "path": "SKILL.md",
      "content": "---\nname: example-skill\ndescription: ...\n---\n\n# Example Skill\n..."
    },
    {
      "path": "references/style-matrix.md",
      "content": "# Style Matrix\n\n..."
    }
  ],
  "enabled": true
}
```

Rules:

- Include `SKILL.md` whenever possible.
- Additional files must be markdown text, usually under `references/...`.
- The `agent_description` should match the frontmatter `description` in substance; it is the discovery text shown before loading the skill.
- Do not overwrite built-in system skills.

## Improving an Existing Skill

When improving a skill based on feedback or test results:

1. **Generalize from feedback.** Skills are used across many different prompts. Avoid overfitting
   to specific test examples -- fiddly, narrow changes that work for one case often break
   others. Prefer broader principles over specific patches.

2. **Keep the prompt lean.** Remove instructions that aren't pulling their weight. Read the
   agent's execution transcripts (not just final outputs) -- if the skill causes the agent to
   waste time on unproductive steps, cut those instructions.

3. **Explain the why.** Instead of adding more rigid MUSTs, explain the reasoning behind the
   desired behavior. The agent generalizes better from understanding intent than from following
   rigid rules.

4. **Look for repeated work.** If the agent independently takes the same multi-step approach across multiple uses, convert that pattern into tighter workflow steps, decision tables, prompt templates, or markdown references so every future invocation skips the reinvention. Since user skills here cannot bundle scripts, if the repetition genuinely needs deterministic code, recommend implementing it inside the app itself instead.

Workflow for updating an existing skill:

1. Use `ReadSkillFile` to inspect `SKILL.md` and any referenced markdown files.
2. Decide whether the fix belongs in the discovery description, dimension form, auto-recommendation table, workflow, template, or verification suggestions.
3. Preserve useful original wording unless it conflicts with this app's virtual-skill boundaries.
4. Call `CreateSkill` with the updated full file set. Built-in system skills cannot be overwritten from the browser library.

## Skill Storage

This app stores user-created skills in the browser-local virtual skill library; there is no choice between project-level and user-level filesystem paths inside the app UI. Skill files are virtual markdown files read through `Skill` / `ReadSkillFile`, not local filesystem paths.

- Built-in system skills ship with the app and cannot be overwritten by `CreateSkill`.
- User skills are saved with `source: user` in the browser-local virtual skill library.

Do not ask the user whether to store the skill in `.agents/skills/`, `.claude/skills/`, `~/.agents/skills/`, or `~/.claude/skills/` when creating a skill inside this web app -- those paths belong to other agent runtimes, not this app's browser skill library.
