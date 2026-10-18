import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "@/components/ui/Avatar";

describe("Avatar", () => {
  it("senza foto mostra le iniziali su un colore deciso dal seed, sempre lo stesso", () => {
    const first = render(<Avatar firstName="Maria" lastName="Rossi" avatarUrl={null} seed="id-1" />);
    const again = render(<Avatar firstName="Maria" lastName="Rossi" avatarUrl={null} seed="id-1" />);
    const a = first.container.querySelector("span[aria-hidden]")!;
    const b = again.container.querySelector("span[aria-hidden]")!;
    expect(a.textContent).toBe("MR");
    expect(a.className).toBe(b.className);
  });

  it("con `neutral` il segnaposto è grigio, qualunque sia il seed (l'anteprima di chi non c'è ancora)", () => {
    for (const seed of ["a", "b", "c", "d", "e"]) {
      const { container } = render(<Avatar firstName="Luca" lastName="Bianchi" avatarUrl={null} seed={seed} neutral />);
      const circle = container.querySelector("span[aria-hidden]")!;
      expect(circle.className).toContain("bg-zinc-500");
    }
  });
});
