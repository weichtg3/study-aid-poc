import assert from "node:assert/strict";
import test from "node:test";
import { gradeAnswer, normalize } from "../public/grader.js";

const question = {
  acceptedAnswers: ["ray florets are around the edge and disc florets are in the center"],
  requiredConcepts: ["ray", "edge|outside|outer", "disc", "center|inside|middle"]
};

test("normalizes punctuation and capitalization", () => {
  assert.equal(normalize("  The CAPITULUM! "), "the capitulum");
});

test("accepts a correct paraphrase containing every concept", () => {
  const result = gradeAnswer(question, "Ray flowers are outside, while disc flowers are in the middle.");
  assert.equal(result.status, "correct");
  assert.equal(result.score, 1);
});

test("gives partial credit when half the concepts are present", () => {
  const result = gradeAnswer(question, "Ray florets are on the outside.");
  assert.equal(result.status, "partial");
  assert.equal(result.score, 0.5);
});

test("rejects an unrelated response", () => {
  const result = gradeAnswer(question, "The flower has green leaves.");
  assert.equal(result.status, "incorrect");
});

test("handles an empty transcript", () => {
  const result = gradeAnswer(question, "");
  assert.equal(result.status, "incorrect");
});
