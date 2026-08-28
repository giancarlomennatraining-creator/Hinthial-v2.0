import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserMenu } from "@/components/layout/UserMenu";

describe("UserMenu", () => {
  it("shows the display name but not the menu items until opened", () => {
    render(<UserMenu displayName="Ada Lovelace" />);

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Impostazioni" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Esci" })).not.toBeInTheDocument();
  });

  it("reveals Impostazioni and Esci when clicked", () => {
    render(<UserMenu displayName="Ada Lovelace" />);

    fireEvent.click(screen.getByRole("button", { name: /Ada Lovelace/ }));

    expect(screen.getByRole("link", { name: "Impostazioni" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Esci" })).toBeInTheDocument();
  });

  it("closes again when clicking the toggle a second time", () => {
    render(<UserMenu displayName="Ada Lovelace" />);

    const toggle = screen.getByRole("button", { name: /Ada Lovelace/ });
    fireEvent.click(toggle);
    expect(screen.getByRole("link", { name: "Impostazioni" })).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByRole("link", { name: "Impostazioni" })).not.toBeInTheDocument();
  });
});
