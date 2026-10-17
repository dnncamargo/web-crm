// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClientQuickForm } from "./ClientQuickForm";

afterEach(cleanup);

describe("ClientQuickForm", () => {
  it("prefills the name and reports the created identity", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue({ id: "new-client" });
    const onCancel = vi.fn();
    render(<ClientQuickForm favorite={false} initialName="Maria Oliveira" onSave={onSave} onCancel={onCancel} />);

    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Maria Oliveira");
    await user.type(screen.getByLabelText("WhatsApp principal"), " 22 99999-9999 ");
    await user.selectOptions(screen.getByLabelText("Frequência de contato"), "monthly");
    await user.click(screen.getByRole("button", { name: "Salvar cliente" }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      name: "Maria Oliveira",
      contactFrequency: "monthly",
      contacts: [expect.objectContaining({ value: "22 99999-9999", type: "whatsapp", isPrimary: true })],
    }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("keeps the form open with an error when creation fails", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockRejectedValue(new Error("offline"));
    const onCancel = vi.fn();
    render(<ClientQuickForm favorite={false} initialName="Maria Oliveira" onSave={onSave} onCancel={onCancel} />);

    await user.click(screen.getByRole("button", { name: "Salvar cliente" }));

    expect((await screen.findByRole("alert")).textContent).toContain("Não foi possível cadastrar o cliente");
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Maria Oliveira");
    expect(onCancel).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Salvar cliente" }) as HTMLButtonElement).disabled).toBe(false);
  });
});
