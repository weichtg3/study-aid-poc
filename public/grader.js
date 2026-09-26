const normalize = (value = "") => value
  .toLowerCase()
  .replace(/[^a-z0-9\s-]/g, " ")
  .replace(/\s+/g, " ")
  .trim();

const matchesConcept = (normalized, concept) => concept
  .split("|")
  .some((alternative) => normalized.includes(normalize(alternative)));

export function gradeAnswer(question, response) {
  const normalized = normalize(response);
  if (!normalized) return { status: "incorrect", score: 0, message: "I didn't catch an answer. Try speaking again or type your response." };

  const accepted = (question.acceptedAnswers || []).map(normalize);
  const exact = accepted.some((answer) => normalized === answer);
  const contained = accepted.some((answer) => answer.length >= 4 && (normalized.includes(answer) || answer.includes(normalized)));
  const concepts = question.requiredConcepts || [];
  const matchedConcepts = concepts.filter((concept) => matchesConcept(normalized, concept));
  const ratio = concepts.length ? matchedConcepts.length / concepts.length : 0;

  if (exact || contained || ratio === 1) return { status: "correct", score: 1, message: "That's right." };
  if (ratio >= 0.5) return { status: "partial", score: 0.5, message: "You're close. You have part of the idea—try once more." };
  return { status: "incorrect", score: 0, message: "Not quite. Review the hint and try again." };
}

export { normalize };
