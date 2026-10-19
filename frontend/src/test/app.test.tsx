import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "../App";
import { buildHeatmap, regCell, tier } from "../heatmap";
import real from "./fixtures/assessment_real_format.json";
import ambiguous from "./fixtures/assessment_ambiguous.json";
import type { Assessment } from "../types";

const a = real as unknown as Assessment;

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
beforeEach(() => { window.location.hash = "#/"; });
afterEach(() => vi.restoreAllMocks());

test("tier boundaries: grey when unaffected, three red shades by share of conflicting requirements", () => {
  expect([tier(0, 3), tier(1, 3), tier(2, 3), tier(3, 3), tier(1, 1)]).toEqual([0, 1, 2, 3, 3]);
});

test("real model output: EMIR/UKEMIR red, ASIC/MAS/HKMA grey, region labels come from the model", () => {
  const rows = Object.fromEntries(a.compliance_table.map((r) => [r.regulation, regCell(r)]));
  expect(rows.EMIR.level).toBe(3);
  expect(rows.ASIC.level).toBe(0);
  const hm = buildHeatmap(a);
  const emea = hm.find((r) => r.region === "EMEA")!;
  const apac = hm.find((r) => r.region === "APAC")!;
  expect(emea.riskStatus).toBe("High Risk");
  expect(emea.level).toBe(3);
  expect(apac.riskStatus).toBe("Safe to Implement");
  expect(apac.level).toBe(0);
});

test("needs_review regulation is never grey-as-safe", () => {
  const b = structuredClone(a);
  b.compliance_table[2].effective_status = "needs_review";
  const apac = buildHeatmap(b).find((r) => r.region === "APAC")!;
  expect(apac.review).toBe(true);
  expect(apac.regulations.find((r) => r.regulation === "ASIC")!.status).toBe("needs_review");
});

test("submitting with Enter shows the table, citations, heatmap and reasoning", async () => {
  const f = vi.spyOn(globalThis, "fetch").mockImplementation(() => json(real, 201));
  render(<App />);
  const box = screen.getByLabelText(/type the change request/i);
  fireEvent.change(box, { target: { value: "Update the event timestamp field" } });
  fireEvent.keyDown(box, { key: "Enter" });
  await screen.findByText(/Do Not Proceed globally - non-compliant with 2 of 5 regulations; may proceed only for: ASIC, MAS, HKMA/);
  expect(JSON.parse((f.mock.calls[0][1] as RequestInit).body as string)).toEqual({ cr_text: "Update the event timestamp field" });
  expect(screen.getByText(/emir_field_specifications.xlsx, Sheet: Field Specifications, Row 174/)).toBeInTheDocument();
  expect(screen.getByText("High Risk")).toBeInTheDocument();
  expect(screen.getByText("Safe to Implement")).toBeInTheDocument();
  expect(screen.getByText("Chain of Thought")).toBeInTheDocument();
  expect(screen.getByText("Spectrum of Complexity")).toBeInTheDocument();
});

test("Shift+Enter does not submit", () => {
  const f = vi.spyOn(globalThis, "fetch").mockImplementation(() => json(real, 201));
  render(<App />);
  fireEvent.keyDown(screen.getByLabelText(/type the change request/i), { key: "Enter", shiftKey: true });
  expect(f).not.toHaveBeenCalled();
});

test("backend validation error is shown with its code (blank input)", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(() => json({ error: { code: "cr_blank", message: "The change request is empty.", details: {} }, request_id: "abc" }, 422));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /assess impact/i }));
  const alert = await screen.findByRole("alert");
  expect(alert).toHaveTextContent("The change request is empty.");
  expect(alert).toHaveTextContent("cr_blank");
  expect(alert).toHaveTextContent("request abc");
});

test("unreachable backend gives a clear message", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(() => Promise.reject(new TypeError("fetch failed")));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /assess impact/i }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Cannot reach the backend");
});

test("ambiguous CR shows the model's clarification question and no table", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(() => json(ambiguous, 201));
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: /assess impact/i }));
  await screen.findByText("Which field should change?");
  expect(screen.queryByRole("table")).toBeNull();
});

test("history lists saved assessments and opens one", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation((url) => {
    const u = String(url);
    if (u.includes("/assessments?")) return json({ items: [{ id: a.id, cr_id: a.cr_id, cr_preview: "Update the event timestamp", source_type: "text", status: "assessed", overall_conclusion: "Do Not Proceed", risk_score: 40, results: { EMIR: "non_compliant", ASIC: "compliant" }, parent_assessment_id: null, created_at: a.created_at }], total: 1, limit: 20, offset: 0 });
    return json(a);
  });
  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "History" }));
  fireEvent.click(await screen.findByText("Update the event timestamp"));
  await waitFor(() => expect(screen.getByText(/non-compliant with 2 of 5/)).toBeInTheDocument());
});
