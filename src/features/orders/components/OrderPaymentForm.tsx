import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../../components/ui/Button";
import { formatCurrencyBR, parseCurrencyInput } from "../../../utils/money";
import type { Order } from "../orderTypes";
import type { RegisterOrderPaymentInput } from "../ordersService";
import { getOrderCashPaid } from "../orderUtils";

interface OrderPaymentFormProps {
  order: Order;
  onCancel: () => void;
  onSave: (input: RegisterOrderPaymentInput) => Promise<void>;
}

function toLocalDateTimeInput(date: Date) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60_000);

  return localDate.toISOString().slice(0, 16);
}

export function OrderPaymentForm({ order, onCancel, onSave }: OrderPaymentFormProps) {
  const [amount, setAmount] = useState("");
  const [receivedAt, setReceivedAt] = useState(() => toLocalDateTimeInput(new Date()));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const parsedAmount = parseCurrencyInput(amount);
    const parsedDate = new Date(receivedAt);

    if (parsedAmount === null || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }

    if (!receivedAt || Number.isNaN(parsedDate.getTime())) {
      setError("Informe uma data e hora válidas.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await onSave({ amount: parsedAmount, receivedAt: parsedDate.toISOString() });
      onCancel();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível registrar o pagamento.");
      setSaving(false);
    }
  }

  return (
    <form className="panel-form" onSubmit={handleSubmit}>
      <div className="panel-section">
        <div className="panel-section-title">
          <span>{order.clientName}</span>
          <small>O pagamento será anexado ao histórico e não pode ser editado ou excluído nesta versão.</small>
        </div>

        <div className="panel-block-grid">
          <div className="panel-block">
            <span>Dinheiro recebido</span>
            <strong>{formatCurrencyBR(getOrderCashPaid(order))}</strong>
          </div>

          <div className="panel-block">
            <span>Total do pedido</span>
            <strong>{formatCurrencyBR(order.total)}</strong>
          </div>
        </div>
      </div>

      <div className="panel-section">
        <label className="panel-field-card">
          Valor
          <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ex: 50,00" inputMode="decimal" autoFocus />
        </label>

        <label className="panel-field-card">
          Data e hora do recebimento
          <input type="datetime-local" value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)} />
        </label>

        {error && <p className="error-text">{error}</p>}
      </div>

      <div className="panel-footer">
        <div className="panel-actions">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Registrando..." : "Registrar pagamento"}
          </Button>
        </div>
      </div>
    </form>
  );
}
