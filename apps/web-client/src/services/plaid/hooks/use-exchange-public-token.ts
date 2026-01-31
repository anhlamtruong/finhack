import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { InferRequestType, InferResponseType } from "hono";
import { client } from "@/lib/hono";
import { useInvalidatePlaidQueries } from "./use-invalidate-plaid-queries";

type ResponseType = InferResponseType<
  typeof client.api.plaid["exchange-public-token"]["$post"],
  200
>;
type RequestType = InferRequestType<
  typeof client.api.plaid["exchange-public-token"]["$post"]
>["json"];

export const useExchangePublicToken = () => {
  const { invalidateAll } = useInvalidatePlaidQueries();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async (json) => {
      const response = await client.api.plaid["exchange-public-token"].$post({
        json,
      });

      if (!response.ok) {
        throw Error("Failed to exchange public token!");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast.success("Plaid Public Token Exchange!");
      invalidateAll();
    },
    onError: () => {
      toast.error("Failed to to exchange public token!");
    },
  });

  return mutation;
};
