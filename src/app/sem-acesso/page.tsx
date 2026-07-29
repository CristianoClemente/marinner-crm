import { getApexUrl } from "@/lib/domain";
import { SemAcessoClient } from "./sem-acesso-client";

export default function SemAcessoPage() {
  return <SemAcessoClient apexUrl={getApexUrl()} />;
}
