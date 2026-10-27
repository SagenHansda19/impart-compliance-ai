import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { CitationBadge, formatCitationPill } from "../components/CitationBadge";

describe("CitationBadge & formatCitationPill", () => {
  test("formats raw citations into sleek [Doc : Locator] badge pills", () => {
    expect(
      formatCitationPill("emir_field_specifications.xlsx, Sheet: Field Specifications, Row 174")
    ).toBe("[Emir Specs : Row 174]");

    expect(
      formatCitationPill("ASIC Derivative Transaction Rules 2024, Rule 2.2.1")
    ).toBe("[ASIC Derivative Transaction Rules 2024 : Rule 2.2.1]");

    expect(
      formatCitationPill("[EMIR REFIT : Art 9]")
    ).toBe("[EMIR REFIT : Art 9]");

    expect(
      formatCitationPill("MAS Notice SFA 04-N12, Section 5")
    ).toBe("[MAS Notice SFA 04-N12 : Section 5]");
  });

  test("renders sleek pill and expands tooltip on hover/click with verbatim pgvector snippet", () => {
    const citation = "emir_field_specifications.xlsx, Sheet: Field Specifications, Row 174";
    const snippet = "Data Type & Format: Alphanumeric, up to 35 characters.";

    render(
      <CitationBadge
        citation={citation}
        snippet={snippet}
        regulation="EMIR"
      />
    );

    // Initial render displays the badge button
    const btn = screen.getByRole("button");
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveTextContent("[Emir Specs : Row 174]");

    // Click to expand modal / popover
    fireEvent.click(btn);

    // Verbatim text from pgvector is now visible
    expect(screen.getByText(/Data Type & Format: Alphanumeric, up to 35 characters/)).toBeInTheDocument();
    expect(screen.getByText("pgvector Verbatim Chunk")).toBeInTheDocument();
  });
});
