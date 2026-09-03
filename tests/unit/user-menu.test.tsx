import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserMenu } from "@/components/layout/UserMenu";

const baseProps = {
  userId: "user-1",
  firstName: "Ada",
  lastName: "Lovelace",
  displayName: "Ada Lovelace",
  avatarUrl: null,
};

describe("UserMenu", () => {
  it("shows the display name but not the menu items until opened", () => {
    render(<UserMenu {...baseProps} />);

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Impostazioni" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Esci" })).not.toBeInTheDocument();
  });

  it("reveals Impostazioni and Esci when clicked", () => {
    render(<UserMenu {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Ada Lovelace/ }));

    expect(screen.getByRole("link", { name: "Impostazioni" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Esci" })).toBeInTheDocument();
  });

  it("closes again when clicking the toggle a second time", () => {
    render(<UserMenu {...baseProps} />);

    const toggle = screen.getByRole("button", { name: /Ada Lovelace/ });
    fireEvent.click(toggle);
    expect(screen.getByRole("link", { name: "Impostazioni" })).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.queryByRole("link", { name: "Impostazioni" })).not.toBeInTheDocument();
  });
});
