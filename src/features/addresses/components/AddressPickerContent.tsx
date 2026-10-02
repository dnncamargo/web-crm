import { useState } from "react";

import { Button } from "../../../components/ui/Button";
import type { Address } from "../addressTypes";

interface AddressPickerContentProps {
  addresses: Address[];
  selectedAddressId: string;
  unresolvedAddressLabel?: string;
  onCancel: () => void;
  onConfirm: (addressId: string) => void;
  onRequestCreateAddress?: () => void;
}

function formatAddressSubtitle(address: Address) {
  const number = address.number ? `, ${address.number}` : "";
  const complement = address.complement ? ` · ${address.complement}` : "";
  const neighborhood = address.neighborhood ? ` · ${address.neighborhood}` : "";
  const city = address.city ? ` · ${address.city}` : "";
  const state = address.state ? `/${address.state}` : "";

  return `${address.street}${number}${complement}${neighborhood}${city}${state}`;
}

export function AddressPickerContent({
  addresses,
  selectedAddressId,
  unresolvedAddressLabel,
  onConfirm,
  onRequestCreateAddress,
}: AddressPickerContentProps) {
  const [draftAddressId, setDraftAddressId] = useState(selectedAddressId);

  return (
    <div className="panel-view">
      <div className="panel-columns panel-columns-1">
        <section className="panel-column">
          <div className="panel-column-scroll">
            <section className="panel-section">
              <div className="panel-section-title">
                <span>Endereço</span>
                <small>Selecione um endereço cadastrado para este pedido.</small>
              </div>

              <div className="entity-list-view">
                <button
                  type="button"
                  className={
                    !draftAddressId ? "entity-row selected" : "entity-row"
                  }
                  onClick={() => setDraftAddressId("")}
                >
                  <div className="entity-row-line">
                    <strong className="entity-title">
                      Retirada pelo cliente
                    </strong>

                    {!draftAddressId && (
                      <small className="entity-value">Selecionado</small>
                    )}
                  </div>

                  <span className="entity-subtitle">
                    O cliente retirará o pedido; nenhum endereço será salvo.
                  </span>
                </button>

                {selectedAddressId && unresolvedAddressLabel && !addresses.some((address) => address.id === selectedAddressId) && (
                  <button
                    type="button"
                    className={draftAddressId === selectedAddressId ? "entity-row selected" : "entity-row"}
                    onClick={() => setDraftAddressId(selectedAddressId)}
                  >
                    <div className="entity-row-line">
                      <strong className="entity-title">Endereço original não localizado</strong>
                      {draftAddressId === selectedAddressId && <small className="entity-value">Selecionado</small>}
                    </div>
                    <span className="entity-subtitle">{unresolvedAddressLabel}</span>
                  </button>
                )}

                {addresses.map((address) => {
                  const selected = address.id === draftAddressId;

                  return (
                    <button
                      type="button"
                      className={selected ? "entity-row selected" : "entity-row"}
                      key={address.id}
                      onClick={() => setDraftAddressId(address.id)}
                    >
                      <div className="entity-row-line">
                        <strong className="entity-title">
                          {address.label}
                        </strong>

                        {selected && (
                          <small className="entity-value">Selecionado</small>
                        )}
                      </div>

                      <span className="entity-subtitle">
                        {formatAddressSubtitle(address)}
                      </span>
                    </button>
                  );
                })}

                {addresses.length === 0 && (
                  <p className="panel-muted">Nenhum endereço cadastrado.</p>
                )}
              </div>
            </section>
          </div>
        </section>
      </div>

      <div className="panel-footer">
        <div className="panel-actions">
          {onRequestCreateAddress && (
            <Button type="button" variant="ghost" onClick={onRequestCreateAddress}>
              + Novo endereço
            </Button>
          )}

          <Button type="button" variant="primary" onClick={() => onConfirm(draftAddressId)}>
            Usar endereço
          </Button>
        </div>
      </div>
    </div>
  );
}
