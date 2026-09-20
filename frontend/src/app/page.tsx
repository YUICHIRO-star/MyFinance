import FinanceApp from "./FinanceApp";
import { demoSnapshot } from "@/lib/demo";
export const dynamic = "force-dynamic";
export default function Page() {
  // Never embed private provider data in HTML; fetch only from authenticated API.
  return (
    <FinanceApp
      demo={demoSnapshot()}
      configured={Boolean(process.env.GAS_WEB_APP_URL)}
    />
  );
}
