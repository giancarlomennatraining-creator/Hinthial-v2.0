import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ContinuitySign } from "@/components/dashboard/ContinuitySign";

describe("ContinuitySign", () => {
  it("accende una foglia e una stella per ogni passo fatto, nell'ordine dei passi", () => {
    const { container } = render(<ContinuitySign done={[true, false, true, false]} />);
    expect(container.querySelectorAll(".sig-foglia .sig-leaf-on")).toHaveLength(2);
    expect(container.querySelectorAll(".sig-notte .sig-star-on")).toHaveLength(2);
    expect(container.querySelectorAll(".sig-notte .sig-line-on")).toHaveLength(2);
    // Le foglie spente restano, tratteggiate, al loro posto: i posti sono sempre quattro.
    expect(container.querySelectorAll(".sig-foglia path[class*='dasharray']")).toHaveLength(2);
  });

  it("senza passi fatti non accende niente", () => {
    const { container } = render(<ContinuitySign done={[false, false, false, false]} />);
    expect(container.querySelectorAll(".sig-leaf-on, .sig-star-on, .sig-line-on")).toHaveLength(0);
  });

  it("è solo decorativo: i disegni sono nascosti agli screen reader", () => {
    const { container } = render(<ContinuitySign done={[true, true, true, true]} />);
    for (const svg of Array.from(container.querySelectorAll("svg"))) expect(svg.getAttribute("aria-hidden")).toBe("true");
  });
});
