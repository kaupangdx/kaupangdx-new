import { Form } from "@/components/ui/form";
import { TransferForm as TransferFormComponent } from "@/components/wallet/transfer-form";
import { useObserveBalance, useTransfer } from "@/lib/stores/balances";
import { zodResolver } from "@hookform/resolvers/zod";
import { PublicKey } from "o1js";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { addPrecision, removePrecision } from "../xyk/add-liquidity-form";
import { useWalletStore } from "@/lib/stores/wallet";
import BigNumber from "bignumber.js";
export function TransferForm() {
  const [loading, setLoading] = useState(false);
  const walletBalance = useRef("0");
  const formSchema = z.object({
    to: z
      .string({
        required_error: "Recipient address is required",
        invalid_type_error: "Recipient address is required",
      })
      .min(1, { message: "Recipient address is required" })
      .refine(
        (data) => {
          try {
            PublicKey.fromBase58(data);
            return true;
          } catch (e) {
            return false;
          }
        },
        {
          message: "Invalid address",
        },
      ),
    amount_token: z
      .string({
        required_error: "Token is required",
        invalid_type_error: "Token is required",
      })
      .min(1, { message: "Token is required" }),
    amount_amount: z
      .string({
        required_error: "Amount is required",
        invalid_type_error: "Amount is required",
      })
      .min(1, { message: "Amount is required" })
      .refine(
        (data) => {
          return new BigNumber(data).lte(
            removePrecision(walletBalance.current),
          );
        },
        {
          message: "Insufficient balance",
        },
      ),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    reValidateMode: "onChange",
    mode: "onChange",
  });

  // useEffect(() => {
  //   form.trigger();
  // }, []);

  const transfer = useTransfer();
  const fields = form.getValues();
  const wallet = useWalletStore();
  const balance = useObserveBalance(fields.amount_token, wallet.wallet);

  useEffect(() => {
    walletBalance.current = balance ?? "0";
    form.formState.isDirty && form.trigger("amount_amount");
  }, [balance, form.formState.isDirty]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setLoading(true);
    try {
      await transfer(
        values.amount_token,
        values.to,
        addPrecision(values.amount_amount),
      );
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <TransferFormComponent loading={false} />
      </form>
    </Form>
  );
}
