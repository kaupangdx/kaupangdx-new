"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "./header";
import { SwapForm } from "./xyk/swap-form";
import { Wallet } from "./wallet/wallet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "./ui/button";
import { ChevronDown, ChevronRight, ChevronUp, Cog } from "lucide-react";
import { FaucetForm } from "./faucet/faucet-form";
import { TokenInput } from "./ui/token-input";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger,
} from "@/components/ui/menubar";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/toaster";

export interface HomeProps {
  swapForm: JSX.Element;
  wallet: JSX.Element;
  addLiquidityForm: JSX.Element;
  removeLiquidityForm: JSX.Element;
  transferForm: JSX.Element;
}

export function Home({
  swapForm,
  wallet,
  addLiquidityForm,
  removeLiquidityForm,
  transferForm,
}: HomeProps) {
  const [tab, setTab] = useState("swap");
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  return (
    <div className="flex items-center justify-center">
      <Toaster />
      <div className="flex basis-11/12 flex-col 2xl:basis-10/12">
        <Header />

        <div className="flex justify-center">
          <div className=" mt-24  max-w-md basis-11/12 justify-center md:basis-4/12">
            <Tabs activationMode="manual" value={tab}>
              <div className="mb-4 flex justify-between">
                <TabsList className="border border-muted bg-transparent">
                  <TabsTrigger
                    onClick={() => setTab("swap")}
                    value="swap"
                    className="data-[state=active]:bg-muted"
                  >
                    Swap
                  </TabsTrigger>
                  <TabsTrigger
                    value="pools"
                    onClick={(e) => e.stopPropagation()}
                    className="p-0 data-[state=active]:bg-muted"
                  >
                    <Menubar>
                      <MenubarMenu>
                        <MenubarTrigger
                          onClick={() => setContextMenuOpen(true)}
                          className={cn([
                            "flex cursor-pointer items-center border-0 bg-transparent ring-0",
                            {
                              "bg-accent text-foreground":
                                tab === "pools-add" || tab === "pools-remove",
                            },
                          ])}
                        >
                          Pools{" "}
                          <div className={cn(["h-4 w-4"])}>
                            <ChevronDown
                              className={cn([
                                "ml-1 mt-[0.5px] h-4 w-4 transition-all duration-300",
                                {
                                  "rotate-180": contextMenuOpen,
                                },
                              ])}
                            />
                          </div>
                        </MenubarTrigger>
                        <MenubarContent
                          onInteractOutside={() => setContextMenuOpen(false)}
                          onClick={() => setContextMenuOpen(false)}
                        >
                          <MenubarItem onClick={() => setTab("pools-add")}>
                            Add liquidity
                          </MenubarItem>
                          <MenubarItem onClick={() => setTab("pools-remove")}>
                            Remove liquidity
                          </MenubarItem>
                        </MenubarContent>
                      </MenubarMenu>
                    </Menubar>
                  </TabsTrigger>

                  <TabsTrigger
                    onClick={() => setTab("transfer")}
                    value="transfer"
                    className="data-[state=active]:bg-muted"
                  >
                    Transfer
                  </TabsTrigger>
                </TabsList>

                <Popover>
                  <PopoverTrigger disabled={true}>
                    <Button
                      disabled={true}
                      size={"icon"}
                      variant={"outline"}
                      className="rounded-xl text-muted-foreground"
                    >
                      <Cog className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent>
                    Place content for the popover here.
                  </PopoverContent>
                </Popover>
              </div>

              <TabsContent value="swap">{swapForm}</TabsContent>

              <TabsContent value="pools-add">{addLiquidityForm}</TabsContent>
              <TabsContent value="pools-remove">
                {removeLiquidityForm}
              </TabsContent>

              <TabsContent value="transfer">{transferForm}</TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
      {wallet}
    </div>
  );
}
