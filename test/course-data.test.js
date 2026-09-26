import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const coursesDirectory = path.resolve("data/courses");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));
const allImages = (item) => [...(item.image ? [item.image] : []), ...(item.images || [])];

test("catalog entries point to versioned, internally consistent courses", async () => {
  const catalog = await readJson(path.join(coursesDirectory, "index.json"));
  assert.equal(catalog.schemaVersion, 1);
  assert.ok(catalog.courses.length > 0);

  for (const entry of catalog.courses) {
    assert.match(entry.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.match(entry.file, /^[a-z0-9-]+\.json$/);
    const course = await readJson(path.join(coursesDirectory, entry.file));
    assert.equal(course.schemaVersion, catalog.schemaVersion);
    assert.equal(course.id, entry.id);
    assert.ok(course.lessons.length > 0);
    assert.ok(course.questions.length > 0);
    assert.equal(new Set(course.lessons.map(({ id }) => id)).size, course.lessons.length);
    assert.equal(new Set(course.questions.map(({ id }) => id)).size, course.questions.length);
    for (const lesson of course.lessons) {
      for (const image of allImages(lesson)) {
        assert.ok(image.alt);
        const imagePath = path.resolve("public", image.src);
        await readFile(imagePath);
      }
      for (const table of lesson.tables || []) {
        assert.equal(table.columns.length, table.rows[0].length);
        assert.ok(table.rows.every((row) => row.length === table.columns.length));
      }
    }
    for (const question of course.questions) {
      assert.ok(["spoken", "choice"].includes(question.type));
      assert.ok(question.acceptedAnswers.length > 0);
      if (question.type === "choice") assert.ok(question.options.length > 1);
      for (const image of allImages(question)) {
        assert.ok(image.alt);
        const imagePath = path.resolve("public", image.src);
        await readFile(imagePath);
      }
      for (const table of question.tables || []) {
        assert.equal(table.columns.length, table.rows[0].length);
        assert.ok(table.rows.every((row) => row.length === table.columns.length));
      }
    }
  }
});

test("Plant Systematics includes the Exam 1 application material", async () => {
  const course = await readJson(path.join(coursesDirectory, "plant-systematics-sept-2026.json"));
  assert.ok(course.lessons.some(({ id }) => id === "applying-phylogenetic-evidence"));
  assert.ok(course.questions.some(({ topic }) => topic === "Character matrices · Exam practice"));
  assert.ok(course.questions.some(({ topic }) => topic === "Classification revision · Exam practice"));
  assert.ok(course.questions.length >= 40);
  assert.ok(course.lessons.some(({ image }) => image), "expected images in the lesson material");
  assert.ok(course.questions.filter((question) => allImages(question).length).length >= 7, "expected source figures in the quiz");
});

test("every source image and table appears in both learning and quiz material", async () => {
  const course = await readJson(path.join(coursesDirectory, "plant-systematics-sept-2026.json"));
  const docxPath = path.resolve("data/source/Exam-1-practice-questions.docx");
  const pdfPath = path.resolve("data/source/PlantSystematics26Sep2026.pdf");
  const docxBytes = await readFile(docxPath);
  const pdfBytes = await readFile(pdfPath, "latin1");
  const docxMedia = new Set(docxBytes.toString("latin1").match(/word\/media\/image\d+\.(?:png|jpe?g)/g));
  const documentXml = execFileSync("unzip", ["-p", docxPath, "word/document.xml"], { encoding: "utf8" });
  const docxTableCount = documentXml.match(/<w:tbl>/g)?.length || 0;
  const pdfImageCount = pdfBytes.match(/\/Subtype\s*\/Image/g)?.length || 0;

  assert.equal(docxMedia.size, 11, "source DOCX image inventory changed");
  assert.equal(docxTableCount, 2, "source DOCX table inventory changed");
  assert.equal(pdfImageCount, 3, "source PDF image inventory changed");

  const expectedImages = new Set([
    ...[...docxMedia].map((name) => `docx:${name}`),
    ...Array.from({ length: pdfImageCount }, (_, index) => `pdf:image-${index + 1}`),
    "docx:drawing-item-12"
  ]);
  const lessonImages = new Set(course.lessons.flatMap(allImages).map(({ sourceId }) => sourceId).filter(Boolean));
  const quizImages = new Set(course.questions.flatMap(allImages).map(({ sourceId }) => sourceId).filter(Boolean));
  assert.deepEqual(lessonImages, expectedImages);
  assert.deepEqual(quizImages, expectedImages);

  const expectedTables = new Set(["docx:table-6", "docx:table-12"]);
  const lessonTables = new Set(course.lessons.flatMap(({ tables = [] }) => tables).map(({ sourceId }) => sourceId));
  const quizTables = new Set(course.questions.flatMap(({ tables = [] }) => tables).map(({ sourceId }) => sourceId));
  assert.deepEqual(lessonTables, expectedTables);
  assert.deepEqual(quizTables, expectedTables);
});

test("every DOCX practice subquestion is represented in source order", async () => {
  const course = await readJson(path.join(coursesDirectory, "plant-systematics-sept-2026.json"));
  const expectedIds = [
    "1", "2", "3", "4a", "4b", "4c", "4d", "4e", "5a", "5b",
    "6a", "6b", "6c", "6d", "7", "8", "9a", "9b", "9c", "9d",
    "10a", "10b", "10c", "11a", "11b", "11c", "11d", "11e", "11f", "11g", "11h", "12a", "12b"
  ];
  const sourceQuestions = course.questions.filter(({ id }) => id.startsWith("docx-"));
  assert.deepEqual(sourceQuestions.map(({ id }) => id.slice(5)), expectedIds);
  assert.equal(sourceQuestions.length, 33);
  assert.ok(sourceQuestions.every(({ prompt }) => prompt.length > 0));
});
