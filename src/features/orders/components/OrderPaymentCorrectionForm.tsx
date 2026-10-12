import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "../../../components/ui/Button";
import { formatCurrencyBR, parseCurrencyInput } from "../../../utils/money";
import type { Order, OrderPayment } from "../orderTypes";
import type { CorrectOrderPaymentInput } from "../ordersService";
import { formatDateTimeBR } from "../orderUtils";

interface OrderPaymentCorrectionFormProps {
  order: Order;
  payment: OrderPayment;
  onCancel: () => void;
  onSave: (input: CorrectOrderPaymentInput) => Promise<void>;
}

function toLocalDateTimeInput(value: string | null) {
  if (value === null) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function OrderPaymentCorrectionForm({ order, payment, onCancel, onSave }: OrderPaymentCorrectionFormProps) {
  const [amount, setAmount] = useState(payment.amount.toFixed(2).replace(".", ","));
  const [receivedAt, setReceivedAt] = useState(() => toLocalDateTimeInput(payment.receivedAt));
  const [receivedAtChanged, setReceivedAtChanged] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = parseCurrencyInput(amount);
    if (parsedAmount === null || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Informe um valor maior que zero.");
      return;
    }
    if (receivedAtChanged && !receivedAt && payment.receivedAt !== null) {
      setError("Informe a data e hora correta. Uma data conhecida não pode ser apagada.");
      return;
    }

    let nextReceivedAt = payment.receivedAt;
    if (receivedAtChanged && !receivedAt) nextReceivedAt = null;
    if (receivedAtChanged && receivedAt) {
      const parsedDate = new Date(receivedAt);
      if (Number.isNaN(parsedDate.getTime())) {
        setError("Informe uma data e hora válidas.");
        return;
      }
      nextReceivedAt = parsedDate.toISOString();
    }

    setSaving(true);
    setError("");
    try {
      await onSave({ amount: parsedAmount, receivedAt: nextReceivedAt });
      onCancel();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível corrigir o recebimento.");
      setSaving(false);
    }
  }

  return (
    <form className="panel-form" onSubmit={handleSubmit}>
      <div className="panel-section">
        <div className="panel-section-title">
          <span>Pedido #{order.id}</span>
          <small>{order.clientName} · correção do recebimento existente</small>
        </div>
        <div className="panel-block-grid">
          <div className="panel-block">
            <span>Valor atual</span>
            <strong>{formatCurrencyBR(payment.amount)}</strong>
          </div>
          <div className="panel-block">
            <span>Data e hora atuais</span>
            <strong>{payment.receivedAt ? formatDateTimeBR(payment.receivedAt) : "Data desconhecida"}</strong>
          </div>
        </div>
      </div>

      <div className="panel-section">
        <label className="panel-field-card">
          Novo valor
          <input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" autoFocus />
        </label>
        <label className="panel-field-card">
          Data e hora do recebimento
          <input type="datetime-local" value={receivedAt} onChange={(event) => { setReceivedAt(event.target.value); setReceivedAtChanged(true); }} />
          {payment.receivedAt === null && <small>A data continua desconhecida enquanto este campo ficar vazio.</small>}
        </label>
        {error && <p className="error-text" role="alert">{error}</p>}
      </div>

      <div className="panel-footer">
        <div className="panel-actions">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar correção"}</Button>
        </div>
      </div>
    </form>
  );
}
