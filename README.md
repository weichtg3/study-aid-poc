# Study Bloom

Study Bloom is a static, browser-based study aid. It reads lessons and questions aloud, accepts spoken or typed answers, grades them in the browser, and saves progress on the student's device. There is no application server, account, PIN, or database.

## Features

- A course library that supports any number of JSON-authored courses
- Tutorial lessons and configurable quizzes
- Browser text-to-speech and speech recognition with a typed fallback
- Deterministic, concept-based grading
- Per-course score history in browser `localStorage`
- Installable PWA shell
- Free deployment through GitHub Pages

Voice and speech-recognition support varies by browser and operating system. The app never uploads recorded audio. Progress remains on the current browser and will be lost if its site data is cleared.

## Run locally

Node.js 22 or newer is required for the local static server and tests.

```bash
npm install
npm start
```

Open <http://localhost:3000>. The Express process only serves static files and mirrors the paths used by GitHub Pages; grading and persistence happen in the browser.

Run the tests with:

```bash
npm test
```

## Deploy to GitHub Pages

The workflow in `.github/workflows/pages.yml` validates the app and assembles `public/` and `data/courses/` into one static Pages artifact whenever `feature` is updated.

1. Push the repository to GitHub with `feature` as its default and deployment branch.
2. Open **Settings → Pages** in the repository.
3. Under **Build and deployment**, select **GitHub Actions** as the source.
4. Run **Deploy to GitHub Pages** from the Actions tab, or push to `feature`.

All application URLs are relative, so both `https://owner.github.io/repository/` project sites and custom domains are supported.

## Add a course

Course source files live in `data/courses/`. The catalog is `data/courses/index.json`, and the complete authoring contract is documented as JSON Schema in `data/course.schema.json`.

To add a course:

1. Copy `data/courses/asteraceae.json` to a lowercase, hyphenated filename.
2. Give the course a unique lowercase, hyphenated `id`.
3. Replace its lessons and questions while keeping `schemaVersion` set to `1`.
4. Add its `id` and filename to `data/courses/index.json`.
5. Run `npm test` before deploying.

Each course has this top-level structure:

```json
{
  "schemaVersion": 1,
  "id": "course-id",
  "title": "Course title",
  "eyebrow": "Subject · Level",
  "description": "A short description.",
  "passingScore": 70,
  "estimatedMinutes": 10,
  "accent": "#7357e6",
  "lessons": [],
  "questions": []
}
```

Questions may be `spoken` or `choice`. Both use the same grading fields:

```json
{
  "id": "q1",
  "topic": "Flower head",
  "type": "spoken",
  "prompt": "What is the dense flower head called?",
  "answer": "capitulum",
  "acceptedAnswers": ["capitulum", "a capitulum"],
  "requiredConcepts": ["capitulum"],
  "hint": "The word begins with cap—.",
  "explanation": "The dense flower head is called a capitulum."
}
```

Choice questions also require an `options` array. Concept alternatives use a pipe, such as `"edge|outside|outer"`. A response must match all required concepts for full credit or at least half for a partial retry.

Lessons and questions can include an optional accessible image stored under `public/`. Use `images` for a gallery and `tables` for source data matrices:

```json
"image": {
  "src": "course-assets/course-id/figure.png",
  "alt": "A concise description of the figure.",
  "caption": "Optional source or study instruction"
}
```

Every gallery image uses the same `src`, `alt`, and optional `caption` fields plus a stable `sourceId`. A table supplies `sourceId`, `caption`, `columns`, and equally sized `rows`. Source IDs allow tests to prove that source-document media appears in both lesson and quiz material.

## Project layout

```text
study-aid-poc/
├── .github/workflows/pages.yml  GitHub Pages deployment
├── data/
│   ├── course.schema.json       Course authoring contract
│   └── courses/                 Catalog and course JSON
├── public/                      Static application and PWA assets
├── server/index.js              Optional local static server
└── test/                        Grader and course-data tests
```

## Privacy and limitations

- The site and course answers are public when deployed to GitHub Pages.
- Progress is private to one browser profile and does not sync across devices.
- There is no teacher dashboard or centralized result collection.
- Browser speech recognition may be handled by the browser vendor; typing always works.
