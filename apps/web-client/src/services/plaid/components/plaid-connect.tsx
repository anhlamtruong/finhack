"use client";

import { useMount } from "react-use";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { useCreateLinkToken } from "../hooks/use-create-link-token";
import { useExchangePublicToken } from "../hooks/use-exchange-public-token";

export const PlaidConnect = () => {
  const [token, setToken] = useState<string | null>(null);

  const createLinkToken = useCreateLinkToken();
  const exchangePublicToken = useExchangePublicToken();
  useMount(() => {
    createLinkToken.mutate(undefined, {
      onSuccess: ({ data }) => {
        setToken(data);
      },
    });
  });
  const plaid = usePlaidLink({
    token: token,
    onSuccess: (publicToken) => {
      exchangePublicToken.mutate({ publicToken });
    },
    env: "sandbox",
  });
  const onClick = () => {
    if (plaid.ready) {
      plaid.open();
    }
  };

  const isDisable = !plaid.ready || exchangePublicToken.isPending;

  return (
    <Button
      onClick={onClick}
      disabled={isDisable}
      size={"sm"}
      variant={"ghost"}
    >
      Connect
    </Button>
  );
};
