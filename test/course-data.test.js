import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const coursesDirectory = path.resolve("data/courses");
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));

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
      if (lesson.image) {
        assert.ok(lesson.image.alt);
        const imagePath = path.resolve("public", lesson.image.src);
        await readFile(imagePath);
      }
    }
    for (const question of course.questions) {
      assert.ok(["spoken", "choice"].includes(question.type));
      assert.ok(question.acceptedAnswers.length > 0);
      if (question.type === "choice") assert.ok(question.options.length > 1);
      if (question.image) {
        assert.ok(question.image.alt);
        const imagePath = path.resolve("public", question.image.src);
        await readFile(imagePath);
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
  assert.ok(course.questions.filter(({ image }) => image).length >= 7, "expected source figures in the quiz");
});
