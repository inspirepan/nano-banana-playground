---
name: skill-creator
description: Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Claude's capabilities with specialized knowledge, workflows, or tool integrations. Use whenever the user mentions "create a skill", "make a skill", "turn this into a skill", "skill for X", or wants to capture a workflow as reusable instructions.
metadata:
  short-description: Create or update a skill
---

# Skill Creator

This skill provides guidance for creating and improving effective skills.

## Imagine Playground adapter

This app stores skills in a browser-local virtual skill library. Do not create real directories or files.
When the user wants to persist a skill, prepare `SKILL.md` and optional markdown reference files, then call `CreateSkill`.
Use `source: user` implicitly; system skills are built into the app and cannot be overwritten.
Choose a Lucide `icon` name in kebab-case for the settings UI and starter cards.
Keep skills text-only: no bundled scripts, assets, binary files, shell commands, or absolute local paths.

## About Skills

Skills are modular, self-contained packages that extend the agent's capabilities by providing
specialized knowledge, workflows, and tools. Think of them as "onboarding guides" for specific
domains or tasks - they transform the agent from a general-purpose assistant into a specialized
agent equipped with procedural knowledge.

### What Skills Provide

1. Specialized workflows - Multi-step procedures for specific domains
2. Tool integrations - Instructions for working with specific file formats or APIs
3. Domain expertise - Company-specific knowledge, schemas, business logic
4. Bundled resources - Scripts, references, and assets for complex and repetitive tasks

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

Every skill consists of a required SKILL.md file and optional bundled resources:

```
skill-name/
├── SKILL.md (required)
│   ├── YAML frontmatter metadata (required)
│   │   ├── name: (required)
│   │   ├── description: (required)
│   │   └── icon: (optional, Lucide kebab-case name)
│   └── Markdown instructions (required)
└── Bundled Resources (optional)
    ├── scripts/          - Executable code (Python/Bash/etc.)
    ├── references/       - Documentation intended to be loaded into context as needed
    └── assets/           - Files used in output (templates, icons, fonts, etc.)
```

#### SKILL.md (required)

Every SKILL.md consists of:

- **Frontmatter** (YAML): Contains `name` and `description` fields. These are the only fields
  that determine when the skill gets used, thus it is very important to be clear and comprehensive
  in describing what the skill is, and when it should be used.
- **Body** (Markdown): Instructions and guidance for using the skill. Only loaded AFTER the
  skill triggers (if at all).

#### Bundled Resources (optional)

Use bundled resources to keep SKILL.md lean via **progressive disclosure**: load information
only when the agent needs it.

Key rules for all bundled resources:

- Keep files **one level deep** only (e.g., `references/schema.md`, not
  `references/db/v1/schema.md`).
- Always use **relative paths** with forward slashes (`/`), regardless of OS.
- Use **Just-in-Time loading** -- explicitly instruct the agent in SKILL.md when to read a
  file. The agent will not see these resources unless directed to. Example: _"Read
  `references/auth-flow.md` for the complete error code table."_

##### Scripts (`scripts/`)

Executable code (Python/Bash/etc.) for tasks that require deterministic reliability or are
repeatedly rewritten.

- **When to include**: When the same code is being rewritten repeatedly or deterministic
  reliability is needed
- **Example**: `scripts/rotate_pdf.py` for PDF rotation tasks
- **Error messages matter**: The agent relies on stdout/stderr to determine success or
  failure. Write scripts that return descriptive, human-readable error messages so the agent
  can self-correct without user intervention.
- Do not bundle long-lived library code here; skills should contain tiny, single-purpose
  scripts only.

##### References (`references/`)

Documentation and reference material intended to be loaded as needed into context.

- **When to include**: For documentation that the agent should reference while working
- **Examples**: `references/schema.md` for database schemas, `references/api_docs.md` for
  API specifications

##### Assets (`assets/`)

Files not intended to be loaded into context, but rather used within the output. Agents
pattern-match exceptionally well -- prefer placing a concrete template in `assets/` over
writing paragraphs that describe the desired output format.

- **When to include**: When the skill needs files that will be used in the final output, or
  concrete templates the agent should copy the structure of
- **Examples**: `assets/logo.png` for brand assets, `assets/template.html` for HTML templates

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
4. Are there dependencies (specific tools, MCPs, libraries)?

### Step 2: Interview and Research

Proactively ask about edge cases, input/output formats, example files, success criteria,
and dependencies. Wait to write the skill until this is ironed out.

Check available MCPs -- if useful for research (searching docs, finding similar skills,
looking up best practices), research in parallel via subagents if available.

### Step 3: Plan Reusable Contents

Identify what belongs in bundled resources:

- Repetitive code -> `scripts/`
- Reference documentation -> `references/`
- Output templates -> `assets/`

### Step 4: Write SKILL.md

Create the skill directory structure and write SKILL.md with proper frontmatter and body.
Follow the writing guidelines below.

### Step 5: Add Bundled Resources

Add scripts, references, and assets as needed.

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

- Use lowercase letters, digits, and hyphens only
- Prefer short, verb-led phrases that describe the action
- Name the skill folder exactly after the skill name

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
- **Prefer templates over descriptions.** Place concrete output templates in `assets/` and
  instruct the agent to copy the structure, instead of describing the format in paragraphs.
- **Use consistent terminology.** Pick one term per concept and use it everywhere. Prefer
  domain-native terms (e.g., Angular "template" instead of "html" or "markup").
- **For large reference files (>300 lines)**, include a table of contents.

**Domain organization**: When a skill supports multiple domains/frameworks, organize by variant:

```
cloud-deploy/
├── SKILL.md (workflow + selection)
└── references/
    ├── aws.md
    ├── gcp.md
    └── azure.md
```

The agent reads only the relevant reference file.

### What NOT to Create

Do not create files that waste tokens or duplicate what the agent already knows:

- **Documentation files** (`README.md`, `CHANGELOG.md`) -- skills are not human-facing docs.
- **Redundant instructions** -- if the agent handles a task reliably without guidance, omit it.
- **Library code** -- long-lived library code belongs in standard repo directories, not in
  `scripts/`.

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

4. **Look for repeated work.** If the agent independently writes similar helper scripts or
   takes the same multi-step approach across multiple uses, that's a strong signal to bundle
   that script in `scripts/`. Write it once so every future invocation skips the reinvention.

## Skill Storage Locations

Skills can be stored in multiple locations with the following priority (higher priority overrides lower):

| Priority | Scope   | Path                | Description          |
| -------- | ------- | ------------------- | -------------------- |
| 1        | Project | `.agents/skills/`   | Current project only |
| 2        | Project | `.claude/skills/`   | Current project only |
| 3        | User    | `~/.agents/skills/` | User-level           |
| 4        | User    | `~/.claude/skills/` | User-level (Claude)  |

If the user does not explicitly specify project-level vs user-level, ask a clarification
question before creating or updating the skill.
