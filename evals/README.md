# Accuracy tests

`cases.csv` holds test questions with the answer F1 Compass should give. `npm run eval` sends every question to the app and reports how many verdicts match.

## Adding a question

Edit `cases.csv` (on GitHub: open the file, click the pencil icon). One row per question:

| Column | What to write |
|---|---|
| `id` | Next number |
| `question` | What a student would type. English mostly, a few in Chinese |
| `expected` | One of `allowed`, `needs_authorization`, `not_allowed`, `unclear` |
| `source` | Link to the official page that supports the answer (uscis.gov, ice.gov, studyinthestates.dhs.gov, ecfr.gov) |
| `notes` | Optional: why |

If a question contains a comma, wrap it in double quotes.

## 怎么加测试题（给队友）

在 GitHub 上打开 `cases.csv`，点右上角的铅笔图标编辑，每行一道题：

- `question`：学生会怎么问，大部分用英文，也写几条中文的
- `expected`：正确结论，只能填 `allowed`（允许）、`needs_authorization`（要先办 CPT/OPT）、`not_allowed`（不允许）、`unclear`（不确定，问 DSO）
- `source`：能证明这个结论的官方网页链接
- 题目里如果有英文逗号，整句用英文双引号括起来

前 10 条是示例，`source` 还空着，也请帮忙补上并核对结论。

## Running

```bash
npm run dev      # in one terminal
npm run eval     # in another
```

Options: `EVAL_LIMIT=5` runs only the first 5 cases; `EVAL_CONCURRENCY=3` runs 3 at a time (default 2); `EVAL_URL` points at a deployed copy instead of localhost.

Results print to the terminal and are saved to `evals/results.md`. A **dangerous** error is one where the app says *likely allowed* but the expected answer is anything else: that is the mistake that could hurt a student, so the goal is zero.
