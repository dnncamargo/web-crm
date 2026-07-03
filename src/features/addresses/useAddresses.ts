import { useEffect, useMemo, useState } from "react";

import type { Address, NewAddressData, UpdateAddressData } from "./addressTypes";
import {
  createAddress,
  listenAddresses,
  updateAddress,
} from "./addressesService";

export function useAddresses() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [addressesError, setAddressesError] = useState("");

  useEffect(() => {
    const unsubscribe = listenAddresses(
      (loadedAddresses) => {
        setAddresses(loadedAddresses);
        setLoadingAddresses(false);
      },
      (firebaseError) => {
        setAddressesError(firebaseError.message);
        setLoadingAddresses(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const activeAddresses = useMemo(
    () => addresses.filter((address) => address.active),
    [addresses]
  );

  function getAddressesByClient(clientId: string) {
    return activeAddresses.filter((address) => address.clientId === clientId);
  }

  async function addAddress(data: NewAddressData) {
    return createAddress(data);
  }

  async function editAddress(addressId: string, data: UpdateAddressData) {
    return updateAddress(addressId, data);
  }

  return {
    addresses,
    activeAddresses,
    loadingAddresses,
    addressesError,
    getAddressesByClient,
    addAddress,
    editAddress,
  };
}