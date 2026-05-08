import { auth } from "@/auth";
import { buildTrainingMatrix } from "@/lib/backend-core/training/matrix";
import { buildTrainingMatrixForUser } from "@/lib/backend-core/training/matrix-status";
import { SimulateClient } from "./simulate-client";

export const dynamic = "force-dynamic";

export default async function SimulatePage() {
    const session = await auth();
    const userId = session?.user?.id;
    const matrix = userId ? await buildTrainingMatrixForUser(userId) : buildTrainingMatrix();

    return <SimulateClient matrix={matrix} />;
}
