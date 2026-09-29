# Demo data

Sample sources for trying ResearchLens AI. Every file is labelled DEMO DATA: the content is invented for testing and is not real research.

## Main demo (upload all four together)

| File | Type |
| --- | --- |
| `demo-field-study.pdf` | PDF |
| `demo-quality-review.docx` | Word |
| `demo-survey-notes.txt` | Text |
| `demo-team-retrospective.pdf` | PDF |

The files cover generative AI and developer productivity, and some of them disagree on purpose so the analysis has a contradiction to find.

Suggested project:

- **Title:** Impact of Generative AI on Developer Productivity
- **Research question:** How does generative AI affect developer productivity, code quality, and developer satisfaction?

Things to try:

1. Upload the four files and wait until each one shows "ready".
2. Ask the Research Assistant: *Do the sources agree on whether AI makes developers faster?* The answer cites each file and page.
3. Ask about something the files don't cover, such as blockchain. The assistant answers "Insufficient evidence" instead of guessing.
4. Click **Run analysis**, then open Insights, Evidence Matrix and Research Brief.

## Error tests (`error-tests/`)

- `demo-scanned.pdf`: a PDF with no extractable text. It is marked as failed with a clear message.
- `not-really.pdf`: a text file renamed to `.pdf`. The upload is rejected because the content isn't a real PDF.
