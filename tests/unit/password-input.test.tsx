import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { TextField } from "@/components/ui/TextField";

describe("PasswordInput", () => {
  it("parte nascosto e l'occhio mostra e nasconde i caratteri", () => {
    render(<PasswordInput aria-label="Segreto" defaultValue="abc12345" />);
    const input = screen.getByLabelText("Segreto");
    expect(input).toHaveAttribute("type", "password");

    const toggle = screen.getByRole("button", { name: "Mostra caratteri" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(toggle);
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("abc12345");

    fireEvent.click(screen.getByRole("button", { name: "Nascondi caratteri" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("l'occhio non invia il form", () => {
    let submitted = false;
    render(
      <form onSubmit={(e) => { e.preventDefault(); submitted = true; }}>
        <PasswordInput aria-label="Segreto" />
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Mostra caratteri" }));
    expect(submitted).toBe(false);
  });
});

describe("TextField", () => {
  it("un campo password ha l'occhio, e il nome del pulsante non lo fa trovare cercando 'Password'", () => {
    render(<TextField id="pw" label="Password" type="password" />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(screen.getAllByLabelText(/password/i)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Mostra caratteri" })).toBeInTheDocument();
  });

  it("gli altri campi non hanno l'occhio", () => {
    render(<TextField id="e" label="Email" type="email" />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("type", "email");
    expect(screen.queryByRole("button")).toBeNull();
  });
});
