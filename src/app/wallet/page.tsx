import type { Metadata } from "next";
import { WalletView } from "@/components/wallet-view";

export const metadata: Metadata = { title: "Apple Wallet" };
export default function WalletPage() { return <WalletView />; }
